/** 日本語の本文から読了時間(分)の目安を出す。1 分 500 字で計算 */
export function readingMinutes(body: string | undefined): number {
  const text = (body ?? '').replace(/```[\s\S]*?```/g, '').replace(/[#>*_`\-\[\]()!]/g, '');
  return Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500));
}
