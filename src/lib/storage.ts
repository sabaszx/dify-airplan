/**
 * Persistence adapter abstraction. The MVP ships a browser localStorage
 * implementation; the interface allows a future PostgreSQL/Prisma-backed API or
 * object-storage adapter without touching the store logic. See design.md §1, §8.
 */
import type { Project } from "@/domain/model";

export interface ProjectStore {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

const KEY = "cwp:projects";

function readAll(): Record<string, Project> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Project>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export const localProjectStore: ProjectStore = {
  async list() {
    return Object.values(readAll()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },
  async get(id) {
    return readAll()[id] ?? null;
  },
  async save(project) {
    const all = readAll();
    all[project.id] = project;
    writeAll(all);
  },
  async remove(id) {
    const all = readAll();
    delete all[id];
    writeAll(all);
  },
};
