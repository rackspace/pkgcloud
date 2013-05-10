/*
 * servers.js: Instance methods for working with servers from OpenStack Cloud
 *
 * (C) 2013 Nodejitsu Inc.
 *
 */
var request  = require('request'),
    base     = require('../../../core/compute'),
    pkgcloud = require('../../../../../lib/pkgcloud'),
    errs     = require('errs'),
    util     = require('util'),
    Server   = require('../server').Server,
    compute  = pkgcloud.providers.openstack.compute,
    _        = require('underscore');

//
// Helper method for performing 'Server Actions' to /servers/:id/action
// e.g. Reboot, Rebuild, Resize, Confirm Resize, Revert Resize
//
exports.serverAction = function (server, body, callback) {
  var self = this,
      serverId = server instanceof Server ? server.id : server;

  if (!body || !serverId) {
    return errs.handle(
      errs.create({ message: 'Missing required parameters' }),
      callback
    );
  }

  var actionOptions = {
    method: 'POST',
    path: ['servers', serverId, 'action'].join('/'),
    body: body
  };

  return self.request(actionOptions, function (err, body, res) {
    return err
      ? callback(err)
      : callback(err, body, res);
  });
};

exports.changeAdministratorPassword = function(server, newPassword, callback) {

  if (!server || !newPassword) {
    return errs.handle(
      errs.create({ message: 'Missing required parameters' }),
      callback
    );
  }

  return this.serverAction(server, {
    'changePassword': {
      'adminPass': newPassword
    }
  }, function(err) {
    return err
      ? callback(err)
      : callback(err, { ok: (server instanceof Server ? server.id : server )});
  });
};

// ### function getLimits (callback)
//
// Gets the current API limits
//
// #### @callback {function} f(err, version).
//
exports.getLimits = function (callback) {
  return this.request({
    path: 'limits'
  }, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, body.limits, res);
  });
};

// ### function getServers (callback)
//
// Lists all servers available to your account.
//
// #### @callback {function} f(err, servers). `servers` is an array that
// represents the servers that are available to your account
//
exports.getServers = function getServers(details, callback) {
  var self = this;

  if (typeof(details) === 'function') {
    callback = details;
    details = {};
  }

  var requestOptions = {
    path: '/servers/detail'
  };

  requestOptions.qs = _.pick(details,
    'image',
    'flavor',
    'name',
    'status',
    'marker',
    'limit',
    'changes-since');

  return this.request(requestOptions, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, body.servers.map(function (result) {
          return new compute.Server(self, result);
        }), res);
  });
};

// ### function createServer (options, callback)
//
// Creates a server with the specified options. The flavor
// properties of the options can be instances of Flavor
// OR ids to those entities in OpenStack.
//
// #### @opts {Object} **Optional** options
// ####    @name     {String} **Optional** a name for your server
// ####    @flavor   {String|Favor} **Optional** flavor to use for this image
// ####    @image    {String|Image} **Optional** the image to use
// ####    @required {Boolean} **Optional** Validate if flavor, name,
// and image are present
// ####    @*        {*} **Optional** Anything platform specific
// #### @callback {Function} f(err, server).
//
exports.createServer = function createServer(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options  = {};
  }

  options = options || {};

  var self          = this,
      createOptions = {
        method: 'POST',
        path:   'servers',
        body:   { server: _.pick(options,
          'name',
          'metadata',
          'personality' )}
      };

  if (!validateProperties(['flavor', 'image', 'name'], options,
    'options.%s is a required argument.', callback)) {
    return;
  }

  createOptions.body.server.flavorRef = options.flavor instanceof base.Flavor
    ? options.flavor.id
    : parseInt(options.flavor, 10);

  createOptions.body.server.imageRef = options.image instanceof base.Image
    ? options.image.id
    : options.image;

  if (options.keyname) {
    createOptions.body.server.key_name = options.keyname
  }

  return this.request(createOptions, function (err, body, res) {
    if (err) {
      callback(err);
    }

    if (!body.server) {
      return new Error('Server not passed back from OpenStack.');
    }

    callback(null, new Server(self, {
      id: body.server.id,
      name: options.name,
      adminPass: body.server.adminPass,
      flavorId: body.server.flavorRef,
      imageId: body.server.imageRef,
      personality: body.server.personality
    }), res);
  });
};

//
// ### function destroyServer(server, callback)
// #### @server {Server|String} Server id or a server
// #### @callback {Function} f(err, serverId).
//
// Destroy a server in OpenStack.
//
exports.destroyServer = function destroyServer(server, callback) {

  var serverId = server instanceof base.Server ? server.id : server;
  var destroyOptions = {
    method: 'DELETE',
    path: 'servers/' + serverId
  };

  if (!serverId) {
    return errs.handle(
      errs.create({ message: 'Server is a required parameter' }),
      callback
    );
  }

  return this.request(destroyOptions, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, {ok: serverId}, res);
  });
};

