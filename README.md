# AuditExt - VS Code Extension Auditor

A comprehensive security and integrity auditing tool for VS Code extensions. AuditExt provides deep visibility into installed extensions, identifying security risks, corruption issues, and suspicious network behavior.

## Features

### 📋 Extension Audit (`auditext.auditExtensions`)
Generates a detailed report of all installed extensions with:
- **Basic Information**: Name, publisher, version, license
- **Activation Events**: How and when extensions activate
- **Broad Activation Detection**: ⚠️ Flags extensions that auto-activate on startup
- **Contributions**: Commands, keybindings, menus, views, languages, themes, etc.
- **Resource Usage**: Disk size, file count, lines of code, last modified date
- **Repository Info**: Links to source code and homepage

**Use case:** Understand what extensions you have, their footprint, and which ones consume the most resources.

---

### 🔒 Security & Integrity Check (`auditext.checkIntegrity`)
Performs deep security scanning with multiple checks:

#### Corruption Detection
- Missing or corrupted `package.json` files
- Missing extension directories
- Large files (>50MB) that may indicate bloat or data extraction
- Unreadable or inaccessible extension directories

#### Security Issues
- **Dangerous Permissions**: Flags extensions requesting broad filesystem access
- **Broad Activation Events**: Extensions that activate on `*` or startup (`onStartupFinished`)
- **Malicious Code Patterns**:
  - `eval()` and `Function()` constructor usage (critical)
  - Dynamic crypto/HTTP imports (high)
  - Continuous network requests (possible C&C communication)
  - Cryptographic operations (possible crypto mining)
  - Process control and file system write/delete operations
- **Obfuscation Indicators**:
  - Minified code with suspicious patterns
  - Hex character escaping (common in obfuscated malware)
  - High ratio of short variable names
- **Dynamic Imports/Requires**: Detects `require()` or `import()` with template literals (runtime code execution)
- **Sideloaded Extensions**: Extensions without a publisher (likely local builds)
- **Missing Repository Info**: User extensions with no source code link

**Use case:** Identify potentially malicious or compromised extensions before they execute.

---

### 🌐 Network Activity Analysis (`auditext.checkNetwork`)
Scans extensions for network communication patterns:

#### Network Call Detection
Identifies all network calls in extension code:
- `fetch()` calls
- `http`/`https` module requests
- `axios`, `got`, `undici` HTTP clients
- XMLHttpRequest
- Raw URL strings in code

#### Risk Assessment
Each network call is assessed for risk level:

**Critical/High Risk:**
- Known malicious hosts (C&C, phishing, malware distribution)
- Unknown public IP addresses
- Suspicious TLDs (`.tk`, `.ml`, `.ga`, `.cf`, `.gq`)

**Medium Risk:**
- Unknown hosts (not in whitelist)
- Short domain names (1-5 characters)
- Possible DGA (Domain Generation Algorithm) domains
- API endpoints to unknown hosts

**Info/Low Risk:**
- Known trusted hosts (GitHub, npm, Microsoft, CloudFlare, etc.)
- Private IP addresses

#### Malicious Hosts Database
Built-in detection for:
- **C&C Servers**: Mining pools, botnet command centers
- **URL Shorteners**: Bit.ly, TinyURL, etc. (often used in phishing)
- **Malware Hosting**: Pastebin, free hosting services
- **Dynamic DNS**: Services used to hide changing C&C IPs
- **Analytics**: Suspicious telemetry and tracking services

**Use case:** Detect extensions that attempt to phone home, exfiltrate data, or communicate with C&C servers.

---

## Installation

### From Source
```bash
git clone https://github.com/moiseshernandez26/auditext
cd AuditExt
npm install
npm run esbuild
```

Then in VS Code:
- Press `F5` to launch the Extension Host with AuditExt loaded
- Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Run one of the audit commands

### From VS Code Marketplace
[Download on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=S0nder.auditext)

---

## Usage

1. Open VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Search for one of the audit commands:
   - **AuditExt: Audit Extensions** - Full overview of all extensions
   - **AuditExt: Check Integrity** - Security and corruption detection
   - **AuditExt: Check Network** - Network activity analysis
4. Results appear in the **AuditExt** output channel

### Example Output

```
═══════════════════════════════════════════════════════════════════════════
  AuditExt - Security & Integrity Check Report
  Generated: 2026-06-01T10:30:45.123Z
═══════════════════════════════════════════════════════════════════════════

🔴 publisher.extension-name
    Corruption issues:
      ✗ Invalid package.json (not parseable JSON)
    🔴 CRITICAL:
      eval() execution at line 142 (minified.js)
    🟠 HIGH:
      dynamic crypto/http require at line 89 (malicious.js)

🟠 another.malicious-ext
    🟠 HIGH:
      256 dynamic require/import detected (runtime code execution)
      No source maps available (obfuscated/compiled)

───────────────────────────────────────────────────────────────────────────
  🔴 CRITICAL: 1 extension(s)
  🟠 HIGH: 5 extension(s)
  🟡 MEDIUM: 12 extension(s)
  💥 CORRUPTED: 1 extension(s)
```

