const Protocol = require('../lib/proto');
const fs = require('fs');
const chai = require('chai');
const assert = chai.assert;
const expect = require('chai').expect;
// const testData = fs.readFileSync('mesh.js');
const testData = fs.readFileSync('nm.tar.gz');

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
    p.on('packet', (data) => {
      p2.packet(data);
    });
    p2.on('data', (data) => {
      expect(Buffer.compare(testData, data)).to.equal(0);
    });
    p2.on('packet', (data) => {
      p.packet(data);
    });
    p.rawData(testData);
  });
  it ('shuffle stream', function(){
    p2.on('data', (data) => {
      expect(Buffer.compare(testData, data)).to.equal(0);
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
  it ('remove packets', function(done){

    /// ARE BROKEN!
    p2.on('data', (data) => {
      console.log('data',Buffer.compare(testData, data), data.length, testData.length);
      expect(Buffer.compare(testData, data)).to.equal(0);
      done();
    });
    p2.on('packet', (data) => {
      console.log('packet',data);
      p.packet(data);
    });
    let i = 0;
    p.on('packet', (data) => {
      i = i + 1;
      if (i != 2){
        p2.packet(data);
      }
      //console.log('packet',data);
    });
    
    p.rawData(testData);
    var unsort = [];
    for (let pp of p.packets) {
      // console.log(pp);
      unsort.push(pp.buff);
    }
    p2.packet(unsort.shift());
    shuffle(unsort);

  });
});
