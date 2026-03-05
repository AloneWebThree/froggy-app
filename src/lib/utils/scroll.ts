"use client";

/**
 * Smooth-scroll to a section WITHOUT leaving a #hash in the URL.
 *
 * Why: mobile browsers reload the exact URL (including #swap), which forces
 * a jump down the page on refresh. This keeps navigation working while keeping
 * refreshes at the top by default.
 */
export function scrollToSection(id: string) {
  if (typeof window === "undefined") return;

  const el = document.getElementById(id);
  if (!el) return;

  // Clear any existing hash so refresh doesn't jump down the page.
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    // ignore
  }

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
