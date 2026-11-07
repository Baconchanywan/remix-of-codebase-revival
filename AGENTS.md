<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Rug-pull scoring lives in `src/lib/rug-model.ts` as a pure, browser-safe module (signals → factors → logistic score → historical case matches); keep it free of fetch/IO so it stays unit-testable in `src/test/rug-model.test.ts`.
- Pipeline tables (tokens, snapshots, labels, known_bad, rug_creator_funders, watchlist) are server-only: RLS on, no anon/authenticated grants, service_role only — they hold private wallet lists and training data, so browser code must never query them; read/write them from server functions or server routes.
- External automation (n8n, GitHub Actions) reaches the pipeline tables only through `/api/public/pipeline/$op`, authenticated by a bearer token from the `PIPELINE_API_TOKEN` secret; operations live in `src/lib/pipeline.server.ts` and request contracts in `src/lib/pipeline-schemas.ts` (pure, tested). The database itself is not reachable from outside the app.
- Live token data is fetched server-side only in `src/lib/token-data.server.ts` (DexScreener, GoPlus, RugCheck — free, keyless) and exposed via server functions in `src/lib/analyze.functions.ts`; the AI explanation is a separate server function so the score renders before the AI text.
