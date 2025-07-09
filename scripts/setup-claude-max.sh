#!/bin/bash

# Setup script for MCP Replit-like IDE with Claude Code Max
# This script verifies Claude Code accessibility and sets up the project

echo "🚀 Setting up MCP Replit-like IDE with Claude Code Max..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION+"
    exit 1
fi

print_status "Node.js version: $NODE_VERSION"

# Check Docker
print_info "Checking Docker..."
if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker."
    exit 1
fi

print_status "Docker is running"

# Check Claude Code CLI
print_info "Checking Claude Code CLI..."
if ! command -v claude &> /dev/null; then
    print_error "Claude Code CLI not found."
    echo ""
    echo "📖 Please install Claude Code CLI first:"
    echo "   1. Visit: https://docs.anthropic.com/claude/docs/claude-code"
    echo "   2. Download and install Claude Code"
    echo "   3. Run: claude"
    echo "   4. Login with your Claude Max account"
    echo ""
    exit 1
fi

# Test Claude Code accessibility
print_info "Testing Claude Code accessibility..."
if claude --version > /dev/null 2>&1; then
    CLAUDE_VERSION=$(claude --version 2>/dev/null | head -n1)
    print_status "Claude Code is accessible: $CLAUDE_VERSION"
else
    print_error "Claude Code is not accessible or not logged in."
    echo ""
    echo "📖 Please ensure you are logged in to Claude Code:"
    echo "   1. Run: claude"
    echo "   2. Select your Max plan account"
    echo "   3. Complete the authentication"
    echo ""
    exit 1
fi

# Check if user has Max plan (we can't directly verify this, so we warn)
print_warning "Please ensure you have an active Claude Max subscription (100€ or 200€/month)"
print_info "This IDE uses your existing Claude Max quota - no additional charges"

# Create directories
print_info "Creating project directories..."
mkdir -p projects
mkdir -p server/logs
mkdir -p client/logs

# Install dependencies
print_info "Installing root dependencies..."
npm install

print_info "Installing server dependencies..."
cd server
npm install
cd ..

print_info "Installing client dependencies..."
cd client
npm install
cd ..

print_info "Installing shared dependencies..."
cd shared
npm install
cd ..

# Create environment files
print_info "Creating environment configuration..."

# Server .env
cat > server/.env << EOL
NODE_ENV=development
PORT=3001
PROJECTS_DIR=./projects
CLAUDE_CODE_AVAILABLE=true
CLAUDE_CODE_MAX_SESSIONS=10
WEBSOCKET_PORT=3002
DOCKER_SOCKET_PATH=/var/run/docker.sock
LOG_LEVEL=info
EOL

# Client .env.local
cat > client/.env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_CLAUDE_CODE_ENABLED=true
EOL

# Docker compose override for development
cat > docker-compose.override.yml << EOL
version: '3.8'

services:
  mcp-server:
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - ./server:/app/server
      - ./shared:/app/shared
    
  frontend:
    environment:
      - NODE_ENV=development
    volumes:
      - ./client:/app/client
      - ./shared:/app/shared
EOL

# Create gitignore
cat > .gitignore << EOL
# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
build/
.next/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.production

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Docker
.dockerignore

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Project specific
projects/
server/logs/
client/logs/
*.local
EOL

print_status "Environment configuration created"

# Create Docker network
print_info "Creating Docker network..."
docker network create mcp-replit-network 2>/dev/null || true

print_status "Setup completed successfully!"

echo ""
echo "🎉 MCP Replit-like IDE is ready to use!"
echo "=================================================="
echo ""
echo "📋 Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Open your browser: http://localhost:3030"
echo "3. Create a new project or open existing one"
echo "4. Click 'Start Claude Code Session' to begin coding with AI"
echo ""
echo "💡 Tips:"
echo "• Your Claude Max plan includes 225-900 messages per 5h session"
echo "• Use quick actions to save prompts"
echo "• Claude Code understands your entire project context"
echo "• Sessions auto-reset every 5 hours"
echo ""
echo "🆘 Need help? Check the README.md or create an issue on GitHub"
echo ""