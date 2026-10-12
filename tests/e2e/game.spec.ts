import { test, expect } from "@playwright/test";
test("friends create, join, select map, play, score and leave", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const context = await browser.newContext();
  const friend = await context.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /把快乐，\s*撞出来。/ }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/home.png", fullPage: true });
  await page.getByLabel("你的昵称").fill("柠檬");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await page.getByTestId("room-code").textContent();
  await friend.goto("/");
  await friend.getByLabel("你的昵称").fill("紫薯");
  await friend.getByLabel("房间码", { exact: true }).fill(code!);
  await friend.getByRole("button", { name: "加入房间", exact: true }).click();
  await expect(
    friend.getByRole("button", { name: "开始比赛", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /浮空阶梯/ }).click();
  await expect(friend.getByTestId("map-name")).toHaveText("浮空阶梯");
  await page.getByRole("button", { name: /起点站/ }).click();
  await page.screenshot({ path: "artifacts/room.png", fullPage: true });
  await page.getByRole("button", { name: "开始比赛", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("对战进行中", {
    timeout: 8000,
  });
  await page.keyboard.down("Space");
  await expect(page.getByTestId("self-status")).toHaveText("加重防御");
  await page.screenshot({ path: "artifacts/playing.png", fullPage: true });
  await page.keyboard.up("Space");
  await page.keyboard.down("KeyA");
  await expect(page.getByTestId("self-status")).toHaveText(
    "你已出局 · 观战中",
    { timeout: 8000 },
  );
  await page.keyboard.up("KeyA");
  await expect(friend.getByTestId("players")).toContainText("1 分");
  await friend.getByRole("button", { name: "离开房间" }).click();
  await expect(page.getByTestId("phase")).toHaveText("等待朋友加入");
  expect(errors).toEqual([]);
  await context.close();
});
test("invalid room displays error and nickname is rendered as text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("你的昵称").fill("<img src=x>");
  await page.getByLabel("房间码", { exact: true }).fill("ZZZZZZ");
  await page.getByRole("button", { name: "加入房间", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("房间不存在");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page.getByTestId("players")).toContainText("<img src=x>");
  await expect(page.getByTestId("players").locator("img")).toHaveCount(0);
});
