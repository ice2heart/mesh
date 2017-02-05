#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <uv.h>

uv_loop_t *loop;
uv_idle_t idler;
uv_udp_t send_socket;
uv_udp_t recv_socket;
uv_timer_t heartbeat_timer;

uv_tcp_t command_socket;
uv_connect_t command_connect;

uv_udp_send_t send_req;
uv_write_t request;

int is_ready;


uint16_t our_id;

uint16_t ids[10];
uint8_t id_count;

uint16_t port = 0;
uint8_t ip1 = 0;
uint8_t ip2 = 0;
uint8_t ip3 = 0;
uint8_t ip4 = 0;

uint16_t sport = 0;
uint8_t sip1 = 0;
uint8_t sip2 = 0;
uint8_t sip3 = 0;
uint8_t sip4 = 0;



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

void set8(const uv_buf_t *buf, uint8_t data, int shift) {
  buf->base[shift] = data;
}

void set16BE(const uv_buf_t *buf, uint16_t data, int shift) {
  buf->base[shift] = (0xFF00 & data) >> 8;
  buf->base[shift+1] = (0xFF & data);
  //printf("%x %x %x\n", (uint16_t)data,  (0xFF00 & data) >> 8, (uint8_t) (0xFF & data));
}

void printBuff(const char *data, uint16_t size){
  printf("Buffer: ");
  for (size_t i = 0; i < size; i++) {
    printf("%x ", (uint8_t)data[i]);
  }
  printf("\n");
}

void on_read(uv_udp_t *req, ssize_t nread, const uv_buf_t *buf, const struct sockaddr *addr, unsigned flags) {
    //printf("%s data size %lu\n", __FUNCTION__, nread);
    if (nread == 0) {
      return;
    }
    if (nread < 0) {
        fprintf(stderr, "Read udp error %s\n", uv_err_name(nread));
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
    //printf("Send done status %d\n", status );
    if (status) {
        fprintf(stderr, "Send error %s\n", uv_strerror(status));
        return;
    }
}

void stun_request() {
  uv_buf_t discover_msg = make_discover_msg();
  struct sockaddr_in send_addr;
  uv_ip4_addr("216.93.246.18", 3478, &send_addr);
  //uv_ip4_addr("173.194.72.127", 19302, &send_addr);
  //uv_ip4_addr("91.213.144.172", 19302, &send_addr); //turn.sbis.ru
  uv_udp_send(&send_req, &send_socket, &discover_msg, 1, (const struct sockaddr *)&send_addr, on_send);
}

void on_close(uv_handle_t* handle)
{
  printf("closed\n");
}

void on_write(uv_write_t* req, int status)
{
  //printf("Send done status %d\n", status );
  if (status) {
    fprintf(stderr, "On write error %d %s\n", status, uv_err_name(status));
		return;
  }
}

void on_heartbeat() {
  uv_buf_t buffer;

  alloc_buffer(NULL, 5, &buffer);
  buffer.base[0] = 'p';
  buffer.base[1] = 'i';
  buffer.base[2] = 'n';
  buffer.base[3] = 'g';
  buffer.base[4] = '\0';
  struct sockaddr_in send_addr;
  char tmp[15];
  sprintf(tmp, "%d.%d.%d.%d", sip1, sip2, sip3, sip4);

  uv_ip4_addr(tmp, sport, &send_addr);

  uv_udp_send(&send_req, &send_socket, &buffer, 1, (const struct sockaddr *)&send_addr, on_send);
}

void on_read_tcp(uv_stream_t* tcp, ssize_t nread, const uv_buf_t *buf)
{
	if(nread < 0) {
    uv_close((uv_handle_t*)tcp, on_close);
    free(buf->base);
	}
  printf("%s read data %lu\n", __FUNCTION__, nread);

  uint8_t message = get8(buf, 0);

  switch (message) {
    case 2:{
      printf("2");
      printBuff(buf->base, nread);
      sip1 = get8(buf, 1);
      sip2 = get8(buf, 2);
      sip3 = get8(buf, 3);
      sip4 = get8(buf, 4);
      sport = get16BE(buf, 5);
      printf("Get ip addr %d.%d.%d.%d:%d\n", sip1, sip2, sip3, sip4, sport);
      uv_timer_init(loop, &heartbeat_timer);
      uv_timer_start(&heartbeat_timer, on_heartbeat, 1000, 1000); //через 0 секунд каждые 2 секунды
    }
    break;
    case 3:{
      id_count = (nread-1) / 3;
      printf("List of users, count %d\n",  id_count);
      for (int i = 0; i < id_count; i++){
        uint16_t id = get16BE(buf, 2 + (i*3));
        printf("Ids %x\n", id);
        ids[i] = id;
      }
    }
    break;
    default:
    break;
  }

	free(buf->base);
}

void on_connect(uv_connect_t* connection, int status) {
  if (status) {
    fprintf(stderr, "Read error %s\n", uv_err_name(status));
    exit(1);
  }
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

void wait_two_id(uv_idle_t* handle) {
    if (id_count > 1 && state == 1){
      printf("Yay! Our is 2\n");
      for (int i = 0; i<id_count; i++){
        if (ids[i] != our_id){
          uv_buf_t buffer;

          alloc_buffer(NULL, 10, &buffer);
          set8(&buffer, 0x02, 0);
          set16BE(&buffer, ids[i], 1);
          set8(&buffer, 0x02, 3);
          //ip
          set8(&buffer, ip1, 4);
          set8(&buffer, ip2, 5);
          set8(&buffer, ip3, 6);
          set8(&buffer, ip4, 7);
          //port
          set16BE(&buffer, port, 8);
          //char tmp[] = "test";
          //memcpy(buffer.base + 3, tmp , sizeof(tmp));
          //printf("Ids i = %x\n", ids[i]);
          printBuff(buffer.base, 11);

          uv_write(&request, command_connect.handle, &buffer, 1, on_write);
        }
      }
      uv_idle_stop(handle);
    }

}

int main(int argc, char* argv[]) {
    if (argc < 2 ){
      printf("Use ./hello 5.189.11.250\n");
      //return(-1);

    }
    srand(time(NULL));
    state = 0;
    is_ready = 0;
    loop = uv_default_loop();

    uv_udp_init(loop, &send_socket);
    struct sockaddr_in broadcast_addr;
    uv_ip4_addr("0.0.0.0", 0, &broadcast_addr);
    uv_udp_bind(&send_socket, (const struct sockaddr *)&broadcast_addr, UV_UDP_REUSEADDR);
    uv_udp_set_broadcast(&send_socket, 1);

    uv_udp_recv_start(&send_socket, alloc_buffer, on_read); //слушаем ответ

    uv_tcp_init(loop, &command_socket);
    struct sockaddr_in dest;

    if (argc < 2 ){
        uv_ip4_addr("192.168.88.102", 7007, &dest);
    } else {
        uv_ip4_addr(argv[1], 7007, &dest);
    }

    uv_tcp_connect(&command_connect, &command_socket, (const struct sockaddr*)&dest, on_connect);

    uv_idle_init(uv_default_loop(), &idler);
    uv_idle_start(&idler, wait_two_id);


    stun_request();
    return uv_run(loop, UV_RUN_DEFAULT);
}
