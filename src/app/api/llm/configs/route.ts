import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/lib/llm/registry";

export const dynamic = "force-dynamic";

function mask(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

export async function GET() {
  const configs = await db.llmConfig.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    ok: true,
    providers: PROVIDERS,
    configs: configs.map((c) => ({ ...c, apiKey: mask(c.apiKey), hasKey: !!c.apiKey })),
  });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.name || !b.provider) return NextResponse.json({ ok: false, error: "name and provider required" }, { status: 400 });
    if (b.isDefault) await db.llmConfig.updateMany({ data: { isDefault: false } });
    const config = await db.llmConfig.create({
      data: {
        name: String(b.name),
        provider: String(b.provider),
        model: String(b.model || PROVIDERS.find((p) => p.id === b.provider)?.defaultModel || ""),
        apiKey: String(b.apiKey || ""),
        baseUrl: String(b.baseUrl || ""),
        enabled: b.enabled !== false,
        isDefault: Boolean(b.isDefault),
      },
    });
    return NextResponse.json({ ok: true, config: { ...config, apiKey: mask(config.apiKey) } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    if (b.isDefault) await db.llmConfig.updateMany({ data: { isDefault: false } });
    const data: Record<string, string | boolean> = {};
    for (const k of ["name", "provider", "model", "baseUrl"]) if (k in b) data[k] = String(b[k]);
    for (const k of ["enabled", "isDefault"]) if (k in b) data[k] = Boolean(b[k]);
    if ("apiKey" in b && b.apiKey && !String(b.apiKey).includes("••")) data.apiKey = String(b.apiKey);
    const config = await db.llmConfig.update({ where: { id: String(b.id) }, data });
    return NextResponse.json({ ok: true, config: { ...config, apiKey: mask(config.apiKey) } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.llmConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
