// ============ CTF Copilot — Multi-layer auto decoder ============

export interface DecodeStep {
  layer: number;
  codec: string;
  confidence: number;
  preview: string;
}

export interface DecodeResult {
  success: boolean;
  original: string;
  final: string;
  steps: DecodeStep[];
  candidates: { codec: string; result: string; confidence: number }[];
  error?: string;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;
const BASE32_RE = /^[A-Z2-7]+={0,6}$/;
const HEX_RE = /^(0x)?[0-9a-fA-F]+$/;
const BIN_RE = /^[01\s]+$/;
const MORSE_MAP: Record<string, string> = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F",
  "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
  "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
  "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
  "-.--": "Y", "--..": "Z", "-----": "0", ".----": "1", "..---": "2",
  "...--": "3", "....-": "4", ".....": "5", "-....": "6", "--...": "7",
  "---..": "8", "----.": "9", "-..-.": "/", ".-.-.-": ".", "--..--": ",",
};

export function isPrintable(s: string): boolean {
  if (!s) return false;
  let printable = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) printable++;
  }
  return printable / s.length > 0.85;
}

export function tryBase64(s: string): string | null {
  const t = s.trim().replace(/\s+/g, "");
  if (t.length < 4 || t.length % 4 !== 0 || !BASE64_RE.test(t)) return null;
  try {
    const buf = Buffer.from(t, "base64");
    const out = buf.toString("utf8");
    if (buf.toString("base64").replace(/=+$/, "") !== t.replace(/=+$/, "")) return null;
    return isPrintable(out) ? out : null;
  } catch {
    return null;
  }
}

export function tryBase64Bytes(s: string): Buffer | null {
  const t = s.trim().replace(/\s+/g, "");
  if (t.length < 4 || (!BASE64_RE.test(t) && !BASE64URL_RE.test(t))) return null;
  try {
    const buf = Buffer.from(t, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export function tryBase32(s: string): string | null {
  const t = s.trim().replace(/\s+/g, "").toUpperCase();
  if (t.length < 8 || t.length % 8 !== 0 || !BASE32_RE.test(t)) return null;
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const c of t) {
    if (c === "=") break;
    const idx = alpha.indexOf(c);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out += String.fromCharCode((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return isPrintable(out) ? out : null;
}

export function tryHex(s: string): string | null {
  const t = s.trim().replace(/^(0x)/i, "").replace(/\s+/g, "");
  if (t.length < 4 || t.length % 2 !== 0 || !HEX_RE.test(t)) return null;
  try {
    const out = Buffer.from(t, "hex").toString("utf8");
    return isPrintable(out) ? out : null;
  } catch {
    return null;
  }
}

export function tryBinary(s: string): string | null {
  const t = s.trim();
  if (!BIN_RE.test(t) || t.replace(/\s/g, "").length < 8) return null;
  const clean = t.replace(/\s+/g, "");
  if (clean.length % 8 !== 0) return null;
  let out = "";
  for (let i = 0; i < clean.length; i += 8) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 8), 2));
  }
  return isPrintable(out) ? out : null;
}

export function tryDecimal(s: string): string | null {
  const t = s.trim();
  if (!/^[\d\s]+$/.test(t) || t.length < 4) return null;
  const parts = t.split(/\s+/);
  if (parts.length < 2) return null;
  const out = parts.map((p) => String.fromCharCode(parseInt(p, 10))).join("");
  return isPrintable(out) ? out : null;
}

export function tryMorse(s: string): string | null {
  const t = s.trim();
  if (!/^[.\-_\s/]+$/.test(t) || !/[.\-_]/.test(t)) return null;
  const normalized = t.replace(/_/g, "-").replace(/\//g, " / ");
  const words = normalized.split(/\s*\/\s*|\s{3,}/);
  const decoded = words
    .map((w) =>
      w.trim().split(/\s+/).map((c) => MORSE_MAP[c] ?? "").join("")
    )
    .join(" ")
    .trim();
  return decoded.length > 0 ? decoded : null;
}

export function tryBase58(s: string): string | null {
  const t = s.trim().replace(/\s+/g, "");
  if (t.length < 4 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(t)) return null;
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const c of t) {
    const idx = alpha.indexOf(c);
    if (idx === -1) return null;
    num = num * 58n + BigInt(idx);
  }
  let bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const c of t) {
    if (c === "1") bytes.unshift(0);
    else break;
  }
  if (bytes.length === 0) return null;
  const out = String.fromCharCode(...bytes);
  return isPrintable(out) ? out : null;
}

