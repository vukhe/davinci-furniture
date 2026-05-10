#!/usr/bin/env node
/**
 * Database initialization script
 * Usage: node setup-db.js
 * 
 * This script:
 * 1. Connects to SQL Server
 * 2. Creates the database if it doesn't exist
 * 3. Executes the schema.sql file
 * 4. Verifies table creation
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '123456',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  }
};

const targetDb = process.env.DB_NAME || 'DAVINCI_FURNITURE';

async function setupDatabase() {
  let pool = null;
  
  try {
    console.log('\n📦 Starting database setup...\n');

    // 1. Connect to master database
    console.log(`🔗 Connecting to SQL Server at ${dbConfig.server}...`);
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to master database\n');

    // 2. Check if database exists, create if not
    console.log(`📋 Checking if database "${targetDb}" exists...`);
    const dbCheckResult = await pool.request()
      .query(`SELECT name FROM sys.databases WHERE name = '${targetDb}'`);
    
    if (dbCheckResult.recordset.length === 0) {
      console.log(`⚙️  Creating database "${targetDb}"...`);
      await pool.request().query(`CREATE DATABASE [${targetDb}]`);
      console.log(`✅ Database "${targetDb}" created\n`);
    } else {
      console.log(`✅ Database "${targetDb}" already exists\n`);
    }

    // 3. Close connection and reconnect to target database
    if (pool) await pool.close();
    
    dbConfig.database = targetDb;
    console.log(`🔗 Connecting to ${targetDb}...`);
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to target database\n');

    // 4. Execute schema.sql
    const schemaPath = path.join(__dirname, 'backend', 'config', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error(`❌ Schema file not found: ${schemaPath}`);
      process.exit(1);
    }

    console.log(`📄 Reading schema file: ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split by GO statements and execute
    console.log('⚙️  Executing schema...\n');
    const statements = schema.split('GO').filter(s => s.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      
      try {
        await pool.request().query(stmt);
        process.stdout.write('.');
      } catch (err) {
        // Ignore already exists errors
        if (!err.message.includes('already exists')) {
          console.error(`\n❌ Error executing statement ${i + 1}:`);
          console.error(err.message);
        }
      }
    }
    console.log('\n');

    // 5. Verify tables
    console.log('✅ Verifying tables...');
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) as count FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = 'dbo'
      `);
    
    const tableCount = tableCheck.recordset[0].count;
    console.log(`✅ Found ${tableCount} tables in database\n`);

    // List key tables
    const keyTables = ['Users', 'Products', 'Orders', 'UserInteractions'];
    console.log('📊 Key tables status:');
    
    for (const table of keyTables) {
      const result = await pool.request()
        .query(`SELECT COUNT(*) as exists_flag FROM sysobjects WHERE name='${table}' AND xtype='U'`);
      const exists = result.recordset[0].exists_flag > 0;
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }

    console.log('\n✨ Database setup completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Update .env file with correct credentials');
    console.log('  2. Run: cd backend && npm install');
    console.log('  3. Run: cd frontend && npm install');
    console.log('  4. Run: npm run dev (in backend) to start backend');
    console.log('  5. Run: npm run dev (in frontend) to start frontend\n');

  } catch (error) {
    console.error('\n❌ Database setup failed!');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  • Check SQL Server is running');
    console.error('  • Verify DB_SERVER in .env (e.g., "localhost" or "LAPTOP\\SQLEXPRESS")');
    console.error('  • Verify DB_USER and DB_PASSWORD in .env');
    console.error('  • Check firewall settings\n');
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

setupDatabase();
