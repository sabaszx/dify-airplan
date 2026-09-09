import { test, expect } from "@playwright/test";

test.describe("Project dashboard", () => {
  test("creates a project and it appears on the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("new-project").click();
    await page.getByTestId("project-name-input").fill("Playwright HQ");
    await page.getByTestId("create-project").click();
    await expect(page.getByText("Playwright HQ")).toBeVisible();
  });

  test("created project persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("new-project").click();
    await page.getByTestId("project-name-input").fill("Persisted Project");
    await page.getByTestId("create-project").click();
    await expect(page.getByText("Persisted Project")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Persisted Project")).toBeVisible();
  });
});
