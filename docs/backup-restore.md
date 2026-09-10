# Backup & Restore

## What to back up

- PostgreSQL database (projects, catalog/pattern revisions, report snapshots).
- Object storage (floor-plan images, report images).
- The MVP persists projects in the browser (`localStorage`); users can export a
  project as JSON (dashboard "Export") as a manual backup and re-import it.

## Database backup (when Postgres is wired)

```
pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%F).dump
```

Schedule daily automated dumps with retention; store off-host and encrypted.

## Restore

```
pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup-YYYY-MM-DD.dump
```

Restore object storage from its versioned bucket/snapshot.

## Verification

After restore, run `/api/ready`, open a known project, and generate a report to
confirm reproducibility (report snapshots are self-contained).

## Notes

Immutable catalog/pattern revisions and self-contained report snapshots mean a
restored project reproduces the same simulation and reports. Test restores
periodically; a backup is only as good as its last verified restore.
