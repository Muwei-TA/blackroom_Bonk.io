import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function point(page: any, x: number, y: number) {
  const box = await page.getByTestId("editor-canvas").boundingBox();
  return {
    x: box!.x + (x * box!.width) / 1200,
    y: box!.y + (y * box!.height) / 800,
  };
}
async function drag(page: any, x: number, y: number, toX: number, toY: number) {
  const a = await point(page, x, y),
    b = await point(page, toX, toY);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}
test("visual editing, history, trial, file round-trip and persistent local library", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page.getByRole("button", { name: "新增平台", exact: true }).click();
  await drag(page, 600, 300, 700, 320);
  await expect(page.getByLabel("位置 X", { exact: true })).toHaveValue("700");
  await drag(page, 790, 333, 830, 353);
  await expect(page.getByLabel("宽度", { exact: true })).toHaveValue("260");
  await page.getByLabel("旋转角度", { exact: true }).fill("15");
  await page.getByLabel("旋转角度", { exact: true }).press("Tab");
  await drag(page, 285, 470, 285, 430);
  await expect(page.getByLabel("位置 Y", { exact: true })).toHaveValue("430");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page.getByLabel("地图名称", { exact: true }).fill("我的斜坡工坊");
  await page.getByLabel("地图名称", { exact: true }).press("Tab");
  await expect(page.getByTestId("map-validation")).toContainText("校验通过");
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("已保存");
  await page.screenshot({ path: "artifacts/editor.png", fullPage: true });
  await page.getByRole("button", { name: "试跑", exact: true }).click();
  await expect(page.getByTestId("trial-status")).toContainText("试跑中");
  await page.keyboard.down("KeyA");
  await expect(page.getByTestId("trial-status")).toContainText("掉出场地", {
    timeout: 8000,
  });
  await page.keyboard.up("KeyA");
  await page.getByRole("button", { name: "重置试跑", exact: true }).click();
  await expect(page.getByTestId("trial-status")).toContainText("试跑中");
  await page.getByRole("button", { name: "返回编辑", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出地图", exact: true }).click();
  const download = await downloadPromise;
  const data = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(data).map.name).toBe("我的斜坡工坊");
  await page.reload();
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page
    .getByLabel("我的地图", { exact: true })
    .selectOption({ label: "我的斜坡工坊" });
  await expect(page.getByLabel("地图名称", { exact: true })).toHaveValue(
    "我的斜坡工坊",
  );
  await page.getByTestId("map-import").setInputFiles({
    name: "shared.json",
    mimeType: "application/json",
    buffer: Buffer.from(data),
  });
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await expect(page.getByLabel("我的地图").locator("option")).toHaveCount(3);
  expect(errors).toEqual([]);
});
test("host applies a custom map, guest receives it and both play with scoring", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByLabel("你的昵称").fill("建图者");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await page.getByTestId("room-code").textContent();
  const context = await browser.newContext(),
    friend = await context.newPage();
  await friend.goto("/");
  await friend.getByLabel("你的昵称").fill("试玩者");
  await friend.getByLabel("房间码", { exact: true }).fill(code!);
  await friend.getByRole("button", { name: "加入房间", exact: true }).click();
  await page.getByRole("button", { name: "自定义地图", exact: true }).click();
  await page.getByLabel("地图名称", { exact: true }).fill("好友专属场地");
  await page.getByLabel("地图名称", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await page.getByRole("button", { name: "应用到房间", exact: true }).click();
  await expect(page.getByTestId("workshop-message")).toContainText("已同步");
  await expect(friend.getByTestId("map-name")).toHaveText("好友专属场地");
  await expect(
    friend.getByRole("button", { name: "自定义地图", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "关闭工坊", exact: true }).click();
  await page.getByRole("button", { name: "开始比赛", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("对战进行中", {
    timeout: 8000,
  });
  await page.keyboard.down("KeyA");
  await expect(page.getByTestId("self-status")).toContainText("你已出局", {
    timeout: 8000,
  });
  await page.keyboard.up("KeyA");
  await expect(friend.getByTestId("players")).toContainText("1 分");
  await context.close();
});
test("dirty draft prompts before replacing and corrupt imports leave it intact", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page.getByLabel("地图名称", { exact: true }).fill("未保存作品");
  await page.getByLabel("地图名称", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "关闭工坊", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "未保存的修改" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  await page.getByTestId("map-import").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByTestId("workshop-message")).toContainText("字段");
  await expect(page.getByLabel("地图名称", { exact: true })).toHaveValue(
    "未保存作品",
  );
});

test("disconnected workshop still saves locally and storage errors preserve draft", async ({
  page,
  browser,
}) => {
  let socket: any;
  await page.routeWebSocket("**/ws", (route) => {
    socket = route;
    route.connectToServer();
  });
  await page.goto("/");
  await expect(page.locator("#connection")).toHaveText("已连接");
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page.getByLabel("地图名称", { exact: true }).fill("断线后的作品");
  await socket.close({ code: 1001, reason: "network test" });
  await expect(page.getByTestId("workshop-message")).toContainText("仍可保存");
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("已保存");
  await expect(
    page.getByRole("button", { name: "应用到房间", exact: true }),
  ).toBeDisabled();
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await p.goto("/");
  await p.getByRole("button", { name: "地图工坊", exact: true }).click();
  await p.getByLabel("地图名称", { exact: true }).fill("不能丢失的地图");
  await p.getByRole("button", { name: "保存地图", exact: true }).click();
  await expect(p.getByTestId("workshop-message")).toContainText("保存失败");
  await expect(p.getByTestId("save-status")).toHaveText("未保存修改");
  await expect(p.getByLabel("地图名称", { exact: true })).toHaveValue(
    "不能丢失的地图",
  );
  await c.close();
});

test("library writes wait for the cross-tab transaction lock", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("blackroom-map-locks", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("mutations");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("mutations", "readwrite");
    (window as any).releaseMapLock = false;
    const keepAlive = () => {
      const request = tx.objectStore("mutations").get("library");
      request.onsuccess = () => {
        if (!(window as any).releaseMapLock) keepAlive();
      };
    };
    keepAlive();
    tx.oncomplete = () => db.close();
  });
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => localStorage.getItem("blackroom.maps.v1")),
  ).toBeNull();
  await other.evaluate(() => {
    (window as any).releaseMapLock = true;
  });
  await expect(page.getByTestId("save-status")).toHaveText("已保存");
  await other.close();
});

