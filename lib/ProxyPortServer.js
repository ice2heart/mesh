
const Common = require('./Common');
const net = require('net');
const debug = require('debug')('proxy');

const EventEmitter = require('events').EventEmitter;
const util = require('util');

const getRand = Common.getRand;

const ProxyServer = function (port) {
  const self = this;
  this.clients = {};
  this.exposeServer = net.createServer((c) => {
    var id = getRand();
    var idMessage = new Buffer(2);
    idMessage[0] = 0x12; // id
    idMessage[1] = id;
    this.emit('data', idMessage);
    self.clients[id] = c;
    debug('client connected');
    c.on('data', (data) => {
      var size = data.length + 2; // 1 byte type + 1 byte client id
      var message = new Buffer(size);
      data.copy(message, 2, 0);
      message[0] = 0x11; //data transfer
      message[1] = id;
      debug('Income data', data.length, data);
      debug('rawData', message.length, message);
      this.emit('data', message);
    });
    c.on('end', () => {
      if (self.clients[id]) {
        delete self.clients[id];
      }
      debug('client disconnected');
    });
  });
  self.exposeServer.on('error', (err) => {
    throw err;
  });
  self.exposeServer.listen(port, () => {
    debug('proxy server bound on port ' + 5901);
  });
};

util.inherits(ProxyServer, EventEmitter);

ProxyServer.prototype.onData = function (data) {
  /*if (data.length > 2 || data[0] !== 0x11 || !this.clients[data[1]]) {
    return;
  }*/
  var out = new Buffer(data.length - 2);
  data.copy(out, 0, 2);
  debug('Proto data', data.length, data);
  debug('Clear data', out.length, out);
  this.clients[data[1]].write(out);
};

module.exports = ProxyServer;
