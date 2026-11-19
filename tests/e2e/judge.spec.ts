import { expect, test } from "@playwright/test";

test("landing and live impact", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /exam doubts answered/i })).toBeVisible();
  await page.goto("/impact");
  await expect(page.getByRole("heading", { name: "Live impact" })).toBeVisible();
  await expect(page.getByText("Students", { exact: true }).locator("..").locator("dd").first()).toHaveText(/[\d,]+/);
});

test("demo doubt reaches another user, gets an answer and opens a mentor DM", async ({ page, browser, baseURL }) => {
  const observer = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  try {
    const second = await observer.newPage();
    for (const session of [page, second]) {
      await session.goto("/try");
      await session.getByRole("button", { name: "Start the demo" }).click();
      await expect(session).toHaveURL(/\/app\/room\/demo_cn/);
      await expect(session.getByText("Connected", { exact: true })).toBeVisible();
    }

    const question = `Why does TCP use sequence numbers? (Study check ${Date.now().toString(36)})`;
    await page.getByRole("button", { name: /^doubt$/i }).click();
    const unit = page.getByLabel("Unit", { exact: true });
    if (await unit.count()) await unit.selectOption({ index: 1 });
    await page.getByRole("textbox", { name: /your doubt/i }).fill(question);
    await page.getByRole("button", { name: "Post doubt" }).click();
    await expect(second.getByText(question, { exact: true }).first()).toBeVisible();

    const answer = page.locator("article").filter({ has: page.getByRole("button", { name: question, exact: true }) });
    const vote = answer.getByRole("button", { name: /^upvote,/i });
    await expect(vote).toBeVisible({ timeout: 30_000 });
    await vote.click();
    await expect(answer.getByRole("button", { name: /^remove upvote/i })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Message Arun" }).click();
    await expect(page).toHaveURL(/\/app\/dm\/demo_mentor/);
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEnabled();
  } finally {
    await observer.close();
  }
});

test("guest and anonymous API boundaries", async ({ request, baseURL }) => {
  const headers = { Origin: new URL(baseURL!).origin };
  for (const path of ["/api/ta/ask", "/api/announcements", "/api/moderation/mute", "/api/admin/role"]) {
    expect((await request.post(path, { headers, data: {} })).status()).toBe(401);
  }
  expect((await request.post("/api/try", { headers })).ok()).toBe(true);
  expect((await request.post("/api/admin/role", { headers, data: {} })).status()).toBe(403);
  const realRoom = await request.post("/api/ta/ask", { headers, data: { roomId: "r_cs3591_cse_y3" } });
  expect([403, 404]).toContain(realRoom.status());
  const oversized = await request.post("/api/ta/ask", {
    headers, data: { mode: "mention", roomId: "demo_cn", messageId: "boundary-check", text: "a".repeat(2001) },
  });
  expect(oversized.status()).toBe(400);
});
