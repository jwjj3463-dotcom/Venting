export function formatReleaseNotes(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*\*{0,2}full changelog\*{0,2}\s*:/i.test(line))
    .map((line) =>
      line
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
