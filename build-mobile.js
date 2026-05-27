const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean and recreate destDir
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy index.html
fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(destDir, 'index.html'));
console.log('Copied index.html');

// Copy assets
if (fs.existsSync(path.join(srcDir, 'assets'))) {
  copyDirSync(path.join(srcDir, 'assets'), path.join(destDir, 'assets'));
  console.log('Copied assets/');
}

// Copy lib
if (fs.existsSync(path.join(srcDir, 'lib'))) {
  copyDirSync(path.join(srcDir, 'lib'), path.join(destDir, 'lib'));
  console.log('Copied lib/');
}

console.log('Mobile build directory "www" prepared successfully.');
