const Protocol = require('./proto');
const net = require('net');
const debug = require('debug')('expose');

const EventEmitter = require('events').EventEmitter;
const util = require('util');


const Expose = function (port, address) {
  address = address ? address : 'localhost';
  this.exposeSockets = {};
  this.buff = {};
  this.destPort = port;
  this.destAddress = address;
};

util.inherits(Expose, EventEmitter);

Expose.prototype.onData = function (data) {
  debug('Proto data', data.length, data);
  if (data[0] == 0x12) {

    let socket = new net.Socket();
    let id = data[1];
    this.exposeSockets[id] = socket;
    socket.on('data', (data) => {
      let size = data.length + 2; // 1 byte type + 1 byte client id
      let message = new Buffer(size);
      data.copy(message, 2, 0);
      message[0] = 0x11; //data transfer
      message[1] = id;
      debug('Income data', data.length, data);
      debug('rawData', message.length, message);
      this.emit('data', message);
    });
    socket.on('end', () => {
      debug('end');
      delete this.exposeSockets[id];
    });
    socket.connect(this.destPort, this.destAddress, () => {
      if (this.buff[data[1]]) {
        this.buff[data[1]].forEach((out) => {
          debug('buffData', out.length, out);
          socket.write(out);
        });
      }
    });
  }
  if (data[0] == 0x11) {
    var out = new Buffer(data.length - 2);
    data.copy(out, 0, 2);
    if (!this.exposeSockets[data[1]]) {
      debug('no socket');
      if (!this.buff[data[1]])
        this.buff[data[1]] = [];
      this.buff[data[1]].push(out);
      return;
    }
    debug('Outcome Data', out.length, out);
    this.exposeSockets[data[1]].write(out);
  }
};
module.exports = Expose;
