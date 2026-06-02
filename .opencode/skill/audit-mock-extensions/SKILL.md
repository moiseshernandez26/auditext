---
name: audit-mock-extensions
description: Inspect the contents of the test-extensions/malicious-mock and test-extensions/clean-mock folders and map them to which AuditExt detection patterns they should fire. Use when debugging why a specific pattern did or did not appear in a test run, when writing a new mock, or when reviewing what the test suite actually covers. Triggers on phrases like "what does the malicious mock test", "show me the mock patterns", "what's in clean-mock", "audit mock extensions", or "list detection patterns".
---

# Audit Mock Extensions

A read-only inspection skill. Catalogues what each mock extension under `test-extensions/` actually contains, and maps every line in the mock code to the AuditExt pattern that should fire on it.

## When to use this skill

- A test run is missing a detection you expected to see. Check this first to confirm the pattern is *in* the mock.
- You're writing a new mock and want to know which patterns are still uncovered.
- You're tuning a regex and want to see real positive examples.
- The user asks "what does the test suite cover?" — answer from this catalogue, not from memory.

## Files at a glance

```
test-extensions/
├── README.md
├── test-harness.bat            (Windows)
├── test-harness.sh             (macOS/Linux)
├── malicious-mock/
│   ├── package.json            (broad activation: *)
│   └── extension.js            (89 lines, 12 patterns)
└── clean-mock/
    ├── package.json            (lazy activation, publisher, repo, homepage)
    └── extension.js            (20 lines, 0 patterns)
```

## malicious-mock — detection catalogue

Each entry below lists: line in the mock, the AuditExt pattern that should fire, and the expected severity.

### `test-extensions/malicious-mock/extension.js`

| Line | Code (excerpt) | Pattern matched | Expected severity |
|---|---|---|---|
| 11 | `eval(code);` | `eval(...)` execution | CRITICAL |
| 16 | `new Function("return require('crypto')")` | `Function()` constructor | CRITICAL |
| 22 | `require(\`${'crypto'}\`)` | Dynamic `require` with crypto/http keyword | HIGH |
| 23 | `import(\`${'http'}\`)` | Dynamic `import` with crypto/http keyword | HIGH |
| 28 | `fetch('https://malicious-host.com/beacon')` | `fetch` to unknown host (note: `malicious-host.com` is not in the database — this is a generic fetch detection, not a malicious-host detection) | MEDIUM/HIGH |
| 29 | `fetch('https://bit.ly/redirect')` | `fetch` to known malicious host (`bit.ly` is in `MALICIOUS_HOSTS`) | HIGH/CRITICAL |
| 30 | `fetch('https://no-ip.com/command')` | `fetch` to known malicious host (`no-ip.com`) | HIGH/CRITICAL |
| 33 | `http.get('https://c3pool.com/mining')` | `http.get` to known mining pool | HIGH/CRITICAL |
| 38 | `new WebSocket('wss://unknown-host.com/ws')` | `WebSocket` usage | MEDIUM |
| 42-44 | minified expressions (`const a=function(){...}`, `const _____=(_____++)=>...`, `const xxxxxxxx_yyyyy_zzzz=()=>...`) | Minified/obfuscated code heuristics (short var names, dense one-liners) | MEDIUM |
| 47 | `"\x65\x76\x61\x6c\x28\x22\x63\x6f\x64\x65\x22\x29"` | Hex-escaped string (decodes to `eval("code")`) | MEDIUM |
| 51 | `process.exit(1);` | `process.exit` | CRITICAL |
| 52 | `process.kill(process.pid);` | `process.kill` | CRITICAL |
| 59 | `fs.writeFile('./malicious.txt', ...)` | `fs.write*` | HIGH |
| 60 | `fs.unlink('./important.txt', ...)` | `fs.unlink` | HIGH |
| 65-67 | `setInterval(() => { fetch('https://xmr-us-east1.nanopool.org/api') }, 1000)` | `setInterval` + network call (C&C beacon pattern) | HIGH |
| 73 | `crypto.subtle.deriveBits(...)` | `crypto.subtle.deriveBits` (mining indicator) | HIGH |
| 82 | `new Worker('./worker.js')` | `Worker` constructor (suspicious background code) | MEDIUM |

