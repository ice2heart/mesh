// 0 register
// 1 current users
// 2 send to user
// 3
// 4 unregister
const net = require('net');

const users = {}

const sendUsers = () => {
  var list = [3];

  Object.keys(users).forEach((key) => {
    list.push(0);
    list.push(key);
  });
  Object.keys(users).forEach((key) => {
    users[key].write(new Buffer(list));
  });
  console.log(list);
}

var server = net.createServer(function(sock) {
  console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

  sock.on('data', function(data) {
    var command = data.readInt8();
    switch (command) {
      case 0:
        var name = data.readInt16BE(1);
        console.log('Registred ' + name);
        users[name] = sock;
        sock.iid = name;
        sendUsers();
        break;
      case 2:
        var to = data.readInt16BE(1);
        var newBuff = new Buffer(data, 3);
        //console.log(to, newBuff, users[to]);
        if (users[to]) {
          users[to].write(newBuff);
        }
        break;
      case 4:
        var from = data.readInt16BE(1);
        delete users.from;
      default:
    }
  });

  sock.on('close', function(data) {
    console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    delete users[sock.iid];
  });
  //socket.pipe(socket);
});

server.listen(7007);
