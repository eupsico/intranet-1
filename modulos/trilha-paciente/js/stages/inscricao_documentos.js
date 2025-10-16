// Arquivo: /modulos/trilha-paciente/js/stages/inscricao_documentos.js
// Versão: 9.2 (Corrige a lógica de salvamento e a interface do formulário)

import {
  db,
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o conteúdo do modal.
 */
export async function render(cardId, cardData, currentUserData) {
  const element = document.createElement("div");
  const checklistData = cardData.checklistDocumentos || {}; // Pega os dados do checklist salvos

  const responsavelInfo = cardData.responsavel?.nome
    ? `<strong>Responsável:</strong> ${cardData.responsavel.nome}`
    : "";
  const dataNascimentoFormatada = cardData.dataNascimento
    ? new Date(cardData.dataNascimento + "T03:00:00").toLocaleDateString(
        "pt-BR"
      )
    : "Não informada";

  element.innerHTML = `
    <h3 class="form-section-title">Confirmação de Dados</h3>
    <div class="confirmation-box" id="confirmation-text">
    *Preciso que você me confirme se os dados do paciente estão corretos:*
        <strong>*Nome:*</strong> ${cardData.nomeCompleto}
        <strong>*Data de Nascimento:*</strong> ${dataNascimentoFormatada}
        <strong>*Telefone:*</strong> ${cardData.telefoneCelular}
        <strong>*CPF:*</strong> ${cardData.cpf}
        <strong>*E-mail:*</strong> ${cardData.email}
        ${responsavelInfo}
    </div>
    <p>Copie o texto acima e envie para o paciente para confirmação.</p>

    <form id="inscricao-form" class="stage-form">
        <h3 class="form-section-title">Checklist de Documentos</h3>
        <div class="checklist-group">
            <div class="form-grid-2-col">
                <div class="form-group"><label><input type="checkbox" id="chk-docs" name="checklist" ${
                  checklistData.docsEnviados ? "checked" : ""
                }> Enviou os documentos</label></div>
                <div class="form-group"><label><input type="checkbox" id="chk-confirmou" name="checklist" ${
                  checklistData.dadosConfirmados ? "checked" : ""
                }> Confirmou os dados</label></div>
                <div class="form-group"><label><input type="checkbox" id="chk-pasta" name="checklist" ${
                  checklistData.pastaCriada ? "checked" : ""
                }> Criou Pasta no Drive</label></div>
                <div class="form-group"><label><input type="checkbox" id="chk-pagamento" name="checklist" ${
                  checklistData.pagamentoEfetuado ? "checked" : ""
                }> Efetuou o pagamento</label></div>
                <div class="form-group"><label><input type="checkbox" id="chk-isento" name="checklist" ${
                  cardData.isentoTriagem ? "checked" : ""
                }> Isento da triagem</label></div>
                <div class="form-group"><label><input type="checkbox" id="chk-desistiu" name="checklist"> Desistiu do processo</label></div>
            </div>
            
            <div id="isento-motivo-section" class="form-group" style="display: none;">
                <label for="isento-motivo">Informe o motivo da isenção:</label>
                <textarea id="isento-motivo" class="form-control">${
                  cardData.motivoIsencao || ""
                }</textarea>
            </div>
            
            <div id="desistencia-motivo-section" class="form-group" style="display: none;">
                <label for="desistencia-motivo">Informe o motivo da desistência:</label>
                <textarea id="desistencia-motivo" class="form-control"></textarea>
            </div>
        </div>
        <div id="agendamento-section">
            <h3 class="form-section-title">Agendamento da Triagem</h3>
            <fieldset disabled>
                <p class="info-message">O agendamento da triagem agora é realizado pelo próprio paciente através do link público.</p>
                <div class="form-group">
                    <label>Assistente Social</label>
                    <input type="text" class="form-control" placeholder="Será definido no agendamento" readonly>
                </div>
                <div class="form-grid-3-col">
                    <div class="form-group">
                        <label>Tipo de Triagem</label>
                        <input type="text" class="form-control" placeholder="Será definido no agendamento" readonly>
                    </div>
                    <div class="form-group">
                        <label>Data da Triagem</label>
                        <input type="date" class="form-control" readonly>
                    </div>
                    <div class="form-group">
                        <label>Horário da Triagem</label>
                        <input type="time" class="form-control" readonly>
                    </div>
                </div>
            </fieldset>
        </div>
    </form>
  `;

  setupEventListeners(element);
  return element;
}

/**
 * Salva o progresso do checklist ou a desistência.
 */
export async function save(cardId, cardData, modalBody) {
  const chkDesistiu = modalBody.querySelector("#chk-desistiu").checked;
  const desistiuMotivo = modalBody
    .querySelector("#desistencia-motivo")
    .value.trim();

  let dataToUpdate = {};

  if (chkDesistiu) {
    if (!desistiuMotivo) {
      throw new Error("Por favor, informe o motivo da desistência.");
    }
    dataToUpdate = {
      status: "desistencia", // Apenas em caso de desistência o status muda
      desistenciaMotivo: desistiuMotivo,
      lastUpdate: new Date(),
      lastUpdatedBy: cardData.nome || "Sistema",
    };
  } else {
    // Se não for desistência, apenas salva o estado atual do checklist
    const isento = modalBody.querySelector("#chk-isento").checked;

    dataToUpdate = {
      // O status NÃO é alterado
      checklistDocumentos: {
        docsEnviados: modalBody.querySelector("#chk-docs").checked,
        dadosConfirmados: modalBody.querySelector("#chk-confirmou").checked,
        pastaCriada: modalBody.querySelector("#chk-pasta").checked,
        pagamentoEfetuado: isento
          ? false
          : modalBody.querySelector("#chk-pagamento").checked,
      },
      isentoTriagem: isento,
      motivoIsencao: isento
        ? modalBody.querySelector("#isento-motivo").value.trim()
        : "",
      lastUpdate: new Date(),
      lastUpdatedBy: cardData.nome || "Sistema",
    };
  }

  const docRef = doc(db, "trilhaPaciente", cardId);
  await updateDoc(docRef, dataToUpdate);
}

// --- Funções Auxiliares ---

function setupEventListeners(element) {
  const chkPagamento = element.querySelector("#chk-pagamento");
  const chkIsento = element.querySelector("#chk-isento");
  const chkDesistiu = element.querySelector("#chk-desistiu");
  const isentoSection = element.querySelector("#isento-motivo-section");
  const desistiuSection = element.querySelector("#desistencia-motivo-section");
  const agendamentoSection = element.querySelector("#agendamento-section");
  const allCheckboxes = element.querySelectorAll('input[name="checklist"]');

  // Função para forçar a reavaliação da UI no início
  function triggerInitialState() {
    chkIsento.dispatchEvent(new Event("change"));
    chkDesistiu.dispatchEvent(new Event("change"));
  }

  chkIsento.addEventListener("change", function () {
    isentoSection.style.display = this.checked ? "block" : "none";
    if (this.checked) {
      chkPagamento.checked = false;
      chkPagamento.disabled = true;
    } else {
      chkPagamento.disabled = chkDesistiu.checked;
    }
  });

  chkDesistiu.addEventListener("change", function () {
    const isDesistente = this.checked;
    desistiuSection.style.display = isDesistente ? "block" : "none";
    agendamentoSection.style.display = isDesistente ? "none" : "block";

    allCheckboxes.forEach((chk) => {
      if (chk.id !== "chk-desistiu") {
        chk.disabled = isDesistente;
      }
    });

    // Se o usuário desiste, reabilita a opção de pagamento/isenção
    if (isDesistente) {
      chkIsento.disabled = false;
      chkPagamento.disabled = false;
    }
  });

  // Chama a função para garantir que o estado inicial do formulário esteja correto
  triggerInitialState();
}
