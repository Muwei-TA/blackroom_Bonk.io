import { MAPS, type MapDefinition, type Platform } from "../../shared/maps";
import {
  MAX_MAP_BYTES,
  toDocument,
  toDefinition,
  validateDocument,
  parseMapFile,
  type MapDocument,
} from "../../shared/custom-map";
import { PhysicsWorld } from "../../shared/physics";
import { STEP_MS } from "../../shared/constants";
import { neutralInput } from "../../shared/protocol";
import { bindInput } from "../input";
import { EditorModel } from "./model";
import { MapLibrary, type MapEntry } from "./library";
import { bindEditorCanvas, drawEditor } from "./canvas";
import { workshopView } from "./view";
import "./workshop.css";
type Options = {
  initial: MapDefinition;
  canApply: () => boolean;
  apply: (document: MapDocument) => void;
  close: () => void;
};
export function openWorkshop(parent: HTMLElement, options: Options) {
  const container = document.createElement("div");
  container.innerHTML = workshopView();
  parent.append(container);
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    container.querySelector<T>("#" + id)!;
  const button = (action: string) =>
    container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const model = new EditorModel(toDocument(options.initial));
  model.draft.map.name = options.initial.id.startsWith("custom-")
    ? options.initial.name
    : options.initial.name + " · 我的版本";
  model.markSaved();
  const library = new MapLibrary({
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
  });
  let entry: MapEntry | undefined,
    entries: MapEntry[] = [],
    pendingAction: (() => void) | null = null,
    confirmAction: (() => void | Promise<void>) | null = null;
  let trial: PhysicsWorld | null = null,
    input = neutralInput(),
    accumulator = 0,
    last = performance.now(),
    raf = 0,
    disposed = false,
    busy = false,
    pendingApply = false;
  let removeCanvas: () => void = () => {},
    applyTimeout: ReturnType<typeof setTimeout> | undefined;
  const canvas = el<HTMLCanvasElement>("editor-canvas");
  const notify = (text: string) => (el("workshop-message").textContent = text);
  const guarded = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  function refreshLibrary() {
    try {
      const state = library.read();
      entries = state.entries;
      const select = el<HTMLSelectElement>("editor-library");
      select.replaceChildren(new Option("选择本地地图…", ""));
      for (const e of entries)
        select.add(new Option(e.document.map.name, e.id));
      select.value = entry?.id ?? "";
      el("library-note").textContent = state.corrupt
        ? "地图库无法读取。原始数据仍在，请先备份。"
        : `${entries.length} / 20 张本地地图${state.invalidCount ? ` · ${state.invalidCount} 条损坏记录已保留` : ""}`;
      el("library-recovery").hidden = !state.corrupt;
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function checked() {
    return validateDocument(model.draft);
  }
  async function save(asNew = false) {
    if (busy) return false;
    setBusy(true);
    try {
      const stored = await library.save(checked(), asNew ? undefined : entry);
      entry = stored;
      model.draft = structuredClone(stored.document);
      model.markSaved();
      refreshLibrary();
      refresh();
      notify("已保存到当前浏览器，建议导出备份。");
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function setBusy(value: boolean) {
    busy = value;
    container.inert = value;
    if (value) notify("正在保存地图库…");
    if (value) {
      removeCanvas();
      removeCanvas = () => {};
    } else if (!disposed && !trial) {
      removeCanvas = bindEditorCanvas(
        canvas,
        model,
        refresh,
        () => el<HTMLInputElement>("editor-snap").checked,
      );
    }
  }
  async function mutateLibrary(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
    } finally {
      setBusy(false);
    }
  }
  function request(action: () => void) {
    if (busy) {
      notify("正在保存，请稍后重试此操作。");
      return;
    }
    if (trial) stopTrial();
    if (!model.dirty) {
      action();
      return;
    }
    pendingAction = action;
    el<HTMLDialogElement>("unsaved-dialog").showModal();
  }
  function confirm(message: string, action: () => void | Promise<void>) {
    confirmAction = action;
    el("confirm-message").textContent = message;
    el<HTMLDialogElement>("confirm-dialog").showModal();
  }
  function download(text: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function refresh() {
    if (disposed) return;
    const selection = model.selection;
    const p = selection
      ? selection.kind === "platform"
        ? model.draft.map.platforms[selection.index]
        : model.draft.map.spawns[selection.index]
      : null;
    for (const [id, value] of [
      ["editor-name", model.draft.map.name],
      ["editor-subtitle", model.draft.map.subtitle],
    ]) {
      const field = el<HTMLInputElement>(id);
      if (document.activeElement !== field) field.value = value;
    }
    el("editor-count").textContent =
      `${model.draft.map.platforms.length} / 64 平台`;
    el("editor-selection").textContent = selection
      ? `${selection.kind === "platform" ? "平台" : "出生点"} ${selection.index + 1}`
      : "点击平台或出生点进行编辑";
    el("object-properties").hidden = !p;
    el("no-selection").hidden = !!p;
    el("platform-properties").hidden = selection?.kind !== "platform";
    if (p)
      for (const field of container.querySelectorAll<HTMLInputElement>(
        "[data-property]",
      )) {
        const key = field.dataset.property! as Exclude<keyof Platform, "motion">;
        const value = (p as Platform)[key];
        if (value !== undefined && document.activeElement !== field)
          field.value = String(
            Math.round(
              (key === "angle" ? (value * 180) / Math.PI : value) * 100,
            ) / 100,
          );
      }
    let valid = true;
    try {
      checked();
      el("map-validation").textContent = "✓ 校验通过 · 可以保存、分享或应用";
      el("map-validation").className = "validation valid";
    } catch (e) {
      valid = false;
      el("map-validation").textContent = (e as Error).message;
      el("map-validation").className = "validation invalid";
    }
    el("save-status").textContent = model.dirty
      ? "未保存修改"
      : entry
        ? "已保存"
        : "新地图";
    button("undo").disabled = !model.canUndo || !!trial;
    button("redo").disabled = !model.canRedo || !!trial;
    button("add").disabled = model.draft.map.platforms.length >= 64 || !!trial;
    button("duplicate").disabled =
      selection?.kind !== "platform" ||
      model.draft.map.platforms.length >= 64 ||
      !!trial;
    button("delete").disabled = selection?.kind !== "platform" || !!trial;
    for (const action of ["save", "saveAs", "export"])
      button(action).disabled = !valid || !!trial;
    button("apply").disabled =
      !valid || !options.canApply() || pendingApply || !!trial;
    button("apply").title = options.canApply()
      ? "同步给当前房间所有玩家"
      : "仅房主可在准备阶段应用地图";
    button("trial").hidden = !!trial;
    button("trial").disabled = !valid;
    button("resetTrial").hidden = !trial;
    button("stopTrial").hidden = !trial;
    for (const field of container.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("input:not([type=file]),select"))
      field.disabled = !!trial;
    for (const action of [
      "new",
      "import",
      "deleteSaved",
      "backup",
      "resetLibrary",
    ])
      button(action).disabled = !!trial;
  }
  function startTrial() {
    guarded(() => {
      trial?.dispose();
      trial = new PhysicsWorld(toDefinition(checked(), "trial"), ["trial"]);
      input = neutralInput();
      accumulator = 0;
      last = performance.now();
      removeCanvas();
      removeCanvas = () => {};
      canvas.focus();
      refresh();
    });
  }
  function stopTrial() {
    if (!trial) return;
    trial.dispose();
    trial = null;
    input = neutralInput();
    removeCanvas = bindEditorCanvas(
      canvas,
      model,
      refresh,
      () => el<HTMLInputElement>("editor-snap").checked,
    );
    el("trial-status").textContent = "从出生点 1 开始，检查落脚与跳跃。";
    refresh();
  }
  function load(document: MapDocument, saved?: MapEntry) {
    entry = saved;
    model.load(document);
    refreshLibrary();
    refresh();
    notify(saved ? "已加载本地地图" : "已加载为新副本，保存后加入地图库。");
  }
  function removePlatform() {
    const s = model.selection;
    if (s?.kind !== "platform") return;
    model.edit((d) => d.map.platforms.splice(s.index, 1));
    model.selection = null;
    refresh();
  }
  const actions: Record<string, () => void> = {
    close: () =>
      request(() => {
        dispose();
        options.close();
      }),
    new: () =>
      request(() => {
        const d = toDocument(MAPS[0]);
        d.map.name = "我的新地图";
        load(d);
      }),
    undo: () => {
      model.undo();
      refresh();
    },
    redo: () => {
      model.redo();
      refresh();
    },
    add: () => {
      model.edit((d) =>
        d.map.platforms.push({
          x: 600,
          y: 300,
          width: 180,
          height: 26,
          angle: 0,
        }),
      );
      model.selection = {
        kind: "platform",
        index: model.draft.map.platforms.length - 1,
      };
      refresh();
    },
    duplicate: () => {
      const s = model.selection;
      if (s?.kind !== "platform") return;
      model.edit((d) => {
        const p = d.map.platforms[s.index];
        d.map.platforms.push({ ...p, x: p.x + 30, y: p.y + 30 });
      });
      model.selection = {
        kind: "platform",
        index: model.draft.map.platforms.length - 1,
      };
      refresh();
    },
    delete: removePlatform,
    save: () => {
      save();
    },
    saveAs: () => {
      save(true);
    },
    export: () =>
      guarded(() =>
        download(JSON.stringify(checked(), null, 2), "blackroom-map.json"),
      ),
    import: () => el<HTMLInputElement>("map-import").click(),
    apply: () =>
      guarded(() => {
        pendingApply = true;
        refresh();
        notify("正在提交地图，等待房间确认…");
        options.apply(checked());
        applyTimeout = setTimeout(() => {
          pendingApply = false;
          refresh();
          notify("尚未收到房间确认，请检查连接后重试。");
        }, 7000);
      }),
    trial: startTrial,
    resetTrial: startTrial,
    stopTrial,
    deleteSaved: () => {
      if (!entry) {
        notify("请先选择一张已保存地图");
        return;
      }
      const selected = entry;
      confirm(
        `删除「${selected.document.map.name}」的本地存档？当前编辑内容会保留。`,
        () =>
          guarded(() =>
            mutateLibrary(async () => {
              await library.remove(selected);
              entry = undefined;
              refreshLibrary();
              refresh();
              notify("本地存档已删除，编辑内容仍在。");
            }),
          ),
      );
    },
    backup: () =>
      guarded(() => download(library.raw(), "blackroom-library-backup.json")),
    resetLibrary: () =>
      confirm("重置会清除原地图库。请先导出原始备份。", () =>
        guarded(() =>
          mutateLibrary(async () => {
            await library.reset();
            entry = undefined;
            refreshLibrary();
            refresh();
            notify("地图库已重置");
          }),
        ),
      ),
    keepEditing: () => {
      pendingAction = null;
      el<HTMLDialogElement>("unsaved-dialog").close();
    },
    discard: () => {
      el<HTMLDialogElement>("unsaved-dialog").close();
      const action = pendingAction;
      pendingAction = null;
      action?.();
    },
    saveAndLeave: async () => {
      if (await save()) {
        el<HTMLDialogElement>("unsaved-dialog").close();
        const action = pendingAction;
        pendingAction = null;
        action?.();
      }
    },
    cancelConfirm: () => {
      confirmAction = null;
      el<HTMLDialogElement>("confirm-dialog").close();
    },
    confirm: () => {
      el<HTMLDialogElement>("confirm-dialog").close();
      const action = confirmAction;
      confirmAction = null;
      action?.();
    },
  };
  for (const b of container.querySelectorAll<HTMLButtonElement>(
    "[data-action]",
  ))
    b.onclick = () => actions[b.dataset.action!]?.();
  for (const map of MAPS)
    el<HTMLSelectElement>("editor-template").add(new Option(map.name, map.id));
  el<HTMLSelectElement>("editor-template").onchange = (e) => {
    const select = e.target as HTMLSelectElement;
    const template = MAPS.find((m) => m.id === select.value);
    select.value = "";
    if (template)
      request(() => {
        const d = toDocument(template);
        d.map.name += " · 我的版本";
        load(d);
      });
  };
  el<HTMLSelectElement>("editor-library").onchange = (e) => {
    const select = e.target as HTMLSelectElement,
      saved = entries.find((x) => x.id === select.value);
    select.value = entry?.id ?? "";
    if (saved) request(() => load(saved.document, saved));
  };
  for (const [id, key] of [
    ["editor-name", "name"],
    ["editor-subtitle", "subtitle"],
  ] as const) {
    el<HTMLInputElement>(id).oninput = (e) => {
      model.edit((d) => (d.map[key] = (e.target as HTMLInputElement).value));
      refresh();
    };
  }
  for (const field of container.querySelectorAll<HTMLInputElement>(
    "[data-property]",
  ))
    field.onchange = () => {
      const s = model.selection;
      if (!s) return;
      const value = field.valueAsNumber;
      if (!Number.isFinite(value)) {
        notify("请输入有效数字");
        field.value = "";
        refresh();
        return;
      }
      const key = field.dataset.property! as Exclude<keyof Platform, "motion">;
      model.edit((d) => {
        const target =
          s.kind === "platform"
            ? d.map.platforms[s.index]
            : d.map.spawns[s.index];
        (target as Platform)[key] =
          key === "angle" ? (value * Math.PI) / 180 : value;
      });
      refresh();
    };
  el<HTMLInputElement>("map-import").onchange = async () => {
    const field = el<HTMLInputElement>("map-import"),
      file = field.files?.[0];
    field.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_MAP_BYTES) throw Error("地图文件超过 32 KiB");
      const d = parseMapFile(await file.text());
      if (!disposed) request(() => load(d));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const keyboard = (e: KeyboardEvent) => {
    if (
      busy ||
      trial ||
      container.querySelector("dialog[open]") ||
      (e.target as HTMLElement).closest?.("input,select,textarea,button")
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
      e.preventDefault();
      e.shiftKey ? model.redo() : model.undo();
      refresh();
      return;
    }
    if (e.code === "Delete" || e.code === "Backspace") {
      e.preventDefault();
      removePlatform();
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const v = delta[e.code],
      s = model.selection;
    if (!v || !s) return;
    e.preventDefault();
    model.edit((d) => {
      const p =
        s.kind === "platform"
          ? d.map.platforms[s.index]
          : d.map.spawns[s.index];
      p.x += v[0] * (e.shiftKey ? 10 : 1);
      p.y += v[1] * (e.shiftKey ? 10 : 1);
    });
    refresh();
  };
  const unload = (e: BeforeUnloadEvent) => {
    if (model.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  const storageChanged = () => {
    refreshLibrary();
    notify("本地地图库已在其他窗口更新；保存时将检查冲突。");
  };
  window.addEventListener("keydown", keyboard);
  window.addEventListener("beforeunload", unload);
  window.addEventListener("storage", storageChanged);
  const unbindInput = bindInput(
    window,
    (s) => (input = s),
    () => !!trial && !container.querySelector("dialog[open]"),
  );
  removeCanvas = bindEditorCanvas(
    canvas,
    model,
    refresh,
    () => el<HTMLInputElement>("editor-snap").checked,
  );
  function frame(now: number) {
    if (disposed) return;
    if (trial) {
      accumulator += Math.min(100, now - last);
      while (accumulator >= STEP_MS) {
        trial.setInput("trial", input);
        trial.step();
        accumulator -= STEP_MS;
      }
      const alive = trial.snapshot()[0]?.alive;
      el("trial-status").textContent = alive
        ? "试跑中 · A/D 移动，W 跳跃，空格加重"
        : "已掉出场地 · 点击重置再试一次";
    }
    last = now;
    drawEditor(canvas, model, trial?.snapshot());
    raf = requestAnimationFrame(frame);
  }
  function dispose() {
    if (disposed) return;
    removeCanvas();
    disposed = true;
    trial?.dispose();
    unbindInput();
    cancelAnimationFrame(raf);
    clearTimeout(applyTimeout);
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("beforeunload", unload);
    window.removeEventListener("storage", storageChanged);
    container.remove();
  }
  refreshLibrary();
  refresh();
  raf = requestAnimationFrame(frame);
  canvas.focus();
  return {
    dispose,
    refresh,
    applied() {
      clearTimeout(applyTimeout);
      pendingApply = false;
      refresh();
      notify("已同步到房间，所有玩家都可以看到这张地图。");
    },
    failed(message: string) {
      clearTimeout(applyTimeout);
      pendingApply = false;
      refresh();
      notify(message);
    },
  };
}
