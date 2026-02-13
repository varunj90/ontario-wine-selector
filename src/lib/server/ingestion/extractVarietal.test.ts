import assert from "node:assert/strict";
import test from "node:test";

import { extractVarietal } from "./extractVarietal";

// ── extraction from wine name ──────────────────────────────────────────────

test("extracts Chardonnay from product name", () => {
  assert.equal(extractVarietal("Gato Negro Chardonnay"), "Chardonnay");
});

test("extracts Chardonnay from name with vintage", () => {
  assert.equal(extractVarietal("Mountadam High Eden Estate Chardonnay 2023"), "Chardonnay");
});

test("extracts Cabernet Sauvignon (multi-word) from name", () => {
  assert.equal(extractVarietal("Robert Mondavi Cabernet Sauvignon 2021"), "Cabernet Sauvignon");
});

test("extracts Sauvignon Blanc before Sauvignon substring", () => {
  assert.equal(extractVarietal("Kim Crawford Sauvignon Blanc"), "Sauvignon Blanc");
});

test("extracts Pinot Noir from name", () => {
  assert.equal(extractVarietal("Meiomi Pinot Noir 2022"), "Pinot Noir");
});

test("extracts Pinot Grigio from name", () => {
  assert.equal(extractVarietal("Santa Margherita Pinot Grigio"), "Pinot Grigio");
});

test("normalises Pinot Gris → Pinot Grigio", () => {
  assert.equal(extractVarietal("Trimbach Pinot Gris"), "Pinot Grigio");
});

test("extracts Riesling from name", () => {
  assert.equal(extractVarietal("Tawse Riesling 2023 VQA"), "Riesling");
});

test("extracts Malbec from name", () => {
  assert.equal(extractVarietal("Catena Malbec Mendoza 2022"), "Malbec");
});

test("extracts Merlot from name", () => {
  assert.equal(extractVarietal("Duckhorn Merlot Napa Valley"), "Merlot");
});

test("extracts Syrah from name", () => {
  assert.equal(extractVarietal("Galil Mountain Syrah KP"), "Syrah");
});

test("extracts Shiraz from name", () => {
  assert.equal(extractVarietal("Penfolds Bin 28 Kalimna Shiraz"), "Shiraz");
});

test("extracts Prosecco from name", () => {
  assert.equal(extractVarietal("La Marca Prosecco"), "Prosecco");
});

test("extracts Cabernet Franc from name", () => {
  assert.equal(extractVarietal("Tawse Cabernet Franc 2022 VQA"), "Cabernet Franc");
});

test("extracts Gamay from name", () => {
  assert.equal(extractVarietal("Pearl Morissette Gamay 2021"), "Gamay");
});

test("extracts Tempranillo from name", () => {
  assert.equal(extractVarietal("LAN Rioja Reserva Tempranillo"), "Tempranillo");
});

test("extracts Grenache from name", () => {
  assert.equal(extractVarietal("Château Mont-Redon Grenache 2020"), "Grenache");
});

test("extracts Vidal from name", () => {
  assert.equal(extractVarietal("Inniskillin Vidal Icewine 2022"), "Vidal");
});

test("extracts Baco Noir from name", () => {
  assert.equal(extractVarietal("Henry of Pelham Baco Noir VQA"), "Baco Noir");
});

// ── extraction from shortDescription fallback ──────────────────────────────

test("falls back to description when name has no grape", () => {
  assert.equal(
    extractVarietal(
      "Louis Jadot Chablis",
      "A classic Chardonnay from the Chablis appellation in Burgundy.",
    ),
    "Chardonnay",
  );
});

test("falls back to description for Sangiovese mention", () => {
  assert.equal(
    extractVarietal(
      "Donatella Cinelli Colombini Brunello 2020",
      "Brunello di Montalcino made from 100% Sangiovese grapes.",
    ),
    "Sangiovese",
  );
});

test("falls back to description for Nebbiolo mention", () => {
  assert.equal(
    extractVarietal(
      "Pio Cesare Barolo 2019",
      "A full-bodied Nebbiolo from the Langhe hills.",
    ),
    "Nebbiolo",
  );
});

// ── edge cases ─────────────────────────────────────────────────────────────

test("returns Blend when no grape is found", () => {
  assert.equal(extractVarietal("Mystery Cellar Red Blend 2022"), "Blend");
});

test("returns Blend for empty name and no description", () => {
  assert.equal(extractVarietal(""), "Blend");
});

test("returns Blend for generic name with no description", () => {
  assert.equal(extractVarietal("Casillero del Diablo Reserva"), "Blend");
});

test("name match takes priority over description match", () => {
  // Name says Merlot, description mentions Chardonnay — name wins.
  assert.equal(
    extractVarietal("Beringer Merlot 2021", "A Chardonnay-like richness in a red."),
    "Merlot",
  );
});

test("case-insensitive matching", () => {
  assert.equal(extractVarietal("domaine CHARDONNAY reserve"), "Chardonnay");
});

test("handles accented canonical forms", () => {
  assert.equal(extractVarietal("Grüner Veltliner Kamptal 2023"), "Grüner Veltliner");
});

test("handles unaccented input for accented grapes", () => {
  assert.equal(extractVarietal("Gruner Veltliner Kamptal 2023"), "Grüner Veltliner");
});

// ── real LCBO product names (sampled from DB) ──────────────────────────────

test("real: Sommer Kalkschicht Chardonnay Leithaberg DAC 2023", () => {
  assert.equal(
    extractVarietal("Sommer Kalkschicht Chardonnay Leithaberg DAC 2023"),
    "Chardonnay",
  );
});

test("real: Louis Jadot Chardonnay Macon-Villages", () => {
  assert.equal(
    extractVarietal("Louis Jadot Chardonnay Macon-Villages"),
    "Chardonnay",
  );
});

test("real: Gato Negro Chardonnay", () => {
  assert.equal(extractVarietal("Gato Negro Chardonnay"), "Chardonnay");
});

test("real: Pelee Island Lola Secco Sparkling VQA with chardonnay in description", () => {
  assert.equal(
    extractVarietal(
      "Pelee Island Lola Secco Sparkling VQA",
      "Local sparkler made from equal parts chardonnay and riesling.",
    ),
    "Chardonnay",
  );
});
