const chai = require('chai');
const should = chai.should;
const expect = chai.expect;

const fs = require('fs');
const testData = fs.readFileSync('mesh.js');

// const Common = require('../lib/Common');
// const getRand = Common.getRand;
// let rawBytes = [];
// // for (let i =0; i<25000000 ; ++i){
// for (let i =0; i<12500 ; ++i){
//     rawBytes.push(getRand());
// }
// const testData = new Buffer(rawBytes);
// delete rawBytes;

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

describe('Udp', function () {
    let stunclient1;
    let stunclient2;

    beforeEach(async function () {
        stunclient1 = new Stun(HOST, PORT);
        stunclient2 = new Stun(HOST, PORT);
        let sr1 = stunclient1.getIp();
        let sr2 = stunclient2.getIp();
        let ip1 = await sr1;
        let ip2 = await sr2;
        stunclient1.setClient(ip2.slice(0, 4).join('.'), ip2[4]);
        stunclient2.setClient(ip1.slice(0, 4).join('.'), ip1[4]);
        stunclient2.send('First packet ->');
        stunclient1.send('First packet ->');

    });
    afterEach(function () {
        stunclient1.close();
        delete stunclient1;
        stunclient2.close();
        delete stunclient2;
    });
    it('Send data', function (done) {
        stunclient1.on('data', (data) => {
            done();
        })
        stunclient2.send('Pice of data');
    });
    it('Big data', function (done) {
        this.timeout(50000);
        let buffer = [];
        stunclient1.on('data', (data) => {
            buffer += data;
            if (buffer.length == testData.length) {
                if (!Buffer.compare(testData, new Buffer(buffer))) {
                    done();
                } else {
                    throw 'error';
                }
            }
            console.log(buffer.length, testData.length);
        })
        let MAXSIZE = 1024;
        let startPos = 0;
        // push too fast
        while (startPos != testData.length) {
            var packet;
            if (testData.length - startPos > MAXSIZE) {
                stunclient2.send(testData.slice(startPos, startPos + MAXSIZE));
                startPos += MAXSIZE;
            } else {
                var size = testData.length - startPos;
                stunclient2.send(testData.slice(startPos, startPos + size));
                startPos += size;
            }
        }

    });
});