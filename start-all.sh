#!/bin/bash

# Determine directory script is located in
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.services.pid"

echo "=========================================="
echo "   Starting Khedma App (Linux)            "
echo "=========================================="

# 1. Dependency checks
if [ ! -d "$SCRIPT_DIR/server/node_modules" ]; then
    echo "⚠️  Backend node_modules not found. Running npm install in server/..."
    cd "$SCRIPT_DIR/server" && npm install || exit 1
fi

if [ ! -d "$SCRIPT_DIR/mobile/node_modules" ]; then
    echo "⚠️  Frontend node_modules not found. Running npm install in mobile/..."
    cd "$SCRIPT_DIR/mobile" && npm install || exit 1
fi

# 2. Port check function
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -i :"$port" -t >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
        ss -ltn | grep -qE ":$port\s"
    elif command -v netstat >/dev/null 2>&1; then
        netstat -ltn | grep -qE ":$port\s"
    else
        # fallback: try opening a connection to it briefly using bash tcp
        (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
    fi
}

PORT_5000_IN_USE=false
check_port 5000 && PORT_5000_IN_USE=true

PORT_METRO_IN_USE=false
check_port 8081 && PORT_METRO_IN_USE=true
check_port 19006 && PORT_METRO_IN_USE=true

if [ "$PORT_5000_IN_USE" = true ] || [ "$PORT_METRO_IN_USE" = true ]; then
    echo "⚠️  Warning: Port 5000 or 8081/19006 is already in use."
    echo "Services might already be running. Attempting to stop them first..."
    if [ -f "$SCRIPT_DIR/stop-all.sh" ]; then
        bash "$SCRIPT_DIR/stop-all.sh"
        sleep 2
    else
        echo "No stop-all.sh found to stop conflicting services."
    fi
fi

# Double check if PID file exists and cleanup
if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
fi

# 3. Start Backend
echo "🚀 Starting Backend Server (dev)..."
cd "$SCRIPT_DIR/server" || exit 1
setsid bash -c 'echo $$ > "'"$PID_FILE"'.server"; exec script -q -c "npx nodemon server.js" /dev/null' > "$SCRIPT_DIR/server.log" 2>&1 < /dev/null &

# 4. Start Frontend
echo "🚀 Starting Frontend (Expo/Metro)..."
cd "$SCRIPT_DIR/mobile" || exit 1
setsid bash -c 'echo $$ > "'"$PID_FILE"'.expo"; exec npx expo start --web --offline' > "$SCRIPT_DIR/expo.log" 2>&1 < /dev/null &

# Wait for PID files to be created
sleep 1
SERVER_PID=$(cat "$PID_FILE.server" 2>/dev/null)
EXPO_PID=$(cat "$PID_FILE.expo" 2>/dev/null)

# Save PIDs
echo "$SERVER_PID" > "$PID_FILE"
echo "$EXPO_PID" >> "$PID_FILE"
rm -f "$PID_FILE.server" "$PID_FILE.expo"

# Wait and check if they start listening on their respective ports
echo "⏳ Waiting for services to boot and listen on ports..."
SERVER_RUNNING=false
EXPO_RUNNING=false

# Wait up to 15 seconds
for i in {1..15}; do
    sleep 1
    if [ "$SERVER_RUNNING" = false ] && check_port 5000; then
        SERVER_RUNNING=true
        echo "   [✓] Backend is listening on port 5000"
    fi
    if [ "$EXPO_RUNNING" = false ] && (check_port 8081 || check_port 19006); then
        EXPO_RUNNING=true
        echo "   [✓] Frontend is listening"
    fi
    if [ "$SERVER_RUNNING" = true ] && [ "$EXPO_RUNNING" = true ]; then
        break
    fi
done

if [ "$SERVER_RUNNING" = true ] && [ "$EXPO_RUNNING" = true ]; then
    echo "✅ Success! Both backend and frontend are running."
    echo "   - Backend PID: $SERVER_PID"
    echo "   - Frontend PID: $EXPO_PID"
    echo "   - Backend URL:  http://localhost:5000/api"
    echo "   - Frontend URL: http://localhost:8081"
    echo "   - Backend Log:  tail -f server.log"
    echo "   - Frontend Log: tail -f expo.log"
    echo "------------------------------------------"
    echo "Use ./stop-all.sh to shut down both."
    echo "Use ./restart-all.sh to restart both."
else
    echo "⚠️  One or more services did not start listening on their ports:"
    if [ "$SERVER_RUNNING" = false ]; then
        echo "   - Backend not listening on port 5000 (MongoDB connection error? Check server.log)."
    fi
    if [ "$EXPO_RUNNING" = false ]; then
        echo "   - Frontend not listening on port 8081/19006 (Check expo.log)."
    fi
    echo "------------------------------------------"
    echo "The processes are still running in the background."
    echo "Use ./stop-all.sh to stop them, or check logs to debug."
fi
