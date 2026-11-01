import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bogotaToday,
  nowBogotaWallClock,
  publicSale,
  resolveSale,
  stageName,
  stageStatuses,
  validateStages,
  type StageWithSales,
} from "../src/lib/ticketStages.ts";

// The 2027 presale shape: 50 / 150 / 150 tickets.
function stages(sales: [number, number][] = [[0, 0], [0, 0], [0, 0]]): StageWithSales[] {
  const base = [
    { id: 1, name_es: "Preventa 1", price: 20000, capacity: 50, starts_on: "2026-11-01", ends_on: "2026-11-15" },
    { id: 2, name_es: "Preventa 2", price: 35000, capacity: 150, starts_on: "2026-11-16", ends_on: "2026-12-16" },
    { id: 3, name_es: "General", price: 45000, capacity: 150, starts_on: "2026-12-17", ends_on: null },
  ];
  return base.map((s, i) => ({
    ...s,
    event_id: 7,
    name_en: null,
    name_fr: null,
    sold: sales[i][0],
    held: sales[i][1],
  }));
}

const statuses = (list: StageWithSales[], today: string) =>
  stageStatuses(list, today).map((s) => s.status);

test("Bogotá dates are UTC minus five hours", () => {
  assert.equal(bogotaToday(new Date("2026-11-16T04:59:59Z")), "2026-11-15");
  assert.equal(bogotaToday(new Date("2026-11-16T05:00:00Z")), "2026-11-16");
  assert.equal(nowBogotaWallClock(Date.parse("2027-01-15T01:30:00Z")), "2027-01-14T20:30:00");
});

test("before the first stage, sales are not open yet", () => {
  const sale = resolveSale(stages(), "2026-10-31");
  assert.equal(sale.state, "upcoming");
  assert.equal(sale.state === "upcoming" && sale.opensOn, "2026-11-01");
  assert.deepEqual(statuses(stages(), "2026-10-31"), ["upcoming", "upcoming", "upcoming"]);
});

test("inside a stage's dates, that stage is current", () => {
  const sale = resolveSale(stages([[10, 0], [0, 0], [0, 0]]), "2026-11-01");
  assert.equal(sale.state, "current");
  if (sale.state !== "current") return;
  assert.equal(sale.stage.id, 1);
  assert.equal(sale.stage.price, 20000);
  assert.equal(sale.remaining, 40);
  // Last day of stage 1 is inclusive.
  assert.equal(resolveSale(stages(), "2026-11-15").state === "current" && 1, 1);
});

test("a sold-out stage opens the next one before its date", () => {
  const list = stages([[50, 0], [0, 0], [0, 0]]);
  const sale = resolveSale(list, "2026-11-05");
  assert.equal(sale.state === "current" && sale.stage.id, 2);
  assert.deepEqual(statuses(list, "2026-11-05"), ["soldout", "current", "upcoming"]);
});

test("an early-opened stage keeps its own end date", () => {
  // Stage 2 opened early on 5 Nov and still has tickets after its end date:
  // it ends on 16 Dec anyway and stage 3 takes over by date.
  const list = stages([[50, 0], [20, 0], [0, 0]]);
  const sale = resolveSale(list, "2026-12-17");
  assert.equal(sale.state === "current" && sale.stage.id, 3);
  // Stage 2 sold out too: stage 3 opens early as well.
  const both = resolveSale(stages([[50, 0], [150, 0], [0, 0]]), "2026-11-20");
  assert.equal(both.state === "current" && both.stage.id, 3);
});

test("a stage ended by date loses its leftovers and waits for the next date", () => {
  const gap: StageWithSales[] = stages([[10, 0], [0, 0], [0, 0]]);
  gap[1] = { ...gap[1], starts_on: "2026-11-20" }; // gap 16–19 Nov
  const during = resolveSale(gap, "2026-11-17");
  assert.equal(during.state, "upcoming");
  assert.equal(during.state === "upcoming" && during.opensOn, "2026-11-20");
  assert.deepEqual(statuses(gap, "2026-11-17"), ["past", "upcoming", "upcoming"]);
  // Leftovers of stage 1 do not move to stage 2.
  const after = resolveSale(gap, "2026-11-20");
  assert.equal(after.state === "current" && after.remaining, 150);
});

test("the last stage without an end date runs until the event", () => {
  const sale = resolveSale(stages([[50, 0], [150, 0], [3, 0]]), "2027-01-14");
  assert.equal(sale.state === "current" && sale.stage.id, 3);
  assert.equal(sale.state === "current" && sale.remaining, 147);
});

test("everything sold or past means sales ended", () => {
  assert.equal(resolveSale(stages([[50, 0], [150, 0], [150, 0]]), "2026-12-20").state, "ended");
  const dated = stages();
  dated[2] = { ...dated[2], ends_on: "2027-01-10" };
  assert.equal(resolveSale(dated, "2027-01-11").state, "ended");
  assert.equal(resolveSale([], "2027-01-11").state, "ended");
});

test("held tickets count against the stage quota", () => {
  const list = stages([[45, 5], [0, 0], [0, 0]]);
  assert.deepEqual(statuses(list, "2026-11-03"), ["soldout", "current", "upcoming"]);
  // When the holds expire, stage 1 is current again.
  const freed = stages([[45, 0], [0, 0], [0, 0]]);
  const sale = resolveSale(freed, "2026-11-03");
  assert.equal(sale.state === "current" && sale.stage.id, 1);
  assert.equal(sale.state === "current" && sale.remaining, 5);
});

