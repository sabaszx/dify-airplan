/**
 * Resilient project loader. Validates a persisted record against the domain
 * schema at the storage boundary so corrupted/legacy state produces a typed
 * result instead of an unhandled exception deep in the UI. Applies forward
 * migrations before validation. See override §7.2 and §8. Original code.
 */
import { ProjectSchema, type Project } from "@/domain/model";
import { migrateProject } from "@/domain/migrate";
import { localProjectStore } from "./storage";

export type LoadResult =
  | { ok: true; project: Project }
  | { ok: false; reason: "not-found" | "corrupted"; message: string };

/** Load and validate a project by id. */
export async function loadValidatedProject(id: string): Promise<LoadResult> {
  const raw = await localProjectStore.get(id);
  if (!raw) return { ok: false, reason: "not-found", message: "Project not found." };

  // Apply backward-compatible migrations, then validate.
  let migrated: unknown;
  try {
    migrated = migrateProject(raw as unknown);
  } catch (err) {
    return {
      ok: false,
      reason: "corrupted",
      message: `Stored project could not be migrated: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  const parsed = ProjectSchema.safeParse(migrated);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "corrupted",
      message: "Stored project data is invalid or from an unsupported version.",
    };
  }
  return { ok: true, project: parsed.data };
}
