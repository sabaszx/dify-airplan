import { describe, it, expect } from "vitest";
import { CommandStack, type Command } from "@/store/commands";
import { createProject, createScenario, createFloor, uid } from "./factory";
import { activeScenario } from "@/store/editor";
import type { Project, Wall } from "./model";
import { thicknessToMeters } from "@/lib/thickness";

function projectWithWalls(count = 2): Project {
  const floor = createFloor(0);
  for (let i = 0; i < count; i++) {
    const w: Wall = {
      id: uid("wall"),
      polyline: [
        { x: i, y: 0 },
        { x: i + 5, y: 0 },
      ],
      materialId: "concrete",
      thicknessM: 0.1,
      heightM: 2.7,
      bottomElevationM: 0,
      openings: [],
    };
    floor.walls.push(w);
  }
  const scn = createScenario("S", [floor], true);
  const p = createProject("Thickness", "org1", "user1");
  p.scenarios = [scn];
  p.activeScenarioId = scn.id;
  return p;
}

function setThickness(ids: string[], meters: number): Command {
  return {
    label: "Set wall thickness",
    affectedIds: ids,
    apply: (p) => {
      for (const w of activeScenario(p).floors[0]!.walls) {
        if (ids.includes(w.id)) w.thicknessM = meters;
      }
      return p;
    },
  };
}

describe("editable wall thickness (mandatory §2)", () => {
  it("stores thickness in meters converted from a display unit", () => {
    // 150 mm -> 0.15 m
    expect(thicknessToMeters(150, "mm")).toBeCloseTo(0.15, 9);
  });

  it("increasing thickness is one undoable command; undo restores it", () => {
    const stack = new CommandStack();
    let p = projectWithWalls(1);
    const id = activeScenario(p).floors[0]!.walls[0]!.id;

    p = stack.execute(p, setThickness([id], 0.25));
    expect(activeScenario(p).floors[0]!.walls[0]!.thicknessM).toBe(0.25);

    p = stack.undo()!.project;
    expect(activeScenario(p).floors[0]!.walls[0]!.thicknessM).toBe(0.1);

    p = stack.redo()!.project;
    expect(activeScenario(p).floors[0]!.walls[0]!.thicknessM).toBe(0.25);
  });

  it("bulk editing changes all selected walls in one command", () => {
    const stack = new CommandStack();
    let p = projectWithWalls(3);
    const ids = activeScenario(p).floors[0]!.walls.map((w) => w.id);

    const before = stack.history().length;
    p = stack.execute(p, setThickness(ids, 0.3));
    expect(stack.history().length).toBe(before + 1); // single command
    for (const w of activeScenario(p).floors[0]!.walls) expect(w.thicknessM).toBe(0.3);
  });

  it("thickness persists across serialize/deserialize (reload)", () => {
    let p = projectWithWalls(1);
    const id = activeScenario(p).floors[0]!.walls[0]!.id;
    const stack = new CommandStack();
    p = stack.execute(p, setThickness([id], 0.2));
    const restored = JSON.parse(JSON.stringify(p)) as Project;
    expect(activeScenario(restored).floors[0]!.walls[0]!.thicknessM).toBe(0.2);
  });

  it("changing thickness does not change the material's attenuation values", () => {
    const stack = new CommandStack();
    let p = projectWithWalls(1);
    const matBefore = JSON.stringify(p.materials.find((m) => m.id === "concrete"));
    const id = activeScenario(p).floors[0]!.walls[0]!.id;
    p = stack.execute(p, setThickness([id], 0.4));
    const matAfter = JSON.stringify(p.materials.find((m) => m.id === "concrete"));
    expect(matAfter).toBe(matBefore);
  });
});
