// Arquivo: /modulos/trilha-paciente/js/stages/aguardando_info_horarios.js
// Versão: 1.0 (Criação do módulo de visualização)

/**
 * Renderiza o conteúdo do modal para a etapa 'Aguardando Info Horários'.
 * Este é um estágio de visualização, aguardando a ação do profissional.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Os dados do paciente.
 * @returns {HTMLElement} O elemento HTML com as informações.
 */
export function render(cardId, cardData) {
  // 1. Cria o elemento container principal
  const element = document.createElement("div");

  // 2. Encontra o atendimento de PB que está ativo para este paciente
  // Isso é importante para pegar os dados do profissional correto
  const atendimentoAtivo =
    cardData.atendimentosPB?.find((at) => at.statusAtendimento === "ativo") ||
    {}; // Usa um objeto vazio como fallback para evitar erros

  // 3. Formata a data de encaminhamento para um formato legível
  const dataEncaminhamentoFormatada = atendimentoAtivo.dataEncaminhamento
    ? new Date(
        atendimentoAtivo.dataEncaminhamento + "T03:00:00"
      ).toLocaleDateString("pt-BR")
    : "Não informada";

  // 4. Monta o HTML com as informações solicitadas
  element.innerHTML = `
    <div class="patient-info-box">
        <h4>Detalhes do Encaminhamento</h4>
        
        <div class="details-grid">
            <p><strong>Nome Paciente:</strong></p>
            <p>${cardData.nomeCompleto || "Não informado"}</p>
            
            <p><strong>Nome Terapeuta:</strong></p>
            <p>${atendimentoAtivo.profissionalNome || "Não atribuído"}</p>
            
            <p><strong>Sessão:</strong></p>
            <p>A ser definido pelo profissional</p>
            
            <p><strong>Telefone de Contato:</strong></p>
            <p>${cardData.telefoneCelular || "Não informado"}</p>
            
            <p><strong>Contribuição:</strong></p>
            <p>${cardData.valorContribuicao || "Não informado"}</p>
            
            <p><strong>Data do Encaminhamento:</strong></p>
            <p>${dataEncaminhamentoFormatada}</p>
        </div>
    </div>

    <div class="info-message" style="margin-top: 20px; text-align: center; padding: 15px; background-color: #e7f3fe; border-left: 6px solid #2196F3;">
        <p style="margin: 0; font-size: 1.1em; color: #1a252f;"><strong>Aguardando profissional informar os horários de atendimento.</strong></p>
    </div>
  `;

  // 5. Retorna o elemento pronto para ser exibido no modal
  return element;
}

// Como este é um módulo de visualização, não exportamos uma função 'save'.
// O arquivo principal (trilha-paciente.js) irá detectar isso e ocultar o botão "Salvar".
export default { render };
