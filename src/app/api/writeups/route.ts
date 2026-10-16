import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateWriteup, WriteupInput } from "@/lib/ctf/writeup";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const w = await db.writeup.findUnique({ where: { id }, include: { challenge: true } });
    return NextResponse.json({ ok: true, writeup: w });
  }
  const writeups = await db.writeup.findMany({ orderBy: { createdAt: "desc" }, include: { challenge: { select: { title: true, category: true, points: true } } } });
  return NextResponse.json({ ok: true, writeups });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();

    let input: WriteupInput = {
      title: String(b.title || "Untitled"),
      url: b.url,
      category: b.category,
      points: Number(b.points || 0),
      description: String(b.description || ""),
      hints: String(b.hints || ""),
      solutionSteps: String(b.solutionSteps || ""),
      flag: String(b.flag || ""),
      redactFlag: b.redactFlag !== false,
      author: b.author,
    };
    let solverFindings = b.solverFindings || "";

    // If generating from a saved challenge
    if (b.challengeId) {
      const ch = await db.challenge.findUnique({ where: { id: String(b.challengeId) } });
      if (ch) {
        input = {
          ...input,
          title: input.title === "Untitled" ? ch.title : input.title,
          url: ch.url ?? input.url,
          category: ch.category,
          points: ch.points,
          description: ch.description,
          hints: ch.hints,
          flag: ch.flag || input.flag,
        };
        // Pull latest llm solve session findings for this challenge
        const sessions = await db.solveSession.findMany({
          where: { challengeId: ch.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        const findings = sessions
          .filter((s) => s.tool === "analyze")
          .flatMap((s) => {
            try {
              return JSON.parse(s.output).findings ?? [];
            } catch {
              return [];
            }
          });
        if (findings.length) solverFindings = JSON.stringify(findings);
        if (!input.solutionSteps && sessions.some((s) => s.tool === "llm")) {
          const llmSession = sessions.find((s) => s.tool === "llm");
          if (llmSession) {
            try {
              const replies = JSON.parse(llmSession.output);
              input.solutionSteps = replies
                .filter((r: { ok?: boolean }) => r.ok)
                .map((r: { provider?: string; content?: string }) => `### ${r.provider} analysis\n\n${r.content}`)
                .join("\n\n");
            } catch { /* ignore */ }
          }
        }
      }
    }

    const content = generateWriteup({ ...input, solverFindings });
    const writeup = await db.writeup.create({
      data: {
        challengeId: b.challengeId ? String(b.challengeId) : null,
        title: input.title,
        content,
      },
    });
    return NextResponse.json({ ok: true, writeup: { id: writeup.id, title: writeup.title, content } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.writeup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
