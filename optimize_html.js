const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add width and height to logo
  const logoRegex = /<img src="\.\.\/assets\/images\/لقطة_شاشة_2025-06-14_185723-removebg-preview\.png"[^>]*alt="Logo"[^>]*>/g;
  content = content.replace(logoRegex, (match) => {
    if (!match.includes('width="200"')) {
      return match.replace('<img', '<img width="200" height="90"');
    }
    return match;
  });

  // Add defer to all local scripts (exclude external if any, though regex focuses on ../js/)
  const scriptRegex = /<script src="\.\.\/js\/([^"]+)\.js"><\/script>/g;
  content = content.replace(scriptRegex, (match) => {
    if (!match.includes('defer')) {
      return match.replace('<script', '<script defer');
    }
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
