const postgres = require('postgres');

class Database {
  constructor() {
    this.sql = null;
  }

  async init() {
    // Database connection configuration
    const connectionString = `postgresql://${process.env.DB_USER || 'netcontrol'}:${process.env.DB_PASSWORD || 'NetControl2024!'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`;
    
    this.sql = postgres(connectionString, {
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
    });

    console.log('Connected to PostgreSQL database using postgres.js');
    await this.createTables();
  }

  async createTables() {
    try {
      // Users table for authentication
      await this.sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          call_sign VARCHAR(20),
          name VARCHAR(255),
          active BOOLEAN DEFAULT true,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP
        )
      `;

      // Settings table
      await this.sql`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) NOT NULL UNIQUE,
          value TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Operators table
      await this.sql`
        CREATE TABLE IF NOT EXISTS operators (
          id SERIAL PRIMARY KEY,
          call_sign VARCHAR(20) NOT NULL UNIQUE,
          name VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(50),
          zip VARCHAR(20),
          license_class VARCHAR(20),
          active BOOLEAN DEFAULT true,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Sessions table
      await this.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_date DATE NOT NULL,
          net_control_call VARCHAR(20) NOT NULL,
          net_control_name VARCHAR(255),
          start_time TIME,
          end_time TIME,
          frequency VARCHAR(20),
          mode VARCHAR(20) DEFAULT 'FM',
          power VARCHAR(50),
          antenna VARCHAR(255),
          weather TEXT,
          notes TEXT,
          net_type VARCHAR(50) DEFAULT 'Regular',
          total_checkins INTEGER DEFAULT 0,
          total_traffic INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Add missing columns to existing sessions table if they don't exist
      try {
        await this.sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS power VARCHAR(50)`;
        await this.sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS antenna VARCHAR(255)`;
        await this.sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS weather TEXT`;
        await this.sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS net_type VARCHAR(50) DEFAULT 'Regular'`;
        
        // Rename weather_report to weather if it exists
        await this.sql`
          DO $$ 
          BEGIN 
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='weather_report') THEN
              ALTER TABLE sessions RENAME COLUMN weather_report TO weather;
            END IF;
          END $$;
        `;
      } catch (alterError) {
        console.log('Note: Some column alterations may have failed (this is normal if columns already exist)');
      }

      // Session participants table
      await this.sql`
        CREATE TABLE IF NOT EXISTS session_participants (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          operator_id INTEGER REFERENCES operators(id),
          call_sign VARCHAR(20) NOT NULL,
          name VARCHAR(255),
          check_in_time TIME,
          check_out_time TIME,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migration: Add operator_id column if it doesn't exist
      try {
        await this.sql`ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES operators(id)`;
        console.log('Migration: Added operator_id column to session_participants table');
      } catch (error) {
        // Column might already exist, ignore error
        console.log('Migration: operator_id column already exists or migration failed:', error.message);
      }

      // Session traffic table
      await this.sql`
        CREATE TABLE IF NOT EXISTS session_traffic (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          from_call VARCHAR(20) NOT NULL,
          to_call VARCHAR(20) NOT NULL,
          message_number VARCHAR(50),
          precedence VARCHAR(20) DEFAULT 'Routine',
          message_text TEXT,
          time_received TIME,
          handled_by VARCHAR(20),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // FCC amateur records table
      await this.sql`
        CREATE TABLE IF NOT EXISTS fcc_amateur_records (
          id SERIAL PRIMARY KEY,
          call_sign VARCHAR(20) NOT NULL UNIQUE,
          operator_class VARCHAR(50),
          group_code VARCHAR(10),
          region_code VARCHAR(10),
          trustee_call_sign VARCHAR(20),
          trustee_indicator VARCHAR(10),
          physician_certification VARCHAR(10),
          ve_signature VARCHAR(10),
          systematic_call_sign_change VARCHAR(10),
          vanity_call_sign_change VARCHAR(10),
          vanity_relationship VARCHAR(10),
          previous_call_sign VARCHAR(20),
          previous_operator_class VARCHAR(50),
          trustee_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // FCC entity records table
      await this.sql`
        CREATE TABLE IF NOT EXISTS fcc_entity_records (
          id SERIAL PRIMARY KEY,
          call_sign VARCHAR(20) NOT NULL,
          entity_type VARCHAR(10),
          licensee_id VARCHAR(20),
          entity_name VARCHAR(255),
          first_name VARCHAR(100),
          mi VARCHAR(10),
          last_name VARCHAR(100),
          suffix VARCHAR(20),
          phone VARCHAR(20),
          fax VARCHAR(20),
          email VARCHAR(255),
          street_address VARCHAR(255),
          city VARCHAR(100),
          state VARCHAR(50),
          zip_code VARCHAR(20),
          po_box VARCHAR(50),
          attention_line VARCHAR(255),
          sgin VARCHAR(10),
          frn VARCHAR(20),
          applicant_type_code VARCHAR(10),
          applicant_type_other VARCHAR(100),
          status_code VARCHAR(10),
          status_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Create indexes for better search performance
      await this.sql`CREATE INDEX IF NOT EXISTS idx_fcc_amateur_call_sign ON fcc_amateur_records(call_sign)`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_fcc_entity_call_sign ON fcc_entity_records(call_sign)`;

      // Check if default admin user exists
      const userCount = await this.sql`SELECT COUNT(*) as count FROM users`;
      
      if (userCount[0].count === '0') {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('admin123', 12);
        
        await this.sql`
          INSERT INTO users (username, password_hash, email, role, name, call_sign)
          VALUES (${'admin'}, ${hash}, ${'admin@netcontrol.local'}, ${'admin'}, ${'System Administrator'}, ${'W1AW'})
        `;
        
        console.log('Created default admin user');
      }

      // Insert default settings
      const defaultSettings = [
        // Application settings
        ['app_name', 'NetControl', 'Application name'],
        ['app_description', 'Ham Radio Net Management', 'Application description'],
        ['default_net_control', '', 'Default net control callsign'],
        ['default_net_frequency', '', 'Default net frequency'],
        ['default_net_time', '', 'Default net start time'],
        ['default_net_power', '', 'Default net power'],
        ['default_grid_square', '', 'Default grid square'],
        ['distance_unit', 'miles', 'Distance unit (miles or kilometers)'],
        
        // SMTP/Email settings
        ['smtp_host', '', 'SMTP server hostname'],
        ['smtp_port', '587', 'SMTP server port'],
        ['smtp_secure', 'false', 'Use SSL/TLS'],
        ['smtp_starttls', 'true', 'Use STARTTLS'],
        ['smtp_no_auth', 'false', 'SMTP requires no authentication'],
        ['smtp_username', '', 'SMTP username'],
        ['smtp_password', '', 'SMTP password'],
        ['smtp_from_email', 'netcontrol@example.com', 'From email address'],
        ['smtp_from_name', 'NetControl System', 'From name'],
        
        // QRZ settings
        ['qrz_username', '', 'QRZ.com username'],
        ['qrz_password', '', 'QRZ.com password'],
        
        // Pre-check-in settings
        ['precheckin_url', 'https://brars.hamsunite.org/api/pre-checkin', 'BRARS Pre-check-in API URL'],
        ['netreport_url', 'https://brars.hamsunite.org/api/net-report', 'Net Report submission URL'],
        
        // UI settings
        ['theme', 'light', 'UI theme (light, dark, auto)'],
        ['items_per_page', '25', 'Items per page in tables'],
        
        // Database settings
        ['auto_backup_enabled', 'false', 'Enable automatic database backups'],
        ['auto_backup_interval', '24', 'Backup interval in hours'],
        
        // Security settings
        ['session_timeout', '24', 'Session timeout in hours'],
        ['require_password_change', 'false', 'Require password change on first login'],
        ['min_password_length', '6', 'Minimum password length']
      ];

      for (const [key, value, description] of defaultSettings) {
        await this.sql`
          INSERT INTO settings (key, value, description)
          VALUES (${key}, ${value}, ${description})
          ON CONFLICT (key) DO NOTHING
        `;
      }

      console.log('Database tables created successfully');
      
    } catch (error) {
      console.error('Error creating tables:', error);
    }
  }

  async query(text, params = []) {
    try {
      // Convert parameterized query to postgres.js format
      if (params.length > 0) {
        // Replace $1, $2, etc. with actual parameters
        let query = text;
        params.forEach((param, index) => {
          query = query.replace(`$${index + 1}`, `'${param}'`);
        });
        return await this.sql.unsafe(query);
      } else {
        return await this.sql.unsafe(text);
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async close() {
    if (this.sql) {
      await this.sql.end();
    }
  }
}

const db = new Database();
module.exports = db;