// IndexedDB readwrite transactions serialize across tabs, including HTTP LAN
// origins where Web Locks is unavailable. Map contents remain in localStorage.
export type Exclusive = <T>(operation: () => T) => Promise<T>;
export const withLibraryLock: Exclusive = (operation) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("blackroom-map-locks", 1);
    let settled = false;
    const fail = (error?: unknown) => {
      settled = true;
      reject(
        error ?? Error("无法安全访问地图库，请检查浏览器存储权限并导出备份"),
      );
    };
    request.onupgradeneeded = () =>
      request.result.createObjectStore("mutations");
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
      tx.objectStore("mutations").get("library").onsuccess = () => {
        try {
          result = operation();
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
