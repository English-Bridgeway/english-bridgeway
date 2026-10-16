import { site } from "../data/site";
import { businessInfo } from "../data/policies";
import { siteOrigin } from "../seo/routeSeo";

export type PolicyBlock = { type: "h2"; text: string } | { type: "p"; text: string } | { type: "list"; items: string[] };

/** Replaces {business}, {site}, {website}, {email}, {phone}, {address} and {jurisdiction}. */
export function fillPolicyText(text: string): string {
  const b = businessInfo();
  const values: Record<string, string> = {
    business: b.name,
    site: site.name,
    website: siteOrigin().replace(/^https?:\/\//, ""),
    email: b.email,
    phone: b.phone,
    address: b.address,
    jurisdiction: b.jurisdiction,
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

/** Plain policy text to blocks: "## " heading, "- " bullet, blank line between paragraphs. Lines inside a paragraph keep their breaks. */
export function policyBlocks(text: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    para = [];
  };
  for (const raw of fillPolicyText(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); blocks.push({ type: "h2", text: line.slice(3).trim() }); continue; }
    if (/^[-*] /.test(line)) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(line.slice(2).trim());
      else blocks.push({ type: "list", items: [line.slice(2).trim()] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** The first paragraph, for the page's search description. */
export const policySummary = (text: string) => policyBlocks(text).find((b) => b.type === "p")?.text.replace(/\s+/g, " ") ?? "";
