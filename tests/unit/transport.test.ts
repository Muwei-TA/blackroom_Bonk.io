import { it, expect, vi } from "vitest";
import { WebSocket } from "ws";
import { sendBounded } from "../../src/server/app";
it("terminates a peer with over 1 MiB unsent data without adding messages", () => {
  const terminate = vi.fn(),
    send = vi.fn();
  const transport = {
    readyState: WebSocket.OPEN,
    bufferedAmount: 1048577,
    terminate,
    send,
  };
  sendBounded(transport as unknown as WebSocket, { type: "left" });
  expect(terminate).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});
it("does not send to closed peers", () => {
  const send = vi.fn();
  sendBounded({ readyState: WebSocket.CLOSED, send } as unknown as WebSocket, {
    type: "left",
  });
  expect(send).not.toHaveBeenCalled();
});
