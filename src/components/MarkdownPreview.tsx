import { Check, ChevronDown, ChevronUp, Copy, List, Maximize2, Search, Type, X } from "lucide-react";
import { Children, isValidElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  source: string;
  projectId: string;
  assetPath: string;
  onOpenMaterial?: (path: string) => void;
}

interface PreviewImage {
  alt: string;
  src: string;
}

interface DocumentHeading {
  level: number;
  text: string;
  id: string;
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: { className?: string[] };
  };
}

function markdownNodeText(node: MarkdownNode): string {
  if (typeof node.value === "string") return node.value;
  return node.children?.map(markdownNodeText).join("") ?? "";
}

function isImageParagraph(node: MarkdownNode | undefined) {
  return node?.type === "paragraph"
    && node.children?.length === 1
    && node.children[0].type === "image";
}

function isImageLabel(node: MarkdownNode | undefined) {
  return node?.type === "paragraph"
    && node.children?.length === 1
    && node.children[0].type === "strong"
    && Boolean(markdownNodeText(node).trim());
}

function galleryItem(children: MarkdownNode[]): MarkdownNode {
  return {
    type: "imageGalleryItem",
    data: { hName: "div", hProperties: { className: ["markdown-image-gallery-item"] } },
    children,
  };
}

function remarkImageGalleries() {
  return (tree: MarkdownNode) => {
    if (!tree.children) return;

    const grouped: MarkdownNode[] = [];
    for (let index = 0; index < tree.children.length;) {
      const items: MarkdownNode[] = [];
      let cursor = index;

      while (cursor < tree.children.length) {
        const label = tree.children[cursor];
        const image = tree.children[cursor + 1];
        if (isImageLabel(label) && isImageParagraph(image)) {
          items.push(galleryItem([label, image]));
          cursor += 2;
          continue;
        }
        if (isImageParagraph(label)) {
          items.push(galleryItem([label]));
          cursor += 1;
          continue;
        }
        break;
      }

      if (items.length) {
        grouped.push({
          type: "imageGallery",
          data: { hName: "div", hProperties: { className: ["markdown-image-gallery"] } },
          children: items,
        });
        index = cursor;
      } else {
        grouped.push(tree.children[index]);
        index += 1;
      }
    }
    tree.children = grouped;
  };
}

function extractText(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (isValidElement<{ children?: ReactNode }>(child)) return extractText(child.props.children);
    return "";
  }).join("");
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveMaterialPath(reference: string | undefined, assetPath: string) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(reference)) return undefined;

  const [rawPath] = reference.split(/(?=[?#])/, 2);
  const segments = assetPath.split("/").slice(0, -1);

  for (const encodedSegment of rawPath.split("/")) {
    const segment = decodePathSegment(encodedSegment);
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join("/");
}

function resolveMaterialUrl(reference: string | undefined, projectId: string, assetPath: string) {
  const path = resolveMaterialPath(reference, assetPath);
  if (!path) return reference;
  const [, suffix = ""] = reference?.split(/(?=[?#])/, 2) ?? [];
  return `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}${suffix}`;
}

function headingId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[`*_~[\](){}<>]/g, "")
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function documentHeadings(source: string): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  let inFence = false;
  source.split("\n").forEach((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const text = match[2].replace(/[*_`~]/g, "").trim();
    headings.push({ level: match[1].length, text, id: headingId(text) });
  });
  return headings;
}

function clearSearchHighlights(root: HTMLElement | null) {
  root?.querySelectorAll("mark[data-document-search]").forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });
  root?.normalize();
}

function CopyableCodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children).replace(/\n$/, "");

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="markdown-code-block">
      <button
        className="markdown-copy-button"
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "已复制代码块" : "复制代码块"}
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        {copied ? "已复制" : "复制"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

const markdownComponents: Components = {
  table({ children }) {
    return (
      <div className="markdown-table-wrap" role="region" aria-label="文档表格">
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }) {
    return <CopyableCodeBlock>{children}</CopyableCodeBlock>;
  },
};

export function MarkdownPreview({ source, projectId, assetPath, onOpenMaterial }: MarkdownPreviewProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [fontScale, setFontScale] = useState(1);
  const [documentQuery, setDocumentQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const headings = useMemo(() => documentHeadings(source), [source]);

  const openImage = useCallback((image: PreviewImage, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setPreviewImage(image);
  }, []);

  const closeImage = useCallback(() => setPreviewImage(null), []);

  useEffect(() => {
    if (!previewImage) return;

    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeImage();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      triggerRef.current?.focus();
    };
  }, [closeImage, previewImage]);

  useEffect(() => {
    setDocumentQuery("");
    setMatchCount(0);
    setActiveMatch(0);
  }, [assetPath]);

  useEffect(() => {
    const root = articleRef.current;
    clearSearchHighlights(root);
    const normalized = documentQuery.trim().toLocaleLowerCase("zh-CN");
    if (!root || normalized.length < 2) {
      setMatchCount(0);
      setActiveMatch(0);
      return;
    }

    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.textContent?.trim() || parent?.closest("button, script, style, mark[data-document-search]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    let count = 0;
    nodes.forEach((node) => {
      const value = node.textContent ?? "";
      const lower = value.toLocaleLowerCase("zh-CN");
      let cursor = 0;
      let match = lower.indexOf(normalized);
      if (match < 0) return;
      const fragment = document.createDocumentFragment();
      while (match >= 0) {
        fragment.append(value.slice(cursor, match));
        const mark = document.createElement("mark");
        mark.dataset.documentSearch = "true";
        mark.textContent = value.slice(match, match + normalized.length);
        fragment.append(mark);
        count += 1;
        cursor = match + normalized.length;
        match = lower.indexOf(normalized, cursor);
      }
      fragment.append(value.slice(cursor));
      node.replaceWith(fragment);
    });
    setMatchCount(count);
    setActiveMatch(count ? 1 : 0);
    return () => clearSearchHighlights(root);
  }, [documentQuery, source]);

  function goToMatch(direction: -1 | 1) {
    const marks = articleRef.current?.querySelectorAll<HTMLElement>("mark[data-document-search]");
    if (!marks?.length) return;
    const next = ((activeMatch - 1 + direction + marks.length) % marks.length) + 1;
    setActiveMatch(next);
    marks.forEach((mark, index) => mark.classList.toggle("active", index === next - 1));
    marks[next - 1]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const components = useMemo<Components>(() => ({
    ...markdownComponents,
    h1({ children }) {
      const text = extractText(children);
      return <h1 id={headingId(text)}>{children}</h1>;
    },
    h2({ children }) {
      const text = extractText(children);
      return <h2 id={headingId(text)}>{children}</h2>;
    },
    h3({ children }) {
      const text = extractText(children);
      return <h3 id={headingId(text)}>{children}</h3>;
    },
    a({ children, href, title }) {
      const materialPath = resolveMaterialPath(href, assetPath);
      return (
        <a
          href={resolveMaterialUrl(href, projectId, assetPath)}
          title={title}
          target={materialPath && onOpenMaterial ? undefined : "_blank"}
          rel={materialPath && onOpenMaterial ? undefined : "noreferrer"}
          onClick={materialPath && onOpenMaterial ? (event) => {
            event.preventDefault();
            onOpenMaterial(materialPath);
          } : undefined}
        >
          {children}
        </a>
      );
    },
    img({ alt, src, title }) {
      if (!src) return null;

      const resolvedSrc = resolveMaterialUrl(src, projectId, assetPath);
      if (!resolvedSrc) return null;

      const image = { alt: alt || "文档图片", src: resolvedSrc };
      return (
        <button
          className="markdown-image-button"
          type="button"
          onClick={(event) => openImage(image, event.currentTarget)}
          aria-label={`全屏查看图片：${image.alt}`}
          title="点击全屏查看"
        >
          <img src={resolvedSrc} alt={alt || ""} title={title} />
          <span className="markdown-image-hint" aria-hidden="true">
            <Maximize2 size={15} />
            点击全屏
          </span>
        </button>
      );
    },
  }), [assetPath, onOpenMaterial, openImage, projectId]);

  return (
    <>
      <div className={`markdown-reader${outlineOpen && headings.length ? " outline-open" : ""}`} style={{ "--reader-scale": fontScale } as React.CSSProperties}>
        <div className="document-toolbar" aria-label="文档阅读工具">
          <button type="button" aria-pressed={outlineOpen} onClick={() => setOutlineOpen((open) => !open)} disabled={!headings.length}>
            <List size={15} />章节
          </button>
          <label className="document-search">
            <Search size={15} />
            <span className="sr-only">在当前文档中搜索</span>
            <input value={documentQuery} onChange={(event) => setDocumentQuery(event.target.value)} placeholder="搜索当前文档" />
            {documentQuery && <small>{matchCount ? `${activeMatch}/${matchCount}` : "0"}</small>}
          </label>
          <button type="button" aria-label="上一个文档搜索结果" disabled={!matchCount} onClick={() => goToMatch(-1)}><ChevronUp size={15} /></button>
          <button type="button" aria-label="下一个文档搜索结果" disabled={!matchCount} onClick={() => goToMatch(1)}><ChevronDown size={15} /></button>
          <span className="font-scale-control"><Type size={15} />
            <button type="button" aria-label="缩小正文字号" disabled={fontScale <= 0.9} onClick={() => setFontScale((scale) => Math.max(0.9, scale - 0.1))}>A−</button>
            <button type="button" aria-label="放大正文字号" disabled={fontScale >= 1.3} onClick={() => setFontScale((scale) => Math.min(1.3, scale + 0.1))}>A＋</button>
          </span>
        </div>

        {outlineOpen && headings.length > 0 && (
          <nav className="document-outline" aria-label="文档章节目录">
            <strong>章节目录</strong>
            {headings.map((heading) => (
              <button
                type="button"
                className={`level-${heading.level}`}
                key={`${heading.id}-${heading.text}`}
                title={heading.text}
                onClick={() => document.getElementById(heading.id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        )}

        <article ref={articleRef} className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkImageGalleries]} components={components}>
            {source}
          </ReactMarkdown>
        </article>
      </div>

      {previewImage && createPortal(
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`图片全屏预览：${previewImage.alt}`}
          onClick={closeImage}
        >
          <button
            ref={closeButtonRef}
            className="image-lightbox-close"
            type="button"
            onClick={closeImage}
            aria-label="关闭图片全屏预览"
          >
            <X size={20} aria-hidden="true" />
            关闭
          </button>
          <img
            className="image-lightbox-content"
            src={previewImage.src}
            alt={previewImage.alt}
            onClick={(event) => event.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
