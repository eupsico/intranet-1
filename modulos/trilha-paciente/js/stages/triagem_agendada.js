// Arquivo: /modulos/trilha-paciente/js/stages/triagem_agendada.js
// Versão Corrigida: 3.0 (Parâmetros corrigidos e mais detalhes na visualização)

/**
 * Renderiza o conteúdo do modal para a etapa "Triagem Agendada".
 * Esta etapa é apenas para visualização.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @param {object} currentUserData - Dados do usuário logado (não utilizado aqui, mas mantido por padrão).
 * @returns {HTMLElement} - O elemento HTML para ser inserido no corpo do modal.
 */
export async function render(cardId, cardData, currentUserData) {
  const element = document.createElement("div");

  // Formata a data para o padrão brasileiro (dd/mm/yyyy), tratando a timezone
  const dataTriagemFormatada = cardData.dataTriagem
    ? new Date(cardData.dataTriagem + "T03:00:00").toLocaleDateString("pt-BR")
    : "Não informada";

  const dataNascimentoFormatada = cardData.dataNascimento
    ? new Date(cardData.dataNascimento + "T03:00:00").toLocaleDateString(
        "pt-BR"
      )
    : "Não informada";

  const tipoTriagem = cardData.tipoTriagem || "não definido";

  element.innerHTML = `
<h3 class="form-section-title">Confirmação do Agendamento</h3>
<div class="confirmation-box">
A triagem será realizada na modalidade <strong>${tipoTriagem}</strong>.
<strong>Paciente:</strong> ${cardData.nomeCompleto || "não informado"}
<strong>CPF:</strong> ${cardData.cpf || "não informado"}
<strong>Data de Nascimento:</strong> ${dataNascimentoFormatada}
<strong>Telefone:</strong> ${cardData.telefoneCelular || "não informado"}
<strong>E-mail:</strong> ${cardData.email || "não informado"}
<strong>Assistente Social:</strong> ${
    cardData.assistenteSocialNome || "não informado"
  }
<strong>Data e Horário:</strong> ${dataTriagemFormatada} às ${
    cardData.horaTriagem || "não informado"
  }
        </div>
        <p>Este card será atualizado automaticamente pela assistente social após a realização da triagem na tela "Fila de Atendimento".</p>
    `;

  // Como esta etapa é apenas de visualização, a função save não será exportada,
  // e o botão Salvar será escondido pelo trilha-paciente.js.

  return element;
}
