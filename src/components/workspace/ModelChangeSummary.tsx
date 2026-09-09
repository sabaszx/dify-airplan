"use client";

import type { CompatibilitySummary } from "@/domain/model-change";

/**
 * Compatibility summary shown before applying a model change. Lists preserved /
 * converted / reset settings, added/removed radios and bands, antenna and
 * regulatory/management differences. The user must review before applying when
 * there are blocking changes. See override §3.
 */
export function ModelChangeSummary({
  fromModel,
  toModel,
  summary,
  onApply,
  onCancel,
}: {
  fromModel: string;
  toModel: string;
  summary: CompatibilitySummary;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Model change summary"
    >
      <div className="panel w-full max-w-md p-4 text-sm" data-testid="model-change-summary">
        <h2 className="text-sm font-semibold">
          Change model: {fromModel} → {toModel}
        </h2>

        <Section title="Preserved" items={summary.preserved} tone="ok" />
        {summary.converted.length > 0 && (
          <Section title="Converted" items={summary.converted} tone="warn" />
        )}
        {summary.reset.length > 0 && <Section title="Reset" items={summary.reset} tone="error" />}
        {summary.radiosAdded.length > 0 && (
          <Section
            title="Bands added"
            items={summary.radiosAdded.map((b) => `${b} GHz`)}
            tone="ok"
          />
        )}
        {summary.radiosRemoved.length > 0 && (
          <Section
            title="Bands removed"
            items={summary.radiosRemoved.map((b) => `${b} GHz`)}
            tone="error"
          />
        )}
        {summary.antennaChange && (
          <Section title="Antenna" items={[summary.antennaChange]} tone="warn" />
        )}
        {summary.regulatoryConflict && (
          <Section title="Regulatory" items={[summary.regulatoryConflict]} tone="warn" />
        )}
        {summary.managementChange && (
          <Section title="Management" items={[summary.managementChange]} tone="warn" />
        )}

        {summary.hasBlockingReview && (
          <p className="mt-2 rounded bg-yellow-500/10 p-2 text-[11px] text-yellow-200">
            Some settings will be converted or reset. Review the changes above before applying.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="apply-model-change" onClick={onApply}>
            Apply change
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn" | "error";
}) {
  if (items.length === 0) return null;
  const color =
    tone === "ok" ? "text-green-400" : tone === "warn" ? "text-yellow-300" : "text-red-300";
  const sym = tone === "ok" ? "✓" : tone === "warn" ? "!" : "×";
  return (
    <div className="mt-3">
      <div className={`text-xs font-medium ${color}`}>{title}</div>
      <ul className="mt-0.5 space-y-0.5 text-[11px] text-base-muted">
        {items.map((it, i) => (
          <li key={i}>
            <span className={color} aria-hidden>
              {sym}
            </span>{" "}
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
