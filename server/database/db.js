const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  init() {
    const dbPath = path.join(__dirname, '../data/netcontrol.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    // Users table for authentication
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        call_sign TEXT,
        name TEXT,
        active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Create default admin user if no users exist
    this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (!err && row.count === 0) {
        const bcrypt = require('bcrypt');
        bcrypt.hash('admin123', 12, (hashErr, hash) => {
          if (!hashErr) {
            this.db.run(`
              INSERT INTO users (username, password_hash, email, role, name, call_sign)
              VALUES ('admin', ?, 'admin@netcontrol.local', 'admin', 'System Administrator', 'W1AW')
            `, [hash], (insertErr) => {
              if (!insertErr) {
                console.log('Default admin user created: admin/admin123 (W1AW)');
              }
            });
          }
        });
      }
    });

    // Operators table (equivalent to NetControlSet)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS operators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_sign TEXT NOT NULL UNIQUE,
        name TEXT,
        street TEXT,
        location TEXT,
        comment TEXT,
        date TEXT,
        has_comments BOOLEAN DEFAULT 0,
        has_traffic BOOLEAN DEFAULT 0,
        acknowledged BOOLEAN DEFAULT 0,
        class TEXT,
        grid TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Sessions table (net sessions by date)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_date DATE NOT NULL UNIQUE,
        start_time TIME,
        end_time TIME,
        net_control_call TEXT NOT NULL,
        net_control_name TEXT,
        frequency TEXT,
        mode TEXT DEFAULT 'FM',
        power TEXT,
        antenna TEXT,
        weather TEXT,
        notes TEXT,
        net_type TEXT DEFAULT 'Regular',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Add missing columns to existing users table if they don't exist
    this.db.run(`ALTER TABLE users ADD COLUMN call_sign TEXT`, () => {});
    this.db.run(`ALTER TABLE users ADD COLUMN name TEXT`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN frequency TEXT`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'FM'`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN power TEXT`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN antenna TEXT`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN weather TEXT`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN net_type TEXT DEFAULT 'Regular'`, () => {});
    this.db.run(`ALTER TABLE sessions ADD COLUMN created_by INTEGER`, () => {});

    // Add missing columns to existing session_participants table if they don't exist
    this.db.run(`ALTER TABLE session_participants ADD COLUMN call_sign TEXT`, () => {});
    this.db.run(`ALTER TABLE session_participants ADD COLUMN notes TEXT`, () => {});
    this.db.run(`ALTER TABLE session_participants ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
    this.db.run(`ALTER TABLE session_participants ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});

    // Session participants (many-to-many relationship)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        operator_id INTEGER,
        call_sign TEXT,
        check_in_time TIME,
        check_out_time TIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (operator_id) REFERENCES operators (id)
      )
    `);

    // Session traffic table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_traffic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        from_operator_id INTEGER,
        to_operator_id INTEGER,
        from_call TEXT,
        to_call TEXT,
        message_type TEXT DEFAULT 'Routine',
        precedence TEXT DEFAULT 'Routine',
        message_content TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (from_operator_id) REFERENCES operators (id),
        FOREIGN KEY (to_operator_id) REFERENCES operators (id)
      )
    `);

    // FCC Database tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS fcc_en (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_type TEXT,
        unique_system_identifier INTEGER,
        uls_file_number TEXT,
        ebf_number TEXT,
        call_sign TEXT,
        entity_type TEXT,
        licensee_id TEXT,
        entity_name TEXT,
        first_name TEXT,
        mi TEXT,
        last_name TEXT,
        suffix TEXT,
        phone TEXT,
        fax TEXT,
        email TEXT,
        street_address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        po_box TEXT,
        attention_line TEXT,
        sgin TEXT,
        frn TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS fcc_am (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_type TEXT,
        unique_system_identifier INTEGER,
        uls_file_number TEXT,
        ebf_number TEXT,
        call_sign TEXT,
        operator_class TEXT,
        group_code TEXT,
        region_code INTEGER,
        trustee_call_sign TEXT,
        trustee_indicator TEXT,
        physician_certification TEXT,
        ve_signature TEXT,
        systematic_call_sign_change TEXT,
        vanity_call_sign_change TEXT,
        vanity_relationship TEXT,
        previous_call_sign TEXT,
        previous_operator_class TEXT,
        trustee_name TEXT
      )
    `);

    // QRZ lookup cache
    this.db.run(`
      CREATE TABLE IF NOT EXISTS qrz_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_sign TEXT UNIQUE,
        name_first TEXT,
        name_last TEXT,
        name_mi TEXT,
        name_nick TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        phone_cell TEXT,
        phone_home TEXT,
        email_address TEXT,
        license_class TEXT,
        expiration_date TEXT,
        country TEXT,
        county TEXT,
        grid TEXT,
        distance TEXT,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audio recordings
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audio_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        filename TEXT,
        file_path TEXT,
        duration INTEGER,
        file_size INTEGER,
        format TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `);

    // Settings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables created/verified');
    
    // Run database migrations
    this.runMigrations();
    
    // Add a test session if no sessions exist (for debugging)
    this.db.get('SELECT COUNT(*) as count FROM sessions', (err, row) => {
      if (!err && row.count === 0) {
        this.db.run(`
          INSERT INTO sessions (
            session_date, net_control_call, net_control_name, 
            start_time, end_time, frequency, mode, notes, net_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          '2024-01-15',
          'W1AW',
          'Test Operator',
          '19:00',
          '20:00',
          '146.520 MHz',
          'FM',
          'Test session for debugging',
          'Regular'
        ], (insertErr) => {
          if (!insertErr) {
            console.log('Test session created for debugging');
          } else {
            console.error('Error creating test session:', insertErr);
          }
        });
      }
    });
  }

  // Helper methods for common operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Database migration system
  async runMigrations() {
    try {
      // Create migrations table if it doesn't exist
      await this.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT UNIQUE,
          description TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Define migrations
      const migrations = [
        {
          version: '1.0.0',
          description: 'Add smtp_no_auth setting support',
          migrate: async () => {
            // Check if smtp_no_auth setting exists, if not add default value
            const existing = await this.get('SELECT value FROM settings WHERE key = ?', ['smtp_no_auth']);
            if (!existing) {
              await this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['smtp_no_auth', 'false']);
              console.log('✅ Added smtp_no_auth setting (default: false)');
            }
          }
        }
        // Add future migrations here
      ];

      // Run pending migrations
      for (const migration of migrations) {
        const executed = await this.get('SELECT * FROM migrations WHERE version = ?', [migration.version]);
        
        if (!executed) {
          console.log(`🔄 Running migration ${migration.version}: ${migration.description}`);
          await migration.migrate();
          await this.run('INSERT INTO migrations (version, description) VALUES (?, ?)', 
            [migration.version, migration.description]);
          console.log(`✅ Migration ${migration.version} completed`);
        }
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
    }
  }

  // Helper method to get settings with defaults
  async getSettings(keys) {
    const settings = {};
    for (const key of keys) {
      const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
      settings[key] = row ? row.value : null;
    }
    return settings;
  }
}

module.exports = new Database();