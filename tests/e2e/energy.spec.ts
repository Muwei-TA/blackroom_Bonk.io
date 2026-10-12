import { MAPS } from "../../src/shared/maps";
import { toDocument } from "../../src/shared/custom-map";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
async function xy(page: any, x: number, y: number) {
  const r = await page.getByTestId("editor-canvas").boundingBox();
  return { x: r.x + (x * r.width) / 1200, y: r.y + (y * r.height) / 800 };
}
test("visual rotation handles, direction buttons, slider and seesaw export", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page.getByRole("button", { name: "新增平台", exact: true }).click();
  const handle = await xy(page, 600, 257),
    target = await xy(page, 643, 300);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("90");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  const center = await xy(page, 600, 300);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "顺时针 15°", exact: true }).click();
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("15");
  await page.getByRole("button", { name: "逆时针 15°", exact: true }).click();
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("0");
  await page.getByLabel("平台类型", { exact: true }).selectOption("seesaw");
  await page.getByLabel("可视化旋转角度", { exact: true }).fill("30");
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("30");
  await page.screenshot({
    path: "artifacts/rotation-studio.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "试跑", exact: true }).click();
  await expect(page.getByTestId("trial-status")).toContainText("能量");
  await page.getByRole("button", { name: "返回编辑", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出地图", exact: true }).click();
  const file = await downloaded;
  await file.saveAs("artifacts/seesaw-map.json");
  const exported = JSON.parse(
    await readFile("artifacts/seesaw-map.json", "utf8"),
  );
  expect(exported.version).toBe(2);
  expect(exported.map.platforms[1]).toMatchObject({
    motion: "seesaw",
    angle: Math.PI / 6,
  });
  await page.getByRole("button", { name: "随机生成", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(page.getByLabel("地图名称", { exact: true })).toHaveValue(
    /随机/,
  );
  await expect(page.getByTestId("map-validation")).toContainText("校验通过");
  await page.screenshot({
    path: "artifacts/random-editor.png",
    fullPage: true,
  });
});
test("friends receive one random arena and energy gameplay updates", async ({
  page,
  context,
}) => {
  let latest: any = null;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      const m = JSON.parse(frame.payload.toString());
      if (m.type === "snapshot") latest = m.world;
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("你的昵称").fill("天平玩家");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await page.getByTestId("room-code").textContent();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByLabel("你的昵称").fill("能量玩家");
  await other.getByLabel("房间码", { exact: true }).fill(code!);
  await other.getByRole("button", { name: "加入房间", exact: true }).click();
  await expect(other.getByTestId("room-code")).toHaveText(code!);
  await page.getByRole("button", { name: "随机地图", exact: true }).click();
  await expect(other.getByTestId("map-name")).toHaveText(/随机/);
  await expect(
    other.getByRole("button", { name: "随机地图", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "artifacts/random-room.png", fullPage: true });
  await page.getByRole("button", { name: "开始比赛", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("对战进行中", {
    timeout: 8000,
  });
  await expect(page.getByTestId("growth-status")).toContainText("能量");
  await expect(
    page.getByRole("button", { name: "随机地图", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() => latest?.energies.some((e: any) => e.y > 140) ?? false, {
      timeout: 8000,
    })
    .toBe(true);
  expect(latest.platforms.length).toBeGreaterThan(0);
  expect(latest.bodies.every((b: any) => b.radius >= 20 && b.mass > 0)).toBe(
    true,
  );
  await page.screenshot({
    path: "artifacts/energy-playing.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await other.close();
});

test("library upgrades preserve old maps and block writers from older open tabs", async ({
  page,
}) => {
  await page.goto("/");
  const legacy = { ...toDocument(MAPS[0]), version: 1 };
  await page.evaluate(async (document) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("blackroom-map-locks", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("mutations");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    localStorage.setItem(
      "blackroom.maps.v1",
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: "legacy",
            revision: "before",
            updatedAt: "2026-10-12",
            document,
          },
        ],
      }),
    );
  }, legacy);
  await page.getByRole("button", { name: "地图工坊", exact: true }).click();
  await page.getByRole("button", { name: "保存地图", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("已保存");
  const oldWriter = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open("blackroom-map-locks", 1);
        request.onsuccess = () => {
          request.result.close();
          resolve("opened");
        };
        request.onerror = () => resolve(request.error!.name);
      }),
  );
  expect(oldWriter).toBe("VersionError");
  await page.getByRole("button", { name: "另存为", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("blackroom.maps.v1")!).entries.length,
      ),
    )
    .toBe(3);
  const entries = await page.evaluate(
    () => JSON.parse(localStorage.getItem("blackroom.maps.v1")!).entries,
  );
  expect(entries.find((e: any) => e.id === "legacy").document).toEqual(legacy);
});
