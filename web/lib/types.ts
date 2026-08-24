/**
 * Types shared between the server-only data layer and client components.
 *
 * A separate module because lib/data.ts imports node:fs and hyparquet, so a
 * client component cannot import from it even for a type. Keeping the shapes
 * here means the interactive map and the build-time reader agree on them.
 */

export type Unit = {
  unit_id: string;
  unit_kind: string;
  symbol: string | null;
  name_en: string;
  currency_code: string | null;
  price_basis: string | null;
};
