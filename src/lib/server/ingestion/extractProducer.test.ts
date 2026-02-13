import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractProducer } from "./extractProducer";

describe("extractProducer", () => {
  it("extracts producer before a single-word varietal", () => {
    assert.equal(extractProducer("Alamos Chardonnay", "Chardonnay"), "Alamos");
  });

  it("extracts producer before a multi-word varietal", () => {
    assert.equal(extractProducer("Cloudy Bay Sauvignon Blanc", "Sauvignon Blanc"), "Cloudy Bay");
  });

  it("handles accented varietals", () => {
    assert.equal(extractProducer("Pierre Sparr Gewurztraminer", "Gewürztraminer"), "Pierre Sparr");
  });

  it("extracts multi-word producer", () => {
    assert.equal(extractProducer("Galil Mountain Syrah KP", "Syrah"), "Galil Mountain");
  });

  it("handles numeric producer names", () => {
    assert.equal(extractProducer("13th Street Gamay", "Gamay"), "13th Street");
  });

  it("strips trailing wine label terms", () => {
    assert.equal(extractProducer("Tawse Estate Chardonnay", "Chardonnay"), "Tawse");
  });

  it("strips vintage years from producer portion", () => {
    assert.equal(extractProducer("Some Producer 2021 Merlot", "Merlot"), "Some Producer");
  });

  it("returns Unknown Producer when varietal is Blend", () => {
    assert.equal(extractProducer("Some Random Wine", "Blend"), "Unknown Producer");
  });

  it("uses first-words fallback when varietal not in name", () => {
    // Sangiovese is not in "Nozzole Riserva Chianti Classico 2021", so the
    // function falls back to first-words heuristic.
    const result = extractProducer("Nozzole Riserva Chianti Classico 2021", "Sangiovese");
    assert.equal(result, "Nozzole");
  });

  it("returns Unknown Producer when no varietal is provided", () => {
    // Without a varietal to anchor on, the function is conservative
    assert.equal(extractProducer("Château Margaux Grand Vin 2015"), "Unknown Producer");
  });

  it("uses first-words fallback when varietal is known but not in name", () => {
    // The varietal "Merlot" isn't in the name, but since we know it's not Blend,
    // the function tries the first-words fallback.
    const result = extractProducer("Château Margaux Grand Vin 2015", "Merlot");
    assert.equal(result, "Château Margaux");
  });

  it("returns Unknown Producer for empty name", () => {
    assert.equal(extractProducer("", "Chardonnay"), "Unknown Producer");
  });

  it("extracts from real LCBO products", () => {
    assert.equal(extractProducer("Emiliana Novas Gran Reserva Cabernet Sauvignon 2023", "Cabernet Sauvignon"), "Emiliana Novas");
  });

  it("handles wine names with Riserva before varietal", () => {
    assert.equal(extractProducer("Alianca Bairrada Reserva Merlot", "Merlot"), "Alianca Bairrada");
  });

  it("handles apostrophes in producer names", () => {
    const result = extractProducer("Alvi's Drift 221 Chenin Blanc 2024", "Chenin Blanc");
    assert.equal(result, "Alvi's Drift 221");
  });

  it("handles KP suffix in wine names", () => {
    assert.equal(extractProducer("Galil Mountain Syrah KP", "Syrah"), "Galil Mountain");
  });
});
