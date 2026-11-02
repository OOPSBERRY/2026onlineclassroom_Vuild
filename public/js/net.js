// 서버가 없으면(정적 호스팅 등) 조용히 혼자 모드로 동작한다.
export class Net {
  constructor(room, handlers) {
    this.room = room;
    this.handlers = handlers;
    this.socket = null;
    this.closed = false;
    this.connected = false;
    this.retry = 1000;
  }

  connect(hello) {
    this.hello = hello;
    if (this.closed) return;
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    let socket;
    try {
      socket = new WebSocket(`${scheme}://${location.host}/ws?room=${this.room}`);
    } catch {
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.connected = true;
      this.retry = 1000;
      this.send({ t: 'hello', ...this.hello() });
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handlers[msg.t]?.(msg);
    };
    socket.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      if (this.closed) return;
      if (wasConnected) this.handlers.lost?.();
      if (!this.full) {
        setTimeout(() => this.connect(hello), this.retry);
        this.retry = Math.min(this.retry * 2, 20000);
      }
    };
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  close() {
    this.closed = true;
    this.socket?.close();
  }
}
