const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/bg-brand-accent text-\[#EDEDED\]/g, 'bg-brand-accent text-[#0A0A0A]');
  content = content.replace(/bg-brand-accent text-text-primary/g, 'bg-brand-accent text-[#0A0A0A]');
  content = content.replace(/bg-\[#19C978\] text-\[#EDEDED\]/g, 'bg-[#19C978] text-[#0A0A0A]');
  
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
console.log('Fixed button text colors');
