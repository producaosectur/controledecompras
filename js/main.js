import { loadData } from './services/apiService.js';
import { applyFilters, clearAllFilters } from './components/filters.js';
import { setupTableHeaderSort } from './components/table.js';
import { addTag, handleFileSelect } from './components/tags.js';
import { openModal, closeModal, handleFormSubmit, updatePrevisaoBanner, toggleProtocoloInput } from './components/modal.js';
import { exportToExcel } from './components/exporter.js';
import { showToast } from './components/toast.js';

// Expor funções necessárias para eventos HTML inline
window.toggleTheme = toggleTheme;
window.applyFilters = applyFilters;
window.clearAllFilters = clearAllFilters;
window.clearFilters = clearAllFilters;
window.exportToExcel = exportToExcel;
window.openModal = openModal;
window.closeModal = closeModal;
window.addTag = addTag;
window.handleFileSelect = handleFileSelect;
window.toggleProtocoloInput = toggleProtocoloInput;
window.toggleShortcutsModal = toggleShortcutsModal;

let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  setupGlobalErrorHandler();
  setupNetworkStatusListeners();
  initTheme();
  loadData();
  setupEventListeners();
  setupTableHeaderSort(applyFilters);
  setupGlobalShortcuts();
});

/**
 * Monitora o status da conexão com a internet e exibe notificações temporárias (Toast)
 */
function setupNetworkStatusListeners() {
  window.addEventListener('offline', () => {
    showToast('⚠️ Você está sem conexão com a internet. Evite salvar dados.', 'error');
  });

  window.addEventListener('online', () => {
    showToast('🌐 Conexão reestabelecida com sucesso!', 'success');
  });
}

/**
 * Captura global de erros não tratados para garantir estabilidade da UI (Graceful Degradation)
 */
function setupGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    console.error('[Global Error]:', event.error || event.message);
    showToast('Ocorreu um erro inesperado na interface.', 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]:', event.reason);
    showToast('Falha na resposta de uma operação em segundo plano.', 'error');
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) toggleBtn.innerText = '☀️ Modo Claro';
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.innerText = isDark ? '☀️ Modo Escuro' : '🌙 Modo Escuro';
}

function setupEventListeners() {
  const form = document.getElementById('purchase-form');
  if (form) {
    // Bloqueio de duplo envio no submit
    form.addEventListener('submit', (e) => {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.disabled) {
        e.preventDefault();
        return;
      }
      handleFormSubmit(e);
    });

    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (e.target.id && e.target.id.startsWith('input-tag-')) {
          const tagType = e.target.id.replace('input-tag-', '');
          addTag(tagType);
        }
      }
    });
  }

  // Pesquisa Global com Debounce de 300ms e resposta imediata ao pressionar Enter
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFilters();
      }, 300);
    });

    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        applyFilters();
      }
    });
  }

  const filterAno = document.getElementById('filter-ano');
  const filterLocal = document.getElementById('filter-local');
  const filterEvento = document.getElementById('filter-evento');
  const filterStatus = document.getElementById('filter-status');

  if (filterAno) filterAno.addEventListener('change', applyFilters);
  if (filterLocal) filterLocal.addEventListener('change', applyFilters);
  if (filterEvento) filterEvento.addEventListener('change', applyFilters);
  if (filterStatus) filterStatus.addEventListener('change', applyFilters);

  const entregaInput = document.getElementById('form-entrega');
  if (entregaInput) {
    entregaInput.addEventListener('change', (e) => {
      updatePrevisaoBanner(e.target.value);
    });
  }
}

/**
 * Exibe ou oculta o modal de ajuda com atalhos do teclado (com Focus Trap para acessibilidade)
 */
function toggleShortcutsModal() {
  let modal = document.getElementById('shortcuts-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="shortcuts-card">
        <h3>⌨️ Atalhos de Teclado</h3>
        <ul class="shortcuts-list">
          <li><kbd>Alt + N</kbd> Nova Solicitação</li>
          <li><kbd>Ctrl + F</kbd> Focar na Pesquisa</li>
          <li><kbd>Esc</kbd> Fechar Modal / Limpar</li>
          <li><kbd>Shift + ?</kbd> Abrir este guia</li>
        </ul>
        <button id="btn-close-shortcuts" onclick="window.toggleShortcutsModal()" class="btn btn-secondary" style="width:100%; margin-top:0.5rem;">Entendido</button>
      </div>
    `;

    // Captura de Foco Automático (Focus Trap)
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });

    document.body.appendChild(modal);
    document.getElementById('btn-close-shortcuts')?.focus();
    return;
  }

  const isVisible = modal.style.display === 'flex';
  modal.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) {
    document.getElementById('btn-close-shortcuts')?.focus();
  }
}

/**
 * Atalhos de teclado globais para navegação rápida de utilizadores avançados
 */
function setupGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignora atalhos se o foco estiver digitando em um input/textarea (exceto Esc)
    const isEditingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    // Shift + ?: Guia de Atalhos
    if (e.shiftKey && e.key === '?') {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }

    // Alt + N: Abre modal de Nova Solicitação
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openModal();
      return;
    }

    // Ctrl + F: Foca na barra de pesquisa
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Esc: Fecha modal de atalhos ou modal principal
    if (e.key === 'Escape') {
      const shortcutsModal = document.getElementById('shortcuts-modal');
      if (shortcutsModal && shortcutsModal.style.display === 'flex') {
        shortcutsModal.style.display = 'none';
        return;
      }

      const modal = document.getElementById('form-modal') || document.getElementById('purchase-modal');
      if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
        closeModal();
      }
    }
  });
}