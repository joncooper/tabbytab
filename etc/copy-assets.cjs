#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function copy() {
  await fs.promises.mkdir(path.join('dist', 'icons'), { recursive: true });

  if (fs.existsSync('manifest.json')) {
    await fs.promises.copyFile('manifest.json', path.join('dist', 'manifest.json'));
  }

  if (fs.existsSync('icons')) {
    const files = await fs.promises.readdir('icons');
    for (const file of files) {
      await fs.promises.copyFile(path.join('icons', file), path.join('dist', 'icons', file));
    }
  }
}

copy().catch(err => {
  console.error(err);
  process.exit(1);
});
