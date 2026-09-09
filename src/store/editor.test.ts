import { describe, it, expect, beforeEach } from "vitest";
import { useEditor, activeScenario } from "./editor";
import { createProject, createAccessPoint } from "@/domain/factory";

describe("editor undo/redo (mandatory test)", () => {
  beforeEach(() => {
    const p = createProject("Test", "org1", "user1");
    useEditor.getState().loadProject(p);
  });

  it("restores AP positions on undo and redo", () => {
    const store = useEditor.getState();
    const floorId = activeScenario(store.project!).floors[0]!.id;
    const ap = createAccessPoint("cat9166", { x: 5, y: 5 });

    store.update((p) => {
      activeScenario(p).floors[0]!.accessPoints.push(ap);
    });
    expect(activeScenario(useEditor.getState().project!).floors[0]!.accessPoints).toHaveLength(1);

    // Move the AP.
    useEditor.getState().update((p) => {
      const a = activeScenario(p).floors[0]!.accessPoints[0]!;
      a.position = { x: 20, y: 20 };
    });
    expect(
      activeScenario(useEditor.getState().project!).floors[0]!.accessPoints[0]!.position.x,
    ).toBe(20);

    // Undo the move.
    useEditor.getState().undo();
    expect(
      activeScenario(useEditor.getState().project!).floors[0]!.accessPoints[0]!.position.x,
    ).toBe(5);

    // Redo the move.
    useEditor.getState().redo();
    expect(
      activeScenario(useEditor.getState().project!).floors[0]!.accessPoints[0]!.position.x,
    ).toBe(20);

    // Undo twice removes the AP entirely.
    useEditor.getState().undo();
    useEditor.getState().undo();
    expect(activeScenario(useEditor.getState().project!).floors[0]!.accessPoints).toHaveLength(0);
    void floorId;
  });
});
