const debug = require('debug')('main');

const ExposePort = require('./lib/ExposePort');
const ProxyServer = require('./lib/ProxyPortServer');
const Protocol = require('./lib/proto');
const Stun = require('./lib/stunclient');

var PORT = 3478;
var HOST = '216.93.246.18';

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

  this.stunclient1 = new Stun(HOST, PORT);
  this.stunclient2 = new Stun(HOST, PORT);



  this.protoClient.on('data', this.expose.onData.bind(this.expose));
  this.expose.on('data', this.protoClient.rawData.bind(this.protoClient));
  this.protoClient.on('packet', this.stunclient1.send.bind(this.stunclient1));
  this.stunclient1.on('data', this.protoClient.packet.bind(this.protoClient));
  this.protoClient.on('systemData', this.protoServer.packet.bind(this.protoServer));

  this.protoServer.on('data', this.proxy.onData.bind(this.proxy));
  this.proxy.on('data', this.protoServer.rawData.bind(this.protoServer));
  this.protoServer.on('packet', this.stunclient2.send.bind(this.stunclient2));
  this.stunclient2.on('data', this.protoServer.packet.bind(this.protoServer));
  this.protoServer.on('systemData', this.protoClient.packet.bind(this.protoClient));
  this.load();
};

App.prototype.load = async function () {
  let sr1 = this.stunclient1.getIp();
  let sr2 = this.stunclient2.getIp();
  let ip1 = await sr1;
  let ip2 = await sr2;
  this.stunclient1.setClient(ip2.slice(0, 4).join('.'), ip2[4]);
  this.stunclient2.setClient(ip1.slice(0, 4).join('.'), ip1[4]);
  this.protoServer.rawData(Buffer('First packet ->'));
  this.protoClient.rawData(Buffer('First packet ->'));
}

var app = new App();
