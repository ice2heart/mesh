const debug = require('debug')('main');

const ExposePort = require('./lib/ExposePort');
const ProxyServer = require('./lib/ProxyPortServer');
const Protocol = require('./lib/proto');

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
  this.protoServer = new Protocol();
  this.protoClient = new Protocol();

  this.protoClient.on('data', this.expose.onData.bind(this.expose));
  this.expose.on('data', this.protoClient.rawData.bind(this.protoClient));
  this.protoClient.on('packet', this.protoServer.packet.bind(this.protoServer));

  this.protoServer.on('data', this.proxy.onData.bind(this.proxy));
  this.proxy.on('data', this.protoServer .rawData.bind(this.protoServer));
  this.protoServer.on('packet', this.protoClient.packet.bind(this.protoClient));

};


var app = new App();
