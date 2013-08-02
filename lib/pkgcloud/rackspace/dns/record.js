/*
 * record.js: Rackspace Cloud DNS Record
 *
 * (C) 2013 Rackspace
 *      Ken Perkins
 * MIT LICENSE
 *
 */

var utile = require('utile'),
    base = require('../../core/dns/record'),
    Attribute = require('../../core/base').Attribute,
    _ = require('underscore');

var Record = exports.Record = function Record(client, details) {
  base.Record.call(this, client, details);
};

utile.inherits(Record, base.Record);

Record.prototype._getAttributes = function () {
  return {
    id: 'id',
    name: 'name',
    type: 'type',
    ttl: 'ttl',
    data: 'data',
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