---

## Security Features

### Pattern Detection
- **Malicious Code Patterns**: 13 regex patterns detect common attack vectors
- **Obfuscation Detection**: Identifies minified code, hex escaping, and suspicious patterns
- **Network Call Analysis**: Scans 8+ different types of HTTP clients and network APIs

### Known Hosts Whitelist
Includes 40+ known trusted services:
- Microsoft & VS Code infrastructure
- NPM, GitHub, and version control systems
- CDNs and package managers
- Language servers and development tools
- Analytics and monitoring services

### Malicious Hosts Database
Maintains 40+ known malicious domains organized by category:
- Cryptocurrency mining pools
- Phishing and fraud sites
- Malware distribution vectors
- C&C communication endpoints
- DGA (algorithmically generated) domains

---

## Architecture

```
src/
  extension.ts          # Main extension entry point
    ├── auditExtensions()          # Full audit report
    ├── checkIntegrity()           # Security & corruption checks
    ├── checkNetwork()             # Network activity analysis
    ├── getDirStats()              # Calculate extension metrics
    ├── getContributions()         # Parse package.json contributions
    ├── scanExtensionForNetworkCalls()  # Network pattern detection
    ├── checkCodeForMaliciousPatterns() # Malware pattern detection
    └── assessRisk()               # Risk assessment engine

package.json          # Extension manifest
tsconfig.json         # TypeScript configuration
out/                  # Compiled output (bundled)
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `auditExtensions()` | Generate comprehensive extension inventory |
| `checkIntegrity()` | Detect corruption, malware, dangerous permissions |
| `checkNetwork()` | Analyze network communication patterns |
| `scanCodeForNetworkCalls()` | Extract URLs and network APIs from code |
| `checkCodeForMaliciousPatterns()` | Detect known attack patterns |
| `assessRisk()` | Determine risk level for hosts/IPs |
| `isValidHost()` | Validate domain/IP format |
| `extractHostFromUrl()` | Parse hostname from URL strings |

---

## Configuration

### Environment
- **Node.js**: 14+
- **VS Code**: 1.50+
- **TypeScript**: 4.0+

### Build Scripts
```bash
npm run esbuild              # Build with sourcemaps
npm run esbuild-watch       # Watch mode (auto-rebuild)
npm run vscode:prepublish   # Production build (minified)
npm run typecheck           # Type check without building
npm run lint                # ESLint (warnings only, never fails)
npm run lint:fix            # ESLint with --fix (auto-fix what's safe)
npm test                    # typecheck + lint (the static test cycle)
```

`npm test` is the canonical "did I break anything?" command. It runs `tsc --noEmit` first, then `eslint src --ext ts`. Both must pass (warnings are OK; errors fail the script). See [TESTING.md](./TESTING.md) for the integration-test workflow.

---

## Known Limitations

1. **Dynamic Code Execution**: Cannot detect `eval()` or dynamically constructed malware that uses runtime code generation with encrypted payloads
2. **Network Calls**: Only detects explicit network calls in source code, not dynamic API construction
3. **Encrypted Communications**: Cannot analyze encrypted payloads
4. **Extension Dependencies**: Does not recursively scan transitive npm dependencies
5. **Obfuscation**: Some sophisticated obfuscation techniques may evade detection

---

## False Positives

Some legitimate extensions may trigger warnings:

- **Broad Activation**: VS Code features like settings sync use `onStartupFinished`
- **Network Calls**: IDEs, linters, and language servers legitimately contact external services
- **Large Files**: Some extensions bundle pre-built binaries or language runtimes
- **Dynamic Imports**: Webpack-bundled extensions may use dynamic requires for code splitting

Always review warnings in context of the extension's purpose.

---

## Contributing

Found a new malicious host or attack pattern? Contributions welcome!

1. Fork the repository
2. Add new hosts to `MALICIOUS_HOSTS` or patterns to `MALICIOUS_PATTERNS`
3. Add corresponding entries to `KNOWN_HOSTS` if it's a legitimate service
4. Test with `npm run typecheck && npm run esbuild`
5. Submit a pull request

---

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Security Best Practices](https://code.visualstudio.com/api/working-with-extensions/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [URLhaus Malware Database](https://urlhaus.abuse.ch/)
- [abuse.ch - Malware Intelligence](https://www.abuse.ch/)

---

## License

MIT

---

## Disclaimer

AuditExt is designed to identify potential security risks and suspicious patterns. It is **not** a replacement for:
- Professional security audits
- Manual code review
- Sandboxed testing
- Behavior monitoring in isolated environments

Always exercise caution when installing extensions from untrusted sources. If you find a malicious extension, report it to [Microsoft's VS Code Marketplace](https://marketplace.visualstudio.com/).

---

## Changelog

### v0.1.0
- Initial release
- Audit extensions command
- Integrity checking
- Network activity analysis
- 40+ malicious hosts database
- 13 malicious code patterns
- Obfuscation detection
