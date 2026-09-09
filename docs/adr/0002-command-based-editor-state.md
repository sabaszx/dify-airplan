# ADR 0002: Command-based editor state with drag coalescing

- Status: Accepted
- Date: 2026

## Context
The canvas needs robust undo/redo and must not flood history during drags.

## Decision
Model every canvas mutation as a Command (`src/store/commands.ts`) with
execute/undo/redo, a label, affected ids, and invalidation bounds. Coalesce
continuous pointer movement into one undoable entry via
begin/apply/commit-transient.

## Consequences
- Predictable undo/redo; a drag is a single history step (property-tested).
- Clear seam for future serialized/collaborative history.
- Snapshots are JSON copies (simple, adequate for MVP sizes).
