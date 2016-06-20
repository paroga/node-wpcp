const EventEmitter = require('events').EventEmitter;
const WebSocketServer = require('websocket').server;
const util = require('util');

function WpcpServer(options) {
  var self = this;

  var webSocketServer = new WebSocketServer({
    httpServer: options.httpServer,
    autoAcceptConnections: false
  });

  webSocketServer.on('request', function(request) {
    self.emit('request', request);
  });
}

util.inherits(WpcpServer, EventEmitter);

exports.server = WpcpServer;
