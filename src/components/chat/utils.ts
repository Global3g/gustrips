import React from 'react';

/**
 * Renders markdown-like text with bold and links
 */
export function renderMarkdown(text: string): React.ReactNode[] | null {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const elements: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
      if (boldMatch) {
        if (boldMatch[1]) elements.push(React.createElement('span', { key: key++ }, boldMatch[1]));
        elements.push(React.createElement('strong', { key: key++, className: 'font-semibold' }, boldMatch[2]));
        remaining = boldMatch[3] || '';
        continue;
      }

      const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
      if (linkMatch) {
        if (linkMatch[1]) elements.push(React.createElement('span', { key: key++ }, linkMatch[1]));
        elements.push(
          React.createElement('a', {
            key: key++,
            href: linkMatch[3],
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-amber-600 hover:text-amber-700 underline',
          }, linkMatch[2])
        );
        remaining = linkMatch[4] || '';
        continue;
      }

      elements.push(React.createElement('span', { key: key++ }, remaining));
      break;
    }

    if (lineIndex < lines.length - 1) {
      elements.push(React.createElement('br', { key: `br-${lineIndex}` }));
    }

    return React.createElement('span', { key: `line-${lineIndex}` }, elements);
  });
}
