'use strict';

class RingBufferError extends Error {
  constructor(message) {
    super(message);
  }
}

class BufferIsFullError extends RingBufferError {
  constructor() {
    super('buffer is full');
  }
}

class BufferIsEmptyError extends RingBufferError {
  constructor() {
    super('buffer is empty');
  }
}

/**
 * Simple ring buffer implementation that uses a count to determine when the
 * buffer has been drained. It writes to the tail, reads from the head.
 * Each read and write operation advances the head and tail pointers, respectively.
 * The count variable is incremented with each write, and decremented with
 * each read.
 *
 * For a more sophisticated, feature-rich ring buffer;
 * @see https://github.com/trevnorris/cbuffer/blob/master/cbuffer.js
 */
class RingBuffer {

  /**
   * Export RingBuffer.BufferIsFullError
   */
  static get BufferIsFullError() {
    return BufferIsFullError;
  }

  /**
   * Export RingBuffer.BufferIsEmptyError
   */
  static get BufferIsEmptyError() {
    return BufferIsEmptyError;
  }

  /**
   * Constructs a new ring buffer with the given total capacity.
   * @param {number} capacity
   * @throw {Error} if capacity is not > 0 and < Infinity
   */
  constructor(capacity) {
    if (capacity < 1 || capacity == Infinity) {
      throw new Error('capacity must be > 0 and < Infinity');
    }

    this._capacity = capacity;
    this._buffer = new Array(this.capacity);
    this._head = 0;
    this._tail = 0;
    // keeping count is a simple way to eliminate modulo operations
    this._count = 0;

    this._increment = (index) => {
      return increment(index, this._buffer.length);
    }
  }

  /**
   * The total available capacity of the ring buffer to store items.
   * @returns {number}
   */
  get capacity() {
    return this._capacity;
  }

  /**
   * Represents the number of reads to drain the buffer.
   * @returns {number}
   */
  get count() {
    return this._count;
  }

  /**
   * The amount of writes available until the ring buffer is full (at capacity).
   * @returns {number}
   */
  get available() {
    return this.capacity - this.count;
  }

  /**
   * True when the ring buffer is full (count is less than capacity).
   * @returns {boolean}
   */
  get isFull() {
    return !this.canWrite;
  }

  /**
   * True when the ring buffer is not full (count is less than capacity).
   * @returns {boolean}
   */
  get canWrite() {
    return this.count < this.capacity;
  }

  /**
   * True when the ring buffer is full (count is equal to capacity).
   * @returns {boolean}
   */
  get isFull() {
    return !this.canWrite;
  }

  /**
   * True when the ring buffer is not empty (count is greater than 0).
   * @returns {boolean}
   */
  get canRead() {
    return this.count > 0;
  }

  /**
   * True when the ring buffer is empty (count is 0).
   * @returns {boolean}
   */
  get isEmpty() {
    return !this.canRead;
  }

  /**
   * Write data to tail of ring buffer.
   * @param data
   * @throw {BufferIsFullError} if ring buffer is full
   */
  write(data) {
    if (this.isFull) {
      throw new BufferIsFullError();
    }

    // write to tail, then advance tail pointer and increment count
    this._buffer[this._tail] = data;
    this._tail = this._increment(this._tail);
    this._count++;
  }

  /**
   * Read data from head of ring buffer.
   * @return data
   * @throw {BufferIsEmptyError} if ring buffer is empty
   */
  read() {
    if (this.isEmpty) {
      throw new BufferIsEmptyError();
    }

    // read from head, then advance head pointer and decrement count
    let data = this._buffer[this._head];
    this._head = this._increment(this._head);
    this._count--;

    return data;
  }
}

/**
 * Given an index and an array length, return incremented value with wrap around.
 * @param value
 * @param length
 */
function increment(index, length) {
  return index + 1 == length ? 0 : index + 1;
}

module.exports = RingBuffer;

