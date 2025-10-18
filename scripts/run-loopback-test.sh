#!/bin/bash
# Quick Loopback Test Runner
# Handles setup, execution, and cleanup of loopback frequency tests

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Loopback Frequency Test Runner                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Playwright is installed
if ! npm list @playwright/test >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Playwright not found. Installing...${NC}"
  npm install -D @playwright/test
  npx playwright install chromium
  echo -e "${GREEN}✅ Playwright installed${NC}"
fi

# Check if Chromium is installed
if ! npx playwright --version >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Installing Playwright browsers...${NC}"
  npx playwright install chromium
  echo -e "${GREEN}✅ Browsers installed${NC}"
fi

# Check if application is built
if [ ! -f "dist/index.html" ]; then
  echo -e "${YELLOW}⚠️  Application not built. Building...${NC}"
  npm run build
  echo -e "${GREEN}✅ Application built${NC}"
fi

# Check if test server is running
echo -e "${BLUE}🔍 Checking test server...${NC}"
if ! docker ps | grep -q murmur; then
  echo -e "${YELLOW}⚠️  Test server not running. Starting...${NC}"
  cd .devcontainer && docker-compose up -d murmur
  cd ..
  sleep 5 # Wait for server to start
  echo -e "${GREEN}✅ Test server started${NC}"
else
  echo -e "${GREEN}✅ Test server already running${NC}"
fi

# Parse command line arguments
HEADED=false
DEBUG=false
UI=false
QUICK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --headed|-h)
      HEADED=true
      shift
      ;;
    --debug|-d)
      DEBUG=true
      shift
      ;;
    --ui|-u)
      UI=true
      shift
      ;;
    --quick|-q)
      QUICK=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--headed|-h] [--debug|-d] [--ui|-u] [--quick|-q]"
      exit 1
      ;;
  esac
done

# Run tests based on flags
echo ""
echo -e "${BLUE}🧪 Running loopback tests...${NC}"
echo ""

if [ "$QUICK" = true ]; then
  echo -e "${BLUE}⚡ Quick test mode (first test only)${NC}"
  npx playwright test loopback-frequency.spec.js --grep "should display ~440 Hz"
elif [ "$DEBUG" = true ]; then
  echo -e "${BLUE}🐛 Debug mode${NC}"
  npm run test:loopback:debug
elif [ "$UI" = true ]; then
  echo -e "${BLUE}🖥️  UI mode${NC}"
  npm run test:loopback:ui
elif [ "$HEADED" = true ]; then
  echo -e "${BLUE}👀 Headed mode (visible browser)${NC}"
  npm run test:loopback:headed
else
  echo -e "${BLUE}🏃 Headless mode${NC}"
  npm run test:loopback
fi

# Capture test exit code
TEST_EXIT=$?

echo ""
if [ $TEST_EXIT -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ ALL TESTS PASSED!                                      ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ TESTS FAILED                                           ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}📝 View test report:${NC}"
  echo "   npx playwright show-report test-results/playwright-report"
  echo ""
  echo -e "${YELLOW}🔍 Debug with:${NC}"
  echo "   $0 --headed    # Watch browser automation"
  echo "   $0 --debug     # Step through tests"
  echo "   $0 --ui        # Interactive UI"
fi

echo ""
echo -e "${BLUE}📊 Test artifacts saved to: test-results/${NC}"

exit $TEST_EXIT
