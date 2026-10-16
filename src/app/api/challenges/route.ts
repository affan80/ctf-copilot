import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const challenges = await db.challenge.findMany({
    orderBy: { createdAt: "desc" },
    include: { writeups: { select: { id: true, title: true } } },
  });
  return NextResponse.json({ ok: true, challenges });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const challenge = await db.challenge.create({
      data: {
        title: String(b.title || "Untitled Challenge"),
        url: b.url ? String(b.url) : null,
        category: String(b.category || "unknown"),
        points: Number(b.points || 0),
        description: String(b.description || ""),
        hints: String(b.hints || ""),
        attachments: String(b.attachments || ""),
        solution: String(b.solution || ""),
        flag: String(b.flag || ""),
      },
    });
    return NextResponse.json({ ok: true, challenge });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    const { id, ...data } = b;
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    const clean: Record<string, string | number> = {};
    for (const k of ["title", "url", "category", "description", "hints", "attachments", "solution", "flag", "status"]) {
      if (k in data && data[k] !== undefined && data[k] !== null) clean[k] = String(data[k]);
    }
    if ("points" in data) clean.points = Number(data.points);
    const challenge = await db.challenge.update({ where: { id: String(id) }, data: clean });
    return NextResponse.json({ ok: true, challenge });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await db.writeup.deleteMany({ where: { challengeId: id } });
    await db.solveSession.deleteMany({ where: { challengeId: id } });
    await db.challenge.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
