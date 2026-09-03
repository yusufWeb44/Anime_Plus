const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspectJujutsu() {
  console.log('🔍 جاري جلب بيانات Jujutsu Kaisen من السيرفرين...\n');

  // 1. الاتصال بـ Localhost
  const localConn = await mysql.createConnection({
    host: 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'anime_plus'
  });

  // 2. الاتصال بـ Clever Cloud (Render DB)
  const renderConn = await mysql.createConnection({
    host: 'bzghmg7xeoovrz4bittf-mysql.services.clever-cloud.com',
    user: 'ul41bzmocqkqb3ln',
    password: 'IE19zfzTcNhyojIXRiI8',
    database: 'bzghmg7xeoovrz4bittf',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // استعلام البحث عن الأنمي بجدول comings
    const query = "SELECT * FROM comings WHERE name LIKE '%Jujutsu%' OR description LIKE '%Jujutsu%' LIMIT 1;";

    const [localRows] = await localConn.query(query);
    const [renderRows] = await renderConn.query(query);

    console.log('========= 🏠 البيانات في LOCALHOST (anime_plus) =========');
    if (localRows.length > 0) {
      console.log('📌 الاسم (Name):       ', localRows[0].name);
      console.log('🖼️ رابط الصورة (src): ', localRows[0].src);
      console.log('📅 سنة العرض (Year):  ', localRows[0].year);
      console.log('🕒 آخر تحديث:          ', localRows[0].updatedAt);
      console.log('\n📄 السجل الكامل محلياً:');
      console.dir(localRows[0], { depth: null });
    } else {
      console.log('⚠️ لم يتم العثور على الأنمي في Localhost!');
    }

    console.log('\n========= ☁️ البيانات في CLEVER CLOUD (Render DB) =========');
    if (renderRows.length > 0) {
      console.log('📌 الاسم (Name):       ', renderRows[0].name);
      console.log('🖼️ رابط الصورة (src): ', renderRows[0].src);
      console.log('📅 سنة العرض (Year):  ', renderRows[0].year);
      console.log('🕒 آخر تحديث:          ', renderRows[0].updatedAt);
      console.log('\n📄 السجل الكامل سحابياً:');
      console.dir(renderRows[0], { depth: null });
    } else {
      console.log('⚠️ لم يتم العثور على الأنمي في Clever Cloud!');
    }

  } catch (err) {
    console.error('❌ حدث خطأ أثناء الاستعلام:', err.message);
  } finally {
    await localConn.end();
    await renderConn.end();
  }
}

inspectJujutsu();