var PORT = 3478;
var HOST = '216.93.246.18';

var ourId;
var ids = [];
var ip = [];


const net = require('net');
const Stun = require('./stunclient');
const stun = new Stun(PORT, HOST);
stun.on('ip', function(ourip){
  ip = ourip;
});

var getRand = function () {
  return Math.random() * (0xff);
};

var commandClient = new net.Socket();
//commandClient.connect(7007, 'home.ice2heart.com', function () {
commandClient.connect(7007, '192.168.88.102', function () {
   console.log('Connected');
   var buff = new Buffer(3);
   buff[0] = 0; //comand register
   // new name
   buff[1] = 0; // ok first is 0
   buff[2] = getRand();
   ourId = buff.readUInt16BE(1);
   commandClient.write(buff);
});

commandClient.on('data', function (data) {
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
      console.log(`${sip1}.${sip2}.${sip3}${sip4}:${sport}`);
      sendIp();
      setInterval(function(){
         var message = new Buffer(5);
         message[0] = 'H';
         message[1] = 'e';
         message[2] = 'l';
         message[3] = 'l';
         message[4] = 'o';
         stun.send(message, newip, port);
      }, 10000);
      break;
   case 3:
      var count = (data.length - 1) / 3;
      for (var i = 0; i < count; ++i){
         var id = data.readUInt16BE(2 + (i * 3));
         console.log(id);
         if (id!==ourId)
            ids.push(id);
      }
      break;
   default:

   }
});

commandClient.on('close', function () {
   console.log('Connection closed');
});

var sendIp = function() {
   ids.forEach(function(Id){
      var buff = new Buffer(10);
      buff[0] = 0x02;
      buff.writeUInt16BE(Id, 1);//id
      buff[3] = 0x02;
      //ip
      buff[4] = ip[0];
      buff[5] = ip[1];
      buff[6] = ip[2];
      buff[7] = ip[3];
      //port
      buff.writeUInt16BE(ip[4], 8);
      commandClient.write(buff);
   });
};

stun.getIp();
