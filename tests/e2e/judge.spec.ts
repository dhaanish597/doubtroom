import { expect, test, type Page } from "@playwright/test";

test("landing and live impact", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /exam doubts answered/i })).toBeVisible();
  await page.goto("/impact");
  await expect(page.getByRole("heading", { name: "Live impact" })).toBeVisible();
  await expect(page.getByText("Students", { exact: true }).locator("..").locator("dd").first()).toHaveText(/[\d,]+/);
});

async function startDemo(page: Page) {
  await page.goto("/try");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await expect(page).toHaveURL(/\/app\/room\/demo_cn/);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
}

async function postDoubt(page: Page, question: string) {
  await page.getByRole("button", { name: /^doubt$/i }).click();
  // A unit is required in the demo room, and the picker renders after the mode switch.
  await page.getByRole("combobox", { name: "Unit" }).selectOption({ index: 1 });
  await page.getByRole("textbox", { name: /your doubt/i }).fill(question);
  await page.getByRole("button", { name: "Post doubt" }).click();
}

test("a doubt posted in the demo room reaches a second user", async ({ page, browser, baseURL }) => {
  const observer = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  try {
    const second = await observer.newPage();
    await startDemo(page);
    await startDemo(second);
    const question = `Why does TCP use sequence numbers? (Study check ${Date.now().toString(36)})`;
    await postDoubt(page, question);
    await expect(second.getByText(question, { exact: true }).first()).toBeVisible();
  } finally {
    await observer.close();
  }
});

// Needs a live LLM (GEMINI_API_KEY or GROQ_API_KEY on the server). Blocked until those keys are set.
test("the AI TA answers a demo doubt, then upvote and mentor DM work", async ({ page }) => {
  await startDemo(page);
  const question = `Why does TCP use sequence numbers? (Study check ${Date.now().toString(36)})`;
  await postDoubt(page, question);
  const answer = page.locator("article").filter({ has: page.getByRole("button", { name: question, exact: true }) });
  const vote = answer.getByRole("button", { name: /^upvote,/i });
  await expect(vote).toBeVisible({ timeout: 30_000 });
  await vote.click();
  await expect(answer.getByRole("button", { name: /^remove upvote/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Message Arun" }).click();
  await expect(page).toHaveURL(/\/app\/dm\/demo_mentor/);
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEnabled();
});

test("an upvote from one user shows up for another within 5 seconds", async ({ browser, baseURL }) => {
  const contextA = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const contextB = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  try {
    const [a, b] = [await contextA.newPage(), await contextB.newPage()];
    await startDemo(a);
    await startDemo(b);
    const seeded = (page: Page) => page.locator("article").filter({ has: page.getByRole("button", { name: /flow control and congestion control/i }) });
    const countOf = async (page: Page) => {
      const label = await seeded(page).getByRole("button", { name: /upvote/i }).first().getAttribute("aria-label");
      return Number(/(\d+) upvotes?/.exec(label ?? "")?.[1] ?? Number.NaN);
    };
    await expect(seeded(a).getByRole("button", { name: /^upvote,/i })).toBeVisible();
    await expect(seeded(b).getByRole("button", { name: /^upvote,/i })).toBeVisible();
    const before = await countOf(b);
    await seeded(a).getByRole("button", { name: /^upvote,/i }).click();
    await expect.poll(() => countOf(b), { timeout: 5_000 }).toBe(before + 1);
  } finally {
    await contextA.close();
    await contextB.close();
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
