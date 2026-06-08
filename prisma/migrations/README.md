# Migration Notes

The app currently uses MySQL on Railway (`datasource db.provider = "mysql"`).

Older migration folders in this repo were generated while the app used SQLite.
They are intentionally not a safe migration path for a fresh MySQL database
because they contain SQLite-specific SQL such as `PRAGMA` statements and table
redefinition migrations.

For the current Railway MySQL database, do not run `prisma migrate reset`.
Apply small forward-only MySQL migrations against the existing data instead.

If the database is missing `matrixcolumn.archivedAt`, run the archive-column
migration directly, then mark that migration as applied:

```sh
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260608090000_archive_matrix_columns/migration.sql
npx prisma migrate resolve --applied 20260608090000_archive_matrix_columns
```

After that, normal deployments can use:

```sh
npx prisma migrate deploy
```
