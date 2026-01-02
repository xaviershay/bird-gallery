import { JSX } from "react";

/**
 * Parse markdown links in text and convert them to JSX anchor elements
 * Example: "Check out [my blog](https://example.com)" -> ["Check out ", <a href="...">my blog</a>]
 */
export const parseMarkdownLinks = (text: string): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add the link
    parts.push(<a key={key++} href={match[2]}>{match[1]}</a>);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};
