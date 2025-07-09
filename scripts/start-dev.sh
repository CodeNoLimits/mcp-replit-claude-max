#!/bin/bash

# Script de démarrage robuste pour MCP Replit Claude Max
# Détecte automatiquement les ports libres et démarre les services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MCP Replit Claude Max IDE...${NC}"
echo "=================================================="

# Function to find available port
find_available_port() {
    local start_port=$1
    local max_port=$((start_port + 100))
    
    for port in $(seq $start_port $max_port); do
        if ! lsof -i :$port > /dev/null 2>&1; then
            echo $port
            return 0
        fi
    done
    
    echo "No available port found between $start_port and $max_port" >&2
    return 1
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Check npm
if ! command_exists npm; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "client" ]; then
    echo -e "${RED}❌ Not in the correct project directory${NC}"
    exit 1
fi

# Find available ports
echo -e "${BLUE}🔍 Finding available ports...${NC}"

SERVER_PORT=$(find_available_port 3001)
CLIENT_PORT=$(find_available_port 3030)

if [ -z "$SERVER_PORT" ] || [ -z "$CLIENT_PORT" ]; then
    echo -e "${RED}❌ Could not find available ports${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Server will run on port: $SERVER_PORT${NC}"
echo -e "${GREEN}✅ Client will run on port: $CLIENT_PORT${NC}"

# Create environment files
echo -e "${BLUE}⚙️  Creating environment configuration...${NC}"

# Server .env
cat > server/.env << EOL
NODE_ENV=development
PORT=$SERVER_PORT
PROJECTS_DIR=./projects
CLAUDE_CODE_AVAILABLE=true
CLAUDE_CODE_MAX_SESSIONS=10
WEBSOCKET_PORT=$SERVER_PORT
DOCKER_SOCKET_PATH=/var/run/docker.sock
LOG_LEVEL=info
CLIENT_URL=http://localhost:$CLIENT_PORT
EOL

# Client .env.local
cat > client/.env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:$SERVER_PORT
NEXT_PUBLIC_WS_URL=ws://localhost:$SERVER_PORT
NEXT_PUBLIC_CLAUDE_CODE_ENABLED=true
PORT=$CLIENT_PORT
EOL

echo -e "${GREEN}✅ Environment files created${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing root dependencies...${NC}"
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo -e "${BLUE}📦 Installing server dependencies...${NC}"
    cd server && npm install && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo -e "${BLUE}📦 Installing client dependencies...${NC}"
    cd client && npm install --legacy-peer-deps && cd ..
fi

# Check Claude Code
echo -e "${BLUE}🤖 Checking Claude Code availability...${NC}"
if command_exists claude; then
    if claude --version > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Claude Code is available${NC}"
    else
        echo -e "${YELLOW}⚠️  Claude Code found but not authenticated${NC}"
        echo -e "${YELLOW}   Please run 'claude' to authenticate${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Claude Code CLI not found${NC}"
    echo -e "${YELLOW}   Install from: https://docs.anthropic.com/claude/docs/claude-code${NC}"
fi

# Create projects directory
mkdir -p projects

# Kill any existing processes on our ports
echo -e "${BLUE}🧹 Cleaning up any existing processes...${NC}"
pkill -f "node.*$SERVER_PORT" || true
pkill -f "node.*$CLIENT_PORT" || true

# Wait a moment
sleep 2

# Start the server in background
echo -e "${BLUE}🔧 Starting server on port $SERVER_PORT...${NC}"
cd server
PORT=$SERVER_PORT npm run dev > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

# Wait for server to start
echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
sleep 5

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Server failed to start${NC}"
    echo -e "${RED}Server logs:${NC}"
    tail -20 server.log
    exit 1
fi

# Test server health
if curl -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Server health check failed, but continuing...${NC}"
fi

# Start the client in background
echo -e "${BLUE}🌐 Starting client on port $CLIENT_PORT...${NC}"
cd client
PORT=$CLIENT_PORT npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

# Wait for client to start
echo -e "${BLUE}⏳ Waiting for client to start...${NC}"
sleep 8

# Check if client is running
if ! kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${RED}❌ Client failed to start${NC}"
    echo -e "${RED}Client logs:${NC}"
    tail -20 client.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Test client
if curl -f http://localhost:$CLIENT_PORT > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Client is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Client accessibility check failed, but continuing...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 MCP Replit Claude Max IDE is now running!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}📱 Frontend (IDE):${NC} http://localhost:$CLIENT_PORT"
echo -e "${BLUE}🔧 Backend (API):${NC} http://localhost:$SERVER_PORT"
echo -e "${BLUE}📊 Health Check:${NC} http://localhost:$SERVER_PORT/health"
echo ""
echo -e "${BLUE}📝 Process IDs:${NC}"
echo -e "   Server PID: $SERVER_PID"
echo -e "   Client PID: $CLIENT_PID"
echo ""
echo -e "${BLUE}📋 To stop the services:${NC}"
echo -e "   kill $SERVER_PID $CLIENT_PID"
echo -e "   or run: ./scripts/stop-dev.sh"
echo ""
echo -e "${BLUE}📁 Log files:${NC}"
echo -e "   Server: ./server.log"
echo -e "   Client: ./client.log"
echo ""
echo -e "${YELLOW}💡 Opening IDE in your default browser...${NC}"

# Try to open in browser
if command_exists open; then
    open http://localhost:$CLIENT_PORT
elif command_exists xdg-open; then
    xdg-open http://localhost:$CLIENT_PORT
else
    echo -e "${YELLOW}⚠️  Could not open browser automatically${NC}"
    echo -e "${YELLOW}   Please open: http://localhost:$CLIENT_PORT${NC}"
fi

# Save PIDs for cleanup
echo "$SERVER_PID $CLIENT_PID" > .dev-pids

echo ""
echo -e "${GREEN}✅ Setup complete! Happy coding with AI! 🤖${NC}"