//
// ### function getServer(server, callback)
// #### @server {Server|String} Server id or a server
// #### @callback {Function} f(err, serverId).
//
// Gets a server in OpenStack.
//
exports.getServer = function getServer(server, callback) {
  var self       = this,
      serverId   = server instanceof base.Server ? server.id : server;

  if (!serverId) {
    return errs.handle(
      errs.create({ message: 'Server is a required parameter' }),
      callback
    );
  }

  return this.request({
    path: 'servers/' + serverId
  }, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, new compute.Server(self, body.server), res);
  });
};

//
// ### function rebootServer (server, options, callback)
// #### @server      {Server|String} The server to reboot
// #### @options     {Object} **Optional** options
// ####    @type     {String} **Optional** Soft or Hard. OpenStack only.
// ####    @*        {*}      **Optional** Anything platform specific
// #### @callback {Function} f(err, server).
//
// Reboots a server
//
exports.rebootServer = function rebootServer(server, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options  = {};
  }

  options.type = options.type ? options.type.toUpperCase() : 'SOFT';

  if (!server) {
    return errs.handle(
      errs.create({ message: 'Server is a required parameter' }),
      callback
    );
  }

  return this.serverAction(server, { 'reboot': options }, function(err) {
    return err
      ? callback(err)
      : callback(err, { ok: (server instanceof Server ? server.id : server) });
  });
};

//
// # Provider specific implementation follows
// **not officially supported**
//

exports.addFloatingIp = function (server, ip, callback) {
  var serverId = server instanceof base.Server ? server.id : server;

  serverAction.call(this, serverId, {
    addFloatingIp: {
      address: ip
    }
  }, callback);
};

exports.getServerAddresses = function (server, type, callback) {
  if (!callback && typeof type === 'function') {
    callback = type;
    type = '';
  }

  var serverId = server instanceof base.Server ? server.id : server,
      self = this;

  this.request({
    path: ['servers', serverId, 'ips', type].join('/')
  }, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, body.addresses || body, res);
  });
};

exports.renameServer = function (server, name, callback) {
  var serverId = server instanceof base.Server ? server.id : server;

  this.request({
    method: 'PUT',
    path: ['servers', serverId].join('/'),
    body: { server: { name: name } }
  }, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, body, res);
  });
};

exports.resizeServer = function (server, flavor, callback) {
  var self = this,
      flavorId = flavor instanceof base.Flavor ? flavor.id : flavor;

  self.serverAction(server, { 'resize': { 'flavorRef': flavorId } }, function (err) {
    return err
      ? callback(err)
      : callback(err, { ok: (server instanceof Server ? server.id : server) });
  });
};

exports.confirmServerResize = function (server, callback) {
  this.serverAction(server, { 'confirmResize': null }, function(err) {
    return err
      ? callback(err)
      : callback(err, { ok: (server instanceof Server ? server.id : server) });
  });
};

exports.revertServerResize = function (server, callback) {
  this.serverAction(server, { 'revertResize': null }, function (err) {
    return err
      ? callback(err)
      : callback(err, { ok: (server instanceof Server ? server.id : server) });
  });
};

// TODO allow for more complete rebuild options on a server
exports.rebuildServer = function (server, image, callback) {
  var self = this,
      imageId = image instanceof base.Image ? image.id : image;

  self.serverAction(server, { 'rebuild': { 'imageRef': imageId } }, function(err, body) {
    if (err) {
      return callback(err);
    }

    if (server instanceof Server) {
      server._setProperties(body.server);
      return callback(err, server);
    }

    return callback(err, new Server(self, body.server));
  });
};

exports.getServerBackup = function (server, callback) {
  var serverId = server instanceof base.Server ? server.id : server;
  var backupOptions = {
    method: 'GET',
    path: ['servers', serverId, 'backup_schedule'].join('/')
  };

  this.request(backupOptions, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, body.backupSchedule, res);
  });
};

exports.updateServerBackup = function (server, backup, callback) {
  var serverId = server instanceof base.Server ? server.id : server;
  var updateOptions = {
    method: 'POST',
    path: ['servers', serverId, 'backup_schedule'].join('/'),
    body: {
      backupSchedule: backup
    }
  };

  this.request(updateOptions, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, res);
  });
};

exports.disableServerBackup = function (server, callback) {
  var serverId = server instanceof base.Server ? server.id : server,
      disableUrl = ['servers', serverId, 'backup_schedule'].join('/');

  this.request({
    method: 'DELETE',
    path: disableUrl
  }, function (err, body, res) {
    return err
      ? callback(err)
      : callback(null, res);
  });
};

// Helper function for validating arguments for messages
function validateProperties(required, options, formatString, callback) {
  return !required.some(function (item) {
    if (typeof(options[item]) === 'undefined') {
      errs.handle(
        errs.create({ message: util.format(formatString, item) }),
        callback
      );
      return true;
    }
    return false;
  });
}
