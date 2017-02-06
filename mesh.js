var PORT = 3478;
var HOST = '216.93.246.18';

var dgram = require('dgram');

var MAPPED_ADDRESS = 0x001;
var XOR_MAPPED_ADDRESS = 0x0020;
var SUCCESS_RESPONSE = 0x00000101;
var status = 0;
var ourId;
var ids = [];
var ip = [];

var client = dgram.createSocket('udp4');
const net = require('net');

var commandClient = new net.Socket();
commandClient.connect(7007, 'home.ice2heart.com', function () {
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
         client.send(message, 0, message.length, sport, newip, function (err, bytes) {
            if (err) console.log(err);
            console.log('UDP message sent to ' + newip + ':' + sport);
            //client.close();
         });
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

var getRand = function () {
   return Math.random() * (0xff);
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
var message = makeDiscoverMsg();

client.send(message, 0, message.length, PORT, HOST, function (err, bytes) {
   if (err) throw err;
   console.log('UDP message sent to ' + HOST + ':' + PORT);
   //client.close();
});

client.on('message', function (msg, rinfo) {
   if (status) {
      console.log(msg, rinfo);
      return;
   }


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
   ip[0] = ip1;
   ip[1] = ip2;
   ip[2] = ip3;
   ip[3] = ip4;
   ip[4] = port;
   status = 1;
});
