import { test, expect } from "@playwright/test";
import { ProgressSync } from "../../lib/progress-sync";
import { addCards, cardCollision, rateCard, DAY } from "../../lib/cards";
import {
  emptyState,
  lessonSchema,
  progressSchema,
  type StudyState,
  type Suggestion,
} from "../../lib/model";
import { parseLessonImport } from "../../lib/import-lesson";
import example from "../../public/example-lesson.json";
import samples from "../../lib/sample-lessons.json";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("progress saves skip initial snapshots, serialize writes, and flush the newest change", async () => {
  const gate = deferred();
  const writes: StudyState[] = [];
  const saver = new ProgressSync(emptyState, 0, async (state, revision) => {
    writes.push(state);
    if (writes.length === 1) await gate.promise;
    return revision + 1;
  });
  await saver.save();
  expect(writes).toHaveLength(0);
  const first = { ...emptyState, read: ["first"] };
  const middle = { ...emptyState, read: ["middle"] };
  const latest = { ...emptyState, read: ["latest"] };
  saver.update(first);
  const initialSave = saver.save();
  saver.update(middle);
  saver.update(latest);
  const lockFlush = saver.save();
  expect(writes).toEqual([first]);
  expect(saver.hasPendingChanges()).toBe(true);
  gate.resolve();
  await Promise.all([initialSave, lockFlush]);
  expect(writes).toEqual([first, latest]);
  expect(saver.hasPendingChanges()).toBe(false);
});
test("failed saves remain dirty and can be retried", async () => {
  let fail = true;
  const writes: StudyState[] = [];
  const saver = new ProgressSync(emptyState, 0, async (state, revision) => {
    if (fail) throw new Error("Offline");
    writes.push(state);
    return revision + 1;
  });
  const state = { ...emptyState, read: ["unsaved"] };
  saver.update(state);
  await expect(saver.save()).rejects.toThrow("Offline");
  expect(saver.hasPendingChanges()).toBe(true);
  fail = false;
  await saver.save();
  expect(writes).toEqual([state]);
  expect(saver.hasPendingChanges()).toBe(false);
});
test("bulk adds and edit collisions use the same normalized card identity", () => {
  const suggestion: Suggestion = {
    id: "a",
    text: "你好",
    pinyin: "nǐ hǎo",
    meaning: "hello",
    sentence: "你好！",
    kind: "vocabulary",
  };
  const variant = { ...suggestion, id: "b", text: "你 好！" };
  const state = addCards(emptyState, [suggestion, variant], "lesson", 100);
  expect(state.cards).toHaveLength(1);
  expect(addCards(state, [variant], "other").cards).toHaveLength(1);
  expect(cardCollision(state.cards, variant)).toBe(true);
  expect(cardCollision(state.cards, suggestion)).toBe(false);
  expect(rateCard(state.cards[0], true, 100).dueAt).toBe(100 + 30 * DAY);
});
test("persisted schemas reject malformed lessons, cards, and feedback before rendering", () => {
  expect(
    lessonSchema.safeParse({ ...samples[0], date: "2026-02-30" }).success,
  ).toBe(false);
  expect(progressSchema.safeParse({ ...emptyState, cards: [{}] }).success).toBe(
    false,
  );
  expect(
    progressSchema.safeParse({ ...emptyState, feedback: { lesson: "unknown" } })
      .success,
  ).toBe(false);
  expect(progressSchema.parse(emptyState)).toEqual(emptyState);
});

test("import source sentences must match a complete passage sentence", () => {
  const value = structuredClone(example);
  value.suggestions[0].sentence = value.suggestions[0].sentence.slice(1);
  expect(() => parseLessonImport(JSON.stringify(value))).toThrow(
    "Copy a source sentence exactly",
  );
});
