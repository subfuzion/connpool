connpool
========

This repo contains a test client that uses a connection pool to post requests to a test server.

The `Pool`, `RingBuffer`, and `Sempaphore` modules are reusable. The Pool class leverages both
RingBuffer (a circular queue) and Semaphore.

The RingBuffer is a simple data structure that stores resources up to a specified total capacity.
A resource is acquired via a `read` operation and subsequently released via a `write` operation.

A semaphore manages access to a resource by maintaining a count of the current resource usages.
To use a resource, a request is made to the semaphore to acquire it, and when finished, the
sempahore is notified to release it. If the maximum count has been exceeded, requestors will be
queued. The semaphore will signal (callback) requestors as the resource becomes available. If
the requestor specifies a maximum timeout for waiting and the resource does not become available
within that interval, the semaphore will signal (callback) the requestor with a timeout error.

Rather than complicate the RingBuffer class with support for waiting, the Pool class leverages
the Sempaphore class for this. When the Pool gets a request for a resource, it performs an
asynchronous acquire on a semaphore. Once the acquire request is satisfied, it performs a read
on the ring buffer to get the next available resource.

This implementation of pool lazily populates the ring buffer with resources until it is filled
to capacity. The pool is created with a resource provider object. A resource provider has an
asynchronous getResource method that takes an options object and callback function, provisions
a resource and then calls the callback function with either an error or the resource.

To set up for testing:

```
npm install
npm ln
```

The `npm ln` command creates symlinks for `server` to `bin/server` and `client` to `bin/client`.

In one terminal, start the server.

```
server
```

In another terminal, start the client. You can get help with the `--help` option.

```
 $ client --help

  Usage: client [options] <number-of-workers>

  Options:

    -h, --help         output usage information
    -V, --version      output the version number
    -p, --pool <size>  Set connection pool size
```

For example, to start 10 workers with a connection pool capacity of 5:

```
client -p 5 10
```

Tests
-----

There are 3 tests under `test` that test the pool and the modules it uses.

```
npm test
```

