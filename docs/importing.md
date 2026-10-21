# Lesson import format v1

Copy `public/automation-instructions.txt` into the ChatGPT automation. A complete, valid example is in `public/example-lesson.json`.

The external document has exactly these keys:

| Key             | Type   | Rules                                         |
| --------------- | ------ | --------------------------------------------- |
| `schemaVersion` | number | Exactly 1                                     |
| `date`          | string | Real YYYY-MM-DD date, unique in your library  |
| `title`         | string | Traditional-Chinese theme/title               |
| `passages`      | array  | Exactly two passages                          |
| `suggestions`   | array  | At least three vocabulary/grammar suggestions |
| `notes`         | array  | Usage notes, or []                            |

A passage has `title`, `format`, and `sentences`. The supported formats are Dialogue, Reflection, Formal, Letter, Interview. Each sentence has `text`, matching tone-mark `pinyin`, and `paragraph`. Paragraph numbering starts at zero for each passage, stays the same within a paragraph/turn, and increases by one for the next paragraph. At least three sentence objects per passage.

A suggestion has `text`, `pinyin`, English `meaning`, `sentence`, and `kind` (`vocabulary` or `grammar`). Its sentence must be copied verbatim from one passage sentence. For vocabulary, the expression must appear in that sentence. Pattern text may contain ellipses. Notes have `title` and `text`; JSON newline escapes can separate paragraphs within a note.

The importer validates date, structure, lengths, paragraph order, and source context. It assigns stable lesson/card-suggestion IDs from the date, and sets the internal subtitle field. It rejects duplicate dates rather than changing a lesson whose cards may already reference it. It does not automatically save the suggested cards into review.

The parser accepts plain JSON or a single ```json code fence. It cannot reconstruct arbitrary prose copied from older ChatGPT lessons; ask ChatGPT to reformat those into this exact structure. It does not validate the linguistic correctness of pinyin or English definitions, so review the preview and cards.

User-created lessons belong in the app/Supabase, never in the public examples directory. The checked-in example is newly written neutral test content and intentionally shorter than a normal daily lesson.
