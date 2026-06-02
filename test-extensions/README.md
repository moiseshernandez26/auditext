# AuditExt Testing Guide

This directory contains tools and mock extensions for safely testing AuditExt without affecting your system.

## Quick Start (Windows)

```batch
cd test-extensions
test-harness.bat install-all
```

Then in VS Code:
1. Press **F5** to launch Extension Host with AuditExt
2. Command Palette: `AuditExt: Check Integrity`
3. You should see the mock extensions and their detected issues
4. After testing: `test-harness.bat remove-all`

## Quick Start (macOS/Linux)

```bash
cd test-extensions
chmod +x test-harness.sh
./test-harness.sh install-all
```

Then in VS Code:
1. Press **F5** to launch Extension Host with AuditExt
2. Command Palette: `AuditExt: Check Integrity`
3. You should see the mock extensions and their detected issues
4. After testing: `./test-harness.sh remove-all`

---

## Available Commands

### `test-harness.bat install-all` (Windows)
Installs all mock extensions to your VS Code extensions directory:
- `malicious-mock` - Contains suspicious patterns for detection testing
- `clean-mock` - Safe extension that passes all checks

### `./test-harness.sh install-all` (macOS/Linux)
Same as above for Unix-like systems.

### `test-harness.bat remove-all` (Windows)
Removes all installed test extensions. **Safe to run** - only removes test extensions prefixed with `auditex-test-`.

### `./test-harness.sh remove-all` (macOS/Linux)
Same as above.

### `test-harness.bat list` (Windows)
Lists available test extensions and currently installed ones.

### `./test-harness.sh list` (macOS/Linux)
Same as above.

---

## What Each Test Extension Does

### `malicious-mock` - Contains 12 Suspicious Patterns

This mock extension is designed to trigger AuditExt's detection system:

| Pattern | Severity | Expected Detection |
|---------|----------|-------------------|
| `eval()` | CRITICAL | Code execution detection |
| `Function()` constructor | CRITICAL | Dynamic code generation |
| Dynamic require/import | HIGH | Runtime code execution |
| Network calls to malicious hosts | CRITICAL/HIGH | `minergate.com`, `c3pool.com`, `bit.ly`, etc. |
| WebSocket connections | MEDIUM | Suspicious communication |
| Minified obfuscated code | MEDIUM | Obfuscation indicators |
| Hex string escaping | MEDIUM | String obfuscation |
| Process control | CRITICAL | `process.exit()`, `process.kill()` |
| File system write/delete | HIGH | `fs.unlink()`, `fs.writeFile()` |
| Continuous network requests | HIGH | `setInterval()` + fetch patterns |
| Cryptographic operations | HIGH | `crypto.subtle.deriveBits()` (mining indicator) |
| Web Workers | MEDIUM | Background code execution |

**Safety**: This code is never actually executed - it's just pattern detection testing.

### `clean-mock` - Safe Reference Extension

This extension follows all best practices:
- ✅ Proper publisher declared
- ✅ Repository and homepage links included
- ✅ Lazy activation (`onCommand:` not `*`)
- ✅ No malicious code patterns
- ✅ Configuration section
- ✅ Proper manifest structure

Expected result: **No warnings or errors** from AuditExt.

---

## Testing Workflow

### Step 1: Build AuditExt
```bash
npm run esbuild
```

### Step 2: Install Test Extensions
```batch
cd test-extensions
test-harness.bat install-all
```

### Step 3: Launch Debug Session
In VS Code root directory, press **F5** to launch Extension Host.

### Step 4: Run Audit Commands
Command Palette (Ctrl+Shift+P):
- `AuditExt: Audit Extensions` - See inventory including test extensions
- `AuditExt: Check Integrity` - See detected security issues in malicious-mock
- `AuditExt: Check Network` - See detected network calls

### Step 5: Verify Detections
Check the **AuditExt** output channel for:
- ✅ `clean-mock` should pass all checks
- ❌ `malicious-mock` should trigger multiple alerts

### Step 6: Cleanup
```batch
test-harness.bat remove-all
```

---

## What You Should See

### When running `Check Integrity`:

```
🔴 auditex-test-malicious-mock
    🔴 CRITICAL:
      eval() execution at line 8 (extension.js)
      Function() constructor at line 13 (extension.js)
      process control at line 48 (extension.js)
    🟠 HIGH:
      dynamic crypto/http require at line 19 (extension.js)
      dynamic crypto/http import at line 20 (extension.js)
      fs.write/chmod/unlink at line 54 (extension.js)
    🟡 MEDIUM:
      Suspicious minification pattern (87% short identifiers)
      High hex escaping count: 12 occurrences
      Web Worker execution at line 60 (extension.js)

✅ auditex-test-clean-mock
    ✓ No critical or high-severity issues found
```

### When running `Check Network`:

```
🔴 auditex-test-malicious-mock: auditex-test-malicious-mock
    🔴 CRITICAL:
      minergate.com (1 call)
      c3pool.com (1 call)
    🟠 HIGH:
      bit.ly (1 call)
      no-ip.com (1 call)
```

---

## Manual Testing Without Mocks

You can also test directly with real extensions:

1. **Don't install mocks**, just build AuditExt:
   ```bash
   npm run esbuild
   ```

2. Press F5 to launch Extension Host

3. Run any audit command to see real extensions analyzed

4. Look for any warnings for actual extensions you suspect

---

## Troubleshooting

### Test extensions not appearing in audit
- Verify they're in: `%USERPROFILE%\.vscode\extensions\auditex-test-*`
- Make sure you ran: `test-harness.bat install-all`
- Reload VS Code window (Ctrl+R)

### Patterns not being detected
- Check that malicious-mock is actually installed
- Verify the extension.js file contains the patterns
- Check AuditExt's regex patterns haven't changed

### Want to remove test extensions manually
```bash
# Windows
rmdir /s %USERPROFILE%\.vscode\extensions\auditex-test-*

# macOS/Linux
rm -rf ~/.vscode/extensions/auditex-test-*
```

---

## Advanced: Customize Test Extensions

Edit `malicious-mock/extension.js` to:
- Add new patterns to test
- Remove patterns you don't want to detect
- Change network hosts to test different detection rules

Edit `clean-mock/package.json` to:
- Add different activation events
- Change categories
- Add permissions to test permission detection

After editing, reinstall:
```batch
test-harness.bat remove-all
test-harness.bat install-all
```

---

## Safety Notes

✅ **Completely Safe Because:**
- Mock extensions are just files, never loaded by VS Code
- No code execution in mock extensions
- Pattern detection is text-based only
- Test harness only copies files around
- Easy to completely remove

❌ **Avoid:**
- Don't modify system extensions
- Don't test with real production extensions you don't trust
- Don't leave test extensions installed long-term
