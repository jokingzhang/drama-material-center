export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <picture>
        <source srcSet="/brand-logo.webp" type="image/webp" />
        <img src="/brand-logo.png" alt="" decoding="async" />
      </picture>
    </span>
  );
}
