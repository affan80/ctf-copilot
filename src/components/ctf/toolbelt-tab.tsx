"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Loader2 } from "lucide-react";

interface Props {
  externalInput: string;
}

async function runTool(action: string, text: string, key = ""): Promise<unknown> {
  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, text, key }),
  });
  const data = await res.json();
  return data.result;
}

function ResultBlock({ title, result }: { title: string; result: unknown }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold text-emerald-400 mb-1.5">{title}</p>
      <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-all font-mono max-h-[300px] overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

export function ToolbeltTab({ externalInput }: Props) {
  const [text, setText] = useState(externalInput);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [results, setResults] = useState<Record<string, unknown>>({});

  async function call(action: string) {
    setBusy(action);
    try {
      const r = await runTool(action, text, key);
      setResults((prev) => ({ ...prev, [action]: r }));
    } finally {
      setBusy("");
    }
  }

  const Btn = ({ action, label }: { action: string; label: string }) => (
    <Button size="sm" onClick={() => call(action)} disabled={!text.trim() || busy === action} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
      {busy === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {label}
    </Button>
  );

  return (
    <Card className="border-emerald-900/50 bg-zinc-950/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-400"><Wrench className="h-5 w-5" /> Toolbelt</CardTitle>
        <CardDescription>Every tool is also exposed via the MCP endpoint at /api/mcp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Input data (ciphertext, hash, JWT, blob…)" className="bg-zinc-900 border-zinc-800 font-mono text-xs min-h-[100px]" />

        <Tabs defaultValue="encoding" className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto">
            <TabsTrigger value="encoding" className="data-[state=active]:text-emerald-400">Encoding</TabsTrigger>
            <TabsTrigger value="classical" className="data-[state=active]:text-emerald-400">Classical Crypto</TabsTrigger>
            <TabsTrigger value="modern" className="data-[state=active]:text-emerald-400">Hash / JWT / XOR</TabsTrigger>
          </TabsList>

          <TabsContent value="encoding" className="space-y-3 pt-3">
            <div className="flex gap-2 flex-wrap">
              <Btn action="decode_chain" label="Auto Decode Chain" />
              <Btn action="quick_decodes" label="Quick Decodes" />
              <Btn action="flags" label="Extract Flags" />
            </div>
            {results.decode_chain && <ResultBlock title="Decode Chain" result={results.decode_chain} />}
            {results.quick_decodes && <ResultBlock title="Quick Decodes" result={results.quick_decodes} />}
            {results.flags && <ResultBlock title="Flags" result={results.flags} />}
          </TabsContent>

          <TabsContent value="classical" className="space-y-3 pt-3">
            <div className="flex gap-2 items-center flex-wrap">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Vigenère key (if known)" className="bg-zinc-900 border-zinc-800 max-w-[220px] font-mono text-xs" />
              <Btn action="caesar" label="Crack Caesar" />
              <Btn action="rot" label="ROT13/47 + All Shifts" />
              <Btn action="atbash" label="Atbash" />
              <Btn action="vigenere_decrypt" label="Vigenère Decrypt" />
              <Btn action="frequency" label="Frequency Analysis" />
            </div>
            {results.caesar && <ResultBlock title="Caesar (top 8, ranked)" result={results.caesar} />}
            {results.rot && <ResultBlock title="ROT family" result={results.rot} />}
            {results.atbash && <ResultBlock title="Atbash" result={results.atbash} />}
            {results.vigenere_decrypt && <ResultBlock title="Vigenère decrypt" result={results.vigenere_decrypt} />}
            {results.frequency && <ResultBlock title="Frequency analysis" result={results.frequency} />}
          </TabsContent>

          <TabsContent value="modern" className="space-y-3 pt-3">
            <div className="flex gap-2 flex-wrap">
              <Btn action="hash_identify" label="Identify Hash" />
              <Btn action="hash_compute" label="Compute Hashes" />
              <Btn action="jwt" label="Decode JWT" />
              <Btn action="xor_single" label="Brute-XOR (b64 blob)" />
            </div>
            {results.hash_identify && <ResultBlock title="Hash identification" result={results.hash_identify} />}
            {results.hash_compute && <ResultBlock title="Computed hashes" result={results.hash_compute} />}
            {results.jwt && <ResultBlock title="JWT" result={results.jwt} />}
            {results.xor_single && <ResultBlock title="XOR candidates" result={results.xor_single} />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function ToolStatusBadges() {
  return (
    <div className="flex gap-1 flex-wrap">
      <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[10px]">10 decoders</Badge>
      <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[10px]">Caesar/Vigenère/XOR</Badge>
      <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[10px]">Hash ID</Badge>
      <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[10px]">JWT</Badge>
    </div>
  );
}
