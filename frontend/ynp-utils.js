(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.YNPUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function formatTokenAmount(rawAmount, maximumDecimals = 6) {
    const parts = String(rawAmount).split(".");
    let whole = parts[0].replace(/^0+(?=\d)/, "") || "0";
    let fraction = parts[1] ? parts[1].replace(/0+$/, "") : "";
    if (fraction.length > maximumDecimals) fraction = fraction.slice(0, maximumDecimals).replace(/0+$/, "");
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function isValidPositiveAmount(rawAmount, decimals = 18) {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawAmount)) return false;
    const parts = rawAmount.split(".");
    if (parts[1] && parts[1].length > decimals) return false;
    return Boolean(parts[0] !== "0" || (parts[1] && /[1-9]/.test(parts[1])));
  }

  function shortenHash(value, size = 6) {
    if (typeof value !== "string" || value.length <= size * 2 + 3) return value || "";
    return `${value.slice(0, size)}...${value.slice(-4)}`;
  }

  return { formatTokenAmount, isValidPositiveAmount, shortenHash };
});
