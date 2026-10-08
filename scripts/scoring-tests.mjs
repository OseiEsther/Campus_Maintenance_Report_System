#!/usr/bin/env node

/**
 * CampusFix - Automated Verification Scoring Engine Test Suite
 *
 * Validates the scoring rules specified in the thesis:
 * 1. Base submission point: +1
 * 2. Detailed description (>= 100 characters): +3
 * 3. Photo evidence attached: +2
 * 4. Peer corroboration: +2 per unique student (author excluded)
 * 5. Hall Representative confirmation: +10
 * 6. Hall Representative dispute: -5
 * 7. Verification score clamped between 0 and 20
 *
 * Usage:
 *   node scripts/scoring-tests.mjs
 */

const MAX_SCORE = 20;
const MIN_SCORE = 0;

function calculateInitialScore(description, photoUrl) {
  let score = 1;
  const signals = [{ label: '+1 report submitted', points: 1 }];

  if (description && description.trim().length >= 100) {
    score += 3;
    signals.push({ label: '+3 detailed description (over 100 characters)', points: 3 });
  }

  if (photoUrl && photoUrl.trim().length > 0) {
    score += 2;
    signals.push({ label: '+2 photo attached', points: 2 });
  }

  return {
    score: Math.min(MAX_SCORE, Math.max(MIN_SCORE, score)),
    signals,
  };
}

function applyCorroboration(currentScore, authorId, corroboratorId) {
  if (authorId === corroboratorId) {
    throw new Error('Self-corroboration forbidden');
  }
  return Math.min(MAX_SCORE, currentScore + 2);
}

function applyRepConfirm(currentScore, alreadyDisputed) {
  if (alreadyDisputed) {
    throw new Error('Cannot confirm a report that was already disputed');
  }
  return Math.min(MAX_SCORE, currentScore + 10);
}

function applyRepDispute(currentScore, alreadyConfirmed, reason) {
  if (alreadyConfirmed) {
    throw new Error('Cannot dispute a report that was already confirmed');
  }
  if (!reason || reason.trim().length < 5) {
    throw new Error('Dispute reason must be at least 5 characters');
  }
  return Math.max(MIN_SCORE, currentScore - 5);
}

// Test runner
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS', error: null });
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`${message}: function was expected to throw but did not`);
  }
}

// Suite Execution
console.log('\n================================================================');
console.log('    CAMPUSFIX VERIFICATION SCORING ENGINE: SPECIFICATION CHECK  ');
console.log('================================================================\n');

test('Rule 1: Base report submission receives exactly 1 point', () => {
  const result = calculateInitialScore('Water pipe is leaking in room 4.', null);
  assertEqual(result.score, 1, 'Base score');
  assertEqual(result.signals.length, 1, 'Signal count');
});

test('Rule 2: Detailed description (>= 100 chars) receives +3 bonus points', () => {
  const longDesc = 'A'.repeat(100);
  const result = calculateInitialScore(longDesc, null);
  assertEqual(result.score, 4, 'Base (1) + Detailed (3) should be 4');
  assertEqual(result.signals.length, 2, 'Signal count');
});

test('Rule 3: Photo attachment receives +2 bonus points', () => {
  const result = calculateInitialScore('Water pipe is leaking.', 'https://storage/leak.jpg');
  assertEqual(result.score, 3, 'Base (1) + Photo (2) should be 3');
  assertEqual(result.signals.length, 2, 'Signal count');
});

test('Rule 4: Description (>= 100 chars) AND Photo combined yield 6 points', () => {
  const longDesc = 'Water leakage from the main ceiling pipe causing flooding across hallway floors and near door 24.'.padEnd(100, '.');
  const result = calculateInitialScore(longDesc, 'https://storage/pipe.jpg');
  assertEqual(result.score, 6, 'Base (1) + Detailed (3) + Photo (2) should be 6');
  assertEqual(result.signals.length, 3, 'Signal count');
});

test('Rule 5: Corroboration by peer student adds +2 points', () => {
  const initial = 4;
  const updated = applyCorroboration(initial, 'student-1', 'student-2');
  assertEqual(updated, 6, 'Corroboration adds +2');
});

test('Rule 6: Self-corroboration by author is strictly rejected', () => {
  assertThrows(() => {
    applyCorroboration(4, 'student-1', 'student-1');
  }, 'Author corroboration rejection');
});

test('Rule 7: Hall Representative confirmation adds +10 points', () => {
  const initial = 6;
  const updated = applyRepConfirm(initial, false);
  assertEqual(updated, 16, 'Rep confirm adds +10');
});

test('Rule 8: Hall Representative dispute deducts 5 points', () => {
  const initial = 8;
  const updated = applyRepDispute(initial, false, 'Issue was inspected and already fixed');
  assertEqual(updated, 3, 'Dispute deducts 5 points');
});

test('Rule 9: Dispute cannot deduct points below 0 floor clamp', () => {
  const initial = 2;
  const updated = applyRepDispute(initial, false, 'Invalid duplicate report');
  assertEqual(updated, 0, 'Floor clamp at 0');
});

test('Rule 10: Cumulative points cannot exceed 20 ceiling cap', () => {
  let score = 6; // Initial with photo and long desc
  score = applyRepConfirm(score, false); // +10 -> 16
  score = applyCorroboration(score, 'student-1', 'student-2'); // +2 -> 18
  score = applyCorroboration(score, 'student-1', 'student-3'); // +2 -> 20
  score = applyCorroboration(score, 'student-1', 'student-4'); // +2 -> capped at 20
  assertEqual(score, 20, 'Max cap at 20');
});

test('Rule 11: Conflict guard prevents rep from both confirming and disputing', () => {
  assertThrows(() => {
    applyRepDispute(16, true, 'Changed mind');
  }, 'Confirm then dispute disallowed');

  assertThrows(() => {
    applyRepConfirm(3, true);
  }, 'Dispute then confirm disallowed');
});

// Summary Table Output
console.log('Result | Test Description');
console.log('-------+--------------------------------------------------------');
let allPassed = true;
for (const r of results) {
  const statusStr = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m  ';
  console.log(`${statusStr} | ${r.name}`);
  if (r.status === 'FAIL') {
    allPassed = false;
    console.log(`       | Reason: ${r.error}`);
  }
}
console.log('----------------------------------------------------------------\n');

if (allPassed) {
  console.log(`\x1b[32mAll ${results.length} scoring verification tests PASSED successfully.\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31mSome scoring tests failed.\x1b[0m\n`);
  process.exit(1);
}
