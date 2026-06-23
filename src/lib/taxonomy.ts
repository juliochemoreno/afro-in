// Managed taxonomy (categories, tags, sizes, colors) — access + validation +
// product-relation sync. Table/column names are whitelisted via CONFIG so the
// generic endpoints never interpolate raw input into SQL.

export type TaxType = "categories" | "tags" | "sizes" | "colors";

interface TaxDef {
  columns: string[]; // editable columns (besides id)
  required: string[];
  multilang: boolean;
}

export const TAX_CONFIG: Record<TaxType, TaxDef> = {
  categories: {
    columns: ["slug", "name_es", "name_en", "name_fr", "sort_order"],
    required: ["slug", "name_es"],
    multilang: true,
  },
  tags: {
    columns: ["slug", "name_es", "name_en", "name_fr", "sort_order"],
    required: ["slug", "name_es"],
    multilang: true,
  },
  sizes: {
    columns: ["label", "sort_order"],
    required: ["label"],
    multilang: false,
  },
  colors: {
    columns: ["slug", "name_es", "name_en", "name_fr", "hex", "sort_order"],
    required: ["slug", "name_es"],
    multilang: true,
  },
};

export function isTaxType(t: unknown): t is TaxType {
  return typeof t === "string" && t in TAX_CONFIG;
}

export async function getTaxonomy(db: D1Database, t: TaxType): Promise<any[]> {
  const res = await db
    .prepare(`SELECT * FROM ${t} ORDER BY sort_order ASC, id ASC`)
    .all();
  return (res.results as any[]) || [];
}

export async function getAllTaxonomies(db: D1Database) {
  const [categories, tags, sizes, colors] = await Promise.all([
    getTaxonomy(db, "categories"),
    getTaxonomy(db, "tags"),
    getTaxonomy(db, "sizes"),
    getTaxonomy(db, "colors"),
  ]);
  return { categories, tags, sizes, colors };
}

export function validateTaxInput(t: TaxType, body: any): string | null {
  const def = TAX_CONFIG[t];
  for (const r of def.required) {
    if (!body?.[r] || !String(body[r]).trim())
      return `El campo "${r}" es obligatorio`;
  }
  if ((t === "categories" || t === "tags" || t === "colors") && body.slug) {
    if (!/^[a-z0-9-]+$/.test(String(body.slug)))
      return "Slug inválido (minúsculas, números y guiones)";
  }
  return null;
}

// Build the bind values for a taxonomy row in CONFIG column order.
export function taxValues(t: TaxType, body: any): any[] {
  return TAX_CONFIG[t].columns.map((c) => {
    if (c === "sort_order") return Math.trunc(Number(body[c]) || 0);
    const v = body[c];
    return v === undefined || v === null ? "" : String(v).trim();
  });
}

// Whitelisted product-relation join tables.
const JOINS: Record<string, { table: string; col: string }> = {
  tags: { table: "product_tags", col: "tag_id" },
  sizes: { table: "product_sizes", col: "size_id" },
  colors: { table: "product_colors", col: "color_id" },
};

// Replace a product's many-to-many relation with the given ids.
export async function syncProductRelation(
  db: D1Database,
  rel: "tags" | "sizes" | "colors",
  productId: number,
  ids: number[]
): Promise<void> {
  const j = JOINS[rel];
  await db
    .prepare(`DELETE FROM ${j.table} WHERE product_id = ?`)
    .bind(productId)
    .run();
  const clean = Array.from(
    new Set((ids || []).map((n) => Math.trunc(Number(n))).filter(Boolean))
  );
  for (const id of clean) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO ${j.table} (product_id, ${j.col}) VALUES (?, ?)`
      )
      .bind(productId, id)
      .run();
  }
}

// Read a product's related ids (for the edit form).
export async function getProductRelations(
  db: D1Database,
  productId: number
): Promise<{ tags: number[]; sizes: number[]; colors: number[] }> {
  const [t, s, c] = await Promise.all([
    db.prepare("SELECT tag_id AS id FROM product_tags WHERE product_id = ?").bind(productId).all(),
    db.prepare("SELECT size_id AS id FROM product_sizes WHERE product_id = ?").bind(productId).all(),
    db.prepare("SELECT color_id AS id FROM product_colors WHERE product_id = ?").bind(productId).all(),
  ]);
  const ids = (r: any) => ((r.results as any[]) || []).map((x) => Number(x.id));
  return { tags: ids(t), sizes: ids(s), colors: ids(c) };
}
