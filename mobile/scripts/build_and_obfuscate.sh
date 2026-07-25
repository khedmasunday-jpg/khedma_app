#!/bin/bash
set -e

# Determine directory script is located in
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "🧹 Cleaning previous build..."
rm -rf dist

echo "📦 Running production export..."
export GENERATE_SOURCEMAP=false
npx expo export -p web

echo "🔒 Running obfuscator script..."
node scripts/obfuscate.js

echo "🎉 Build and obfuscate finished successfully!"
