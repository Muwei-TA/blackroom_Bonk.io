// IndexedDB readwrite transactions serialize across tabs, including HTTP LAN
// origins where Web Locks is unavailable. The latest committed library also
// lives in this transaction, since localStorage caches may lag across tabs.
export type LibraryTransaction = {
  latest?: string;
  publish: (raw: string) => void;
};
export type Exclusive = <T>(
  operation: (transaction?: LibraryTransaction) => T,
) => Promise<T>;
export const withLibraryLock: Exclusive = (operation) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("blackroom-map-locks", 2);
    let settled = false;
    const fail = (error?: unknown) => {
      settled = true;
      reject(
        error ?? Error("无法安全访问地图库，请检查浏览器存储权限并导出备份"),
      );
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("mutations"))
        request.result.createObjectStore("mutations");
    };
    request.onerror = () => fail();
    request.onblocked = () => fail();
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      const tx = db.transaction("mutations", "readwrite");
      let result: ReturnType<typeof operation>;
      let failure: unknown;
      const store = tx.objectStore("mutations");
      const read = store.get("library");
      read.onsuccess = () => {
        try {
          result = operation({
            latest: read.result,
            publish: (raw) => {
              store.put(raw, "library");
            },
          });
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        fail(failure);
      };
      tx.onerror = () => {
        /* onabort reports the failure. */
      };
    };
  });
