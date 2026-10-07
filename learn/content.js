// learn/content.js
// Loads the Learn mode unit content once and provides lookups.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UNIT_FILES = { metrics: 'metrics-unit.json' };

const units = new Map(); // unitId -> { unit, lessons: Map, publicUnit }

function loadUnit(unitId) {
  if (!units.has(unitId)) {
    const unit = JSON.parse(readFileSync(join(__dirname, UNIT_FILES[unitId]), 'utf8'));
    const lessons = new Map(unit.lessons.map(lesson => [lesson.id, lesson]));
    // Card `source` fields are for content review only, never shown to users
    const publicUnit = JSON.parse(JSON.stringify(unit, (key, value) => (key === 'source' ? undefined : value)));
    units.set(unitId, { unit, lessons, publicUnit });
  }
  return units.get(unitId);
}

export function isKnownUnit(unitId) {
  return Object.hasOwn(UNIT_FILES, unitId);
}

export function getPublicUnit(unitId) {
  return loadUnit(unitId).publicUnit;
}

export function getLesson(lessonId) {
  for (const unitId of Object.keys(UNIT_FILES)) {
    const lesson = loadUnit(unitId).lessons.get(lessonId);
    if (lesson) return lesson;
  }
  return null;
}

export function getUnitForLesson(lessonId) {
  for (const unitId of Object.keys(UNIT_FILES)) {
    if (loadUnit(unitId).lessons.has(lessonId)) return loadUnit(unitId).unit;
  }
  return null;
}

export function getQuizItem(lesson, itemId) {
  return lesson.quiz.find(item => item.id === itemId) || null;
}
