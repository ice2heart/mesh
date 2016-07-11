// 0 register
// 1 current users
// 2 send to user
// 3 usreslist
// 4 unregister
const net = require('net');

const users = {};

const sendUsers = () => {
  var list = new Buffer((Object.keys(users).length * 3) + 1);
  list[0] = 3;
  var pos = 1;

  Object.keys(users).forEach((key) => {
    list[pos] = 0;
    list.writeInt16BE(key, pos + 1);
    pos += 3;
  });
  Object.keys(users).forEach((key) => {
    users[key].write(list);
  });
  console.log(list);
};

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
        var newBuff = data.slice(3);
        //console.log(to, newBuff, users[to]);
        if (users[to]) {
          users[to].write(newBuff);
        }
        break;
      case 4:
        var from = data.readInt16BE(1);
        delete users[from];
        break;
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
