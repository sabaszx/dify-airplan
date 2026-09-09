/**
 * Command architecture. Every canvas mutation is a Command with a
 * human-readable label, affected entity IDs, and optional simulation
 * invalidation bounds. The stack supports execute/undo/redo and serialization.
 * Continuous pointer movement is coalesced via begin/commitTransient so a drag
 * produces a single undoable entry. See design.md Addendum §B.
 */
import type { Project } from "@/domain/model";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Command {
  label: string;
  affectedIds: string[];
  invalidationBounds?: BBox;
  /** Produce the next project state from the current one. Pure w.r.t. input. */
  apply: (project: Project) => Project;
}

interface HistoryEntry {
  label: string;
  affectedIds: string[];
  invalidationBounds?: BBox;
  before: string; // serialized project before apply
  after: string; // serialized project after apply
}

export class CommandStack {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private transient: { before: string; label: string } | null = null;
  readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  private serialize(p: Project): string {
    return JSON.stringify(p);
  }

  execute(project: Project, cmd: Command): Project {
    const before = this.serialize(project);
    const next = cmd.apply(structuredCloneSafe(project));
    const after = this.serialize(next);
    if (before === after) return project; // no-op, do not pollute history
    this.past.push({
      label: cmd.label,
      affectedIds: cmd.affectedIds,
      invalidationBounds: cmd.invalidationBounds,
      before,
      after,
    });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return next;
  }

  /** Begin a transient interaction (e.g. dragging). Records the start state. */
  beginTransient(project: Project, label: string): void {
    if (this.transient) return;
    this.transient = { before: this.serialize(project), label };
  }

  /** Apply a transient update without touching history. */
  applyTransient(project: Project, cmd: Omit<Command, "label">): Project {
    return cmd.apply(structuredCloneSafe(project));
  }

  /** Commit the whole transient interaction as ONE undoable command. */
  commitTransient(project: Project, affectedIds: string[], bounds?: BBox): Project {
    if (!this.transient) return project;
    const after = this.serialize(project);
    if (this.transient.before !== after) {
      this.past.push({
        label: this.transient.label,
        affectedIds,
        invalidationBounds: bounds,
        before: this.transient.before,
        after,
      });
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
    }
    this.transient = null;
    return project;
  }

  cancelTransient(): void {
    this.transient = null;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }
  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): { project: Project; entry: HistoryEntry } | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.unshift(entry);
    return { project: JSON.parse(entry.before) as Project, entry };
  }

  redo(): { project: Project; entry: HistoryEntry } | null {
    const entry = this.future.shift();
    if (!entry) return null;
    this.past.push(entry);
    return { project: JSON.parse(entry.after) as Project, entry };
  }

  /** History labels newest-last (for a history panel). */
  history(): { label: string; affectedIds: string[] }[] {
    return this.past.map((e) => ({ label: e.label, affectedIds: e.affectedIds }));
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.transient = null;
  }
}

function structuredCloneSafe<T>(v: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);
}
