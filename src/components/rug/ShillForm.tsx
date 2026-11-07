import { useState, type FormEvent } from "react";
import { Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Telegram pump call",
    text:
      "🚀🚀 $BONK about to EXPLODE 100x GUARANTEED!! Binance listing confirmed for tonight 🔥 Only 2 hours left to get in before the pump, don't tell anyone, this is insider alpha. I turned $200 into $14k last week 💰 CA: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  {
    label: "Group chat ticker",
    text: "yo everyone in my lecture is buying $PEPE rn 😭 10,000 new holders in an hour, last chance before it moons 🌕 not financial advice but you'd be dumb not to",
  },
];

export function ShillForm({ loading, onSubmit }: { loading: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (t: string) => {
    const v = t.trim();
    if (v.length < 3) {
      setError("Paste the message, post or link you were sent.");
      return;
    }
    setError(null);
    onSubmit(v);
  };

  const handle = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  return (
    <form onSubmit={handle} className="w-full">
      <div className="relative overflow-hidden rounded-xl border border-input bg-panel p-2 focus-within:border-primary/70">
        {loading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-scan bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the Telegram / Discord / X message or link someone sent you…"
          aria-label="Promotion message"
          rows={4}
          maxLength={5000}
          className="w-full resize-y bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <div className="flex justify-end">
          <Button type="submit" variant="signal" size="lg" disabled={loading} className="h-12">
            {loading ? <Loader2 className="animate-spin" /> : <MessageSquareWarning />}
            {loading ? "Reading" : "Check this pitch"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Try</span>
        {EXAMPLES.map((ex) => (
          <Button
            key={ex.label}
            type="button"
            variant="chip"
            size="sm"
            disabled={loading}
            onClick={() => {
              setText(ex.text);
              submit(ex.text);
            }}
          >
            {ex.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
