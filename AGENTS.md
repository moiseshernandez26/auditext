# AGENTS.md

## Project Overview
AuditExt is a VS Code extension for auditing installed extensions and verifying their integrity. Built with TypeScript, esbuild, and the VS Code Extension API.

**Version**: 0.1.0  
**Status**: ✅ Production-ready (all audit features implemented, no TODO stubs)

## Critical Build & Run Commands

**Development build** (watch mode with sourcemaps):
```bash
npm run esbuild-watch
```

**Type checking** (before commits):
```bash
npm run typecheck
```

**Linting** (catches unused vars, prefer-const, etc.):
```bash
npm run lint
npm run lint:fix    # auto-fix what's safe
```

**Production build** (minified):
```bash
npm run vscode:prepublish
```

**Full static test cycle** (typecheck + lint):
```bash
npm test
```

## Architecture

- **Entry point:** `src/extension.ts` – activates on VS Code startup, registers commands
- **Commands:**
  - `auditext.auditExtensions` – main audit command (full inventory). Warns with a modal if > 5 extensions use broad activation events.
  - `auditext.checkIntegrity` – security and corruption detection. Emits severity-tiered modals (error / warning / info).
  - `auditext.checkNetwork` – network activity and risk analysis. Emits severity-tiered modals based on detected host risk.
- **Build output:** `out/extension.js` (bundled, referenced in `package.json` → `main`)
- **Manifest:** `package.json` declares activation, commands, and extension metadata

### Key detection databases (in `src/extension.ts`)
- `MALICIOUS_HOSTS` – 44 entries grouped by category (C&C, cryptominers, phishing, URL shorteners, malware distribution, dynamic DNS, free hosting, suspicious analytics, exploit kits).
- `KNOWN_HOSTS` – 40+ trusted services (Microsoft, GitHub, npm, CDNs, language servers, analytics).
- `MALICIOUS_PATTERNS` – 13+ regex patterns for `eval`, `Function()`, dynamic `require`/`import`, `setInterval` + network, `WebSocket`, hex escaping, `process.exit`/`process.kill`, `fs.write`/`fs.unlink`, `crypto.subtle.deriveBits`, etc.

## Key Quirks & Setup

1. **Extension activation:** Uses `onStartupFinished` event; extension runs automatically when VS Code opens
2. **Bundling required:** Code must be bundled into `out/extension.js` before testing locally; VS Code cannot run raw TypeScript
3. **vscode import:** Must import from `vscode` module; it's provided at runtime by VS Code host and excluded from the bundle
4. **Static tests are wired up:** `npm test` runs `typecheck + lint` via ESLint + tsc. Integration tests still require a real Extension Host (see `test-extensions/`); the harness is the closest thing to automation for those.
5. **Mock extensions are isolated:** The test harness only touches directories prefixed `auditex-test-` under `~/.vscode/extensions/`. Anything else on the user's machine is untouched.
6. **Alert UX is intentional:** Modal popups are triggered on a severity ladder (critical > high/corrupted > medium). Always include a "View Report" button that reveals the AuditExt output channel.

## File Organization

```
src/
  extension.ts          // Main extension entry point (all audit logic lives here)
out/                    // Generated bundled output (gitignored)
test-extensions/        // Mock extensions + harness for repeatable manual testing
  malicious-mock/       // Triggers CRITICAL/HIGH/MEDIUM detections
  clean-mock/           // Triggers zero detections
  test-harness.bat      // Windows: install-all | remove-all | list | help
  test-harness.sh       // macOS/Linux: same subcommands
  README.md             // Detailed mock-extension guide
package.json            // Manifest + npm scripts
tsconfig.json           // TypeScript config (strict mode enabled)
.vscodeignore           // Files excluded from published extension
.gitignore              // Excludes node_modules, out, .vscode-test
README.md               // User-facing feature/usage docs
TESTING.md              // Step-by-step testing guide (3 methods)
AGENTS.md               // This file – context for AI agents
.opencode/
  skill/                // opencode project skills (testing helpers)
    test-auditext/      // Run the test harness end-to-end
    verify-bug-fixes/   // Regression-check the 3 known bug fixes
    audit-mock-extensions/  // Inspect the mock extension content
```

