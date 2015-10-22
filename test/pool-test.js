'use strict';

const assert = require('assert');
const _ = require('lodash');
const async = require('async');
const describe = require('mocha').describe;
const it = require('mocha').it;
const Pool = require('../lib/Pool');
const Semaphore = require('../lib/Semaphore');

/**
 * The pool expects a resource provider to have a getResource method
 * that takes an options object and callsback asynchronously with
 * either an error or a resource object.
 */
class TestConnectionProvider {
  getResource(options, callback) {
    // nothing fancy -- resource is just the supplied options object
    // to make testing easy
    let resource = options;

    // resource provider getResource is expected to be async
    setImmediate(() => {
      callback(null, resource);
    });
  }
}

describe('connection pool tests', () => {

  it ('should create a connection pool with a resource provider and resource creation options', done => {

    let pool = new Pool({
      resourceProvider: new TestConnectionProvider(),
      resourceOptions: 'foo'
    });

    assert.equal(pool.capacity, Pool.defaultCapacity);
    assert.equal(pool.size, 0);

    // Pool.defaultCapacity = 5, so there should be no wait for a resourcew
    pool.getResource((err, conn) => {
      if (err) return done(err);
      assert.equal(conn, 'foo');
      done();
    });
  });

  // Can't use fat arrow syntax because need the 'this' context to be the one provided by mocha
  // (so we can increase the timeout for the test), and arrow syntax preserves this from the outer scope
  it ('should create a connection pool with a capacity of 2: 3rd request should have to wait', function(done) {
    this.timeout(15 * 1000);

    let pool = new Pool({
      capacity: 2,
      timeout: 15 * 1000,
      resourceProvider: new TestConnectionProvider(),
      resourceOptions: { foo: 'bar' }
    });

    assert.equal(pool.capacity, 2);
    assert.equal(pool.size, 0);

    // Acquire 2 connections. Since the pool capacity = 2, the acquires should be immediate.
    async.parallel([
      callback => {
        pool.getResource((err, conn) => {
          if (err) return callback(err);

          // release the resource in 5 seconds
          setTimeout(() => {
            pool.releaseResource(conn);
            callback();
          }, 5 * 1000);
        });
      },

      callback => {
        pool.getResource((err, conn) => {
          if (err) return callback(err);

          // don't bother releasing this connection
          callback();
        });
      },

      callback => {
        // Attempt to acquire a 3rd connection. It will not acquire until one of the other connections
        // is released
        let start = process.hrtime();

        pool.getResource((err, conn) => {
          if (err) return callback(err);

          let end = process.hrtime(start);
          assert(end[0] >= 4);
          done();
        });
      },

    ], err => {
      done(err);
    });

  });

  it ('2nd request should timeout', function(done) {
    this.timeout(5 * 1000);

    // pool timeout will be 1 sec
    let pool = new Pool({
      capacity: 1,
      timeout: 1000,
      resourceProvider: new TestConnectionProvider(),
      resourceOptions: { foo: 'bar' }
    });

    assert.equal(pool.capacity, 1);

    async.parallel([
      callback => {
        pool.getResource((err, conn) => {
          if (err) return callback(err);

          // release the resource in 3 seconds - should be too late for the other request
          setTimeout(() => {
            pool.releaseResource(conn);
            callback();
          }, 3 * 1000);
        });
      },

      callback => {
        // Attempt to acquire a 2nd connection. It should timeout.

        pool.getResource((err, conn) => {
          assert(err instanceof Semaphore.ResourceNotAvailableError);
          callback();
        });
      },

    ], err => {
      done(err);
    });

  });
});


