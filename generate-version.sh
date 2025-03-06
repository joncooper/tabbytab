#!/bin/bash

# Get the git commit hash
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Get the current date and time in YYYY-MM-DD HH:MM format
BUILD_DATE=$(date +"%Y-%m-%d %H:%M")

# Create the version.ts file
cat > src/version.ts << EOL
// This file is auto-generated. Do not edit directly.
export const VERSION = {
  commitHash: "${COMMIT_HASH}",
  buildDate: "${BUILD_DATE}"
};
EOL

echo "Generated version.ts with commit ${COMMIT_HASH} and build date ${BUILD_DATE}"