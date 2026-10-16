// ============ CTF Copilot — Crypto skills ============
import { rotN, rot47, tryBase64Bytes } from "./decoders";

// English letter frequency (a-z)
const ENGLISH_FREQ = [
  0.0817, 0.0149, 0.0278, 0.0425, 0.1270, 0.0223, 0.0202, 0.0609, 0.0697,
  0.0015, 0.0077, 0.0403, 0.0241, 0.0675, 0.0751, 0.0193, 0.0010, 0.0599,
  0.0633, 0.0906, 0.0276, 0.0098, 0.0236, 0.0015, 0.0197, 0.0007,
];

const COMMON_WORDS = ["the", "and", "is", "flag", "ctf", "you", "this", "that", "key", "with", "for", "are", "was", "hello", "world", "secret", "password", "admin"];

export interface CaesarCandidate {
  shift: number;
  text: string;
  score: number;
  wordsFound: string[];
}

export function caesarScore(text: string): number {
  const letters = text.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length === 0) return 0;
  const counts = new Array(26).fill(0);
  for (const c of letters) counts[c.charCodeAt(0) - 97]++;
  let chi = 0;
  for (let i = 0; i < 26; i++) {
    const expected = ENGLISH_FREQ[i] * letters.length;
    chi += (counts[i] - expected) ** 2 / (expected + 1);
  }
  return 1 / (1 + chi / letters.length);
}

export function crackCaesar(text: string): CaesarCandidate[] {
  const results: CaesarCandidate[] = [];
  const lower = text.toLowerCase();
  for (let shift = 0; shift < 26; shift++) {
    const decoded = rotN(text, -shift);
    const lowerDecoded = decoded.toLowerCase();
    const wordsFound = COMMON_WORDS.filter((w) => lowerDecoded.includes(w));
    const score = caesarScore(decoded) + wordsFound.length * 0.15;
    results.push({ shift, text: decoded, score, wordsFound });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function vigenereDecrypt(text: string, key: string): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return text;
  let ki = 0;
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const shift = k.charCodeAt(ki % k.length) - 97;
    ki++;
    return String.fromCharCode(((c.charCodeAt(0) - base - shift + 26) % 26) + base);
  });
}

export function vigenereEncrypt(text: string, key: string): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return text;
  let ki = 0;
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const shift = k.charCodeAt(ki % k.length) - 97;
    ki++;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}

