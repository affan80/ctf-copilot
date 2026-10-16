import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decodeChain, extractFlags, tryBase64, tryHex, tryBinary, tryMorse, rotN, rot47, tryReverse } from "@/lib/ctf/decoders";
import {
  crackCaesar, vigenereDecrypt, vigenereEncrypt, atbash, crackXorSingle, xorWithString,
  frequencyAnalysis, identifyHash, computeHashes, decodeJwt,
} from "@/lib/ctf/crypto";
import { runFullSolver } from "@/lib/ctf/solver";
import { decodeTimingGaps } from "@/lib/ctf/timing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const text = String(body.text ?? "");
    const key = String(body.key ?? "");
    const save = Boolean(body.save);

    let result: unknown;
    const toolName = action;

    switch (action) {
      case "analyze":
        result = runFullSolver(text);
        break;
      case "decode_chain":
        result = decodeChain(text);
        break;
      case "flags":
        result = { flags: extractFlags(text) };
        break;
      case "caesar":
        result = { candidates: crackCaesar(text).slice(0, 8) };
        break;
      case "rot":
        result = {
          rot13: rotN(text, 13),
          rot47: rot47(text),
          reverse: tryReverse(text),
          allShifts: Array.from({ length: 26 }, (_, i) => ({ shift: i, text: rotN(text, -i).slice(0, 200) })),
        };
        break;
      case "vigenere_decrypt":
        result = { result: vigenereDecrypt(text, key || "key") };
        break;
      case "vigenere_encrypt":
        result = { result: vigenereEncrypt(text, key || "key") };
        break;
      case "atbash":
        result = { result: atbash(text) };
        break;
      case "frequency":
        result = frequencyAnalysis(text);
        break;
      case "xor_single":
        result = { candidates: crackXorSingle(Buffer.from(text, "base64"), 8) };
        break;
      case "xor_key":
        result = { hex: xorWithString(Buffer.from(text, "utf8"), key || "secret").toString("hex") };
        break;
      case "hash_identify":
        result = identifyHash(text);
        break;
      case "hash_compute":
        result = computeHashes(text);
        break;
      case "jwt":
        result = decodeJwt(text);
        break;
      case "quick_decodes":
        result = {
          base64: tryBase64(text),
          hex: tryHex(text),
          binary: tryBinary(text),
          morse: tryMorse(text),
        };
        break;
      case "timing": {
        // accept either raw list of gap-ms or whitespace/newline separated numbers
        const gaps = Array.isArray(body.gaps)
          ? (body.gaps as unknown[]).map(Number)
          : text.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n) && n >= 0);
        result = decodeTimingGaps(gaps);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (save) {
      await db.solveSession.create({
        data: {
          challengeId: body.challengeId ? String(body.challengeId) : null,
          tool: toolName,
          input: text.slice(0, 10000),
          output: JSON.stringify(result).slice(0, 50000),
          success: true,
        },
      });
    }

    return NextResponse.json({ ok: true, action, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
