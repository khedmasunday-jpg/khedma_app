#!/bin/bash

# Determine directory script is located in
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.services.pid"

echo "=========================================="
echo "   Starting Production Khedma App         "
echo "   (With Obfuscated Frontend)             "
echo "=========================================="

# 1. Dependency checks
if [ ! -d "$SCRIPT_DIR/server/node_modules" ]; then
    echo "⚠️  Backend node_modules not found. Running npm install in server/..."
    cd "$SCRIPT_DIR/server" && npm install || exit 1
fi

if [ ! -d "$SCRIPT_DIR/mobile/node_modules" ]; then
    echo "⚠️  Frontend node_modules not found. Running npm install in mobile/..."
    cd "$SCRIPT_DIR/mobile" && npm install --force || exit 1
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
        (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
    fi
}

PORT_5000_IN_USE=false
check_port 5000 && PORT_5000_IN_USE=true

PORT_METRO_IN_USE=false
check_port 8081 && PORT_METRO_IN_USE=true

if [ "$PORT_5000_IN_USE" = true ] || [ "$PORT_METRO_IN_USE" = true ]; then
    echo "⚠️  Warning: Port 5000 or 8081 is already in use."
    echo "Attempting to stop existing services..."
    if [ -f "$SCRIPT_DIR/stop-all.sh" ]; then
        bash "$SCRIPT_DIR/stop-all.sh"
        sleep 2
    fi
fi

if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
fi

# 3. Build & Obfuscate Frontend if needed
if [ ! -d "$SCRIPT_DIR/mobile/dist" ]; then
    echo "📦 Production build not found. Building and obfuscating frontend..."
    bash "$SCRIPT_DIR/mobile/scripts/build_and_obfuscate.sh" || exit 1
else
    echo "ℹ️  Found existing production build at mobile/dist."
    echo "   If you made code changes, run mobile/scripts/build_and_obfuscate.sh to update."
fi

# 4. Start Backend
echo "🚀 Starting Backend Server (production)..."
cd "$SCRIPT_DIR/server" || exit 1
setsid bash -c 'echo $$ > "'"$PID_FILE"'.server"; exec node server.js' > "$SCRIPT_DIR/server.log" 2>&1 < /dev/null &

# 5. Start Production Web Server (serve static files on port 8081)
echo "🚀 Serving Obfuscated Web Application on port 8081..."
cd "$SCRIPT_DIR/mobile" || exit 1
setsid bash -c 'echo $$ > "'"$PID_FILE"'.web"; exec npx -y serve -s dist -l 8081' > "$SCRIPT_DIR/expo.log" 2>&1 < /dev/null &

# Wait for PID files to be created
sleep 1
SERVER_PID=$(cat "$PID_FILE.server" 2>/dev/null)
WEB_PID=$(cat "$PID_FILE.web" 2>/dev/null)

# Save PIDs
echo "$SERVER_PID" > "$PID_FILE"
echo "$WEB_PID" >> "$PID_FILE"
rm -f "$PID_FILE.server" "$PID_FILE.web"

# Wait and check if they start listening on their respective ports
echo "⏳ Waiting for production services to boot..."
SERVER_RUNNING=false
WEB_RUNNING=false

for i in {1..10}; do
    sleep 1
    if [ "$SERVER_RUNNING" = false ] && check_port 5000; then
        SERVER_RUNNING=true
        echo "   [✓] Backend is listening on port 5000"
    fi
    if [ "$WEB_RUNNING" = false ] && check_port 8081; then
        WEB_RUNNING=true
        echo "   [✓] Production Web App is listening on port 8081"
    fi
    if [ "$SERVER_RUNNING" = true ] && [ "$WEB_RUNNING" = true ]; then
        break
    fi
done

if [ "$SERVER_RUNNING" = true ] && [ "$WEB_RUNNING" = true ]; then
    echo "✅ Success! Production services are running."
    echo "   - Backend URL:  http://localhost:5000/api"
    echo "   - Frontend URL: http://localhost:8081"
    echo "   - Backend Log:  tail -f server.log"
    echo "   - Frontend Log: tail -f expo.log"
    echo "------------------------------------------"
    echo "Use ./stop-all.sh to shut down both."
else
    echo "⚠️  One or more services failed to start. Check server.log or expo.log."
fi
