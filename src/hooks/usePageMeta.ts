import { useEffect } from "react";
import { site } from "../data/site";

interface PageMeta {
  title: string;
  description?: string;
  type?: "website" | "article";
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** Sets the document title, meta description and Open Graph tags for the current page. */
export function usePageMeta({ title, description = site.description, type = "website" }: PageMeta) {
  useEffect(() => {
    const full = title === site.name ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
    document.title = full;
    setMeta("name", "description", description);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", site.url + window.location.pathname);
  }, [title, description, type]);
}