test("stages are ordered by start date whatever the input order", () => {
  const list = stages().reverse();
  assert.deepEqual(
    stageStatuses(list, "2026-11-02").map((s) => s.id),
    [1, 2, 3]
  );
});

test("stage names fall back to Spanish", () => {
  const s = { ...stages()[0], name_en: "Presale 1" };
  assert.equal(stageName(s, "en"), "Presale 1");
  assert.equal(stageName(s, "fr"), "Preventa 1");
  assert.equal(stageName(s, "es"), "Preventa 1");
});

const OPTS = { eventDate: "2027-01-15T20:00", minAmount: 1000 };
const valid = () => [
  { name_es: "Preventa 1", price: 20000, capacity: 50, starts_on: "2026-11-01", ends_on: "2026-11-15" },
  { name_es: "Preventa 2", price: "35000", capacity: "150", starts_on: "2026-11-16", ends_on: "2026-12-16" },
  { name_es: "General", name_en: "General", price: 45000, capacity: 150, starts_on: "2026-12-17", ends_on: "" },
];

test("valid stages come back cleaned and sorted", () => {
  const res = validateStages([valid()[2], valid()[0], valid()[1]], OPTS);
  assert.ok("stages" in res);
  if (!("stages" in res)) return;
  assert.deepEqual(
    res.stages.map((s) => [s.name_es, s.price, s.capacity, s.starts_on, s.ends_on]),
    [
      ["Preventa 1", 20000, 50, "2026-11-01", "2026-11-15"],
      ["Preventa 2", 35000, 150, "2026-11-16", "2026-12-16"],
      ["General", 45000, 150, "2026-12-17", null],
    ]
  );
  assert.equal(res.stages[2].name_en, "General");
  assert.equal(res.stages[0].name_en, null);
  assert.deepEqual(validateStages([], OPTS), { stages: [] });
});

test("stage ids are kept for updates and must be unique", () => {
  const list = valid().map((s, i) => ({ ...s, id: i + 1 }));
  const res = validateStages(list, OPTS);
  assert.ok("stages" in res && res.stages.map((s) => s.id).join() === "1,2,3");
  list[1].id = 1;
  assert.ok("error" in validateStages(list, OPTS));
});

test("invalid stages are refused with a message", () => {
  const bad = (mutate: (l: any[]) => void) => {
    const l: any[] = valid();
    mutate(l);
    const res = validateStages(l, OPTS);
    assert.ok("error" in res, JSON.stringify(l));
  };
  assert.ok("error" in validateStages("x", OPTS));
  bad((l) => (l[0].name_es = " "));
  bad((l) => (l[0].price = 500)); // below the Bold minimum
  bad((l) => (l[0].price = -1));
  bad((l) => (l[0].capacity = 0));
  bad((l) => (l[0].starts_on = "1/11/2026"));
  bad((l) => (l[0].starts_on = "2026-02-30"));
  bad((l) => (l[0].ends_on = "2026-10-01")); // ends before it starts
  bad((l) => (l[1].starts_on = "2026-11-15")); // overlaps stage 1
  bad((l) => (l[0].ends_on = "")); // only the last stage may be open-ended
  bad((l) => (l[2].starts_on = "2027-01-16")); // starts after the event day
  bad((l) => (l[2].ends_on = "2027-01-20")); // ends after the event day
  bad((l) => l.push(...Array.from({ length: 8 }, (_, i) => ({ ...l[0], starts_on: `2027-01-0${i + 1}`, ends_on: `2027-01-0${i + 1}` }))));
});

test("a free stage is allowed", () => {
  const l: any[] = valid();
  l[0].price = 0;
  assert.ok("stages" in validateStages(l, OPTS));
});

test("a sold-out stage opens the next one even after its own end date", () => {
  const list = stages([[50, 0], [0, 0], [0, 0]]);
  list[1] = { ...list[1], starts_on: "2026-11-25" }; // gap 16–24 Nov
  const sale = resolveSale(list, "2026-11-20");
  assert.equal(sale.state === "current" && sale.stage.id, 2);
});

test("an empty price or quota is refused, never read as 0", () => {
  for (const v of [null, "", "  "]) {
    const l: any[] = valid();
    l[0].price = v;
    assert.ok("error" in validateStages(l, OPTS), `price ${JSON.stringify(v)}`);
    const c: any[] = valid();
    c[0].capacity = v;
    assert.ok("error" in validateStages(c, OPTS), `capacity ${JSON.stringify(v)}`);
  }
});

test("the public sale exposes only the stage in force, never counts", () => {
  // Stage 1 sold out on 2026-11-05: stage 2 opens early.
  const sale = resolveSale(stages([[50, 0], [0, 0], [0, 0]]), "2026-11-05");
  assert.deepEqual(publicSale(sale), { state: "current", current: { id: 2, price: 35000 } });
  assert.deepEqual(publicSale(resolveSale(stages(), "2026-10-20")), { state: "upcoming", current: null });
  assert.deepEqual(publicSale(resolveSale(stages([[50, 0], [150, 0], [150, 0]]), "2026-12-20")), {
    state: "ended",
    current: null,
  });
  assert.deepEqual(publicSale(null), { state: "ended", current: null });
});
