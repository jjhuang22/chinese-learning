import { z } from "zod";
export const suggestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  pinyin: z.string().min(1),
  meaning: z.string().min(1),
  sentence: z.string().min(1),
  kind: z.enum(["vocabulary", "grammar"]),
});
export const lessonSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string().min(1),
  subtitle: z.string(),
  passages: z
    .array(
      z.object({
        title: z.string(),
        format: z.string(),
        sentences: z
          .array(
            z.object({
              text: z.string().min(1),
              pinyin: z.string().min(1),
              paragraph: z.number().int().nonnegative(),
            }),
          )
          .min(3),
      }),
    )
    .min(2)
    .max(3),
  suggestions: z.array(suggestionSchema).min(3),
  notes: z.array(z.object({ title: z.string(), text: z.string() })),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Card = Suggestion & {
  lessonId: string;
  status: "active" | "archived";
  dueAt: number;
  reviews: number;
  intervalDays?: number;
  createdAt: number;
};
export type StudyState = {
  reviewedOn?: string;
  cards: Card[];
  dismissed: string[];
  read: string[];
  feedback: Record<string, string>;
};
export const emptyState: StudyState = {
  cards: [],
  dismissed: [],
  read: [],
  feedback: {},
};
export function cardKey(text: string) {
  return text.replace(/[\s…。，！？、.,!?]/g, "").toLowerCase();
}
export function findCard(cards: Card[], text: string) {
  return cards.find((c) => cardKey(c.text) === cardKey(text));
}
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Keep sentence-level interactions while flowing text in paragraphs.
export function paragraphGroups(passage: Lesson["passages"][number]) {
  const groups: {
    sentence: Lesson["passages"][number]["sentences"][number];
    index: number;
  }[][] = [];
  let last: number | undefined;
  passage.sentences.forEach((sentence, index) => {
    const paragraph =
      sentence.paragraph ??
      (passage.format.toLowerCase() === "dialogue"
        ? /^[甲乙丙丁][：:]/.test(sentence.text)
          ? index
          : (last ?? 0)
        : Math.floor(index / 3));
    if (paragraph !== last || !groups.length) groups.push([]);
    groups[groups.length - 1].push({ sentence, index });
    last = paragraph;
  });
  return groups;
}
