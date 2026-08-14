/**
 * Converts native `title` tooltips (rendered with the OS dark bubble) into
 * styled `data-tt` tooltips so every hint matches the light UI.
 */
export function initTooltips(root: ParentNode = document): () => void {
  const convert = (scope: ParentNode) => {
    const nodes = (scope as Element).querySelectorAll
      ? (scope as Element).querySelectorAll("[title]")
      : [];
    nodes.forEach((el) => {
      const t = el.getAttribute("title");
      if (!t) { el.removeAttribute("title"); return; }
      // Keep existing rail tooltips (data-tip) as the single source of truth.
      if (!el.hasAttribute("data-tip")) el.setAttribute("data-tt", t);
      el.removeAttribute("title");
    });
  };

  convert(root);

  const target = (root as Document).body || (root as Element);
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes" && m.target instanceof Element) convert(m.target.parentNode || document);
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) {
          if (n.hasAttribute("title")) convert(n.parentNode || document);
          convert(n);
        }
      });
    }
  });
  if (target) obs.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["title"] });
  return () => obs.disconnect();
}
