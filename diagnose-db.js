#!/usr/bin/env node
/**
 * SQL Server Connection Diagnostic
 * Tests various connection configurations to find the correct one
 */

require('dotenv').config();
const sql = require('mssql');

const tests = [
  {
    name: 'localhost (Windows Auth)',
    config: {
      server: 'localhost',
      database: 'DAVINCI_FURNITURE',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        integratedSecurity: true,
      },
    },
  },
  {
    name: 'localhost\SQLEXPRESS (Windows Auth)',
    config: {
      server: 'localhost\SQLEXPRESS',
      user: 'sa',
      password: '123456',
      database: 'DAVINCI_FURNITURE',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        
      },
    },
  },
  {
    name: 'localhost (SQL Auth - sa with empty password)',
    config: {
      server: 'localhost',
      user: 'sa',
      password: '123456',
      database: 'DAVINCI_FURNITURE',
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
  },
  {
    name: 'localhost (SQL Auth - sa with password "123456")',
    config: {
      server: 'localhost',
      user: 'sa',
      password: '123456',
      database: 'DAVINCI_FURNITURE',
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
  },
  
  {
    name: '127.0.0.1 (Windows Auth)',
    config: {
      server: '127.0.0.1',
      database: 'DAVINCI_FURNITURE',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        integratedSecurity: true,
      },
    },
  },
];

async function testConnection(config) {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT @@VERSION as version, GETDATE() as now');
    await pool.close();
    return { success: true, data: result.recordset[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  🔍 SQL Server Connection Diagnostic  ║');
  console.log('╚════════════════════════════════════════╝\n');

  let foundConnection = false;

  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}... `);
    const result = await testConnection(test.config);

    if (result.success) {
      console.log('\x1b[32m✅ SUCCESS\x1b[0m');
      console.log('\n🎉 Found working connection!\n');
      console.log('Update your .env file with:\n');

      if (test.config.options?.integratedSecurity) {
        console.log(`  DB_SERVER=${test.config.server}`);
        console.log('  DB_USER=');
        console.log('  DB_PASSWORD=');
        console.log('\n  (Using Windows Authentication)\n');
      } else {
        console.log(`  DB_SERVER=${test.config.server}`);
        console.log(`  DB_USER=${test.config.user}`);
        console.log(`  DB_PASSWORD=${test.config.password}`);
        console.log('\n  (Using SQL Authentication)\n');
      }

      console.log('Connection Details:');
      console.log(`  SQL Server Version: ${result.data.version}`);
      console.log(`  Current Time: ${result.data.now}\n`);

      foundConnection = true;
      break;
    } else {
      console.log('\x1b[31m❌ Failed\x1b[0m');
      if (result.error.includes('integratedSecurity')) {
        console.log(`    (Windows Auth not available)`);
      }
    }
  }

  if (!foundConnection) {
    console.log('\n\x1b[33m⚠️  No working connection found!\x1b[0m\n');
    console.log('Try these troubleshooting steps:\n');
    console.log('1. Verify SQL Server is running:');
    console.log('   Get-Service -Name "MSSQL*" | Select Name, Status\n');

    console.log('2. Check your sa password in SQL Server Management Studio:\n');
    console.log('   • Right-click "sa" login');
    console.log('   • Properties → General → Password\n');

    console.log('3. Enable SQL Server Authentication:');
    console.log('   • SSMS → Properties → Security → Mixed mode\n');

    console.log('4. Try using Windows Authentication (recommended):');
    console.log('   DB_SERVER=localhost');
    console.log('   DB_USER=');
    console.log('   DB_PASSWORD=\n');
  }
}

runTests().catch(console.error);
