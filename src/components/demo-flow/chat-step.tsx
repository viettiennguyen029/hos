"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPriceRange } from "@/components/shell/listing-card";
import { DEMO_TALENT } from "@/lib/demo-flow/constants";
import { cn } from "@/lib/utils";

interface Recommendation {
  name: string;
  category: string;
  city: string;
  match: number;
  priceMin: number;
  priceMax: number;
  reason: string;
}

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text?: string;
  recommendations?: Recommendation[];
}

/** Scripted demo data — the top match mirrors DEMO_TALENT so it carries through the rest of the flow. */
const RECOMMENDATIONS: Recommendation[] = [
  {
    name: DEMO_TALENT.name,
    category: DEMO_TALENT.category,
    city: DEMO_TALENT.city,
    match: 96,
    priceMin: DEMO_TALENT.priceMin,
    priceMax: DEMO_TALENT.priceMax,
    reason: "12 wedding events in Da Nang and fits your 20M VND budget.",
  },
  {
    name: "Mai Linh",
    category: "Solo Singer – Acoustic/Pop",
    city: "Da Nang",
    match: 91,
    priceMin: 8_000_000,
    priceMax: 12_000_000,
    reason: "Highly rated for intimate wedding sets, flexible with guest count.",
  },
  {
    name: "Sunset Live Band",
    category: "Live Band – Pop/Ballad",
    city: "Da Nang",
    match: 87,
    priceMin: 18_000_000,
    priceMax: 25_000_000,
    reason: "Full band setup, popular for 150–250 guest weddings.",
  },
];

const SUGGESTED_PROMPTS = [
  "Live band for a 200-guest wedding in Da Nang, budget ~20M VND",
  "Solo acoustic singer for a corporate gala in Ha Noi",
  "DJ for a rooftop birthday party, budget ~8M VND",
];

const QUICK_REPLIES_GENRE = ["Acoustic / Pop", "EDM / Dance", "Traditional / Cultural", "No preference"];
const QUICK_REPLIES_VENUE = ["Indoor, ~100 guests", "Outdoor, ~200 guests", "Outdoor, 300+ guests", "Not sure yet"];
const QUICK_REPLIES_SONGS = ["Specific song list", "Their choice is fine", "A mix of both"];

const QUICK_REPLIES_BY_STEP: Record<number, string[]> = {
  1: QUICK_REPLIES_GENRE,
  2: QUICK_REPLIES_VENUE,
  3: QUICK_REPLIES_SONGS,
};

let messageSeq = 0;
function nextId() {
  messageSeq += 1;
  return `demo-msg-${messageSeq}`;
}

export function ChatStep() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: "bot",
      text: "Hi! I'm the HOS AI Assistant. Tell me about your event — type, guest count, location, and budget — and I'll recommend the best-matching talents for you.",
    },
  ]);
  const [step, setStep] = useState(0);
  const [thinkingLabel, setThinkingLabel] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const typing = thinkingLabel !== null;

  function appendBot(message: Omit<ChatMessage, "id" | "role">) {
    setMessages((prev) => [...prev, { id: nextId(), role: "bot", ...message }]);
  }

  function handleSend(rawText: string) {
    const text = rawText.trim();
    if (!text || typing) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");

    const { delay, label } =
      step === 0
        ? { delay: 1600, label: "Reading your event details…" }
        : step === 1
          ? { delay: 1300, label: "Noting your style preference…" }
          : step === 2
            ? { delay: 1300, label: "Checking venue logistics…" }
            : { delay: 2400, label: "Searching matching talents…" };

    setThinkingLabel(label);
    setTimeout(() => {
      setThinkingLabel(null);
      if (step === 0) {
        appendBot({ text: "Quick follow-up — what's your preferred music genre or performance style?" });
        setStep(1);
      } else if (step === 1) {
        appendBot({ text: "Got it. Is the venue indoor or outdoor, and roughly how many guests are you expecting?" });
        setStep(2);
      } else if (step === 2) {
        appendBot({ text: "Almost done — do they need to follow a specific song list, or can they choose the set?" });
        setStep(3);
      } else if (step === 3) {
        appendBot({
          text: "Thanks! Based on your event type, guest count, venue, and budget, here are the best-matching talents I found:",
        });
        appendBot({ recommendations: RECOMMENDATIONS });
        setStep(4);
      }
    }, delay);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">1. Chat with the AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Describe your event and get instant, personalized talent recommendations.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-md bg-white/5 p-6">
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {thinkingLabel && <TypingBubble label={thinkingLabel} />}
        </div>

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                className="rounded-full bg-white/5 px-4 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/10"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {QUICK_REPLIES_BY_STEP[step] && (
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES_BY_STEP[step].map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => handleSend(reply)}
                className="rounded-full bg-white/5 px-4 py-2 text-xs text-foreground transition-colors hover:bg-white/10"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {step < 4 && (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend(input);
            }}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </div>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tell the AI about your event..."
              disabled={typing}
              className="h-11 flex-1 rounded-[6px]"
            />
            <Button
              type="submit"
              aria-label="Send"
              disabled={typing || !input.trim()}
              size="icon"
              className="size-11 rounded-[6px]"
            >
              <Send className="size-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.recommendations) {
    return (
      <div className="flex flex-col gap-3">
        {message.recommendations.map((rec) => (
          <div key={rec.name} className="flex flex-col gap-2 rounded-[8px] bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{rec.name}</span>
              <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                {rec.match}% Match
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{rec.category}</span>
              <span>&middot;</span>
              <span>{rec.city}</span>
            </div>
            <p className="text-xs text-muted-foreground">{rec.reason}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-foreground">
                {formatPriceRange(rec.priceMin, rec.priceMax, "VND")}
              </span>
              <Button asChild size="sm" className="rounded-[6px]">
                <Link href="/demo/discover">View Profile</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-[8px] px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-white/10 text-foreground"
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

function TypingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-[8px] bg-white/10 px-4 py-3">
        <span className="flex items-center gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
