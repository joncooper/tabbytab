#!/bin/bash

# This script fixes the build output to match the manifest paths

echo "Fixing build output structure..."

# Move files from src/popup to popup
if [ -d "dist/src/popup" ]; then
  mkdir -p dist/popup
  mv dist/src/popup/* dist/popup/
  rm -rf dist/src/popup
fi

# Move files from src/history to history
if [ -d "dist/src/history" ]; then
  mkdir -p dist/history
  mv dist/src/history/* dist/history/
  rm -rf dist/src/history
fi

# Move any style files to the right location
if [ -d "dist/styles" ]; then
  mkdir -p dist/styles
  cp -r dist/styles/* dist/styles/
fi

# Clean up src directory if it exists and is empty
if [ -d "dist/src" ]; then
  find dist/src -type d -empty -delete
  if [ -d "dist/src" ] && [ -z "$(ls -A dist/src)" ]; then
    rm -rf dist/src
  fi
fi

echo "Build structure fixed successfully!"