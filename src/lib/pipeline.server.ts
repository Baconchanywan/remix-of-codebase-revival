import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fundersBody,
  knownBadBody,
  knownBadCandidatesQuery,
  labelsBody,
  limitQuery,
  snapshotsBody,
  tokensBody,
  watchlistAlertsQuery,
  watchlistBody,
  watchlistRemoveBody,
} from "./pipeline-schemas";

type Method = "GET" | "POST";
type Handler = (ctx: { url: URL; body: unknown }) => Promise<Response>;

const PAGE = 1000;

function fail(status: number, error: string, details?: unknown) {
  return Response.json({ error, ...(details ? { details } : {}) }, { status });
}

function dbFail(op: string, error: { message: string; code?: string }) {
  console.error(`pipeline ${op} failed`, error.code, error.message);
  return fail(500, `Database error during ${op}`, { message: error.message, code: error.code });
}

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> | Response {
  const result = schema.safeParse(value);
  if (!result.success) return fail(400, "Invalid request", z.treeifyError(result.error));
  return result.data;
}

const handlers: Record<string, { method: Method; run: Handler }> = {
  ping: {
    method: "GET",
    run: async () => Response.json({ ok: true, time: new Date().toISOString() }),
  },

  /** W1: insert discovered tokens; existing mints are left untouched. */
  tokens: {
    method: "POST",
    run: async ({ body }) => {
      const rows = parse(tokensBody, body);
      if (rows instanceof Response) return rows;
      const { data, error } = await supabaseAdmin
        .from("tokens")
        .upsert(rows, { onConflict: "mint", ignoreDuplicates: true })
        .select("mint");
      if (error) return dbFail("tokens", error);
      return Response.json({ received: rows.length, inserted: data?.length ?? 0 });
    },
  },

  /** W2: tokens whose one-hour snapshot is due. */
  "snapshots-due": {
    method: "GET",
    run: async ({ url }) => {
      const limit = limitQuery(25, 100).parse(url.searchParams.get("limit") ?? undefined);
      const { data, error } = await supabaseAdmin
        .from("tokens")
        .select("mint, launch_time, launch_time_source, creator")
        .lte("snapshot_due_at", new Date().toISOString())
        .is("last_snapshot_at", null)
        .order("snapshot_due_at")
        .limit(limit);
      if (error) return dbFail("snapshots-due", error);
      return Response.json(data ?? []);
    },
  },

  /** W2: store one-hour snapshots and mark the tokens as snapshotted. */
  snapshots: {
    method: "POST",
    run: async ({ body }) => {
      const rows = parse(snapshotsBody, body);
      if (rows instanceof Response) return rows;
      const mints = rows.map((r) => r.mint);
      const known = await supabaseAdmin.from("tokens").select("mint").in("mint", mints);
      if (known.error) return dbFail("snapshots", known.error);
      const knownSet = new Set((known.data ?? []).map((r) => r.mint));
      const missing = mints.filter((m) => !knownSet.has(m));
      if (missing.length > 0) return fail(422, "Unknown token mint(s); insert them via /tokens first", { missing });
      const { data, error } = await supabaseAdmin
        .from("snapshots")
        .upsert(
          rows.map((r) => ({ ...r, raw_provider_refs: r.raw_provider_refs as never })),
          { onConflict: "mint", ignoreDuplicates: true },
        )
        .select("mint");
      if (error) return dbFail("snapshots", error);
      const mark = await supabaseAdmin
        .from("tokens")
        .update({ last_snapshot_at: new Date().toISOString() })
        .in("mint", mints);
      if (mark.error) return dbFail("snapshots", mark.error);
      return Response.json({ received: rows.length, inserted: data?.length ?? 0 });
    },
  },

  /** W3: tokens at least 30 days old whose outcome has not been checked. */
  "outcomes-due": {
    method: "GET",
    run: async ({ url }) => {
      const limit = limitQuery(100, 250).parse(url.searchParams.get("limit") ?? undefined);
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("tokens")
        .select("mint, launch_time, launch_time_source")
        .lte("launch_time", cutoff)
        .is("outcome_checked_at", null)
        .order("launch_time")
        .limit(limit);
      if (error) return dbFail("outcomes-due", error);
      return Response.json(data ?? []);
    },
  },

  /** W3: write (or re-write) outcome labels and mark tokens as checked. */
  labels: {
    method: "POST",
    run: async ({ body }) => {
      const rows = parse(labelsBody, body);
      if (rows instanceof Response) return rows;
      const now = new Date().toISOString();
      const mints = rows.map((r) => r.mint);
      const known = await supabaseAdmin.from("tokens").select("mint").in("mint", mints);
      if (known.error) return dbFail("labels", known.error);
      const knownSet = new Set((known.data ?? []).map((r) => r.mint));
      const missing = mints.filter((m) => !knownSet.has(m));
      if (missing.length > 0) return fail(422, "Unknown token mint(s); insert them via /tokens first", { missing });
      const { error } = await supabaseAdmin
        .from("labels")
        .upsert(rows.map((r) => ({ ...r, labelled_at: now })), { onConflict: "mint" });
      if (error) return dbFail("labels", error);
      const mark = await supabaseAdmin.from("tokens").update({ outcome_checked_at: now }).in("mint", mints);
      if (mark.error) return dbFail("labels", mark.error);
      return Response.json({ received: rows.length, saved: rows.length });
    },
  },

  /** W4 input: Helius-derived funder counts. */
  funders: {
    method: "POST",
    run: async ({ body }) => {
      const rows = parse(fundersBody, body);
      if (rows instanceof Response) return rows;
      const { error } = await supabaseAdmin
        .from("rug_creator_funders")
        .upsert(rows, { onConflict: "funder_address" });
      if (error) return dbFail("funders", error);
      return Response.json({ received: rows.length, saved: rows.length });
    },
  },

  /** W4: creators of rugged tokens plus funders of 2+ rugged creators. */
  "known-bad-candidates": {
    method: "GET",
    run: async ({ url }) => {
      const q = parse(knownBadCandidatesQuery, Object.fromEntries(url.searchParams));
      if (q instanceof Response) return q;
      const out: { address: string; address_type: string }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
          .rpc("pipeline_known_bad_candidates", {
            ...(q.before ? { _before: q.before } : {}),
            _min_funder_count: q.min_funder_count,
          })
          .range(from, from + PAGE - 1);
        if (error) return dbFail("known-bad-candidates", error);
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return Response.json(out);
    },
  },

  /** W4: atomically replace the published known-bad list. */
  "known-bad": {
    method: "POST",
    run: async ({ body }) => {
      const b = parse(knownBadBody, body);
      if (b instanceof Response) return b;
      const { data, error } = await supabaseAdmin.rpc("pipeline_replace_known_bad", {
        _creators: b.creators.map((a) => a.toLowerCase()),
        _funders: b.funders.map((a) => a.toLowerCase()),
        _generated_from: b.generated_from,
        _generated_at: b.generated_at,
      });
      if (error) return dbFail("known-bad", error);
      return Response.json({ published: data ?? 0 });
    },
  },

  /** Add or refresh watched tokens. */
  watchlist: {
    method: "POST",
    run: async ({ body }) => {
      const rows = parse(watchlistBody, body);
      if (rows instanceof Response) return rows;
      const { error } = await supabaseAdmin.from("watchlist").upsert(rows, { onConflict: "mint" });
      if (error) return dbFail("watchlist", error);
      return Response.json({ received: rows.length, saved: rows.length });
    },
  },

  "watchlist-remove": {
    method: "POST",
    run: async ({ body }) => {
      const mints = parse(watchlistRemoveBody, body);
      if (mints instanceof Response) return mints;
      const { data, error } = await supabaseAdmin.from("watchlist").delete().in("mint", mints).select("mint");
      if (error) return dbFail("watchlist-remove", error);
      return Response.json({ removed: data?.length ?? 0 });
    },
  },

  /** W6: watched tokens whose trust or liquidity dropped materially. */
  "watchlist-alerts": {
    method: "GET",
    run: async ({ url }) => {
      const q = parse(watchlistAlertsQuery, Object.fromEntries(url.searchParams));
      if (q instanceof Response) return q;
      const { data, error } = await supabaseAdmin.rpc("pipeline_watchlist_alerts", {
        _trust_drop: q.trust_drop,
        _liquidity_drop: q.liquidity_drop,
      });
      if (error) return dbFail("watchlist-alerts", error);
      return Response.json(data ?? []);
    },
  },

  /** Training export for ml/train.py: one JSON object per line. */
  "training-data": {
    method: "GET",
    run: async () => {
      const lines: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin.rpc("pipeline_training_rows").range(from, from + PAGE - 1);
        if (error) return dbFail("training-data", error);
        for (const row of data ?? []) lines.push(JSON.stringify(row));
        if (!data || data.length < PAGE) break;
      }
      return new Response(lines.length ? lines.join("\n") + "\n" : "", {
        headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      });
    },
  },
};

export const PIPELINE_OPS = Object.keys(handlers);

export async function handlePipelineRequest(op: string, request: Request): Promise<Response> {
  const handler = handlers[op];
  if (!handler) return fail(404, `Unknown operation "${op}"`, { operations: PIPELINE_OPS });
  if (request.method !== handler.method) {
    return new Response(JSON.stringify({ error: `Use ${handler.method} for ${op}` }), {
      status: 405,
      headers: { allow: handler.method, "content-type": "application/json" },
    });
  }
  let body: unknown = undefined;
  if (handler.method === "POST") {
    try {
      body = await request.json();
    } catch {
      return fail(400, "Body must be valid JSON");
    }
  }
  try {
    return await handler.run({ url: new URL(request.url), body });
  } catch (err) {
    console.error(`pipeline ${op} crashed`, err);
    return fail(500, `Unexpected error during ${op}`);
  }
}
