const fs = require('fs');
const path = require('path');

async function runMigrations() {
  // Import db here to avoid circular dependency issues
  const db = require('./postgres-js-db');
  const sql = db.sql;
  
  try {
    console.log('Starting database migrations...');

    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s)`);

    for (const file of files) {
      // Check if migration has already been applied
      const existing = await sql`
        SELECT * FROM schema_migrations WHERE migration_name = ${file}
      `;

      if (existing.length > 0) {
        console.log(`✓ ${file} - already applied`);
        continue;
      }

      // Read and execute migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      console.log(`Running migration: ${file}`);
      
      // Execute the migration
      await sql.unsafe(migrationSQL);

      // Record that migration was applied
      await sql`
        INSERT INTO schema_migrations (migration_name)
        VALUES (${file})
      `;

      console.log(`✓ ${file} - applied successfully`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  const db = require('./postgres-js-db');
  
  (async () => {
    try {
      await db.init();
      await runMigrations();
      console.log('Migration process completed');
      process.exit(0);
    } catch (error) {
      console.error('Migration process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { runMigrations };
