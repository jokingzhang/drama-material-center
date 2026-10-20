interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

export function canonicalPromptReference(value: string) {
  const match = value.match(/^\{\{\s*Mixed\s+(\d+)\s*\}\}$/i);
  return match ? `{{Mixed ${Number(match[1])}}}` : value;
}

// Transform only prose text nodes, preserving the exact token for selection/copy.
// Code and existing links retain their Markdown behavior.
export function remarkPromptReferences() {
  return (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      if (!node.children || ["code", "inlineCode", "link", "linkReference", "html"].includes(node.type)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text" || !child.value) {
          visit(child);
          return [child];
        }
        const parts: MarkdownNode[] = [];
        let cursor = 0;
        for (const match of child.value.matchAll(/\{\{\s*(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\s*\}\}/gi)) {
          if (match.index! > cursor) parts.push({ type: "text", value: child.value.slice(cursor, match.index) });
          parts.push({
            type: "promptReference",
            data: { hName: "button", hProperties: { type: "button", className: ["prompt-reference-chip"] } },
            children: [{ type: "text", value: match[0] }],
          });
          cursor = match.index! + match[0].length;
        }
        if (!parts.length) return [child];
        if (cursor < child.value.length) parts.push({ type: "text", value: child.value.slice(cursor) });
        return parts;
      });
    }
    visit(tree);
  };
}
