---
name: test-auditext
description: Run the AuditExt test harness end-to-end. Use when the user wants to install the malicious-mock and clean-mock extensions, run an audit, and verify the output. Triggers on phrases like "test auditext", "run the test harness", "install mock extensions", "verify audit detection", "check integrity test", or "check network test".
---

# Test AuditExt

End-to-end manual test workflow for AuditExt. The mock extensions under `test-extensions/` exercise the full detection surface (12 patterns + malicious-host detection + clean baseline).

## What this skill does

1. **Build** the extension bundle (TypeScript → `out/extension.js`).
2. **Install** `malicious-mock` and `clean-mock` into `~/.vscode/extensions/auditex-test-*` via the cross-platform harness.
3. **Run** all three audit commands (`auditext.auditExtensions`, `auditext.checkIntegrity`, `auditext.checkNetwork`) in a real Extension Host.
4. **Verify** the output channel contains the expected detections.
5. **Clean up** by removing the mock extensions when done.

## Workflow

### Step 1 — Confirm the build is current

```bash
npm test
npm run esbuild
```

`npm test` runs `tsc --noEmit` + `eslint src --ext ts` and is the cheapest static sanity check. If it fails, stop and fix the errors before continuing. If `esbuild` fails, check that `out/extension.js` exists and was just regenerated.

### Step 2 — Run the test harness

The harness is platform-aware. Detect the platform and run the right script:

**Windows (PowerShell 5.1):**
```powershell
& "C:\Users\xbox8\Documents\GitHub\AuditExt\test-extensions\test-harness.bat" install-all
```

**macOS / Linux / WSL:**
```bash
bash "C:\Users\xbox8\Documents\GitHub\AuditExt\test-extensions\test-harness.sh" install-all
# (or just ./test-extensions/test-harness.sh on unix)
```

The harness copies `malicious-mock` → `auditex-test-malicious-mock` and `clean-mock` → `auditex-test-clean-mock` under `%USERPROFILE%\.vscode\extensions\` (or `~/.vscode/extensions/` on unix). It refuses to touch any non-`auditex-test-*` directory.

### Step 3 — Launch the Extension Host

```bash
& "C:\Users\xbox8\Documents\GitHub\AuditExt\test-extensions\test-harness.bat" list
```

Should report both `auditex-test-malicious-mock` and `auditex-test-clean-mock` as installed. Then in VS Code press `F5` to launch a new Extension Host window with the freshly built AuditExt loaded.

> The Extension Host is the only way to exercise the real audit commands — `npm test` covers static checks (typecheck + lint) but cannot exercise the audit logic against a live extension host.

### Step 4 — Invoke the audit commands

In the Extension Host, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run each in order:

1. **AuditExt: Audit Extensions** — full inventory. The malicious-mock contributes a `*` activation event, so it should appear with broad-activation flags. The output channel header should list ≥ 1 mock extension.
2. **AuditExt: Check Integrity** — should fire a 🔴 Error modal ("CRITICAL severity issues found") because `malicious-mock` contains `eval()`, `Function()`, `process.exit/kill`, and dynamic crypto imports.
3. **AuditExt: Check Network** — should fire a 🔴 Error modal ("CRITICAL risk network calls") because the mock fetches from `bit.ly`, `c3pool.com`, `no-ip.com`, etc.

Open the AuditExt output channel and confirm these patterns are present:

| Pattern | Expected severity | File |
|---|---|---|
| `eval()` execution | CRITICAL | malicious-mock/extension.js:11 |
| `Function()` constructor | CRITICAL | malicious-mock/extension.js:16 |
| Dynamic `require`/`import` with crypto/http | HIGH | malicious-mock/extension.js:21-24 |
| `fetch` to known malicious host | CRITICAL/HIGH | malicious-mock/extension.js:28-33 |
| `setInterval` + network | HIGH | malicious-mock/extension.js:65-67 |
| `WebSocket` | MEDIUM | malicious-mock/extension.js:37-39 |
| Minified obfuscated code | MEDIUM | malicious-mock/extension.js:42-44 |
| Hex escaping (`\x65\x76\x61\x6c`) | MEDIUM | malicious-mock/extension.js:47 |
| `process.exit` / `process.kill` | CRITICAL | malicious-mock/extension.js:51-52 |
| `fs.writeFile` / `fs.unlink` | HIGH | malicious-mock/extension.js:59-60 |
| `crypto.subtle.deriveBits` | HIGH | malicious-mock/extension.js:72-77 |
| `broad activation: *` | MEDIUM | malicious-mock/package.json |

`clean-mock` should appear in the inventory but trigger **zero** integrity or network findings.

### Step 5 — Clean up

Always clean up — leaving `auditex-test-*` extensions installed will pollute real audits.

**Windows:**
```powershell
& "C:\Users\xbox8\Documents\GitHub\AuditExt\test-extensions\test-harness.bat" remove-all
```

**macOS / Linux:**
```bash
bash "C:\Users\xbox8\Documents\GitHub\AuditExt\test-extensions\test-harness.sh" remove-all
```

Nuclear option if the harness gets out of sync:
```bash
rm -rf ~/.vscode/extensions/auditex-test-*
```

## Common failures

- **"VS Code extensions directory not found"** — VS Code has never been launched on this profile, or `HOME`/`USERPROFILE` is wrong. Open VS Code once so the directory is created.
- **No modal appears** — make sure the bundle is current. `npm run esbuild` then re-launch Extension Host with F5. Loading the cached `out/extension.js` from a previous build is the #1 cause of "nothing changed" surprises.
- **Modal appears but output channel is empty** — the report was written to a stale channel. Click "View Report" from the modal; it calls `channel.show()` and reveals the latest log.
- **`clean-mock` shows up as MEDIUM** — wrong. The clean-mock has publisher, repo, homepage, lazy activation, and a settings block. If it shows issues, the whitelist/regex logic regressed — re-check `KNOWN_HOSTS` and the `eval`/`Function` patterns.
- **Permissions/elevation issues on Windows** — the harness uses `xcopy`; if it errors, run the prompt as the user that owns `~/.vscode/`.

## Expected output snippet

```
═══════════════════════════════════════════════════════════════════════════
  AuditExt - Security & Integrity Check Report
  Generated: 2026-06-01T...
═══════════════════════════════════════════════════════════════════════════

🔴 test-publisher.mock-malicious-extension
    🟠 HIGH:
      broad activation event: * (always-on)
    🔴 CRITICAL:
      eval() usage at extension.js:11
      new Function() constructor at extension.js:16
      process.exit() / process.kill() at extension.js:51-52
    🟠 HIGH:
      dynamic require/import with crypto/http at extension.js:21-24
      setInterval + network (C&C pattern) at extension.js:65-67
      fs.writeFile / fs.unlink at extension.js:59-60
      crypto.subtle.deriveBits (mining indicator) at extension.js:72-77
      fetch() to known malicious host at extension.js:28-33
    🟡 MEDIUM:
      WebSocket usage at extension.js:37-39
      minified code detected at extension.js:42-44
      hex-escaped string at extension.js:47

✅ test-publisher.mock-clean-extension
    No issues detected.

──────────────────────────────────────────────────────────────────────────
  🔴 CRITICAL: 1 extension(s)
  🟠 HIGH: 1 extension(s)
  🟡 MEDIUM: 1 extension(s)
  💥 CORRUPTED: 0 extension(s)
```

## Related skills

- `verify-bug-fixes` — run after the tests pass; statically checks the 3 specific bugs fixed in v0.1.0.
- `audit-mock-extensions` — quick read of what's actually inside the mock files, useful when debugging why a pattern did or didn't fire.
