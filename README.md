# Basic Sync from Postgres to SQLite using ElectricSQL

## Overview

This is a basic example of how to sync data from Postgres to SQLite read replica using ElectricSQL.

## Setup

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Run `docker compose up` to start the Postgres and ElectricSQL servers
4. Run `npm run sync` to start the sync to SQLite process

## Adding data to Postgres

Run `docker compose exec postgres psql -U postgres -d electric` to start a `psql` terminal to the Postgres server. You can use this to add data to the Postgres table.

```sql
INSERT INTO items (name, description) VALUES ('Item A', 'Description A');
INSERT INTO items (name, description) VALUES ('Item B', 'Description B');
INSERT INTO items (name, description) VALUES ('Item C', 'Description C');
```

## Viewing the data in SQLite

Run `sqlite3 local.db` to start a `sqlite3` terminal to the SQLite database. You can use this to view the data in the SQLite table.

```sql
SELECT * FROM items;
```

## Stopping the sync

`Ctrl+C` in the terminal where the sync is running to stop it.

Run `docker compose down` to stop the Postgres and ElectricSQL servers and remove the volumes.

The sync maintains the offset in the `sync_state` table in the SQLite database. If you stop the sync and restart it, it will resume from the same offset.

## Resetting the sync

If you want to reset the sync, you can delete the `local.db` file and restart the sync.

To clear the Postgres data, you can run `docker compose down -v` to stop the Postgres and ElectricSQL servers and remove the volumes.
