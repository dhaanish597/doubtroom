import { expect, test, type Page } from "@playwright/test";

// Needs GEMINI_API_KEY, GEMINI_MODEL and GEMINI_EMBED_MODEL on the server, and the demo notes indexed.
// These tests post real doubts into the judges' demo room, so they run only with E2E_POST_DOUBTS=1.
test.skip(!process.env.E2E_POST_DOUBTS, "Posts into demo_cn; set E2E_POST_DOUBTS=1 to run");
const fixture = "docs/fixtures/phase-5-forwarding-table.png";

async function startDemo(page: Page) {
  await page.goto("/try");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await expect(page).toHaveURL(/\/app\/room\/demo_cn/);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
}

async function postDoubt(page: Page, question: string, photo?: string) {
  await page.getByRole("button", { name: /^doubt$/i }).click();
  await page.getByRole("combobox", { name: "Unit" }).selectOption({ index: 1 });
  if (photo) await page.locator('input[type="file"]').setInputFiles(photo);
  await page.getByRole("textbox", { name: /your doubt/i }).fill(question);
  await page.getByRole("button", { name: "Post doubt" }).click();
}

const answerFor = (page: Page, question: string) =>
  page.locator("article").filter({ has: page.getByRole("button", { name: question, exact: true }) });

test("the TA reads a textbook photo", async ({ page }) => {
  await startDemo(page);
  const question = `Where does the router send each packet in this table? (photo check ${Date.now().toString(36)})`;
  await postDoubt(page, question, fixture);
  const answer = answerFor(page, question);
  await expect(answer.getByRole("button", { name: /^upvote,/i })).toBeVisible({ timeout: 30_000 });
  await expect(answer).toContainText(/R1/);
  await expect(answer).toContainText(/R3/);
  await expect(answer).not.toContainText(/couldn.t read the photo/i);
});

test("a TCP doubt cites the demo revision sheet", async ({ page }) => {
  await startDemo(page);
  const question = `Why does TCP need a three-way handshake? (notes check ${Date.now().toString(36)})`;
  await postDoubt(page, question);
  const answer = answerFor(page, question);
  await expect(answer.getByRole("button", { name: /^upvote,/i })).toBeVisible({ timeout: 30_000 });
  await expect(answer.getByRole("link", { name: "DoubtRoom TCP revision sheet" })).toBeVisible();
});
