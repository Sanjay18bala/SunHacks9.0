"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { Tick, type Mood } from "@/components/tick";

type Message = { role: "user" | "assistant"; content: string; mood?: Mood; error?: boolean };

const GREETING: Message = {
  role: "assistant",
  content: "Hey, I'm Tick. Ask me how a coin is doing, why the desk traded, or how your paper book looks.",
  mood: "bull",
};

export function AskTick({ deskSecret, coin }: { deskSecret: string; coin: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const suggestions = [
    coin ? `How is ${coin} doing today?` : "How is Bitcoin doing today?",
    "Which coin has the strongest mood right now?",
    "How is my paper portfolio doing?",
    "Why did the desk make its last trade?",
  ];

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    const history: Message[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(deskSecret ? { "x-desk-secret": deskSecret } : {}) },
        body: JSON.stringify({
          // The greeting is local UI copy; real history starts with the first question.
          messages: history.filter((m) => m !== GREETING && !m.error).map(({ role, content: c }) => ({ role, content: c })),
        }),
      });
      const body = (await response.json()) as { reply?: string; mood?: Mood; error?: string };
      setMessages((current) => [
        ...current,
        response.ok && body.reply
          ? { role: "assistant", content: body.reply, mood: body.mood ?? "neutral" }
          : { role: "assistant", content: body.error ?? "I couldn't answer that. Try again in a moment.", error: true },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I lost the connection. Try again in a moment.", error: true },
      ]);
    } finally {
      setThinking(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 flex items-center gap-2.5 rounded-full border border-line bg-bg py-2 pr-5 pl-2 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Tick mood="neutral" size={36} />
        Ask Tick
      </button>
    );
  }

  return (
    <section
      aria-label="Ask Tick"
      className="tick-pop fixed inset-x-3 bottom-3 z-30 flex max-h-[min(640px,calc(100dvh-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px]"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Tick mood={thinking ? "scan" : (messages.at(-1)?.mood ?? "neutral")} size={40} />
        <div className="flex flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold">Ask Tick</span>
          <span className="text-xs text-muted">{thinking ? "Reading the desk and X…" : "Paper desk analyst · not financial advice"}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-panel hover:text-fg"
        >
          <X size={18} />
        </button>
      </header>

      <div ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <p key={index} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-fg px-3.5 py-2.5 text-sm leading-6 text-bg">
              {message.content}
            </p>
          ) : (
            <div key={index} className="flex max-w-[92%] items-end gap-2">
              <Tick mood={message.mood ?? "neutral"} size={26} />
              <p
                className={`rounded-2xl rounded-bl-md bg-panel px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap ${message.error ? "text-down" : ""}`}
              >
                {message.content}
              </p>
            </div>
          ),
        )}
        {thinking ? (
          <div className="flex items-end gap-2">
            <Tick mood="scan" size={26} />
            <span className="flex gap-1 rounded-2xl rounded-bl-md bg-panel px-4 py-3.5" aria-label="Tick is typing">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </div>
        ) : null}
        {messages.length === 1 ? (
          <div className="flex flex-col gap-2 pt-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="self-start rounded-full border border-line px-3.5 py-1.5 text-left text-sm text-soft transition-colors hover:border-fg hover:text-fg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label htmlFor="ask-tick-input" className="sr-only">
          Ask Tick a question
        </label>
        <textarea
          id="ask-tick-input"
          ref={input}
          rows={1}
          maxLength={1500}
          value={draft}
          placeholder="Ask about a coin or your book…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-dim"
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition-opacity disabled:opacity-30"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </section>
  );
}
