#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}

function formatDate(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const buildDate = formatDate(new Date());
const content = `// This file is auto-generated. Do not edit directly.\nexport const VERSION = {\n  commitHash: "${commit}",\n  buildDate: "${buildDate}"\n};\n`;
fs.writeFileSync('src/version.ts', content);
console.log(`Generated version.ts with commit ${commit} and build date ${buildDate}`);
