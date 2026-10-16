import { NextResponse } from "next/server";
import { runFullSolver, SolverReport } from "@/lib/ctf/solver";
import { extractFlags } from "@/lib/ctf/decoders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface IngestBody {
  url: string;
  cookies?: string;
  userAgent?: string;
  extraHeaders?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IngestBody;
    if (!body.url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });

    const headers: Record<string, string> = {
      "User-Agent": body.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (body.cookies) headers["Cookie"] = body.cookies;
    if (body.extraHeaders) Object.assign(headers, body.extraHeaders);

    // Fetch challenge page
    const res = await fetch(body.url, { headers, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const status = res.status;
    const html = await res.text();

    if (status === 403 || /Just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
      return NextResponse.json({
        ok: false,
        error: "Cloudflare protection blocked the request. cf_clearance cookies are tied to the browser fingerprint/IP that created them. Fix: paste the challenge text directly, or export full headers from your browser DevTools → Network → Copy as cURL.",
        status,
      }, { status: 200 });
    }

    if (status === 401 || status === 302 || /sign ?in|log ?in|welcome back/i.test(html.slice(0, 5000))) {
      return NextResponse.json({
        ok: false,
        error: "Session cookie invalid or expired (got login page). Fix: re-copy the sessionid cookie from your browser while logged in.",
        status,
      }, { status: 200 });
    }

    // Parse challenge data heuristically from HTML
    const title = extractTitle(html) || "Scraped Challenge";
    const description = extractDescription(html);
    const attachments = extractAttachments(html);
    const points = extractPoints(html);
    const category = extractCategory(html);

    // Run solver on the text content
    const textContent = htmlToText(html);
    const report: SolverReport = runFullSolver(textContent);
    const combinedFlags = Array.from(new Set([...extractFlags(html)]));

    return NextResponse.json({
      ok: true,
      status,
      pageBytes: html.length,
      challenge: { title, description, attachments, points, category },
      textPreview: textContent.slice(0, 3000),
      solver: report,
      flags: combinedFlags,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// ---- helpers ----
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(h1[1].replace(/<[^>]+>/g, "").trim());
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return decodeEntities(t[1].trim());
  return null;
}

function extractDescription(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]);
  // Look for common CTF platform description blocks
  const block = html.match(/class=["'][^"']*(?:challenge-?desc|description|markdown-body)[^"']*["'][^>]*>([\s\S]{20,4000}?)<\/(?:div|p|section)>/i);
  if (block) return decodeEntities(block[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  return "";
}

function extractAttachments(html: string): string[] {
  const urls = new Set<string>();
  const hrefs = html.matchAll(/(?:href|src)=["']([^"']+\.(?:zip|tar|gz|7z|rar|pdf|png|jpe?g|gif|bmp|wav|mp3|mp4|txt|py|exe|pcap|pcapng|bin|s[ah]file|elf|jpg)[^"']*)["']/gi);
  for (const m of hrefs) urls.add(m[1]);
  return Array.from(urls).slice(0, 20);
}

function extractPoints(html: string): number {
  const m = html.match(/(\d{1,4})\s*(?:pts?|points?)/i) || html.match(/class=["'][^"']*points?[^"']*["'][^>]*>\s*(\d{1,4})\s*</i);
  return m ? parseInt(m[1], 10) : 0;
}

function extractCategory(html: string): string {
  const cats = ["web", "crypto", "forensics", "pwn", "rev", "reverse", "osint", "misc", "stego", "network", "blockchain", "ai"];
  const lower = html.toLowerCase();
  for (const c of cats) {
    if (lower.includes(`>${c}<`) || lower.includes(`"${c}"`) || new RegExp(`category[^a-z]{0,10}${c}`).test(lower)) return c;
  }
  return "unknown";
}