## Development Workflow

1. **Make changes** in `src/`
2. **Run `npm run esbuild-watch`** to rebuild on every file change
3. **Open debug terminal** in VS Code and press F5 to launch Extension Host with your code
4. **Test commands** using Cmd Palette (Ctrl+Shift+P) → search for "AuditExt"
5. **Check TypeScript errors** before committing: `npm run typecheck`

## Common Pitfalls

- **Forgetting to bundle:** Raw `.ts` files won't load; always build to `out/`
- **vscode module errors:** Don't npm-install vscode itself; @types/vscode is enough, and vscode is injected by the host
- **Debug vs production:** Debug mode (F5) shows console logs and errors; production build must minify for extension store

## Testing Extensions Locally

1. Clone the repo and run `npm install`
2. Open in VS Code
3. Press F5 to launch Extension Host
4. Use Cmd Palette to invoke audit commands:
   - `auditext.auditExtensions` - View full extension inventory
   - `auditext.checkIntegrity` - Run security and corruption checks
   - `auditext.checkNetwork` - Analyze network activity
5. Output appears in the **AuditExt** output channel

### Testing with Mock Extensions (Recommended)

Use the test harness for repeatable, safe testing:

**Windows:**
```batch
cd test-extensions
test-harness.bat install-all   # Installs malicious-mock and clean-mock
REM Press F5 in VS Code to launch Extension Host
REM Run: AuditExt: Check Integrity
test-harness.bat remove-all    # Cleanup
```

**macOS/Linux:**
```bash
cd test-extensions
./test-harness.sh install-all
# Press F5 in VS Code to launch Extension Host
# Run: AuditExt: Check Integrity
./test-harness.sh remove-all
```

See [TESTING.md](./TESTING.md) for detailed testing guide.

## Recent Updates (v0.1.0)

### ✅ Completed
- **Audit Functionality:** Full implementation for discovering and auditing VS Code extensions
- **Integrity Checks:** Corruption detection, malicious code pattern detection, obfuscation analysis
- **Network Analysis:** Deep scanning of network calls with risk assessment
- **Malicious Hosts Database:** 44 known malicious hosts organized by category
  - C&C servers and cryptomining pools (minergate.com, c3pool.com, pool.minexmr.com, etc.)
  - Phishing and fraud sites
  - URL shorteners (bit.ly, tinyurl.com, ow.ly, short.link, linktr.ee, rebrand.ly, adf.ly)
  - Malware distribution (pastebin.com, raw.githubusercontent.com, cdn.jsdelivr.net, unpkg.com)
  - Dynamic DNS (no-ip.com, duckdns.org, freenom.com, ddns.net)
  - Free hosting (github.io, herokuapp.com, netlify.app, vercel.app)
  - Suspicious analytics (graph.windows.net, beacon.telemetry.microsoft.com, analytics.google.com, safebrowsing.googleapis.com)
  - Exploit kits (exploit-db.com, zerodayinitiative.com)
- **Security Patterns:** 13+ regex patterns for detecting common attack vectors
- **Trusted Hosts Whitelist:** 40+ known services that should not trigger alerts
- **Documentation:** README.md, TESTING.md, and test-extensions/README.md
- **User Alerts:** Severity-tiered modal popups
  - `auditExtensions`: ⚠️ Warning modal when > 5 extensions use broad activation events
  - `checkIntegrity`: 🔴 Error modal for ≥ 1 CRITICAL, 🟠 Warning for ≥ 1 HIGH/CORRUPTED, ℹ️ Info for medium-only
  - `checkNetwork`: 🔴 Error modal for ≥ 1 CRITICAL-risk call, 🟠 Warning for ≥ 1 HIGH-risk or malicious-host call, ℹ️ Info for medium-only
  - All modals include a "View Report" / "View Details" button that surfaces the AuditExt output channel
