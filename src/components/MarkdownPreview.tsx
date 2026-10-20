import { Check, ChevronDown, ChevronUp, Copy, Image as ImageIcon, List, Maximize2, Search, Type, Volume2 } from "lucide-react";
import { Children, isValidElement, memo, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { getPromptReferences } from "../lib/projectStory";
import { canonicalPromptReference, remarkPromptReferences } from "../lib/promptReferences";
import type { PromptReferencePreview, PromptReferenceItem } from "../types/story";
import { PromptReferenceStrip, isPlayablePromptReference } from "./PromptReferenceStrip";
import { ReferenceMediaDialog } from "./ReferenceMediaDialog";

interface MarkdownPreviewProps {
  source: string;
  projectId: string;
  assetPath: string;
  expanded?: boolean;
  onOpenMaterial?: (path: string) => void;
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

const markdownRemarkPlugins = [remarkGfm, remarkBreaks, remarkImageGalleries, remarkPromptReferences];
const noReferences: PromptReferenceItem[] = [];

const MarkdownDocument = memo(function MarkdownDocument({
  articleRef,
  components,
  source,
}: {
  articleRef: RefObject<HTMLElement | null>;
  components: Components;
  source: string;
}) {
  return (
    <article ref={articleRef} className="markdown-preview">
      <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
});

export function MarkdownPreview({ source, projectId, assetPath, expanded = false, onOpenMaterial }: MarkdownPreviewProps) {
  const [selectedReference, setSelectedReference] = useState<{ reference: PromptReferenceItem; trigger: HTMLElement; autoPlay: boolean } | null>(null);
  const [referenceResult, setReferenceResult] = useState<{ projectId: string; path: string; source: string; preview?: PromptReferencePreview; error?: string } | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [fontScale, setFontScale] = useState(1);
  const [documentQuery, setDocumentQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(0);
  const articleRef = useRef<HTMLElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLElement>(null);
  const previousExpandedRef = useRef(expanded);
  const headings = useMemo(() => documentHeadings(source), [source]);
  const hasMediaReferences = /\{\{\s*(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\s*\}\}/i.test(source);
  const shouldLoadReferences = hasMediaReferences || /(?:prompt|提示词)/i.test(assetPath);
  const currentReferenceResult = referenceResult?.projectId === projectId && referenceResult.path === assetPath && referenceResult.source === source
    ? referenceResult : undefined;
  const referencePreview = currentReferenceResult?.preview;
  const references = referencePreview?.references ?? noReferences;
  const referenceMap = useMemo(() => new Map(references.map((reference) => [canonicalPromptReference(reference.reference), reference])), [references]);

  useEffect(() => {
    setSelectedReference(null);
    if (!shouldLoadReferences) return;
    const controller = new AbortController();
    Promise.all([
      getPromptReferences(projectId, assetPath, controller.signal),
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)).then((value) =>
        Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("")),
    ])
      .then(([preview, displayedHash]) => {
        if (controller.signal.aborted) return;
        const verifiedPreview: PromptReferencePreview = preview.promptSha256 && preview.promptSha256 !== displayedHash
          ? { promptPath: assetPath, state: "CONFLICT", reason: "正文在读取期间发生变化，请重新打开提示词后再查看引用素材。", references: [] }
          : preview;
        setReferenceResult({ projectId, path: assetPath, source, preview: verifiedPreview });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setReferenceResult({ projectId, path: assetPath, source, error: reason instanceof Error ? reason.message : "引用素材暂时无法读取。" });
      });
    return () => controller.abort();
  }, [assetPath, projectId, shouldLoadReferences, source]);

  const openReference = useCallback((reference: PromptReferenceItem, trigger: HTMLElement) => {
    if (isPlayablePromptReference(reference)) setSelectedReference({ reference, trigger, autoPlay: reference.kind === "audio" });
  }, []);
  const closeMedia = useCallback(() => setSelectedReference(null), []);

  const renderedHeadings = useCallback(() => (
    Array.from(articleRef.current?.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]") ?? [])
  ), []);

  useEffect(() => {
    setDocumentQuery("");
    setMatchCount(0);
    setActiveMatch(0);
    setActiveHeadingIndex(0);
  }, [assetPath]);

  useLayoutEffect(() => {
    if (previousExpandedRef.current === expanded) return;
    previousExpandedRef.current = expanded;
    const headingIndex = activeHeadingIndex;
    const frame = window.requestAnimationFrame(() => {
      renderedHeadings()[headingIndex]?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded, renderedHeadings]);

  useEffect(() => {
    if (!headings.length) return;
    const scrollRoot = expanded
      ? contentScrollRef.current
      : articleRef.current?.closest<HTMLElement>(".preview-body");
    if (!scrollRoot) return;

    let frame = 0;
    const updateActiveHeading = () => {
      frame = 0;
      const elements = renderedHeadings();
      if (!elements.length) return;

      const rootTop = scrollRoot.getBoundingClientRect().top;
      const activationLine = rootTop + (expanded ? 76 : 86);
      let nextIndex = 0;
      elements.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= activationLine) nextIndex = index;
      });
      if (scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2) {
        nextIndex = elements.length - 1;
      }
      setActiveHeadingIndex(nextIndex);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveHeading);
    };

    scheduleUpdate();
    scrollRoot.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scrollRoot.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [expanded, headings, renderedHeadings]);

  useEffect(() => {
    const outline = outlineRef.current;
    const activeButton = outline?.querySelector<HTMLElement>(`button[data-heading-index="${activeHeadingIndex}"]`);
    if (!outline || !activeButton) return;

    const visibleTop = outline.scrollTop + 40;
    const visibleBottom = outline.scrollTop + outline.clientHeight - 10;
    const buttonTop = activeButton.offsetTop;
    const buttonBottom = buttonTop + activeButton.offsetHeight;
    if (buttonTop < visibleTop) outline.scrollTo({ top: Math.max(0, buttonTop - 40), behavior: "smooth" });
    else if (buttonBottom > visibleBottom) outline.scrollTo({ top: buttonBottom - outline.clientHeight + 10, behavior: "smooth" });
  }, [activeHeadingIndex]);

  function goToHeading(index: number) {
    setActiveHeadingIndex(index);
    renderedHeadings()[index]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

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
        if (!node.textContent?.trim() || parent?.closest("button:not(.prompt-reference-chip), script, style, mark[data-document-search]")) return NodeFilter.FILTER_REJECT;
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
  }, [documentQuery, references, source]);

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
    button({ children }) {
      const token = extractText(children);
      const reference = referenceMap.get(canonicalPromptReference(token));
      const canOpen = reference && isPlayablePromptReference(reference);
      return (
        <button
          type="button"
          className={`prompt-reference-chip${canOpen ? "" : " is-unavailable"}`}
          disabled={!canOpen}
          title={reference ? `${reference.label}${reference.reason ? `：${reference.reason}` : ""}` : "此版本尚未关联该引用素材"}
          aria-label={canOpen ? `${reference.kind === "audio" ? "试听" : "查看"} ${token}：${reference.label}` : `${token}：引用未关联`}
          onClick={(event) => { if (reference) openReference(reference, event.currentTarget); }}
        >
          {reference?.kind === "audio" ? <Volume2 size={13} aria-hidden="true" /> : <ImageIcon size={13} aria-hidden="true" />}
          {children}
        </button>
      );
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

      const image: PromptReferenceItem = { label: alt || "文档图片", url: resolvedSrc, reference: "", kind: "image", resolution: "RESOLVED" };
      return (
        <button
          className="markdown-image-button"
          type="button"
          onClick={(event) => openReference(image, event.currentTarget)}
          aria-label={`全屏查看图片：${image.label}`}
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
  }), [assetPath, onOpenMaterial, openReference, projectId, referenceMap]);

  return (
    <>
      <div className={`markdown-reader${outlineOpen && headings.length ? " outline-open" : ""}${expanded ? " focus-reader" : ""}`} style={{ "--reader-scale": fontScale } as React.CSSProperties}>
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

        <div className="markdown-reader-content">
          {outlineOpen && headings.length > 0 && (
            <nav ref={outlineRef} className="document-outline" aria-label="文档章节目录">
              <strong>章节目录</strong>
              {headings.map((heading, index) => (
                <button
                  type="button"
                  className={`level-${heading.level}${index === activeHeadingIndex ? " active" : ""}`}
                  key={`${heading.id}-${heading.text}-${index}`}
                  title={heading.text}
                  data-heading-index={index}
                  aria-current={index === activeHeadingIndex ? "location" : undefined}
                  onClick={() => goToHeading(index)}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          )}

          <div
            ref={contentScrollRef}
            className="markdown-content-scroll"
            role={expanded ? "region" : undefined}
            aria-label={expanded ? "文档正文（独立滚动）" : undefined}
            tabIndex={expanded ? 0 : undefined}
          >
            {(hasMediaReferences || references.length > 0) && (
              <div className="prompt-reference-context">
                {!currentReferenceResult && <p className="prompt-reference-message" role="status">正在读取引用素材…</p>}
                {currentReferenceResult?.error && <p className="prompt-reference-message" role="status">{currentReferenceResult.error}</p>}
                {referencePreview && references.length === 0 && <p className="prompt-reference-message">{referencePreview.reason || "此版本尚未关联引用素材。"}</p>}
                {references.length > 0 && <PromptReferenceStrip references={references} onOpen={openReference} />}
              </div>
            )}
            <MarkdownDocument articleRef={articleRef} components={components} source={source} />
          </div>
        </div>
      </div>

      {selectedReference && <ReferenceMediaDialog reference={selectedReference.reference} trigger={selectedReference.trigger} autoPlay={selectedReference.autoPlay} onClose={closeMedia} />}
    </>
  );
}
