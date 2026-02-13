import assert from "node:assert/strict";
import test from "node:test";

import { buildVivinoSearchUrl, isDirectVivinoWineUrl, isTrustedVivinoSignal, resolveVivinoUrl } from "./vivinoTrust";

test("buildVivinoSearchUrl includes producer name and country", () => {
  const url = buildVivinoSearchUrl("Cabernet Franc Icewine VQA", "Tawse", "Canada");
  assert.equal(
    url,
    "https://www.vivino.com/search/wines?q=Tawse%20Cabernet%20Franc%20Icewine%20VQA%20Canada",
  );
});

test("isDirectVivinoWineUrl detects bottle-level Vivino links", () => {
  assert.equal(isDirectVivinoWineUrl("https://www.vivino.com/w/12345"), true);
  assert.equal(isDirectVivinoWineUrl("https://www.vivino.com/US/en/wines/34801"), true);
  assert.equal(isDirectVivinoWineUrl("https://www.vivino.com/search/wines?q=tawse"), false);
});

test("resolveVivinoUrl keeps direct links and falls back from search links", () => {
  const direct = "https://www.vivino.com/w/12345";
  assert.equal(resolveVivinoUrl(direct, "Cabernet Franc Icewine VQA", "Tawse", "Canada"), direct);

  const search = "https://www.vivino.com/search/wines?q=tawse";
  assert.equal(
    resolveVivinoUrl(search, "Cabernet Franc Icewine VQA", "Tawse", "Canada"),
    "https://www.vivino.com/search/wines?q=Tawse%20Cabernet%20Franc%20Icewine%20VQA%20Canada",
  );
});

test("isTrustedVivinoSignal enforces configured confidence threshold", () => {
  assert.equal(isTrustedVivinoSignal(0.71, 0.72), false);
  assert.equal(isTrustedVivinoSignal(0.72, 0.72), true);
  assert.equal(isTrustedVivinoSignal(undefined, 0.72), false);
});
