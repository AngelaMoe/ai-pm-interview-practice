// learn/mastery.js
// Quiz grading and mastery scoring rules (see docs/learn-mode-prd.md, "Lesson flow and mastery").
// Pure functions: no I/O, so they're easy to test and reuse in the grading routes.

export const QUIZ_CORRECT = 20;
export const QUIZ_WRONG = -10;
export const APPLIED_STEP_MET = 25; // a met fix-step checklist item or voice concept check
export const MASTERED_AT = 70;
export const CAP_UNTIL_APPLIED = 69; // can't reach mastery until met in the fix or voice step

// Is `answer` the right shape for this item? (Separate from whether it's correct.)
export function isValidAnswer(item, answer) {
  switch (item.type) {
    case 'multiple-choice':
      return Number.isInteger(answer) && answer >= 0 && answer < item.options.length;
    case 'true-false':
      return typeof answer === 'boolean';
    case 'matching': {
      if (!Array.isArray(answer) || answer.length !== item.pairs.length) return false;
      const lefts = new Set();
      for (const pair of answer) {
        if (!pair || typeof pair.left !== 'string' || typeof pair.right !== 'string') return false;
        lefts.add(pair.left);
      }
      return lefts.size === answer.length; // each left side paired once
    }
    default:
      return false;
  }
}

// Assumes isValidAnswer(item, answer) is true.
export function gradeQuizItem(item, answer) {
  switch (item.type) {
    case 'multiple-choice':
      return answer === item.answerIndex;
    case 'true-false':
      return answer === item.answer;
    case 'matching': {
      const expected = new Map(item.pairs.map(p => [p.left, p.right]));
      return answer.every(p => expected.get(p.left) === p.right);
    }
    default:
      return false;
  }
}

// New score after one graded item: floor 0, cap 100, and capped at 69 until the
// concept has been met in the fix or voice step.
export function applyDelta(score, delta, appliedMet) {
  const ceiling = appliedMet ? 100 : CAP_UNTIL_APPLIED;
  return Math.max(0, Math.min(ceiling, score + delta));
}

export function isMastered(score) {
  return score >= MASTERED_AT;
}
