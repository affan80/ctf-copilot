export interface Finding {
  skill: string;
  title: string;
  detail: string;
  confidence: number;
  payload?: string;
}

export interface SolverReport {
  inputLength: number;
  flags: string[];
  findings: Finding[];
  recon: string[];
  summary: string;
}

export interface Challenge {
  id: string;
  title: string;
  url: string | null;
  category: string;
  points: number;
  description: string;
  hints: string;
  attachments: string;
  solution: string;
  flag: string;
  status: string;
  createdAt: string;
  writeups?: { id: string; title: string }[];
}

export interface LlmConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  hasKey: boolean;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface ProviderDef {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  defaultBaseUrl: string;
  apiStyle: string;
  docsUrl: string;
  keyPrefix?: string;
}

export interface LlmReply {
  provider: string;
  model: string;
  ok: boolean;
  content: string;
  error?: string;
  latencyMs: number;
}

export interface Writeup {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  challenge?: { title: string; category: string; points: number };
}
