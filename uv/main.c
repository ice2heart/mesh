#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <uv.h>

uv_loop_t *loop;
uv_udp_t send_socket;
uv_udp_t recv_socket;
uv_timer_t heartbeat_timer;

uv_tcp_t command_socket;
uv_connect_t command_connect;

uv_udp_send_t send_req;

int is_ready;

uint16_t our_id;


uint8_t state;

const uint8_t MAPPED_ADDRESS = 0x001;
const uint8_t XOR_MAPPED_ADDRESS = 0x0020;
const uint16_t SUCCESS_RESPONSE = 0x0101;

void alloc_buffer(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
  buf->base = malloc(suggested_size);
  buf->len = suggested_size;
}

int getRand() {
  return rand() % (0xff);
}

uint8_t get8(const uv_buf_t *buf, int shift) {
  return (uint8_t)buf->base[shift];
}

int16_t get16BE(const uv_buf_t *buf, int shift) {
  return (uint8_t) buf->base[shift+1] | (uint8_t)buf->base[shift] << 8;
}

int32_t get32BE(const uv_buf_t *buf, int shift) {
  return (uint8_t) buf->base[shift+3] | (uint8_t) buf->base[shift+2] << 8 |(uint8_t) buf->base[shift+1] << 16 | (uint8_t)buf->base[shift] << 24;
}

void on_read(uv_udp_t *req, ssize_t nread, const uv_buf_t *buf, const struct sockaddr *addr, unsigned flags) {
    printf("%s data size %ld\n", __FUNCTION__, nread);
    if (nread == 0) {
      return;
    }
    if (nread < 0) {
        fprintf(stderr, "Read error %s\n", uv_err_name(nread));
        uv_close((uv_handle_t*) req, NULL);
        free(buf->base);
        return;
    }
    if (state != 0){
      printf("Data! ");
      for (size_t i = 0; i < nread; i++) {
        printf("%x ", buf->base[i]);
      }
      printf("\n");
      return;
    }

    int16_t answer = get16BE(buf, 0);
    if (answer != SUCCESS_RESPONSE){
      printf("Error response\n");
      exit(1);
    }
    int16_t length = get16BE(buf, 2);
    int32_t cookie = get32BE(buf, 4);
    int32_t id1 = get32BE(buf, 8);
    int32_t id2 = get32BE(buf, 12);
    int32_t id3 = get32BE(buf, 16);

    int16_t attrLen = length;
    int16_t pos = 0;

    uint8_t protocol = 0x01;
    uint16_t port = 0;
    uint8_t ip1 = 0;
    uint8_t ip2 = 0;
    uint8_t ip3 = 0;
    uint8_t ip4 = 0;

    printf("Get data %x Id = %x%x%x\n", cookie, id1, id2, id3);

    while (attrLen - pos > 0) {
      int16_t type1 = get16BE(buf, 20 + pos);
      int16_t length1 = get16BE(buf, 22 + pos);
      if (type1 == MAPPED_ADDRESS){
        protocol = get8(buf, 25 + pos);
        port = get16BE(buf, 26 + pos);
        ip1 = get8(buf, 28 + pos);
        ip2 = get8(buf, 29 + pos);
        ip3 = get8(buf, 30 + pos);
        ip4 = get8(buf, 31 + pos);
      }
      if (type1 == XOR_MAPPED_ADDRESS){
        //Xor with magic cookie
        protocol = get8(buf, 25 + pos);
        port = get16BE(buf, 26 + pos) ^ 0x2112;
        ip1 = get8(buf, 28 + pos) ^ 0x21;
        ip2 = get8(buf, 29 + pos) ^ 0x12;
        ip3 = get8(buf, 30 + pos) ^ 0xa4;
        ip4 = get8(buf, 31 + pos) ^ 0x42;
      }
      printf("protocol type %d %d ip %d.%d.%d.%d %d\n", type1 ,protocol, ip1, ip2, ip3, ip4, port);
      pos+=length1 + 4;
      printf("Attr length %d first type %d first length %d\n", attrLen, type1, length1);
    }
    state = 1;

    free(buf->base);
    //uv_udp_recv_stop(req);
}

