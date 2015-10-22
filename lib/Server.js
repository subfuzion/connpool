'use strict';

const http = require('http');
const EventEmitter = require('events').EventEmitter;
const format = require('util').format;
const _ = require('lodash');

class Server extends EventEmitter {

  /**
   * Create a new Server instance.
   * @param [port] {string|number} - optional port to listen on, defaults to 9000
   */
  constructor(port, maxConnections) {
    super();
    this._port = port;
    this._server = null;
    this._connectionCount = 0;
    this.maxConnections = maxConnections;
  }

  get port() {
    return this._port;
  }

  get connectionCount() {
    return this._connectionCount;
  }

  get maxConnections() {
    return this._server ? this._server.maxConnections : this._maxConnections;
  }

  set maxConnections(value) {
    this._maxConnections = value;
    if (this._server) this._server.maxConnections = value;
  }

  /**
   * Start listening on this server's assigned port.
   * Test server that waits 1-3 seconds before responding with a JSON message
   * Triggers the 'listening' event; when receiving requests, also triggers the
   * 'connection' event
   * @param [callback] {function} - optional listener for the 'listening' event
   * @returns {Server}
   */
  listen(callback) {
    if (!this.port) return callback(new Error('server port not set'));

    // private helper functions (don't need to pollute class or global space)
    let formatTime = date => {
      return format('%s:%s', _.padLeft(date.getMinutes(), 2, '0'), _.padLeft(date.getSeconds(), 2, '0'));
    }

    let currentTime = () => {
      return formatTime(new Date());
    }

    let maxConnections = this.maxConnections;

    this._server = http.createServer((req, res) => {
      let timeReceived = currentTime();
      let buffer = '';

      req
        .on('data', chunk => {
          buffer += chunk;
        })
        .on ('end', () => {
          let requestMessage;

          try {
            requestMessage = JSON.parse(buffer);
          } catch (err) {
            console.error(err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              status: 'error',
              reason: err.message
            }));
          }

          requestMessage.timeReceived = timeReceived;

          // use the units of 'work' specified in the request else use random timeout
          let timeout;
          if (requestMessage.work) {
            // units of 'work' are the timeout in seconds
            timeout = requestMessage.work * 1000;
          } else {
            // simulate latency with random response times in seconds from min to max, inclusive
            let min = 3;
            let max = 10;
            timeout = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
          }

          // delay sending response corresponding to amount of 'work' represented by timeout
          setTimeout(() => {
            requestMessage.timeCompleted = currentTime();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(requestMessage));

          }, timeout);
        });

    });

    // resurface events from internal server
    this._server
      .on('error', (err) => { this.emit('error', this, err) })
      .on('listening', () => { this.emit('listening', this) })
      .on('connection', (socket) => {
        // keep track of total number of connections
        ++this._connectionCount;

        // close over current connection account and use the value as an ID
        // to correlate this socket to the socket close event
        let socketID = this.connectionCount;

        socket.on('close', () => {
          console.log('server connection close: %d', socketID);
        });

        this.emit('connection', this, socket, this.connectionCount)
      })
      .on('close', () => {
        this._server = null;
        this.emit('close', this)
      });

    this._server.maxConnections = maxConnections;
    this._server.listen(this.port, callback);
    return this;
  }

  /**
   * Stop accepting connections.
   * Triggers the 'close' event when last connection is closed.
   * @param [callback] {function} - optional listener for the 'close' event; unlike
   * the close event, however, will callback with an Error if the server was not
   * opened when closed.
   */
  close(callback) {
    this._server && this._server.close(callback);
  }
}

module.exports = Server;

