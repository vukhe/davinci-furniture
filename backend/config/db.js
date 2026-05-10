const sql = require('mssql');
require('dotenv').config();

// Support named instance (LAPTOP\SQLEXPRESS) and normal IP
const rawServer = process.env.DB_SERVER || 'localhost';
const isNamed   = rawServer.includes('\\');
const serverHost = isNamed ? rawServer.split('\\')[0] : rawServer;
const instanceName = isNamed ? rawServer.split('\\')[1] : undefined;

const dbConfig = {
  server:   serverHost,
  database: process.env.DB_NAME || 'DAVINCI_FURNITURE',
  user:     process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    instanceName,                  // dùng khi là named instance
    port:                   isNamed ? undefined : (parseInt(process.env.DB_PORT) || 1433),
    encrypt:                false, // local Windows SQL Server
    trustServerCertificate: true,
    enableArithAbort:       true,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
  // Connection pool cho 100 concurrent users
  pool: {
    max:                  30,   // max 30 connections cùng lúc
    min:                   5,   // luôn giữ sẵn 5
    idleTimeoutMillis:  30000,
    acquireTimeoutMillis: 10000,
    createTimeoutMillis:  10000,
    reapIntervalMillis:    1000,
    createRetryIntervalMillis: 200,
  },
};

let pool = null;

const connectDB = async () => {
  try {
    pool = await sql.connect(dbConfig);
    pool.on('error', (err) => {
      console.error('Pool error:', err);
    });
    console.log(`✅ SQL Server: ${serverHost}${instanceName ? '\\' + instanceName : ''}/${dbConfig.database}`);
    return pool;
  } catch (error) {
    console.error('❌ DB connection failed:', error.message);
    process.exit(1);
  }
};

const getPool = () => {
  if (!pool) throw new Error('DB not initialized');
  return pool;
};

const query = async (queryString, inputs = []) => {
  const p = getPool();
  const request = p.request();
  inputs.forEach(({ name, type, value }) => {
    request.input(name, type, value);
  });
  return await request.query(queryString);
};

module.exports = { sql, connectDB, getPool, query };
