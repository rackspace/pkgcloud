var identity = require('../../../lib/pkgcloud/openstack/identity'),
    should = require('should'),
    async = require('async'),
    helpers = require('../../helpers'),
    hock = require('hock'),
    mock = !!process.env.MOCK;

describe('pkgcloud/openstack/identity', function () {
  var server, adminServer;

  before(function (done) {

    if (!mock) {
      return done();
    }

    async.parallel([
      function(next) {
        hock.createHock(12346, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          server = hockClient;
          next();
        });
      },
      function(next) {
        hock.createHock(12347, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          adminServer = hockClient;
          next();
        });
      }], done);
  });

  describe('the pkgcloud openstack identity.createIdentity() function', function() {
    it('with no options should throw an error', function () {
      (function() {
        identity.createIdentity();
      }).should.throw('options is a required argument');
    });

    it('with only a callback should throw', function () {
      (function () {
        identity.createIdentity(function(err) { });
      }).should.throw('options is a required argument');
    });

    it('with incorrect types should throw', function () {
      (function () {
        identity.createIdentity(true, true);
      }).should.throw('options is a required argument');
    });

    it('with options.identity of an invalid type', function () {
      (function () {
        identity.createIdentity({ identity: true }, function(err) {});
      }).should.throw('options.identity must be an Identity if provided');
    });

    it('without a proper callback should throw', function () {
      (function () {
        identity.createIdentity({ identity: true }, true);
      }).should.throw('callback is a required argument');
    });

    it('with missing url should throw', function () {
      (function () {
        identity.createIdentity({}, function(err) {});
      }).should.throw('options.url is a required option');
    });

    it('with missing username/password should return an error', function (done) {
      identity.createIdentity({
        url: 'http://my.authendpoint.com'
      }, function (err) {
        should.exist(err);
        err.message.should.equal('Unable to authorize; missing required inputs');
        done();
      });
    });

    it('with missing password should return an error', function (done) {
      identity.createIdentity({
        url: 'http://my.authendpoint.com',
        username: 'MOCK-USERNAME'
      }, function (err) {
        should.exist(err);
        err.message.should.equal('Unable to authorize; missing required inputs');
        done();
      });
    });

    it('with missing username should return an error', function (done) {
      identity.createIdentity({
        url: 'http://my.authendpoint.com',
        password: 'MOCK-USERNAME'
      }, function (err) {
        should.exist(err);
        err.message.should.equal('Unable to authorize; missing required inputs');
        done();
      });
    });

    it('with valid inputs should return an identity', function(done) {

      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants')
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537041'
            }
          })
          .reply(200, helpers.getOpenstackAuthResponse());
      }

      identity.createIdentity({
        url: 'http://localhost:12346',
        username: 'MOCK-USERNAME',
        password: 'asdf1234',
        region: 'Calxeda-AUS1'
      }, function(err, id) {
        should.not.exist(err);
        should.exist(id);
        id.should.be.instanceOf(identity.Identity);

        server && server.done();
        done();
      });
    });

    it('with valid inputs but incorrect region should return an error', function (done) {

      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants')
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537041'
            }
          })
          .reply(200, helpers._getOpenstackStandardResponse('../fixtures/openstack/realToken-multiRegionVolume.json'));
      }

      identity.createIdentity({
        url: 'http://localhost:12346',
        username: 'MOCK-USERNAME',
        password: 'asdf1234',
        region: 'foo'
      }, function (err, id) {
        should.not.exist(id);
        should.exist(err);
        err.message.should.equal('Unable to identify target endpoint for Service: volume');

        server && server.done();
        done();
      });
    });

    it('with no region and regionless service catalog should return an identity', function (done) {

      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants')
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537041'
            }
          })
          .reply(200, helpers._getOpenstackStandardResponse('../fixtures/openstack/realToken-noRegion.json'));
      }

      identity.createIdentity({
        url: 'http://localhost:12346',
        username: 'MOCK-USERNAME',
        password: 'asdf1234'
      }, function (err, id) {
        should.not.exist(err);
        should.exist(id);
        id.should.be.instanceOf(identity.Identity);

        server && server.done();
        done();
      });
    });

    it('with no tenants listed from /v2.0/tenants should return an error', function (done) {

      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants')
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/no-tenants.json');
      }

      identity.createIdentity({
        url: 'http://localhost:12346',
        username: 'MOCK-USERNAME',
        password: 'asdf1234'
      }, function (err, id) {
        should.exist(err);
        should.not.exist(id);
        err.message.should.equal('Unable to find tenants');

        server && server.done();
        done();
      });
    });

    it('user token should validate with admin token', function(done) {
      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants', { 'X-Auth-Token': 'e93be67f91724754aeb9409c9c69d304' })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537041'
            }
          })
          .reply(200, helpers.getOpenstackAuthResponse())
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-ADMIN',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken-admin.json')
          .get('/v2.0/tenants', { 'X-Auth-Token': 'e93be67f91724754aeb9409c9c69d305' })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId-admin.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-ADMIN',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537123'
            }
          })
          .reply(200, helpers._getOpenstackStandardResponse('../fixtures/openstack/realToken-admin.json'));

        adminServer
          .get('/v2.0/tokens/4bc7c5dabf3e4a49918683437d386b8a?belongsTo=72e90ecb69c44d0296072ea39e537041')
          .reply(200);
      }

      var userId, adminId;

      async.parallel([
        function(next) {
          identity.createIdentity({
            url: 'http://localhost:12346',
            username: 'MOCK-USERNAME',
            password: 'asdf1234'
          }, function(err, id) {
            should.not.exist(err);
            userId = id;
            next();
          });
        },
        function(next) {
          identity.createIdentity({
            url: 'http://localhost:12346',
            username: 'MOCK-ADMIN',
            password: 'asdf1234'
          }, function (err, id) {
            should.not.exist(err);
            adminId = id;
            next();
          });
        }
      ], function(err) {
        should.not.exist(err);
        should.exist(adminId.token);
        adminId.validateToken(userId.token.id, userId.token.tenant.id, function(err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('get the tenant info with admin token', function(done) {
      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants', { 'X-Auth-Token': 'e93be67f91724754aeb9409c9c69d304' })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537041'
            }
          })
          .reply(200, helpers.getOpenstackAuthResponse())
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-ADMIN',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken-admin.json')
          .get('/v2.0/tenants', { 'X-Auth-Token': 'e93be67f91724754aeb9409c9c69d305' })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/tenantId-admin.json')
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-ADMIN',
                password: 'asdf1234'
              },
              tenantId: '72e90ecb69c44d0296072ea39e537123'
            }
          })
          .reply(200, helpers._getOpenstackStandardResponse('../fixtures/openstack/realToken-admin.json'));

        adminServer
          .get('/v2.0/tenants/72e90ecb69c44d0296072ea39e537041', { 'X-Auth-Token': '4bc7c5dabf3e4a49918683437d386b8b' })
          .reply(200)
          .get('/v2.0/tenants/72e90ecb69c44d0296072ea39e537123', { 'X-Auth-Token': '4bc7c5dabf3e4a49918683437d386b8a' })
          .reply(403);

      }

      var userId, adminId;

      async.parallel([
        function(next) {
          identity.createIdentity({
            url: 'http://localhost:12346',
            username: 'MOCK-USERNAME',
            password: 'asdf1234'
          }, function(err, id) {
            should.not.exist(err);
            userId = id;
            next();
          });
        },
        function(next) {
          identity.createIdentity({
            url: 'http://localhost:12346',
            username: 'MOCK-ADMIN',
            password: 'asdf1234'
          }, function (err, id) {
            should.not.exist(err);
            adminId = id;
            next();
          });
        }
      ], function(err) {
           should.not.exist(err);
           should.exist(adminId.token);
           async.series([
             function(next) {
               adminId.getTenantInfo(userId.token.tenant.id, function(err, success) {
                should.not.exist(err);
                next();
               });
              },
             function(next) {
               userId.getTenantInfo(adminId.token.tenant.id, function(err, success) {
               should.exist(err);
               next();
               });
             }
           ], function(err){
            should.not.exist(err);
           });
          done();
        });
      });

    it('with no active tenants listed from /v2.0/tenants should return an error', function (done) {

      if (mock) {
        server
          .post('/v2.0/tokens', {
            auth: {
              passwordCredentials: {
                username: 'MOCK-USERNAME',
                password: 'asdf1234'
              }
            }
          })
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/initialToken.json')
          .get('/v2.0/tenants')
          .replyWithFile(200, __dirname + '/../../fixtures/openstack/no-activeTenants.json');
      }

      identity.createIdentity({
        url: 'http://localhost:12346',
        username: 'MOCK-USERNAME',
        password: 'asdf1234'
      }, function (err, id) {
        should.exist(err);
        should.not.exist(id);
        err.message.should.equal('Unable to find an active tenant');

        server && server.done();
        done();
      });
    });
  });

  after(function (done) {
    if (!mock) {
      return done();
    }

    async.parallel([
      function(next) {
        server.close(next);
      }, function(next) {
        adminServer.close(next);
      }], done);
  });

});
