const fs = require('fs');
const path = require('path');
const copy = (src, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
};
copy('src/css',       'dist/css');
copy('src/html',      'dist/html');
copy('image',         'dist/image');
copy('manifest.json', 'dist/manifest.json');
