export function readingMinutes(body: string | undefined): number {
  const text = (body ?? '').replace(/```[\s\S]*?```/g, '').replace(/[#>*_`\-\[\]()!]/g, '');
  return Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500));
}
