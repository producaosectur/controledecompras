import { getFilteredData } from './filters.js';
import { sortData, getStatusInfo } from './table.js';
import { calculatePaymentForecast, formatDateBR } from '../utils/dateUtils.js';
import { showToast } from './toast.js';

export function exportToExcel() {
  // VERIFICAÇÃO PREVENTIVA DA BIBLIOTECA XLSX
  if (typeof XLSX === 'undefined') {
    showToast("A biblioteca de exportação para Excel não foi carregada. Verifique a sua ligação ou recarregue a página.", "error");
    return;
  }

  let filtered = getFilteredData();
  let dataToExport = sortData(filtered);

  if (dataToExport.length === 0) {
    showToast("Nenhum registro encontrado para exportar com os filtros atuais.", "warning");
    return;
  }

  const excelData = dataToExport.map(item => {
    let statusInfo = getStatusInfo(item);
    let prevPagamento = calculatePaymentForecast(item.entrega) || '-';

    return {
      "Ano": item.ano,
      "Protocolo": item.protocolo || 'Aguardando...',
      "Evento": item.evento,
      "Local": item.local,
      "Descritivo": item.descritivo,
      "Requisição": item.requisicao,
      "Ficha(s)": item.fichas.join(', '),
      "Empenho(s)": item.empenhos.join(', '),
      "AF/OS": item.af,
      "Valor (R$)": item.valor,
      "Nota(s) Fiscal(is)": item.notas.join(', '),
      "Liquidação(ões) NL": item.nl.join(', '),
      "Data Entrega": formatDateBR(item.entrega),
      "Data Processo": formatDateBR(item.dataProcesso),
      "Prev. Pagamento": prevPagamento,
      "Status": statusInfo.rowClass.replace('status-row-', '').toUpperCase()
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitações Filtradas");

  const max_width = excelData.reduce((w, r) => Math.max(w, (r.Descritivo || '').length), 10);
  worksheet['!cols'] = [
    { wch: 8 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: Math.min(max_width, 50) },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 14 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Relatorio_Compras_SECTUR_${todayStr}.xlsx`);
  
  showToast("Relatório Excel gerado com sucesso!", "success");
}