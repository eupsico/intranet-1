// Arquivo: /modulos/trilha-paciente/js/stages/pacientes_parcerias.js
// Versão: 1.1 (Exibe o campo "Parceria" no topo)

import {
  getFunctions,
  httpsCallable,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o formulário para a etapa "Pacientes Parcerias".
 * Possui as mesmas características de "Em Atendimento (PB)", incluindo ações administrativas.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {object} cardData - Objeto com todos os dados do paciente.
 * @returns {HTMLElement} - O elemento HTML com o formulário.
 */
export function render(cardId, cardData) {
  const element = document.createElement("div");

  // Filtra atendimentos ativos (Assumindo que parcerias usam a mesma estrutura de array atendimentosPB)
  const atendimentosAtivos =
    cardData.atendimentosPB?.filter((at) => at.statusAtendimento === "ativo") ||
    [];

  // --- SEÇÃO DE INFORMAÇÃO DA PARCERIA ---
  const nomeParceria = cardData.parceria || "Não informada";
  const parceriaInfoHtml = `
    <div class="patient-info-box warning" style="margin-bottom: 15px;">
        <p><strong>Parceria Vinculada:</strong> ${nomeParceria}</p>
    </div>
  `;

  // --- SEÇÃO PRINCIPAL: RESUMO INFORMATIVO ---
  const resumoAtendimentosHtml = atendimentosAtivos
    .map((atendimento) => {
      const horarioInfo = atendimento.horarioSessao || {};
      const dataInicioFormatada = horarioInfo.dataInicio
        ? new Date(horarioInfo.dataInicio + "T03:00:00").toLocaleDateString(
            "pt-BR"
          )
        : "Não informada";

      const contratoInfo = atendimento.contratoAssinado;
      let dataAssinatura = "Aguardando Assinatura";

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
            <span class="status-badge active" style="background-color: #6c757d;">Parceria</span>
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
    .join("");

  const optionsHtml = atendimentosAtivos
    .map(
      (at) =>
        `<option value="${at.atendimentoId}">${at.profissionalNome}</option>`
    )
    .join("");

  // --- SEÇÃO DE AÇÕES ADMINISTRATIVAS (USO EXCEPCIONAL) ---
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
    <h4 class="form-section-title">Acompanhamentos em Parceria Ativos</h4>
    ${parceriaInfoHtml}
    ${
      resumoAtendimentosHtml.length > 0
        ? resumoAtendimentosHtml
        : "<p>Nenhum atendimento de parceria ativo encontrado.</p>"
    }
    ${acoesAdministrativasHtml}
  `;

  // Lógica dos listeners do formulário
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
 * Reutiliza a função 'registrarDesfechoPb' que é polimórfica para parcerias.
 */
export async function save(cardId, cardData, modalBody) {
  const atendimentoId = modalBody.querySelector(
    "#profissional-desfecho-select"
  ).value;

  if (!atendimentoId) {
    console.log("Nenhuma ação administrativa a ser salva.");
    return;
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
