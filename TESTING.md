# AuditExt Quick Reference - Testing

## 0. Static checks (always run first)

```bash
npm test
```

This runs `tsc --noEmit` + `eslint src --ext ts`. Both must pass (warnings are OK; errors fail). Run this before every commit and after any change to `src/`. See [AGENTS.md](./AGENTS.md) for the full convention.

---

## 1. Integration Tests

The integration test workflow loads the extension into a real VS Code Extension Host and exercises the audit commands against real + mock extensions. **Static checks do not cover this** — the harness is required.

### Method A: Test with Real Extensions (Safest)
```bash
npm run esbuild-watch
# In VS Code: Press F5
# Command Palette: AuditExt: Check Integrity
```
✅ Pros: Real-world data, no cleanup needed
❌ Cons: Depends on what you have installed

---

### Method B: Test with Mock Extensions (Recommended)

**Windows:**
```batch
cd test-extensions
test-harness.bat install-all
REM Open VS Code, press F5
REM Command Palette: AuditExt: Check Integrity
test-harness.bat remove-all
```

**macOS/Linux:**
```bash
cd test-extensions
./test-harness.sh install-all
# Open VS Code, press F5
# Command Palette: AuditExt: Check Integrity
./test-harness.sh remove-all
```

✅ Pros: Controlled test cases, easy cleanup, repeatable
✅ Pros: Tests both good and bad scenarios
❌ Cons: Need to install/uninstall

---

### Method C: Direct VS Code Testing

1. **Build the extension:**
   ```bash
   npm run esbuild
   ```

2. **Launch Extension Host:**
   - Press F5 in VS Code
   - This loads AuditExt into Extension Host

3. **Open Command Palette:**
   - Ctrl+Shift+P (Windows/Linux)
   - Cmd+Shift+P (macOS)

4. **Run commands:**
   - `AuditExt: Audit Extensions` - Full inventory
   - `AuditExt: Check Integrity` - Security scan
   - `AuditExt: Check Network` - Network analysis

5. **View results:**
   - Output appears in "AuditExt" output channel
   - Modals appear for critical/high severity issues

---

## Expected Behaviors

### Audit Extensions
- Lists ALL installed VS Code extensions
- Shows metadata: version, publisher, size, etc.
- Flags extensions with broad activation events
- ⚠️ Modal if 5+ extensions with broad activation

### Check Integrity
- Scans for corrupted/missing files
- Detects malicious code patterns
- Checks for dangerous permissions
- 🔴 Error modal if CRITICAL found
- 🟠 Warning modal if HIGH/CORRUPTED found
- ℹ️ Info modal if MEDIUM found

### Check Network
- Finds all network calls in extension code
- Assesses risk level for each host
- Compares against malicious hosts database
- 🔴 Error modal if CRITICAL risk found
- 🟠 Warning modal if HIGH risk found
- ℹ️ Info modal if MEDIUM risk found

---

## Test Data: What Gets Detected

### malicious-mock Extension

| Pattern | Severity | File | Line |
|---------|----------|------|------|
| eval() | 🔴 CRITICAL | extension.js | 8 |
| Function() | 🔴 CRITICAL | extension.js | 13 |
| process.exit | 🔴 CRITICAL | extension.js | 48 |
| dynamic require | 🟠 HIGH | extension.js | 19 |
| fs.unlink | 🟠 HIGH | extension.js | 54 |
| fetch() | 🟠 HIGH | extension.js | 26-28 |
| minified code | 🟡 MEDIUM | extension.js | 36-38 |
| hex escaping | 🟡 MEDIUM | extension.js | 41 |
| WebSocket | 🟡 MEDIUM | extension.js | 44 |
| broad activation | 🟡 MEDIUM | package.json | manifest |

### clean-mock Extension

| Category | Status |
|----------|--------|
| Publisher | ✅ Declared |
| Activation | ✅ Lazy (onCommand) |
| Repository | ✅ Linked |
| Code patterns | ✅ Clean |
| Permissions | ✅ None requested |

---

## Verifying Alerts Work

After installing test extensions:

```bash
npm run esbuild-watch
# Press F5 in VS Code
```

When you run `AuditExt: Check Integrity`:
1. You should see a 🔴 Error modal about malicious-mock
2. Clicking "View Report" opens the output channel
3. Output shows all 12 detected patterns
4. clean-mock shows no issues

When you run `AuditExt: Check Network`:
1. You should see a 🔴 Error modal about network risks
2. Malicious hosts are flagged (minergate.com, c3pool.com, etc.)

---

## Files Overview

```
test-extensions/
├── README.md                    # This guide
├── test-harness.bat            # Windows installer script
├── test-harness.sh             # macOS/Linux installer script
├── malicious-mock/
│   ├── package.json            # Manifest with suspicious config
│   └── extension.js            # 12 detection patterns
├── clean-mock/
│   ├── package.json            # Safe manifest
│   └── extension.js            # Clean code example
```

---

## Cleanup

If test extensions get stuck:

**Windows:**
```batch
rmdir /s %USERPROFILE%\.vscode\extensions\auditex-test-*
```

**macOS/Linux:**
```bash
rm -rf ~/.vscode/extensions/auditex-test-*
```

---

## Next: What to Test

- [ ] Verify CRITICAL alerts appear for malicious-mock
- [ ] Verify no alerts for clean-mock
- [ ] Check that all 12 patterns are detected
- [ ] Verify modals have correct severity levels
- [ ] Test "View Report" button functionality
- [ ] Test network host detection
- [ ] Verify performance with multiple extensions
