import { test, expect, type Page } from "@playwright/test";
import { seedProjectWithObjects } from "./helpers";

// World->screen for the seeded project: mpp=0.05, initial viewport zoom=1, pan=(40,40).
// screen = worldMeters/mpp * zoom + pan.
function worldToCanvas(xM: number, yM: number): { x: number; y: number } {
  return { x: (xM / 0.05) * 1 + 40, y: (yM / 0.05) * 1 + 40 };
}

async function canvasPoint(page: Page, xM: number, yM: number) {
  const box = (await page.getByTestId("design-canvas").boundingBox())!;
  const c = worldToCanvas(xM, yM);
  return { x: box.x + c.x, y: box.y + c.y };
}

test.describe("AP editing & context menus", () => {
  test("double-clicking an AP opens the AP editor", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    await expect(page.getByTestId("design-canvas")).toBeVisible();
    const p = await canvasPoint(page, 20, 15); // the AP
    await page.mouse.dblclick(p.x, p.y);
    await expect(page.getByTestId("ap-tab-properties")).toBeVisible();
  });

  test("right-clicking an AP opens AP actions (not wall actions)", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    const p = await canvasPoint(page, 20, 15);
    await page.mouse.click(p.x, p.y, { button: "right" });
    const menu = page.getByTestId("context-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-action="ap.edit"]')).toBeVisible();
    await expect(menu.locator('[data-action="ap.changeModel"]')).toBeVisible();
    await expect(menu.locator('[data-action="wall.edit"]')).toHaveCount(0);
  });

  test("right-clicking a wall opens wall actions (not AP actions)", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    const p = await canvasPoint(page, 22, 22); // on the wall segment
    await page.mouse.click(p.x, p.y, { button: "right" });
    const menu = page.getByTestId("context-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-action="wall.edit"]')).toBeVisible();
    await expect(menu.locator('[data-action="ap.edit"]')).toHaveCount(0);
  });

  test("Change Model preserves position and is undoable", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    // Read the AP position before via localStorage.
    const before = await page.evaluate((pid) => {
      const map = JSON.parse(localStorage.getItem("cwp:projects")!);
      return map[pid].scenarios[0].floors[0].accessPoints[0].position;
    }, id);

    const p = await canvasPoint(page, 20, 15);
    await page.mouse.click(p.x, p.y, { button: "right" });
    await page.getByTestId("context-menu").locator('[data-action="ap.changeModel"]').click();
    // Choose a different model (Catalyst 9130 has no 6 GHz -> triggers review).
    await page.getByTestId("model-cat9130").getByRole("button", { name: "Choose" }).click();
    await expect(page.getByTestId("model-change-summary")).toBeVisible();
    await page.getByTestId("apply-model-change").click();

    // Wait for autosave to flush to localStorage.
    await page.waitForFunction(
      (pid) => {
        const map = JSON.parse(localStorage.getItem("cwp:projects")!);
        return map[pid].scenarios[0].floors[0].accessPoints[0].productId === "cat9130";
      },
      id,
      { timeout: 5000 },
    );

    // Position preserved and model changed.
    const after = await page.evaluate((pid) => {
      const map = JSON.parse(localStorage.getItem("cwp:projects")!);
      const ap = map[pid].scenarios[0].floors[0].accessPoints[0];
      return { position: ap.position, productId: ap.productId };
    }, id);
    expect(after.position).toEqual(before);
    expect(after.productId).toBe("cat9130");

    // Undo restores the previous model (wait for autosave to flush).
    await page.keyboard.press("Control+z");
    await page.waitForFunction(
      (pid) => {
        const map = JSON.parse(localStorage.getItem("cwp:projects")!);
        return map[pid].scenarios[0].floors[0].accessPoints[0].productId === "cat9166";
      },
      id,
      { timeout: 5000 },
    );
  });

  test("Shift+F10 opens the same context menu", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    await page.getByTestId("design-canvas").focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByTestId("context-menu")).toBeVisible();
  });

  test("context menu stays inside the viewport near the edge", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    const canvas = page.getByTestId("design-canvas");
    const box = (await canvas.boundingBox())!;
    // Right-click near the far-right edge (upper area, clear of the bottom dock).
    await page.mouse.click(box.x + box.width - 5, box.y + 120, { button: "right" });
    const menu = page.getByTestId("context-menu");
    await expect(menu).toBeVisible();
    const menuBox = (await menu.boundingBox())!;
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(vw + 1);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(vh + 1);
  });

  test("native browser context menu still works outside the canvas", async ({ page }) => {
    const id = await seedProjectWithObjects(page);
    await page.goto(`/project/${id}`);
    // Right-click the header project name (outside the canvas). Our custom menu
    // must NOT appear there.
    await page
      .getByText("Cisco Wi-Fi Planner")
      .first()
      .click({ button: "right" })
      .catch(() => {});
    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });
});
