import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runFullSolver } from "@/lib/ctf/solver";
import {
  decodeChain, extractFlags, rotN, rot47, tryReverse, tryBase64, tryHex, tryBinary, tryMorse,
} from "@/lib/ctf/decoders";
import {
  crackCaesar, vigenereDecrypt, atbash, crackXorSingle, frequencyAnalysis,
  identifyHash, computeHashes, decodeJwt,
} from "@/lib/ctf/crypto";
import { generateWriteup } from "@/lib/ctf/writeup";
import { callLlm, CTF_SYSTEM_PROMPT, ChatMessage } from "@/lib/llm/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============ MCP JSON-RPC 2.0 endpoint (Streamable HTTP) ============
// Point Claude Desktop / Cursor / any MCP client at: {BASE_URL}/api/mcp

interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: "analyze_challenge",
    description: "Run the FULL auto-solver triage on challenge text/data: multi-layer decoding, Caesar/Vigenere detection, hash ID, JWT parse, XOR brute, flag extraction. ALWAYS start here.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Challenge description, ciphertext, encoded blob, or any suspicious data" },
      },
      required: ["text"],
    },
  },
  {
    name: "decode_chain",
    description: "Recursively auto-decode multi-layer encodings (Base64→Hex→Base32→Binary→Morse→URL→ROT13... up to 12 layers).",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "extract_flags",
    description: "Extract flag-formatted strings (flag{...}, ctf{...}, custom{...}) from text.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "crack_caesar",
    description: "Brute-force all 26 Caesar shifts, ranked by English-letter frequency + common words.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "vigenere_decrypt",
    description: "Decrypt Vigenère cipher with a known key.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, key: { type: "string" } }, required: ["text", "key"] },
  },
  {
    name: "classical_ciphers",
    description: "Quick pass: ROT13, ROT47, Atbash, reversed, all 26 shifts — returns all candidates.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "frequency_analysis",
    description: "Letter frequency analysis + index of coincidence. Detects mono vs polyalphabetic cipher and suggests Caesar shift.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "identify_hash",
    description: "Identify a hash/token type by length, charset and prefix (MD5, SHA-x, bcrypt, Fernet...).",
    inputSchema: { type: "object", properties: { hash: { type: "string" } }, required: ["hash"] },
  },
  {
    name: "compute_hashes",
    description: "Compute MD5/SHA1/SHA256/SHA512/Base64/Hex of a string.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "decode_jwt",
    description: "Decode a JWT: header, payload, signature status, and vulnerability notes (alg:none, weak secret...).",
    inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
  },
  {
    name: "crack_xor",
    description: "Brute-force single-byte XOR on a base64/hex blob, returns printable candidates. Great for 'hidden flag' challenges.",
    inputSchema: {
      type: "object",
      properties: { data: { type: "string" }, encoding: { type: "string", enum: ["base64", "hex"], description: "default base64" } },
      required: ["data"],
    },
  },
  {
    name: "quick_decodes",
    description: "Try the 4 most common single-shot decodes: Base64, Hex, Binary, Morse.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "fetch_challenge",
    description: "Server-side fetch of a challenge URL with optional Cookie header (sessionid/cf_clearance) to scrape challenge content. Returns page text + auto-triage.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        cookies: { type: "string", description: "Raw Cookie header, e.g. sessionid=abc; cf_clearance=xyz" },
        userAgent: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "solve_with_llm",
    description: "Ask the configured LLM(s) to analyze and solve the challenge. Uses built-in Z.ai GLM by default, or all enabled LLM configs saved in the platform.",
    inputSchema: {
      type: "object",
      properties: { challenge: { type: "string", description: "Full challenge context: title, description, category, data" } },
      required: ["challenge"],
    },
  },
  {
    name: "save_challenge",
    description: "Save a challenge (title, description, flag...) to the platform database for write-up generation.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" }, category: { type: "string" }, points: { type: "number" },
        description: { type: "string" }, hints: { type: "string" }, flag: { type: "string" }, url: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_challenges",
    description: "List all saved challenges with status and flags.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_writeup",
    description: "Generate a full Markdown CTF write-up from a saved challenge (auto-includes solver findings + LLM analysis). Returns markdown content.",
    inputSchema: {
      type: "object",
      properties: { challengeId: { type: "string" }, redactFlag: { type: "boolean" } },
      required: [],
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const text = String(args.text ?? "");
  switch (name) {
    case "analyze_challenge":
      return runFullSolver(text);
    case "decode_chain":
      return decodeChain(text);
    case "extract_flags":
      return { flags: extractFlags(text) };
    case "crack_caesar":
      return { top: crackCaesar(text).slice(0, 5) };
    case "vigenere_decrypt":
      return { result: vigenereDecrypt(text, String(args.key ?? "key")) };
    case "classical_ciphers":
      return {
        rot13: rotN(text, 13), rot47: rot47(text), atbash: atbash(text), reverse: tryReverse(text),
        allShifts: Array.from({ length: 26 }, (_, i) => ({ shift: i, text: rotN(text, -i).slice(0, 300) })),
      };
    case "frequency_analysis":
      return frequencyAnalysis(text);
    case "identify_hash":
      return identifyHash(String(args.hash ?? ""));
    case "compute_hashes":
      return computeHashes(text);
    case "decode_jwt":
      return decodeJwt(String(args.token ?? ""));
    case "crack_xor": {
      const enc = String(args.encoding ?? "base64");
      const data = String(args.data ?? "").replace(/\s+/g, "");
      const buf = enc === "hex" ? Buffer.from(data, "hex") : Buffer.from(data, "base64");
      return { candidates: crackXorSingle(buf, 8) };
    }
    case "quick_decodes":
      return { base64: tryBase64(text), hex: tryHex(text), binary: tryBinary(text), morse: tryMorse(text) };
    case "fetch_challenge": {
      const url = String(args.url);
      const headers: Record<string, string> = {
        "User-Agent": String(args.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36"),
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      };
      if (args.cookies) headers["Cookie"] = String(args.cookies);
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      const html = await res.text();
      const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return { status: res.status, bytes: html.length, pageText: textContent.slice(0, 8000), triage: runFullSolver(textContent.slice(0, 20000)) };
    }
    case "solve_with_llm": {
      const challenge = String(args.challenge ?? "");
      const report = runFullSolver(challenge);
      const grounding = report.findings.length ? `\n\n[Auto-triage]\n${report.findings.map((f, i) => `${i + 1}. ${f.title}`).join("\n")}` : "";
      const configs = await db.llmConfig.findMany({ where: { enabled: true } });
      const llmConfigs = configs.length
        ? configs.map((c) => ({ provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl }))
        : [{ provider: "zai", model: "glm-4.5-flash" }];
      const messages: ChatMessage[] = [
        { role: "system", content: CTF_SYSTEM_PROMPT },
        { role: "user", content: challenge + grounding },
      ];
      const replies = await Promise.all(llmConfigs.map((c) => callLlm(c, messages)));
      return {
        triage: report,
        llm: replies.map((r) => ({ provider: r.provider, ok: r.ok, content: r.content.slice(0, 8000), error: r.error })),
      };
    }
    case "save_challenge": {
      const ch = await db.challenge.create({
        data: {
          title: String(args.title ?? "Untitled"),
          category: String(args.category ?? "unknown"),
          points: Number(args.points ?? 0),
          description: String(args.description ?? ""),
          hints: String(args.hints ?? ""),
          flag: String(args.flag ?? ""),
          url: args.url ? String(args.url) : null,
        },
      });
      return { saved: true, id: ch.id };
    }
    case "list_challenges":
      return { challenges: await db.challenge.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) };
    case "generate_writeup": {
      const challengeId = String(args.challengeId ?? "");
      const ch = await db.challenge.findUnique({ where: { id: challengeId } });
      if (!ch) return { error: "Challenge not found — call save_challenge first and use the returned id" };
      const sessions = await db.solveSession.findMany({ where: { challengeId: ch.id }, orderBy: { createdAt: "desc" }, take: 5 });
      const findings = sessions.filter((s) => s.tool === "analyze").flatMap((s) => {
        try { return JSON.parse(s.output).findings ?? []; } catch { return []; }
      });
      let solutionSteps = "";
      const llmSession = sessions.find((s) => s.tool === "llm");
      if (llmSession) {
        try {
          solutionSteps = JSON.parse(llmSession.output)
            .filter((r: { ok?: boolean }) => r.ok)
            .map((r: { provider?: string; content?: string }) => `### ${r.provider} analysis\n\n${r.content}`)
            .join("\n\n");
        } catch { /* ignore */ }
      }
      const content = generateWriteup({
        title: ch.title, url: ch.url ?? undefined, category: ch.category, points: ch.points,
        description: ch.description, hints: ch.hints, solutionSteps, flag: ch.flag,
        redactFlag: args.redactFlag !== false, solverFindings: JSON.stringify(findings),
      });
      const w = await db.writeup.create({ data: { challengeId: ch.id, title: ch.title, content } });
      return { id: w.id, markdown: content };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as JsonRpcRequest;
    const { method, params = {}, id } = body;

    const jsonRes = (result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result });
    const jsonErr = (code: number, message: string) =>
      NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

    switch (method) {
      case "initialize":
        return jsonRes({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "ctf-copilot", version: "1.0.0" },
        });
      case "ping":
        return jsonRes({});
      case "tools/list":
        return jsonRes({ tools: TOOLS });
      case "tools/call": {
        const name = String(params.name ?? "");
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        try {
          const result = await executeTool(name, args);
          return jsonRes({
            content: [{ type: "text", text: JSON.stringify(result, null, 2).slice(0, 100000) }],
            isError: false,
          });
        } catch (e) {
          return jsonRes({
            content: [{ type: "text", text: `Tool error: ${e instanceof Error ? e.message : String(e)}` }],
            isError: true,
          });
        }
      }
      default:
        return jsonErr(-32601, `Method not found: ${method}`);
    }
  } catch {
    return jsonErr(-32700, "Parse error");
  }
}

export async function GET() {
  return NextResponse.json({
    server: "ctf-copilot-mcp",
    version: "1.0.0",
    protocol: "JSON-RPC 2.0 over HTTP (MPC Streamable HTTP transport)",
    endpoint: "/api/mcp",
    usage: {
      initialize: { method: "POST", body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } },
      listTools: { method: "POST", body: { jsonrpc: "2.0", id: 2, method: "tools/list" } },
      callTool: { method: "POST", body: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "analyze_challenge", arguments: { text: "ZmxhZ3toZWxsb30=" } } } },
    },
    tools: TOOLS.map((t) => t.name),
  });
}
