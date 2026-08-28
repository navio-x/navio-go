/**
 * Pure numpad-input reducer for POS amount entry: no leading zeros, at most
 * one decimal point, capped decimal places (8 for NAV, 2 for fiat). Kept
 * separate from PosHome.vue so the edge cases (leading zero, decimal cap,
 * backspace) are unit-testable without mounting the component.
 */
export function applyKeypadPress(current, key, maxDecimals) {
  if (key === "back") return current.slice(0, -1);

  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : current + ".";
  }

  const dotIdx = current.indexOf(".");
  if (dotIdx !== -1 && current.length - dotIdx - 1 >= maxDecimals) return current;

  return current === "0" ? key : current + key;
}
