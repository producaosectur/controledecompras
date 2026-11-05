import { API_URL } from '../config.js';
import { state } from '../state.js';
import { parseValorNum, parseBool } from '../utils/formatters.js';
import { extractYearFromItem } from '../utils/dateUtils.js';
import { populateFilterOptions, applyFilters } from '../components/filters.js';

let isLoading = false;
const CACHE_KEY = 'sectur_purchases_cache_v1';

/**
 * Função de Fetch com Retry Automático e Backoff Exponencial
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return response;
    } catch (err) {
      const isLastAttempt = i === maxRetries - 1;
      if (isLastAttempt) throw err;
      
      const currentDelay = delayMs * Math.pow(2, i);
      console.warn(`[API] Tentativa ${i + 1} falhou. Tentando novamente em ${currentDelay}ms...`);
      await new Promise(res => setTimeout(res, currentDelay));
    }
  }
}

/**
 * Processa e higieniza a estrutura de dados bruta vinda do backend ou da cache
 */
function processRawData(data) {
  const safeData = {
    fichas: Array.isArray(data?.fichas) ? data.fichas : [],
    empenhos: Array.isArray(data?.empenhos) ? data.empenhos : [],
    notasFiscais: Array.isArray(data?.notasFiscais) ? data.notasFiscais : [],
    liquidacoes: Array.isArray(data?.liquidacoes) ? data.liquidacoes : [],
    anexosReq: Array.isArray(data?.anexosReq) ? data.anexosReq : [],
    anexosAf: Array.isArray(data?.anexosAf) ? data.anexosAf : [],
    anexosNf: Array.isArray(data?.anexosNf) ? data.anexosNf : [],
    anexosNl: Array.isArray(data?.anexosNl) ? data.anexosNl : [],
    locais: Array.isArray(data?.locais) ? data.locais : [],
    eventos: Array.isArray(data?.eventos) ? data.eventos : [],
    solicitacoes: Array.isArray(data?.solicitacoes) ? data.solicitacoes : []
  };

  function buildRelMap(list) {
    let map = {};
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      let keys = Object.keys(item);
      if (keys.length === 0) return;

      let id = item.ID_SOLICITACAO;
      if (!id) {
        for (let k of keys) {
          if (String(item[k]).trim().startsWith('SOL')) {
            id = item[k];
            break;
          }
        }
      }

      let val = item.NUMERO_FICHA || item.NUMERO_EMPENHO || item.NUMERO_NF || item.NUMERO_NL;
      if (!val) {
        for (let k of keys) {
          let v = String(item[k]).trim();
          if (v && v !== String(id).trim() && !v.startsWith('FIC') && !v.startsWith('EMP') && !v.startsWith('NF') && !v.startsWith('NL')) {
            val = v;
            break;
          }
        }
      }

      if (id && val) {
        id = String(id).trim();
        val = String(val).trim();
        if (!map[id]) map[id] = [];
        if (!map[id].includes(val)) map[id].push(val);
      }
    });
    return map;
  }

  function buildAnexosMap(list) {
    let map = {};
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      let id = String(item.ID_SOLICITACAO || '').trim();
      let url = item.URL_DRIVE || '';
      let name = item.NOME_ARQUIVO || 'Anexo';

      if (id && url) {
        if (!map[id]) map[id] = [];
        map[id].push({ name: name, url: url });
      }
    });
    return map;
  }

  state.fichasMap = buildRelMap(safeData.fichas);
  state.empenhosMap = buildRelMap(safeData.empenhos);
  state.notasMap = buildRelMap(safeData.notasFiscais);
  state.liquidacoesMap = buildRelMap(safeData.liquidacoes);

  state.anexosReqMap = buildAnexosMap(safeData.anexosReq);
  state.anexosAfMap = buildAnexosMap(safeData.anexosAf);
  state.anexosNfMap = buildAnexosMap(safeData.anexosNf);
  state.anexosNlMap = buildAnexosMap(safeData.anexosNl);

  let rawLocais = safeData.locais.map(l => l?.NOME_LOCAL).filter(Boolean);
  let rawEventos = safeData.eventos.map(e => e?.NOME_EVENTO).filter(Boolean);

  state.purchasesData = safeData.solicitacoes.map(item => {
    let solId = String(item?.ID_SOLICITACAO || '').trim();

    let reqList = state.anexosReqMap[solId] ? [...state.anexosReqMap[solId]] : [];
    if (reqList.length === 0 && item?.ANEXO_REQUISICAO) {
      reqList.push({ name: 'Anexo Requisição', url: item.ANEXO_REQUISICAO });
    }

    let afList = state.anexosAfMap[solId] ? [...state.anexosAfMap[solId]] : [];
    if (afList.length === 0 && item?.ANEXO_AF_OS) {
      afList.push({ name: 'Anexo AF/OS', url: item.ANEXO_AF_OS });
    }

    let yearExtracted = extractYearFromItem(item);

    return {
      id: solId,
      protocolo: item?.PROTOCOLO !== undefined && item?.PROTOCOLO !== null ? String(item.PROTOCOLO).trim() : '',
      evento: String(item?.EVENTO || ''),
      local: String(item?.LOCAL || ''),
      descritivo: String(item?.DESCRITIVO || ''),
      requisicao: String(item?.REQUISICAO || ''),
      fichas: Array.isArray(state.fichasMap[solId]) ? state.fichasMap[solId] : [],
      empenhos: Array.isArray(state.empenhosMap[solId]) ? state.empenhosMap[solId] : [],
      notas: Array.isArray(state.notasMap[solId]) ? state.notasMap[solId] : [],
      nl: Array.isArray(state.liquidacoesMap[solId]) ? state.liquidacoesMap[solId] : [],
      valor: parseValorNum(item?.VALOR_TOTAL),
      af: String(item?.AF_OS || ''),
      entrega: String(item?.ENTREGA || ''),
      dataProcesso: String(item?.DATA_PROCESSO || ''),
      ano: String(yearExtracted || ''),
      cancelado: parseBool(item?.CHK_CANCELADO),
      anexosReq: Array.isArray(reqList) ? reqList : [],
      anexosAf: Array.isArray(afList) ? afList : [],
      anexosNf: Array.isArray(state.anexosNfMap[solId]) ? state.anexosNfMap[solId] : [],
      anexosNl: Array.isArray(state.anexosNlMap[solId]) ? state.anexosNlMap[solId] : []
    };
  });

  state.cadLocais = [...new Set([...rawLocais, ...state.purchasesData.map(d => d.local).filter(Boolean)])].sort();
  state.cadEventos = [...new Set([...rawEventos, ...state.purchasesData.map(d => d.evento).filter(Boolean)])].sort();
  
  const currentYearStr = new Date().getFullYear().toString();
  state.cadAnos = [...new Set([currentYearStr, ...state.purchasesData.map(d => d.ano).filter(Boolean)])].sort((a,b) => b - a);

  populateFilterOptions();
  applyFilters();
}

