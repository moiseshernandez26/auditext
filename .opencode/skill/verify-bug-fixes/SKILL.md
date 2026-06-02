---
name: verify-bug-fixes
description: Statically regression-check the three known bug fixes in src/extension.ts. Use when the user wants to confirm the scanForDynamicImports scope fix, the checkNetwork filePath shadowing fix, and the reputationCache dead-code removal are all still in place. Triggers on phrases like "verify bug fixes", "check the bug fixes", "regression test", "did we break the scope fix", "check network shadowing", or "is reputationCache still gone".
---

# Verify AuditExt Bug Fixes

Three concrete bugs were fixed in v0.1.0. This skill checks, statically, that each one is still in its fixed state — no runtime audit needed. Run this after any change to `src/extension.ts` to catch regressions.

## The three fixes

| # | Function | Bug | Fix |
|---|---|---|---|
| 1 | `scanForDynamicImports` | `count` declared outside the nested scanner; the counter never incremented, so dynamic-import detection always returned 0. | Restructure so the inner scanner and the counter share scope. |
| 2 | `checkNetwork` | `for (const [filePath, calls] of networkCalls)` shadowed the real file path; downstream code assigned `url: filePath`, corrupting the URL. | Destructured with `[, calls]`; removed the bad `url` assignment. |
| 3 | Dead code | `reputationCache: Map` and `async function checkReputationOnline()` were defined but never called. | Both removed, with a comment noting online checking is intentionally off. |

## How to verify

Read `src/extension.ts` and look for the three structural markers below. If all three are present, the fixes are intact.

### Fix 1 — `scanForDynamicImports` scope

**Look for:** the `count` variable and the `increment` (or equivalent) call must both live in a scope where the inner scanner function can reach them. The post-fix pattern looks like one of:

- A single function with `let count = 0` and the inner scanner references `count` and mutates it.
- Two separate calls that both read the same outer-scoped `count`.

**Bad pattern (do NOT regress to this):**
```ts
function scanForDynamicImports(code: string) {
  let count = 0;
  code.split('\n').forEach((line) => {
    function inner() {                 // inner declared, but...
      if (/require\(.+/.test(line)) count++;
    }
    inner();
  });
  return count;                          // if inner isn't invoked, count is 0
}
```

**Good pattern (fixed):**
```ts
function scanForDynamicImports(code: string) {
  let count = 0;
  code.split('\n').forEach((line) => {
    if (/require\(.+/.test(line) || /import\(.+/.test(line)) count++;
  });
  return count;
}
```

The exact shape varies — what matters is that the scanner and the incrementer are in the same scope and the increment actually runs.

**Verification grep:**
```bash
grep -n "scanForDynamicImports" "C:\Users\xbox8\Documents\GitHub\AuditExt\src\extension.ts"
```

Open the function. Confirm: (a) `count` is declared, (b) the regex match is on each line, (c) `count++` happens for matches, (d) `return count` returns a non-zero value when matches exist.

To smoke-test, run the malicious-mock harness from the `test-auditext` skill — the dynamic `require(\`${'crypto'}\`)` and `import(\`${'http'}\`)` lines in `test-extensions/malicious-mock/extension.js:21-24` must produce a HIGH finding.

### Fix 2 — `checkNetwork` filePath shadowing

**Look for:** the destructuring of `networkCalls` must NOT bind a variable named `filePath` overwriting the outer file path. The post-fix pattern uses `[, calls]` to ignore the key.

**Bad pattern (do NOT regress to this):**
```ts
for (const [filePath, calls] of networkCalls) {
  // ... later ...
  networkCalls.push({ url: filePath, ... });   // BUG: filePath here is the Map key, not the URL
}
```

**Good pattern (fixed):**
```ts
for (const [, calls] of networkCalls) {
  // url is taken from calls[i].url or wherever it actually lives
}
```

Also confirm: no `url: filePath` assignment exists in the same function. The original bug was that this assignment corrupted the URL field in the report.

**Verification grep:**
```bash
grep -n "for (const \[" "C:\Users\xbox8\Documents\GitHub\AuditExt\src\extension.ts"
grep -n "url: filePath" "C:\Users\xbox8\Documents\GitHub\AuditExt\src\extension.ts"
```

The first should show `[, calls]` (or similar) in the networkCalls loop. The second should return **zero matches** — if it returns any, the bug has regressed.

**Smoke test:** run `auditext.checkNetwork` against the malicious-mock harness. The output should list actual URLs (`https://bit.ly/redirect`, `https://c3pool.com/mining`, etc.) — not the file path `test-extensions/malicious-mock/extension.js`.

### Fix 3 — `reputationCache` / `checkReputationOnline` are gone

**Look for:** neither name should appear anywhere in `src/extension.ts`. They were dead code (never called) and were removed in v0.1.0.

**Verification grep:**
```bash
grep -n "reputationCache" "C:\Users\xbox8\Documents\GitHub\AuditExt\src\extension.ts"
grep -n "checkReputationOnline" "C:\Users\xbox8\Documents\GitHub\AuditExt\src\extension.ts"
```

Both should return **zero matches**. If either returns a hit, the dead code has been resurrected — and per the AGENTS.md "Next Steps" note, that's only acceptable if a new call site was also added. A bare resurrection without a caller is a regression.

**Why this matters:** the original `checkReputationOnline` made outbound HTTPS calls. If someone re-adds it but forgets to wire it up, the next person to read the code will assume the function is being used and won't realize the audit silently has no online-reputation check.

## Output template

When you run this skill, report the result in this format:

```
Bug-fix regression check — src/extension.ts

[1] scanForDynamicImports scope       PASS / FAIL — <one-line reason>
[2] checkNetwork filePath shadowing   PASS / FAIL — <one-line reason>
[3] reputationCache / online removal  PASS / FAIL — <one-line reason>

Verdict: all-clear / <N> regression(s)
```

If any check FAILS, stop and surface the offending lines to the user with `file_path:line_number` references. Do not patch the file — these fixes have a known shape and a regression usually means the user changed something that needs review, not a routine edit.

## Related skills

- `test-auditext` — runtime check that the fixes still produce the expected detections in the output channel.
- `audit-mock-extensions` — quick read of which patterns the mock files actually contain, useful when interpreting a fail.
