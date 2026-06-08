const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/accent-purple/g, 'brand-accent');
  content = content.replace(/#7C3AED/g, '#19C978');
  content = content.replace(/rgba\(124,58,237/g, 'rgba(25,201,120');
  content = content.replace(/rgba\(124, 58, 237/g, 'rgba(25, 201, 120');
  
  // also let's change Inter/JetBrains to Geist
  content = content.replace(/font-sans/g, 'font-sans'); // already tailwind config
  content = content.replace(/Inter/g, 'Geist Sans');
  content = content.replace(/JetBrains Mono/g, 'Geist Mono');

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
console.log('Replaced colors and fonts successfully');
