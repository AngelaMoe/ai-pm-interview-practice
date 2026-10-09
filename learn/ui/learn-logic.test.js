// learn/ui/learn-logic.test.js
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  generateUuid, getOrCreateAnonId, ANON_ID_KEY, lessonMastery, nextLesson,
  shuffledRights, emptyMatching, selectMatching, pairNumber, isMatchingComplete
} from './learn-logic.js';
import { isValidAnswer, gradeQuizItem } from '../mastery.js';
import { getLesson, getQuizItem } from '../content.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function memoryStorage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

test('anon ID: created once, then reused', () => {
  const storage = memoryStorage();
  const first = getOrCreateAnonId(storage);
  assert.match(first.id, UUID_V4);
  assert.equal(first.persistent, true);
  assert.equal(getOrCreateAnonId(storage).id, first.id);
});

test('anon ID: invalid stored value is replaced', () => {
  const storage = memoryStorage();
  storage.setItem(ANON_ID_KEY, 'not-a-uuid');
  const { id } = getOrCreateAnonId(storage);
  assert.match(id, UUID_V4);
  assert.equal(storage.getItem(ANON_ID_KEY), id);
});

test('anon ID: blocked storage falls back to a non-persistent ID', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  const result = getOrCreateAnonId(blocked);
  assert.match(result.id, UUID_V4);
  assert.equal(result.persistent, false);
});

test('UUID fallback without randomUUID is a valid v4', () => {
  const noRandomUUID = { getRandomValues: a => webcrypto.getRandomValues(a) };
  for (let i = 0; i < 50; i++) assert.match(generateUuid(noRandomUUID), UUID_V4);
});

test('lessonMastery averages the lesson concepts, missing = 0', () => {
  const lesson = { conceptIds: ['a', 'b', 'c'] };
  assert.equal(lessonMastery(new Map([['a', 69], ['b', 60]]), lesson), 43);
  assert.equal(lessonMastery(new Map(), lesson), 0);
});

test('nextLesson: first incomplete, null when all complete', () => {
  const lessons = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
  assert.equal(nextLesson(lessons, new Map()).id, 'm1');
  assert.equal(nextLesson(lessons, new Map([['m1', 'completed'], ['m2', 'started']])).id, 'm2');
  assert.equal(nextLesson(lessons, new Map(lessons.map(l => [l.id, 'completed']))), null);
});

const matchItem = getQuizItem(getLesson('metrics-1'), 'm1-q4');

test('shuffledRights: same items, not in answer order', () => {
  let seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rights = shuffledRights(matchItem.pairs, random);
  assert.deepEqual([...rights].sort(), matchItem.pairs.map(p => p.right).sort());
  assert.notDeepEqual(rights, matchItem.pairs.map(p => p.right));
});

test('matching: pair from either side, badge numbers, unpair', () => {
  const [p1, p2] = matchItem.pairs;
  let s = emptyMatching();
  s = selectMatching(s, 'left', p1.left);
  s = selectMatching(s, 'right', p1.right);
  assert.deepEqual(s.pairs, [{ left: p1.left, right: p1.right }]);
  s = selectMatching(s, 'right', p2.right); // right first this time
  s = selectMatching(s, 'left', p2.left);
  assert.equal(pairNumber(s, 'left', p2.left), 2);
  assert.equal(pairNumber(s, 'right', p2.right), 2);
  s = selectMatching(s, 'right', p1.right); // tapping a paired item unpairs it
  assert.equal(pairNumber(s, 'left', p1.left), null);
  assert.equal(s.pairs.length, 1);
});

test('matching: same-side reselect moves or clears the selection', () => {
  const [p1, p2] = matchItem.pairs;
  let s = selectMatching(emptyMatching(), 'left', p1.left);
  s = selectMatching(s, 'left', p2.left);
  assert.deepEqual(s.selected, { side: 'left', value: p2.left });
  s = selectMatching(s, 'left', p2.left);
  assert.equal(s.selected, null);
});

test('matching: complete answer is accepted and graded by the server rules', () => {
  let s = emptyMatching();
  for (const p of [...matchItem.pairs].reverse()) {
    s = selectMatching(selectMatching(s, 'left', p.left), 'right', p.right);
  }
  assert.equal(isMatchingComplete(s, matchItem), true);
  assert.equal(isValidAnswer(matchItem, s.pairs), true);
  assert.equal(gradeQuizItem(matchItem, s.pairs), true);
});
