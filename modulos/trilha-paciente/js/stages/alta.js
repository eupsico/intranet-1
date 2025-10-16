// Arquivo: /modulos/trilha-paciente/js/stages/alta.js

/**
 * Renderiza o conteúdo do modal para a etapa "Alta".
 * Esta etapa é apenas para visualização das informações de alta do paciente.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @returns {HTMLElement} - O elemento HTML para ser inserido no corpo do modal.
 */
export function render(cardId, cardData) {
  const element = document.createElement("div");

  let profissionalNome = "Não informado";
  let dataAlta = "Não informada";
  let motivoAlta = "Não informado";
  let fase = "N/A";

  // Verifica se a alta veio do Plantão, que é a fonte de dados principal para a alta.
  if (cardData.plantaoInfo && cardData.plantaoInfo.encerramento) {
    const encerramento = cardData.plantaoInfo.encerramento;

    profissionalNome = encerramento.responsavelNome || profissionalNome;
    // Formata a data para o padrão brasileiro
    if (encerramento.dataEncerramento) {
      // Adiciona T03:00:00 para ajustar o fuso horário e evitar problemas de data "um dia antes"
      dataAlta = new Date(
        encerramento.dataEncerramento + "T03:00:00"
      ).toLocaleDateString("pt-BR");
    }
    motivoAlta = encerramento.relato || motivoAlta;
    fase = "Em Atendimento (Plantão)";
  }
  // Futuramente, se a alta puder vir da Psicoterapia Breve (PB), a lógica pode ser adicionada aqui.
  // else if (cardData.pbInfo && cardData.pbInfo.desfecho === 'Alta') { ... }

  element.innerHTML = `
    <div class="patient-info-box confirmation">
        <h4>Informações da Alta</h4>
        <p><strong>Nome Paciente:</strong> ${
          cardData.nomeCompleto || "Não informado"
        }</p>
        <p><strong>Nome do Profissional:</strong> ${profissionalNome} (Fase: ${fase})</p>
        <p><strong>Data da Alta:</strong> ${dataAlta}</p>
        <hr>
        <p><strong>Motivo da Alta:</strong></p>
        <p style="white-space: pre-wrap; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">${motivoAlta}</p>
    </div>
    <p class="description-box" style="margin-top: 20px;">
        Esta é uma etapa final de visualização. Nenhuma outra ação é necessária para este card.
    </p>
  `;

  // Como esta é uma etapa de visualização, não há função 'save'.
  // O botão Salvar será escondido automaticamente pelo 'trilha-paciente.js'.
  return element;
}
