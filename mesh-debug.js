//ToDo:
// 1. Echo type of client
// убрать к херам сеть, запукать клиент сервер в одном процессе и смотреть как трафик ходит
var PORT = 3478;
var HOST = '216.93.246.18';


const debug = require('debug')('main');
const debugS = require('debug')('server');
const debugC = require('debug')('client');

const ExposePort = require('./lib/ExposePort');

//expose
const Protocol = require('./lib/proto');
const net = require('net');


const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    h: 'help',
    p: 'port',
    e: 'expose',
    c: 'connect'
  },
  default: {
    p: 7007
  },
  '--': true
});

if (argv.h) {
  console.log('-h or --help to help\n-p or --port to set up server port\n-e or --expose [portnumber]\n-c or --connect [port]');
  process.exit(1);
}

var getRand = function () {
  return (Math.random() * (0xff)) & 0xff;
};

var App = function () {
  var self = this;

  this.protoServer = new Protocol();
  this.expose  = new ExposePort(22);
  this.protoClient = this.expose.getProto();
  self.protoClient.on('packet', (packet) => {
    //debug('packet client', packet.length, packet);
    self.protoServer.packet(packet);
  });
  self.protoServer.on('packet', (packet) => {
    //debug('packet server', packet.length, packet);
    self.protoClient.packet(packet);
  });
  this.connect();

};


App.prototype.connect = function () {
  var self = this;
  this.clients = {};
  self.exposeServer = net.createServer((c) => {
    var id = getRand();
    var idMessage = new Buffer(2);
    idMessage[0] = 0x12; // id
    idMessage[1] = id;
    self.protoServer.rawData(idMessage);
    self.clients[id] = c;
    debugS('client connected');
    c.on('data', (data) => {
      var size = data.length + 2; // 1 byte type + 1 byte client id
      var message = new Buffer(size);
      data.copy(message, 2, 0);
      message[0] = 0x11; //data transfer
      message[1] = id;
      debugS('Income data', data.length, data);
      debugS('rawData', message.length, message);
      self.protoServer.rawData(message);
    });
    c.on('end', () => {
      if (self.clients[id]) {
        delete self.clients[id];
      }
      debugS('client disconnected');
    });
  });
  self.protoServer.on('data', (data) => {
    /*if (data.length > 2 || data[0] !== 0x11 || !self.clients[data[1]]) {
      return;
    }*/
    var out = new Buffer(data.length - 2);
    data.copy(out, 0, 2);
    debugS('Proto data', data.length, data);
    debugS('Clear data', out.length, out);
    self.clients[data[1]].write(out);
  });
  self.exposeServer.on('error', (err) => {
    throw err;
  });
  self.exposeServer.listen(5901, () => {
    debugS('proxy server bound on port ' + 5901);
  });
};


var app = new App();
