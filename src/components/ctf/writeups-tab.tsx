"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, Sparkles, Trash2 } from "lucide-react";
import { Challenge, Writeup } from "@/lib/types";

interface Props {
  active: Challenge | null;
  onRefresh: () => void;
}

export function WriteupsTab({ active, onRefresh }: Props) {
  const [writeups, setWriteups] = useState<Writeup[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Writeup | null>(null);
  const [manualSteps, setManualSteps] = useState("");
  const [redact, setRedact] = useState(true);

  async function load() {
    const res = await fetch("/api/writeups");
    const data = await res.json();
    setWriteups(data.writeups ?? []);
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { redactFlag: redact };
      if (active) body.challengeId = active.id;
      if (manualSteps.trim()) body.solutionSteps = manualSteps.trim();
      const res = await fetch("/api/writeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setPreview({ id: data.writeup.id, title: data.writeup.title, content: data.writeup.content, createdAt: "" });
        await load();
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function download(w: Writeup) {
    const blob = new Blob([w.content], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${w.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-writeup.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function remove(id: string) {
    await fetch(`/api/writeups?id=${id}`, { method: "DELETE" });
    if (preview?.id === id) setPreview(null);
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400"><Sparkles className="h-5 w-5" /> Generate Write-up</CardTitle>
            <CardDescription>
              {active ? `From saved challenge: ${active.title} (includes triage findings + LLM analysis).` : "No challenge selected — a generic write-up will be generated from your notes."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Extra solution steps (optional — markdown-ish free text, blank lines = steps)</Label>
              <Textarea value={manualSteps} onChange={(e) => setManualSteps(e.target.value)} placeholder={"Fetched the page with session cookies\nFound base64 blob in HTML comment\nDecoded 3 layers -> flag"} className="bg-zinc-900 border-zinc-800 font-mono text-xs min-h-[100px]" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={redact} onCheckedChange={setRedact} className="data-[state=checked]:bg-emerald-600" />
              <span className="text-xs text-zinc-400">Redact flag (safe to publish)</span>
            </div>
            <Button onClick={generate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
              {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <FileText className="h-4 w-4" />}
              {busy ? "Writing…" : "Generate Markdown Write-up"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="text-emerald-400">Saved Write-ups ({writeups.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {writeups.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center">No write-ups yet.</p>
            ) : (
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-2">
                  {writeups.map((w) => (
                    <div key={w.id} className="group flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-emerald-700">
                      <button onClick={() => setPreview(w)} className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-sm text-zinc-100 truncate">{w.title}</p>
                        <p className="text-xs text-zinc-500">{w.challenge ? `${w.challenge.category} · ${w.challenge.points} pts · ` : ""}{new Date(w.createdAt).toLocaleDateString()}</p>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => download(w)} className="h-7 w-7 text-zinc-500 hover:text-emerald-400"><Download className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(w.id)} className="h-7 w-7 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400"><FileText className="h-5 w-5" /> Preview</CardTitle>
          {preview && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => download(preview)} className="border-emerald-800 text-emerald-400 hover:bg-emerald-950"><Download className="h-3.5 w-3.5" /> .md</Button>
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] self-center">{preview.content.length} chars</Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {preview ? (
            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-[560px] overflow-y-auto">{preview.content}</pre>
          ) : (
            <p className="text-sm text-zinc-500 py-10 text-center">Generate or select a write-up to preview it here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
