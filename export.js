const fs = require('fs');
const { sequelize } = require('./models'); // أو المسار الذي يحتوي على db/sequelize

async function exportData() {
  try {
    await sequelize.authenticate();
    console.log('Connected to local DB successfully.');

    // جلب أسماء كافة الجداول
    const [tables] = await sequelize.query("SHOW TABLES");
    let sqlDump = "SET FOREIGN_KEY_CHECKS = 0;\n\n";

    for (let tableObj of tables) {
      const tableName = Object.values(tableObj)[0];
      const [rows] = await sequelize.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        for (let row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "\\'")}'`;
            return `'${String(v).replace(/'/g, "\\'")}'`;
          }).join(', ');

          sqlDump += `INSERT INTO \`${tableName}\` (${keys}) VALUES (${values});\n`;
        }
        sqlDump += "\n";
      }
    }

    sqlDump += "SET FOREIGN_KEY_CHECKS = 1;\n";
    fs.writeFileSync('C:/Users/STC/Desktop/data_only.sql', sqlDump);
    console.log('SUCCESS: data_only.sql created on Desktop!');
    process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

exportData();