- **Test Infrastructure:** 2 mock extensions (malicious-mock, clean-mock) + cross-platform harness scripts
- **Bug Fixes (this session):**
  - **`scanForDynamicImports()` counter scope** – `count` was declared outside the nested function, so dynamic-import detection always returned 0. Restructured so the inner scanner runs against the same scope that increments the counter.
  - **`checkNetwork()` filePath shadowing** – `for (const [filePath, calls] of networkCalls)` overwrote the actual file path; downstream code assigned `url: filePath` to network-call objects, corrupting the URL. Changed to `for (const [, calls] of networkCalls)` and removed the bad assignment.
  - **Dead code removal** – `reputationCache` Map and `checkReputationOnline()` async function were defined but never invoked. Removed both, added a comment explaining why online checking is intentionally off.

### 📋 Audit Features Implemented
1. **`auditext.auditExtensions`** – Full extension inventory with metrics, broad-activation warning modal
2. **`auditext.checkIntegrity`** – Security/corruption detection with severity-tiered modal
3. **`auditext.checkNetwork`** – Network activity analysis with risk-tiered modal

### 🧪 Testing Artifacts
- `test-extensions/malicious-mock/` – Triggers all 12 patterns (eval, Function(), dynamic require/import, fetch→malicious hosts, setInterval + network, WebSocket, minified code, hex escaping, process.exit, process.kill, fs.write, fs.unlink, crypto.subtle.deriveBits)
- `test-extensions/clean-mock/` – Triggers zero detections; demonstrates proper publisher/repo/homepage/activation hygiene
- `test-extensions/test-harness.{bat,sh}` – `install-all` / `remove-all` / `list` / `help`; only touches `auditex-test-*` directories

## Next Steps for Agents

- **Enhanced Detection:** Add machine learning for obfuscation detection
- **UI/Output:** Build tree view, report panel, or status bar integration
- **Unit tests:** Wire up a real JS test runner (vitest or node:test) for the audit logic in `src/extension.ts`. Mocking the `vscode` module is the main hurdle.
- **Online Reputation:** Re-enable an online URL-reputation check (e.g. abuse.ch URLhaus). Add a config toggle and a per-run cache, plus a clear privacy notice. Note: `reputationCache` was removed in v0.1.0 because the function was never called — do not resurrect it without an actual call site.
- **Export:** Add JSON/CSV export functionality for reports
- **Scheduling:** Implement periodic audit runs with alerts
- **Extensions Marketplace:** Verify extensions against official marketplace
- **Splitting `extension.ts`:** It's now > 1 file worth of logic. Consider `src/audit/`, `src/patterns.ts`, `src/hosts.ts`, `src/commands/`.

## Working Conventions for Agents

- **No new comments unless asked.** The user has flagged the codebase for being comment-heavy in places. Only add comments where the logic is non-obvious (e.g. "why online reputation is disabled" is justified; "this is a loop" is not).
- **Match existing style:** camelCase functions, UPPER_SNAKE_CASE for module-level constants, severity tier constants where used.
- **TypeScript strict mode is on.** `tsconfig.json` enables strict null checks; new code must type-narrow.
- **Never add `vscode` to dependencies.** It is provided by the host at runtime. The bundle already marks it external in the esbuild script.
- **Run `npm test` before declaring done.** This runs `typecheck + lint` and is the cheapest sanity check.
- **`no-useless-escape` is off by design.** The pattern-detection code uses regexes with intentional character-class escapes (`\-`, `\[`, `\]`). Don't re-enable the rule without first removing those characters from the patterns.
- **No emojis in code or comments** unless the user asks. The README and AGENTS.md are the only places where they appear, and only where the user has used them.
