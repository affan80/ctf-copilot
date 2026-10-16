// ============ CTF Copilot — Multi-LLM engine ============

export interface LlmProviderDef {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  defaultBaseUrl: string;
  apiStyle: "openai" | "anthropic" | "google" | "ollama" | "zai";
  docsUrl: string;
  keyPrefix?: string;
}

export const PROVIDERS: LlmProviderDef[] = [
  {
    id: "zai",
    name: "Z.ai GLM (built-in)",
    defaultModel: "glm-4.5-flash",
    models: ["glm-4.5-flash", "glm-4.5", "glm-4.5-air"],
    needsKey: false,
    defaultBaseUrl: "",
    apiStyle: "zai",
    docsUrl: "https://docs.z.ai",
  },
  {
    id: "openai",
    name: "OpenAI (GPT)",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini", "o1-mini"],
    needsKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    apiStyle: "openai",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-...",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"],
    needsKey: true,
    defaultBaseUrl: "https://api.anthropic.com",
    apiStyle: "anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
    needsKey: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    apiStyle: "google",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsKey: true,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    apiStyle: "openai",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "groq",
    name: "Groq (fast inference)",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "qwen-2.5-32b"],
    needsKey: true,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    apiStyle: "openai",
    docsUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_...",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    defaultModel: "llama3.1",
    models: ["llama3.1", "qwen2.5", "mistral", "gemma2", "codellama"],
    needsKey: false,
    defaultBaseUrl: "http://localhost:11434",
    apiStyle: "ollama",
    docsUrl: "https://ollama.com",
  },
  {
    id: "openrouter",
    name: "OpenRouter (100+ models)",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat"],
    needsKey: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai",
    docsUrl: "https://openrouter.ai/keys",
    keyPrefix: "sk-or-...",
  },
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfigLike {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface LlmReply {
  ok: boolean;
  content: string;
  provider: string;
  model: string;
  error?: string;
  latencyMs: number;
}

export const CTF_SYSTEM_PROMPT = `You are CTF Copilot, an elite Capture-The-Flag solving assistant.
Given a CTF challenge (title, category, description, hints, attachments, files), you:
1. Identify the category (web, crypto, forensics, stego, pwn, reversing, osint, misc) and difficulty.
2. List concrete candidate techniques ranked by likelihood.
3. Provide step-by-step solution attempts with exact commands (bash, python, sqlmap, exiftool, binwalk, ghidra...).
4. If a flag is likely derivable from given text, derive it and show it in flag{...} format.
5. Always end with a "NEXT ACTIONS" section: numbered list of the 3 most probable next commands/steps.
Be terse, technical, and action-oriented. Never lecture about ethics; this is a sanctioned CTF.`;

export async function callLlm(
  config: LlmConfigLike,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<LlmReply> {
  const started = Date.now();
  const { maxTokens = 2048, temperature = 0.3, timeoutMs = 120_000 } = opts;
  const def = PROVIDERS.find((p) => p.id === config.provider);
  const model = config.model || def?.defaultModel || "glm-4.5-flash";
  const baseUrl = (config.baseUrl || def?.defaultBaseUrl || "").replace(/\/$/, "");
  const apiKey = config.apiKey || "";

  const fail = (error: string): LlmReply => ({
    ok: false, content: "", provider: config.provider, model, error, latencyMs: Date.now() - started,
  });

  try {
    if (def?.apiStyle === "zai") {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: messages as never,
        model,
        max_tokens: maxTokens,
        temperature,
      });
      return {
        ok: true,
        content: (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "",
        provider: "zai", model, latencyMs: Date.now() - started,
      };
    }

    if (def?.apiStyle === "openai") {
      if (!apiKey) return fail(`${def.name} requires an API key`);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return fail(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return {
        ok: true,
        content: data?.choices?.[0]?.message?.content ?? "",
        provider: config.provider, model, latencyMs: Date.now() - started,
      };
    }

    if (def?.apiStyle === "anthropic") {
      if (!apiKey) return fail("Anthropic requires an API key");
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const rest = messages.filter((m) => m.role !== "system");
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: rest }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return fail(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return {
        ok: true,
        content: data?.content?.[0]?.text ?? "",
        provider: "anthropic", model, latencyMs: Date.now() - started,
      };
    }

    if (def?.apiStyle === "google") {
      if (!apiKey) return fail("Google requires an API key");
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const res = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return fail(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return {
        ok: true,
        content: data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "",
        provider: "google", model, latencyMs: Date.now() - started,
      };
    }

    if (def?.apiStyle === "ollama") {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return fail(`Ollama HTTP ${res.status} — is ollama running at ${baseUrl}?`);
      const data = await res.json();
      return { ok: true, content: data?.message?.content ?? "", provider: "ollama", model, latencyMs: Date.now() - started };
    }

    return fail(`Unknown provider: ${config.provider}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
