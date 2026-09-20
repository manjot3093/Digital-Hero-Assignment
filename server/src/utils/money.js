/** Money helpers. Storage and arithmetic are always in integer minor units. */
export function toMinor(major) {
  return Math.round(Number(major) * 100);
}

export function toMajor(minor) {
  return Math.round(Number(minor ?? 0)) / 100;
}

export function formatMoney(minor, currency = 'GBP', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(toMajor(minor));
}

export function sumMinor(rows, key = 'amount_minor') {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}
