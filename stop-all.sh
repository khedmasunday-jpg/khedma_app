#!/bin/bash

# Determine directory script is located in
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.services.pid"

echo "=========================================="
echo "   Stopping Khedma App Services           "
echo "=========================================="

get_children() {
    local parent_pid=$1
    if command -v pgrep >/dev/null 2>&1; then
        pgrep -P "$parent_pid"
    else
        ps -o pid= --ppid "$parent_pid" 2>/dev/null
    fi
}

kill_tree() {
    local parent_pid=$1
    if [ -z "$parent_pid" ]; then return; fi
    
    local children
    children=$(get_children "$parent_pid")
    for child in $children; do
        kill_tree "$child"
    done
    
    if kill -0 "$parent_pid" 2>/dev/null; then
        echo "Stopping process $parent_pid..."
        kill -TERM "$parent_pid" 2>/dev/null
        sleep 0.2
        if kill -0 "$parent_pid" 2>/dev/null; then
            kill -9 "$parent_pid" 2>/dev/null
        fi
    fi
}

# 1. Stop via PIDs file
if [ -f "$PID_FILE" ]; then
    echo "Stopping services using recorded PIDs..."
    while IFS= read -r pid; do
        if [ -n "$pid" ]; then
            kill_tree "$pid"
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
else
    echo "No PID file found. Proceeding to port-based stop..."
fi

# 2. Cleanup remaining processes on ports (Fallback)
kill_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -t -i :"$port" 2>/dev/null)
        if [ -n "$pids" ]; then
            echo "Port $port still in use by processes: $pids. Cleaning up..."
            for pid in $pids; do
                kill_tree "$pid"
            done
        fi
    elif command -v fuser >/dev/null 2>&1; then
        echo "Cleaning up processes on port $port using fuser..."
        fuser -k -n tcp "$port" >/dev/null 2>&1
    fi
}

kill_port 5000
kill_port 8081
kill_port 19006

echo "✅ All services stopped successfully!"
echo "=========================================="
