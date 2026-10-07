// learn/mastery.test.js
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidAnswer, gradeQuizItem, applyDelta, isMastered, QUIZ_CORRECT, QUIZ_WRONG } from './mastery.js';
import { getLesson, getQuizItem, getPublicUnit, isKnownUnit } from './content.js';

const lesson1 = getLesson('metrics-1');
const mc = getQuizItem(lesson1, 'm1-q1');       // multiple choice, answerIndex 1
const tf = getQuizItem(lesson1, 'm1-q2');       // true/false, answer false
const matching = getQuizItem(lesson1, 'm1-q4'); // 3 pairs

const correctPairs = matching.pairs.map(p => ({ left: p.left, right: p.right }));

test('multiple choice: validates index range and grades', () => {
  assert.equal(isValidAnswer(mc, 1), true);
  assert.equal(isValidAnswer(mc, 4), false);
  assert.equal(isValidAnswer(mc, -1), false);
  assert.equal(isValidAnswer(mc, '1'), false);
  assert.equal(gradeQuizItem(mc, 1), true);
  assert.equal(gradeQuizItem(mc, 0), false);
});

test('true/false: requires a boolean and grades', () => {
  assert.equal(isValidAnswer(tf, 'false'), false);
  assert.equal(gradeQuizItem(tf, false), true);
  assert.equal(gradeQuizItem(tf, true), false);
});

test('matching: correct in any order', () => {
  const reversed = [...correctPairs].reverse();
  assert.equal(isValidAnswer(matching, reversed), true);
  assert.equal(gradeQuizItem(matching, reversed), true);
});

test('matching: one wrong pair is incorrect', () => {
  const swapped = correctPairs.map(p => ({ ...p }));
  [swapped[0].right, swapped[1].right] = [swapped[1].right, swapped[0].right];
  assert.equal(isValidAnswer(matching, swapped), true);
  assert.equal(gradeQuizItem(matching, swapped), false);
});

test('matching: missing pair or duplicate left side is invalid', () => {
  assert.equal(isValidAnswer(matching, correctPairs.slice(1)), false);
  const dupLeft = [correctPairs[0], correctPairs[0], correctPairs[2]];
  assert.equal(isValidAnswer(matching, dupLeft), false);
  assert.equal(isValidAnswer(matching, 'not an array'), false);
});

test('applyDelta: floor at 0', () => {
  assert.equal(applyDelta(0, QUIZ_WRONG, false), 0);
  assert.equal(applyDelta(5, QUIZ_WRONG, true), 0);
});

test('applyDelta: capped at 69 until applied step is met', () => {
  assert.equal(applyDelta(60, QUIZ_CORRECT, false), 69);
  assert.equal(applyDelta(69, QUIZ_CORRECT, false), 69);
  assert.equal(isMastered(applyDelta(69, QUIZ_CORRECT, false)), false);
});

test('applyDelta: no 69 cap once applied, cap at 100', () => {
  assert.equal(applyDelta(69, QUIZ_CORRECT, true), 89);
  assert.equal(applyDelta(95, QUIZ_CORRECT, true), 100);
  assert.equal(isMastered(89), true);
});

test('public unit strips source fields and keeps 5 lessons', () => {
  const unit = getPublicUnit('metrics');
  assert.equal(unit.lessons.length, 5);
  assert.equal(JSON.stringify(unit).includes('"source"'), false);
  assert.equal(isKnownUnit('metrics'), true);
  assert.equal(isKnownUnit('toString'), false);
});