export function atbash(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

export function xorSingleByte(data: Buffer, key: number): Buffer {
  return Buffer.from(data.map((b) => b ^ key));
}

export function xorWithString(data: Buffer, key: string): Buffer {
  return Buffer.from(data.map((b, i) => b ^ key.charCodeAt(i % key.length)));
}

export interface XorCandidate {
  key: number;
  hexKey: string;
  text: string;
  score: number;
}

export function crackXorSingle(data: Buffer, topN = 8): XorCandidate[] {
  const results: XorCandidate[] = [];
  for (let key = 0; key < 256; key++) {
    const out = xorSingleByte(data, key);
    const text = out.toString("utf8");
    let printable = 0;
    for (const ch of text) {
      const c = ch.codePointAt(0)!;
      if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) printable++;
    }
    const ratio = printable / Math.max(text.length, 1);
    if (ratio > 0.9) {
      const score = ratio + caesarScore(text) * 0.5;
      results.push({ key, hexKey: "0x" + key.toString(16).padStart(2, "0"), text: text.slice(0, 500), score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topN);
}

export interface FreqAnalysis {
  totalLetters: number;
  frequencies: { char: string; count: number; percent: number }[];
  indexOfCoincidence: number;
  likelyCaesarShift: number;
  looksPolyalphabetic: boolean;
}

export function frequencyAnalysis(text: string): FreqAnalysis {
  const letters = text.toLowerCase().replace(/[^a-z]/g, "");
  const counts = new Array(26).fill(0);
  for (const c of letters) counts[c.charCodeAt(0) - 97]++;
  const total = letters.length || 1;
  const frequencies = counts
    .map((count, i) => ({ char: String.fromCharCode(97 + i), count, percent: (count / total) * 100 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);

  // Index of Coincidence
  let ic = 0;
  if (total > 1) {
    for (const c of counts) ic += (c * (c - 1)) / (total * (total - 1));
  }

  // Most frequent letter in English is 'e' — estimate shift
  const mostFreqIdx = counts.indexOf(Math.max(...counts));
  const likelyCaesarShift = (mostFreqIdx - 4 + 26) % 26;

  return {
    totalLetters: letters.length,
    frequencies,
    indexOfCoincidence: Math.round(ic * 10000) / 10000,
    likelyCaesarShift,
    looksPolyalphabetic: ic < 0.055 && total > 40, // English IC ≈ 0.0667
  };
}

// ============ Hash identification & computation ============
import crypto from "crypto";

export interface HashInfo {
  hex: string;
  length: number;
  guesses: string[];
}

export function identifyHash(hash: string): { length: number; possible: string[] } {
  const h = hash.trim();
  const len = h.length;
  const isHex = /^[0-9a-fA-F]+$/.test(h);
  const possible: string[] = [];
  if (len === 32 && isHex) possible.push("MD5", "NTLM", "MD4", "LM", "MD5 (WordPress) if prefixed $P$");
  if (len === 40 && isHex) possible.push("SHA-1", "RIPEMD-160", "SHA-1 (HMAC)");
  if (len === 56 && isHex) possible.push("SHA-224", "SHA3-224");
  if (len === 64 && isHex) possible.push("SHA-256", "SHA3-256", "BLAKE2s-256");
  if (len === 96 && isHex) possible.push("SHA-384", "SHA3-384");
  if (len === 128 && isHex) possible.push("SHA-512", "WHIRLPOOL", "SHA3-512", "BLAKE2b-512");
  if (len === 16 && isHex) possible.push("MD5 (half)", "CRC64");
  if (h.startsWith("$2a$") || h.startsWith("$2b$") || h.startsWith("$2y$")) possible.push("bcrypt");
  if (h.startsWith("$argon2")) possible.push("Argon2");
  if (h.startsWith("$6$")) possible.push("SHA-512crypt (Unix)");
  if (h.startsWith("$5$")) possible.push("SHA-256crypt (Unix)");
  if (h.startsWith("$1$")) possible.push("MD5crypt (Unix)");
  if (h.startsWith("$P$") || h.startsWith("$H$")) possible.push("MD5 (WordPress/phpBB)");
  if (h.startsWith("gAAAAA")) possible.push("Fernet token (Python cryptography)");
  if (possible.length === 0) {
    possible.push(
      isHex ? `Unknown hex string (${len} chars)` : `Not plain hex — maybe encoded/hashed+encoded (${len} chars)`
    );
  }
  return { length: len, possible };
}

export function computeHashes(input: string): Record<string, string> {
  const data = Buffer.from(input, "utf8");
  return {
    md5: crypto.createHash("md5").update(data).digest("hex"),
    sha1: crypto.createHash("sha1").update(data).digest("hex"),
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    sha512: crypto.createHash("sha512").update(data).digest("hex"),
    base64: data.toString("base64"),
    hex: data.toString("hex"),
  };
}

// ============ JWT ============
export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  signatureValid: "none" | "unsigned-danger" | "cannot-verify";
  vulnerabilities: string[];
}

export function decodeJwt(token: string): JwtParts | null {
  const parts = token.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const header = JSON.parse(b64url(parts[0]));
    const payload = JSON.parse(b64url(parts[1]));
    const vulnerabilities: string[] = [];
    if (header.alg === "none") vulnerabilities.push("alg:none — token is unsigned, signature forgery possible");
    if (String(header.alg).startsWith("HS")) vulnerabilities.push("HMAC algorithm — check for weak/brute-forceable secret");
    if (payload.exp && typeof payload.exp === "number" && payload.exp * 1000 < Date.now())
      vulnerabilities.push("Token is expired (exp)");
    if (header.jku || header.jwk) vulnerabilities.push("jku/jwk header injection possible");
    return {
      header,
      payload,
      signature: parts[2] ?? "",
      signatureValid: parts.length === 2 ? "unsigned-danger" : "cannot-verify",
      vulnerabilities,
    };
  } catch {
    return null;
  }
}

// ============ Brute helpers ============
export function bruteSingleByteXorB64(b64: string): XorCandidate[] {
  const buf = tryBase64Bytes(b64);
  if (!buf) return [];
  return crackXorSingle(buf, 5);
}

export { rotN, rot47 };
