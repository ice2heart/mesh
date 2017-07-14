const Protocol = require('./proto');
const Common = require('./Common');
const net = require('net');
const debug = require('debug')('proxy');

const getRand = Common.getRand;

const ProxyServer = function(port) {
  const self = this;
  this.clients = {};
  this.protocol = new Protocol();
  self.exposeServer = net.createServer((c) => {
    var id = getRand();
    var idMessage = new Buffer(2);
    idMessage[0] = 0x12; // id
    idMessage[1] = id;
    self.protocol.rawData(idMessage);
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
      self.protocol.rawData(message);
    });
    c.on('end', () => {
      if (self.clients[id]) {
        delete self.clients[id];
      }
      debug('client disconnected');
    });
  });
  self.protocol.on('data', (data) => {
    /*if (data.length > 2 || data[0] !== 0x11 || !self.clients[data[1]]) {
      return;
    }*/
    var out = new Buffer(data.length - 2);
    data.copy(out, 0, 2);
    debug('Proto data', data.length, data);
    debug('Clear data', out.length, out);
    self.clients[data[1]].write(out);
  });
  self.exposeServer.on('error', (err) => {
    throw err;
  });
  self.exposeServer.listen(port, () => {
    debug('proxy server bound on port ' + 5901);
  });
};

ProxyServer.prototype.getProto = function() {
  return this.protocol;
};

module.exports = ProxyServer;
