'use strict';

const Semaphore = require('../lib/Semaphore');
const assert = require('assert');
const format = require('util').format;
const _ = require('lodash');
const async = require('async');
const describe = require('mocha').describe;
const it = require('mocha').it;

describe('Semaphore tests', () => {

  describe ('mutex tests', () => {

    it('semaphore with available=1 should behave like a mutex (indefinite wait test)', done => {

      let mutex = new Semaphore(1);

      assert.equal(mutex.total, 1);
      assert.equal(mutex.available, 1);
      assert.equal(mutex.waiting, 0);

      mutex.acquire(err => {
        if (err) return done(err);

        assert.equal(mutex.total, 1);
        assert.equal(mutex.available, 0);
        assert.equal(mutex.waiting, 0);

        // attempt to acquire with indefinite wait
        mutex.acquire(err => {
          // total should never change
          assert.equal(mutex.total, 1);

          // since just acquired, should not be any available
          assert.equal(mutex.available, 0);

          // should be none waiting since just acquired
          assert.equal(mutex.waiting, 0);

          done();
        });

        // total should never change
        assert.equal(mutex.total, 1);

        // should still be none available since haven't released yet
        assert.equal(mutex.available, 0);

        // there is now one pending
        assert.equal(mutex.waiting, 1);

        // will allow the the pending request in previous
        // block of code to acquire and finish the test
        mutex.release();
      });
    });

    it('semaphore with available=1 should behave like a mutex (no wait test)', done => {

      let mutex = new Semaphore(1);

      mutex.acquire(err => {
        if (err) return done(err);

        // attempt to acquire, but don't wait
        mutex.acquire(0, err => {
          assert.equal(mutex.total, 1);
          assert.equal(mutex.available, 0);
          assert.equal(mutex.waiting, 0);

          assert(err && err instanceof Semaphore.ResourceNotAvailableError);
          done();
        });
      });
    });

    it('semaphore with available=1 should behave like a mutex (specified wait test)', done => {

      let mutex = new Semaphore(1);

      mutex.acquire(err => {
        if (err) return done(err);

        // attempt to acquire, but wait max of 1 second
        mutex.acquire(1000, err => {
          assert.equal(mutex.total, 1);
          assert.equal(mutex.available, 0);
          assert.equal(mutex.waiting, 0);

          done();
        });

        // wait 0.5 second before releasing
        setTimeout(() => {
          mutex.release();
        }, 500);
      });
    });

    it('semaphore with available=1 should behave like a mutex (specified wait - timeout test)', done => {

      let mutex = new Semaphore(1);

      mutex.acquire(err => {
        if (err) return done(err);

        // attempt to acquire, but wait max of 0.5 second
        mutex.acquire(500, err => {
          assert.equal(mutex.total, 1);
          assert.equal(mutex.available, 0);

          // 0 because timeout error, so no longer waiting
          assert.equal(mutex.waiting, 0);

          assert(err && err instanceof Semaphore.ResourceNotAvailableError);
          done();
        });

        // wait 1 second before releasing
        setTimeout(() => {
          mutex.release();
        }, 1000);
      });
    });

  }); // mutex tests

  describe('context tests', () => {

    it('should callback with supplied context', done => {

      let mutex = new Semaphore(1);

      mutex.acquire(err => {
        if (err) return done(err);

        let context = { id: 2 };
        mutex.acquire(context, (err, ctx) => {
          assert(_.eq(ctx, context), format('actual: %j, expected: %j', ctx, context));
          done();
        });

        mutex.release();
      });
    });

  }); // context tests

  describe ('semaphores with total > 1', () => {

    // note that can't use fat arrow syntax for lambda in the following tests.
    // need to preserve the 'this' context supplied by mocha, not 'this'
    // from the outer scope in order to increase default test timeout of 2 seconds

    it ('should allow 3 acquires, wait for 4th', function(done) {
      this.timeout(5 * 1000);

      let sem = new Semaphore(3);

      // acquire 3
      async.parallel([
        callback => { sem.acquire(callback) },
        callback => { sem.acquire(callback) },
        callback => { sem.acquire(callback) }
      ], err => {
        if (err) return done(err);

        // will need to wait for 4th
        sem.acquire({id:4}, (err, ctx) => {
          assert.equal(sem.waiting, 0);
          assert.equal(sem.available, 0);
          assert(_.eq(ctx, {id:4}), format('actual: %j, expected: %j', ctx, context));

          // release and can acquire another again
          sem.release();
          assert.equal(sem.available, 1);
          sem.acquire(err => {
            done(err);
          });
        });

        assert.equal(sem.waiting, 1);
        sem.release();
      });

    });

    // note that can't use fat arrow syntax for lambda here
    // need to preserve the 'this' context supplied by mocha, not 'this'
    // from the outer scope
    it ('should allow 3 acquires, wait for 4th & 5th', function(done) {
      // mocha default is 2 seconds
      this.timeout(10 * 5);

      let acquired = _.after(2, () => {
        done();
      });

      let sem = new Semaphore(3);

      // acquire 3
      async.parallel([
        callback => { sem.acquire({id:1}, (err, ctx) => {
          if (err) return callback(err);
          assert(_.eq(ctx, {id:1}));
          setTimeout(() => {
            sem.release();
          }, 1);
          callback();
        })},

        callback => { sem.acquire({id:2}, (err, ctx) => {
          if (err) return callback(err);
          assert(_.eq(ctx, {id:2}));
          setTimeout(() => {
            sem.release();
          }, 2);
          callback();
        })},

        callback => { sem.acquire({id:3}, (err, ctx) => {
          if (err) return callback(err);
          assert(_.eq(ctx, {id:3}));
          setTimeout(() => {
            sem.release();
          }, 3);
          callback();
        })}

      ], err => {
        if (err) return done(err);

        // will need to wait for 4th
        sem.acquire({id:4}, (err, ctx) => {
          if (err) return done(err);
          assert(_.eq(ctx, {id:4}), format('actual: %j, expected: %j', ctx, context));
          acquired();
        });

        // will need to wait for 5th
        sem.acquire({id:5}, (err, ctx) => {
          if (err) return done(err);
          assert(_.eq(ctx, {id:5}), format('actual: %j, expected: %j', ctx, context));
          acquired();
        });
      });

    });
  }); // total resources > 1

}); // semaphore tests

