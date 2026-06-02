import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const outputChannel = vscode.window.createOutputChannel('AuditExt');

const BROAD_ACTIVATION_EVENTS = new Set([
  '*',
  'onStartupFinished',
  'onFileSystem:*',
  'onUri:*',
  'onWebviewPanel:*',
  'onCustomEditor:*',
  'onAuthenticationRequest',
  'onDidChangeAuthenticationProviders',
]);

function showOutput() {
  outputChannel.show(true);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getDirStats(dirPath: string): { size: number; fileCount: number; lastModified: number; loc: number } {
  const stats = { size: 0, fileCount: 0, lastModified: 0, loc: 0 };
  try {
    if (!fs.existsSync(dirPath)) return stats;
    walkDir(dirPath, stats);
  } catch {
    // ignore
  }
  return stats;
}

function walkDir(dirPath: string, stats: { size: number; fileCount: number; lastModified: number; loc: number }): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        walkDir(fullPath, stats);
      } else if (entry.isFile()) {
        const st = fs.statSync(fullPath);
        stats.size += st.size;
        stats.fileCount++;
        if (st.mtimeMs > stats.lastModified) stats.lastModified = st.mtimeMs;
        if (/\.(ts|js|tsx|jsx|mjs|cjs)$/i.test(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            stats.loc += content.split('\n').length;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // skip inaccessible
    }
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function getExtensionType(ext: vscode.Extension<any>, installPath: string): string {
  const builtin = (ext as any).isBuiltin === true;
  if (builtin) return 'Built-in';
  if (installPath.toLowerCase().includes('\\.vscode\\extensions\\')) return 'User';
  if (installPath.toLowerCase().includes('\\extensions\\') && !installPath.toLowerCase().includes('\\.vscode-')) {
    return 'User';
  }
  return 'User';
}

function getContributions(pkg: any): { commands: number; keybindings: number; menus: number; configuration: number; languages: number; themes: number; snippets: number; grammars: number; views: number } {
  const c = pkg.contributes || {};
  return {
    commands: Array.isArray(c.commands) ? c.commands.length : 0,
    keybindings: Array.isArray(c.keybindings) ? c.keybindings.length : 0,
    menus: c.menus && typeof c.menus === 'object' ? Object.keys(c.menus).reduce((a: number, k: string) => a + (Array.isArray(c.menus[k]) ? c.menus[k].length : 0), 0) : 0,
    configuration: c.configuration ? 1 : 0,
    languages: Array.isArray(c.languages) ? c.languages.length : 0,
    themes: Array.isArray(c.themes) ? c.themes.length : 0,
    snippets: Array.isArray(c.snippets) ? c.snippets.length : 0,
    grammars: Array.isArray(c.grammars) ? c.grammars.length : 0,
    views: c.views && typeof c.views === 'object' ? Object.keys(c.views).reduce((a: number, k: string) => a + (Array.isArray(c.views[k]) ? c.views[k].length : (typeof c.views[k] === 'string' ? 1 : 0)), 0) : 0,
  };
}

function getActivationEvents(pkg: any): string[] {
  if (Array.isArray(pkg.activationEvents)) return pkg.activationEvents;
  if (typeof pkg.activationEvents === 'string') return [pkg.activationEvents];
  return [];
}

function getBroadActivationEvents(events: string[]): string[] {
  return events.filter(e => BROAD_ACTIVATION_EVENTS.has(e) || e.endsWith(':*'));
}

function auditExtensions() {
  // showOutput();
  const extensions = vscode.extensions.all;

  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('  AuditExt - Extension Audit Report');
  outputChannel.appendLine(`  Generated: ${new Date().toISOString()}`);
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('');

  // Build data for all extensions
  const data = extensions.map(ext => {
    const pkg = ext.packageJSON;
    const id = ext.id;
    const name = pkg.name || id;
    const displayName = pkg.displayName || name;
    const publisher = pkg.publisher || (id ? id.split('.')[0] : '?');
    const version = pkg.version || '?';
    const description = pkg.description || '';
    const license = pkg.license || '?';
    const engines = pkg.engines?.vscode || '?';
    const categories: string[] = Array.isArray(pkg.categories) ? pkg.categories : [];
    const activationEvents = getActivationEvents(pkg);
    const broadEvents = getBroadActivationEvents(activationEvents);
    const contributions = getContributions(pkg);
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '';
    const homepage = pkg.homepage || '';
    const installPath = ext.extensionPath;
    const extType = getExtensionType(ext, installPath);
    const extKind = ext.extensionKind ? String(ext.extensionKind) : 'ui';
    const stats = getDirStats(installPath);
    const lastModified = stats.lastModified > 0 ? new Date(stats.lastModified) : null;

    return {
      id, name, displayName, publisher, version, description, license, engines, categories,
      activationEvents, broadEvents, contributions, repo, homepage, installPath, extType, extKind,
      isActive: ext.isActive, stats, lastModified,
    };
  });

  // Summary
  const total = data.length;
  const activeCount = data.filter(d => d.isActive).length;
  const builtinCount = data.filter(d => d.extType === 'Built-in').length;
  const userCount = data.filter(d => d.extType === 'User').length;
  const totalSize = data.reduce((a, d) => a + d.stats.size, 0);
  const totalFiles = data.reduce((a, d) => a + d.stats.fileCount, 0);
  const totalLoc = data.reduce((a, d) => a + d.stats.loc, 0);
  const broadCount = data.filter(d => d.broadEvents.length > 0).length;

  outputChannel.appendLine(`  Total extensions:    ${total}`);
  outputChannel.appendLine(`  Active:              ${activeCount}`);
  outputChannel.appendLine(`  Built-in:            ${builtinCount}`);
  outputChannel.appendLine(`  User installed:      ${userCount}`);
  outputChannel.appendLine(`  Total disk size:     ${formatBytes(totalSize)}`);
  outputChannel.appendLine(`  Total files:         ${totalFiles.toLocaleString()}`);
  outputChannel.appendLine(`  Total code lines:    ${totalLoc.toLocaleString()}`);
  outputChannel.appendLine(`  Broad activation:    ${broadCount} extension(s) auto-activate on many events`);
  outputChannel.appendLine('');
  outputChannel.appendLine('───────────────────────────────────────────────────────────────────────────');
  outputChannel.appendLine('');

  // Per-extension details - show user-installed first
  const sorted = [...data].sort((a, b) => {
    if (a.extType !== b.extType) return a.extType === 'User' ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  for (const d of sorted) {
    outputChannel.appendLine(`  ▌ ${d.displayName}`);
    outputChannel.appendLine(`    ${pad('ID:', 18)} ${d.id}`);
    outputChannel.appendLine(`    ${pad('Name:', 18)} ${d.name}`);
    if (d.description) {
      const wrapped = wrapText(d.description, 60);
      wrapped.forEach((line, i) => outputChannel.appendLine(`    ${pad(i === 0 ? 'Description:' : '', 18)} ${line}`));
    }
    outputChannel.appendLine(`    ${pad('Publisher:', 18)} ${d.publisher}`);
    outputChannel.appendLine(`    ${pad('Version:', 18)} ${d.version}`);
    outputChannel.appendLine(`    ${pad('License:', 18)} ${d.license}`);
    outputChannel.appendLine(`    ${pad('Min VS Code:', 18)} ${d.engines}`);
    outputChannel.appendLine(`    ${pad('Type:', 18)} ${d.extType} (${d.extKind})`);
    outputChannel.appendLine(`    ${pad('Status:', 18)} ${d.isActive ? 'Active' : 'Inactive'}`);
    if (d.categories.length > 0) {
      outputChannel.appendLine(`    ${pad('Categories:', 18)} ${d.categories.join(', ')}`);
    }
    if (d.activationEvents.length > 0) {
      outputChannel.appendLine(`    ${pad('Activates on:', 18)} ${d.activationEvents.length} event(s)`);
      d.activationEvents.slice(0, 5).forEach(ev => {
        const isBroad = d.broadEvents.includes(ev) ? '⚠' : ' ';
        outputChannel.appendLine(`      ${isBroad} ${ev}`);
      });
      if (d.activationEvents.length > 5) {
        outputChannel.appendLine(`      ... and ${d.activationEvents.length - 5} more`);
      }
    } else {
      outputChannel.appendLine(`    ${pad('Activates on:', 18)} (lazy / on demand)`);
    }
    if (d.broadEvents.length > 0) {
      outputChannel.appendLine(`    ${pad('Security flag:', 18)} ⚠ broad activation (auto-runs often)`);
    }

    const contribs = d.contributions;
    const contribParts: string[] = [];
    if (contribs.commands) contribParts.push(`${contribs.commands} cmd`);
    if (contribs.keybindings) contribParts.push(`${contribs.keybindings} keys`);
    if (contribs.menus) contribParts.push(`${contribs.menus} menus`);
    if (contribs.views) contribParts.push(`${contribs.views} views`);
    if (contribs.languages) contribParts.push(`${contribs.languages} langs`);
    if (contribs.grammars) contribParts.push(`${contribs.grammars} grammars`);
    if (contribs.themes) contribParts.push(`${contribs.themes} themes`);
    if (contribs.snippets) contribParts.push(`${contribs.snippets} snippets`);
    if (contribs.configuration) contribParts.push(`config`);
    if (contribParts.length > 0) {
      outputChannel.appendLine(`    ${pad('Contributes:', 18)} ${contribParts.join(', ')}`);
    }

    outputChannel.appendLine(`    ${pad('Size:', 18)} ${formatBytes(d.stats.size)} (${d.stats.fileCount} files)`);
    if (d.stats.loc > 0) {
      outputChannel.appendLine(`    ${pad('Source lines:', 18)} ${d.stats.loc.toLocaleString()}`);
    }
    if (d.lastModified) {
      outputChannel.appendLine(`    ${pad('Last modified:', 18)} ${d.lastModified.toISOString().slice(0, 19).replace('T', ' ')}`);
    }
    if (d.repo) {
      outputChannel.appendLine(`    ${pad('Repository:', 18)} ${d.repo}`);
    }
    if (d.homepage) {
      outputChannel.appendLine(`    ${pad('Homepage:', 18)} ${d.homepage}`);
    }
    outputChannel.appendLine(`    ${pad('Path:', 18)} ${d.installPath}`);
    outputChannel.appendLine('');
  }

  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('  Audit complete');
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');

  // Alert if many extensions with broad activation
  if (broadCount > 5) {
    vscode.window.showWarningMessage(
      `⚠️ AuditExt: ${broadCount} extensions with broad activation detected. These may impact startup performance.`,
      'View Details'
    ).then(selection => {
      if (selection === 'View Details') {
        showOutput();
      }
    });
  }
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > width) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

// Dangerous permissions/capabilities that extensions shouldn't need
const DANGEROUS_PERMISSIONS = new Set([
  'fileSystem',
  'fileSystem.readFile',
  'fileSystem.writeFile',
  'fileSystem.deleteFile',
]);

const DANGEROUS_CAPABILITIES = new Set([
  'virtualWorkspaces',
  'untrustedWorkspaces',
]);

// Malicious code patterns
const MALICIOUS_PATTERNS = [
  { regex: /\beval\s*\(/gi, name: 'eval() execution', severity: 'critical' },
  { regex: /Function\s*\(\s*['"]/gi, name: 'Function() constructor', severity: 'critical' },
  { regex: /require\s*\(\s*['"`].*(?:crypto|http).*['"`]\s*\)/gi, name: 'dynamic crypto/http require', severity: 'high' },
  { regex: /import\s*\(\s*['"`].*(?:crypto|http).*['"`]\s*\)/gi, name: 'dynamic crypto/http import', severity: 'high' },
  { regex: /setInterval\s*\(\s*(?:fetch|http|axios)/gi, name: 'continuous network requests (possible C&C)', severity: 'high' },
  { regex: /while\s*\([^)]*\)\s*\{[^}]*(?:fetch|http|axios)/gi, name: 'loop with network requests', severity: 'high' },
  { regex: /crypto\.subtle\.deriveBits|crypto\.subtle\.deriveKey/gi, name: 'cryptographic key derivation (possible crypto mining)', severity: 'high' },
  { regex: /Worker\s*\(\s*['"`]/gi, name: 'Web Worker execution', severity: 'medium' },
  { regex: /WebSocket\s*\(\s*['"`]/gi, name: 'WebSocket connection', severity: 'medium' },
  { regex: /localStorage|sessionStorage/gi, name: 'local storage access', severity: 'low' },
  { regex: /process\.exit|process\.kill|require\s*\(\s*['"`]child_process/gi, name: 'process control', severity: 'critical' },
  { regex: /fs\.write|fs\.chmod|fs\.unlink/gi, name: 'file system write/delete', severity: 'high' },
];

// Minification/obfuscation indicators
const OBFUSCATION_INDICATORS = [
  { regex: /^[a-z_]+\s*=\s*[a-z_]+\(\s*\);/gm, name: 'Self-executing obfuscated code' },
  { regex: /(\w)\1{50,}/g, name: 'Repeated characters (possible obfuscation)' },
  { regex: /\\x[0-9a-f]{2}/gi, name: 'Hex character escaping' },
];

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
}

function getDangerousPermissions(pkg: any): string[] {
  const dangerous: string[] = [];
  
  // Check workspace permissions
  const perms = pkg.permissions || [];
  if (Array.isArray(perms)) {
    for (const perm of perms) {
      if (DANGEROUS_PERMISSIONS.has(perm)) {
        dangerous.push(`Permission: ${perm}`);
      }
    }
  }
  
  // Check unrestricted file access
  if (pkg.capabilities?.filesystem === true) {
    dangerous.push('Full filesystem access');
  }
  
  return dangerous;
}

function checkCodeForMaliciousPatterns(code: string, fileName: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  for (const pattern of MALICIOUS_PATTERNS) {
    let match;
    while ((match = pattern.regex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        severity: pattern.severity as 'critical' | 'high' | 'medium' | 'low',
        message: `${pattern.name} at line ${lineNum}`,
        file: path.basename(fileName),
      });
    }
  }
  
  return issues;
}

function checkCodeObfuscation(code: string, fileName: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  // Check average variable name length (minified code has very short names)
  const varNames = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]{0,2}\b/g) || [];
  const shortVarRatio = varNames.length > 100 ? varNames.filter(v => v.length <= 2).length / varNames.length : 0;
  
  if (shortVarRatio > 0.6 && code.length > 10000) {
    issues.push({
      severity: 'medium',
      message: `Suspicious minification pattern (${(shortVarRatio * 100).toFixed(0)}% short identifiers)`,
      file: path.basename(fileName),
    });
  }
  
  // Check for hex escaping
  const hexCount = (code.match(/\\x[0-9a-f]{2}/gi) || []).length;
  if (hexCount > 50) {
    issues.push({
      severity: 'medium',
      message: `High hex escaping count: ${hexCount} occurrences (possible string obfuscation)`,
      file: path.basename(fileName),
    });
  }
  
  return issues;
}

function scanExtensionSourceForSecurity(extensionPath: string): { issues: SecurityIssue[]; hasSourceMaps: boolean } {
  const allIssues: SecurityIssue[] = [];
  let hasSourceMaps = false;
  
  try {
    walkDirForSecurity(extensionPath, allIssues);
    
    // Check for source maps
    const entries = fs.readdirSync(extensionPath, { withFileTypes: true });
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.endsWith('.map')) {
            hasSourceMaps = true;
            return;
          }
          if (entry.isDirectory() && !entry.name.includes('node_modules')) {
            walk(path.join(dir, entry.name));
          }
        }
      } catch {
        // ignore
      }
    };
    walk(extensionPath);
  } catch {
    // ignore
  }
  
  return { issues: allIssues, hasSourceMaps };
}

function walkDirForSecurity(dirPath: string, issues: SecurityIssue[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, entry.name);
    
    try {
      if (entry.isDirectory()) {
        walkDirForSecurity(fullPath, issues);
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx|mjs|cjs)$/i.test(entry.name)) {
        try {
          const code = fs.readFileSync(fullPath, 'utf-8');
          const malicious = checkCodeForMaliciousPatterns(code, fullPath);
          const obfuscated = checkCodeObfuscation(code, fullPath);
          issues.push(...malicious, ...obfuscated);
        } catch {
          // ignore unreadable files
        }
      }
    } catch {
      // ignore
    }
  }
}

function checkIntegrity() {
  showOutput();
  const extensions = vscode.extensions.all;

  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('  AuditExt - Security & Integrity Check Report');
  outputChannel.appendLine(`  Generated: ${new Date().toISOString()}`);
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('');

  let criticalFound = 0;
  let highFound = 0;
  let mediumFound = 0;
  let corruptedFound = 0;

  for (const ext of extensions) {
    const installPath = ext.extensionPath;
    const id = ext.id;
    const pkg = ext.packageJSON;
    const corruptionIssues: string[] = [];
    const securityIssues: SecurityIssue[] = [];

    // ===== CORRUPTION CHECK =====
    if (!fs.existsSync(installPath)) {
      corruptionIssues.push('✗ Extension directory missing');
    } else {
      const pkgPath = path.join(installPath, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        corruptionIssues.push('✗ Missing package.json');
      } else {
        try {
          const content = fs.readFileSync(pkgPath, 'utf-8');
          JSON.parse(content);
        } catch {
          corruptionIssues.push('✗ Invalid package.json (not parseable JSON)');
        }
      }

      try {
        const entries = fs.readdirSync(installPath);
        if (entries.length === 0) {
          corruptionIssues.push('✗ Empty extension directory');
        }
      } catch {
        corruptionIssues.push('✗ Cannot read extension directory');
      }

      // Check for extremely large files
      try {
        const large = findLargeFiles(installPath, 50 * 1024 * 1024);
        if (large.length > 0) {
          corruptionIssues.push(`⚠ Large files >50MB: ${large.slice(0, 2).join(', ')}`);
        }
      } catch {
        // ignore
      }
    }

    // ===== SECURITY CHECK =====
    
    // Dangerous permissions
    const dangPerms = getDangerousPermissions(pkg);
    for (const perm of dangPerms) {
      securityIssues.push({
        severity: 'high',
        message: perm,
      });
    }

    // Broad activation events
    const activationEvents = getActivationEvents(pkg);
    const broad = getBroadActivationEvents(activationEvents);
    if (broad.length > 0) {
      securityIssues.push({
        severity: 'medium',
        message: `Broad activation events: ${broad.join(', ')}`,
      });
    }

    // Dangerous capabilities
    const contrib = pkg.contributes || {};
    if (contrib.virtualWorkspaces === true) {
      securityIssues.push({
        severity: 'medium',
        message: 'Supports untrusted workspaces (broader access)',
      });
    }

    // Code scanning
    const { issues: codeIssues, hasSourceMaps } = scanExtensionSourceForSecurity(installPath);
    securityIssues.push(...codeIssues);

    // No source maps = compiled/obfuscated
    if (codeIssues.length > 0 && !hasSourceMaps) {
      securityIssues.push({
        severity: 'medium',
        message: 'Contains malicious patterns but no source maps available',
      });
    }

    // Dynamic requires/imports
    const dynamicRequires = scanForDynamicImports(installPath);
    if (dynamicRequires > 0) {
      securityIssues.push({
        severity: 'high',
        message: `${dynamicRequires} dynamic require/import detected (runtime code execution)`,
      });
    }

    // Sideloaded/no publisher
    if (!pkg.publisher) {
      securityIssues.push({
        severity: 'low',
        message: 'No publisher (likely sideloaded/local build)',
      });
    }

    // Missing repository
    if (!pkg.repository && !pkg.homepage) {
      const extType = getExtensionType(ext, installPath);
      if (extType === 'User') {
        securityIssues.push({
          severity: 'low',
          message: 'No repository or homepage declared',
        });
      }
    }

    // ===== REPORTING =====
    const hasCritical = securityIssues.some(s => s.severity === 'critical');
    const hasHigh = securityIssues.some(s => s.severity === 'high');
    const hasMedium = securityIssues.some(s => s.severity === 'medium');
    const hasCorruption = corruptionIssues.length > 0;

    if (hasCritical || hasHigh || corruptionIssues.length > 0) {
      if (hasCritical) criticalFound++;
      if (hasHigh) highFound++;
      if (hasCorruption) corruptedFound++;

      const severity = hasCritical ? '🔴' : hasHigh ? '🟠' : '⚠';
      outputChannel.appendLine(`  ${severity} ${id}`);

      if (corruptionIssues.length > 0) {
        outputChannel.appendLine(`    Corruption issues:`);
        corruptionIssues.forEach(issue => outputChannel.appendLine(`      ${issue}`));
      }

      // Group by severity
      const critical = securityIssues.filter(s => s.severity === 'critical');
      const high = securityIssues.filter(s => s.severity === 'high');
      const medium = securityIssues.filter(s => s.severity === 'medium');

      if (critical.length > 0) {
        outputChannel.appendLine(`    🔴 CRITICAL:`);
        critical.slice(0, 5).forEach(s => outputChannel.appendLine(`      ${s.message}${s.file ? ` (${s.file})` : ''}`));
        if (critical.length > 5) outputChannel.appendLine(`      ... and ${critical.length - 5} more`);
      }

      if (high.length > 0) {
        outputChannel.appendLine(`    🟠 HIGH:`);
        high.slice(0, 5).forEach(s => outputChannel.appendLine(`      ${s.message}${s.file ? ` (${s.file})` : ''}`));
        if (high.length > 5) outputChannel.appendLine(`      ... and ${high.length - 5} more`);
      }

      if (medium.length > 0 && (critical.length === 0 && high.length === 0)) {
        outputChannel.appendLine(`    🟡 MEDIUM:`);
        medium.slice(0, 3).forEach(s => outputChannel.appendLine(`      ${s.message}${s.file ? ` (${s.file})` : ''}`));
      }

      outputChannel.appendLine('');
    } else if (hasMedium) {
      mediumFound++;
      outputChannel.appendLine(`  🟡 ${id}`);
      securityIssues.slice(0, 3).forEach(s => outputChannel.appendLine(`      ${s.message}${s.file ? ` (${s.file})` : ''}`));
      outputChannel.appendLine('');
    }
  }

  // Summary
  outputChannel.appendLine('───────────────────────────────────────────────────────────────────────────');
  outputChannel.appendLine(`  🔴 CRITICAL: ${criticalFound} extension(s)`);
  outputChannel.appendLine(`  🟠 HIGH: ${highFound} extension(s)`);
  outputChannel.appendLine(`  🟡 MEDIUM: ${mediumFound} extension(s)`);
  outputChannel.appendLine(`  💥 CORRUPTED: ${corruptedFound} extension(s)`);

  if (criticalFound === 0 && highFound === 0 && corruptedFound === 0) {
    outputChannel.appendLine('  ✓ No critical or high-severity issues found');
  }

  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');

  // Alert user about critical/high severity issues
  if (criticalFound > 0) {
    vscode.window.showErrorMessage(
      `🔴 AuditExt: CRITICAL SECURITY ISSUES FOUND! ${criticalFound} extension(s) with critical severity detected.`,
      'View Report'
    ).then(selection => {
      if (selection === 'View Report') {
        showOutput();
      }
    });
  } else if (highFound > 0 || corruptedFound > 0) {
    vscode.window.showWarningMessage(
      `⚠️ AuditExt: HIGH RISK ISSUES FOUND! ${highFound} extension(s) high-risk, ${corruptedFound} corrupted.`,
      'View Report'
    ).then(selection => {
      if (selection === 'View Report') {
        showOutput();
      }
    });
  } else if (mediumFound > 0) {
    vscode.window.showInformationMessage(
      `ℹ️ AuditExt: ${mediumFound} extension(s) with medium-severity issues detected.`,
      'View Details'
    ).then(selection => {
      if (selection === 'View Details') {
        showOutput();
      }
    });
  }
}

function scanForDynamicImports(dirPath: string): number {
  let count = 0;

  function walkDirForDynamicImports(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          walkDirForDynamicImports(fullPath);
        } else if (entry.isFile() && /\.(js|ts|jsx|tsx|mjs|cjs)$/i.test(entry.name)) {
          try {
            const code = fs.readFileSync(fullPath, 'utf-8');
            const matches = code.match(/(?:require|import)\s*\(\s*['"`]\$\{/g) || [];
            count += matches.length;
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
  }

  try {
    walkDirForDynamicImports(dirPath);
  } catch {
    // ignore
  }
  return count;
}

function findLargeFiles(dirPath: string, threshold: number, max: number = 5): string[] {
  const result: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= max) break;
      if (entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          result.push(...findLargeFiles(fullPath, threshold, max - result.length));
        } else if (entry.isFile()) {
          const size = fs.statSync(fullPath).size;
          if (size > threshold) {
            result.push(`${entry.name} (${formatBytes(size)})`);
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return result;
}


// Known/trusted hosts that extensions commonly contact
const KNOWN_HOSTS = new Set([
  // Microsoft & VS Code
  'microsoft.com',
  'visualstudio.com',
  'vscode.dev',
  'vscode-webview.net',
  'marketplace.visualstudio.com',
  'vscodecontent.blob.core.windows.net',
  'vscodeapi.blob.core.windows.net',
  'aka.ms',
  
  // NPM & Node ecosystem
  'npmjs.com',
  'npm.org',
  'registry.npmjs.org',
  'registry.npm.taobao.org',
  
  // GitHub & Git
  'github.com',
  'githubusercontent.com',
  'ghcr.io',
  'raw.github.com',
  
  // CDNs & Common services
  'cloudflare.com',
  'cloudflare.net',
  'googleapis.com',
  'gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  
  // Language servers & tools
  'clang.llvm.org',
  'python.org',
  'golang.org',
  'rust-lang.org',
  'typescriptlang.org',
  
  // Common development tools
  'docker.com',
  'docker.io',
  'kubernetes.io',
  'terraform.io',
  'ansible.com',
  
  // Analytics/telemetry (common in extensions)
  'segment.com',
  'mixpanel.com',
  'sentry.io',
  'datadog.com',
  
  // Localhost
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

// Known malicious/suspicious hosts database (C&C, phishing, malware, etc.)
// This is a curated list of known malicious hosts - will be expanded over time
const MALICIOUS_HOSTS = new Set([
  // C&C (Command & Control)
  'minergate.com',
  'xmr-us-east1.nanopool.org',
  'xmr-eu1.nanopool.org',
  'c3pool.com',
  'minexmr.com',
  'pool.supportxmr.com',
  
  // Phishing/Fraud known
  'verify-account.com',
  'confirm-account.com',
  'secure-verify.com',
  
  // URL injection & Redirect patterns (drive users to malicious sites)
  'bit.ly', // URL shortener often used in phishing
  'tinyurl.com',
  'ow.ly',
  'short.link',
  'linktr.ee',
  'rebrand.ly',
  'adf.ly',
  
  // Malware distribution & C&C communication
  'pastebin.com', // Often used to host malicious scripts
  'raw.github.com',
  'cdn.jsdelivr.net', // Can be abused for hosting payloads
  'unpkg.com',
  
  // Suspicious analytics & tracking (used for data exfiltration)
  'graph.windows.net',
  'beacon.telemetry.microsoft.com',
  'analytics.google.com',
  'safebrowsing.googleapis.com',
  
  // Dynamic DNS services (used for C&C with changing IPs)
  'no-ip.com',
  'duckdns.org',
  'freenom.com',
  'ddns.net',
  
  // Free hosting often used for malware
  'github.io',
  'herokuapp.com',
  'netlify.app',
  'vercel.app',
  
  // Malware distribution known
  'malwarebytes.com', // NOTE: legitimate but often used in malware context
  
  // Exploit kits & vulnerability databases for attacks
  'exploit-db.com',
  'zerodayinitiative.com',
  
  // DGA (Domain Generation Algorithm) patterns - will be detected by regex
]);

// IP ranges to flag as suspicious
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
  /^\[?::1\]?$/i,  // IPv6 loopback
  /^\[?::ffff:/i,  // IPv6 mapped IPv4
];

interface NetworkCall {
  type: 'fetch' | 'http' | 'require' | 'import' | 'url-string' | 'xhr' | 'axios' | 'got' | 'undici' | 'other';
  url: string;
  host: string;
  line: number;
  isKnown: boolean;
}

interface NetworkCallWithRisk extends NetworkCall {
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'info';
  riskReason: string;
  extensionId?: string;
}

function isPrivateIP(host: string): boolean {
  // Remove IPv6 brackets
  const testHost = host.replace(/^\[|\]$/g, '').toLowerCase();
  return PRIVATE_IP_RANGES.some(range => range.test(testHost));
}

function isMaliciousHost(host: string): boolean {
  return MALICIOUS_HOSTS.has(host.toLowerCase());
}

function isIP(host: string): boolean {
  // Remove IPv6 brackets for testing
  const testHost = host.replace(/^\[|\]$/g, '');
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(testHost)) return true;
  // IPv6 - more flexible matching
  if (/^[0-9a-f:]+$/i.test(testHost) && testHost.includes(':')) return true;
  return false;
}

function assessRisk(call: NetworkCallWithRisk | NetworkCall): { level: 'critical' | 'high' | 'medium' | 'low' | 'info'; reason: string } {
  const call_: NetworkCall = call;
  const host = call_.host.toLowerCase();
  const url = call_.url.toLowerCase();

  // CRITICAL
  if (isMaliciousHost(host)) {
    return { level: 'critical', reason: 'Known malicious host' };
  }

  // Check for IP addresses
  if (isIP(host)) {
    if (isPrivateIP(host)) {
      return { level: 'info', reason: 'Private IP address' };
    }
    // Unknown public IP
    return { level: 'high', reason: 'Unknown public IP address' };
  }

  // Check for suspicious domains (single letter, numbers, etc.)
  if (/^[a-z0-9]{1,5}$/.test(host)) {
    return { level: 'medium', reason: 'Suspiciously short domain name' };
  }

  // Check for common DGA patterns (algorithmically generated domains)
  if (/^[a-z]{5,}[0-9]{3,}\.com$/.test(host)) {
    return { level: 'medium', reason: 'Possible DGA domain (algorithmic generation)' };
  }

  // Check for new TLDs (often used for malware)
  if (/\.(?:tk|ml|ga|cf|gq)$/i.test(host)) {
    return { level: 'high', reason: `Suspicious TLD: .${host.split('.').pop()?.toLowerCase() || 'unknown'}` };
  }

  // Check for URL paths that indicate suspicious activity
  if (/(?:\/(?:api|submit|report|beacon|check|track))/.test(url)) {
    if (!/github|microsoft|npm|cloudflare|sentry|datadog/.test(host)) {
      return { level: 'medium', reason: 'API endpoint to unknown host' };
    }
  }

  // If known, it's safe
  if (isKnownHost(host)) {
    return { level: 'info', reason: 'Known trusted host' };
  }

  // Unknown host
  return { level: 'medium', reason: 'Unknown host (not in known safe list)' };
}

// Note: Online reputation checking is not currently used to avoid network requests during audits
// Could be implemented in future with proper caching to check against abuse.ch URLhaus

function extractHostFromUrl(urlStr: string): string {
  try {
    // Handle various URL formats
    const trimmed = urlStr.replace(/^['"`]|['"`]$/g, '').trim();
    
    // Try URL constructor
    try {
      const url = new URL(trimmed);
      return url.hostname.toLowerCase();
    } catch {
      // Try regex for protocol://host pattern
      const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)/);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function isKnownHost(host: string): boolean {
  if (!host) return false;
  host = host.toLowerCase();
  
  // Direct match
  if (KNOWN_HOSTS.has(host)) return true;
  
  // Subdomain match (e.g., foo.github.com matches github.com)
  for (const known of KNOWN_HOSTS) {
    if (host.endsWith('.' + known) || host === known) return true;
  }
  
  return false;
}

function scanCodeForNetworkCalls(code: string, filePath: string): NetworkCall[] {
  const calls: NetworkCall[] = [];
  const lines = code.split('\n');
  
  // Regex patterns for different network call types (more restrictive)
  const patterns = [
    // fetch() calls - fetch('url'), fetch("url"), fetch(`url`)
    { regex: /fetch\s*\(\s*['"`]([^'"`]{5,})['"`]/gi, type: 'fetch' as const },
    
    // http.request / http.get / https.request
    { regex: /https?\.(?:request|get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]{5,})['"`]/gi, type: 'http' as const },
    
    // axios calls - axios.get('url'), axios.post('url'), etc
    { regex: /axios\.(?:get|post|put|delete|patch|request)\s*\(\s*['"`]([^'"`]{5,})['"`]/gi, type: 'axios' as const },
    
    // got() calls - got('url')
    { regex: /(?:^|\s)got\s*\(\s*['"`]([^'"`]{5,})['"`]/gi, type: 'got' as const },
    
    // undici requests
    { regex: /undici\.(?:request|fetch)\s*\(\s*['"`]([^'"`]{5,})['"`]/gi, type: 'undici' as const },
    
    // XMLHttpRequest
    { regex: /xhr\.open\s*\(\s*['"`](?:GET|POST|PUT|DELETE)['"`]\s*,\s*['"`]([^'"`]{5,})['"`]/gi, type: 'xhr' as const },
    
    // require/import network URLs (less common but possible)
    { regex: /(?:require|import)\s*\(\s*['"`](https?:\/\/[^'"`]{5,})['"`]/gi, type: 'require' as const },
  ];
  
  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(code)) !== null) {
      const urlStr = match[1];
      const host = extractHostFromUrl(urlStr);
      if (host && isValidHost(host)) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        calls.push({
          type,
          url: urlStr,
          host,
          line: lineNum,
          isKnown: isKnownHost(host),
        });
      }
    }
  }
  
  // Also scan for raw URL strings (http://* or https://*) - but more restrictive
  // Only match complete URLs with a proper domain structure
  const urlRegex = /https?:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d+)?(?:\/[a-zA-Z0-9\-._~:/?#\[\]@!$%&'()*+,;=]*)?/gi;
  let match;
  while ((match = urlRegex.exec(code)) !== null) {
    const urlStr = match[0];
    const host = extractHostFromUrl(urlStr);
    if (host && isValidHost(host) && !calls.some(c => c.url === urlStr)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      calls.push({
        type: 'url-string',
        url: urlStr,
        host,
        line: lineNum,
        isKnown: isKnownHost(host),
      });
    }
  }
  
  return calls;
}

function isValidHost(host: string): boolean {
  // Reject obvious non-hosts
  if (!host || host.length < 2) return false;
  
  // Reject hosts that are just special characters or single chars repeated
  if (/^[^a-zA-Z0-9:.\[\]]*$/.test(host)) return false;
  if (/^(.)\1{3,}$/.test(host)) return false; // e.g., "____"
  if (/^[^a-zA-Z0-9]/.test(host)) return false; // starts with special char
  
  // Allow IPs and hostnames
  const isValidIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || // IPv4
                    /^(\[)?[0-9a-f:]+(\])?$/.test(host); // IPv6
  const isValidHostname = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/.test(host);
  
  return isValidIP || isValidHostname;
}

function scanExtensionForNetworkCalls(extensionPath: string): Map<string, NetworkCall[]> {
  const results = new Map<string, NetworkCall[]>();
  
  try {
    walkDirForCode(extensionPath, results);
  } catch {
    // ignore
  }
  
  return results;
}

function walkDirForCode(dirPath: string, results: Map<string, NetworkCall[]>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, entry.name);
    
    try {
      if (entry.isDirectory()) {
        walkDirForCode(fullPath, results);
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx|mjs|cjs)$/i.test(entry.name)) {
        try {
          const code = fs.readFileSync(fullPath, 'utf-8');
          const calls = scanCodeForNetworkCalls(code, fullPath);
          if (calls.length > 0) {
            results.set(fullPath, calls);
          }
        } catch {
          // ignore unreadable files
        }
      }
    } catch {
      // ignore
    }
  }
}

function checkNetwork() {
  showOutput();
  const extensions = vscode.extensions.all;
  
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('  AuditExt - Network Activity Report');
  outputChannel.appendLine(`  Generated: ${new Date().toISOString()}`);
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');
  outputChannel.appendLine('');
  
  let totalExtensionsScanned = 0;
  let extensionsWithNetworkCalls = 0;
  let totalNetworkCalls = 0;
  
  const riskStats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const allMaliciousHosts = new Map<string, string[]>(); // host -> [extensionId, ...]
  const allSuspiciousHosts = new Map<string, string[]>();
  
  for (const ext of extensions) {
    const installPath = ext.extensionPath;
    const id = ext.id;
    const displayName = ext.packageJSON.displayName || id;
    
    totalExtensionsScanned++;
    const networkCalls = scanExtensionForNetworkCalls(installPath);
    
    if (networkCalls.size === 0) continue;
    
    extensionsWithNetworkCalls++;
    
    // Assess risk for each call and group by host
    const callsWithRisk: NetworkCallWithRisk[] = [];
    
    for (const [, calls] of networkCalls) {
      for (const call of calls) {
        totalNetworkCalls++;
        const { level, reason } = assessRisk(call);
        riskStats[level]++;
        
        callsWithRisk.push({
          ...call,
          riskLevel: level,
          riskReason: reason,
          extensionId: id,
        });
        
        if (level === 'critical' || level === 'high') {
          if (!allMaliciousHosts.has(call.host)) {
            allMaliciousHosts.set(call.host, []);
          }
          allMaliciousHosts.get(call.host)!.push(id);
        } else if (level === 'medium') {
          if (!allSuspiciousHosts.has(call.host)) {
            allSuspiciousHosts.set(call.host, []);
          }
          allSuspiciousHosts.get(call.host)!.push(id);
        }
      }
    }
    
    // Group by risk level then host
    const byRisk = new Map<string, NetworkCallWithRisk[]>();
    for (const call of callsWithRisk) {
      const key = `${call.riskLevel}_${call.host}`;
      if (!byRisk.has(key)) byRisk.set(key, []);
      byRisk.get(key)!.push(call);
    }
    
    // Sort by risk level (critical > high > medium > low > info)
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const sorted = Array.from(byRisk.entries()).sort((a, b) => {
      const aRisk = a[0].split('_')[0] as keyof typeof riskOrder;
      const bRisk = b[0].split('_')[0] as keyof typeof riskOrder;
      return riskOrder[aRisk] - riskOrder[bRisk];
    });

    // Show extension header with risk indicator
    const hasHighRisk = callsWithRisk.some(c => c.riskLevel === 'critical' || c.riskLevel === 'high');
    const hasMediumRisk = callsWithRisk.some(c => c.riskLevel === 'medium');
    let extIcon = '  ✅';
    if (hasHighRisk) extIcon = '🔴';
    else if (hasMediumRisk) extIcon = '🟡';
    else if (callsWithRisk.some(c => c.riskLevel === 'low')) extIcon = '🔵';

    outputChannel.appendLine(`  ${extIcon} ${displayName}: ${id}`);
    
    for (const [key, calls] of sorted) {
      const [riskLevel, host] = key.split('_');
      const icon = riskLevel === 'critical' ? '🔴' : riskLevel === 'high' ? '🟠' : riskLevel === 'medium' ? '🟡' : riskLevel === 'low' ? '🔵' : 'ℹ️';
      
      outputChannel.appendLine(`    ${icon} ${host} (${calls.length} call${calls.length > 1 ? 's' : ''})`);
      outputChannel.appendLine(`       Reason: ${calls[0].riskReason}`);
      
      // Show unique URLs (max 3)
      const urls = new Set<string>();
      for (const call of calls) {
        urls.add(call.url);
        if (urls.size >= 3) break;
      }
      
      let urlCount = 0;
      for (const url of urls) {
        urlCount++;
        const matching = calls.filter(c => c.url === url).slice(0, 2);
        const typeStr = matching.map(c => `${c.type}@L${c.line}`).join(', ');
        const displayUrl = url.length > 85 ? url.substring(0, 82) + '...' : url;
        outputChannel.appendLine(`       URL ${urlCount}: ${displayUrl}`);
        outputChannel.appendLine(`         ↳ ${typeStr}`);
      }
      
      if (urls.size > 3) {
        outputChannel.appendLine(`       ... and ${urls.size - 3} more URL(s)`);
      }
      outputChannel.appendLine('');
    }
  }
  
  // Summary
  outputChannel.appendLine('───────────────────────────────────────────────────────────────────────────');
  outputChannel.appendLine(`  Extensions scanned:      ${totalExtensionsScanned}`);
  outputChannel.appendLine(`  With network calls:      ${extensionsWithNetworkCalls}`);
  outputChannel.appendLine(`  Total network calls:     ${totalNetworkCalls}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('  Risk breakdown:');
  outputChannel.appendLine(`    🔴 CRITICAL:   ${riskStats.critical}`);
  outputChannel.appendLine(`    🟠 HIGH:       ${riskStats.high}`);
  outputChannel.appendLine(`    🟡 MEDIUM:     ${riskStats.medium}`);
  outputChannel.appendLine(`    🔵 LOW:        ${riskStats.low}`);
  outputChannel.appendLine(`    ℹ️  INFO:       ${riskStats.info}`);
  
  if (allMaliciousHosts.size > 0) {
    outputChannel.appendLine('');
    outputChannel.appendLine('  ⚠️  MALICIOUS/SUSPICIOUS HOSTS (CRITICAL/HIGH):');
    Array.from(allMaliciousHosts.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([host, exts]) => {
      const extList = [...new Set(exts)].join(', ');
      outputChannel.appendLine(`    🔴 ${host}`);
      outputChannel.appendLine(`       Extensions: ${extList}`);
    });
  }
  
  if (allSuspiciousHosts.size > 0) {
    outputChannel.appendLine('');
    outputChannel.appendLine('  ⚠️  POTENTIALLY SUSPICIOUS HOSTS (MEDIUM):');
    Array.from(allSuspiciousHosts.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([host, exts]) => {
      const extList = [...new Set(exts)].join(', ');
      outputChannel.appendLine(`    🟡 ${host}`);
      outputChannel.appendLine(`       Extensions: ${extList}`);
    });
  }
  
  outputChannel.appendLine('═══════════════════════════════════════════════════════════════════════════');

  // Alert user about critical/high risk network activity
  if (riskStats.critical > 0) {
    vscode.window.showErrorMessage(
      `🔴 AuditExt: CRITICAL NETWORK RISK! ${riskStats.critical} critical-risk network call(s) detected.`,
      'View Report'
    ).then(selection => {
      if (selection === 'View Report') {
        showOutput();
      }
    });
  } else if (riskStats.high > 0 || allMaliciousHosts.size > 0) {
    vscode.window.showWarningMessage(
      `⚠️ AuditExt: HIGH RISK NETWORK ACTIVITY! ${riskStats.high} high-risk call(s), ${allMaliciousHosts.size} malicious host(s).`,
      'View Report'
    ).then(selection => {
      if (selection === 'View Report') {
        showOutput();
      }
    });
  } else if (riskStats.medium > 0) {
    vscode.window.showInformationMessage(
      `ℹ️ AuditExt: ${riskStats.medium} medium-risk network calls detected. Review before trusting extensions.`,
      'View Details'
    ).then(selection => {
      if (selection === 'View Details') {
        showOutput();
      }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(outputChannel);

  const auditCommand = vscode.commands.registerCommand('auditext.auditExtensions', () => {
    auditExtensions();
  });

  const integrityCommand = vscode.commands.registerCommand('auditext.checkIntegrity', () => {
    checkIntegrity();
  });

  const networkCommand = vscode.commands.registerCommand('auditext.checkNetwork', () => {
    checkNetwork();
  });

  context.subscriptions.push(auditCommand, integrityCommand, networkCommand);
}

export function deactivate() {}
