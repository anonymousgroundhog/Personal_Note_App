#!/bin/bash

# Build script for Personal Note App - Electron standalone application

echo "========================================="
echo "Personal Note App - Electron Build"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS
IS_MAC=false
if [[ "$OSTYPE" == "darwin"* ]]; then
  IS_MAC=true
fi

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install dependencies${NC}"
  exit 1
fi

# Step 2: Compile Electron TypeScript
echo -e "${YELLOW}Step 2: Compiling Electron TypeScript...${NC}"
npx tsc -p tsconfig.electron.json
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to compile Electron TypeScript${NC}"
  exit 1
fi

# Step 3: Build React app with Vite
echo -e "${YELLOW}Step 3: Building React app with Vite...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build React app${NC}"
  exit 1
fi

# Step 4: Build Electron app
echo -e "${YELLOW}Step 4: Building Electron application...${NC}"

# Build based on platform
if [ "$1" == "win" ]; then
  echo -e "${YELLOW}Building for Windows...${NC}"
  npm run build:electron:win
elif [ "$1" == "mac" ] && [ "$IS_MAC" = true ]; then
  echo -e "${YELLOW}Building for macOS...${NC}"
  npm run build:electron:mac
elif [ "$1" == "linux" ]; then
  echo -e "${YELLOW}Building for Linux...${NC}"
  npm run build:electron:linux
else
  echo -e "${YELLOW}Building for current platform...${NC}"
  npm run build:electron
fi

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build Electron app${NC}"
  exit 1
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Output location: ./dist-app"
