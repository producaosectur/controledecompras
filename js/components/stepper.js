/**
 * Módulo da Esteira de Processo (Timeline Stepper)
 */

/**
 * Avalia os dados do registo e atualiza os estados da esteira visual
 * @param {Object} data - Dados da solicitação ativa
 */
export function renderStepper(data = {}) {
  const container = document.getElementById('process-stepper-container');
  if (!container) return;

  // Normalização e verificação de preenchimento dos campos principais
  const hasReq = Boolean(data.requisicao && String(data.requisicao).trim() !== '');
  const hasProt = Boolean(data.protocolo && String(data.protocolo).trim() !== '' && data.protocolo !== '-');
  const hasEmp = Boolean(data.fichas?.length || data.empenhos?.length || data.tagsEmpenho);
  const hasAf = Boolean(data.af && String(data.af).trim() !== '');
  const hasNf = Boolean(data.notas?.length || data.tagsNf);
  const hasNl = Boolean(data.nl?.length || data.tagsNl);

  // Mapeamento sequencial dos 6 passos da esteira
  const steps = [
    { label: 'Requisição', completed: hasReq },
    { label: 'Protocolo', completed: hasProt },
    { label: 'Empenho', completed: hasEmp },
    { label: 'AF / OS', completed: hasAf },
    { label: 'Nota Fiscal', completed: hasNf },
    { label: 'Liquidação NL', completed: hasNl }
  ];

  // Identifica a fase atual em andamento (primeiro passo não concluído)
  let activeIndex = steps.findIndex(s => !s.completed);
  if (activeIndex === -1 && steps.every(s => s.completed)) {
    activeIndex = steps.length - 1; // Tudo concluído
  }

  // Geração do HTML do Stepper
  container.innerHTML = `
    <div class="process-stepper">
      ${steps.map((step, index) => {
        let statusClass = '';
        if (step.completed) {
          statusClass = 'completed';
        } else if (index === activeIndex) {
          statusClass = 'active';
        }

        const badgeContent = step.completed ? '✓' : index + 1;

        return `
          <div class="step-item ${statusClass}">
            <div class="step-badge">${badgeContent}</div>
            <span class="step-label">${step.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}