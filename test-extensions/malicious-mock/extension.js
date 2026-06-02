// Mock malicious extension for testing AuditExt
// This file contains patterns that AuditExt should detect
// SAFETY: This code is never actually executed

'use strict';

// Pattern 1: eval() usage (should trigger CRITICAL)
function testEval() {
  // eval("malicious code here");
  const code = "console.log('test')";
  eval(code);
}

// Pattern 2: Function constructor (should trigger CRITICAL)
function testFunctionConstructor() {
  const fn = new Function("return require('crypto')");
  return fn();
}

// Pattern 3: Dynamic crypto import (should trigger HIGH)
function testDynamicCrypto() {
  require(`${'crypto'}`);
  import(`${'http'}`);
}

// Pattern 4: Network requests (should trigger MEDIUM/HIGH)
function testNetworkCalls() {
  fetch('https://malicious-host.com/beacon');
  fetch('https://bit.ly/redirect');
  fetch('https://no-ip.com/command');
  
  const http = require('http');
  http.get('https://c3pool.com/mining');
}

// Pattern 5: WebSocket (should trigger MEDIUM)
function testWebSocket() {
  const ws = new WebSocket('wss://unknown-host.com/ws');
}

// Pattern 6: Minified obfuscated code (should trigger MEDIUM)
const a=function(){let b=0;while(b<1000){b++;}return b;};
const _____=(_____++)=>(_____*2);
const xxxxxxxx_yyyyy_zzzz=()=>{return a()+b()+c();};

// Pattern 7: Hex escaping (should trigger MEDIUM)
const hexStr = "\x65\x76\x61\x6c\x28\x22\x63\x6f\x64\x65\x22\x29";

// Pattern 8: Process control (should trigger CRITICAL)
function testProcessControl() {
  process.exit(1);
  process.kill(process.pid);
  const child = require('child_process');
}

// Pattern 9: File system write (should trigger HIGH)
function testFileSystem() {
  const fs = require('fs');
  fs.writeFile('./malicious.txt', 'data', () => {});
  fs.unlink('./important.txt', () => {});
}

// Pattern 10: Continuous network requests (should trigger HIGH)
function testC2Communication() {
  setInterval(() => {
    fetch('https://xmr-us-east1.nanopool.org/api');
  }, 1000);
}

// Pattern 11: Cryptographic operations (should trigger HIGH)
function testCryptoMining() {
  const crypto = require('crypto');
  crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt: new Uint8Array(16) },
    key,
    256
  );
}

// Pattern 12: Web Worker (should trigger MEDIUM)
function testWebWorker() {
  const worker = new Worker('./worker.js');
}

exports.activate = () => {
  console.log('Mock malicious extension activated');
};

exports.deactivate = () => {};
