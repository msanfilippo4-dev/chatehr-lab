/** Count whitespace-separated words consistently in student and instructor views. */
export function wordCount(text: string): number {
  return text.trim().match(/\S+/gu)?.length ?? 0;
}
