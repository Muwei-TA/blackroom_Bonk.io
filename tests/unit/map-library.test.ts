import { it, expect, vi } from "vitest";
import { MapLibrary, LIBRARY_KEY } from "../../src/client/editor/library";
import { toDocument } from "../../src/shared/custom-map";
import { MAPS } from "../../src/shared/maps";
class Memory {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
const doc = () => toDocument(MAPS[0]);
it("saves/reloads separate copies and checks conflicts before overwrite", () => {
  const s = new Memory(),
    lib = new MapLibrary(s);
  const a = lib.save(doc());
  const b = lib.save(doc());
  expect(a.id).not.toBe(b.id);
  expect(new MapLibrary(s).read().entries).toHaveLength(2);
  const newer = lib.save(
    { ...doc(), map: { ...doc().map, name: "changed" } },
    a,
  );
  expect(() => lib.save(doc(), a)).toThrow(/冲突/);
  expect(lib.read().entries.find((e) => e.id === a.id)?.revision).toBe(
    newer.revision,
  );
  lib.remove(b);
  expect(lib.read().entries).toHaveLength(1);
});
it("protects corrupt raw library, skips damaged entries, enforces 20 maps", () => {
  const s = new Memory(),
    lib = new MapLibrary(s);
  s.setItem(LIBRARY_KEY, "broken");
  expect(lib.read().corrupt).toBe(true);
  expect(() => lib.save(doc())).toThrow();
  expect(s.getItem(LIBRARY_KEY)).toBe("broken");
  lib.reset();
  for (let i = 0; i < 20; i++) lib.save(doc());
  expect(() => lib.save(doc())).toThrow(/20/);
  const raw = JSON.parse(s.getItem(LIBRARY_KEY)!);
  raw.entries.push({ bad: true });
  s.setItem(LIBRARY_KEY, JSON.stringify(raw));
  expect(lib.read().entries).toHaveLength(20);
  expect(lib.read().invalidCount).toBe(1);
});
it("surfaces storage quota failure without pretending a map was saved", () => {
  const lib = new MapLibrary({
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  });
  expect(() => lib.save(doc())).toThrow(/保存/);
});

it("saves on HTTP LAN deployments without secure-context randomUUID", () => {
  const original = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: original.getRandomValues.bind(original),
  });
  try {
    const lib = new MapLibrary(new Memory());
    const a = lib.save(doc()),
      b = lib.save(doc());
    expect(a.id).not.toBe(b.id);
    expect(lib.read().entries).toHaveLength(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
