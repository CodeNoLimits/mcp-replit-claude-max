#!/bin/bash

# Script pour arrêter les services de développement

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping MCP Replit Claude Max IDE...${NC}"

# Read PIDs from file if it exists
if [ -f ".dev-pids" ]; then
    PIDS=$(cat .dev-pids)
    echo -e "${BLUE}📋 Found saved PIDs: $PIDS${NC}"
    
    for pid in $PIDS; do
        if kill -0 $pid 2>/dev/null; then
            echo -e "${BLUE}🔥 Stopping process $pid...${NC}"
            kill $pid
        else
            echo -e "${YELLOW}⚠️  Process $pid not running${NC}"
        fi
    done
    
    rm .dev-pids
else
    echo -e "${YELLOW}⚠️  No saved PIDs found, trying to kill by port...${NC}"
    
    # Kill processes by port
    pkill -f "node.*3001" || true
    pkill -f "node.*3030" || true
    pkill -f "node.*3031" || true
    pkill -f "node.*3032" || true
    pkill -f "node.*3033" || true
    pkill -f "node.*3034" || true
    pkill -f "node.*3035" || true
fi

# Clean up log files
if [ -f "server.log" ]; then
    rm server.log
    echo -e "${GREEN}✅ Cleaned up server.log${NC}"
fi

if [ -f "client.log" ]; then
    rm client.log
    echo -e "${GREEN}✅ Cleaned up client.log${NC}"
fi

# Clean up environment files
if [ -f "server/.env" ]; then
    rm server/.env
    echo -e "${GREEN}✅ Cleaned up server/.env${NC}"
fi

if [ -f "client/.env.local" ]; then
    rm client/.env.local
    echo -e "${GREEN}✅ Cleaned up client/.env.local${NC}"
fi

echo -e "${GREEN}✅ All services stopped and cleaned up${NC}"