/* AURELIA STAY — in-browser test runner for store API verification against Firebase emulators. */

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
  const suite = { name, tests: [] };
  suites.push(suite);
  currentSuite = suite;
  fn();
  currentSuite = null;
}

export function test(name, fn) {
  if (!currentSuite) throw new Error('test() must be called inside describe()');
  currentSuite.tests.push({ name, fn });
}

export function assert(cond, msg = 'Assertion failed') {
  if (!cond) throw new Error(msg);
}

export function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error((msg ? msg + ' — ' : '') + `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, msg = '') {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error((msg ? msg + ' — ' : '') + `Deep equal mismatch:\nExpected: ${eStr}\nGot: ${aStr}`);
  }
}

export async function assertRejects(fn, expectedCode = null, msg = '') {
  let threw = false;
  try {
    const res = await fn();
    if (res && res.ok === false) {
      if (expectedCode && res.code !== expectedCode) {
        throw new Error(`Expected error code ${expectedCode}, but received ${res.code} (${res.error})`);
      }
      return res;
    }
  } catch (err) {
    threw = true;
    return err;
  }
  if (!threw) {
    throw new Error(msg || `Expected rejection / error result, but operation succeeded`);
  }
}

export async function runAllTests() {
  const startTime = Date.now();
  const results = [];
  let passed = 0;
  let failed = 0;
  const failures = [];

  const tableBody = document.getElementById('test-table-body');
  const summaryEl = document.getElementById('test-summary');
  const progressEl = document.getElementById('test-progress');

  let totalTests = 0;
  suites.forEach(s => { totalTests += s.tests.length; });
  let completed = 0;

  for (const suite of suites) {
    for (const t of suite.tests) {
      const row = document.createElement('tr');
      row.className = 'test-row running';
      row.innerHTML = `
        <td class="suite-col">${escapeHtml(suite.name)}</td>
        <td class="test-col">${escapeHtml(t.name)}</td>
        <td class="status-col"><span class="badge running">RUNNING</span></td>
        <td class="duration-col">-</td>
        <td class="details-col"></td>
      `;
      if (tableBody) tableBody.appendChild(row);

      const tStart = performance.now();
      let ok = false;
      let errObj = null;

      try {
        await t.fn();
        ok = true;
        passed++;
      } catch (err) {
        ok = false;
        failed++;
        errObj = err;
        failures.push({ suite: suite.name, test: t.name, error: err.message, stack: err.stack });
      }

      const tDuration = (performance.now() - tStart).toFixed(1);
      completed++;

      if (progressEl) {
        progressEl.style.width = `${(completed / totalTests) * 100}%`;
      }

      row.className = `test-row ${ok ? 'pass' : 'fail'}`;
      row.innerHTML = `
        <td class="suite-col">${escapeHtml(suite.name)}</td>
        <td class="test-col">${escapeHtml(t.name)}</td>
        <td class="status-col"><span class="badge ${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</span></td>
        <td class="duration-col">${tDuration} ms</td>
        <td class="details-col">${errObj ? `<span class="error-msg">${escapeHtml(errObj.message)}</span>` : '<span class="ok-mark">✓</span>'}</td>
      `;

      results.push({
        suite: suite.name,
        test: t.name,
        passed: ok,
        duration: parseFloat(tDuration),
        error: errObj ? errObj.message : null
      });

      if (summaryEl) {
        summaryEl.innerHTML = `Running tests: ${completed}/${totalTests} (${passed} passed, ${failed} failed)`;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const resultObj = {
    passed,
    failed,
    total: totalTests,
    duration: totalDuration,
    failures,
    results
  };

  window.__TEST_RESULT = resultObj;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <strong>${failed === 0 ? '✓ ALL TESTS PASSED' : '✖ SOME TESTS FAILED'}</strong>:
      ${passed} passed, ${failed} failed out of ${totalTests} total tests in ${(totalDuration / 1000).toFixed(2)}s
    `;
    summaryEl.className = failed === 0 ? 'summary-box success' : 'summary-box failure';
  }

  window.dispatchEvent(new CustomEvent('tests-complete', { detail: resultObj }));
  return resultObj;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
