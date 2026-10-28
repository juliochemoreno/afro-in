// Generates src/data/divipola.json: Colombia's departments and municipalities.
// Source: DANE DIVIPOLA on datos.gov.co (dataset gdxc-w37w), official open data.
// Run: node scripts/gen-divipola.mjs  (re-run only when DANE updates the list)
import { writeFileSync } from "node:fs";

const SOURCE = "https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000";
const OUT = new URL("../src/data/divipola.json", import.meta.url);

// Spanish connectors stay lowercase unless they open the name.
const LOWER = new Set(["de", "del", "la", "las", "los", "y", "e", "el"]);

function titleCase(raw) {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (word === "d.c.") return "D.C.";
      if (i > 0 && LOWER.has(word)) return word;
      return word.replace(/^(\p{L})/u, (c) => c.toUpperCase());
    })
    .join(" ");
}

const rows = await (await fetch(SOURCE)).json();
const byDept = new Map();
for (const r of rows) {
  if (!byDept.has(r.cod_dpto)) {
    byDept.set(r.cod_dpto, {
      code: r.cod_dpto,
      name: titleCase(r.dpto),
      municipalities: [],
    });
  }
  byDept
    .get(r.cod_dpto)
    .municipalities.push({ code: r.cod_mpio, name: titleCase(r.nom_mpio) });
}

const departments = [...byDept.values()].sort((a, b) =>
  a.name.localeCompare(b.name, "es")
);
for (const d of departments)
  d.municipalities.sort((a, b) => a.name.localeCompare(b.name, "es"));

const total = departments.reduce((n, d) => n + d.municipalities.length, 0);
if (departments.length !== 33 || total !== 1122) {
  console.error(`Unexpected counts: ${departments.length} departments, ${total} municipalities`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(departments));
console.log(`divipola.json: ${departments.length} departments, ${total} municipalities`);
