# Disaster Recovery Runbook

This document describes how the **exam-paper-system** PostgreSQL database is backed up and how to recover it after data loss, corruption, hardware failure, or an accidental destructive migration.

Owner: school IT lead (see Escalation section).
Scope: the application Postgres database (users, question bank, papers, morning-quiz sessions & submissions). Does **not** cover the app code (recoverable from Git) or generated PDFs (regenerable from the DB).

---

## Recovery objectives

| Metric | Target | Notes |
|---|---|---|
| **RTO** (Recovery Time Objective) | **< 30 minutes** | From declared incident to app back online against the restored DB. Assumes operator has shell access and the dump file is local. |
| **RPO** (Recovery Point Objective) | **< 24 hours** | Daily cron at 03:00 local. Anything written between the last backup and the incident is lost. |

If you need a tighter RPO than 24 h, switch to hourly backups or set up Postgres WAL archiving / streaming replication (out of scope for this MVP).

---

## Pre-conditions

The operator host that will run backup or restore must have:

1. **PostgreSQL 14+ client tools** on `PATH`: `pg_dump`, `pg_restore`, `psql`.
   - On Debian/Ubuntu: `sudo apt-get install postgresql-client-14` (or matching server version).
   - On macOS: `brew install libpq && brew link --force libpq`.
   - On Windows: install the EDB PostgreSQL installer and add `bin/` to `PATH`, or run inside WSL2.
2. A working `.env` at the project root containing a valid `DATABASE_URL` pointing at the **target** database (the one to back up, or the one to overwrite during restore).
3. Network access from the operator host to the Postgres server.
4. Write access to `./backups/` in the project root.
5. The user in `DATABASE_URL` must have privileges to `CREATE DATABASE` and terminate backends — typically the same role used by the app, or a separate admin role. (On Railway the injected user already has these privileges on its own DB.)
6. On Linux/macOS the operator should make the scripts executable once:
   ```bash
   chmod +x scripts/backup.sh scripts/restore.sh
   ```

---

## Backup

### Daily cron (recommended)

Add to the operator user's crontab:

```cron
0 3 * * * cd /path/to/exam-paper-system && ./scripts/backup.sh >> backups/cron.log 2>&1
```

This runs every day at 03:00 local time and appends script output to `backups/cron.log` in addition to the structured `backups/backup.log` the script writes itself. The script keeps the **7 most recent** dumps and deletes the rest.

Output file naming:
```
backups/exam-paper-system-YYYYMMDD-HHMMSS.dump
```

### Manual one-off

```bash
./scripts/backup.sh
```

Exits non-zero on any error so cron can alert on failure (e.g. via MAILTO or your monitoring system).

### Why `--format=custom` (`pg_dump -Fc`)?

The script uses `pg_dump --format=custom --compress=9` rather than plain SQL because the custom format:

- Supports **parallel restore** with `pg_restore -j N` (much faster recovery on multi-core hosts).
- Supports **selective restore** — recover a single table with `pg_restore -t Question` instead of restoring everything.
- Is compressed by default (we use level 9), so it travels well over slow uplinks for off-site copies.
- Carries a TOC that `pg_restore --list` can inspect without touching a database.

The trade-off vs `--format=plain` is that you can't `cat dump.sql | psql` — you must use `pg_restore`. For our use case the benefits outweigh that.

---

## Off-site copy strategy

Local backups protect against software bugs and accidental drops; they do **not** protect against fire, theft, ransomware, or whole-host loss. Pick at least one of the following and document the choice in your team wiki.

The school has no S3 budget, so we don't recommend AWS. Three viable options:

### Option A — rsync to a home server (recommended)

If the school IT lead runs a home server / NAS on a stable IP or a Tailscale / WireGuard mesh:

```bash
# On the app host, after backup.sh runs:
rsync -avz --delete \
  backups/ \
  ops@home-nas.tailscale-net:/srv/backups/exam-paper-system/
```

Combine with cron so it fires after `backup.sh` completes — e.g. wrap both calls in a single shell script. Use SSH key auth, never passwords.

### Option B — manual USB weekly

Cheapest, fully offline. Once per week, an authorised operator:

1. Plugs in a labelled, encrypted USB drive (LUKS / VeraCrypt / BitLocker).
2. Runs `cp backups/*.dump /media/usb/exam-paper-system-$(date +%Y-%m-%d)/`.
3. Stores the USB in a locked drawer in a different room from the server (ideally a different building).

Rotate two USBs so one is always off-site while the other is being written.

### Option C — cloud via `rclone`

`rclone` supports Google Drive, OneDrive, Dropbox, Backblaze B2, etc. — all available without an AWS account. Many schools already have a Microsoft 365 tenant with OneDrive for Business included.

One-time setup:
```bash
rclone config   # configure a remote called "school-onedrive"
```

Cron entry (after backup):
```cron
5 3 * * * rclone sync /path/to/exam-paper-system/backups school-onedrive:exam-paper-system-backups --max-age 30d
```

