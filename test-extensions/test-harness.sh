#!/bin/bash
# Test harness for AuditExt
# This script helps you safely test AuditExt with mock extensions

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AUDIT_EXT_DIR="$SCRIPT_DIR/.."
TEST_EXTENSIONS_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}AuditExt Testing Harness${NC}"
echo "=========================================="
echo ""

# Check if VS Code extensions directory exists
VSCODE_EXTENSIONS_DIR="$HOME/.vscode/extensions"

if [ ! -d "$VSCODE_EXTENSIONS_DIR" ]; then
  echo -e "${RED}Error: VS Code extensions directory not found at $VSCODE_EXTENSIONS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ VS Code extensions directory found${NC}"
echo "  Location: $VSCODE_EXTENSIONS_DIR"
echo ""

# Function to install test extension
install_test_extension() {
  local ext_name=$1
  local ext_dir="$TEST_EXTENSIONS_DIR/$ext_name"
  
  if [ ! -d "$ext_dir" ]; then
    echo -e "${RED}✗ Test extension not found: $ext_name${NC}"
    return 1
  fi
  
  local install_dir="$VSCODE_EXTENSIONS_DIR/auditex-test-$ext_name"
  
  echo "Installing test extension: $ext_name"
  cp -r "$ext_dir" "$install_dir"
  echo -e "${GREEN}✓ Installed to: $install_dir${NC}"
}

# Function to remove test extension
remove_test_extension() {
  local ext_name=$1
  local install_dir="$VSCODE_EXTENSIONS_DIR/auditex-test-$ext_name"
  
  if [ -d "$install_dir" ]; then
    rm -rf "$install_dir"
    echo -e "${GREEN}✓ Removed test extension: $ext_name${NC}"
  fi
}

# Parse arguments
case "${1:-menu}" in
  install-all)
    echo "Installing all test extensions..."
    install_test_extension "malicious-mock" || true
    install_test_extension "clean-mock" || true
    echo ""
    echo -e "${GREEN}All test extensions installed!${NC}"
    echo "Next steps:"
    echo "  1. Open VS Code"
    echo "  2. Press F5 to debug AuditExt"
    echo "  3. Run: AuditExt: Check Integrity"
    echo "  4. You should see the test extensions in the report"
    ;;
    
  remove-all)
    echo "Removing all test extensions..."
    remove_test_extension "malicious-mock"
    remove_test_extension "clean-mock"
    echo -e "${GREEN}All test extensions removed!${NC}"
    ;;
    
  list)
    echo "Available test extensions:"
    echo "  - malicious-mock: Contains suspicious code patterns (for detection testing)"
    echo "  - clean-mock: Safe extension that follows best practices"
    echo ""
    echo "Installed test extensions:"
    ls "$VSCODE_EXTENSIONS_DIR" | grep "auditex-test-" || echo "  (none)"
    ;;
    
  menu|help|*)
    echo "Usage: ./test-harness.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install-all  - Install all mock test extensions"
    echo "  remove-all   - Remove all mock test extensions"
    echo "  list         - List available and installed test extensions"
    echo "  help, menu   - Show this help message"
    echo ""
    echo "Testing Workflow:"
    echo "  1. Run: ./test-harness.sh install-all"
    echo "  2. Open VS Code"
    echo "  3. Press F5 to debug AuditExt"
    echo "  4. Command Palette → AuditExt: Check Integrity"
    echo "  5. Run: ./test-harness.sh remove-all"
    ;;
esac

echo ""
