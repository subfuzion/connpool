'use strict';

const http = require('http');
const async = require('async');
const path = require('path');
const ConnectionProvider = require('./ConnectionProvider');
const Pool = require('./Pool');

class Client {

  constructor(port, poolCapacity) {
    this._port = port;
    this._poolCapacity = poolCapacity || Infinity;
    this._pool = new Pool({
      capacity: this.poolCapacity,
      lazy: true,
      resourceProvider: new ConnectionProvider()
    });
  }

  get port() {
    return this._port;
  }

  get poolCapacity() {
    return this._poolCapacity;
  }

  get pool() {
    return this._pool;
  }

  /**
   * POST work parameter to server.
   * @param work {number} - a value (in seconds) to simulate work to be done
   * on the server. The server will return a JSON message.
   * @param callback {function} - function that takes two arguments (err, result)
   */
  post(id, work, callback) {
    if (!this.port) return callback(new Error('connection port not set'));

    let clientConnection = cb => {
      //return cb(null, http.request);
      this.pool.getResource(cb);
    }

    clientConnection.NAME = 'clientConnection(cb)'

    let release = clientConnection => {
      this.pool.releaseResource(clientConnection);
    }

    clientConnection((err, connection) => {
      if (err) return callback(err);

      let data = JSON.stringify({
        id: id,
        work: work
      });

      let options = {
        hostname: 'localhost',
        port: this.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      let req = connection(options, (res)=> {
        let buf = '';
        res
          .setEncoding('utf8')
          .on('data', chunk => {
            buf += chunk;
          })
          .on('end', () => {
            // return connection to the pool
            release(connection);
            return callback(null, JSON.parse(buf));
          })
      });

      req.on('error', (err) => {
        // return connection to the pool
        release(connection);
        return callback(err);
      });

      req.write(data);
      req.end();
    });
  }
}

module.exports = Client;