uv_buf_t make_discover_msg() {
    uv_buf_t buffer;
    alloc_buffer(NULL, 20, &buffer);
    memset(buffer.base, 0, buffer.len);

    // Binding request sign
    buffer.base[0] = 0x00;
    buffer.base[1] = 0x1;
    // Length
    buffer.base[2] = 0x00;
    buffer.base[3] = 0x0;
    //Magic cookie
    buffer.base[4] = 0x21;
    buffer.base[5] = 0x12;
    buffer.base[6] = 0xA4;
    buffer.base[7] = 0x42;
    //id random
    for (int i=0; i<12; i++){
      buffer.base[8 + i] = getRand();
    }

    return buffer;
}

void on_send(uv_udp_send_t *req, int status) {
    printf("Send done status %d\n", status );
    if (status) {
        fprintf(stderr, "Send error %s\n", uv_strerror(status));
        return;
    }
}

void on_heartbeat() {
  printf("Callback!\n" );
  uv_buf_t discover_msg = make_discover_msg();
  struct sockaddr_in send_addr;
  //uv_ip4_addr("216.93.246.18", 3478, &send_addr);
  uv_ip4_addr("173.194.72.127", 19302, &send_addr);
  uv_udp_send(&send_req, &send_socket, &discover_msg, 1, (const struct sockaddr *)&send_addr, on_send);
}

void on_close(uv_handle_t* handle)
{
  printf("closed\n");
}

void on_write(uv_write_t* req, int status)
{
  printf("Send done status %d\n", status );
  if (status) {
    fprintf(stderr, "Read error %s\n", uv_err_name(status));
		return;
  }
}

void on_read_tcp(uv_stream_t* tcp, ssize_t nread, const uv_buf_t *buf)
{
	if(nread < 0) {
    uv_close((uv_handle_t*)tcp, on_close);
    free(buf->base);
	}

  uint8_t message = get8(buf, 0);
  uint8_t count = 0;
  switch (message) {
    case 1:
      count = (nread-1) / 3;
      printf("List of users, count %d\n",  count);
    break;
    default:
    break;
  }

	free(buf->base);
}

void on_connect(uv_connect_t* connection, int status) {
  printf("Is connect\n" );
  uv_stream_t* stream = connection->handle;

  uv_buf_t buffer;
  uv_write_t request;
  alloc_buffer(NULL, 3, &buffer);
  //command
  buffer.base[0] = 0x00;
  //name
  buffer.base[1] = getRand();
  buffer.base[2] = getRand();
  our_id = get16BE(&buffer, 1);
	uv_write(&request, stream, &buffer, 1, on_write);
	uv_read_start(stream, alloc_buffer, on_read_tcp);

}

int main() {
    state = 0;
    loop = uv_default_loop();

    uv_udp_init(loop, &send_socket);
    struct sockaddr_in broadcast_addr;
    uv_ip4_addr("0.0.0.0", 0, &broadcast_addr);
    uv_udp_bind(&send_socket, (const struct sockaddr *)&broadcast_addr, UV_UDP_REUSEADDR);
    uv_udp_set_broadcast(&send_socket, 1);

    uv_udp_recv_start(&send_socket, alloc_buffer, on_read); //слушаем ответ

    uv_tcp_init(loop, &command_socket);
    //uv_connect_t* connect = (uv_connect_t*)malloc(sizeof(uv_connect_t));
    struct sockaddr_in dest;
    uv_ip4_addr("5.189.11.250", 7007, &dest);

    uv_tcp_connect(&command_connect, &command_socket, (const struct sockaddr*)&dest, on_connect);

    //uv_timer_init(loop, &heartbeat_timer);
    //uv_timer_start(&heartbeat_timer, on_heartbeat, 2000, 2000); //через 0 секунд каждые 2 секунды


    on_heartbeat();

    return uv_run(loop, UV_RUN_DEFAULT);
}
