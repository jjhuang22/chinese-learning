import { z } from "zod";
import { type Lesson } from "./model";
export const MAX_IMPORT_BYTES = 300_000;
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const d = new Date(value + "T12:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
  }, "Use a real calendar date");
export const importSchema = z
  .object({
    schemaVersion: z.literal(1),
    date,
    title: text(200),
    passages: z
      .array(
        z
          .object({
            title: text(200),
            format: z.enum([
              "Dialogue",
              "Reflection",
              "Formal",
              "Letter",
              "Interview",
            ]),
            sentences: z
              .array(
                z
                  .object({
                    text: text(3000),
                    pinyin: text(6000),
                    paragraph: z.number().int().min(0).max(200),
                  })
                  .strict(),
              )
              .min(3)
              .max(100),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    suggestions: z
      .array(
        z
          .object({
            text: text(200),
            pinyin: text(500),
            meaning: text(3000),
            sentence: text(3000),
            kind: z.enum(["vocabulary", "grammar"]),
          })
          .strict(),
      )
      .min(3)
      .max(60),
    notes: z
      .array(z.object({ title: text(200), text: text(12000) }).strict())
      .max(10),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    lesson.passages.forEach((passage, p) => {
      passage.sentences.forEach((sentence, i) => {
        const previous = i ? passage.sentences[i - 1].paragraph : 0;
        if (
          (i === 0 && sentence.paragraph !== 0) ||
          sentence.paragraph < previous ||
          sentence.paragraph > previous + 1
        )
          ctx.addIssue({
            code: "custom",
            path: ["passages", p, "sentences", i, "paragraph"],
            message:
              "Start paragraphs at 0, then keep the same number or increase by 1.",
          });
      });
    });
    lesson.suggestions.forEach((s, i) => {
      if (
        !lesson.passages.some((p) =>
          p.sentences.some((sentence) => sentence.text === s.sentence),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["suggestions", i, "sentence"],
          message: "Copy a source sentence exactly from one of the passages.",
        });
      if (s.kind === "vocabulary" && !s.sentence.includes(s.text))
        ctx.addIssue({
          code: "custom",
          path: ["suggestions", i, "text"],
          message: "This expression must appear in its source sentence.",
        });
    });
  });
export type ImportedLesson = z.infer<typeof importSchema>;
export function normalizeImport(input: ImportedLesson): Lesson {
  const id = `import-${input.date}`;
  return {
    id,
    date: input.date,
    title: input.title,
    subtitle: "",
    passages: input.passages,
    notes: input.notes,
    suggestions: input.suggestions.map((s, i) => ({ ...s, id: `${id}-${i}` })),
  };
}
export function parseLessonImport(raw: string): Lesson {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES)
    throw new Error("This lesson is too large. Keep it below 300 KB.");
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1")
    .trim();
  let value: unknown;
  try {
    value = JSON.parse(clean);
  } catch {
    throw new Error(
      "This is not valid JSON. Copy the complete lesson, including the opening { and closing }.",
    );
  }
  const result = importSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${issue.path.join(".") || "lesson"}: ${issue.message}`);
  }
  return normalizeImport(result.data);
}
