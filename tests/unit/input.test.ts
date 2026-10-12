// @vitest-environment jsdom
import { it, expect } from "vitest";
import { bindInput } from "../../src/client/input";
import type { InputState } from "../../src/shared/protocol";
it("maps movement, jump and heavy; ignores S; clears on blur and hidden", () => {
  let state: InputState | undefined;
  const stop = bindInput(window, (s) => (state = s));
  const key = (type: string, code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }));
  key("keydown", "KeyW");
  expect(state!.jump).toBe(true);
  key("keyup", "KeyW");
  key("keydown", "ArrowUp");
  expect(state!.jump).toBe(true);
  key("keydown", "Space");
  expect(state!.heavy).toBe(true);
  window.dispatchEvent(new Event("blur"));
  expect(Object.values(state!).every((v) => !v)).toBe(true);
  key("keydown", "KeyS");
  expect(Object.values(state!).every((v) => !v)).toBe(true);
  key("keydown", "KeyD");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(state!.right).toBe(false);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  stop();
});
it("does not hijack nickname input and supports equivalent keys simultaneously", () => {
  let state: InputState | undefined;
  const stop = bindInput(window, (s) => (state = s));
  const input = document.createElement("input");
  document.body.append(input);
  input.dispatchEvent(
    new KeyboardEvent("keydown", { code: "KeyA", bubbles: true }),
  );
  expect(state).toBeUndefined();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyA" }));
  expect(state!.left).toBe(true);
  input.remove();
  stop();
});
it("allows the editor to own keyboard input without game shortcuts interfering", () => {
  let called = 0;
  const stop = bindInput(
    window,
    () => called++,
    () => false,
  );
  const event = new KeyboardEvent("keydown", {
    code: "ArrowLeft",
    cancelable: true,
  });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(called).toBe(0);
  stop();
});
