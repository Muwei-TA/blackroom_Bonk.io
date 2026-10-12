import "./style.css";
import { connect } from "./network";
import { mountUi } from "./ui";
import { bindInput } from "./input";
import { neutralInput } from "../shared/protocol";
let input = neutralInput(),
  seq = 0;
const ui = mountUi(document.querySelector("#app")!, (m) => network.send(m));
const network = connect(
  (m) => ui.update(m),
  () => ui.disconnected(),
);
const unbind = bindInput(window, (s) => {
  input = s;
  if (ui.isPlaying()) network.send({ type: "input", seq: ++seq, state: input });
});
const interval = setInterval(() => {
  if (ui.isPlaying()) network.send({ type: "input", seq: ++seq, state: input });
}, 1000 / 30);
window.addEventListener("pagehide", () => {
  clearInterval(interval);
  unbind();
  ui.dispose();
  network.close();
});
