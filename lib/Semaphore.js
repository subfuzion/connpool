'use strict';

const _ = require('lodash');

/**
 * Error used when the caller is not willing to wait, but there are no
 * resources available, or the caller was willing to wait for a specified
 * amount of time (less than Infinity), but the wait timed out.
 */
class ResourceNotAvailableError extends Error {
  constructor(context) {
    super('resource not available');
    this._context = context;
  }

  get context() {
    return this._context;
  }
}

/**
 * Use a semaphore to restrict access to a resource.
 * This is a "fair" implementation that preserves caller request order.
 * Because this is a fair implementation, there is no way to guarantee
 * that just because available > 0 that an resource can be immediately
 * acquired during the same tick. All acquire requests are pushed onto
 * a queue in FIFO request order. The only way to ensure a resource is
 * acquired is when the requestor is called back asynchronously without
 * an error.
 */
class Semaphore {

  /**
   * Export ResourceNotAvailableError as a static property on Semaphore
   */
  static get ResourceNotAvailableError() {
    return ResourceNotAvailableError;
  }

  /**
   * Construct a new Semaphore instance with the specified total available.
   * @param total - maximum number of acquires without blocking. A value
   * of 1 behaves like a mutex.
   */
  constructor(total) {
    if (total < 1) throw new Error('Semaphore must be constructed with total > 0');
    this._total = total;
    this._acquired = 0;
    this._waitingList = [];
  }

  get total() {
    return this._total;
  }

  get acquired() {
    return this._acquired;
  }

  get available() {
    return this.total - this.acquired;
  }

  get waiting() {
    return this._waitingList.length;
  }

  /**
   * Attempt to acquire. Without a timeout value, will wait indefinitely.
   * @param [timeout] {number} optional value in milliseconds. 0 = no wait, Infinity = wait indefinitely.
   * @param [context] {object} optional object to passed back to caller in callback
   * @param callback
   */
  acquire(timeout, context, callback) {

    if (typeof timeout == 'function') {
      // only callback provided
      callback = timeout;
      context = undefined;
      timeout = Infinity;
    } else if (typeof context == 'function') {
      if (typeof timeout == 'object') {
        // only context and callback provided
        callback = context;
        context = timeout;
        timeout = Infinity;
      } else {
        // only timeout and callback provided
        callback = context;
        context = undefined;
      }
    }
    // if undefined or null, but not explicitly 0, then set to Infinity
    if (timeout == null) timeout = Infinity;

    // not available and caller not willing to wait
    if (!this.available && !timeout) {
      return callbackNextTick(callback, new ResourceNotAvailableError(context));
    }

    let caller = {
      callback: callback,
      context: context
    };

    // this is a "fair" implementation, so all requests are queued to ensure
    // callers acquire a resource in order
    this._waitingList.push(caller);

    // assume need to set a timer for caller if resource is not available
    let needsTimer = !this.available;

    if (this.available) {
      this._acquired++;
      // the following caller will only happen to be the current caller if there were no
      // other requests waiting in the queue; if it is not the current caller getting
      // pulled from the queue, then needsTimer is set to true
      let c = this._waitingList.shift();
      // if the caller pulled from the queue is this caller, then won't need a timer
      needsTimer = c != caller;
      if (c.timer) clearTimeout(c.timer);
      callbackNextTick(c.callback, null, c.context)
    }

    if (needsTimer && timeout != Infinity) {
      // if caller has a specific timeout, queue it up.
      // if subsequent release() calls do not result in this caller successfully acquiring
      // before timeout expiration, then callback with error
      //
      // also store reference to the timer interval object so it can be cleared if the
      // caller is able to successfully acquire before the timeout expires (if not cleared,
      // outstanding timeouts unnecessarily add to overhead and will delay process exit
      // until all expire)
      caller.timer = setTimeout(() => {
        let i = _.findIndex(this._waitingList, c => c === caller);
        if (i >= 0) {
          // remove from waiting (it has timed out) and callback with error
          let c = this._waitingList.splice(i, 1)[0];
          return callbackNextTick(c.callback, new ResourceNotAvailableError(c.context));
        }
      }, timeout);
    }
  }

  release() {
    this._acquired--;

    // after a release, process the waiting queue
    while (this.waiting && this.available) {
      // so nice to be single-threaded - can't be preempted in the middle of this
      this._acquired++;
      let requestor = this._waitingList.shift();

      // inform requestor on next tick
      callbackNextTick(requestor.callback, null, requestor.context);
    }
  }
}

/**
 * Ensure all callbacks happen in the next tick.
 * Aside from being the proper way to handle callbacks in Node, this
 * also ensures that all release and acquire operations are correctly serialized
 * (internally use setImmediate, not process.nextTick so don't starve waiting tasks)
 */
function callbackNextTick(callback, err, result) {
  setImmediate(() => {
    callback(err, result);
  });
}

module.exports = Semaphore;

