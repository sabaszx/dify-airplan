import { describe, it, expect, beforeEach } from "vitest";
import { CommandStack, type Command } from "./commands";
import { createProject, createAccessPoint } from "@/domain/factory";
import { activeScenario } from "./editor";
import type { Project } from "@/domain/model";

function addApCommand(x: number, y: number): Command {
  return {
    label: "Add AP",
    affectedIds: [],
    apply: (p) => {
      const ap = createAccessPoint("cat9166", { x, y });
      activeScenario(p).floors[0]!.accessPoints.push(ap);
      return p;
    },
  };
}

describe("CommandStack", () => {
  let stack: CommandStack;
  let project: Project;

  beforeEach(() => {
    stack = new CommandStack();
    project = createProject("Cmd Test", "org1", "user1");
  });

  it("executes, undoes, and redoes a command", () => {
    project = stack.execute(project, addApCommand(1, 1));
    expect(activeScenario(project).floors[0]!.accessPoints).toHaveLength(1);

    const u = stack.undo()!;
    project = u.project;
    expect(activeScenario(project).floors[0]!.accessPoints).toHaveLength(0);

    const r = stack.redo()!;
    project = r.project;
    expect(activeScenario(project).floors[0]!.accessPoints).toHaveLength(1);
  });

  it("does not record no-op commands", () => {
    project = stack.execute(project, { label: "noop", affectedIds: [], apply: (p) => p });
    expect(stack.canUndo()).toBe(false);
  });

  it("records a label and affected IDs in history", () => {
    project = stack.execute(project, addApCommand(2, 2));
    expect(stack.history()[0]!.label).toBe("Add AP");
  });

  it("coalesces a drag into ONE undoable command", () => {
    // Seed an AP first.
    project = stack.execute(project, addApCommand(0, 0));
    const apId = activeScenario(project).floors[0]!.accessPoints[0]!.id;

    // Begin a transient drag and apply many intermediate positions.
    stack.beginTransient(project, "Move AP");
    for (let i = 1; i <= 20; i++) {
      project = stack.applyTransient(project, {
        affectedIds: [apId],
        apply: (p) => {
          const ap = activeScenario(p).floors[0]!.accessPoints[0]!;
          ap.position = { x: i, y: i };
          return p;
        },
      });
    }
    const historyBefore = stack.history().length; // 1 (the add)
    project = stack.commitTransient(project, [apId]);

    // Exactly one new history entry for the whole drag.
    expect(stack.history().length).toBe(historyBefore + 1);
    expect(activeScenario(project).floors[0]!.accessPoints[0]!.position).toEqual({ x: 20, y: 20 });

    // Undo the drag restores the pre-drag position in one step.
    const u = stack.undo()!;
    project = u.project;
    expect(activeScenario(project).floors[0]!.accessPoints[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it("clears the redo stack after a new command", () => {
    project = stack.execute(project, addApCommand(1, 1));
    project = stack.undo()!.project;
    expect(stack.canRedo()).toBe(true);
    project = stack.execute(project, addApCommand(2, 2));
    expect(stack.canRedo()).toBe(false);
  });
});
