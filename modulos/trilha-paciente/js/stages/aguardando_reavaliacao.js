// Arquivo: /modulos/trilha-paciente/js/stages/aguardando_reavaliacao.js
// Exibe informações sobre o agendamento da reavaliação

import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o conteúdo do modal para um paciente aguardando reavaliação.
 * @param {string} cardId - ID do paciente (documento em trilhaPaciente)
 * @param {object} cardData - Dados do paciente (de trilhaPaciente)
 * @param {object} currentUserData - Dados do usuário logado
 * @returns {Promise<HTMLElement>} - O elemento HTML com os detalhes.
 */
export async function render(cardId, cardData, currentUserData) {
  const contentDiv = document.createElement("div");
  contentDiv.className = "stage-details-container";
  contentDiv.innerHTML =
    '<div class="loading-spinner">Carregando detalhes do agendamento...</div>';

  try {
    // Buscar o agendamento de reavaliação mais recente para este paciente
    const agendamentosRef = collection(db, "agendamentos");
    const q = query(
      agendamentosRef,
      where("pacienteId", "==", cardId),
      where("tipo", "==", "reavaliacao"),
      orderBy("criadoEm", "desc"), // Pega o mais recente
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      contentDiv.innerHTML = `<p><strong>Status:</strong> Aguardando Reavaliação</p>
                                    <p class="info-note warning">Nenhum agendamento de reavaliação encontrado para este paciente.</p>`;
      return contentDiv;
    }

    const agendamento = snapshot.docs[0].data();
    const dataAgendamento = agendamento.dataAgendamento?.toDate
      ? agendamento.dataAgendamento.toDate().toLocaleDateString("pt-BR")
      : "N/A";
    const horaAgendamento = agendamento.dataAgendamento?.toDate
      ? agendamento.dataAgendamento
          .toDate()
          .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "N/A";
    const valorAtualFormatado = agendamento.solicitacaoInfo
      ?.valorContribuicaoAtual
      ? `R$ ${parseFloat(agendamento.solicitacaoInfo.valorContribuicaoAtual)
          .toFixed(2)
          .replace(".", ",")}`
      : "N/A";

    contentDiv.innerHTML = `
            <h4>Detalhes da Reavaliação Agendada</h4>
            <div class="patient-info-group"><strong>Paciente:</strong><p>${
              agendamento.pacienteNome || cardData.nomeCompleto || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Data Agendada:</strong><p>${dataAgendamento}</p></div>
            <div class="patient-info-group"><strong>Hora Agendada:</strong><p>${horaAgendamento}</p></div>
            <div class="patient-info-group"><strong>Modalidade:</strong><p>${
              agendamento.modalidade || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Assistente Social:</strong><p>${
              agendamento.assistenteSocialNome || "N/A"
            }</p></div>
            <hr>
            <h4>Informações da Solicitação</h4>
            <div class="patient-info-group"><strong>Solicitado por:</strong><p>${
              agendamento.profissionalNome || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Valor Contribuição (na solicitação):</strong><p>${valorAtualFormatado}</p></div>
            <div class="patient-info-group"><strong>Motivo (informado pelo profissional):</strong><p>${
              agendamento.solicitacaoInfo?.motivoReavaliacao || "N/A"
            }</p></div>
            <hr>
            <p>Aguardando realização pelo Serviço Social.</p>
        `;
  } catch (error) {
    console.error("Erro ao buscar detalhes da reavaliação:", error);
    contentDiv.innerHTML = `<p class="info-note danger">Erro ao carregar detalhes do agendamento.</p>`;
  }

  return contentDiv;
}

// Não há função 'save' para esta etapa, pois a ação é feita pelo Serviço Social
// export async function save(cardId, cardData, formContainer) {
//     // Lógica de salvamento, se aplicável
// }
