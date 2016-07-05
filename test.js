const net = require('net');
const argv = require('optimist').argv;

const client = new net.Socket();
client.connect(7007, argv.port function() {
  console.log('Connected');
  //client.write('Hello, server! Love, Client.');
  var data = new Buffer([0, 00, argv.n]);
  client.write(data);
  console.log(data);
  setInterval(()=> {
    var i = new Buffer( [ 2, 00, argv.o, 10, 10, 10]);
    //console.log(i);
    client.write(i);
  }, 100);
});


client.on('data', function(data) {
  console.log(data);
  //client.destroy(); // kill client after server's response
});
