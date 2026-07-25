#!/bin/bash

# Determine directory script is located in
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo "   Restarting Khedma App Services         "
echo "=========================================="

if [ -f "$SCRIPT_DIR/stop-all.sh" ]; then
    bash "$SCRIPT_DIR/stop-all.sh"
else
    echo "⚠️  stop-all.sh not found, skipping shutdown."
fi

echo "Waiting for services to release resources..."
sleep 2

if [ -f "$SCRIPT_DIR/start-all.sh" ]; then
    bash "$SCRIPT_DIR/start-all.sh"
else
    echo "❌ Error: start-all.sh not found."
    exit 1
fi