### `test-extensions/malicious-mock/package.json`

| Field | Value | Why it's flagged |
|---|---|---|
| `activationEvents` | `["*"]` | Broad activation — fires on every VS Code startup. Triggers a MEDIUM `broad activation` finding. |

## clean-mock — zero-detection catalogue

This extension is designed to pass every check. Use it as a regression baseline: if it ever produces a finding, the detection logic has false-positive'd.

### `test-extensions/clean-mock/extension.js`

```js
const vscode = require('vscode');

function activate(context) {
  const disposable = vscode.commands.registerCommand('mock.cleanCommand', () => {
    vscode.window.showInformationMessage('Clean extension activated!');
  });
  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
```

Why it passes:
- No `eval`, no `Function()`, no `process.exit/kill`.
- No `fs.write*` or `fs.unlink`.
- No `setInterval`, no `Worker`, no `WebSocket`.
- No hex-escaped strings.
- No network calls at all.
- No dynamic `require`/`import` with sensitive keywords.

### `test-extensions/clean-mock/package.json`

| Field | Value | Why it's safe |
|---|---|---|
| `publisher` | `test-publisher` | Declared — passes sideloaded-extension check. |
| `activationEvents` | `["onCommand:mock.cleanCommand"]` | Lazy activation — no broad-startup trigger. |
| `repository.url` | `https://github.com/test/clean-extension` | Source code is reachable. |
| `homepage` | `https://github.com/test/clean-extension#readme` | Homepage is reachable. |
| `contributes.configuration` | A real settings block | Normal extension configuration; not a red flag. |

## Coverage matrix (quick reference)

| Detection | malicious-mock triggers it? | clean-mock triggers it? |
|---|---|---|
| `eval()` | yes (line 11) | no |
| `Function()` constructor | yes (line 16) | no |
| Dynamic `require` with crypto/http | yes (line 22) | no |
| Dynamic `import` with crypto/http | yes (line 23) | no |
| `fetch` to malicious host | yes (lines 29, 30, 33) | no |
| `fetch` to unknown host | yes (line 28) | no |
| `WebSocket` | yes (line 38) | no |
| Minified code | yes (lines 42-44) | no |
| Hex escaping | yes (line 47) | no |
| `process.exit` | yes (line 51) | no |
| `process.kill` | yes (line 52) | no |
| `fs.write*` | yes (line 59) | no |
| `fs.unlink` | yes (line 60) | no |
| `setInterval` + network | yes (lines 65-67) | no |
| `crypto.subtle.deriveBits` | yes (line 73) | no |
| `Worker` | yes (line 82) | no |
| Broad activation `*` | yes (package.json) | no (uses `onCommand:`) |
| Missing publisher | no (declared) | no (declared) |
| Missing repository | no (declared) | no (declared) |
| Missing homepage | no (declared) | no (declared) |

## Patterns NOT currently covered by the mocks

When you're adding a new pattern, check this list first. The mocks are deliberately short, so some real-world patterns are absent:

- No `XMLHttpRequest` usage.
- No raw `http.request` with a constructed URL.
- No `axios`/`got`/`undici` calls (the mock uses `http.get` and `fetch` only).
- No `Buffer.from(..., 'base64')` + execute pattern (encoded payload).
- No `child_process.exec` / `child_process.spawn` (the mock has `require('child_process')` but never calls it — the regex may or may not fire on bare import).
- No `dns.lookup` / DNS exfiltration.
- No `process.env` exfiltration.

If you need to test these, extend `malicious-mock/extension.js` (and update this catalogue) rather than creating a new mock.

## Related skills

- `test-auditext` — installs the mocks and runs the actual audit commands.
- `verify-bug-fixes` — checks the 3 v0.1.0 fixes are still in place.
