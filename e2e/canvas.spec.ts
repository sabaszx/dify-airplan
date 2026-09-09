import { test, expect } from "@playwright/test";
import { seedProject } from "./helpers";

test.describe("Canvas workflows (DoD-critical)", () => {
  test("continuous wall drawing without reselecting the tool", async ({ page }) => {
    const id = await seedProject(page, "Wall Test");
    await page.goto(`/project/${id}`);

    const canvas = page.getByTestId("design-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("wall-count")).toHaveAttribute("data-count", "0");

    // Activate the wall tool once.
    await page.getByTestId("tool-wall").click();

    const box = (await canvas.boundingBox())!;
    const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy });

    // Draw a connected 3-segment polyline, then finish with a double-click.
    await page.mouse.click(at(300, 300).x, at(300, 300).y);
    await page.mouse.click(at(420, 300).x, at(420, 300).y);
    await page.mouse.click(at(420, 420).x, at(420, 420).y);
    await page.mouse.dblclick(at(540, 420).x, at(540, 420).y);

    await expect(page.getByTestId("wall-count")).toHaveAttribute("data-count", "1");

    // Tool stays active: immediately draw a second wall.
    await page.mouse.click(at(300, 500).x, at(300, 500).y);
    await page.mouse.dblclick(at(450, 500).x, at(450, 500).y);
    await expect(page.getByTestId("wall-count")).toHaveAttribute("data-count", "2");
  });

  test("places APs and undo/redo restores them", async ({ page }) => {
    const id = await seedProject(page, "AP Test");
    await page.goto(`/project/${id}`);
    const canvas = page.getByTestId("design-canvas");
    await expect(page.getByTestId("ap-count")).toHaveAttribute("data-count", "0");

    await page.getByTestId("tool-ap").click();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + 300, box.y + 300);
    // Continuous placement (pinned by default): place another.
    await page.mouse.click(box.x + 460, box.y + 320);
    await expect(page.getByTestId("ap-count")).toHaveAttribute("data-count", "2");

    // Undo removes the last placement; redo restores it.
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("ap-count")).toHaveAttribute("data-count", "1");
    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByTestId("ap-count")).toHaveAttribute("data-count", "2");
  });

  test("Escape exits the wall tool after cancelling", async ({ page }) => {
    const id = await seedProject(page, "Escape Test");
    await page.goto(`/project/${id}`);
    const canvas = page.getByTestId("design-canvas");
    await page.getByTestId("tool-wall").click();
    await expect(page.getByTestId("tool-wall")).toHaveAttribute("aria-pressed", "true");

    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + 300, box.y + 300); // start a segment
    await page.keyboard.press("Escape"); // cancel current segment
    await page.keyboard.press("Escape"); // exit to select
    await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
    // No wall was committed.
    await expect(page.getByTestId("wall-count")).toHaveAttribute("data-count", "0");
  });
});
