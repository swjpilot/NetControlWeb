const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/netcontrol', {
  max: 1,
});

async function checkPhoneColumn() {
  try {
    // Check if phone_number column exists
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'phone_number'
    `;
    
    if (result.length > 0) {
      console.log('✓ phone_number column exists:', result[0]);
      
      // Try to query users with phone numbers
      const users = await sql`
        SELECT id, username, phone_number 
        FROM users 
        LIMIT 5
      `;
      console.log('\nSample users:', users);
    } else {
      console.log('✗ phone_number column does NOT exist');
    }
    
    // Check migration status
    const migrations = await sql`
      SELECT * FROM schema_migrations 
      WHERE migration_name LIKE '%phone%'
    `;
    console.log('\nPhone-related migrations:', migrations);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.end();
  }
}

checkPhoneColumn();
