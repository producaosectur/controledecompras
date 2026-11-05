import { state } from '../state.js';
import { calculatePaymentForecast, parseBRDateToUTC } from '../utils/dateUtils.js';
import { editRecord } from './modal.js';

export function getStatusInfo(item) {
  const protStr = String(item.protocolo || '').trim();
  const temProtocolo = Boolean(protStr !== '' && protStr !== '-');
  const temNF = Array.isArray(item.notas) && item.notas.length > 0;
  const temNL = Array.isArray(item.nl) && item.nl.length > 0;

  if (item.cancelado) {
    return { rowClass: 'status-row-red', weight: 5 };
  } else if (temNL) {
    return { rowClass: 'status-row-blue', weight: 4 };
  } else if (temNF) {
    return { rowClass: 'status-row-yellow', weight: 3 };
  } else if (temProtocolo) {
    return { rowClass: 'status-row-pink', weight: 2 };
  } else {
    return { rowClass: 'status-row-neutral', weight: 1 };
  }
}

/**
 * Destaca visualmente o termo pesquisado dentro de uma string de texto/HTML de célula
 */
function highlightText(content, searchTerm) {
  if (!content || !searchTerm || typeof content !== 'string') return content || '-';
  
  const cleanTerm = searchTerm.trim();
  if (!cleanTerm) return content;

  // Se o conteúdo possuir tags HTML (ex: <span> de anexos), aplica o destaque apenas nas partes de texto fora das tags
  const regex = new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  // Divide a string por tags HTML para evitar corromper atributos como class="" ou title=""
  const parts = content.split(/(<[^>]+>)/g);
  return parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part; // Retorna tag HTML intacta
    }
    return part.replace(regex, '<mark class="search-highlight">$1</mark>');
  }).join('');
}

/**
 * Formata o texto/número da célula aplicando a classe 'has-attachment' (sublinhado tracejado)
 * apenas se existirem ficheiros anexados vinculados a esse campo.
 */
function formatAttachmentText(text, filesArray) {
  const count = Array.isArray(filesArray) ? filesArray.length : 0;
  if (count > 0 && text && text !== '-') {
    return `<span class="has-attachment" title="📎 ${count} anexo(s) vinculado(s)">${text}</span>`;
  }
  return text || '-';
}

