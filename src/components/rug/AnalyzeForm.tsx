import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchTokensFn } from "@/lib/analyze.functions";
import { EVM_ADDRESS, SOLANA_ADDRESS, type Chain } from "@/lib/rug-model";
import {
  classifyTokenInput,
  type TokenSearchResult,
} from "@/lib/token-search";

export type ChainChoice = Chain | "auto";

const CHAINS: { value: ChainChoice; label: string; searchable: boolean }[] = [
  { value: "auto", label: "Auto", searchable: true },
  { value: "ethereum", label: "Ethereum", searchable: false },
  { value: "bsc", label: "BNB", searchable: false },
  { value: "solana", label: "Solana", searchable: true },
];

const EXAMPLES: { label: string; address: string; chain: ChainChoice }[] = [
  {
    label: "BONK · SOL",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    chain: "solana",
  },
  {
    label: "PEPE · ETH",
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    chain: "ethereum",
  },
  {
    label: "CAKE · BNB",
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    chain: "bsc",
  },
];

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function AnalyzeForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (address: string, chain: ChainChoice) => void;
}) {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState<ChainChoice>("auto");
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const listId = useId();

  // Pasted links, stray punctuation and invisible characters still resolve to the address;
  // half-typed addresses get a hint instead of being sent to name search.
  const parsed = classifyTokenInput(input);
  const searchText = parsed.kind === "search" ? parsed.query : "";
  const isSearching = parsed.kind === "search";
  const debouncedQuery = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const searchEnabled = isSearching && debouncedQuery === searchText;

  const search = useServerFn(searchTokensFn);
  const searchQuery = useQuery({
    queryKey: ["token-search", debouncedQuery],
    enabled: searchEnabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const res = await search({ data: { query: debouncedQuery } });
      if (!res.ok) throw new Error(res.error);
      return res.results;
    },
  });

  const results: TokenSearchResult[] =
    searchEnabled && searchQuery.data ? searchQuery.data : [];
  const showDropdown = focused && isSearching;

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const submitAddress = (addr: string, ch: ChainChoice) => {
    if (!EVM_ADDRESS.test(addr) && !SOLANA_ADDRESS.test(addr)) {
      setError(
        "Paste a full contract address (0x… for Ethereum/BNB, or a Solana mint address).",
      );
      return;
    }
    if (ch === "solana" && EVM_ADDRESS.test(addr)) {
      setError(
        "That's an Ethereum/BNB address — switch the chain or pick Auto.",
      );
      return;
    }
    if ((ch === "ethereum" || ch === "bsc") && !EVM_ADDRESS.test(addr)) {
      setError("Ethereum and BNB Chain addresses start with 0x.");
      return;
    }
    setError(null);
    setFocused(false);
    onSubmit(addr, ch);
  };

  const selectResult = (r: TokenSearchResult) => {
    setInput(r.address);
    setChain("solana");
    submitAddress(r.address, "solana");
  };

  const handle = (e: FormEvent) => {
    e.preventDefault();
    if (isSearching) {
      const selected = activeIndex >= 0 ? results[activeIndex] : undefined;
      if (selected) {
        selectResult(selected);
      } else {
        setError("Pick a token from the list, or paste its contract address.");
      }
      return;
    }
    if (parsed.kind === "partial") {
      setError(parsed.message);
      return;
    }
    if (parsed.kind === "address") {
      if (parsed.extracted) setInput(parsed.address);
      submitAddress(parsed.address, chain);
      return;
    }
    submitAddress(input.trim(), chain);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setFocused(false);
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  return (
    <form onSubmit={handle} className="w-full">
      <div
        className="mb-3 flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Blockchain"
      >
        {CHAINS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={chain === c.value}
            onClick={() => setChain(c.value)}
            title={
              c.searchable
                ? undefined
                : "Name search not available yet — paste a contract address"
            }
            className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
              chain === c.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            } ${c.searchable ? "" : "line-through decoration-2"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-input bg-panel p-2 focus-within:border-primary/70 sm:flex-row">
          {loading && (
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-scan bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
          )}
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Search by token name or symbol, or paste a contract address…"
            aria-label="Token name, symbol, or contract address"
            aria-autocomplete="list"
            aria-controls={
              showDropdown && results.length > 0 ? listId : undefined
            }
            aria-expanded={showDropdown && results.length > 0}
            aria-activedescendant={
              showDropdown && activeIndex >= 0
                ? `${listId}-${activeIndex}`
                : undefined
            }
            role="combobox"
            spellCheck={false}
            autoComplete="off"
            maxLength={400}
            className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <Button
            type="submit"
            variant="signal"
            size="lg"
            disabled={loading}
            className="h-12 transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ScanSearch />}
            {loading ? "Scanning" : "Analyze"}
          </Button>
        </div>

        {showDropdown && (
          <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
            {(!searchEnabled || searchQuery.isFetching) &&
              results.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Searching Solana tokens…
                </p>
              )}
            {searchEnabled && searchQuery.isError && (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-destructive">
                  Name search isn't available right now. You can still paste
                  the token's full contract address.
                </p>
                <Button
                  type="button"
                  variant="chip"
                  size="sm"
                  onClick={() => searchQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
            {searchEnabled &&
              !searchQuery.isFetching &&
              !searchQuery.isError &&
              results.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No Solana tokens match “{searchText}”.
                </p>
              )}
            {results.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Token search results">
                {results.map((r, i) => (
                  <li
                    key={r.address}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectResult(r);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-3 ${
                      i === activeIndex ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {r.symbol}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {r.name}
                        </span>
                      </div>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {r.address}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-primary">
                        SOL
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {r.liquidityUsd !== null
                          ? `$${Math.round(r.liquidityUsd).toLocaleString()} liq`
                          : "liq n/a"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : parsed.kind === "partial" ? (
        <p className="mt-2 text-sm text-muted-foreground">{parsed.message}</p>
      ) : parsed.kind === "address" && parsed.extracted ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Found address {parsed.address.slice(0, 6)}…{parsed.address.slice(-4)} in what you pasted.
        </p>
      ) : null}

      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Ethereum and BNB Chain search hasn't been implemented yet. Search
        currently covers Solana tokens.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Try
        </span>
        {EXAMPLES.map((ex) => (
          <Button
            key={ex.address}
            type="button"
            variant="chip"
            size="sm"
            disabled={loading}
            onClick={() => {
              setInput(ex.address);
              setChain(ex.chain);
              submitAddress(ex.address, ex.chain);
            }}
          >
            {ex.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
