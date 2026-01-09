const { Client } = require('pg');

exports.handler = async (event) => {
  console.log('Starting database connection test...');
  console.log('Environment variables:', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD ? '***' : 'undefined'
  });

  let dbClient = null;
  
  try {
    console.log('Creating database client...');
    dbClient = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000, // 10 second timeout
      query_timeout: 5000 // 5 second query timeout
    });
    
    console.log('Attempting to connect to database...');
    await dbClient.connect();
    console.log('Database connection successful!');
    
    console.log('Testing simple query...');
    const result = await dbClient.query('SELECT NOW() as current_time');
    console.log('Query result:', result.rows[0]);
    
    await dbClient.end();
    console.log('Database connection closed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Database connection test successful',
        timestamp: result.rows[0].current_time
      })
    };
    
  } catch (error) {
    console.error('Database connection error:', error);
    
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      })
    };
  }
};