export async function loadData() {
  if (isLoading) return;
  isLoading = true;

  const tbody = document.getElementById('table-body');

  // 1. CARREGAMENTO INSTANTÂNEO DA CACHE LOCAL
  const cachedDataStr = localStorage.getItem(CACHE_KEY);
  let hasValidCache = false;

  if (cachedDataStr) {
    try {
      const cachedData = JSON.parse(cachedDataStr);
      if (cachedData && typeof cachedData === 'object') {
        processRawData(cachedData);
        hasValidCache = true;
      }
    } catch (e) {
      console.warn("[API] Cache corrompida. Ignorando leitura inicial.");
    }
  }

  // Só exibe mensagem de carregamento se NÃO houver cache válida em memória
  if (!hasValidCache && tbody) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 2rem;">🔄 Carregando dados da planilha...</td></tr>`;
  }

  // 2. BUSCA EM SEGUNDO PLANO (BACKGROUND FETCH)
  try {
    const response = await fetchWithRetry(API_URL, { redirect: 'follow' }, 3, 1000);
    const data = await response.json();

    // Atualiza o estado da aplicação e renderiza a tabela com dados frescos
    processRawData(data);

    // Salva a resposta nova na cache para o próximo carregamento instantâneo
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[API] Erro ao guardar cache no localStorage:", e);
    }

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    // Exibe o erro na UI apenas se o utilizador não tiver dados da cache visualizáveis
    if (!hasValidCache && tbody) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color: #dc2626; padding: 2rem;">❌ Erro ao conectar com o servidor. Tente novamente em alguns segundos.</td></tr>`;
    }
  } finally {
    isLoading = false;
  }
}