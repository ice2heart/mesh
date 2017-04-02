const Protocol = require('../proto');
const fs = require('fs');
const chai = require('chai');
const assert = chai.assert;
const expect = require('chai').expect;
const testData = fs.readFileSync('proto.js');

function shuffle(a) {
  for (let i = a.length; i; i--) {
    let j = Math.floor(Math.random() * i);
    [a[i - 1], a[j]] = [a[j], a[i - 1]];
  }
}

describe('Protocol', function () {
  var p;
  var p2;
  beforeEach(function () {
      p = new Protocol();
      p2 = new Protocol();
   });
   afterEach(function () {
      p && delete p;
      p = null;
      p2 && delete p2;
      p2 = null;
   });
  it('Data transfer test', function () {
    var outFile = [];
    p.on('packet', (data) => {
      p2.packet(data);
    });
    p2.on('data', (data) => {
      outFile.push(data);
      var totalLength = outFile.reduce((val, item) => {
        return val + item.length;
      }, 0);
      if (totalLength >= testData.length){
        var result = Buffer.concat(outFile);
        expect(Buffer.compare(testData, result)).to.equal(0 );
      }
    });
    p2.on('packet', (data) => {
      p.packet(data);
    });
    p.rawData(testData);
  });
  it ('shuffle stream', function(){
    let outFile = [];
    p2.on('data', (data) => {
      outFile.push(data);
      var totalLength = outFile.reduce((val, item) => {
        return val + item.length;
      }, 0);
      if (totalLength >= testData.length){
        var result = Buffer.concat(outFile);
        expect(Buffer.compare(testData, result)).to.equal(0);
      }
    });
    p2.on('packet', (data) => {
      p.packet(data);
    });
    p.rawData(testData);
    var unsort = [];
    for (let pp of p.packets) {
      unsort.push(pp.buff);
    }
    p2.packet(unsort.shift());
    shuffle(unsort);
    for (let pp of unsort) {
      p2.packet(pp);
    }
  });
});
