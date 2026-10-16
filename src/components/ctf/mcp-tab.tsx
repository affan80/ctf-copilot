"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Server, Plug, Play, Copy } from "lucide-react";

interface McpTool {
  name: string;
  description: string;
}

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "ctf-copilot": {
      "url": "https://YOUR-PREVIEW-DOMAIN/api/mcp",
      "transport": "http"
    }
  }
}`;

const CURSOR_CONFIG = `# ~/.cursor/mcp.json
{
  "mcpServers": {
    "ctf-copilot": {
      "url": "https://YOUR-PREVIEW-DOMAIN/api/mcp"
    }
  }
}`;

const CURL_EXAMPLE = `curl -X POST https://YOUR-PREVIEW-DOMAIN/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"analyze_challenge",
                 "arguments":{"text":"ZmxhZ3toZWxsb193b3JsZH0="}}}'`;

export function McpTab() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selected, setSelected] = useState("");
  const [args, setArgs] = useState('{"text": "ZmxhZ3toZWxsb193b3JsZH0="}');
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
      .then((r) => r.json())
      .then((d) => setTools(d.result?.tools ?? []))
      .catch(() => {});
  }, []);

  async function callTool() {
    setBusy(true);
    setOutput("");
    try {
      const parsed = JSON.parse(args || "{}");
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: selected, arguments: parsed } }),
      });
      const d = await res.json();
      if (d.error) setOutput(`ERROR: ${d.error.message}`);
      else {
        const text = d.result?.content?.[0]?.text ?? "";
        try {
          setOutput(JSON.stringify(JSON.parse(text), null, 2).slice(0, 12000));
        } catch {
          setOutput(text.slice(0, 12000));
        }
      }
    } catch (e) {
      setOutput(`Invalid JSON args: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400"><Server className="h-5 w-5" /> MCP Server</CardTitle>
          <CardDescription>
            Endpoint <code className="font-mono text-emerald-400">/api/mcp</code> — JSON-RPC 2.0 (MCP Streamable HTTP). Connect Claude Desktop, Cursor, Cline, Windsurf or any MCP client and the whole CTF toolbelt becomes callable AI tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { tag: "claude", label: "Claude Desktop", cfg: CLAUDE_CONFIG },
              { tag: "cursor", label: "Cursor / Cline", cfg: CURSOR_CONFIG },
              { tag: "curl", label: "Raw curl", cfg: CURL_EXAMPLE },
            ].map(({ tag, label, cfg }) => (
              <div key={tag} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-300">{label}</p>
                  <Button variant="ghost" size="sm" onClick={() => copy(cfg, tag)} className="h-6 text-[10px] text-zinc-500 hover:text-emerald-400">
                    <Copy className="h-3 w-3 mr-1" />{copied === tag ? "copied" : "copy"}
                  </Button>
                </div>
                <pre className="text-[10px] text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[160px] overflow-y-auto">{cfg}</pre>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Replace <span className="font-mono text-amber-400">YOUR-PREVIEW-DOMAIN</span> with this app&apos;s preview domain. For local Claude Desktop + local app, use <span className="font-mono">http://localhost:3000/api/mcp</span>.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400"><Plug className="h-5 w-5" /> Exposed Tools ({tools.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[380px] pr-2">
              <div className="space-y-2">
                {tools.map((t) => (
                  <button key={t.name} onClick={() => { setSelected(t.name); setArgs(t.name === "generate_writeup" ? '{}' : '{"text": "ZmxhZ3toZWxsb193b3JsZH0="}'); }} className={`w-full text-left rounded-md border p-2.5 transition-colors ${selected === t.name ? "border-emerald-600 bg-emerald-950/40" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"}`}>
                    <p className="font-mono text-xs text-emerald-400">{t.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400"><Play className="h-5 w-5" /> Tool Tester</CardTitle>
            <CardDescription>Call any MCP tool exactly like an external client would.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 font-mono text-xs"><SelectValue placeholder="Pick a tool…" /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {tools.map((t) => <SelectItem key={t.name} value={t.name} className="font-mono text-xs">{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={args} onChange={(e) => setArgs(e.target.value)} className="bg-zinc-900 border-zinc-800 font-mono text-xs min-h-[90px]" />
            <Button onClick={callTool} disabled={!selected || busy} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
              {busy ? "Calling…" : "Call Tool"}
            </Button>
            {output && (
              <div className="rounded-md border border-zinc-800 bg-black/60 p-3">
                <pre className="text-[11px] text-emerald-300 font-mono whitespace-pre-wrap break-all max-h-[260px] overflow-y-auto">{output}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