export function tryUrl(s: string): string | null {
  if (!/%[0-9a-fA-F]{2}/.test(s)) return null;
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

export function tryHtmlEntities(s: string): string | null {
  if (!/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/.test(s)) return null;
  const out = s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return out !== s ? out : null;
}

export function rotN(s: string, n: number): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + n) % 26 + 26) % 26 + base);
  });
}

export function tryRot13(s: string): string | null {
  if (!/[a-zA-Z]/.test(s)) return null;
  return rotN(s, 13);
}

export function rot47(s: string): string {
  return s.replace(/[!-~]/g, (c) =>
    String.fromCharCode(33 + ((c.charCodeAt(0) + 14) % 94))
  );
}

export function tryReverse(s: string): string {
  return s.split("").reverse().join("");
}

const DECODERS: { name: string; fn: (s: string) => string | null; conf: number }[] = [
  { name: "Base64", fn: tryBase64, conf: 0.9 },
  { name: "Hex", fn: tryHex, conf: 0.85 },
  { name: "URL", fn: tryUrl, conf: 0.8 },
  { name: "Base32", fn: tryBase32, conf: 0.85 },
  { name: "Binary", fn: tryBinary, conf: 0.8 },
  { name: "Base58", fn: tryBase58, conf: 0.6 },
  { name: "Morse", fn: tryMorse, conf: 0.9 },
  { name: "HTML Entities", fn: tryHtmlEntities, conf: 0.8 },
  { name: "Decimal", fn: tryDecimal, conf: 0.5 },
  { name: "ROT13", fn: tryRot13, conf: 0.4 },
];

const MAX_LAYERS = 12;

// Strict, well-known flag prefixes used for early-stop in the decode chain.
// (extractFlags has a generic pattern that would false-positive on JS objects etc.)
const KNOWN_FLAG_RE = /(?:flag|ctf|ctf7|picoCTF|HTB|THM)\{[^}\s]{1,200}\}/;

function hasKnownFlag(s: string): boolean {
  return KNOWN_FLAG_RE.test(s);
}

export function decodeChain(input: string, maxLayers: number = MAX_LAYERS): DecodeResult {
  const steps: DecodeStep[] = [];
  let current = input.trim();
  let lastReadable = current;
  let lastCodec = "";
  const candidates: { codec: string; result: string; confidence: number }[] = [];

  for (let layer = 1; layer <= maxLayers; layer++) {
    // A known flag is already visible — stop decoding, we're done.
    if (hasKnownFlag(current)) break;

    let matched = false;
    for (const d of DECODERS) {
      // Never apply the same codec twice in a row (prevents ROT13 ping-pong loops).
      if (d.name === lastCodec) continue;
      const out = d.fn(current);
      if (out && out !== current) {
        candidates.push({ codec: d.name, result: out, confidence: d.conf });
        // Accept low-confidence codecs (e.g. ROT13) when they reveal a known flag
        const revealsFlag = hasKnownFlag(out);
        if (revealsFlag || d.conf >= 0.5 || steps.length > 0) {
          steps.push({
            layer,
            codec: d.name,
            confidence: d.conf,
            preview: out.slice(0, 120),
          });
          current = out;
          lastCodec = d.name;
          if (isPrintable(current)) lastReadable = current;
          matched = true;
          break;
        }
      }
    }
    if (!matched) break;
  }

  const final = lastReadable;
  return {
    success: steps.length > 0,
    original: input,
    final,
    steps,
    candidates: candidates.slice(0, 10),
    error: steps.length === 0 ? "No encoding layer detected. Try crypto tools or manual analysis." : undefined,
  };
}

// ============ Flag extraction ============

const FLAG_PATTERNS = [
  /flag\{[^}\s]{1,200}\}/gi,
  /ctf\{[^}\s]{1,200}\}/gi,
  /ctf7\{[^}\s]{1,200}\}/gi,
  /picoCTF\{[^}\s]{1,200}\}/gi,
  /HTB\{[^}\s]{1,200}\}/gi,
  /THM\{[^}\s]{1,200}\}/gi,
  /[A-Za-z0-9_]{2,20}\{[^}\s]{4,200}\}/g,
];

export function extractFlags(text: string): string[] {
  const found = new Set<string>();
  for (const p of FLAG_PATTERNS) {
    const m = text.match(p);
    if (m) m.forEach((f) => found.add(f));
  }
  return Array.from(found);
}
