#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p icons

# Download icons
echo "Downloading icons..."
curl -o icons/icon16.png https://raw.githubusercontent.com/feathericons/feather/master/icons/layers.png || {
  echo "Failed to download icon16.png"
  echo "Creating a placeholder icon16.png file"
  echo '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>' > icons/icon16.svg
  echo "Created SVG placeholder. You'll need to convert this to PNG."
}

curl -o icons/icon48.png https://raw.githubusercontent.com/feathericons/feather/master/icons/layers.png || {
  echo "Failed to download icon48.png"
  echo "Creating a placeholder icon48.png file"
  echo '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>' > icons/icon48.svg
  echo "Created SVG placeholder. You'll need to convert this to PNG."
}

echo "Done!"
echo "If PNG files were not downloaded successfully, you'll need to convert the SVG placeholders to PNG or manually download icon files."
echo "See README.md for more details on icon requirements."