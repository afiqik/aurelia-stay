#!/usr/bin/env node
/**
 * CLI runner for design/tests/store-tests.html using headless Chromium.
 * Connects to the local hosting server, runs the in-browser tests, and reports results to stdout.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const URL = 'http://127.0.0.1:5000/tests/store-tests.html?emulator=1';

function checkServer(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function findChromium() {
  const candidates = [
    '/snap/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ];
  const fs = await import('node:fs');
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function main() {
  console.log('==> Checking Firebase Hosting at http://127.0.0.1:5000...');
  const isUp = await checkServer('http://127.0.0.1:5000/index.html');
  if (!isUp) {
    console.error('Error: Firebase Hosting emulator is not running on port 5000.');
    console.error('Please start the emulators first: npm start (or npm run emulators)');
    process.exit(1);
  }

  const browserBin = await findChromium();
  if (!browserBin) {
    console.error('Error: No Chromium/Chrome browser binary found on system.');
    process.exit(1);
  }
  console.log(`==> Found browser at ${browserBin}`);
  console.log(`==> Running store tests in headless browser: ${URL}`);

  // We use remote debugging or devtools protocol via Chromium or dump-dom/eval
  const testProfile = '/tmp/chrome-test-' + Date.now();
  const chromeProc = spawn(browserBin, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${testProfile}`,
    URL
  ], { stdio: 'ignore' });

  // Connect via DevTools protocol WebSocket or HTTP
  const deadline = Date.now() + 60000;
  let testResult = null;

  try {
    // Wait for debugging port with retries
    let target = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 600));
      const listRes = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json()).catch(() => []);
      target = listRes.find(t => t.url && t.url.includes('store-tests.html')) || listRes[0];
      if (target && target.webSocketDebuggerUrl) break;
    }
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error('Could not find Chromium DevTools target');
    }

    const { WebSocket } = await import('node:http').then(async () => {
      // Node 22 has built-in global WebSocket
      return { WebSocket: globalThis.WebSocket };
    });

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');

    console.log('==> Waiting for test completion...');
    while (Date.now() < deadline) {
      const evalRes = await send('Runtime.evaluate', {
        expression: 'window.__TEST_RESULT',
        returnByValue: true
      });

      if (evalRes && evalRes.result && evalRes.result.value) {
        testResult = evalRes.result.value;
        break;
      }
      await new Promise(r => setTimeout(r, 600));
    }

    ws.close();
  } catch (err) {
    console.error('Browser execution error:', err.message);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }

  if (!testResult) {
    console.error('Timed out waiting for test results (60s).');
    process.exit(1);
  }

  console.log('\n================ STORE BROWSER TEST RESULTS ================');
  let currentSuite = '';
  for (const r of (testResult.results || [])) {
    if (r.suite !== currentSuite) {
      currentSuite = r.suite;
      console.log(`\n[${currentSuite}]`);
    }
    const icon = r.passed ? '✔' : '✖';
    console.log(`  ${icon} ${r.test} (${r.duration}ms)`);
    if (r.error) {
      console.log(`    Error: ${r.error}`);
    }
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Total: ${testResult.total} | Passed: ${testResult.passed} | Failed: ${testResult.failed}`);
  console.log(`Duration: ${(testResult.duration / 1000).toFixed(2)}s`);
  console.log('============================================================\n');

  if (testResult.failed > 0) {
    console.error(`FAILED: ${testResult.failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All browser store tests passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
