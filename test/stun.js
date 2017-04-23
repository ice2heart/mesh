const chai = require('chai');
const assert = chai.assert;
const expect = require('chai').expect;

const Stun = require('../lib/stunclient');

var PORT = 3478;
var HOST = '216.93.246.18';

describe('Protocol', function () {
  var stunclient;
  beforeEach(function () {
      stunclient = new Stun(HOST, PORT);
   });
   afterEach(function () {
      stunclient && delete stunclient;
   });
   it('getIp', function(){
     stunclient.once('connected', ()=>{});
     var ip;
     stunclient.once('ip', (ourip) => {
       //expect(ourip).not.to.equal(0);
       ip = ourip;
       console.log(ourip);
     });
     stunclient.getIp();
     console.log(ip);
   });
});
