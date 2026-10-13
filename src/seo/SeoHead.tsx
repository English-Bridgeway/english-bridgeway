import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getRouteSeo, headTags } from "./routeSeo";

/**
 * Keeps <head> in step with the current route after client-side navigation. The first
 * page view already has the same tags, written by the server (see entry-server.tsx).
 */
export function SeoHead() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const seo = getRouteSeo(pathname, search);
    document.title = seo.title;
    document.head.querySelectorAll("[data-seo]").forEach((el) => el.remove());
    for (const t of headTags(seo)) {
      const el = document.createElement(t.tag);
      for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
      el.setAttribute("data-seo", "");
      if (t.text) el.textContent = t.text;
      document.head.appendChild(el);
    }
  }, [pathname, search]);
  return null;
}
