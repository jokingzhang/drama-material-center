import { Check, Copy, Maximize2, X } from "lucide-react";
import { Children, isValidElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  source: string;
  assetPath: string;
}

interface PreviewImage {
  alt: string;
  src: string;
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

function resolveMaterialUrl(reference: string | undefined, assetPath: string) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(reference)) return reference;

  const [rawPath, suffix = ""] = reference.split(/(?=[?#])/, 2);
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

  return `/api/material-library/file?path=${encodeURIComponent(segments.join("/"))}${suffix}`;
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

export function MarkdownPreview({ source, assetPath }: MarkdownPreviewProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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

  const components = useMemo<Components>(() => ({
    ...markdownComponents,
    a({ children, href, title }) {
      return (
        <a href={resolveMaterialUrl(href, assetPath)} title={title} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    img({ alt, src, title }) {
      if (!src) return null;

      const resolvedSrc = resolveMaterialUrl(src, assetPath);
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
  }), [assetPath, openImage]);

  return (
    <>
      <article className="markdown-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkImageGalleries]} components={components}>
          {source}
        </ReactMarkdown>
      </article>

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
