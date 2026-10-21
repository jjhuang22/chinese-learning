import type { Card } from "./model";

function withoutTones(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactPinyin(text: string) {
  return withoutTones(text).replace(/[\s'’·\-1-5]/g, "");
}

export function matchesCardSearch(card: Card, query: string) {
  const normalized = withoutTones(query).trim();
  if (!normalized) return true;
  if (
    withoutTones(`${card.text} ${card.pinyin} ${card.meaning}`).includes(
      normalized,
    )
  )
    return true;
  const pinyinQuery = compactPinyin(query);
  return (
    pinyinQuery.length > 0 && compactPinyin(card.pinyin).includes(pinyinQuery)
  );
}
