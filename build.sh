#!/bin/bash

# Install dependencies
npm install

# Clean up previous build
rm -rf dist

# Create necessary directories
mkdir -p dist/icons

# Copy static assets
cp manifest.json dist/
cp -r icons/* dist/icons/

# Build the extension
npm run build

# Fix build structure 
chmod +x fix-build.sh
./fix-build.sh

# Update manifest with correct file hashes
node update-manifest.js

echo "Build complete! The extension is now in the dist/ directory."
echo "To load it in Chrome, go to chrome://extensions/, enable Developer mode, and click 'Load unpacked'."