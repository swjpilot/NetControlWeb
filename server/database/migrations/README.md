# Database Migrations

This directory contains SQL migration files for the NetControl database schema.

## Running Migrations

To run all pending migrations:

```bash
npm run migrate
```

Or directly:

```bash
node server/database/migrate.js
```

## Migration Files

Migrations are numbered sequentially and run in order:

- `001_add_phone_number_to_users.sql` - Adds phone_number field to users table

## Creating New Migrations

1. Create a new `.sql` file in this directory with the next sequential number
2. Name it descriptively: `00X_description_of_change.sql`
3. Write your SQL migration code
4. Run `npm run migrate` to apply it

## Migration Tracking

The system automatically tracks which migrations have been applied in the `schema_migrations` table. Each migration is only run once.

## Notes

- Migrations are run in alphabetical order
- Use `IF NOT EXISTS` or `IF EXISTS` clauses to make migrations idempotent
- Always test migrations on a development database first
- The migration system is safe to run multiple times
