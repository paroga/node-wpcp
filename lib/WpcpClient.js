const EventEmitter = require('events').EventEmitter;
const SequenceNumberManager = require('./SequenceNumberManager');
const WebSocketClient = require('websocket').client;
const WpcpConnection = require('./WpcpConnection');
const util = require('util');

function WpcpClient() {
  this.methodInfo = {};
  this.messageHandler = {};
  this.pendingRequests = new SequenceNumberManager();
  this.subscriptions = new Map();
  this.webSocketClient = new WebSocketClient();

  this.webSocketClient.on('connectFailed', err => {
    this.emit('connectFailed', err);
  });

  this.webSocketClient.on('connect', connection => {
    this.connection = new WpcpConnection(connection);
    this.emit('connect', this.connection);

    this.connection.on('hello', () => {
      let methods = this.connection.helloPayload[0].methods;
      let processedMessageId;
      let generalHandlers = {
        'publish': function(requestId, payload) {
          let publishMap = new Map();

          for (let i = 0; i < payload.length; i += 2) {
            let subscriptionId = payload[i];
            let data = payload[i + 1];
            let info = this.subscriptions.get(subscriptionId);

            let arr = publishMap.get(info.publish);
            if (!arr) {
              arr = [];
              publishMap.set(info.publish, arr);
            }

            arr.push(info.id);
            arr.push(data);
          }

          let promises = [];
          publishMap.forEach((value, publish) => {
            promises.push(publish(value));
          });

          Promise.all(promises).then(() => {
            this.send(processedMessageId, requestId);
          });
        },
        'result': function(requestId, payload) {
          this.pendingRequests.delete(requestId).result(payload);
        }
      };

      for (let i = 0; i < methods.length; i += 2) {
        let messageName = methods[i + 0];
        let messageType = methods[i + 1];
        let messageId = i / 2;

        if (generalHandlers.hasOwnProperty(messageName)) {
          this.messageHandler[messageId] = generalHandlers[messageName];
          continue;
        }

        if (!messageType) {
          if (messageName === 'processed') {
            processedMessageId = messageId;
          }
          continue;
        }

        this.methodInfo[messageName] = {
          messageId: messageId,
          messageType: messageType
        };
      }

      this.emit('ready');
    });

    this.connection.on('message', (messageId, requestId, payload) => {
      let messageHandler = this.messageHandler[messageId];
      if (!messageHandler)
        return this.emit('error', new Error('Invalid messageId'));
      messageHandler.call(this, requestId, payload);
    });

    this.connection.send(0, 0, [{}]);
  });
}

util.inherits(WpcpClient, EventEmitter);

WpcpClient.prototype.ready = function(callback) {
  if (this.connection && this.connection.helloMessage)
    return callback();
  this.once('ready', callback);
};

WpcpClient.prototype.connect = function(url) {
  this.webSocketClient.connect(url, 'wpcp');
};

WpcpClient.prototype.callMethod = function(method, payload, resultCallback, progressCallback) {
  this.ready(() => {
    let methodInfo = this.methodInfo[method];
    if (!methodInfo)
      return this.emit('error', new Error('Invalid method'));

    let requestId = this.pendingRequests.insert({
      progress: progressCallback,
      result: resultCallback
    });
    this.connection.send(methodInfo.messageId, requestId, payload);
  });
};

WpcpClient.prototype.subscribe = function(method, payload, resultCallback, publishCallback) {
  this.callMethod(method, payload, result => {
    for (let i = 0; i < result.length; i += 2) {
      let subscriptionId = result[i + 1];
      if (!subscriptionId)
        continue;
      this.subscriptions.set(subscriptionId, {
        id: i / 2,
        publish: publishCallback
      });
    }
    resultCallback(result);
  });
};

module.exports = WpcpClient;
