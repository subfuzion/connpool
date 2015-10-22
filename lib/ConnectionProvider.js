'use strict';

const ClientRequest = require('http').ClientRequest;

/**
 * ConnectionProvider is a resource provider used by Pool when it needs
 * to add an item to the pool (either during initial population or lazily).
 * It implements getResource()
 */
class ConnectionProvider {
  getResource(options, callback) {
    // This is just an example to demonstrate a provider that builds a connection.
    // In this example, we just provide a trivial wrapper to build a new ClientRequest object.

    // trivial wrapper to build a new ClientRequest object. This is effectively the
    // same thing that http.request does
    let request = function(options, cb) {
      return new ClientRequest(options, cb);
    };

    // the resource provider getResource interface is asynchronous, so we
    // callback with a result in the next tick
    setImmediate(() => {
      console.log('ConnectionProvider: creating new connection');
      callback(null, request);
    });
  }
}

module.exports = ConnectionProvider;

