const test = require("node:test");
const assert = require("node:assert/strict");
const { formatTokenAmount, isValidPositiveAmount, shortenHash } = require("../ynp-utils.js");

test("formatTokenAmount groups whole tokens without floating-point conversion", () => {
  assert.equal(formatTokenAmount("21000000.0", 0), "21,000,000");
  assert.equal(formatTokenAmount("12345678.123456789", 6), "12,345,678.123456");
  assert.equal(formatTokenAmount("0.000000000000000001", 18), "0.000000000000000001");
});

test("isValidPositiveAmount enforces positivity and decimal precision", () => {
  assert.equal(isValidPositiveAmount("1.25", 18), true);
  assert.equal(isValidPositiveAmount(".5", 18), true);
  assert.equal(isValidPositiveAmount("0.000000000000000001", 18), true);
  assert.equal(isValidPositiveAmount("0", 18), false);
  assert.equal(isValidPositiveAmount("1.123456789", 8), false);
  assert.equal(isValidPositiveAmount("-1", 18), false);
});

test("shortenHash safely shortens real hashes", () => {
  const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef";
  assert.equal(shortenHash(hash, 6), "0x1234...cdef");
  assert.equal(shortenHash("0x123", 6), "0x123");
});
