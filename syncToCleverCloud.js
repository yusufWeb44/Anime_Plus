const mysql = require('mysql2/promise');
require('dotenv').config();

async function syncDirect() {
  console.log('🔌 1. الاتصال بـ Localhost (anime_plus)...');

  const localConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'anime_plus',
    port: process.env.DB_PORT || 3306,
    dateStrings: true
  });

  console.log('🔌 2. الاتصال بقاعدة بيانات Clever Cloud...');

  const renderConn = await mysql.createConnection({
    host: 'bzghmg7xeoovrz4bittf-mysql.services.clever-cloud.com',
    user: 'ul41bzmocqkqb3ln',
    password: 'IE19zfzTcNhyojIXRiI8',
    database: 'bzghmg7xeoovrz4bittf',
    port: 3306,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
  });

  try {
    console.log('🔄 3. إيقاف القيود المرجعية وتنظيف الجداول...');
    await renderConn.query('SET FOREIGN_KEY_CHECKS = 0;');

    const [tables] = await localConn.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    // 1. مسح الجداول القديمة
    for (const table of tableNames) {
      await renderConn.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }

    // 2. إنشاء الجداول ونقل البيانات
    for (const table of tableNames) {
      console.log(`📦 جاري نقل جدول: [ ${table} ]...`);

      const [createTableResult] = await localConn.query(`SHOW CREATE TABLE \`${table}\``);
      let createSql = createTableResult[0]['Create Table'];

      // إزالة جميع أسطر الـ FOREIGN KEY لتجنب خطأ Duplicate Constraint تماماً
      createSql = createSql
        .split('\n')
        .filter(line => !line.includes('FOREIGN KEY') && !line.includes('CONSTRAINT'))
        .join('\n')
        .replace(/,\s*\n\)/g, '\n)'); // تنظيف الفواصل الزائدة قبل القوس الأخير

      await renderConn.query(createSql);

      // 3. نقل كافة البيانات
      const [rows] = await localConn.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');

          await renderConn.query(`INSERT INTO \`${table}\` (${keys}) VALUES (${values});`);
        }
      }
    }

    await renderConn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('\n🎉 تم نقل قاعدة بيانات anime_plus بالكامل وبجداولها وبياناتها إلى Clever Cloud بنجاح!');

  } catch (err) {
    console.error('❌ حدث خطأ أثناء المزامنة:', err.message);
  } finally {
    await localConn.end();
    await renderConn.end();
  }
}

syncDirect();