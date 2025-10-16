// Arquivo: /modulos/trilha-paciente/js/stages/desistencia.js
// Versão alinhada com alta.js para ler dados do encerramento do plantão.

/**
 * Renderiza o conteúdo do modal para a etapa "Desistência".
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @returns {HTMLElement} - O elemento HTML para ser inserido no corpo do modal.
 */
export function render(cardId, cardData) {
  const element = document.createElement("div");

  let profissionalNome = "Não informado";
  let dataDesistencia = "Não informada";
  let motivoDesistencia = "Não informado";
  let fase = "N/A";

  // Lógica UNIFICADA: Busca os dados de encerramento a partir do plantaoInfo.
  // Funciona para Alta e Desistência originadas do Plantão.
  if (cardData.plantaoInfo && cardData.plantaoInfo.encerramento) {
    const encerramento = cardData.plantaoInfo.encerramento;

    profissionalNome = encerramento.responsavelNome || profissionalNome;
    if (encerramento.dataEncerramento) {
      dataDesistencia = new Date(
        encerramento.dataEncerramento + "T03:00:00"
      ).toLocaleDateString("pt-BR");
    }
    // O campo "relato" é usado como o motivo
    motivoDesistencia = encerramento.relato || motivoDesistencia;
    fase = "Em Atendimento (Plantão)";
  }

  // O HTML é o mesmo do card de Alta, apenas com os títulos alterados.
  element.innerHTML = `
    <div class="patient-info-box warning"> <h4>Informações da Desistência</h4>
        <p><strong>Nome Paciente:</strong> ${
          cardData.nomeCompleto || "Não informado"
        }</p>
        <p><strong>Nome do Profissional:</strong> ${profissionalNome} (Fase: ${fase})</p>
        <p><strong>Data da Desistência:</strong> ${dataDesistencia}</p>
        <hr>
        <p><strong>Motivo da Desistência:</strong></p>
        <p style="white-space: pre-wrap; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">${motivoDesistencia}</p>
    </div>
    <p class="description-box" style="margin-top: 20px;">
        Esta é uma etapa final de visualização. Nenhuma outra ação é necessária para este card.
    </p>
  `;

  // Não há função 'save' necessária.
  return element;
}
