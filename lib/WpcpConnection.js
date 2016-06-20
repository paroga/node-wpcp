const EventEmitter = require('events').EventEmitter;
const cbor = require('cbor');
const util = require('util');

function WpcpConnection(connection) {
  var self = this;
  this.connection = connection;
  this.helloMessage = null;
  this.helloPayload = null;

  connection.on('close', function onClose(closeReasonCode, closeDescription) {
    self.emit('close', closeReasonCode, closeDescription);
  });

  connection.on('message', function onMessage(message) {
    function handleError(err) {
      self.emit('error', err);
      self.close(4444, 'Protocol error');
    }

    if (message.type !== 'binary')
      return handleError(new Error('Received invalid message type: ' + message.type));

    cbor.decodeAll(message.binaryData, function decoded(err, decodedMessages) {
      if (err)
        return handleError(err);
      if (decodedMessages.length !== 1)
        return handleError(new Error('Invalid CBOR message'));

      var emitEvent = 'message';
      var decodedMessage = decodedMessages[0];
      var messageId = decodedMessage[0];
      var requestId = decodedMessage[1];
      var payload = decodedMessage.slice(2);

      if (!self.helloMessage) {
        self.helloMessage = decodedMessage;
        self.helloPayload = payload;
        emitEvent = 'hello';
      }

      return self.emit(emitEvent, messageId, requestId, payload);
    });
  });
}

util.inherits(WpcpConnection, EventEmitter);

WpcpConnection.prototype.send = function send(messageId, requestId, payload) {
  return this.connection.sendBytes(cbor.encode([messageId, requestId].concat(payload)));
};

WpcpConnection.prototype.close = function close(reasonCode, description) {
  return this.connection.close(reasonCode, description);
};

module.exports = WpcpConnection;
