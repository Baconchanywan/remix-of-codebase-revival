import { z } from "zod";
import { CREATOR_FEATURE_ORDER } from "./rug-model";

/** Request contracts for the n8n pipeline endpoint (/api/public/pipeline/:op). */

const address = z
  .string()
  .trim()
  .min(20)
  .max(100)
  .regex(/^[A-Za-z0-9]+$/, "must be an alphanumeric wallet or token address");
const isoTime = z.iso.datetime({ offset: true });
const optionalAddress = z
  .union([address, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** Accept a single object or an array of them (n8n sends one request per item by default). */
const oneOrMany = <T extends z.ZodType>(item: T, max: number) =>
  z.union([item, z.array(item).min(1).max(max)]).transform((v) => (Array.isArray(v) ? v : [v]) as z.output<T>[]);

export const tokenRow = z.object({
  mint: address,
  launch_time: isoTime,
  launch_time_source: z.string().trim().min(1).max(64),
  creator: optionalAddress,
  pair_address: optionalAddress,
  snapshot_due_at: isoTime,
});
export const tokensBody = oneOrMany(tokenRow, 500);

/** Every model feature must be present as a finite number — no placeholder rows. */
export const featuresSchema = z
  .record(z.string(), z.number().finite())
  .superRefine((features, ctx) => {
    for (const key of CREATOR_FEATURE_ORDER) {
      if (!(key in features)) ctx.addIssue({ code: "custom", message: `missing feature ${key}`, path: [key] });
    }
  });

export const snapshotRow = z.object({
  mint: address,
  decision_time: isoTime,
  provider_observed_at: isoTime,
  features: featuresSchema,
  raw_provider_refs: z.record(z.string(), z.unknown()).optional().default({}),
});
export const snapshotsBody = oneOrMany(snapshotRow, 100);

const nullableNumber = z.number().finite().nullable().optional().default(null);
export const labelRow = z.object({
  mint: address,
  label: z.union([z.literal(0), z.literal(1), z.null()]),
  status: z.string().trim().min(1).max(64),
  reason_code: z
    .string()
    .trim()
    .max(64)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  label_rules_version: z.string().trim().min(1).max(32),
  peak_liquidity_usd: nullableNumber,
  value_at_30d: nullableNumber,
});
export const labelsBody = oneOrMany(labelRow, 250);

export const funderRow = z.object({
  funder_address: address,
  rugged_creator_count: z.number().int().min(0).max(1_000_000),
});
export const fundersBody = oneOrMany(funderRow, 1000);

export const knownBadBody = z.object({
  creators: z.array(address).max(50_000),
  funders: z.array(address).max(50_000),
  generated_from: z.string().trim().min(1).max(64),
  generated_at: isoTime,
});

const pct = z.number().finite().min(0).max(100);
export const watchlistRow = z.object({
  mint: address,
  trust: pct,
  baseline_trust: pct,
  liquidity_drop_pct: pct.optional().default(0),
});
export const watchlistBody = oneOrMany(watchlistRow, 500);

export const watchlistRemoveBody = z.union([
  z.object({ mint: address }).transform((v) => [v.mint]),
  z.object({ mints: z.array(address).min(1).max(500) }).transform((v) => v.mints),
]);

export const limitQuery = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).catch(fallback);

export const knownBadCandidatesQuery = z.object({
  before: isoTime.optional(),
  min_funder_count: z.coerce.number().int().min(1).max(1000).optional().default(2),
});

/** Default alert thresholds: trust falls 20 points below baseline, or liquidity drops 50%. */
export const watchlistAlertsQuery = z.object({
  trust_drop: z.coerce.number().min(0).max(100).optional().default(20),
  liquidity_drop: z.coerce.number().min(0).max(100).optional().default(50),
});
