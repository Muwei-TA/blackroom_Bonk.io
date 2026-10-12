import { test, expect } from "@playwright/test";
test("rooms start classic, opt into energy, and classic trials keep maps intact", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let world: any;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      const m = JSON.parse(frame.payload.toString());
      if (m.type === "snapshot") world = m.world;
    }),
  );
  await page.goto("/");
  await page.getByLabel("你的昵称").fill("经典玩家");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await page.getByTestId("room-code").textContent();
  await expect(page.getByLabel("对战模式", { exact: true })).toHaveValue(
    "classic",
  );
  await expect(page.getByTestId("growth-status")).toBeHidden();
  const friend = await context.newPage();
  await friend.goto("/");
  await friend.getByLabel("你的昵称").fill("朋友");
  await friend.getByLabel("房间码", { exact: true }).fill(code!);
  await friend.getByRole("button", { name: "加入房间", exact: true }).click();
  await expect(friend.getByTestId("room-code")).toHaveText(code!);
  await expect(friend.getByLabel("对战模式", { exact: true })).toBeDisabled();
  await page.getByLabel("对战模式", { exact: true }).selectOption("energy");
  await expect(friend.getByLabel("对战模式", { exact: true })).toHaveValue(
    "energy",
  );
  await page.getByLabel("对战模式", { exact: true }).selectOption("classic");
  await expect(friend.getByLabel("对战模式", { exact: true })).toHaveValue(
    "classic",
  );
  await page.getByRole("button", { name: "开始比赛", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("对战进行中", {
    timeout: 8000,
  });
  await expect(page.getByLabel("对战模式", { exact: true })).toBeDisabled();
  await expect
    .poll(() => world?.phase === "playing" && world.remainingMs < 87500, {
      timeout: 8000,
    })
    .toBe(true);
  await page.screenshot({path:"artifacts/classic-playing.png",fullPage:true});
  expect(world.energies).toEqual([]);
  expect(world.platforms).toEqual([]);
  expect(
    world.bodies.every((b: any) => b.radius === 20 && b.energy === 0),
  ).toBe(true);
  await friend.getByRole("button", { name: "离开房间", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("等待朋友加入");
  await page.getByRole("button", { name: "自定义地图", exact: true }).click();
  await expect(page.getByLabel("试跑模式", { exact: true })).toHaveValue(
    "classic",
  );
  await page.getByRole("button", { name: "新增平台", exact: true }).click();
  await page.getByLabel("平台类型", { exact: true }).selectOption("seesaw");
  await page.getByRole("button", { name: "试跑", exact: true }).click();
  await expect(page.getByTestId("trial-status")).toContainText("经典弹球");
  await expect(page.getByTestId("trial-status")).not.toContainText("能量");
  await page.getByRole("button", { name: "返回编辑", exact: true }).click();
  // Trialing in classic must preserve the authored seesaw setting.
  const box = await page.getByTestId("editor-canvas").boundingBox();
  await page.mouse.click(
    box!.x + box!.width / 2,
    box!.y + (box!.height * 300) / 800,
  );
  await expect(page.getByLabel("平台类型", { exact: true })).toHaveValue(
    "seesaw",
  );
  await page.getByLabel("试跑模式", { exact: true }).selectOption("energy");
  await page.getByRole("button", { name: "试跑", exact: true }).click();
  await expect(page.getByTestId("trial-status")).toContainText("能量");
  expect(errors).toEqual([]);
  await friend.close();
});
