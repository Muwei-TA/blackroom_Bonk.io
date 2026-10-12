import type { ClientMessage, ServerMessage } from "../shared/protocol";
export function connect(
  onMessage: (m: ServerMessage) => void,
  onClose: () => void,
) {
  const ws = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
  );
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      ws.close();
    }
  };
  ws.onclose = onClose;
  return {
    send(m: ClientMessage) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    },
    close() {
      ws.close();
    },
  };
}
