// ============ CTF Copilot — Timing covert-channel decoder ============
// Recovered from the SeizeDaFlaq 2026 "Sandy Shores Heist" challenge:
// inter-packet gaps encode data as binary (L/H), Manchester pairs, or burst counts.

export interface TimingResult {
  samples: number;
  levels: { low: number; high: number; zeroish: number };
  decoded: {
    model: string;
    bytes: number;
    printable: number; // 0..1
    preview: string;
    payload?: string;
  }[];
  best?: string;
}

function bitsToBytes(bits: number[]): Buffer {
  const out: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  return Buffer.from(out);
}

function printableRatio(buf: Buffer): number {
  if (!buf.length) return 0;
  let ok = 0;
  for (const b of buf) if ((b >= 32 && b < 127) || b === 9 || b === 10 || b === 13) ok++;
  return ok / buf.length;
}

function tryPush(model: string, bits: number[], out: TimingResult["decoded"]) {
  if (bits.length < 16) return;
  const buf = bitsToBytes(bits);
  const pr = printableRatio(buf);
  if (pr < 0.75) return;
  const text = buf.toString("latin1");
  out.push({
    model,
    bytes: buf.length,
    printable: Math.round(pr * 100) / 100,
    preview: text.slice(0, 160),
    payload: pr > 0.9 ? text : undefined,
  });
}

export function decodeTimingGaps(gapsMs: number[]): TimingResult {
  const levels = { low: 0, high: 0, zeroish: 0 };
  for (const g of gapsMs) {
    if (g < 8) levels.zeroish++;
    else if (g < 75) levels.low++;
    else levels.high++;
  }
  const res: TimingResult = { samples: gapsMs.length, levels, decoded: [] };

  const seq = gapsMs.map((g) => (g < 8 ? "Z" : g < 75 ? "L" : "H")).join("");
  const noZ = seq.replace(/Z/g, "");

  // 1. plain binary (L=0, H=1) and inverted
  tryPush("binary L=0,H=1", noZ.split("").map((c) => (c === "L" ? 0 : 1)), res.decoded);
  tryPush("binary L=1,H=0", noZ.split("").map((c) => (c === "L" ? 1 : 0)), res.decoded);

  // 2. Manchester pairs (LH / HL) — the winning model for the original challenge
  for (const inv of [false, true]) {
    const bits: number[] = [];
    let ok = true;
    for (let i = 0; i + 1 < noZ.length; i += 2) {
      const p = noZ.slice(i, i + 2);
      if (p === "LH") bits.push(inv ? 1 : 0);
      else if (p === "HL") bits.push(inv ? 0 : 1);
      else { ok = false; break; }
    }
    if (ok) tryPush(`manchester ${inv ? "HL=0,LH=1" : "LH=0,HL=1"}`, bits, res.decoded);
  }

  // 3. burst counts (Z runs between gaps) — symbol = packets per burst
  if (levels.zeroish > 0) {
    const bursts: number[] = [];
    let cur = 1;
    for (const g of gapsMs) {
      if (g < 8) cur++;
      else { bursts.push(cur); cur = 1; }
    }
    bursts.push(cur);
    if (bursts.length > 16) {
      const mx = Math.max(...bursts);
      const nbits = Math.max(1, Math.ceil(Math.log2(Math.max(2, mx))));
      const bits: number[] = [];
      for (const b of bursts) for (let k = nbits - 1; k >= 0; k--) bits.push((b >> k) & 1);
      tryPush(`burst-count ${nbits}b/symbol`, bits, res.decoded);
    }
  }

  // 4. pair-differential (L=0 H=1 read as 2-bit pairs)
  if (noZ.length >= 8 && noZ.length % 2 === 0) {
    const bits: number[] = [];
    for (let i = 0; i < noZ.length; i += 2) {
      bits.push(noZ[i] === "L" ? 0 : 1, noZ[i + 1] === "L" ? 0 : 1);
    }
    tryPush("2bit-pairs L=00,H=01", bits, res.decoded);
  }

  res.decoded.sort((a, b) => b.printable - a.printable || b.bytes - a.bytes);
  res.best = res.decoded[0]?.model;
  return res;
}
