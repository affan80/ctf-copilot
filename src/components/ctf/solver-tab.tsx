"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Brain, ScanSearch, Trophy, Users, AlertTriangle, Bot } from "lucide-react";
import { Challenge, Finding, LlmReply, SolverReport } from "@/lib/types";

interface Props {
  active: Challenge | null;
  onSolved: (flag: string) => void;
}

export function SolverTab({ active, onSolved }: Props) {
  const [input, setInput] = useState("");
  const [triaging, setTriaging] = useState(false);
  const [report, setReport] = useState<SolverReport | null>(null);

  const [llmRunning, setLlmRunning] = useState(false);
  const [replies, setReplies] = useState<LlmReply[]>([]);

  function loadChallenge() {
    if (!active) return;
    setInput([`Title: ${active.title}`, `Category: ${active.category} (${active.points} pts)`, active.url ? `URL: ${active.url}` : "", `Description: ${active.description}`, active.hints ? `Hints: ${active.hints}` : "", active.attachments ? `Attachments: ${active.attachments}` : ""].filter(Boolean).join("\n"));
  }

  // Auto-load the selected challenge into the input when it changes
  useEffect(() => {
    if (!active) return;
    setInput([`Title: ${active.title}`, `Category: ${active.category} (${active.points} pts)`, active.url ? `URL: ${active.url}` : "", `Description: ${active.description}`, active.hints ? `Hints: ${active.hints}` : "", active.attachments ? `Attachments: ${active.attachments}` : ""].filter(Boolean).join("\n"));
  }, [active]);

  async function triage() {
    if (!input.trim()) return;
    setTriaging(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", text: input, save: true, challengeId: active?.id }),
      });
      const data = await res.json();
      setReport(data.result);
      if (data.result?.flags?.length && active) onSolved(data.result.flags[0]);
    } finally {
      setTriaging(false);
    }
  }

  async function askLlms() {
    if (!input.trim()) return;
    setLlmRunning(true);
    setReplies([]);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, challengeId: active?.id }),
      });
      const data = await res.json();
      setReplies(data.replies ?? []);
      if (data.flags?.length && active) onSolved(data.flags[0]);
    } catch {
      setReplies([{ provider: "error", model: "", ok: false, content: "", error: "Request failed", latencyMs: 0 }]);
    } finally {
      setLlmRunning(false);
    }
  }

  const confColor = (c: number) => (c >= 0.85 ? "border-emerald-600 text-emerald-400" : c >= 0.6 ? "border-amber-600 text-amber-400" : "border-zinc-600 text-zinc-400");

  return (
    <div className="space-y-4">
      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <ScanSearch className="h-5 w-5" /> Challenge Material
              </CardTitle>
              <CardDescription>{active ? `Loaded: ${active.title}` : "Paste any challenge data — or load a saved challenge."}</CardDescription>
            </div>
            {active && <Button variant="outline" size="sm" onClick={loadChallenge} className="border-emerald-800 text-emerald-400 hover:bg-emerald-950">Load saved challenge</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste challenge description, ciphertext, encoded blob, hash, JWT…" className="bg-zinc-900 border-zinc-800 font-mono text-xs min-h-[140px]" />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={triage} disabled={triaging || !input.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
              {triaging ? <ScanSearch className="h-4 w-4 animate-pulse" /> : <ScanSearch className="h-4 w-4" />}
              {triaging ? "Analyzing…" : "Auto-Triage"}
            </Button>
            <Button onClick={askLlms} disabled={llmRunning || !input.trim()} variant="outline" className="border-violet-700 text-violet-300 hover:bg-violet-950">
              {llmRunning ? <Users className="h-4 w-4 animate-pulse" /> : <Users className="h-4 w-4" />}
              {llmRunning ? "LLM ensemble thinking…" : "Ask LLM Ensemble"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Trophy className="h-5 w-5" /> Triage Report
            </CardTitle>
            <CardDescription className={report.flags.length ? "text-emerald-400 font-semibold" : ""}>{report.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            {!!report.flags.length && (
              <div className="mb-3 rounded-md border border-emerald-600 bg-emerald-950/50 p-3">
                <p className="text-xs text-emerald-300 mb-1 font-semibold">FLAGS DETECTED</p>
                {report.flags.map((f) => <p key={f} className="font-mono text-emerald-400 text-sm break-all">{f}</p>)}
              </div>
            )}
            <ScrollArea className="max-h-[400px] pr-2">
              <div className="space-y-2">
                {report.findings.length === 0 && <p className="text-sm text-zinc-500">No findings — try the LLM ensemble or add more material.</p>}
                {report.findings.map((f: Finding, i) => (
                  <div key={i} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={confColor(f.confidence)}>{f.skill}</Badge>
                      <span className="text-sm font-medium text-zinc-200">{f.title}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5 break-all whitespace-pre-wrap">{f.detail}</p>
                  </div>
                ))}
                {report.recon.length > 0 && (
                  <>
                    <Separator className="bg-zinc-800" />
                    <div className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-2"><AlertTriangle className="h-3.5 w-3.5" /> RECON NEXT-STEP IDEAS</p>
                      <ul className="text-xs text-amber-200/80 space-y-1 list-disc pl-4">
                        {report.recon.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {(llmRunning || replies.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {replies.length === 0 && <p className="text-sm text-zinc-500 flex items-center gap-2"><Bot className="h-4 w-4 animate-pulse" /> Waiting for LLM responses…</p>}
          {replies.map((r, i) => (
            <Card key={i} className={`bg-zinc-950/60 ${r.ok ? "border-violet-800/60" : "border-red-900/60"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-violet-300">
                  <Brain className="h-4 w-4" /> {r.provider} <span className="text-zinc-500 font-normal">({r.model})</span>
                  <Badge variant="outline" className="ml-auto border-zinc-700 text-zinc-500 text-[10px]">{(r.latencyMs / 1000).toFixed(1)}s</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.ok ? (
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono max-h-[420px] overflow-y-auto">{r.content}</pre>
                ) : (
                  <p className="text-xs text-red-400">{r.error}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
