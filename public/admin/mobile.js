(() => {
  "use strict";
  const phone = window.matchMedia("(max-width: 767px)");
  // Decap reads this preference when mounting its editor. Its own toggle remains
  // responsible for updates, and its native navigation/unload guards stay intact.
  if (phone.matches) {
    try { localStorage.setItem("cms.preview-visible", "false"); } catch { /* Storage may be disabled. */ }
  }

  const updateViewport = () => {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty("--bathos-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    document.documentElement.style.setProperty("--bathos-viewport-top", `${viewport?.offsetTop ?? 0}px`);
  };
  updateViewport();
  window.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);

  const enhancePreview = () => {
    const root = document.getElementById("nc-root");
    const toggle = root?.querySelector('button[title="Toggle preview"]');
    if (!toggle) return;
    toggle.classList.add("bathos-preview-toggle");
    const expanded = !!root.querySelector('[class*="-EditorContainer"] .SplitPane');
    const label = phone.matches && expanded ? "Edit post" : "Preview post";
    if (toggle.getAttribute("aria-label") !== label) toggle.setAttribute("aria-label", label);
    if (toggle.getAttribute("aria-expanded") !== String(expanded)) toggle.setAttribute("aria-expanded", String(expanded));
  };
  const start = () => {
    const root = document.getElementById("nc-root");
    if (!root) return;
    new MutationObserver(enhancePreview).observe(root, { childList: true, subtree: true });
    phone.addEventListener("change", enhancePreview);
    enhancePreview();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
