const fs = require('fs');
const MAXSIZE = 503;
const MAGICA = 0xf1;
const MAGICB = 0x1f;


var Packet = function(data, num) {
  this.size = data.length + 2 + 2 + 1; //magic + length + number;
  this.buff = new Buffer(this.size);
  data.copy(this.buff, 5, 0); //target, targetStart, sourceStart
  this.buff[0] = MAGICA;
  this.buff[1] = MAGICB;
  this.buff.writeInt16BE(this.size, 2);
  this.buff[4] = num;
};

var Protocol = function() {
  this.packets = [];
  this.number = 0;
};

Protocol.prototype.rawData = function (data) {
  var startPos = 0;
  while (startPos != data.length - 1) {
    if (data.length - 1 - startPos > MAXSIZE) {

      this.packets.push(new Packet(data.slice(startPos, startPos + MAXSIZE), this.number++));

      startPos += MAXSIZE;
    } else {
      var size = data.length - 1 - startPos;
      this.packets.push(new Packet(data.slice(startPos, startPos + size), this.number++));
      startPos += size;
    }
  }
};


var p = new Protocol();
var d =  fs.readFileSync('app.js');
p.rawData(d);
console.log(p.packets);

module.exports = Protocol;
