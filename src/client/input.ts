import { type InputState } from "../shared/protocol";
export function bindInput(
  target: Window,
  onInput: (s: InputState) => void,
): () => void {
  const keys = new Set<string>();
  const allowed = [
    "KeyA",
    "KeyD",
    "KeyW",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "Space",
  ];
  const emit = () =>
    onInput({
      left: keys.has("KeyA") || keys.has("ArrowLeft"),
      right: keys.has("KeyD") || keys.has("ArrowRight"),
      jump: keys.has("KeyW") || keys.has("ArrowUp"),
      heavy: keys.has("Space"),
    });
  const down = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement)?.closest?.(
        'input,textarea,select,[contenteditable="true"]',
      )
    )
      return;
    if (allowed.includes(e.code)) {
      e.preventDefault();
      if (keys.has(e.code)) return;
      keys.add(e.code);
      emit();
    }
  };
  const up = (e: KeyboardEvent) => {
    if (allowed.includes(e.code)) {
      keys.delete(e.code);
      emit();
    }
  };
  const clear = () => {
    keys.clear();
    emit();
  };
  const visibility = () => {
    if (target.document.hidden) clear();
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", clear);
  target.document.addEventListener("visibilitychange", visibility);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", clear);
    target.document.removeEventListener("visibilitychange", visibility);
    clear();
  };
}
