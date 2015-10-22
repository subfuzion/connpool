'use strict';

const RingBuffer = require('./RingBuffer');
const Semaphore = require('./Semaphore');

class Pool {

  /**
   * The default capacity of a Pool instance.
   * @returns {number}
   */
  static get defaultCapacity() {
    return 5;
  }

  /**
   * The default timeout for waiting to acquire a resource from the pool.
   * @returns {number}
   */
  static get defaultTimeout() {
    return 30 * 1000;
  }

  /**
   * Creates a new pool with the specified maximum capacity.
   * Resources are lazily created by the supplied resource provider object with
   * a getResource method that takes a context object as its sole argument and
   * returns a resource object.
   *
   *
   * Implementation details:
   * =======================
   * You can think of this class as an async wrapper over a ring buffer that lazily
   * fetches resources until the buffer is fully populated.
   *
   * Internally this class uses both a ring buffer and a semaphore.
   *
   * The ring buffer allows the pool acquire resources by read calls until the buffer is
   * drained, and release resources by write calls until the buffer reaches  max capacity.
   *
   * To support waiting for a resource when one is not immediately available, and to also
   * support timeouts if a certain specified amount of time elapses while waiting, this
   * class also uses a semaphore. A semaphore is a means of restricting access to a resource
   * (in this case, the ring buffer) by maintaining a count and "signaling" (via a callback)
   * when the resource is available. The semaphore implementation used by this class also
   * "signals" (via a callback) when a resource is not available within the designated
   * timeout period.
   *
   * The use of ring buffer and semaphore together allows us to keep concerns (and tests)
   * separate without overcomplicating this class or the ring buffer implementation.
   *
   *
   * @param [options] {object} - an object with the following properties
   *   - capacity {number} - the max capacity of the pool (default = 5); if capacity
   *     is equal to 0 or Infinity, no internal buffer will be created and the resource
   *     provider will be invoked for every getResource call
   *   - resourceProvider {object}: an object with a getResource method that
   *     takes a context object and returns a resource object
   *   - resourceOptions {object}: an optional object to supply as an argument to the
   *     resourceProvider getResource method
   *   - timeout {number} override default timeout of 30 seconds. 0 = no wait, Infinity =
   *     wait indefinitely
   *
   * @throws {Error} if options don't include resourceProvider
   */
  constructor(options) {
    options = options || {};

    if (!options.resourceProvider) {
      throw new Error('missing resourceProvider');
    }

    this._capacity = options.capacity || Pool.defaultCapacity;
    this._resourceProvider = options.resourceProvider;
    this._resourceOptions = options.resourceOptions;
    this._timeout = options.timeout || Pool.defaultTimeout;

    this._initBuffer(this.capacity);
  }

  /**
   * Get this pool's maximum capacity
   * @returns {number} the pool's maximum capacity
   */
  get capacity() {
    return this._capacity;
  }

  /**
   * Get this pool's current size (0..capacity)
   * Resources are lazily created by this pool's provider, so size
   * may be less than the capacity
   * @returns {number} the pool's current size
   */
  get size() {
    return this._buffer.count;
  }

  /**
   * Get timeout for acquiring a resource from the pool.
   * @returns {number} milliseconds
   */
  get timeout() {
    return this._timeout;
  }

  /**
   * This pool's resource provider is an object with a getResource method
   * that takes a context object as its sole argument and returns a resource.
   * @returns {object} the resource provider
   */
  get resourceProvider() {
    return this._resourceProvider;
  }

  /**
   * The options for creating new resources with this pool's resource provider
   * @returns {Object} the provider options object supplied as an argument to this
   * pool's resource provider getResource method for obtain resources to add to the pool
   */
  get resourceOptions() {
    return this._resourceOptions;
  }

  /**
   * Request a resource from the pool.
   * Will callback with an error if an optional timeout is specified.
   * @param {function } [callback] that takes two arguments (error, resource)
   */
  getResource(callback) {
    let timeout = this.timeout;

    if (this.capacity > 0 && this.capacity < Infinity) {
      this._acquire(timeout, callback);
    } else {
      // call resource provider directly
      setImmediate(() => {
        this.resourceProvider.getResource(this.resourceOptions, callback);
      });
    }
  }

  releaseResource(resource) {
    if (this.capacity > 0 && this.capacity < Infinity) {
      this._release(resource);
    }
  }

  _initBuffer(capacity) {
    // if pool size is 0 or Infinity, either way just call the resource provider
    // to return resources; otherwise, obtain if from the ring buffer.
    // initialize the semaphore with the same total as the capacity.
    if (capacity > 0 && capacity < Infinity) {
      this._buffer = new RingBuffer(capacity);
      this._semaphore = new Semaphore(capacity);
    }
  }

  /**
   * Private method meant to be called by wrapper function that has already
   * validated this call.
   * @private
   */
  _acquire(timeout, callback) {
    console.log('pool: attempting to acquire resource from the pool');
    this._semaphore.acquire(timeout, err => {
      if (err) return callback(err);

      // if we've gotten here, we're guaranteed that we haven't exceeded
      // resource allocation; however, because we're lazily creating resources,
      // it's possible that the buffer might not have a resource even though it's
      // not at max capacity. In that case, get the resource from the resource
      // provider -- it will be added to the buffer automatically when the
      // resource is released sometime in the future.

      if (this._buffer.canRead) {
        console.log('pool: acquired resource from the pool')
        callback(null, this._buffer.read());
      } else {
        console.log('pool: lazily creating resource')
        this.resourceProvider.getResource(this.resourceOptions, callback);
      }
    });
  }

  /**
   * Private method meant to be called by wrapper function that has already
   * validated this call.
   * @private
   */
  _release(resource) {
    // return resource to buffer BEFORE releasing semaphore (because semaphore
    // will signal waiting callbacks)
    console.log('pool: returning resource to the pool')
    this._buffer.write(resource);
    this._semaphore.release();
  }

}

module.exports = Pool;

