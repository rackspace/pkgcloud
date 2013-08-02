/*
 * zone.js: Rackspace Cloud DNS Zone
 *
 * (C) 2013 Rackspace
 *      Ken Perkins
 * MIT LICENSE
 *
 */

var utile = require('utile'),
    base = require('../../core/dns/zone'),
    Attribute = require('../../core/base').Attribute,
    _ = require('underscore');

var Zone = exports.Zone = function Zone(client, details) {
  base.Zone.call(this, client, details);
};

utile.inherits(Zone, base.Zone);

Zone.prototype._getAttributes = function() {
  return {
    id: 'id',
    name: 'name',
    description: 'description',
    ttl: 'ttl',
    accountId: 'accountId',
    nameServers: new Attribute({
      key: 'nameservers',
      defaultValue: []
    }),
    emailAddress: 'emailAddress',
    created: new Attribute({
      key: 'created',
      transform: function (value) {
        return new Date(value);
      },
      defaultValue: new Date()
    }),
    updated: new Attribute({
      key: 'updated',
      transform: function (value) {
        return new Date(value);
      },
      defaultValue: new Date()
    })
  };
};
