# CTF Copilot — AI Challenge Solver + MCP Server

All-in-one CTF platform: challenge ingest, automatic triage solver, multi-LLM ensemble
(GPT / Claude / Gemini / DeepSeek / Groq / Ollama / OpenRouter + built-in Z.ai GLM),
17-tool MCP server, and one-click write-up generation.

## Features

| Module | What it does |
|---|---|
| **Challenge Ingest** | Scrape challenge pages by URL with session cookies (`sessionid`, `cf_clearance`) + User-Agent. Detects Cloudflare / login walls with actionable fixes. Manual paste fallback. |
| **Auto-Solver** | Multi-layer decoder chain (Base64/Base32/Base58/Hex/Binary/Morse/URL/HTML-entities/ROT13, up to 12 layers), Caesar cracker (chi-squared + word scoring), Vigenère, Atbash, ROT47, single-byte XOR brute-force, hash identification, JWT parsing with vuln flags, flag-pattern extraction, recon suggestions. |
| **Multi-LLM Ensemble** | 8 providers. All enabled models answer in parallel. Keys stored locally in SQLite (never committed). |
| **MCP Server** | `POST /api/mcp` — JSON-RPC 2.0, 17 tools (`analyze_challenge`, `decode_chain`, `crack_caesar`, `crack_xor`, `fetch_challenge`, `solve_with_llm`, `generate_writeup`, ...). Connect Claude Desktop / Cursor / Cline. |
| **Toolbelt UI** | Interactive tab for every tool — same engine the MCP tools use. |
| **Write-up Generator** | Auto-generates Markdown write-ups from challenge data + solver findings + LLM analysis, with flag redaction and `.md` download. |

## Quick start

```bash
bun install
cp .env.example .env        # or set DATABASE_URL=file:./db/custom.db
bun run db:push             # create SQLite schema
bun run dev                 # http://localhost:3000
```

## MCP client config

```json
{
  "mcpServers": {
    "ctf-copilot": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

Try it with curl:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"analyze_challenge",
                 "arguments":{"text":"ZmxhZ3toZWxsb193b3JsZH0="}}}'
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · z-ai-web-dev-sdk

> ⚠️ For authorized CTF competitions and labs only.
