import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/**
 * Updates a CSS custom property `--scroll-progress` (0..1) on the target bar element
 * directly inside requestAnimationFrame so scrolling triggers zero React re-renders.
 */
export function useScrollProgressBar(
  scrollRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  resetKey: string,
) {
  useEffect(() => {
    const scroller = scrollRef.current;
    const bar = barRef.current;
    if (!scroller || !bar) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const ratio = maxScroll > 24 ? Math.max(0, Math.min(1, scroller.scrollTop / maxScroll)) : 0;
      bar.style.setProperty("--scroll-progress", ratio.toFixed(4));
      bar.dataset.active = ratio > 0.005 ? "true" : "false";
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };

    sync();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [barRef, resetKey, scrollRef]);
}

/**
 * Tracks whether the user has scrolled past the episode hero header and which
 * section ID is currently active in the viewport.
 */
export function useEpisodeScrollSpy(
  scrollRef: RefObject<HTMLElement | null>,
  heroRef: RefObject<HTMLElement | null>,
  sectionIds: readonly string[],
  enabled: boolean,
  resetKey: string,
) {
  const [pastHero, setPastHero] = useState(false);
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (!enabled) {
      setPastHero(false);
      return;
    }
    const scroller = scrollRef.current;
    if (!scroller) return;

    let frame = 0;
    const evaluate = () => {
      frame = 0;
      const scrollerRect = scroller.getBoundingClientRect();
      const hero = heroRef.current;
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom - scrollerRect.top;
        setPastHero(heroBottom < 12);
      } else {
        setPastHero(scroller.scrollTop > 180);
      }

      const activationOffset = scrollerRect.top + 130;
      let current = sectionIds[0] ?? "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= activationOffset) {
          current = id;
        }
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 16) {
        for (let index = sectionIds.length - 1; index >= 0; index -= 1) {
          if (document.getElementById(sectionIds[index])) {
            current = sectionIds[index];
            break;
          }
        }
      }
      setActiveId(current);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(evaluate);
    };

    evaluate();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, heroRef, resetKey, scrollRef, sectionIds]);

  return { pastHero, activeId };
}

/**
 * Progressive one-shot IntersectionObserver reveal for `[data-reveal]` elements.
 * Elements already in or above the viewport reveal immediately on mount; elements
 * below reveal smoothly with subtle stagger as the user scrolls down.
 */
export function useScrollReveal(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  resetKey: string,
) {
  useEffect(() => {
    const scroller = scrollRef.current;
    const container = contentRef.current;
    if (!scroller || !container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) return;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const pending: HTMLElement[] = [];

    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.top < scrollerRect.bottom - 12) {
        el.classList.add("is-revealed");
      } else {
        pending.push(el);
      }
    }

    if (!pending.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        root: scroller,
        rootMargin: "0px 0px -24px 0px",
        threshold: 0.02,
      },
    );

    pending.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [contentRef, resetKey, scrollRef]);
}

/**
 * Pure GPU pointer-tracking spotlight coordinates (no React state re-renders).
 */
export function updateSpotlightPosition(event: ReactPointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  target.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  target.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}
