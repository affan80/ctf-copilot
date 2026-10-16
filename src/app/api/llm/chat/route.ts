import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callLlm, ChatMessage, CTF_SYSTEM_PROMPT, LlmConfigLike } from "@/lib/llm/registry";
import { runFullSolver } from "@/lib/ctf/solver";
import { extractFlags } from "@/lib/ctf/decoders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const b = await req.json();

    // Build the challenge context
    let challengeText = "";
    let challengeId: string | null = null;

    if (b.challengeId) {
      const ch = await db.challenge.findUnique({ where: { id: String(b.challengeId) } });
      if (ch) {
        challengeId = ch.id;
        challengeText = [
          `Title: ${ch.title}`,
          `Category: ${ch.category} | Points: ${ch.points}`,
          ch.url ? `URL: ${ch.url}` : "",
          `Description: ${ch.description}`,
          ch.hints ? `Hints: ${ch.hints}` : "",
          ch.attachments ? `Attachments: ${ch.attachments}` : "",
          ch.solution ? `Attempts so far: ${ch.solution}` : "",
        ].filter(Boolean).join("\n");
      }
    }
    if (b.prompt) challengeText = String(b.prompt);

    if (!challengeText) return NextResponse.json({ ok: false, error: "No challenge context — pass challengeId or prompt" }, { status: 400 });

    // Auto-triage results to ground the LLM
    const report = runFullSolver(challengeText);
    const grounding = report.findings.length
      ? `\n\n[Automated triage results]\n${report.findings.map((f, i) => `${i + 1}. ${f.title} — ${String(f.detail).slice(0, 200)}`).join("\n")}`
      : "";

    // Select providers: explicit ids, or all enabled configs (+ built-in zai default)
    let configs: LlmConfigLike[] = [];
    const all = await db.llmConfig.findMany({ where: { enabled: true } });
    if (Array.isArray(b.providerIds) && b.providerIds.length) {
      configs = all.filter((c) => b.providerIds.includes(c.id)).map((c) => ({ provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl }));
    } else if (all.length) {
      configs = all.map((c) => ({ provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl }));
    } else {
      configs = [{ provider: "zai", model: "glm-4.5-flash" }];
    }

    const userMsg: ChatMessage = { role: "user", content: challengeText + grounding };
    const messages: ChatMessage[] = [{ role: "system", content: CTF_SYSTEM_PROMPT }, userMsg];

    // Ensemble: run all selected providers in parallel
    const replies = await Promise.all(configs.map((c) => callLlm(c, messages)));

    const combinedText = replies.map((r) => r.content).join("\n\n") + "\n" + report.summary;
    const flags = Array.from(new Set([...extractFlags(combinedText), ...report.flags]));

    // Persist session
    const session = await db.solveSession.create({
      data: {
        challengeId,
        tool: "llm",
        input: challengeText.slice(0, 10000),
        output: JSON.stringify(replies.map((r) => ({ provider: r.provider, ok: r.ok, content: r.content.slice(0, 50000) }))),
        success: replies.some((r) => r.ok),
      },
    });

    // Auto-save flag if found and challenge context
    if (flags.length && challengeId) {
      await db.challenge.update({ where: { id: challengeId }, data: { flag: flags[0], status: "solved" } }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      replies: replies.map((r) => ({ provider: r.provider, model: r.model, ok: r.ok, content: r.content, error: r.error, latencyMs: r.latencyMs })),
      solver: report,
      flags,
      sessionId: session.id,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
