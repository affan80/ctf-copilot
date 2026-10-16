"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { KeyRound, Plus, Trash2, Star, ExternalLink, Bot } from "lucide-react";
import { LlmConfig, ProviderDef } from "@/lib/types";

interface Props {
  onRefresh: () => void;
}

export function LlmTab({ onRefresh }: Props) {
  const [providers, setProviders] = useState<ProviderDef[]>([]);
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/llm/configs");
    const data = await res.json();
    setProviders(data.providers ?? []);
    setConfigs(data.configs ?? []);
  }

  useEffect(() => { load(); }, []);

  function onProviderChange(p: string) {
    setProviderId(p);
    const def = providers.find((x) => x.id === p);
    setModel(def?.defaultModel ?? "");
    setBaseUrl(def?.defaultBaseUrl ?? "");
    if (!name) setName(def?.name ?? "");
  }

  async function add() {
    setSaving(true);
    try {
      await fetch("/api/llm/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider: providerId, model, apiKey, baseUrl, isDefault: configs.length === 0 }),
      });
      setName(""); setApiKey(""); setBaseUrl("");
      await load();
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(cfg: LlmConfig, field: "enabled" | "isDefault") {
    await fetch("/api/llm/configs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cfg.id, [field]: field === "isDefault" ? true : !cfg.enabled }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/llm/configs?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function test(cfg: LlmConfig) {
    setTesting(cfg.id);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Reply with exactly: OK" }),
      });
      const data = await res.json();
      const reply = (data.replies ?? []).find((r: { provider: string }) => r.provider === cfg.provider);
      setTestResult((prev) => ({ ...prev, [cfg.id]: reply ? (reply.ok ? `✓ ${reply.content.slice(0, 40)} (${(reply.latencyMs / 1000).toFixed(1)}s)` : `✗ ${reply.error}`) : "✗ no reply" }));
    } finally {
      setTesting(null);
    }
  }

  const selected = providers.find((p) => p.id === providerId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400"><Plus className="h-5 w-5" /> Add LLM Provider</CardTitle>
          <CardDescription>Your GPT Plus / Claude / Gemini / DeepSeek API keys stay local in this sandbox DB. Built-in Z.ai GLM needs no key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Provider</Label>
            <Select value={providerId} onValueChange={onProviderChange}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.needsKey ? " 🔑" : " (no key)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <a href={selected.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} className="bg-zinc-900 border-zinc-800 font-mono text-xs" />
            {selected && (
              <div className="flex gap-1 flex-wrap pt-1">
                {selected.models.map((m) => (
                  <Badge key={m} variant="outline" onClick={() => setModel(m)} className="cursor-pointer border-zinc-700 text-zinc-400 hover:border-emerald-700 hover:text-emerald-400 text-[10px]">{m}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">API Key {selected && !selected.needsKey && <span className="text-zinc-500">(optional for this provider)</span>}</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder={selected?.keyPrefix ?? "paste key"} className="bg-zinc-900 border-zinc-800 font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Base URL override (optional)</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={selected?.defaultBaseUrl ?? "https://…"} className="bg-zinc-900 border-zinc-800 font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Profile name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My GPT-4o" className="bg-zinc-900 border-zinc-800" />
          </div>
          <Button onClick={add} disabled={saving || !name.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">
            <KeyRound className="h-4 w-4" /> Save Provider
          </Button>
        </CardContent>
      </Card>

      <Card className="border-emerald-900/50 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400"><Bot className="h-5 w-5" /> Configured Models</CardTitle>
          <CardDescription>Enabled models all run in parallel ensemble when you hit &quot;Ask LLM Ensemble&quot;.</CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              No providers yet — the built-in <Badge className="bg-emerald-900 text-emerald-300 text-[10px]">Z.ai GLM</Badge> is used automatically.
            </p>
          ) : (
            <ScrollArea className="h-[430px] pr-2">
              <div className="space-y-2">
                {configs.map((c) => (
                  <div key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-100">{c.name}</span>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">{c.provider}</Badge>
                      <Badge variant="outline" className="border-violet-800 text-violet-300 text-[10px] font-mono">{c.model}</Badge>
                      {c.isDefault && <Badge className="bg-amber-900 text-amber-300 text-[10px]"><Star className="h-3 w-3 mr-0.5" />default</Badge>}
                      <div className="ml-auto flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => test(c)} disabled={testing === c.id} className="h-7 text-xs text-emerald-400 hover:text-emerald-300">
                          {testing === c.id ? "testing…" : "Test"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="h-7 w-7 text-zinc-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500">{c.hasKey ? c.apiKey : "no key (local/built-in)"}</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-zinc-500">enabled</span>
                        <Switch checked={c.enabled} onCheckedChange={() => toggle(c, "enabled")} className="data-[state=checked]:bg-emerald-600" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggle(c, "isDefault")} className="h-6 text-[10px] text-zinc-500 hover:text-amber-400">make default</Button>
                    </div>
                    {testResult[c.id] && <p className={`text-xs font-mono ${testResult[c.id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{testResult[c.id]}</p>}
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
