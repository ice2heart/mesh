var PORT = 3478;
var HOST = '216.93.246.18';

const net = require('net');
const Stun = require('./stunclient');
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

if (argv.h || !argv._.length) {
  console.log('-h or --help to help\n-p or --port to set up server port\n./mesh server addres');
  process.exit(1);
}


var getRand = function () {
  return Math.random() * (0xff);
};

var App = function () {
  var self = this;
  this.ourId;
  this.ids = [];
  this.ip = [];
  this.clients = {}
  this.stun = new Stun(HOST, PORT);

  this.stun.on('connected', () => {
    console.log('Connected');
    if (argv.c) {
      self.exposeServer = net.createServer((c) => {
        var id = getRand;
        var idMessage = new Buffer(2);
        idMessage[0] = 0x12; // id
        idMessage[1] = id;
        self.stun.send(idMessage);
        self.clients[id] = c;
        console.log('client connected');
        c.on('data', (data) => {
          var size = data.length + 2; // 1 byte type + 1 byte client id
          var message = new Buffer(size);
          message.copy(data, 0, 2);
          message[0] = 0x11; //data transfer
          message[1] = id;
          self.stun.send(message);
        });
        c.on('end', () => {
          if (self.id[id]) {
            delete self.id[id];
          }
          console.log('client disconnected');
        });
      });
      self.stun.on('data', (data) => {
        if (data.length > 2 || data[0] !== 0x11 || typeof (self.id[data[1]]) === 'undefined') {
          return;
        }
        var out = new Buffer(data.length - 2);
        out.copy(data, 0, data.length - 2);
        self.id[data[1]].write(out);
      });
      self.exposeServer.on('error', (err) => {
        throw err;
      });
      self.exposeServer.listen(argv.c, () => {
        console.log('proxy server bound on port ' + argv.c);
      });
    } //end of c
    if (argv.e) {
      self.exposeSockets = {};
      self.stun.on('data', (data) => {
        if (data[0] == 0x12) {
          socket = new net.Socket();
          var id = data[1];
          self.exposeSockets[id] = socket;
          socket.on('data', (data) => {
            var size = data.length + 2; // 1 byte type + 1 byte client id
            var message = new Buffer(size);
            message.copy(data, 0, 2);
            message[0] = 0x11; //data transfer
            message[1] = id;
            self.stun.send(message);
          });
          socket.on('end', function () {
            console.log('end');
            delete self.exposeSockets[id];
          });
          socket.connect(argv.e, 'localhost', () => {
            console.log('up connect id' + id);
          });
        }
        if (data[0] == 0x11) {
          if (typeof (self.exposeSockets[data[1]]) === 'undefined') {
            return;
          }
          var out = new Buffer(data.length - 2);
          out.copy(data, 0, data.length - 2);
          self.exposeSockets[data[1]].write(out);
        }
      });

    }
  });


  this.commandSocket = new net.Socket();
  this.commandSocket.on('data', function (data) {
    console.log('Received: ' + data.length);
    var type = data[0];
    var sip1, sip2, sip3, sip4, sport;
    switch (type) {
    case 2:
      sip1 = data[1];
      sip2 = data[2];
      sip3 = data[3];
      sip4 = data[4];
      sport = data.readUInt16BE(5);
      var newip = `${sip1}.${sip2}.${sip3}.${sip4}`;
      console.log(`${newip}:${sport}`);
      self.stun.setClient(newip, sport);
      break;
    case 3:
      var count = (data.length - 1) / 3;
      for (var i = 0; i < count; ++i) {
        var id = data.readUInt16BE(2 + (i * 3));
        if (id !== ourId)
          self.ids.push(id);
      }
      if (self.ids.length) {
        self.getIp().then(() => {
          self.sendIp();
        });
      }

      break;
    default:

    }
  });

  this.commandSocket.on('close', function () {
    console.log('Connection closed');
  });
  this.commandSocket.connect(argv.p, argv._[0], () => {
    //this.commandSocket.connect(7007, '192.168.88.102', () => {
    console.log('Connected');
    var buff = new Buffer(3);
    buff[0] = 0; //comand register
    // new name
    buff[1] = 0; // ok first is 0
    buff[2] = getRand();
    ourId = buff.readUInt16BE(1);
    this.commandSocket.write(buff);
  });

};

App.prototype.getIp = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.stun.once('ip', function (ourip) {
      console.log('Our ip:', ourip);
      self.ip = ourip;
      resolve(ourip);
    });
    self.stun.getIp();
  });
};


App.prototype.sendIp = function () {
  this.ids.forEach((Id) => {
    var buff = new Buffer(10);
    buff[0] = 0x02;
    buff.writeUInt16BE(Id, 1); //id
    buff[3] = 0x02;
    //ip
    buff[5] = this.ip[1];
    buff[4] = this.ip[0];
    buff[6] = this.ip[2];
    buff[7] = this.ip[3];
    //port
    buff.writeUInt16BE(this.ip[4], 8);
    this.commandSocket.write(buff);
  });
};

var app = new App();
