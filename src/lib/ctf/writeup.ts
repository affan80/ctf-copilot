// ============ CTF Copilot — Write-up generator ============

export interface WriteupInput {
  title: string;
  url?: string;
  category?: string;
  points?: number;
  description?: string;
  hints?: string;
  solverFindings?: string; // JSON string of SolverReport findings
  solutionSteps?: string;  // free text from user / LLM
  flag?: string;
  redactFlag?: boolean;
  author?: string;
}

function redact(flag: string | undefined, redactFlag: boolean): string {
  if (!flag) return "";
  if (!redactFlag) return flag;
  if (flag.length <= 8) return flag.slice(0, 2) + "...";
  return flag.slice(0, Math.min(6, Math.max(3, flag.indexOf("{") + 2))) + "…" + flag.slice(-1) + "  (redacted)";
}

export function generateWriteup(input: WriteupInput): string {
  const date = new Date().toISOString().slice(0, 10);
  const findings = (() => {
    try {
      const parsed = JSON.parse(input.solverFindings || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const flag = redact(input.flag, input.redactFlag !== false);

  const md: string[] = [];
  md.push(`# ${input.title}`);
  md.push("");
  md.push(`> **CTF Write-up** — ${input.category || "misc"}${input.points ? ` · ${input.points} pts` : ""} · ${date}${input.author ? ` · by ${input.author}` : ""}`);
  if (input.url) md.push(`> Challenge: ${input.url}`);
  md.push("");

  md.push("## 1. Overview");
  md.push("");
  md.push(
    `In this challenge (${input.category || "misc"} category${input.points ? `, worth ${input.points} points` : ""}), we were asked to ${
      (input.description || "the description did not give an explicit goal; the artifacts had to be analyzed to recover the flag").slice(0, 600)
    }`
  );
  md.push("");
  if (input.hints) {
    md.push("**Hints provided:**");
    md.push("");
    input.hints.split(/\n+/).filter(Boolean).forEach((h) => md.push(`- ${h}`));
    md.push("");
  }

  md.push("## 2. Reconnaissance & Analysis");
  md.push("");
  if (findings.length) {
    md.push("I started by running the challenge material through an automated triage (decoder chains, classical crypto scoring, hash identification, JWT parsing, and flag-pattern extraction). Key results:");
    md.push("");
    findings.forEach((f: { title?: string; detail?: string; skill?: string }, i: number) => {
      md.push(`${i + 1}. **${f.title ?? f.skill ?? "finding"}**${f.detail ? ` — \`${String(f.detail).slice(0, 200)}\`` : ""}`);
    });
    md.push("");
  } else {
    md.push("Manual recon was performed on the provided material. Key observations are documented in the solution steps below.");
    md.push("");
  }

  md.push("## 3. Solution");
  md.push("");
  const steps = (input.solutionSteps || "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (steps.length) {
    steps.forEach((s, i) => {
      md.push(`**Step ${i + 1}.** ${s}`);
      md.push("");
    });
  } else {
    md.push("1. Triage the challenge artifacts (encoding layers, ciphers, metadata).");
    md.push("2. Apply the highest-confidence technique identified during recon.");
    md.push("3. Extract and validate the flag format.");
    md.push("");
  }

  if (flag) {
    md.push("## 4. Flag");
    md.push("");
    md.push("```");
    md.push(flag);
    md.push("```");
    md.push("");
  }

  md.push("## 5. Lessons Learned");
  md.push("");
  md.push("- Always triage encodings first (Base64/Hex/Base32/Binary chains are the most common warm-up layers).");
  md.push(`- ${input.category === "crypto" ? "Frequency analysis and index-of-coincidence quickly separate monoalphabetic from polyalphabetic ciphers." : "Automated triage of hashes, JWTs, and metadata saves significant time."}`);
  md.push("- Validate the flag format early so you know what the decoded target looks like.");
  md.push("");

  return md.join("\n");
}
