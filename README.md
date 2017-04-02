## TCP over UDP peer 2 peer tunnel.

It's a proof of concept.

## How to use.

1. Start on dedicated server communication server program.

```
node server.js
```

2. Start on first computer Mesh client with expose port.

```
node mesh.js <your server IP/dnsName here> -e 8080
```

3. Start on second computer Mesh client with listen port.

```
node mesh.js <your server IP/dnsName here> -c 8080
```

4. Start http server on first computer

5. Test Connection on second computer
```
curl localhost:8080
```
