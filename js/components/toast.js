/**
 * Módulo de Notificações Toast com animação de entrada e saída suaves
 */

function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Exibe uma notificação toast na tela
 * @param {string} message - Texto da mensagem
 * @param {'success'|'error'|'info'|'warning'} type - Tipo da notificação
 * @param {number} duration - Tempo de exibição em milissegundos (padrão: 3500ms)
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // 1. Inicia o slide-out 400ms antes do fim da duração
  setTimeout(() => {
    toast.classList.add('toast-hiding');
  }, Math.max(0, duration - 400));

  // 2. Remove do DOM exatamente no final dos 400ms da animação
  setTimeout(() => {
    toast.remove();
  }, duration);
}