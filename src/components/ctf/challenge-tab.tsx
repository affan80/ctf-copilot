"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Globe, Download, Trash2, RefreshCw, Plus, FolderOpen } from "lucide-react";
import { Challenge, SolverReport } from "@/lib/types";

interface Props {
  challenges: Challenge[];
  onRefresh: () => void;
  onSelect: (c: Challenge) => void;
}

interface IngestResult {
  ok: boolean;
  error?: string;
  status?: number;
  challenge?: { title: string; description: string; attachments: string[]; points: number; category: string };
  flags?: string[];
  solver?: SolverReport;
}

export function ChallengeTab({ challenges, onRefresh, onSelect }: Props) {
  const [url, setUrl] = useState("");
  const [cookies, setCookies] = useState("");
  const [userAgent, setUserAgent] = useState("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  const [manTitle, setManTitle] = useState("");
  const [manCategory, setManCategory] = useState("web");
  const [manPoints, setManPoints] = useState("100");
  const [manDesc, setManDesc] = useState("");

  const [ingestAndSave, setIngestAndSave] = useState(true);

  async function ingest() {
    if (!url.trim()) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch("/api/challenges/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, cookies, userAgent }),
      });
      const data: IngestResult = await res.json();
      setIngestResult(data);
      if (data.ok && ingestAndSave) {
        await fetch("/api/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.challenge?.title || "Scraped Challenge",
            url,
            category: data.challenge?.category || "unknown",
            points: data.challenge?.points || 0,
            description: data.challenge?.description || "",
            attachments: (data.challenge?.attachments || []).join("\n"),
          }),
        });
        onRefresh();
      }
    } catch (e) {
      setIngestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIngesting(false);
    }
  }

  async function saveManual() {
    if (!manTitle.trim()) return;
    await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: manTitle, category: manCategory, points: parseInt(manPoints) || 0, description: manDesc }),
    });
    setManTitle(""); setManDesc("");
    onRefresh();
  }

  async function remove(id: string) {
    await fetch(`/api/challenges?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Globe className="h-5 w-5" /> Scrape Challenge from URL
            </CardTitle>
            <CardDescription>Paste the challenge URL + your session cookies. The platform fetches &amp; auto-triages the page server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Challenge URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seizedaflaq.ctf7.com/console/event/..." className="bg-zinc-900 border-zinc-800 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Cookie header (sessionid, cf_clearance…)</Label>
              <Textarea value={cookies} onChange={(e) => setCookies(e.target.value)} placeholder={"sessionid=p0uni...; cf_clearance=ZEy..."} className="bg-zinc-900 border-zinc-800 font-mono text-xs min-h-[70px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">User-Agent (must match the one used to get cf_clearance)</Label>
              <Input value={userAgent} onChange={(e) => setUserAgent(e.target.value)} className="bg-zinc-900 border-zinc-800 font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={ingest} disabled={ingesting || !url.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
                {ingesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {ingesting ? "Fetching…" : "Fetch & Analyze"}
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={ingestAndSave} onChange={(e) => setIngestAndSave(e.target.checked)} className="accent-emerald-500" />
                Auto-save challenge
              </label>
            </div>

            {ingestResult && (
              <div className={`rounded-md border p-3 text-xs ${ingestResult.ok ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-red-900 bg-red-950/40 text-red-300"}`}>
                {ingestResult.ok ? (
                  <>
                    <p className="font-semibold mb-1">Fetched ({ingestResult.status}) — {ingestResult.challenge?.title}</p>
                    {ingestResult.challenge?.description && <p className="text-zinc-400 mb-1 line-clamp-3">{ingestResult.challenge.description.slice(0, 300)}</p>}
                    {!!ingestResult.flags?.length && <p className="font-mono text-emerald-400">FLAGS: {ingestResult.flags.join(", ")}</p>}
                    {!!ingestResult.solver?.findings.length && <p className="text-zinc-400 mt-1">{ingestResult.solver.findings.length} solver findings — open the Solver tab.</p>}
                  </>
                ) : (
                  <p>{ingestResult.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-900/50 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="text-emerald-400">Add Challenge Manually</CardTitle>
            <CardDescription>Fastest when scraping is blocked: paste title + description directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input value={manTitle} onChange={(e) => setManTitle(e.target.value)} placeholder="Title" className="bg-zinc-900 border-zinc-800 sm:col-span-1" />
              <Input value={manCategory} onChange={(e) => setManCategory(e.target.value)} placeholder="Category" className="bg-zinc-900 border-zinc-800" />
              <Input value={manPoints} onChange={(e) => setManPoints(e.target.value)} placeholder="Points" type="number" className="bg-zinc-900 border-zinc-800" />
            </div>
            <Textarea value={manDesc} onChange={(e) => setManDesc(e.target.value)} placeholder="Paste challenge description, ciphertext, encoded blob, hints…" className="bg-zinc-900 border-zinc-800 min-h-[100px] font-mono text-xs" />
            <Button onClick={saveManual} disabled={!manTitle.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
              <Plus className="h-4 w-4" /> Save Challenge
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            <FolderOpen className="h-5 w-5" /> Saved Challenges
            <Badge variant="outline" className="ml-auto border-emerald-800 text-emerald-400">{challenges.length}</Badge>
          </CardTitle>
          <CardDescription>Click a challenge to load it into the Solver.</CardDescription>
        </CardHeader>
        <CardContent>
          {challenges.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No challenges yet. Scrape one or add manually.</p>
          ) : (
            <ScrollArea className="h-[520px] pr-2">
              <div className="space-y-2">
                {challenges.map((c) => (
                  <div key={c.id} className="group flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-emerald-700 transition-colors">
                    <button onClick={() => onSelect(c)} className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-100 truncate max-w-[280px]">{c.title}</span>
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">{c.category}</Badge>
                        {c.points > 0 && <Badge variant="outline" className="border-amber-800 text-amber-400 text-[10px]">{c.points} pts</Badge>}
                        <Badge variant="outline" className={`text-[10px] ${c.status === "solved" ? "border-emerald-700 text-emerald-400" : "border-zinc-700 text-zinc-500"}`}>
                          {c.status === "solved" ? "SOLVED" : "OPEN"}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{c.description || "No description"}</p>
                      {c.flag && <p className="text-xs font-mono text-emerald-400 mt-1 truncate">🏁 {c.flag}</p>}
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="h-7 w-7 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
