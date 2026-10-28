import { z } from "zod";
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const d = new Date(value + "T12:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
  }, "Use a real calendar date");
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
  date: calendarDateSchema,
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
    .length(2),
  suggestions: z.array(suggestionSchema).min(3),
  notes: z.array(z.object({ title: z.string(), text: z.string() })),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export const feedbackOptions = ["Too easy", "About right", "Too hard"] as const;
export const cardSchema = suggestionSchema.extend({
  lessonId: z.string().min(1),
  status: z.enum(["active", "archived"]),
  dueAt: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
});
export const progressSchema = z
  .object({
    cards: z.array(cardSchema).max(5000),
    dismissed: z.array(z.string()).max(20000),
    read: z.array(z.string()).max(20000),
    feedback: z.record(z.string(), z.enum(feedbackOptions)),
  })
  .strict();
export type Card = z.infer<typeof cardSchema>;
export type StudyState = z.infer<typeof progressSchema>;
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
    const paragraph = sentence.paragraph;
    if (paragraph !== last || !groups.length) groups.push([]);
    groups[groups.length - 1].push({ sentence, index });
    last = paragraph;
  });
  return groups;
}
