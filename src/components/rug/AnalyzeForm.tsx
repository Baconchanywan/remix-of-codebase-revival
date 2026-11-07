import { useState, type FormEvent } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVM_ADDRESS, SOLANA_ADDRESS, type Chain } from "@/lib/rug-model";

export type ChainChoice = Chain | "auto";

const CHAINS: { value: ChainChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "ethereum", label: "Ethereum" },
  { value: "bsc", label: "BNB" },
  { value: "solana", label: "Solana" },
];

const EXAMPLES: { label: string; address: string; chain: ChainChoice }[] = [
  { label: "BONK · SOL", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", chain: "solana" },
  { label: "PEPE · ETH", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", chain: "ethereum" },
  { label: "CAKE · BNB", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", chain: "bsc" },
];

export function AnalyzeForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (address: string, chain: ChainChoice) => void;
}) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<ChainChoice>("auto");
  const [error, setError] = useState<string | null>(null);

  const submit = (addr: string, ch: ChainChoice) => {
    const a = addr.trim();
    if (!EVM_ADDRESS.test(a) && !SOLANA_ADDRESS.test(a)) {
      setError("Paste a full contract address (0x… for Ethereum/BNB, or a Solana mint address).");
      return;
    }
    if (ch === "solana" && EVM_ADDRESS.test(a)) {
      setError("That's an Ethereum/BNB address — switch the chain or pick Auto.");
      return;
    }
    if ((ch === "ethereum" || ch === "bsc") && !EVM_ADDRESS.test(a)) {
      setError("Ethereum and BNB Chain addresses start with 0x.");
      return;
    }
    setError(null);
    onSubmit(a, ch);
  };

  const handle = (e: FormEvent) => {
    e.preventDefault();
    submit(address, chain);
  };

  return (
    <form onSubmit={handle} className="w-full">
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Blockchain">
        {CHAINS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={chain === c.value}
            onClick={() => setChain(c.value)}
            className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
              chain === c.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-input bg-panel p-2 focus-within:border-primary/70 sm:flex-row">
        {loading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-scan bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Paste token contract address…"
          aria-label="Token contract address"
          spellCheck={false}
          autoComplete="off"
          maxLength={64}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <Button type="submit" variant="signal" size="lg" disabled={loading} className="h-12">
          {loading ? <Loader2 className="animate-spin" /> : <ScanSearch />}
          {loading ? "Scanning" : "Analyze"}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Try</span>
        {EXAMPLES.map((ex) => (
          <Button
            key={ex.address}
            type="button"
            variant="chip"
            size="sm"
            disabled={loading}
            onClick={() => {
              setAddress(ex.address);
              setChain(ex.chain);
              submit(ex.address, ex.chain);
            }}
          >
            {ex.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
