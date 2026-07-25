#!/bin/bash
# Security Build Verification Script
# Run this before submitting builds to app stores
# Usage: bash mobile/scripts/security-check.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_FILE="$PROJECT_ROOT/security-check-results.txt"

echo "🔒 Security Build Check"
echo "======================="
echo ""

{
  echo "Security Check Results - $(date)"
  echo "=============================="
  echo ""

  # Check 1: Hardcoded URLs
  echo "1. Checking for hardcoded URLs..."
  if grep -r "localhost:\|192.168\|10.0.0\|http://[0-9]" "$PROJECT_ROOT/src" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "⚠️  WARNING: Hardcoded URLs found in source code!"
    echo "   These should use environment variables (EXPO_PUBLIC_API_URL)"
  else
    echo "✅ No hardcoded URLs found"
  fi
  echo ""

  # Check 2: Console.log statements
  echo "2. Checking for console statements..."
  if grep -r "console\.\(log\|warn\|error\|info\|debug\)" "$PROJECT_ROOT/src" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "logger\." | grep -v "// " | head -20; then
    echo ""
    echo "⚠️  WARNING: Console statements found that don't use logger utility!"
    echo "   These should be replaced with: import { logger } from '../utils/logger';"
    echo "   Then use: logger.log(), logger.warn(), etc."
  else
    echo "✅ No direct console statements found (using logger utility)"
  fi
  echo ""

  # Check 3: Tokens in navigation params
  echo "3. Checking for tokens in navigation params..."
  if grep -r "navigate.*token\|route\.params.*token" "$PROJECT_ROOT/src" --include="*.js" --include="*.jsx" | head -10; then
    echo ""
    echo "⚠️  WARNING: Tokens may be passed via navigation!"
    echo "   Store tokens in secure storage instead (expo-secure-store)"
  else
    echo "✅ No obvious token navigation params found"
  fi
  echo ""

  # Check 4: Hardcoded secrets
  echo "4. Checking for hardcoded secrets/API keys..."
  if grep -r "API_KEY\|SECRET\|PASSWORD" "$PROJECT_ROOT/src" --include="*.js" --include="*.jsx" | grep -v "TODO\|FIXME\|process\.env" | head -10; then
    echo ""
    echo "⚠️  WARNING: Potential hardcoded secrets found!"
    echo "   Move these to environment variables"
  else
    echo "✅ No obvious hardcoded secrets found"
  fi
  echo ""

  # Check 5: Debug flags
  echo "5. Checking for debug flags..."
  if grep -r "DEBUG\s*=\s*true\|DEV\s*=\s*true" "$PROJECT_ROOT/src" --include="*.js" --include="*.jsx" 2>/dev/null; then
    echo ""
    echo "⚠️  WARNING: Debug flags set to true!"
    echo "   These should be false or use __DEV__ environment variable"
  else
    echo "✅ No debug flags set to true"
  fi
  echo ""

  # Check 6: Vulnerable dependencies
  echo "6. Running npm audit..."
  if [ -f "$PROJECT_ROOT/package.json" ]; then
    echo ""
    npm audit --production 2>&1 | tail -20
    echo ""
    if npm audit --production 2>&1 | grep -q "high\|critical"; then
      echo "⚠️  WARNING: High or critical vulnerabilities found!"
      echo "   Run: npm audit fix"
    else
      echo "✅ No high/critical vulnerabilities"
    fi
  fi
  echo ""

  # Check 7: Source maps
  echo "7. Checking for source map configuration..."
  if [ -f "$PROJECT_ROOT/metro.config.js" ]; then
    if grep -q "sourceMap.*false" "$PROJECT_ROOT/metro.config.js"; then
      echo "✅ Source maps disabled in metro.config.js"
    else
      echo "⚠️  WARNING: Source maps may be enabled"
      echo "   Add to metro.config.js: sourceMap: false"
    fi
  else
    echo "ℹ️  metro.config.js not found - using defaults"
  fi
  echo ""

  # Check 8: app.json security settings
  echo "8. Checking app.json security settings..."
  if grep -q "debuggable.*false" "$PROJECT_ROOT/app.json"; then
    echo "✅ Android debugging disabled"
  else
    echo "⚠️  WARNING: Android debuggable not explicitly set to false"
  fi
  echo ""

  # Check 9: .env files committed
  echo "9. Checking for committed .env files..."
  if [ -f "$PROJECT_ROOT/.env" ] || [ -f "$PROJECT_ROOT/.env.production" ] || [ -f "$PROJECT_ROOT/.env.local" ]; then
    echo "⚠️  WARNING: .env files should not be committed to git!"
    echo "   These should be in .gitignore"
  else
    echo "✅ No .env files in root"
  fi
  echo ""

  echo "=============================="
  echo "Security check completed at $(date)"

} | tee "$RESULTS_FILE"

echo ""
echo "📄 Full results saved to: $RESULTS_FILE"
echo ""
echo "🔗 Next steps:"
echo "   1. Review results above"
echo "   2. Fix any ⚠️  warnings"
echo "   3. Run: expo build --profile production --platform ios"
echo "   4. Run: expo build --profile production --platform android"
echo ""
