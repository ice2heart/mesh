const debug = require('debug')('main');
const debugS = require('debug')('server');
const debugC = require('debug')('client');

const ExposePort = require('./lib/ExposePort');
const ProxyServer = require('./lib/ProxyPortServer');

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


var App = function () {
  this.expose  = new ExposePort(8000);
  this.proxy = new ProxyServer(5901);
  this.protoServer = this.proxy.getProto();
  this.protoClient = this.expose.getProto();
  this.protoClient.on('packet', (packet) => {
    this.protoServer.packet(packet);
  });
  this.protoServer.on('packet', (packet) => {
    this.protoClient.packet(packet);
  });
};


var app = new App();
