// Arquivo: /modulos/trilha-paciente/js/stages/em_atendimento_pb.js
// Versão: 2.1 (Interface focada em visualização, com registro manual como ação de exceção)

import {
  getFunctions,
  httpsCallable,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o formulário para a etapa "Em Atendimento (PB)".
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @returns {HTMLElement} - O elemento HTML com o formulário.
 */
export function render(cardId, cardData) {
  const element = document.createElement("div");

  const atendimentosAtivos =
    cardData.atendimentosPB?.filter((at) => at.statusAtendimento === "ativo") ||
    []; // --- SEÇÃO PRINCIPAL: RESUMO INFORMATIVO ---

  const resumoAtendimentosHtml = atendimentosAtivos
    .map((atendimento) => {
      const horarioInfo = atendimento.horarioSessao || {};
      const dataInicioFormatada = horarioInfo.dataInicio
        ? new Date(horarioInfo.dataInicio + "T03:00:00").toLocaleDateString(
            "pt-BR"
          )
        : "Não informada";

      const contratoInfo = atendimento.contratoAssinado;
      let dataAssinatura = "Aguardando Assinatura"; // --- CORREÇÃO AQUI --- // Usamos o método .toDate() para converter o Timestamp do Firebase em um objeto Date do JavaScript
      if (
        contratoInfo &&
        contratoInfo.assinadoEm &&
        typeof contratoInfo.assinadoEm.toDate === "function"
      ) {
        dataAssinatura = `Assinado em ${contratoInfo.assinadoEm
          .toDate()
          .toLocaleDateString("pt-BR")}`;
      }

      return `
      <div class="patient-info-box info" style="margin-bottom: 15px;">
        <p style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Profissional: ${atendimento.profissionalNome}</strong>
            <span class="status-badge active">Ativo</span>
        </p>
        <hr style="margin: 8px 0;">
        <p><strong>Sessão:</strong> ${horarioInfo.diaSemana || ""} às ${
        horarioInfo.horario || ""
      }</p>
        <p><strong>Data de Início:</strong> ${dataInicioFormatada}</p>
        <p><strong>Contrato:</strong> ${dataAssinatura}</p>
      </div>
    `;
    })
    .join(""); // --- O RESTANTE DA FUNÇÃO CONTINUA IGUAL ---

  const optionsHtml = atendimentosAtivos
    .map(
      (at) =>
        `<option value="${at.atendimentoId}">${at.profissionalNome}</option>`
    )
    .join("");

  const acoesAdministrativasHtml = `
    <details class="collapsible-section" style="margin-top: 20px;">
        <summary class="collapsible-summary">
            Ações Administrativas (Uso Excepcional)
        </summary>
        <div class="collapsible-content">
            <p class="description-box">Utilize esta seção apenas se o profissional estiver impossibilitado de registrar o desfecho pelo portal dele.</p>
            <form id="desfecho-pb-form" class="dynamic-form">
                <div class="form-group">
                    <label for="profissional-desfecho-select">Selecione o profissional para registrar o desfecho:</label>
                    <select id="profissional-desfecho-select" class="form-control" required>
                        <option value="">Selecione um profissional...</option>
                        ${optionsHtml}
                    </select>
                </div>
                <fieldset id="desfecho-fieldset" disabled>
                    <hr>
                    <div class="form-group">
                        <label for="desfecho-pb-select">Qual foi o desfecho do acompanhamento?</label>
                        <select id="desfecho-pb-select" class="form-control" required>
                            <option value="">Selecione uma opção...</option>
                            <option value="Alta">Alta</option>
                            <option value="Desistência">Desistência</option>
                            <option value="Encaminhamento">Encaminhar para outro serviço</option>
                        </select>
                    </div>
                    <div id="motivo-desfecho-container" class="form-group hidden">
                        <label for="motivo-desfecho-textarea">Descreva brevemente os motivos:</label>
                        <textarea id="motivo-desfecho-textarea" class="form-control" rows="4" required></textarea>
                    </div>
                    <div id="encaminhamento-pb-container" class="hidden">
                         <div class="form-group">
                            <label for="encaminhamento-servico">Serviço de Encaminhamento:</label>
                            <input type="text" id="encaminhamento-servico" class="form-control">
                        </div>
                         <div class="form-group">
                            <label for="encaminhamento-observacoes">Observações (opcional):</label>
                            <textarea id="encaminhamento-observacoes" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                </fieldset>
            </form>
        </div>
    </details>
  `;

  element.innerHTML = `
    <h4 class="form-section-title">Acompanhamentos Ativos</h4>
    ${
    resumoAtendimentosHtml.length > 0
      ? resumoAtendimentosHtml
      : "<p>Nenhum atendimento ativo encontrado.</p>"
  }
    ${acoesAdministrativasHtml}
  `;

  const profissionalSelect = element.querySelector(
    "#profissional-desfecho-select"
  );
  const desfechoFieldset = element.querySelector("#desfecho-fieldset");
  const desfechoSelect = element.querySelector("#desfecho-pb-select");
  const motivoContainer = element.querySelector("#motivo-desfecho-container");
  const encaminhamentoContainer = element.querySelector(
    "#encaminhamento-pb-container"
  );

  profissionalSelect.addEventListener("change", () => {
    desfechoFieldset.disabled = !profissionalSelect.value;
  });

  desfechoSelect.addEventListener("change", () => {
    const value = desfechoSelect.value;
    motivoContainer.classList.toggle("hidden", !value);
    encaminhamentoContainer.classList.toggle(
      "hidden",
      value !== "Encaminhamento"
    );
    encaminhamentoContainer.querySelector("#encaminhamento-servico").required =
      value === "Encaminhamento";
  });

  return element;
}

/**
 * Salva os dados do desfecho, chamando uma Cloud Function.
 * ESTA FUNÇÃO NÃO PRECISA DE ALTERAÇÕES.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @param {HTMLElement} modalBody - O corpo do modal contendo o formulário.
 */
export async function save(cardId, cardData, modalBody) {
  const atendimentoId = modalBody.querySelector(
    "#profissional-desfecho-select"
  ).value;

  // A função só prossegue se um profissional tiver sido selecionado,
  // indicando que a ação é intencional.
  if (!atendimentoId) {
    // Se o usuário não interagiu com a seção administrativa, não faz nada.
    console.log("Nenhuma ação administrativa a ser salva.");
    return; // Encerra a função silenciosamente.
  }

  const desfecho = modalBody.querySelector("#desfecho-pb-select").value;
  const motivo = modalBody.querySelector("#motivo-desfecho-textarea").value;

  if (!desfecho || !motivo) {
    throw new Error(
      "Ao registrar um desfecho administrativo, todos os campos são obrigatórios."
    );
  }

  const payload = {
    pacienteId: cardId,
    atendimentoId: atendimentoId,
    desfecho: desfecho,
    motivo: motivo,
  };

  if (desfecho === "Encaminhamento") {
    const servico = modalBody.querySelector("#encaminhamento-servico").value;
    if (!servico) {
      throw new Error("O serviço de encaminhamento é obrigatório.");
    }
    payload.encaminhamento = {
      servico,
      observacoes: modalBody.querySelector("#encaminhamento-observacoes").value,
    };
  }

  try {
    const functions = getFunctions();
    const registrarDesfechoPb = httpsCallable(functions, "registrarDesfechoPb");

    const result = await registrarDesfechoPb(payload);

    if (!result.data.success) {
      throw new Error(result.data.message || "Ocorreu um erro no servidor.");
    }
    console.log("Desfecho registrado com sucesso!");
  } catch (error) {
    console.error(
      "Erro ao chamar a Cloud Function 'registrarDesfechoPb':",
      error
    );
    throw new Error(`Falha ao registrar desfecho: ${error.message}`);
  }
}
