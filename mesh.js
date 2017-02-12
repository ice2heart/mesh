var PORT = 3478;
var HOST = '216.93.246.18';

const net = require('net');
const Stun = require('./stunclient');

var getRand = function () {
  return Math.random() * (0xff);
};

var App = function () {
  var self = this;
  this.ourId;
  this.ids = [];
  this.ip = [];
  this.stun = new Stun(HOST, PORT);


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
        console.log(id);
        if (id !== ourId)
          self.ids.push(id);

      }
      self.getIp().then(() => {
        self.sendIp();
      });
      break;
    default:

    }
  });

  this.commandSocket.on('close', function () {
    console.log('Connection closed');
  });
  //this.commandSocket.connect(7007, 'home.ice2heart.com', () => {
  this.commandSocket.connect(7007, '192.168.88.102', () => {
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
      console.log(ourip);
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
