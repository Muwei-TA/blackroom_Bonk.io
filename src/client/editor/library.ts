import {
  withLibraryLock,
  type Exclusive,
  type LibraryTransaction,
} from "./storage-lock";
import { validateDocument, type MapDocument } from "../../shared/custom-map";
export const LIBRARY_KEY = "blackroom.maps.v1";
export type MapEntry = {
  id: string;
  revision: string;
  updatedAt: string;
  document: MapDocument;
};
type Store = Pick<Storage, "getItem" | "setItem">;
// getRandomValues is available on HTTP LAN origins as well as HTTPS.
const createId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export class MapLibrary {
  constructor(
    private storage: Store,
    private exclusive: Exclusive = withLibraryLock,
  ) {}
  raw() {
    try {
      return this.storage.getItem(LIBRARY_KEY) ?? "";
    } catch {
      throw Error("无法读取本地地图，请检查浏览器存储权限");
    }
  }
  read(raw = this.raw()) {
    let entries: unknown[] = [];
    try {
      if (raw) {
        const value = JSON.parse(raw);
        if (value.version !== 1 || !Array.isArray(value.entries)) throw Error();
        entries = value.entries;
      }
    } catch {
      return {
        entries: [] as MapEntry[],
        invalidCount: 0,
        corrupt: true,
        raw,
        rawEntries: [] as unknown[],
      };
    }
    const valid: MapEntry[] = [];
    const ids = new Set<string>();
    for (const value of entries) {
      try {
        const e = value as MapEntry;
        if (
          !e ||
          typeof e.id !== "string" ||
          typeof e.revision !== "string" ||
          typeof e.updatedAt !== "string" ||
          ids.has(e.id)
        )
          throw Error();
        valid.push({
          id: e.id,
          revision: e.revision,
          updatedAt: e.updatedAt,
          document: validateDocument(e.document),
        });
        ids.add(e.id);
      } catch {}
    }
    return {
      entries: valid,
      invalidCount: entries.length - valid.length,
      corrupt: false,
      raw,
      rawEntries: entries,
    };
  }
  private write(entries: unknown[], transaction?: LibraryTransaction) {
    try {
      const raw = JSON.stringify({ version: 1, entries });
      this.storage.setItem(LIBRARY_KEY, raw);
      transaction?.publish(raw);
    } catch {
      throw Error("保存失败：浏览器存储不可用或空间不足，请导出备份");
    }
  }
  save(document: MapDocument, previous?: MapEntry): Promise<MapEntry> {
    return this.exclusive((tx) => this.saveLocked(document, previous, tx));
  }
  private saveLocked(
    document: MapDocument,
    previous?: MapEntry,
    transaction?: LibraryTransaction,
  ): MapEntry {
    const d = validateDocument(document),
      state = this.read(transaction?.latest);
    if (this.read().corrupt || state.corrupt)
      throw Error("地图库损坏，请先备份并显式重置");
    if (previous) {
      const latest = state.entries.find((e) => e.id === previous.id);
      if (!latest || latest.revision !== previous.revision)
        throw Error("保存冲突：此地图已在其他窗口修改或删除，请另存为");
    } else if (state.entries.length >= 20)
      throw Error("本地地图最多 20 张，请删除旧地图后再保存");
    const entry: MapEntry = {
      id: previous?.id ?? createId(),
      revision: createId(),
      updatedAt: new Date().toISOString(),
      document: d,
    };
    const entries = state.rawEntries.filter(
      (e) => !previous || (e as MapEntry)?.id !== previous.id,
    );
    this.write([...entries, entry], transaction);
    return entry;
  }
  remove(entry: MapEntry) {
    return this.exclusive((tx) => this.removeLocked(entry, tx));
  }
  private removeLocked(entry: MapEntry, transaction?: LibraryTransaction) {
    const state = this.read(transaction?.latest);
    if (this.read().corrupt || state.corrupt)
      throw Error("地图库损坏，请先备份");
    const latest = state.entries.find((e) => e.id === entry.id);
    if (!latest || latest.revision !== entry.revision)
      throw Error("删除冲突：请刷新地图库");
    this.write(
      state.rawEntries.filter((e) => (e as MapEntry)?.id !== entry.id),
      transaction,
    );
  }
  reset() {
    return this.exclusive((tx) => this.write([], tx));
  }
}
