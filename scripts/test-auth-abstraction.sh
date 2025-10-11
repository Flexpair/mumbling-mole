#!/bin/bash
# Quick test script for auth abstraction layer
# Run this to verify the abstraction works correctly

echo "🧪 Testing Auth Abstraction Layer..."
echo ""

# Create test file
cat > /tmp/auth-test.mjs << 'EOF'
/**
 * Quick Test: Auth Abstraction Layer
 * Tests the mock adapter to verify the abstraction works
 */

// Note: Run with Node.js ESM support
// node --input-type=module /tmp/auth-test.mjs

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use workspace root from environment variable (set by bash script)
const workspaceRoot = process.env.WORKSPACE_ROOT || '/home/node';

// Dynamically import from the workspace
const authPath = join(workspaceRoot, 'app/auth/MockAuthAdapter.js');
const { default: MockAuthAdapter } = await import(authPath);

console.log('✅ Imports successful\n');

// Create mock auth instance
const auth = new MockAuthAdapter({ autoLogin: false });
console.log('📦 Provider:', auth.getProviderName());
console.log('');

// Test initialization
console.log('🔄 Initializing auth...');
await auth.init();
console.log('✅ Auth initialized\n');

// Test login
console.log('🔐 Testing login...');
try {
  const user = await auth.login('test@example.com', 'password123');
  console.log('✅ Login successful!');
  console.log('   User:', user.email);
  console.log('   ID:', user.id);
  console.log('');
} catch (err) {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
}

// Test getCurrentUser
console.log('👤 Getting current user...');
const currentUser = await auth.getCurrentUser();
console.log('✅ Current user:', currentUser.email);
console.log('');

// Test isAuthenticated
console.log('🔍 Checking authentication status...');
const isAuth = await auth.isAuthenticated();
console.log('✅ Is authenticated:', isAuth);
console.log('');

// Test events
console.log('📡 Testing event system...');
let logoutFired = false;
auth.on('logout', () => {
  logoutFired = true;
  console.log('✅ Logout event fired!');
});

// Test logout
console.log('🚪 Testing logout...');
await auth.logout();
if (logoutFired) {
  console.log('✅ Event system works correctly');
} else {
  console.error('❌ Event system failed');
  process.exit(1);
}
console.log('');

// Verify user is null after logout
const userAfterLogout = await auth.getCurrentUser();
if (userAfterLogout === null) {
  console.log('✅ User correctly cleared after logout');
} else {
  console.error('❌ User should be null after logout');
  process.exit(1);
}
console.log('');

// Test error handling
console.log('⚠️  Testing error handling...');
try {
  await auth.login('nonexistent@example.com', 'wrongpassword');
  console.error('❌ Should have thrown error for invalid user');
  process.exit(1);
} catch (err) {
  console.log('✅ Error handling works:', err.message);
}
console.log('');

console.log('═══════════════════════════════════════════');
console.log('🎉 ALL TESTS PASSED!');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('The auth abstraction layer is working correctly!');
console.log('You can now:');
console.log('  1. Integrate with your app');
console.log('  2. Evaluate different providers');
console.log('  3. Implement chosen provider adapter');
console.log('');
EOF

echo "Running tests..."
echo "─────────────────────────────────────────────"

# Get script directory and workspace root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Run the test with workspace root as environment variable
WORKSPACE_ROOT="$WORKSPACE_ROOT" node /tmp/auth-test.mjs

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Auth abstraction layer is ready to use!"
else
  echo ""
  echo "❌ Tests failed. Check the output above."
  exit 1
fi
