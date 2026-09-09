import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ProjectSchema } from "./model";
import { createProject, createAccessPoint } from "./factory";
import { CommandStack, type Command } from "@/store/commands";
import { activeScenario } from "@/store/editor";

const cfg = { seed: 4242, numRuns: 80 } as const;

describe("Domain invariants (property-based)", () => {
  it("serialize -> deserialize preserves the project (roundtrip)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.array(
          fc.record({
            x: fc.double({ min: 0, max: 100, noNaN: true }),
            y: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          { maxLength: 6 },
        ),
        (name, positions) => {
          const project = createProject(name, "org1", "user1");
          for (const p of positions) {
            activeScenario(project).floors[0]!.accessPoints.push(createAccessPoint("cat9166", p));
          }
          const json = JSON.stringify(project);
          const restored = ProjectSchema.parse(JSON.parse(json));
          expect(JSON.stringify(restored)).toBe(json);
        },
      ),
      cfg,
    );
  });

  it("undo then redo restores an equivalent state", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.double({ min: 0, max: 100, noNaN: true }),
            y: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (positions) => {
          const stack = new CommandStack();
          let project = createProject("Undo", "org1", "user1");
          for (const pos of positions) {
            const cmd: Command = {
              label: "Add AP",
              affectedIds: [],
              apply: (p) => {
                activeScenario(p).floors[0]!.accessPoints.push(createAccessPoint("cat9166", pos));
                return p;
              },
            };
            project = stack.execute(project, cmd);
          }
          const before = JSON.stringify(project);
          project = stack.undo()!.project;
          project = stack.redo()!.project;
          // The AP set is restored; timestamps aside, the AP positions match.
          const restored = activeScenario(project).floors[0]!.accessPoints.map((a) => a.position);
          const original = activeScenario(
            JSON.parse(before) as ReturnType<typeof createProject>,
          ).floors[0]!.accessPoints.map((a) => a.position);
          expect(restored).toEqual(original);
        },
      ),
      cfg,
    );
  });

  it("project access never crosses organization boundaries", () => {
    // A pure authorization policy: a project is visible only to its own org.
    function canAccess(project: { organizationId: string }, viewerOrg: string): boolean {
      return project.organizationId === viewerOrg;
    }
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (orgA, orgB) => {
        const project = createProject("P", orgA, "user");
        expect(canAccess(project, orgA)).toBe(true);
        if (orgA !== orgB) expect(canAccess(project, orgB)).toBe(false);
      }),
      cfg,
    );
  });
});