test("simultaneous tabs preserve both maps and reject stale updates", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  for (const [tab, name] of [
    [page, "窗口 A"],
    [other, "窗口 B"],
  ] as const) {
    await tab.goto("/");
    await tab.getByRole("button", { name: "地图工坊", exact: true }).click();
    await tab.getByLabel("地图名称", { exact: true }).fill(name);
  }
  await Promise.all(
    [page, other].map((tab) =>
      tab.getByRole("button", { name: "保存地图", exact: true }).click(),
    ),
  );
  for (const tab of [page, other])
    await expect(tab.getByTestId("save-status")).toHaveText("已保存");
  const entries = await page.evaluate(
    () => JSON.parse(localStorage.getItem("blackroom.maps.v1")!).entries,
  );
  expect(entries.map((e: any) => e.document.map.name).sort()).toEqual([
    "窗口 A",
    "窗口 B",
  ]);
  const id = entries.find((e: any) => e.document.map.name === "窗口 A").id;
  await other.locator("#editor-library").selectOption(id);
  await expect(other.getByLabel("地图名称", { exact: true })).toHaveValue(
    "窗口 A",
  );
  await page.getByLabel("地图名称", { exact: true }).fill("A 修改");
  await other.getByLabel("地图名称", { exact: true }).fill("B 修改");
  await Promise.all(
    [page, other].map((tab) =>
      tab.getByRole("button", { name: "保存地图", exact: true }).click(),
    ),
  );
  await expect
    .poll(
      async () =>
        (
          await Promise.all(
            [page, other].map((tab) =>
              tab.locator("#workshop-message").textContent(),
            ),
          )
        ).filter((s) => s?.includes("保存冲突")).length,
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("blackroom.maps.v1")!).entries.length,
    ),
  ).toBe(2);
  await other.close();
});
