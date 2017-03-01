const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const MAXSIZE = 502;
const HEADERSIZE = 2 + 2 + 1 + 1;  //magic + length + number + type;
const MAGICA = 0xf1;
const MAGICB = 0x1f;

const DATA = 0xEE;
const SYSTEM = 0xEF;
const RX = 0;
const TX = 1;
const RXT = 2;


var Packet = function (data, num, type) {
  this.size = data.length + HEADERSIZE;
  this.num = num;
  this.buff = new Buffer(this.size + 1);
  data.copy(this.buff, HEADERSIZE, 0); //target, targetStart, sourceStart
  this.buff[0] = MAGICA;
  this.buff[1] = MAGICB;
  this.buff.writeInt16BE(this.size, 2); // we need or not?
  this.buff[4] = num;
  this.buff[5] = type;
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
};
util.inherits(Protocol, EventEmitter);


Protocol.prototype.rawData = function (data) {
  var startPos = 0;
  if (!data.length)
    return;
  while (startPos != data.length) {
    var packet;
    if (data.length - startPos > MAXSIZE) {
      packet = new Packet(data.slice(startPos, startPos + MAXSIZE), this.counters[TX]++, DATA);
      this.packets.push(packet);
      this.emit('packet', packet.buff);
      startPos += MAXSIZE;
    } else {
      var size = data.length - startPos;
      packet = new Packet(data.slice(startPos, startPos + size), this.counters[TX]++, DATA);
      this.packets.push(packet);
      this.emit('packet', packet.buff);
      startPos += size;
    }
  }
};

Protocol.prototype.packet = function (data) {

  if (data[0] != MAGICA || data[1] != MAGICB) {
    console.error('Bad packet');
    return;
  }

  if (this.firstRX) {
    this.counters[RX] = data[4] - 1;
    this.firstRX = false;
  }
  this.counters[RXT] = this.counters[RX] + 1;
  if (data[4] === this.counters[RXT]) {
    this.counters[RX]++;
    this.emit('data', data.slice(HEADERSIZE, data.length-1));
  } else {
    this.unorderedPackets.push(data);
    this.unorderedPackets.sort(function(a,b) {return a[4] - b[4];});
    console.log(this.unorderedPackets);
    console.error('PANIC!!!');
  }

};


var p = new Protocol();
var p2 = new Protocol();
var d = fs.readFileSync('proto.js');
p.on('packet', (data) => {
  //p2.packet(data);
});
p2.on('data', (data) => {
  console.log('outdata' ,data);
  //fs.writeFile('temp.js', data, {flag: 'a'});
});
p.rawData(d);
var unsort = [];
for(let pp of p.packets) {
  unsort.push(pp.buff);
}
function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
}
console.log(unsort);
p2.packet(unsort.shift());
shuffle(unsort);
for (let pp of unsort) {
  p2.packet(pp);
}

//console.log(p.packets);

module.exports = Protocol;
