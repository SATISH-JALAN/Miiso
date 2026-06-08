const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/#F5F5F5/g, '#EDEDED');
  content = content.replace(/rgba\(255,255,255,0.06\)/g, 'rgba(255, 255, 255, 0.08)');
  content = content.replace(/rgba\(255,255,255,0.08\)/g, 'rgba(255, 255, 255, 0.1)');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log('Replaced more colors');
