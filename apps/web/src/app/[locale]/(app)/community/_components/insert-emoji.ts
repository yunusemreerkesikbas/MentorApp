export function insertEmojiAtSelection(
  value: string,
  emoji: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength: number,
) {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const availableLength = maxLength - (value.length - (end - start));

  if (emoji.length > availableLength) {
    return { value, caret: start, inserted: false };
  }

  return {
    value: `${value.slice(0, start)}${emoji}${value.slice(end)}`,
    caret: start + emoji.length,
    inserted: true,
  };
}
