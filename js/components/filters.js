import { state } from '../state.js';
import { calculatePaymentForecast, parseBRDateToUTC } from '../utils/dateUtils.js';
import { getStatusInfo, sortData, renderTable, updateKPIs } from './table.js';

/**
 * Preenche os dropdowns de filtro e formulário com os cadastros do sistema
 */
export function populateFilterOptions() {
  const filterAno = document.getElementById('filter-ano');
  const filterLocal = document.getElementById('filter-local');
  const filterEvento = document.getElementById('filter-evento');
  const formLocal = document.getElementById('form-local');
  const formEvento = document.getElementById('form-evento');

  const currentYearStr = new Date().getFullYear().toString();

  if (filterAno) {
    filterAno.innerHTML = '<option value="">Todos os Anos</option>';
    state.cadAnos.forEach(ano => {
      let selected = ano === currentYearStr ? 'selected' : '';
      filterAno.innerHTML += `<option value="${ano}" ${selected}>Ano ${ano}</option>`;
    });
  }

  if (filterLocal) filterLocal.innerHTML = '<option value="">Todos os Locais</option>';
  if (filterEvento) filterEvento.innerHTML = '<option value="">Todos os Eventos</option>';
  if (formLocal) formLocal.innerHTML = '<option value="">Selecione o Local</option>';
  if (formEvento) formEvento.innerHTML = '<option value="">Selecione o Evento</option>';

  state.cadLocais.forEach(loc => {
    if (filterLocal) filterLocal.innerHTML += `<option value="${loc}">${loc}</option>`;
    if (formLocal) formLocal.innerHTML += `<option value="${loc}">${loc}</option>`;
  });

  state.cadEventos.forEach(evt => {
    if (filterEvento) filterEvento.innerHTML += `<option value="${evt}">${evt}</option>`;
    if (formEvento) formEvento.innerHTML += `<option value="${evt}">${evt}</option>`;
  });
}

/**
 * Filtra a lista de solicitações cruzando os valores selecionados na toolbar
 */
export function getFilteredData() {
  const searchInput = document.getElementById('search-input');
  const filterAno = document.getElementById('filter-ano');
  const filterLocal = document.getElementById('filter-local');
  const filterEvento = document.getElementById('filter-evento');
  const filterStatus = document.getElementById('filter-status');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const ano = filterAno ? filterAno.value : '';
  const local = filterLocal ? filterLocal.value : '';
  const evento = filterEvento ? filterEvento.value : '';
  const status = filterStatus ? filterStatus.value : '';

  const spDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const todaySP = new Date(spDateStr);
  const todayZero = new Date(Date.UTC(todaySP.getFullYear(), todaySP.getMonth(), todaySP.getDate()));

  return state.purchasesData.filter(item => {
    let strFichas = (item.fichas || []).join(' ').toLowerCase();
    let strEmpenhos = (item.empenhos || []).join(' ').toLowerCase();
    let strNotas = (item.notas || []).join(' ').toLowerCase();
    let strNl = (item.nl || []).join(' ').toLowerCase();

    let matchSearch = !search || 
                      String(item.protocolo || '').toLowerCase().includes(search) || 
                      String(item.descritivo || '').toLowerCase().includes(search) ||
                      String(item.evento || '').toLowerCase().includes(search) ||
                      String(item.local || '').toLowerCase().includes(search) ||
                      String(item.requisicao || '').toLowerCase().includes(search) ||
                      String(item.af || '').toLowerCase().includes(search) ||
                      strFichas.includes(search) ||
                      strEmpenhos.includes(search) ||
                      strNotas.includes(search) ||
                      strNl.includes(search);
    
    let matchAno = !ano || item.ano === ano;
    let matchLocal = !local || item.local === local;
    let matchEvento = !evento || item.evento === evento;
    
    const statusInfo = getStatusInfo(item);
    let matchStatus = true;

    if (status === 'CONCLUIDO' || status === 'COM_NL') {
      matchStatus = Array.isArray(item.nl) && item.nl.length > 0 && !item.cancelado;
    } else if (status === 'EM_ANDAMENTO') {
      matchStatus = (!Array.isArray(item.nl) || item.nl.length === 0) && !item.cancelado;
    } else if (status === 'SEM_PROTOCOLO') {
      matchStatus = statusInfo.rowClass === 'status-row-neutral';
    } else if (status === 'COM_PROTOCOLO') {
      matchStatus = statusInfo.rowClass === 'status-row-pink';
    } else if (status === 'COM_NF') {
      matchStatus = statusInfo.rowClass === 'status-row-yellow';
    } else if (status === 'AGUARDANDO_PAGAMENTO') {
      let prevPagStr = calculatePaymentForecast(item.entrega);
      let dtPrev = parseBRDateToUTC(prevPagStr);

      matchStatus = dtPrev !== null && dtPrev.getTime() >= todayZero.getTime();
    } else if (status === 'CANCELADO') {
      matchStatus = statusInfo.rowClass === 'status-row-red';
    }

    return matchSearch && matchAno && matchLocal && matchEvento && matchStatus;
  });
}

/**
 * Aplica os filtros, ordena os dados e atualiza a tabela e KPIs
 */
export function applyFilters() {
  let filtered = getFilteredData();
  let sorted = sortData(filtered);
  renderTable(sorted);
  updateKPIs(sorted);
}

/**
 * Filtro disparado pelo clique direto nos cards de KPI
 */
export function filterByKPI(type) {
  const filterStatus = document.getElementById('filter-status');
  if (!filterStatus) return;

  if (type === 'concluido') {
    if (!filterStatus.querySelector('option[value="CONCLUIDO"]')) {
      filterStatus.innerHTML += '<option value="CONCLUIDO">Concluídos (NL)</option>';
    }
    filterStatus.value = 'CONCLUIDO';
  } else if (type === 'andamento') {
    if (!filterStatus.querySelector('option[value="EM_ANDAMENTO"]')) {
      filterStatus.innerHTML += '<option value="EM_ANDAMENTO">Em Andamento</option>';
    }
    filterStatus.value = 'EM_ANDAMENTO';
  } else {
    filterStatus.value = '';
  }

  applyFilters();
}

/**
 * Reseta todos os campos da toolbar e restaura o ano atual
 */
export function clearAllFilters() {
  const searchInput = document.getElementById('search-input');
  const filterAno = document.getElementById('filter-ano');
  const filterLocal = document.getElementById('filter-local');
  const filterEvento = document.getElementById('filter-evento');
  const filterStatus = document.getElementById('filter-status');

  const currentYearStr = new Date().getFullYear().toString();

  if (searchInput) searchInput.value = '';
  if (filterAno) filterAno.value = currentYearStr;
  if (filterLocal) filterLocal.value = '';
  if (filterEvento) filterEvento.value = '';
  if (filterStatus) filterStatus.value = '';

  applyFilters();
}

// Exposição global dupla para prevenir ReferenceError em eventos onclick inline
window.filterByKPI = filterByKPI;
window.clearAllFilters = clearAllFilters;
window.clearFilters = clearAllFilters;