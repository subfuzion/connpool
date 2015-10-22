'use strict';

const RingBuffer = require('../lib/RingBuffer');
const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;

describe('ring buffer tests', () => {

  // useless ring buffer, but useful test to verify limits
  it ('should create a ring buffer with a capacity of 1', () => {

    let buf = new RingBuffer(1);

    assert.equal(buf.capacity, 1);
    assert.equal(buf.count, 0);
    assert.equal(buf.available, 1);
    assert(buf.isEmpty, 'buffer should be empty');
    assert(buf.canWrite, 'buffer is empty, so should be writeable');
    assert(!buf.isFull, 'buffer is empty, so should not be full');
    assert(!buf.canRead, 'buffer is empty, so should not be readable');

    buf.write('data');
    assert.equal(buf.count, 1);
    assert.equal(buf.available, 0);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(!buf.canWrite, 'buffer should be full, so should not be writeable');
    assert(buf.isFull, 'buffer should be full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    let data = buf.read();
    assert.equal(data, 'data');
    assert.equal(buf.count, 0);
    assert.equal(buf.available, 1);
    assert(buf.isEmpty, 'buffer should be empty');
    assert(buf.canWrite, 'buffer is empty, so should be writeable');
    assert(!buf.isFull, 'buffer is empty, so should not be full');
    assert(!buf.canRead, 'buffer is empty, so should not be readable');
  });

  it ('should throw an error when writing to full buffer', () => {
    let buf = new RingBuffer(1);
    buf.write('data');

    assert.throws(() => {
      buf.write('data2');
    }, err => {
      return err instanceof RingBuffer.BufferIsFullError;
    });
  });

  it ('should throw an error when reading from empty buffer', () => {
    let buf = new RingBuffer(1);
    assert.throws(() => {
      buf.read();
    }, err => {
      return err instanceof RingBuffer.BufferIsEmptyError;
    });
  });

  it ('should work with capacity > 1', () => {
    let buf = new RingBuffer(3);

    assert.equal(buf.capacity, 3);
    assert.equal(buf.count, 0);
    assert.equal(buf.available, 3);
    assert(buf.isEmpty, 'buffer should be empty');
    assert(buf.canWrite, 'buffer is empty, so should be writeable');
    assert(!buf.isFull, 'buffer is empty, so should not be full');
    assert(!buf.canRead, 'buffer is empty, so should not be readable');

    buf.write('data1');
    assert.equal(buf.count, 1);
    assert.equal(buf.available, 2);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(buf.canWrite, 'buffer should not be full, so should be writeable');
    assert(!buf.isFull, 'buffer should not be full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    buf.write('data2');
    assert.equal(buf.count, 2);
    assert.equal(buf.available, 1);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(buf.canWrite, 'buffer should not be full, so should be writeable');
    assert(!buf.isFull, 'buffer should not be full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    buf.write('data3');
    assert.equal(buf.count, 3);
    assert.equal(buf.available, 0);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(!buf.canWrite, 'buffer should be full, so should not be writeable');
    assert(buf.isFull, 'buffer should be full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    // buffer is full
    assert.throws(() => {
      buf.write('data4');
    }, err => {
      return err instanceof RingBuffer.BufferIsFullError;
    });

    let data = buf.read();
    assert.equal(data, 'data1');
    assert.equal(buf.count, 2);
    assert.equal(buf.available, 1);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(buf.canWrite, 'buffer is not full, so should be writeable');
    assert(!buf.isFull, 'buffer is not full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    data = buf.read();
    assert.equal(data, 'data2');
    assert.equal(buf.count, 1);
    assert.equal(buf.available, 2);
    assert(!buf.isEmpty, 'buffer should not be empty');
    assert(buf.canWrite, 'buffer is not full, so should be writeable');
    assert(!buf.isFull, 'buffer is not full');
    assert(buf.canRead, 'buffer is not empty, so should be readable');

    data = buf.read();
    assert.equal(data, 'data3');
    assert.equal(buf.count, 0);
    assert.equal(buf.available, 3);
    assert(buf.isEmpty, 'buffer should be empty');
    assert(buf.canWrite, 'buffer is not full, so should be writeable');
    assert(!buf.isFull, 'buffer is empty, so should not be full');
    assert(!buf.canRead, 'buffer is empty, so should not be readable');

    // buffer is empty
    assert.throws(() => {
      buf.read();
    }, err => {
      return err instanceof RingBuffer.BufferIsEmptyError;
    });
  });

  it ('should throw if created with a capacity < 1', () => {
    assert.throws(() => {
      new RingBuffer(0);
    });
  });

  it ('should throw if created with a capacity == Infinity', () => {
    assert.throws(() => {
      new RingBuffer(Infinity);
    });
  });

});

