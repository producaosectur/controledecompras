export function parseValorNum(val) {
  if (!val && val !== 0) return 0.0;
  if (typeof val === 'number') return val;
  let cleanStr = val.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  let num = parseFloat(cleanStr);
  return isNaN(num) ? 0.0 : num;
}

export function parseBool(val) {
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() === 'true';
}