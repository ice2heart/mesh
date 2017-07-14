const Protocol = require('./proto');
const net = require('net');
const debug = require('debug')('expose');


const Expose = function(port, address) {
  const self = this;
  address = address ? address : 'localhost';
  this.protocol = new Protocol();
  this.exposeSockets = {};
  this.buff = {};

  this.protocol.on('data', (data) => {
    debug('Proto data', data.length, data);
    if (data[0] == 0x12) {

      let socket = new net.Socket();
      let id = data[1];
      self.exposeSockets[id] = socket;
      socket.on('data', (data) => {
        let size = data.length + 2; // 1 byte type + 1 byte client id
        let message = new Buffer(size);
        data.copy(message, 2, 0);
        message[0] = 0x11; //data transfer
        message[1] = id;
        debug('Income data', data.length, data);
        debug('rawData', message.length, message);
        self.protocol.rawData(message);
      });
      socket.on('end', function () {
        debug('end');
        delete self.exposeSockets[id];
      });
      socket.connect(port, address, () => {
        if (self.buff[data[1]]) {
          self.buff[data[1]].forEach((out) => {
            debug('buffData', out.length, out);
            socket.write(out);
          });
        }
      });
    }
    if (data[0] == 0x11) {
      var out = new Buffer(data.length - 2);
      data.copy(out, 0, 2);
      if (!self.exposeSockets[data[1]]) {
        debug('no socket');
        if (!self.buff[data[1]])
          self.buff[data[1]] = [];
        self.buff[data[1]].push(out);
        return;
      }
      debug('Outcome Data', out.length, out);
      self.exposeSockets[data[1]].write(out);
    }
  });
};

Expose.prototype.getProto = function() {
  return this.protocol;
};

module.exports = Expose;
