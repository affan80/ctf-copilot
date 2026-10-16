"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChallengeTab } from "@/components/ctf/challenge-tab";
import { SolverTab } from "@/components/ctf/solver-tab";
import { ToolbeltTab } from "@/components/ctf/toolbelt-tab";
import { LlmTab } from "@/components/ctf/llm-tab";
import { McpTab } from "@/components/ctf/mcp-tab";
import { WriteupsTab } from "@/components/ctf/writeups-tab";
import { Challenge, LlmConfig } from "@/lib/types";
import { Flag, Radar, Brain, Wrench, Server, FileText, RefreshCw, Terminal } from "lucide-react";

export default function Home() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [active, setActive] = useState<Challenge | null>(null);
  const [llmCount, setLlmCount] = useState(0);
  const [tab, setTab] = useState("challenge");

  const loadChallenges = useCallback(async () => {
    const res = await fetch("/api/challenges");
    const data = await res.json();
    setChallenges(data.challenges ?? []);
  }, []);

  const loadLlms = useCallback(async () => {
    const res = await fetch("/api/llm/configs");
    const data = await res.json();
    setLlmCount((data.configs ?? []).filter((c: LlmConfig) => c.enabled).length);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chRes, llmRes] = await Promise.all([fetch("/api/challenges"), fetch("/api/llm/configs")]);
        const chData = await chRes.json();
        const llmData = await llmRes.json();
        if (cancelled) return;
        setChallenges(chData.challenges ?? []);
        setLlmCount((llmData.configs ?? []).filter((c: LlmConfig) => c.enabled).length);
      } catch {
        /* server warming up — retry via refresh button */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSolved = async (flag: string) => {
    if (!active) return;
    await fetch("/api/challenges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: active.id, flag, status: "solved", solution: flag }),
    });
    loadChallenges();
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-200 font-sans">
      {/* Scanline / grid backdrop */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <header className="sticky top-0 z-40 border-b border-emerald-900/40 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-black font-black shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-100 leading-none">
                CTF <span className="text-emerald-400">Copilot</span>
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono leading-none mt-1">solve · ensemble · write-up · mcp</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-emerald-800 text-emerald-400 font-mono text-[10px]">
              <Radar className="h-3 w-3 mr-1" /> {challenges.filter((c) => c.status === "solved").length}/{challenges.length} solved
            </Badge>
            <Badge variant="outline" className="border-violet-800 text-violet-300 font-mono text-[10px]">
              <Brain className="h-3 w-3 mr-1" /> {llmCount || 1} LLM{llmCount === 1 ? "" : "s"} ready
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-mono text-[10px]">
              <Server className="h-3 w-3 mr-1" /> MCP live
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => { loadChallenges(); loadLlms(); }} className="h-8 w-8 text-zinc-500 hover:text-emerald-400" aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 bg-zinc-900 border border-zinc-800 h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="challenge" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <Flag className="h-3.5 w-3.5" /> Challenges
            </TabsTrigger>
            <TabsTrigger value="solver" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <Radar className="h-3.5 w-3.5" /> Solver
            </TabsTrigger>
            <TabsTrigger value="toolbelt" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Toolbelt
            </TabsTrigger>
            <TabsTrigger value="llms" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <Brain className="h-3.5 w-3.5" /> LLMs
            </TabsTrigger>
            <TabsTrigger value="mcp" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <Server className="h-3.5 w-3.5" /> MCP
            </TabsTrigger>
            <TabsTrigger value="writeups" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-black data-[state=active]:font-semibold gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Write-ups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="challenge">
            <ChallengeTab challenges={challenges} onRefresh={loadChallenges} onSelect={(c) => { setActive(c); setTab("solver"); }} />
          </TabsContent>
          <TabsContent value="solver">
            <SolverTab active={active} onSolved={onSolved} />
          </TabsContent>
          <TabsContent value="toolbelt">
            <ToolbeltTab externalInput={active?.description ?? ""} />
          </TabsContent>
          <TabsContent value="llms">
            <LlmTab onRefresh={loadLlms} />
          </TabsContent>
          <TabsContent value="mcp">
            <McpTab />
          </TabsContent>
          <TabsContent value="writeups">
            <WriteupsTab active={active} onRefresh={loadChallenges} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="relative mt-auto border-t border-emerald-900/40 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-600">
          <p className="flex items-center gap-1.5 font-mono">
            <Terminal className="h-3 w-3" /> ctf-copilot v1.0 — authorized CTF use only
          </p>
          <p className="font-mono">MCP endpoint: <span className="text-emerald-500">/api/mcp</span> · JSON-RPC 2.0</p>
        </div>
      </footer>
    </div>
  );
}
