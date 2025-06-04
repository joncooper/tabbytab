const fs = require('fs');
const path = require('path');

// Find the background script hash
function findBackgroundScriptHash() {
  const assetsDir = path.join('dist', 'assets');
  const files = fs.readdirSync(assetsDir);
  
  // Find the background script file
  const backgroundFile = files.find(file => file.startsWith('background-') && file.endsWith('.js'));
  
  if (!backgroundFile) {
    console.error('Could not find background script file in assets directory');
    process.exit(1);
  }
  
  return backgroundFile;
}

// Update the manifest.json with the correct background script path
function updateManifest(backgroundFile) {
  const manifestPath = path.join('dist', 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.error('Could not find manifest.json in dist directory');
    process.exit(1);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Update the background script path
  manifest.background.service_worker = `assets/${backgroundFile}`;
  
  // Write the updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`Updated manifest.json with background script: assets/${backgroundFile}`);
}

// Main function
function main() {
  try {
    const backgroundFile = findBackgroundScriptHash();
    updateManifest(backgroundFile);
    console.log('Manifest updated successfully!');
  } catch (error) {
    console.error('Error updating manifest:', error);
    process.exit(1);
  }
}

main();
