const chai = require('chai');
const should = chai.should;


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
   it('getIp', function (done) {
      stunclient.getIp().then((ip) => {
         done();
      });
   });
});
