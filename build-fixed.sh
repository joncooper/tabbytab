#!/bin/bash

# Install dependencies
npm install

# Clean up previous build
rm -rf dist

# Build the TypeScript code
npx tsc

# Create necessary directories
mkdir -p dist/popup dist/history dist/assets dist/styles dist/icons

# Copy static assets
cp manifest.json dist/
cp -r icons/* dist/icons/ || echo "No icons found, please add icons to the icons/ directory"

# Copy HTML files
cp src/popup/index.html dist/popup/
cp src/history/index.html dist/history/

# Bundle JS files
npx esbuild src/background/index.ts --bundle --format=esm --outfile=dist/assets/background.js
npx esbuild src/popup/index.tsx --bundle --format=esm --outfile=dist/popup/index.js
npx esbuild src/history/index.tsx --bundle --format=esm --outfile=dist/history/index.js

# Bundle CSS
npx esbuild src/styles/main.css --bundle --outfile=dist/styles/main.css

# Add imports to HTML files
sed -i.bak 's|<script type="module" src="./index.tsx"></script>|<script type="module" src="./index.js"></script>|g' dist/popup/index.html
sed -i.bak 's|<script type="module" src="./index.tsx"></script>|<script type="module" src="./index.js"></script>|g' dist/history/index.html
sed -i.bak 's|<link rel="stylesheet" href="../styles/main.css">|<link rel="stylesheet" href="../styles/main.css">|g' dist/popup/index.html
sed -i.bak 's|<link rel="stylesheet" href="../styles/main.css">|<link rel="stylesheet" href="../styles/main.css">|g' dist/history/index.html

# Clean up backup files
rm -f dist/popup/index.html.bak dist/history/index.html.bak

echo "Build complete! The extension is now in the dist/ directory."
echo "To load it in Chrome, go to chrome://extensions/, enable Developer mode, and click 'Load unpacked'."