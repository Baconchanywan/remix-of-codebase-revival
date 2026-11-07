/**
 * Server-only page scraping for "paste the shill".
 * Uses Firecrawl when FIRECRAWL_API_KEY is set (add it in Lovable → Secrets); otherwise falls back
 * to a plain fetch + tag strip so the feature still works without a key.
 */

const MAX_CHARS = 6000;
const TIMEOUT_MS = 15000;

export interface ScrapedPage {
  url: string;
  title: string | null;
  text: string;
  via: "firecrawl" | "fetch";
}

/** Only public http(s) hosts — avoid fetching internal addresses on the server. */
function isPublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h.startsWith("[")) return false; // raw IPv6
  return true;
}

async function viaFirecrawl(url: string, key: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: TIMEOUT_MS - 2000 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("firecrawl failed", url, res.status);
      return null;
    }
    const body = (await res.json()) as { success?: boolean; data?: { markdown?: string; metadata?: { title?: string } } };
    const md = body.data?.markdown;
    if (!body.success || !md) return null;
    return { url, title: body.data?.metadata?.title ?? null, text: md.slice(0, MAX_CHARS), via: "firecrawl" };
  } catch (err) {
    console.warn("firecrawl error", url, err);
    return null;
  }
}

async function viaFetch(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "text/html,text/plain", "user-agent": "Mozilla/5.0 (compatible; UnruggableBot/1.0)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok || !isPublicUrl(res.url || url)) return null;
    const html = (await res.text()).slice(0, 400_000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
    const text = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return null;
    return { url, title, text: text.slice(0, MAX_CHARS), via: "fetch" };
  } catch (err) {
    console.warn("page fetch error", url, err);
    return null;
  }
}

export async function scrapeUrl(url: string): Promise<ScrapedPage | null> {
  if (!isPublicUrl(url)) return null;
  const key = process.env["FIRECRAWL_API_KEY"];
  if (key) {
    const page = await viaFirecrawl(url, key);
    if (page) return page;
  }
  return viaFetch(url);
}
