import { API_URL } from '../config.js';
import { state } from '../state.js';
import { calculatePaymentForecast, extractYearFromItem } from '../utils/dateUtils.js';
import { renderTags, renderFileChips } from './tags.js';
import { processFileList } from '../utils/fileUtils.js';
import { loadData } from '../services/apiService.js';
import { showToast } from './toast.js';
import { renderStepper } from './stepper.js';
import { applyFilters, populateFilterOptions } from './filters.js';

const CACHE_KEY = 'sectur_purchases_cache_v1';
let originalRecordData = null;

function parseCurrencyToFloat(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let cleanStr = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(cleanStr) || 0;
}

function formatCurrencyInput(val) {
  const numericValue = parseCurrencyToFloat(val);
  if (numericValue === 0 && (!val || val === '0')) return '';
  return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sanitizePastedText(text) {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setupPasteSanitizer() {
  const modalEl = document.getElementById('form-modal');
  if (!modalEl) return;

  modalEl.addEventListener('paste', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (target.type === 'file') return;
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const rawText = clipboardData ? clipboardData.getData('text') : '';
      const cleanText = sanitizePastedText(rawText);

      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const currentVal = target.value || '';
      
      target.value = currentVal.substring(0, start) + cleanText + currentVal.substring(end);
      target.selectionStart = target.selectionEnd = start + cleanText.length;

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function getCurrentFormSnapshot() {
  const isSemProt = document.getElementById('form-chk-sem-protocolo')?.checked;
  const rawValor = document.getElementById('form-valor')?.value;
  const floatValor = parseCurrencyToFloat(rawValor);

  return {
    protocolo: isSemProt ? "" : String(document.getElementById('form-protocolo')?.value || '').trim(),
    requisicao: String(document.getElementById('form-requisicao')?.value || '').trim(),
    af: String(document.getElementById('form-af')?.value || '').trim(),
    evento: String(document.getElementById('form-evento')?.value || '').trim(),
    local: String(document.getElementById('form-local')?.value || '').trim(),
    descritivo: String(document.getElementById('form-descritivo')?.value || '').trim(),
    valor: floatValor.toFixed(2),
    entrega: String(document.getElementById('form-entrega')?.value || '').trim(),
    dataProcesso: String(document.getElementById('form-data-processo')?.value || '').trim(),
    cancelado: Boolean(document.getElementById('form-chk-cancelado')?.checked),
    tagsFicha: (state.currentTags.ficha || []).join(','),
    tagsEmpenho: (state.currentTags.empenho || []).join(','),
    tagsNf: (state.currentTags.nf || []).join(','),
    tagsNl: (state.currentTags.nl || []).join(','),
    filesReqCount: (state.currentFiles.req || []).length,
    filesAfCount: (state.currentFiles.af || []).length,
    filesNfCount: (state.currentFiles.nf || []).length,
    filesNlCount: (state.currentFiles.nl || []).length
  };
}

function isFormDirty() {
  if (!originalRecordData) return false;
  const currentSnapshot = getCurrentFormSnapshot();
  return Object.keys(originalRecordData).some(
    key => originalRecordData[key] !== currentSnapshot[key]
  );
}

function setupBeforeUnloadListener() {
  window.addEventListener('beforeunload', (e) => {
    const modalEl = document.getElementById('form-modal');
    const isModalOpen = modalEl && (modalEl.style.display === 'flex' || modalEl.style.display === 'block');
    
    if (isModalOpen && isFormDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
setupBeforeUnloadListener();

function checkDuplicateFields() {
  const currentId = document.getElementById('form-id')?.value;
  const isSemProt = document.getElementById('form-chk-sem-protocolo')?.checked;
  const protVal = isSemProt ? '' : (document.getElementById('form-protocolo')?.value || '').trim();
  const reqVal = (document.getElementById('form-requisicao')?.value || '').trim();

  const getOrCreateWarnEl = (inputId, warnId) => {
    let el = document.getElementById(warnId);
    if (!el) {
      const inputEl = document.getElementById(inputId);
      if (inputEl) {
        const containerGroup = inputEl.closest('.form-group') || inputEl.parentNode;
        el = document.createElement('small');
        el.id = warnId;
        el.style.cssText = 'color: #f59e0b; font-size: 0.75rem; font-weight: 500; display: block; margin-top: 0.35rem; width: 100%; clear: both;';
        containerGroup.appendChild(el);
      }
    }
    return el;
  };

  const warnProtEl = getOrCreateWarnEl('form-protocolo', 'warn-duplicate-protocolo');
  const warnReqEl = getOrCreateWarnEl('form-requisicao', 'warn-duplicate-requisicao');

  if (protVal && protVal !== '-' && state.purchasesData) {
    const dupProt = state.purchasesData.find(item => item.id !== currentId && String(item.protocolo || '').trim().toLowerCase() === protVal.toLowerCase());
    if (dupProt) {
      if (warnProtEl) warnProtEl.innerText = `⚠️ Protocolo já cadastrado (${dupProt.evento || 'Registro ' + dupProt.id})`;
    } else {
      if (warnProtEl) warnProtEl.innerText = '';
    }
  } else {
    if (warnProtEl) warnProtEl.innerText = '';
  }

  if (reqVal && reqVal !== '-' && state.purchasesData) {
    const dupReq = state.purchasesData.find(item => item.id !== currentId && String(item.requisicao || '').trim().toLowerCase() === reqVal.toLowerCase());
    if (dupReq) {
      if (warnReqEl) warnReqEl.innerText = `⚠️ Requisição já cadastrada (${dupReq.evento || 'Registro ' + dupReq.id})`;
    } else {
      if (warnReqEl) warnReqEl.innerText = '';
    }
  } else {
    if (warnReqEl) warnReqEl.innerText = '';
  }
}

export async function copyRecordSummary() {
  const formIdVal = document.getElementById('form-id')?.value;
  const isSemProt = document.getElementById('form-chk-sem-protocolo')?.checked;
  const protocolo = isSemProt ? 'Aguardando...' : (document.getElementById('form-protocolo')?.value || 'Aguardando...').trim();
  const requisicao = (document.getElementById('form-requisicao')?.value || '-').trim();
  const af = (document.getElementById('form-af')?.value || '-').trim();
  const evento = (document.getElementById('form-evento')?.value || '-').trim();
  const local = (document.getElementById('form-local')?.value || '-').trim();
  const descritivo = (document.getElementById('form-descritivo')?.value || '-').trim();
  const rawValor = document.getElementById('form-valor')?.value;
  const floatValor = parseCurrencyToFloat(rawValor);
  const valorFormatted = floatValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isCancelado = document.getElementById('form-chk-cancelado')?.checked;

  const fichas = (state.currentTags.ficha || []).join(', ') || '-';
  const empenhos = (state.currentTags.empenho || []).join(', ') || '-';
  const notas = (state.currentTags.nf || []).join(', ') || '-';
  const nl = (state.currentTags.nl || []).join(', ') || '-';

  let statusText = 'Em Andamento';
  if (isCancelado) {
    statusText = 'CANCELADO';
  } else if ((state.currentTags.nl || []).length > 0) {
    statusText = 'Concluído (NL emitida)';
  } else if ((state.currentTags.nf || []).length > 0) {
    statusText = 'Com Nota Fiscal';
  } else if (protocolo && protocolo !== 'Aguardando...') {
    statusText = 'Com Protocolo';
  }

  const summaryText = 
`📌 SOLICITAÇÃO DE COMPRA ${formIdVal ? `(#${formIdVal})` : ''}
-----------------------------------
• Protocolo: ${protocolo}
• Requisição: ${requisicao}
• Evento/Local: ${evento} (${local})
• Descritivo: ${descritivo}
• Valor: ${valorFormatted}
• Fichas: ${fichas}
• Empenho(s): ${empenhos}
• AF/OS: ${af}
• Nota(s) Fiscal(is): ${notas}
• Liquidação(ões) NL: ${nl}
• Status: ${statusText}
-----------------------------------`;

  try {
    await navigator.clipboard.writeText(summaryText);
    showToast("📋 Resumo copiado para a área de transferência!", "success");
  } catch (err) {
    console.error("Erro ao copiar:", err);
    showToast("Erro ao copiar resumo.", "error");
  }
}

export function setupModalInputMasks() {
  const valorInput = document.getElementById('form-valor');
  if (valorInput) {
    valorInput.type = 'text';
    valorInput.placeholder = 'R$ 0,00';

    valorInput.addEventListener('input', (e) => {
      let digitsOnly = e.target.value.replace(/\D/g, '');
      if (!digitsOnly) {
        e.target.value = '';
        return;
      }
      let floatVal = parseFloat(digitsOnly) / 100;
      e.target.value = floatVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    });
  }

  ['form-protocolo', 'form-requisicao', 'form-af'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', checkDuplicateFields);
      input.addEventListener('blur', (e) => {
        e.target.value = e.target.value.trim().replace(/\s+/g, ' ');
        checkDuplicateFields();
      });
    }
  });

  setupPasteSanitizer();
}

function showCustomConfirm(title, message, okText = "Sim, Salvar", cancelText = "Cancelar") {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('custom-confirm-title');
    const msgEl = document.getElementById('custom-confirm-message');
    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');

    if (!overlay) {
      resolve(window.confirm(message));
      return;
    }

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (okBtn) okBtn.innerText = okText;
    if (cancelBtn) cancelBtn.innerText = cancelText;

    overlay.style.display = 'flex';

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

export function toggleProtocoloInput(isSemProtocolo) {
  const inputProt = document.getElementById('form-protocolo');
  if (!inputProt) return;
  if (isSemProtocolo) {
    inputProt.value = '';
    inputProt.disabled = true;
    inputProt.style.opacity = '0.5';
  } else {
    inputProt.disabled = false;
    inputProt.style.opacity = '1';
  }
  checkDuplicateFields();
}

export function updatePrevisaoBanner(entregaVal) {
  const boxBanner = document.getElementById('box-previsao-pagamento');
  const tagData = document.getElementById('tag-previsao-data');
  
  const previsaoStr = calculatePaymentForecast(entregaVal);
  if (previsaoStr) {
    if (tagData) tagData.innerText = previsaoStr;
    if (boxBanner) boxBanner.style.display = 'flex';
  } else {
    if (boxBanner) boxBanner.style.display = 'none';
  }
}

export function resetModalScroll() {
  const modalContent = document.querySelector('#form-modal .modal-content') || document.querySelector('#form-modal > div');
  if (modalContent) modalContent.scrollTop = 0;
  const formModal = document.getElementById('form-modal');
  if (formModal) formModal.scrollTop = 0;
}

export function openModal() {
  const form = document.getElementById('purchase-form');
  if (form) form.reset();
  
  setupModalInputMasks();

  const formId = document.getElementById('form-id');
  if (formId) formId.value = '';

  const chkSemProt = document.getElementById('form-chk-sem-protocolo');
  if (chkSemProt) chkSemProt.checked = false;
  toggleProtocoloInput(false);

  const boxBanner = document.getElementById('box-previsao-pagamento');
  if (boxBanner) boxBanner.style.display = 'none';
  
  state.currentTags = { ficha: [], empenho: [], nf: [], nl: [] };
  ['ficha', 'empenho', 'nf', 'nl'].forEach(renderTags);

  state.currentFiles = { req: [], af: [], nf: [], nl: [] };
  ['req', 'af', 'nf', 'nl'].forEach(renderFileChips);

  renderStepper({});

  const deleteBtn = document.getElementById('btn-delete-record');
  if (deleteBtn) deleteBtn.style.display = 'none';

  const copyBtn = document.getElementById('btn-copy-summary');
  if (copyBtn) copyBtn.style.display = 'none';

  const modalTitle = document.getElementById('modal-title');
  if (modalTitle) modalTitle.innerText = 'Nova Solicitação de Compra';

  originalRecordData = {
    protocolo: "",
    requisicao: "",
    af: "",
    evento: "",
    local: "",
    descritivo: "",
    valor: "0.00",
    entrega: "",
    dataProcesso: "",
    cancelado: false,
    tagsFicha: "",
    tagsEmpenho: "",
    tagsNf: "",
    tagsNl: "",
    filesReqCount: 0,
    filesAfCount: 0,
    filesNfCount: 0,
    filesNlCount: 0
  };

  const formModal = document.getElementById('form-modal');
  if (formModal) formModal.style.display = 'flex';

  resetModalScroll();
  checkDuplicateFields();
}

export async function closeModal() {
  if (isFormDirty()) {
    const confirmDiscard = await showCustomConfirm(
      "Descartar Alterações?",
      "Você possui alterações não salvas neste formulário. Tem certeza de que deseja fechar e descartar as informações?",
      "Sim, Descartar",
      "Continuar Editando"
    );

    if (!confirmDiscard) {
      return;
    }
  }

  const formModal = document.getElementById('form-modal');
  if (formModal) formModal.style.display = 'none';
}

export function editRecord(id) {
  const item = state.purchasesData.find(d => d.id === id);
  if (!item) return;

  setupModalInputMasks();

  const formId = document.getElementById('form-id');
  if (formId) formId.value = item.id;

  const formProtocolo = document.getElementById('form-protocolo');
  if (formProtocolo) formProtocolo.value = item.protocolo || '';
  
  const protStr = String(item.protocolo || '').trim();
  const semProtocolo = !protStr || protStr === '-';
  const chkSemProt = document.getElementById('form-chk-sem-protocolo');
  if (chkSemProt) chkSemProt.checked = semProtocolo;
  toggleProtocoloInput(semProtocolo);

  const setVal = (idEl, val) => {
    const el = document.getElementById(idEl);
    if (el) el.value = val || '';
  };

  setVal('form-requisicao', item.requisicao);
  setVal('form-af', item.af);
  setVal('form-evento', item.evento);
  setVal('form-local', item.local);
  setVal('form-descritivo', item.descritivo);
  
  const valorInput = document.getElementById('form-valor');
  if (valorInput) {
    valorInput.value = formatCurrencyInput(item.valor);
  }

  setVal('form-entrega', item.entrega);
  setVal('form-data-processo', item.dataProcesso);

  const chkCancelado = document.getElementById('form-chk-cancelado');
  if (chkCancelado) chkCancelado.checked = Boolean(item.cancelado);

  updatePrevisaoBanner(item.entrega);

  state.currentTags = {
    ficha: [...(item.fichas || [])],
    empenho: [...(item.empenhos || [])],
    nf: [...(item.notas || [])],
    nl: [...(item.nl || [])]
  };
  ['ficha', 'empenho', 'nf', 'nl'].forEach(renderTags);

  state.currentFiles = {
    req: item.anexosReq ? [...item.anexosReq] : [],
    af: item.anexosAf ? [...item.anexosAf] : [],
    nf: item.anexosNf ? [...item.anexosNf] : [],
    nl: item.anexosNl ? [...item.anexosNl] : []
  };
  ['req', 'af', 'nf', 'nl'].forEach(renderFileChips);

  renderStepper(item);

  const actionsDiv = document.querySelector('#purchase-form .form-actions') || document.querySelector('#form-modal .modal-footer');

  let deleteBtn = document.getElementById('btn-delete-record');
  if (!deleteBtn) {
    deleteBtn = document.createElement('button');
    deleteBtn.id = 'btn-delete-record';
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.cssText = 'background-color: #dc2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-right: 0.5rem;';
    deleteBtn.innerText = '🗑️ Excluir Registro';
    deleteBtn.onclick = confirmAndDeleteRecord;
    
    if (actionsDiv) actionsDiv.prepend(deleteBtn);
  } else {
    deleteBtn.innerText = '🗑️ Excluir Registro';
    deleteBtn.style.display = 'inline-block';
  }

  let copyBtn = document.getElementById('btn-copy-summary');
  if (!copyBtn) {
    copyBtn = document.createElement('button');
    copyBtn.id = 'btn-copy-summary';
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary';
    copyBtn.style.cssText = 'background-color: #4b5563; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-right: auto;';
    copyBtn.innerText = '📋 Copiar Resumo';
    copyBtn.onclick = copyRecordSummary;
    
    if (actionsDiv) {
      if (deleteBtn) {
        deleteBtn.after(copyBtn);
      } else {
        actionsDiv.prepend(copyBtn);
      }
    }
  } else {
    copyBtn.style.display = 'inline-block';
  }

  const modalTitle = document.getElementById('modal-title');
  if (modalTitle) modalTitle.innerText = `Editar Solicitação ${item.protocolo || '(Sem Protocolo)'}`;
  
  originalRecordData = {
    protocolo: semProtocolo ? "" : String(item.protocolo || '').trim(),
    requisicao: String(item.requisicao || '').trim(),
    af: String(item.af || '').trim(),
    evento: String(item.evento || '').trim(),
    local: String(item.local || '').trim(),
    descritivo: String(item.descritivo || '').trim(),
    valor: parseCurrencyToFloat(item.valor).toFixed(2),
    entrega: String(item.entrega || '').trim(),
    dataProcesso: String(item.dataProcesso || '').trim(),
    cancelado: Boolean(item.cancelado),
    tagsFicha: (item.fichas || []).join(','),
    tagsEmpenho: (item.empenhos || []).join(','),
    tagsNf: (item.notas || []).join(','),
    tagsNl: (item.nl || []).join(','),
    filesReqCount: (item.anexosReq || []).length,
    filesAfCount: (item.anexosAf || []).length,
    filesNfCount: (item.anexosNf || []).length,
    filesNlCount: (item.anexosNl || []).length
  };

  const formModal = document.getElementById('form-modal');
  if (formModal) formModal.style.display = 'flex';

  resetModalScroll();
  checkDuplicateFields();
}

/**
 * Exclui o registro com atualização otimista (Instantânea no DOM)
 */
export async function confirmAndDeleteRecord() {
  const id = document.getElementById('form-id')?.value;
  if (!id) return;

  const confirmed = await showCustomConfirm(
    "Excluir Registro Permanentemente",
    "Tem certeza que deseja excluir esta solicitação? Esta ação removerá o registro e todos os seus vínculos.",
    "Sim, Excluir",
    "Cancelar"
  );
  if (!confirmed) return;

  const tableContainer = document.querySelector('.table-container');
  const currentScrollTop = tableContainer ? tableContainer.scrollTop : 0;

  // 1. ATUALIZAÇÃO OTIMISTA LOCAL (0ms)
  state.purchasesData = state.purchasesData.filter(d => d.id !== id);
  populateFilterOptions();
  applyFilters();
  if (tableContainer) tableContainer.scrollTop = currentScrollTop;

  originalRecordData = null;
  closeModal();
  showToast("Registro excluído com sucesso!", "success");

  // 2. ENVIO EM SEGUNDO PLANO PARA O BACKEND
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ACTION: "DELETE", ID_SOLICITACAO: id })
    });
  } catch (err) {
    console.error("Erro ao sincronizar exclusão:", err);
    showToast("⚠️ Falha na sincronização. Atualize a página se necessário.", "error");
  }
}

/**
 * Salva/Edita o registro com atualização otimista (Instantânea no DOM + Persistência de Scroll)
 */
export async function handleFormSubmit(e) {
  e.preventDefault();

  ['ficha', 'empenho', 'nf', 'nl'].forEach(type => {
    const inputEl = document.getElementById(`input-tag-${type}`);
    if (inputEl && inputEl.value.trim() !== '') {
      const val = inputEl.value.trim();
      if (!state.currentTags[type].includes(val)) {
        state.currentTags[type].push(val);
      }
    }
  });

  const formIdVal = document.getElementById('form-id')?.value.trim();
  const isEditing = Boolean(formIdVal !== "");
  const isSemProtocolo = document.getElementById('form-chk-sem-protocolo')?.checked;

  const rawValor = document.getElementById('form-valor')?.value;
  const floatValor = parseCurrencyToFloat(rawValor);

  if (isEditing && originalRecordData) {
    const hasChanged = isFormDirty();

    if (!hasChanged) {
      originalRecordData = null;
      closeModal();
      return;
    }

    const confirmSave = await showCustomConfirm(
      "Confirmar Alterações",
      "Você fez alterações neste registro. Tem certeza que deseja salvá-las no sistema?",
      "Sim, Salvar",
      "Continuar Editando"
    );

    if (!confirmSave) {
      return;
    }
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerText = "⚡ Salvando...";
    submitBtn.disabled = true;
  }

  try {
    const [filesReqPayload, filesAfPayload, filesNfPayload, filesNlPayload] = await Promise.all([
      processFileList(state.currentFiles.req),
      processFileList(state.currentFiles.af),
      processFileList(state.currentFiles.nf),
      processFileList(state.currentFiles.nl)
    ]);

    const recordId = isEditing ? formIdVal : "SOL" + Date.now();
    const protocoloVal = isSemProtocolo ? "" : (document.getElementById('form-protocolo')?.value || '').trim();
    const eventoVal = document.getElementById('form-evento')?.value || '';
    const localVal = document.getElementById('form-local')?.value || '';
    const descritivoVal = document.getElementById('form-descritivo')?.value || '';
    const requisicaoVal = (document.getElementById('form-requisicao')?.value || '').trim();
    const afVal = (document.getElementById('form-af')?.value || '').trim();
    const entregaVal = document.getElementById('form-entrega')?.value || '';
    const dataProcessoVal = document.getElementById('form-data-processo')?.value || '';
    const chkCanceladoVal = Boolean(document.getElementById('form-chk-cancelado')?.checked);

    const updatedRecord = {
      id: recordId,
      protocolo: protocoloVal,
      evento: eventoVal,
      local: localVal,
      descritivo: descritivoVal,
      requisicao: requisicaoVal,
      fichas: [...state.currentTags.ficha],
      empenhos: [...state.currentTags.empenho],
      notas: [...state.currentTags.nf],
      nl: [...state.currentTags.nl],
      valor: floatValor,
      af: afVal,
      entrega: entregaVal,
      dataProcesso: dataProcessoVal,
      ano: String(extractYearFromItem({ DATA_PROCESSO: dataProcessoVal, ENTREGA: entregaVal }) || new Date().getFullYear()),
      cancelado: chkCanceladoVal,
      anexosReq: [...state.currentFiles.req],
      anexosAf: [...state.currentFiles.af],
      anexosNf: [...state.currentFiles.nf],
      anexosNl: [...state.currentFiles.nl]
    };

    // Capta a posição do scroll da tabela antes de re-renderizar
    const tableContainer = document.querySelector('.table-container');
    const currentScrollTop = tableContainer ? tableContainer.scrollTop : 0;

    // 1. ATUALIZAÇÃO OTIMISTA DA MEMÓRIA LOCAL (0ms)
    if (isEditing) {
      const idx = state.purchasesData.findIndex(d => d.id === recordId);
      if (idx !== -1) state.purchasesData[idx] = updatedRecord;
    } else {
      state.purchasesData.unshift(updatedRecord);
    }

    // Atualiza dropdowns, filtra e re-renderiza com DocumentFragment mantendo o scroll
    populateFilterOptions();
    applyFilters();
    if (tableContainer) tableContainer.scrollTop = currentScrollTop;

    originalRecordData = null;
    closeModal();
    showToast(isEditing ? "Solicitação atualizada com sucesso!" : "Nova solicitação criada com sucesso!", "success");

    // 2. DISPARO EM SEGUNDO PLANO PARA A API
    const payload = {
      ID_SOLICITACAO: recordId,
      PROTOCOLO: protocoloVal,
      REQUISICAO: requisicaoVal,
      AF_OS: afVal,
      EVENTO: eventoVal,
      LOCAL: localVal,
      DESCRITIVO: descritivoVal,
      VALOR_TOTAL: floatValor,
      ENTREGA: entregaVal,
      DATA_PROCESSO: dataProcessoVal,
      CHK_CANCELADO: chkCanceladoVal,
      LISTA_FICHAS: state.currentTags.ficha,
      LISTA_EMPENHOS: state.currentTags.empenho,
      LISTA_NOTAS: state.currentTags.nf,
      LISTA_NL: state.currentTags.nl,
      FILES_REQ: filesReqPayload,
      FILES_AF: filesAfPayload,
      FILES_NF: filesNfPayload,
      FILES_NL: filesNlPayload
    };

    fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(err => console.error("Erro no salvamento em segundo plano:", err));

  } catch (err) {
    console.error("Erro ao salvar:", err);
    showToast("Erro ao processar dados no sistema.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.innerText = "Salvar Registro";
      submitBtn.disabled = false;
    }
  }
}