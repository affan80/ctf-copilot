// ============ CTF Copilot — Solver orchestrator ============
import {
  decodeChain,
  extractFlags,
  tryBase64,
  tryHex,
  tryBinary,
  tryMorse,
} from "./decoders";
import {
  crackCaesar,
  atbash,
  frequencyAnalysis,
  identifyHash,
  decodeJwt,
  crackXorSingle,
  rot47,
} from "./crypto";

export interface Finding {
  skill: string;
  title: string;
  detail: string;
  confidence: number;
  payload?: string;
}

export interface SolverReport {
  inputLength: number;
  flags: string[];
  findings: Finding[];
  recon: string[];
  summary: string;
}

export function runFullSolver(input: string): SolverReport {
  const findings: Finding[] = [];
  const recon: string[] = [];
  const text = (input ?? "").trim();

  if (!text) {
    return { inputLength: 0, flags: [], findings: [], recon: [], summary: "Empty input." };
  }

  // 1. Flag extraction (direct)
  const flags = extractFlags(text);
  if (flags.length) {
    findings.push({
      skill: "flag-extractor",
      title: `${flags.length} flag(s) found directly in input`,
      detail: flags.join(", "),
      confidence: 1.0,
      payload: flags[0],
    });
  }

  // 2. Multi-layer decode
  const chain = decodeChain(text);
  if (chain.success) {
    const innerFlags = extractFlags(chain.final);
    findings.push({
      skill: "auto-decoder",
      title: `Decoded ${chain.steps.map((s) => s.codec).join(" → ")}`,
      detail: chain.final.slice(0, 400),
      confidence: 0.95,
      payload: innerFlags[0] ?? chain.final,
    });
    if (innerFlags.length && !flags.includes(innerFlags[0])) {
      flags.unshift(innerFlags[0]);
    }
  }

  // 3. Caesar analysis
  if (/[a-zA-Z]{10,}/.test(text)) {
    const caesar = crackCaesar(text);
    const best = caesar[0];
    if (best && best.score > 0.35 && best.shift !== 0) {
      findings.push({
        skill: "caesar-cracker",
        title: `Caesar shift ${best.shift} (score ${best.score.toFixed(2)})`,
        detail: `Words matched: ${best.wordsFound.join(", ") || "none"}. Preview: ${best.text.slice(0, 200)}`,
        confidence: Math.min(best.score, 0.9),
        payload: best.text.slice(0, 500),
      });
    }
    // 4. Frequency analysis meta
    const freq = frequencyAnalysis(text);
    findings.push({
      skill: "frequency-analysis",
      title: `IC = ${freq.indexOfCoincidence} → ${freq.looksPolyalphabetic ? "polyalphabetic (Vigenère-like)" : "monoalphabetic or plaintext"}`,
      detail: `Top letters: ${freq.frequencies.slice(0, 5).map((f) => `${f.char}:${f.percent.toFixed(1)}%`).join(", ")}. Likely Caesar shift: ${freq.likelyCaesarShift}`,
      confidence: 0.6,
    });
    if (freq.looksPolyalphabetic) {
      recon.push("Text looks polyalphabetic — try Vigenère with a key, or use an online Vigenère cracker.");
    }
  }

  // 5. Atbash + ROT47 quick pass (only if letters present)
  if (/[a-zA-Z]/.test(text)) {
    const ab = atbash(text);
    if (extractFlags(ab).length || /flag|ctf/i.test(ab)) {
      findings.push({
        skill: "atbash",
        title: "Atbash decode contains interesting text",
        detail: ab.slice(0, 300),
        confidence: 0.8,
        payload: ab.slice(0, 500),
      });
    }
    const r47 = rot47(text);
    if (extractFlags(r47).length) {
      findings.push({
        skill: "rot47",
        title: "ROT47 decode contains a flag",
        detail: r47.slice(0, 300),
        confidence: 0.9,
        payload: r47,
      });
    }
  }

  // 6. Hash identification
  for (const token of text.split(/\s+/).slice(0, 50)) {
    if (/^[0-9a-fA-F]{16,128}$/.test(token) || token.startsWith("$2") || token.startsWith("$argon2") || token.startsWith("gAAAAA")) {
      const id = identifyHash(token);
      findings.push({
        skill: "hash-identifier",
        title: `Token (${id.length} chars) identified as: ${id.possible.slice(0, 3).join(" / ")}`,
        detail: `All candidates: ${id.possible.join(", ")}`,
        confidence: 0.7,
        payload: token,
      });
    }
  }

  // 7. JWT
  const jwtToken = text.split(/\s+/).find((t) => t.split(".").length >= 2 && /^[A-Za-z0-9_-]+\./.test(t));
  if (jwtToken) {
    const jwt = decodeJwt(jwtToken);
    if (jwt) {
      findings.push({
        skill: "jwt-decoder",
        title: `JWT detected (alg: ${jwt.header.alg})`,
        detail: `Payload: ${JSON.stringify(jwt.payload).slice(0, 300)}. Vulns: ${jwt.vulnerabilities.join("; ") || "none obvious"}`,
        confidence: 0.9,
        payload: JSON.stringify({ header: jwt.header, payload: jwt.payload }, null, 2),
      });
    }
  }

  // 8. XOR brute on base64-looking blobs
  const b64blob = text.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]{16,}$/.test(b64blob)) {
    const xorHits = crackXorSingle(Buffer.from(b64blob, "base64"), 3)
      .filter((c) => /flag|ctf|key|secret/i.test(c.text));
    if (xorHits.length) {
      findings.push({
        skill: "xor-bruteforce",
        title: `XOR single-byte key ${xorHits[0].hexKey} reveals secret-looking text`,
        detail: xorHits[0].text.slice(0, 300),
        confidence: 0.85,
        payload: xorHits[0].text.slice(0, 500),
      });
    }
  }

  // 9. Web/intel recon suggestions
  if (/https?:\/\//.test(text)) {
    recon.push("URLs detected — check robots.txt, .git/, /.well-known/, source comments, response headers.");
  }
  const lower = text.toLowerCase();
  if (lower.includes("robots") || lower.includes("sitemap")) recon.push("robots.txt hints — fetch the disallowed paths.");
  if (/\d{4}-\d{2}-\d{2}|\d{10,13}/.test(text)) recon.push("Dates/timestamps found — try as key, seed, or password.");
  if (/^[01 \n]+$/.test(text)) recon.push("Binary data — decode as binary (done in auto-decoder) or interpret as bits for image.");
  if (text.length > 200 && /[^\x20-\x7e]/.test(text)) recon.push("Non-printable content — likely a binary/attachment; run file forensics (exiftool, binwalk, strings).");
  if (/\bpassword\b|\bpass\b|\bkey\b|\bsecret\b/i.test(text)) recon.push("Keywords hint at hidden credential — look for steganography or encoded secrets.");

  const top = findings[0];
  const summary = flags.length
    ? `FLAG LIKELY FOUND: ${flags[0]}`
    : top
      ? `Best lead — ${top.title}`
      : "No automatic lead. Try LLM analysis or check attachments manually.";

  return { inputLength: text.length, flags: Array.from(new Set(flags)), findings, recon, summary };
}
