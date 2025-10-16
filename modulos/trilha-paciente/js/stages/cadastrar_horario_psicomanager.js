// Arquivo: /modulos/trilha-paciente/js/stages/cadastrar_horario_psicomanager.js
// Versão: 3.2 (Importa currentUserData diretamente para garantir o acesso)

import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";
import { currentUserData } from "../../../../assets/js/app.js";
/**
 * Renderiza o conteúdo do modal.
 */
export async function render(cardId, cardData) {
  // A função render permanece a mesma
  const element = document.createElement("div");

  const atendimentosParaCadastrar =
    cardData.atendimentosPB?.filter(
      (at) =>
        at.statusAtendimento === "ativo" &&
        at.horarioSessao &&
        !at.horarioCadastradoPsicomanager
    ) || [];

  element.innerHTML = `
    <style>
      .info-grid { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; align-items: center; }
      .info-grid p { margin: 0; }
      .form-separator { margin: 20px 0; border: 0; border-top: 1px solid #eee; }
      .cadastro-item { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .cadastro-item h4 { margin-top: 0; color: #0056b3; }
    </style>
  `;

  if (atendimentosParaCadastrar.length === 0) {
    element.innerHTML += `
        <div class="info-message">
            <p><strong>Não há horários pendentes de cadastro para este paciente.</strong></p>
        </div>
    `;
    return element;
  }

  const blocosHtml = atendimentosParaCadastrar
    .map((atendimento) => {
      const horarioInfo = atendimento.horarioSessao || {};
      const dataInicioFormatada = horarioInfo.dataInicio
        ? new Date(horarioInfo.dataInicio + "T03:00:00").toLocaleDateString(
            "pt-BR"
          )
        : "Não informada";

      return `
        <div class="cadastro-item">
            <h4>Resumo para Cadastro: ${atendimento.profissionalNome}</h4>
            <div class="info-grid">
                <p><strong>Paciente:</strong></p><p>${cardData.nomeCompleto}</p>
                <p><strong>Profissional:</strong></p><p>${
                  atendimento.profissionalNome
                }</p>
                <p><strong>Dia e Horário:</strong></p><p>${
                  horarioInfo.diaSemana || ""
                } às ${horarioInfo.horario || ""}</p>
                <p><strong>Data de Início:</strong></p><p>${dataInicioFormatada}</p>
                <p><strong>Alterar Grade:</strong></p><p>${
                  horarioInfo.alterarGrade || ""
                }</p>
                <p><strong>Sala:</strong></p><p>${
                  horarioInfo.salaAtendimento || ""
                }</p>
                <p><strong>Contribuição:</strong></p><p>${
                  cardData.valorContribuicao || "Não informado"
                }</p>
            </div>
            <hr class="form-separator">
            <div class="form-group">
                <label for="data-cadastro-${
                  atendimento.atendimentoId
                }" style="font-weight: bold;">Data do Cadastro na Psicomanager:</label>
                <input type="date" id="data-cadastro-${
                  atendimento.atendimentoId
                }" class="form-control psicomanager-data-cadastro" data-atendimento-id="${
        atendimento.atendimentoId
      }">
            </div>
        </div>
    `;
    })
    .join("");

  element.innerHTML += `
    <form id="psicomanager-form" class="stage-form">
        ${blocosHtml}
    </form>
  `;

  return element;
}

/**
 * Salva os dados do formulário. Agora usa a variável currentUserData importada.
 */
// ATUALIZADO: Removemos 'currentUserData' dos parâmetros da função
export async function save(cardId, cardData, modalBody) {
  const inputsData = modalBody.querySelectorAll(".psicomanager-data-cadastro");
  const inputsPreenchidos = Array.from(inputsData).filter(
    (input) => input.value
  );

  if (inputsPreenchidos.length === 0) {
    throw new Error(
      "Preencha a data de ao menos um cadastro para poder salvar."
    );
  }

  const dataPorAtendimento = new Map();
  inputsPreenchidos.forEach((input) => {
    dataPorAtendimento.set(input.dataset.atendimentoId, input.value);
  });

  const docRef = doc(db, "trilhaPaciente", cardId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Paciente não encontrado no banco de dados.");
  }

  const atendimentosAtuais = docSnap.data().atendimentosPB || [];

  const novosAtendimentos = atendimentosAtuais.map((atendimento) => {
    if (dataPorAtendimento.has(atendimento.atendimentoId)) {
      return {
        ...atendimento,
        horarioCadastradoPsicomanager: true,
        dataCadastroPsicomanager: dataPorAtendimento.get(
          atendimento.atendimentoId
        ),
        // A variável 'currentUserData' agora vem do import, garantindo que ela exista
        responsavelCadastroPsicomanager: currentUserData.nome || "N/A",
      };
    }
    return atendimento;
  });

  const aindaExistemPendentes = novosAtendimentos.some(
    (at) =>
      at.statusAtendimento === "ativo" &&
      at.horarioSessao &&
      !at.horarioCadastradoPsicomanager
  );

  const updateData = {
    atendimentosPB: novosAtendimentos,
    lastUpdate: serverTimestamp(),
    lastUpdatedBy: currentUserData.nome || "N/A",
  };

  if (!aindaExistemPendentes) {
    updateData.status = "em_atendimento_pb";
  }

  await updateDoc(docRef, updateData);
}
