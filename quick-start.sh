#!/bin/bash

# Quick start script for testing
set -e

echo "🚀 Quick Start - MCP Replit Claude Max"
echo "======================================"

# Find available ports
SERVER_PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()")
CLIENT_PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()")

echo "✅ Server port: $SERVER_PORT"
echo "✅ Client port: $CLIENT_PORT"

# Create simple environment files
cat > server/.env << EOL
NODE_ENV=development
PORT=$SERVER_PORT
PROJECTS_DIR=./projects
CLIENT_URL=http://localhost:$CLIENT_PORT
EOL

cat > client/.env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:$SERVER_PORT
NEXT_PUBLIC_WS_URL=ws://localhost:$SERVER_PORT
EOL

echo "✅ Environment files created"

# Install basic dependencies
echo "📦 Installing basic dependencies..."
cd server && npm install --no-optional && cd ..

echo "📦 Installing client dependencies..."
cd client && npm install --no-optional --legacy-peer-deps && cd ..

echo "🚀 Starting server..."
cd server && PORT=$SERVER_PORT npm run dev &
SERVER_PID=$!

echo "⏳ Waiting for server..."
sleep 5

echo "🌐 Starting client..."
cd client && PORT=$CLIENT_PORT npm run dev &
CLIENT_PID=$!

echo "⏳ Waiting for client..."
sleep 5

echo ""
echo "🎉 Services started!"
echo "Frontend: http://localhost:$CLIENT_PORT"
echo "Backend: http://localhost:$SERVER_PORT"
echo ""
echo "PIDs: Server=$SERVER_PID, Client=$CLIENT_PID"
echo "To stop: kill $SERVER_PID $CLIENT_PID"

# Try to open browser
if command -v open > /dev/null; then
    open "http://localhost:$CLIENT_PORT"
fi