B2 is the cheapest commercial option (~$6/TB/month) if OneDrive isn't acceptable.

---

## Recovery procedure (step-by-step)

Use this when the dev/prod database is lost, corrupted, or rolled back to a known-good point.

### 1. Triage and declare

- Confirm the failure (app errors? `psql` connection refused? Bad migration?).
- Notify the escalation contact (see below).
- Decide which dump to restore — usually the most recent `.dump` file in `backups/`. List them:
  ```bash
  ls -lh backups/exam-paper-system-*.dump
  ```

### 2. Quarantine the broken DB (optional but recommended)

If you might want to forensically inspect the broken state, take a snapshot first:

```bash
pg_dump --format=custom --no-owner \
  --file=backups/PRE-RESTORE-$(date +%Y%m%d-%H%M%S).dump \
  "$DATABASE_URL"
```

(If the DB is so broken that this fails, skip — but try.)

### 3. Stop the app

So no new writes hit the soon-to-be-dropped DB:

- Local dev: stop `npm run dev` and the API container.
- Railway: in the Railway dashboard, **Pause** the API service. Restart it after the restore completes.

### 4. Run the restore script

```bash
./scripts/restore.sh ./backups/exam-paper-system-YYYYMMDD-HHMMSS.dump
```

You will be prompted:
```
Type "RESTORE" to confirm:
```
Type exactly `RESTORE` and press Enter. Anything else aborts.

The script:
1. Parses `DATABASE_URL` from `.env`.
2. Connects to the `postgres` maintenance DB on the same server.
3. Terminates all active connections to the target DB.
4. `DROP DATABASE IF EXISTS` + `CREATE DATABASE`.
5. Runs `pg_restore --clean --if-exists --no-owner` against the new DB.
6. Prints row counts for key tables.

### 5. Post-recovery validation

The script prints counts for `User`, `Subject`, `Question`, `Paper`, `MorningQuizSession`, `MorningQuizSubmission`. Sanity-check against what you expect for the day.

Optional deeper queries — paste into `psql "$DATABASE_URL"`:

```sql
-- Total students (User with role = 'student' if you store role that way; adapt as needed)
SELECT COUNT(*) AS users_total FROM "User";

-- Sessions scheduled for today
SELECT COUNT(*) AS sessions_today
FROM "MorningQuizSession"
WHERE "scheduledDate"::date = CURRENT_DATE;

-- Recent submissions (last 24 h) — should be 0 immediately after a restore from a
-- backup taken before this incident, which is expected.
SELECT COUNT(*) AS submissions_last_24h
FROM "MorningQuizSubmission"
WHERE "createdAt" > NOW() - INTERVAL '24 hours';

-- Most recent paper
SELECT id, title, "createdAt"
FROM "Paper"
ORDER BY "createdAt" DESC
LIMIT 5;
```

### 6. Reconcile Prisma client (if schema drifted)

If the codebase has migrated forward since the dump was taken, the restored DB may be on an older schema. In that case:

```bash
npx prisma migrate deploy   # apply any newer migrations
npx prisma generate         # regenerate the client
```

If the codebase has migrated *backwards* (rolled back), restore the matching Git commit before starting the app.

### 7. Restart the app

- Local: `npm run dev`.
- Railway: Resume the API service.

### 8. Smoke test

1. Log in with a known account.
2. Open the question bank — counts match the validation step.
3. Open a recent paper — questions render with LaTeX.
4. Run one morning-quiz dashboard load to confirm sessions render.

### 9. Write up the incident

Add a short note to the team wiki: what failed, which dump was used, RTO actually achieved, anything missing from this runbook.

---

## Recovery testing schedule

**Monthly DR drill** (recommended): the first Monday of each month, the operator:

1. Spins up a **staging** Postgres (Docker compose or a separate Railway Postgres plugin).
2. Points a copy of `.env` (with the staging `DATABASE_URL`) at it.
3. Runs `./scripts/restore.sh backups/<latest>.dump`.
4. Confirms counts and runs the smoke test.
5. Logs the drill date + outcome in `docs/dr-drill-log.md` (create on first drill).

A backup that has never been test-restored is not a backup. Catch broken backups in the drill, not in the real incident.

---

## Escalation contacts

> `<TODO: school IT lead — name, email, phone>`
> `<TODO: app maintainer (developer) — name, email>`
> `<TODO: Railway account owner — name, email>`

Fill these in before the runbook is considered "ready". Keep a printed copy somewhere the operator can find it even if the system is down.

---

## Known limitations

- No point-in-time recovery (PITR). RPO is capped by the cron interval.
- The dev DB has **no** automatic backup unless an operator has installed cron. Treat unbacked dev data as expendable.
- The script does not encrypt dump files at rest. If backups contain PII (student names + emails), enable disk encryption on the backup host and on any USB drive used for off-site copies.
- `pg_restore --clean --if-exists` is used after we drop+recreate the DB, so it is functionally a no-op on the second pass — kept for safety in case the operator points the script at a non-empty DB.
