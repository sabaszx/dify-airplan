"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/domain/model";
import { ProjectSchema } from "@/domain/model";
import { createProject } from "@/domain/factory";
import { localProjectStore } from "@/lib/storage";
import { scenarioApCount, scenarioFloorCount } from "@/lib/scenario-metrics";
import { activeScenario } from "@/store/editor";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { downloadText } from "@/lib/export";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();

  async function refresh() {
    setProjects(await localProjectStore.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    const trimmed = name.trim() || "Untitled project";
    const p = createProject(trimmed, "org-demo", "user-demo");
    await localProjectStore.save(p);
    setName("");
    setCreating(false);
    push("Project created", "success");
    refresh();
  }

  async function duplicate(p: Project) {
    const copy = createProject(`${p.name} (copy)`, p.organizationId, p.ownerId);
    copy.scenarios = JSON.parse(JSON.stringify(p.scenarios));
    copy.activeScenarioId = copy.scenarios[0]!.id;
    copy.customer = p.customer;
    copy.location = p.location;
    await localProjectStore.save(copy);
    push("Project duplicated", "success");
    refresh();
  }

  async function archive(p: Project) {
    await localProjectStore.save({
      ...p,
      archived: !p.archived,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }

  async function remove(p: Project) {
    if (!(await confirm(`Delete "${p.name}"? This cannot be undone.`))) return;
    await localProjectStore.remove(p.id);
    push("Project deleted");
    refresh();
  }

  function exportJson(p: Project) {
    downloadText(`${p.name}.json`, JSON.stringify(p, null, 2), "application/json");
  }

  async function importJson(file: File) {
    try {
      const parsed = ProjectSchema.parse(JSON.parse(await file.text()));
      parsed.id = createProject("x", "x", "x").id; // fresh id to avoid clobbering
      await localProjectStore.save(parsed);
      push("Project imported", "success");
      refresh();
    } catch {
      push("Import failed: invalid project JSON", "error");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {dialog}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cisco Wi-Fi Planner</h1>
          <p className="text-sm text-base-muted">
            Predictive wireless design. Planning estimates only — verify with an on-site survey.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="btn cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
          <button
            className="btn btn-primary"
            data-testid="new-project"
            onClick={() => setCreating(true)}
          >
            New project
          </button>
        </div>
      </header>

      {creating && (
        <div className="panel mb-6 flex items-end gap-3 p-4">
          <div className="flex-1">
            <label className="label" htmlFor="pname">
              Project name
            </label>
            <input
              id="pname"
              className="input"
              data-testid="project-name-input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. HQ Building A"
            />
          </div>
          <button className="btn btn-primary" data-testid="create-project" onClick={handleCreate}>
            Create
          </button>
          <button className="btn" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      )}

      {projects === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel h-32 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="panel p-10 text-center text-base-muted">
          No projects yet. Create your first design.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const scn = activeScenario(p);
            return (
              <div key={p.id} className={`panel p-4 ${p.archived ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between">
                  <Link
                    href={`/project/${p.id}`}
                    className="font-medium hover:text-accent"
                    data-testid="project-card-link"
                  >
                    {p.name}
                  </Link>
                  {p.archived && <span className="text-xs text-base-muted">archived</span>}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-muted">
                  <div>Customer: {p.customer || "—"}</div>
                  <div>Location: {p.location || "—"}</div>
                  <div>Floors: {scenarioFloorCount(scn)}</div>
                  <div>APs: {scenarioApCount(scn)}</div>
                  <div>Owner: {p.ownerId}</div>
                  <div>Updated: {new Date(p.updatedAt).toLocaleDateString()}</div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Link href={`/project/${p.id}`} className="btn !py-1 !text-xs">
                    Open
                  </Link>
                  <button className="btn !py-1 !text-xs" onClick={() => duplicate(p)}>
                    Duplicate
                  </button>
                  <button className="btn !py-1 !text-xs" onClick={() => archive(p)}>
                    {p.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button className="btn !py-1 !text-xs" onClick={() => exportJson(p)}>
                    Export
                  </button>
                  <button className="btn !py-1 !text-xs" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
