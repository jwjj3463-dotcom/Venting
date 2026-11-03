export function formatReleaseNotes(markdown: string): string {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const englishSectionStart = lines.findIndex(
    (line) => /^\s*#{1,6}\s/.test(line) && /[A-Za-z]/.test(line)
  );
  const arabicSection = englishSectionStart < 0 ? lines : lines.slice(0, englishSectionStart);

  return arabicSection
    .filter((line) => !/^\s*\*{0,2}full changelog\*{0,2}\s*:/i.test(line))
    .map((line) =>
      line
        .replace(/\s*\|\s*[^|]*[A-Za-z][^|]*$/, '')
        .replace(/اشتراك VIP/g, 'اشتراك العضوية المميزة')
        .replace(/VIP/g, 'العضوية المميزة')
        .replace(/^\s{0,3}#{1,6}\s*/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*[-*+]\s+/, '• ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*|__|~~|`/g, '')
        .trimEnd()
    )
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim();
}
