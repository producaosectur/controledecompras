export function formatDateBR(val) {
  if (!val) return '-';
  let str = val.toString().trim();
  if (str.includes('T')) str = str.split('T')[0];
  if (str.includes('-')) {
    let parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

export function extractYearFromItem(item) {
  let dateStr = item.DATA_PROCESSO || item.ENTREGA || '';
  if (dateStr) {
    let cleanStr = dateStr.toString().split('T')[0];
    if (cleanStr.includes('-')) return cleanStr.split('-')[0];
    if (cleanStr.includes('/')) return cleanStr.split('/')[2];
  }
  return new Date().getFullYear().toString();
}

// CÁLCULO DA PREVISÃO DE PAGAMENTO (DATA DA ENTREGA + 28 DIAS AJUSTADOS PARA A PRÓXIMA QUINTA-FEIRA)
export function calculatePaymentForecast(entregaStr) {
  if (!entregaStr) return null;
  let parts = entregaStr.split('T')[0].split('-');
  if (parts.length !== 3) return null;

  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  let day = parseInt(parts[2], 10);

  let dtEntrega = new Date(Date.UTC(year, month, day));
  if (isNaN(dtEntrega.getTime())) return null;

  dtEntrega.setUTCDate(dtEntrega.getUTCDate() + 28);
  let dayOfWeek = dtEntrega.getUTCDay();
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  dtEntrega.setUTCDate(dtEntrega.getUTCDate() + daysUntilThursday);

  let resDay = String(dtEntrega.getUTCDate()).padStart(2, '0');
  let resMonth = String(dtEntrega.getUTCMonth() + 1).padStart(2, '0');
  let resYear = dtEntrega.getUTCFullYear();

  return `${resDay}/${resMonth}/${resYear}`;
}

export function parseBRDateToUTC(dateBRStr) {
  if (!dateBRStr || dateBRStr === '-') return null;
  let parts = dateBRStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)));
}