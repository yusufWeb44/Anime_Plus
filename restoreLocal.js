const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function restoreLocal() {
  console.log('🔄 جاري الاتصال بقاعدة البيانات المحلية (anime_plus)...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'YusufEyyubi44-.',
    database: process.env.DB_NAME || 'anime_plus',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });

  try {
    if (fs.existsSync('full_backup.sql')) {
      console.log('📖 جاري قراءة ملف full_backup.sql وإعادة شحنه محلياً...');
      const sql = fs.readFileSync('full_backup.sql', 'utf8');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
      await connection.query(sql);
      await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('✅ تم استرجاع كافة البيانات والأنميات محلياً بنجاح 100%!');
    } else {
      console.log('⚠️ لم يتم العثور على full_backup.sql، يرجى التاكد من وجود الملف.');
    }
  } catch (err) {
    console.error('❌ حدث خطأ أثناء الاسترجاع:', err.message);
  } finally {
    await connection.end();
  }
}

restoreLocal();