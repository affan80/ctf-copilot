import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CTF Copilot — AI Challenge Solver + MCP Server",
  description:
    "All-in-one CTF platform: auto-triage solver, multi-LLM ensemble (GPT/Claude/Gemini/DeepSeek/Groq/Ollama), 20+ hacking tools, MCP server, and write-up generation.",
  keywords: ["CTF", "MCP", "capture the flag", "AI solver", "cryptography", "forensics"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
