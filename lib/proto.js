
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const MAXUDPSIZE = 509;
const HEADERSIZE = 2 + 2 + 1 + 1; //magic + length + number + type;
const MAXSIZE = MAXUDPSIZE - HEADERSIZE;
const MAGICA = 0xf1;
const MAGICB = 0x1f;

const MAGICAPOS = 0;
const MAGICBPOS = 1;
const SIZEPOS = 2;
const NUMPOS = 6;
const TYPEPOS = 7;
const MESSAGETYPEPOS = 8;

//ToDo: replace magic vars to consts;

const MessageTypes = {
  REQUEST: 0x01,
};

const DataTypes = {
  DATA: 0xEE,
  SYSTEM: 0xEF,
  USER: 0xEA,
};
const RX = 0;
const TX = 1;
const RXT = 2;


var Packet = function (data, num, type, size) {
  this.size = data.length + HEADERSIZE;
  this.num = num;
  this.buff = new Buffer(this.size + 1);
  data.copy(this.buff, HEADERSIZE, 0); //target, targetStart, sourceStart
  this.buff[MAGICAPOS] = MAGICA;
  this.buff[MAGICBPOS] = MAGICB;
  this.buff.writeUInt32BE(size, SIZEPOS); // we need or not?
  this.buff[NUMPOS] = num;
  this.buff[TYPEPOS] = type;
};

var Protocol = function () {
  EventEmitter.call(this);
  this.packets = [];
  this.number = 0;
  this.counters = new Buffer(3); //hack
  this.counters[TX] = 0;
  this.counters[RX] = 0;
  this.firstRX = true;
  this.unorderedPackets = [];
  this.storageBuffer = null;
  this.storageSize = 0;
};
util.inherits(Protocol, EventEmitter);


Protocol.prototype.rawData = function (data) {
  var startPos = 0;
  if (!data.length)
    return;
  var first = true;
  while (startPos != data.length) {
    var packet;
    if (data.length - startPos > MAXSIZE) {
      packet = new Packet(data.slice(startPos, startPos + MAXSIZE), this.counters[TX]++, DataTypes.DATA, first? data.length : 0);
      this.packets[packet.num] = packet;
      this.emit('packet', packet.buff);
      startPos += MAXSIZE;
    } else {
      var size = data.length - startPos;
      packet = new Packet(data.slice(startPos, startPos + size), this.counters[TX]++, DataTypes.DATA, first? data.length : 0);
      this.packets[packet.num] = packet;
      this.emit('packet', packet.buff);
      startPos += size;
    }
    first = false;
  }
};

Protocol.prototype.systemData = function(data, type) {
  if (data.length > 500) {
    console.error('systemData pacet have limit 500 byte');
    return;
  }
  var packetType = type || DataTypes.USER;
  packet = new Packet(data, this.counters[TX]++, packetType);
  this.packets[packet.num] = packet;
  this.emit('packet', packet.buff);
};

Protocol.prototype.packet = function (data) {
  if (this.firstRX) {
    this.counters[RX] = data[NUMPOS] - 1;
    this.firstRX = false;
  }
  //console.log(data);

  if (!this.checkPacket(data)) {
    this.unorderedPackets.push(data);
    this.unorderedPackets.sort(function (a, b) {
      // problem with 255 and 0
      return a[4] - b[4];
    });
    //console.error('PANIC!!!', this.unorderedPackets.length); //start timer

    if (this.unorderedPackets.length > 10) {
      this.counters[RXT] = this.counters[RX] + 1;
      this.requestPacket(this.counters[RXT]);
    }
  }
  if (this.unorderedPackets.length > 0) {
    this.tryGetPacket();
  }
};

Protocol.prototype.checkPacket = function (data) {
  /*if (data[0] != MAGICA || data[1] != MAGICB) {
    console.error('Bad packet');
    return false;
  }*/
  this.counters[RXT] = this.counters[RX] + 1;


  if (data[NUMPOS] === this.counters[RXT]) {
    if (data[TYPEPOS] === DataTypes.DATA){
      this.counters[RX]++;
      if (!this.storageBuffer) {
        this.storageBuffer = [];
        this.storageSize = data.readUInt32BE(2);
      }

      this.storageBuffer.push(data.slice(HEADERSIZE, data.length - 1));
      let size = this.storageBuffer.reduce((val, item) => val + item.length, 0);
      //console.log(`push packet num ${data[4]}, ${this.storageSize}, ${size}`);
      if (size === this.storageSize){
        this.emit('data',  Buffer.concat(this.storageBuffer));
        this.storageSize = 0;
        delete this.storageBuffer;
      }
      return true;
    }
    if (data[TYPEPOS] === DataTypes.SYSTEM){
      if (data[MESSAGETYPEPOS] === MessageTypes.REQUEST){
        var num = data[MESSAGETYPEPOS + 1];
        this.emit('packet', this.packets[num].buff);
      }
      return true;
    }
    if (data[TYPEPOS] === DataTypes.USER) {

      this.counters[RX]++;
      //console.log(`push packet num ${data[4]}`);
      this.emit('systemData', data.slice(HEADERSIZE, data.length - 1));
      return true;
    }
  }
  return false;
};

Protocol.prototype.requestPacket = function (number) {
  //type 1, number 1
  //console.log('requestPacket ' + number);
  var data = new Buffer(2);
  data[0] = MessageTypes.REQUEST;
  data[1] = number;
  this.systemData(data, DataTypes.SYSTEM);
};

Protocol.prototype.tryGetPacket = function () {
  if (!this.unorderedPackets.length)
    return;
  var packet = this.unorderedPackets[0];
  if (this.checkPacket(packet)) {
    this.unorderedPackets.shift();
    this.tryGetPacket();
  }
};


module.exports = Protocol;