export function sortData(list) {
  return list.sort((a, b) => {
    // 1. REGRA ESPECIAL PARA ORDENAÇÃO POR PROTOCOLO
    if (state.currentSortColumn === 'protocolo') {
      const isAguardandoA = !a.protocolo || String(a.protocolo).trim() === '' || String(a.protocolo).trim() === '-';
      const isAguardandoB = !b.protocolo || String(b.protocolo).trim() === '' || String(b.protocolo).trim() === '-';

      if (isAguardandoA && !isAguardandoB) return -1;
      if (!isAguardandoA && isAguardandoB) return 1;
      if (isAguardandoA && isAguardandoB) return 0;

      const numA = parseFloat(String(a.protocolo).replace(/[^0-9.]/g, '')) || 0;
      const numB = parseFloat(String(b.protocolo).replace(/[^0-9.]/g, '')) || 0;

      if (state.currentSortDirection === 'desc' || !state.currentSortDirection) {
        return numB - numA;
      } else {
        return numA - numB;
      }
    }

    // 2. DEMAIS COLUNAS
    let valA, valB;

    switch (state.currentSortColumn) {
      case 'requisicao':
        valA = parseFloat(a.requisicao) || 0;
        valB = parseFloat(b.requisicao) || 0;
        break;
      case 'af':
        valA = parseFloat(a.af) || 0;
        valB = parseFloat(b.af) || 0;
        break;
      case 'valor':
        valA = a.valor || 0;
        valB = b.valor || 0;
        break;
      case 'prevPagamento':
        let strA = calculatePaymentForecast(a.entrega);
        let strB = calculatePaymentForecast(b.entrega);
        let dtA = parseBRDateToUTC(strA);
        let dtB = parseBRDateToUTC(strB);
        valA = dtA ? dtA.getTime() : 0;
        valB = dtB ? dtB.getTime() : 0;
        break;
      case 'status':
        valA = getStatusInfo(a).weight;
        valB = getStatusInfo(b).weight;
        break;
      case 'evento':
        valA = (a.evento + " " + a.local).toLowerCase();
        valB = (b.evento + " " + b.local).toLowerCase();
        break;
      default:
        valA = (a[state.currentSortColumn] || '').toString().toLowerCase();
        valB = (b[state.currentSortColumn] || '').toString().toLowerCase();
        break;
    }

    if (valA < valB) return state.currentSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return state.currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Renderiza as linhas da tabela utilizando DocumentFragment para alta performance no DOM
 */
export function renderTable(data) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = document.getElementById('search-input')?.value.trim() || '';

  if (data.length === 0) {
    const emptyMsg = searchVal 
      ? `Nenhum registro encontrado para a busca <strong>"${searchVal}"</strong>.`
      : `Nenhum registro encontrado com os filtros selecionados.`;

    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center; padding: 2.5rem 1rem;">
          <p style="margin-bottom: 0.75rem; font-size: 0.95rem; opacity: 0.8;">${emptyMsg}</p>
          <button class="btn btn-secondary" onclick="window.clearFilters && window.clearFilters()" style="font-size:0.78rem;">
            🧹 Limpar Filtros
          </button>
        </td>
      </tr>`;
    return;
  }

  // Fragmento em memória para evitar múltiplos reflows/paints no navegador
  const fragment = document.createDocumentFragment();

  data.forEach(item => {
    const statusInfo = getStatusInfo(item);

    let strProtocolo = item.protocolo ? String(item.protocolo).trim() : 'Aguardando...';
    let strEvento = item.evento || '-';
    let strLocal = item.local || '-';
    let strDescritivo = item.descritivo || '-';
    let strFichas = item.fichas && item.fichas.length ? item.fichas.join(', ') : '-';
    let strEmpenhos = item.empenhos && item.empenhos.length ? item.empenhos.join(', ') : '-';
    let strNotas = item.notas && item.notas.length ? item.notas.join(', ') : '-';
    let strNl = item.nl && item.nl.length ? item.nl.join(', ') : '-';
    let prevPagamento = calculatePaymentForecast(item.entrega) || '-';
    let valorFormatted = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const cellReq = formatAttachmentText(item.requisicao, item.anexosReq);
    const cellAf = formatAttachmentText(item.af, item.anexosAf);
    const cellNf = formatAttachmentText(strNotas, item.anexosNf);
    const cellNl = formatAttachmentText(strNl, item.anexosNl);

    // Aplicação do destaque do termo pesquisado
    const hlProtocolo = highlightText(strProtocolo, searchVal);
    const hlEvento = highlightText(strEvento, searchVal);
    const hlLocal = highlightText(strLocal, searchVal);
    const hlDescritivo = highlightText(strDescritivo, searchVal);
    const hlReq = highlightText(cellReq, searchVal);
    const hlFichas = highlightText(strFichas, searchVal);
    const hlEmpenhos = highlightText(strEmpenhos, searchVal);
    const hlAf = highlightText(cellAf, searchVal);
    const hlValor = highlightText(valorFormatted, searchVal);
    const hlNf = highlightText(cellNf, searchVal);
    const hlNl = highlightText(cellNl, searchVal);
    const hlPrevPagamento = highlightText(prevPagamento, searchVal);

    const tr = document.createElement('tr');
    tr.className = `${statusInfo.rowClass} clickable-row`;
    tr.title = "Clique para explorar / editar registro";

    tr.onclick = (e) => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }
      editRecord(item.id);
    };

    tr.innerHTML = `
      <td title="Protocolo: ${strProtocolo}"><strong>${hlProtocolo}</strong></td>
      <td title="Evento / Local: ${strEvento} - ${strLocal}">${hlEvento}<br><small style="opacity: 0.7">${hlLocal}</small></td>
      <td title="${strDescritivo}">${hlDescritivo}</td>
      <td title="Requisição: ${item.requisicao || '-'}">${hlReq}</td>
      <td title="Ficha(s): ${strFichas}">${hlFichas}</td>
      <td title="Empenho(s): ${strEmpenhos}">${hlEmpenhos}</td>
      <td title="AF/OS: ${item.af || '-'}">${hlAf}</td>
      <td title="Valor: ${valorFormatted}">${hlValor}</td>
      <td title="Nota(s) Fiscal(is): ${strNotas}">${hlNf}</td>
      <td title="Liquidação(ões) NL: ${strNl}">${hlNl}</td>
      <td title="Previsão de Pagamento: ${prevPagamento}"><strong>${hlPrevPagamento}</strong></td>
    `;
    fragment.appendChild(tr);
  });

  // Inserção única no DOM
  tbody.appendChild(fragment);
}

export function updateKPIs(data) {
  const totalQtdEl = document.getElementById('kpi-total-qtd');
  const totalValorEl = document.getElementById('kpi-total-valor');

  const registrosAtivos = data.filter(i => !i.cancelado);
  const concluidos = registrosAtivos.filter(i => Array.isArray(i.nl) && i.nl.length > 0).length;
  const emAndamento = registrosAtivos.length - concluidos;
  const totalAtivos = registrosAtivos.length;
  const canceladosQtd = data.filter(i => i.cancelado).length;

  if (totalQtdEl) {
    totalQtdEl.innerHTML = `
      <span onclick="window.filterByKPI && window.filterByKPI('concluido')" 
            style="font-size: 1.4rem; cursor: pointer;" 
            title="Clique para filtrar apenas Concluídas">
        ${concluidos}
      </span> 
      <small style="font-size:0.85rem; opacity:0.7;">concluídas</small> / 
      <span onclick="window.filterByKPI && window.filterByKPI('andamento')" 
            style="font-size: 1.4rem; cursor: pointer;" 
            title="Clique para filtrar apenas Em Andamento">
        ${emAndamento}
      </span> 
      <small style="font-size:0.85rem; opacity:0.7;">em andamento</small> 
      <small style="font-size:0.75rem; opacity:0.5; display:block;">(Total Ativo: ${totalAtivos} | Canceladas: ${canceladosQtd})</small>
    `;
  }

  if (totalValorEl) {
    const totalValor = registrosAtivos.reduce((sum, item) => sum + (item.valor || 0), 0);
    totalValorEl.innerText = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

export function setupTableHeaderSort(applyFiltersCallback) {
  const headers = document.querySelectorAll('#purchases-table th.sortable');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (state.currentSortColumn === col) {
        state.currentSortDirection = state.currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.currentSortColumn = col;
        state.currentSortDirection = col === 'protocolo' ? 'desc' : 'asc';
      }
      updateSortHeaderUI();
      applyFiltersCallback();
    });
  });
  updateSortHeaderUI();
}

export function updateSortHeaderUI() {
  document.querySelectorAll('#purchases-table th.sortable').forEach(th => {
    const col = th.getAttribute('data-sort');
    const icon = th.querySelector('.sort-icon');
    th.classList.remove('sort-asc', 'sort-desc');

    if (col === state.currentSortColumn) {
      if (state.currentSortDirection === 'asc') {
        th.classList.add('sort-asc');
        if (icon) icon.innerText = '▲';
      } else {
        th.classList.add('sort-desc');
        if (icon) icon.innerText = '▼';
      }
    } else {
      if (icon) icon.innerText = '↕';
    }
  });
}