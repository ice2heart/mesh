const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;
const util = require('util');


var MAPPED_ADDRESS = 0x001;
var XOR_MAPPED_ADDRESS = 0x0020;
var SUCCESS_RESPONSE = 0x00000101;


var getRand = function () {
  return Math.random() & (0xff);
};

var makeDiscoverMsg = function () {
  var ret = new Buffer(20);
  // Binding request sign
  ret[0] = 0x00;
  ret[1] = 0x1;
  // Length
  ret[2] = 0x00;
  ret[3] = 0x0;
  //Magic cookie
  ret[4] = 0x21;
  ret[5] = 0x12;
  ret[6] = 0xA4;
  ret[7] = 0x42;
  //id random
  for (var i = 0; i < 12; i++) {
    ret[8 + i] = getRand();
  }
  console.log(ret);
  return ret;
};

var Stun = function (ip, port) {
  EventEmitter.call(this);
  this._serverIp = ip;
  this._serverPort = port;
  this.client = dgram.createSocket('udp4');
  this.status = 0;
  this.ip = [];
  var self = this;

  this.client.on('message', function (msg, rinfo) {
    if (self.status) {
      if (self.status === 1) {
        self.emit('connected');
        self.status = 2;
      }
      if (msg[0] == 0x10) {
        clearTimeout(self.timeout);
        self.timeout = setTimeout(() => {
          console.log('disconnect');
          self.emit('disconnect');
          self.close();
        }, 3000);
        return;
      }
      console.log(msg, rinfo);
      self.emit('data', msg);
      return;
    }


    //stun things
    var answer = msg.readUInt16BE();
    if (answer !== SUCCESS_RESPONSE) {
      console.log("Error response");
      //make error
    }

    var length = msg.readUInt16BE(2);
    var cookie = msg.readUInt32BE(4);
    var id1 = msg.readUInt32BE(8);
    var id2 = msg.readUInt32BE(12);
    var id3 = msg.readUInt32BE(16);

    var attrLen = length;
    var pos = 0;

    //var protocol = 0x01;

    console.log(`Get data ${cookie.toString(16)} Id = ${id1.toString(16)}${id2.toString(16)}${id3.toString(16)}`);

    var protocol, port, ip1, ip2, ip3, ip4;
    while (attrLen - pos > 0) {
      var type1 = msg.readUInt16BE(20 + pos);
      var length1 = msg.readUInt16BE(22 + pos);
      if (type1 == MAPPED_ADDRESS) {
        protocol = msg.readInt8(25 + pos);
        port = msg.readUInt16BE(26 + pos);
        ip1 = msg[28 + pos];
        ip2 = msg[29 + pos];
        ip3 = msg[30 + pos];
        ip4 = msg[31 + pos];
      }
      if (type1 == XOR_MAPPED_ADDRESS) {
        //Xor with magic cookie
        protocol = msg[25 + pos];
        port = msg.readUInt16BE(26 + pos) ^ 0x2112;
        ip1 = msg[28 + pos] ^ 0x21;
        ip2 = msg[29 + pos] ^ 0x12;
        ip3 = msg[30 + pos] ^ 0xa4;
        ip4 = msg[31 + pos] ^ 0x42;
      }
      console.log(`${protocol}, ${type1}, ip = ${ip1}.${ip2}.${ip3}.${ip4}:${port}`);
      pos += length1 + 4;
    }
    self.ip[1] = ip2;
    self.ip[0] = ip1;
    self.ip[2] = ip3;
    self.ip[3] = ip4;
    self.ip[4] = port;
    self.status = 1;
    //self.emit('ip', `${ip1}.${ip2}.${ip3}.${ip4}`, port);
    self.emit('ip', self.ip, port);
  });
};

util.inherits(Stun, EventEmitter);

Stun.prototype.getIp = function () {
  var message = makeDiscoverMsg();
  this.client.send(message, 0, message.length, this._serverPort, this._serverIp, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

Stun.prototype.send = function (message, possibleip, possibleport) {
  //console.log('Stun', 'Send message ', message.length);
  var ip = possibleip || this._serverIp;
  var port = possibleport || this._serverPort;
  //console.log(ip, port);
  this.client.send(message, 0, message.length, port, ip, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

Stun.prototype.setClient = function (ip, port) {
  this._serverIp = ip;
  this._serverPort = port;
  this.ping = setInterval(() => {
    var message = new Buffer(5);
    message[0] = 0x10;
    message.write('Ping', 1);
    //console.log(message);
    this.send(message, this._serverIp, this._serverPort);
  }, 1000);
};

Stun.prototype.close = function () {
  clearInterval(this.ping);
  this.client.close();
};


module.exports = Stun;
