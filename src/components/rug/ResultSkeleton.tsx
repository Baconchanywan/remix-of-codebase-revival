/** Placeholder shown while a token is being analyzed. Matches the result layout so the swap doesn't jump. */
export function ResultSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Analyzing token…</span>
      <div className="rounded-xl border border-border bg-card/80 p-5">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-4">
              <div className="size-14 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-7 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-panel px-3 py-3">
                  <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4">
            <div className="h-[116px] w-full animate-pulse rounded-t-full bg-muted" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card/80 p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card/80 p-5"
          >
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-5 space-y-4">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
