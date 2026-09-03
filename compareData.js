const mysql = require('mysql2/promise');
require('dotenv').config();

async function compare() {
  const localConn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: process.env.DB_PASSWORD, database: 'anime_plus'
  });

  const renderConn = await mysql.createConnection({
    host: 'bzghmg7xeoovrz4bittf-mysql.services.clever-cloud.com',
    user: 'ul41bzmocqkqb3ln',
    password: 'IE19zfzTcNhyojIXRiI8',
    database: 'bzghmg7xeoovrz4bittf',
    ssl: { rejectUnauthorized: false }
  });

  console.log('🔍 جاري مقارنة بيانات جدول comings بين اللوكال وسيرفر الإنتاج:\n');

  const [localRows] = await localConn.query('SELECT * FROM comings LIMIT 2');
  const [renderRows] = await renderConn.query('SELECT * FROM comings LIMIT 2');

  console.log('📌 البيانات في Localhost:');
  console.log(localRows[0]);

  console.log('\n📌 البيانات في Clever Cloud (Render DB):');
  console.log(renderRows[0]);

  await localConn.end();
  await renderConn.end();
}

compare().catch(console.error);