/*
 * client.js: Base client from which all OpenStack clients inherit from
 *
 * (C) 2013 Nodejitsu Inc.
 *
 */

var utile = require('utile'),
    request = require('request'),
    auth = require('../common/auth'),
    ps = require('pause-stream'),
    base = require('../core/base'),
    errs = require('errs'),
    identity = require('./identity');

/**
 * Client
 *
 * @description Base client from which all OpenStack clients inherit from,
 * inherits from core.Client
 *
 * @type {Function}
 */
var Client = exports.Client = function (options) {
  base.Client.call(this, options);

  this.authUrl    = options.authUrl || 'auth.api.trystack.org';
  this.provider   = 'openstack';
  this.region     = options.region;

  if (!/^http[s]?\:\/\//.test(this.authUrl)) {
    this.authUrl = 'http://' + this.authUrl;
  }

  if (!this.before) {
    this.before = [];
  }

  this.before.push(auth.authToken);
  this.before.push(function (req) {
    req.json = true;
    if (typeof req.body !== 'undefined') {
      req.headers['Content-Type'] = 'application/json';
    }
  });
};

utile.inherits(Client, base.Client);

Client.prototype.failCodes = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Resize not allowed',
  404: 'Item not found',
  409: 'Build in progress',
  413: 'Over Limit',
  415: 'Bad Media Type',
  500: 'Fault',
  503: 'Service Unavailable'
};

Client.prototype.successCodes = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-authoritative information',
  204: 'No content'
};

/**
 * Client.auth
 *
 * @description This function handles the primary authentication for OpenStack
 * and, if successful, sets an identity object on the client
 *
 * @param callback
 */
Client.prototype.auth = function (callback) {
  var self = this;

  var options = {
    url: self.authUrl,
    username: self.config.username,
    password: self.config.password,
    region: self.region
  };

  if (self.config.tenantId) {
    options.tenantId = self.config.tenantId;
  }
  else if (self.config.tenantName) {
    options.tenantName = self.config.tenantName;
  }

  identity.createIdentity(options, function (err, auth) {
    if (err) {
      return callback(err);
    }

    self.identity = auth;
    self.authorized = true;
    callback();
  });
};

/**
 * Client.serviceUrl
 *
 * @description gets the endpoint for a given service (by type)
 *
 * @param {String}    service   the service type to get an endpoint for
 * @returns {string}            the service endpoint url
 */
Client.prototype.getServiceUrl = function serviceUrl(service) {
  var svc = this.identity ? this.identity.serviceCatalog.getServiceByType(service) : null;

  return svc
    ? svc.getEndpointUrl()
    : '';
};

/**
 * Client._doRequest
 *
 * @description custom _doRequest implementation for supporting inline auth for
 * OpenStack. this allows piping while not yet possesing a valid auth token
 *
 * @param payload
 * @returns {*}
 * @private
 */
Client.prototype._doRequest = function (options, callback) {

  var self = this;



  if (!self.authorized) {
    self.emit('log::debug', 'Not-Authenticated, inlining Auth...');
    var buf = ps().pause();


    self.auth(function (err) {

      if (err) {
        self.emit('log::error', 'Error with inline authentication', err);
        return errs.handle(err, callback);
      }

      self.emit('log::debug', 'Creating Authenticated Proxy Request');
      var apiStream = Client.super_.prototype._doRequest.call(self, options, callback);

      if (options.upload) {
        buf.pipe(apiStream);
      }
      else if (options.download) {
        apiStream.pipe(buf);
      }

      buf.resume();
    });

    return buf;
  }
  else {
    self.emit('log::debug', 'Creating Authenticated Request');
    return Client.super_.prototype._doRequest.call(self, options, callback);
  }
};