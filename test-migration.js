#!/usr/bin/env node

// Simple script to test database migrations
const Database = require('./server/database/db');

async function testMigration() {
  console.log('🧪 Testing database migration...');
  
  try {
    // Initialize database (this will run migrations)
    Database.init();
    
    // Wait a moment for async operations
    setTimeout(async () => {
      try {
        // Check if smtp_no_auth setting exists
        const setting = await Database.get('SELECT * FROM settings WHERE key = ?', ['smtp_no_auth']);
        
        if (setting) {
          console.log('✅ smtp_no_auth setting found:', setting);
        } else {
          console.log('❌ smtp_no_auth setting not found');
        }
        
        // Check migrations table
        const migrations = await Database.all('SELECT * FROM migrations ORDER BY executed_at');
        console.log('📋 Executed migrations:');
        migrations.forEach(m => {
          console.log(`   ${m.version}: ${m.description} (${m.executed_at})`);
        });
        
        await Database.close();
        console.log('✅ Migration test completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Migration test failed:', error);
        process.exit(1);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

testMigration();