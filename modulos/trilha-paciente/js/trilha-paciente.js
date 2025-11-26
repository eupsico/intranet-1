// Arquivo: /modulos/trilha-paciente/js/trilha-paciente.js
// Versão: 10.4 (Corrige erro "toDate is not a function")

import {
  db,
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp, // Importa o serverTimestamp
  writeBatch,
} from "../../../assets/js/firebase-init.js";

// --- INÍCIO DA ALTERAÇÃO ---
const COLUMNS_CONFIG = {
  inscricao_documentos: "Inscrição e Documentos",
  triagem_agendada: "Triagem Agendada",
  encaminhar_para_plantao: "Encaminhar para Plantão",
  em_atendimento_plantao: "Em Atendimento (Plantão)",
  agendamento_confirmado_plantao: "Agendamento Confirmado (Plantão)",
  encaminhar_para_pb: "Encaminhar para PB",
  aguardando_info_horarios: "Aguardando Info Horários",
  cadastrar_horario_psicomanager: "Cadastrar Horário Psicomanager",
  em_atendimento_pb: "Em Atendimento (PB)",
  aguardando_reavaliacao: "Aguardando Reavaliação", // <-- NOVA LINHA ADICIONADA
  pacientes_parcerias: "Pacientes Parcerias",
  grupos: "Grupos",
  desistencia: "Desistência",
  alta: "Alta",
};
const BULK_ACTION_COLUMNS = ["grupos", "pacientes_parcerias"];

// 3. Adicione uma variável global para armazenar os selecionados
let selectedBulkIds = [];
// --- FIM DA ALTERAÇÃO ---

let allCardsData = {};
let currentColumnFilter = [];
let currentUserData = {};
let unsubscribe;

export async function init(db, authUser, authData, container, columnFilter) {
  currentColumnFilter = columnFilter;
  currentUserData = authData;

  if (typeof unsubscribe === "function") {
    try {
      unsubscribe();
    } catch (e) {
      console.warn("Erro ao cancelar inscrição anterior:", e);
    }
  }

  try {
    const response = await fetch("../page/trilha-paciente.html", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    if (!html || html.trim() === "") {
      throw new Error("HTML da trilha está vazio ou inválido.");
    }
    container.innerHTML = html;
    setupColumns?.();
    setupAllModalControls?.();
    setupEventListeners?.();
    await loadAndRenderCards?.();
  } catch (error) {
    console.error("Erro ao inicializar o Kanban:", error);
    container.innerHTML = `<div class="error-message">Erro ao carregar o Kanban.</div>`;
  }
}

// Substitua a função setupColumns existente por esta:
function setupColumns() {
  const kanbanBoard = document.getElementById("kanban-board");
  if (!kanbanBoard) return;

  kanbanBoard.innerHTML = currentColumnFilter
    .map((statusKey) => {
      // Verifica se a coluna permite seleção em massa (apenas Grupos e Parcerias)
      const allowBulkActions = BULK_ACTION_COLUMNS.includes(statusKey);

      let bulkActionsHtml = "";
      if (allowBulkActions) {
        bulkActionsHtml = `
            <div class="column-actions-header">
                <label class="select-all-container" title="Selecionar todos desta fila">
                    <input type="checkbox" class="column-select-all" data-column="${statusKey}">
                    Todos
                </label>
                <button class="bulk-move-btn" id="btn-bulk-move-${statusKey}" onclick="window.initBulkMove('${statusKey}')">
                    Mover Selecionados
                </button>
            </div>
        `;
      }

      return `
        <div class="kanban-column" id="column-${statusKey}" data-status="${statusKey}">
            <div class="kanban-column-header">
                <h3 class="kanban-column-title">
                    ${COLUMNS_CONFIG[statusKey] || statusKey}
                    <span class="kanban-column-count" id="count-${statusKey}">0</span>
                </h3>
                ${bulkActionsHtml} </div>
            <div class="kanban-cards-container" id="cards-${statusKey}"></div>
        </div>`;
    })
    .join("");

  // Configura os eventos dos checkboxes "Selecionar Todos"
  setupBulkSelectionListeners();
}
// Substitua a função setupColumns existente por esta:
function setupColumns() {
  const kanbanBoard = document.getElementById("kanban-board");
  if (!kanbanBoard) return;

  kanbanBoard.innerHTML = currentColumnFilter
    .map((statusKey) => {
      // Verifica se a coluna permite seleção em massa (apenas Grupos e Parcerias)
      const allowBulkActions = BULK_ACTION_COLUMNS.includes(statusKey);

      let bulkActionsHtml = "";
      if (allowBulkActions) {
        bulkActionsHtml = `
            <div class="column-actions-header">
                <label class="select-all-container" title="Selecionar todos desta fila">
                    <input type="checkbox" class="column-select-all" data-column="${statusKey}">
                    Todos
                </label>
                <button class="bulk-move-btn" id="btn-bulk-move-${statusKey}" onclick="window.initBulkMove('${statusKey}')">
                    Mover Selecionados
                </button>
            </div>
        `;
      }

      return `
        <div class="kanban-column" id="column-${statusKey}" data-status="${statusKey}">
            <div class="kanban-column-header">
                <h3 class="kanban-column-title">
                    ${COLUMNS_CONFIG[statusKey] || statusKey}
                    <span class="kanban-column-count" id="count-${statusKey}">0</span>
                </h3>
                ${bulkActionsHtml} </div>
            <div class="kanban-cards-container" id="cards-${statusKey}"></div>
        </div>`;
    })
    .join("");

  // Configura os eventos dos checkboxes "Selecionar Todos"
  setupBulkSelectionListeners();
}

// Substitua a função createCardElement existente por esta:
function createCardElement(cardData) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.dataset.id = cardData.id;

  // Formatação da data (mantendo sua lógica original)
  let formattedDate = "Data indisponível";
  if (cardData.lastUpdate) {
    if (typeof cardData.lastUpdate.toDate === "function") {
      formattedDate = cardData.lastUpdate.toDate().toLocaleDateString("pt-BR");
    } else if (
      cardData.lastUpdate instanceof Date ||
      typeof cardData.lastUpdate === "string"
    ) {
      formattedDate = new Date(cardData.lastUpdate).toLocaleDateString("pt-BR");
    }
  }

  // Verifica se deve adicionar checkbox neste card
  const allowBulkActions = BULK_ACTION_COLUMNS.includes(cardData.status);
  let checkboxHtml = "";

  if (allowBulkActions) {
    // onclick="event.stopPropagation()" impede que o modal do paciente abra ao clicar no checkbox
    checkboxHtml = `
        <input type="checkbox" 
               class="card-selector" 
               value="${cardData.id}" 
               onclick="event.stopPropagation(); window.updateBulkButtonState('${cardData.status}')">
      `;
  }

  // Layout interno do card ajustado
  card.innerHTML = `
    <div class="card-header-row">
        ${checkboxHtml}
        <span class="card-patient-name">${
          cardData.nomeCompleto || "Nome não informado"
        }</span>
    </div>
    <div class="card-details">
        <p><strong>Status:</strong> ${
          COLUMNS_CONFIG[cardData.status] || cardData.status
        }</p>
        <p><strong>Assistente:</strong> ${
          cardData.assistenteSocialNome || "Não atribuído"
        }</p>
        <p><strong>Última Atualização:</strong> ${formattedDate}</p>
    </div>
    `;

  return card;
}

// Substitua a função createCardElement existente por esta:
function createCardElement(cardData) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.dataset.id = cardData.id;

  // Formatação da data (mantendo sua lógica original)
  let formattedDate = "Data indisponível";
  if (cardData.lastUpdate) {
    if (typeof cardData.lastUpdate.toDate === "function") {
      formattedDate = cardData.lastUpdate.toDate().toLocaleDateString("pt-BR");
    } else if (
      cardData.lastUpdate instanceof Date ||
      typeof cardData.lastUpdate === "string"
    ) {
      formattedDate = new Date(cardData.lastUpdate).toLocaleDateString("pt-BR");
    }
  }

  // Verifica se deve adicionar checkbox neste card
  const allowBulkActions = BULK_ACTION_COLUMNS.includes(cardData.status);
  let checkboxHtml = "";

  if (allowBulkActions) {
    // onclick="event.stopPropagation()" impede que o modal do paciente abra ao clicar no checkbox
    checkboxHtml = `
        <input type="checkbox" 
               class="card-selector" 
               value="${cardData.id}" 
               onclick="event.stopPropagation(); window.updateBulkButtonState('${cardData.status}')">
      `;
  }

  // Layout interno do card ajustado
  card.innerHTML = `
    <div class="card-header-row">
        ${checkboxHtml}
        <span class="card-patient-name">${
          cardData.nomeCompleto || "Nome não informado"
        }</span>
    </div>
    <div class="card-details">
        <p><strong>Status:</strong> ${
          COLUMNS_CONFIG[cardData.status] || cardData.status
        }</p>
        <p><strong>Assistente:</strong> ${
          cardData.assistenteSocialNome || "Não atribuído"
        }</p>
        <p><strong>Última Atualização:</strong> ${formattedDate}</p>
    </div>
    `;

  return card;
}
function loadAndRenderCards() {
  const trilhaRef = collection(db, "trilhaPaciente");
  const q = query(trilhaRef, where("status", "in", currentColumnFilter));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      document
        .querySelectorAll(".kanban-cards-container")
        .forEach((c) => (c.innerHTML = ""));
      allCardsData = {};

      const statusCounts = {};
      currentColumnFilter.forEach((status) => (statusCounts[status] = 0));

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        allCardsData[data.id] = data;

        if (statusCounts.hasOwnProperty(data.status)) {
          statusCounts[data.status]++;
        }

        const cardElement = createCardElement(data);
        const container = document.getElementById(`cards-${data.status}`);
        if (container) {
          container.appendChild(cardElement);
        }
      });

      for (const statusKey in statusCounts) {
        const countEl = document.getElementById(`count-${statusKey}`);
        if (countEl) {
          countEl.textContent = statusCounts[statusKey];
        }
      }
    },
    (error) => {
      console.error("Erro ao buscar cards em tempo real:", error);
    }
  );
}

// --- NOVAS FUNÇÕES PARA GERENCIAR SELEÇÃO ---

// Configura os listeners dos checkboxes "Selecionar Todos" do cabeçalho
function setupBulkSelectionListeners() {
  document.querySelectorAll(".column-select-all").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const columnKey = e.target.dataset.column;
      const isChecked = e.target.checked;
      toggleColumnSelection(columnKey, isChecked);
    });
  });
}

// Marca ou desmarca todos os cards visíveis naquela coluna
function toggleColumnSelection(columnKey, isChecked) {
  const container = document.getElementById(`cards-${columnKey}`);
  if (!container) return;

  const checkboxes = container.querySelectorAll(".card-selector");
  checkboxes.forEach((cb) => {
    cb.checked = isChecked;
  });

  window.updateBulkButtonState(columnKey);
}

// Atualiza o estado do botão "Mover" (Habilita/Desabilita e muda o texto)
window.updateBulkButtonState = function (columnKey) {
  const container = document.getElementById(`cards-${columnKey}`);
  if (!container) return;

  const checkboxes = container.querySelectorAll(".card-selector:checked");
  const btn = document.getElementById(`btn-bulk-move-${columnKey}`);

  if (btn) {
    if (checkboxes.length > 0) {
      btn.classList.add("active"); // Ativa o botão visualmente
      btn.textContent = `Mover (${checkboxes.length})`;
    } else {
      btn.classList.remove("active");
      btn.textContent = `Mover Selecionados`;
    }
  }
};

// --- LÓGICA DO MODAL DE MOVIMENTAÇÃO ---

// Função chamada pelo botão "Mover Selecionados"
window.initBulkMove = function (columnKey) {
  const container = document.getElementById(`cards-${columnKey}`);
  const checkboxes = container.querySelectorAll(".card-selector:checked");

  // Armazena os IDs selecionados na variável global
  selectedBulkIds = Array.from(checkboxes).map((cb) => cb.value);

  if (selectedBulkIds.length === 0) return;

  // Abre o modal configurado para múltiplos pacientes
  const moveModal = document.getElementById("move-card-modal");
  const select = document.getElementById("move-card-stage-select");
  const patientNameSpan = document.getElementById("move-card-patient-name");

  // Define um valor especial no input hidden para o confirmMove saber que é em massa
  document.getElementById("move-card-id").value = "BULK_OPERATION";

  patientNameSpan.textContent = `${selectedBulkIds.length} pacientes selecionados`;

  // Popula o select excluindo a coluna atual (origem)
  select.innerHTML = "";
  for (const key in COLUMNS_CONFIG) {
    if (key !== columnKey) {
      // Garante que não move para a mesma fila
      select.innerHTML += `<option value="${key}">${COLUMNS_CONFIG[key]}</option>`;
    }
  }

  document.getElementById("card-modal").style.display = "none";
  moveModal.style.display = "flex";
};

// --- FUNÇÃO confirmMove ATUALIZADA ---
// Substitua a função confirmMove original por esta:

async function confirmMove() {
  const cardIdValue = document.getElementById("move-card-id").value;
  const newStatus = document.getElementById("move-card-stage-select").value;

  if (!newStatus) {
    alert("Selecione um destino válido.");
    return;
  }

  const button = document.getElementById("confirm-move-btn");
  button.disabled = true;
  button.textContent = "Processando...";

  const lastUpdatedBy = currentUserData
    ? currentUserData.nome
    : "Usuário Desconhecido";

  try {
    // SE FOR OPERAÇÃO EM LOTE
    if (cardIdValue === "BULK_OPERATION") {
      if (selectedBulkIds.length === 0) {
        alert("Nenhum paciente selecionado.");
        return;
      }

      // Usa writeBatch para executar todas as atualizações de uma só vez (Atômico)
      const batch = writeBatch(db);

      selectedBulkIds.forEach((id) => {
        const cardRef = doc(db, "trilhaPaciente", id);
        batch.update(cardRef, {
          status: newStatus,
          lastUpdate: serverTimestamp(),
          lastUpdatedBy: lastUpdatedBy + " (Em Massa)",
        });
      });

      await batch.commit(); // Envia tudo para o Firebase
      console.log(
        `Sucesso: ${selectedBulkIds.length} pacientes movidos para ${newStatus}`
      );

      // Limpa a seleção após o sucesso
      selectedBulkIds = [];
    } else {
      // SE FOR OPERAÇÃO INDIVIDUAL (Fluxo normal do botão Mover dentro do card)
      const cardRef = doc(db, "trilhaPaciente", cardIdValue);
      await updateDoc(cardRef, {
        status: newStatus,
        lastUpdate: serverTimestamp(),
        lastUpdatedBy: lastUpdatedBy,
      });
    }

    document.getElementById("move-card-modal").style.display = "none";
  } catch (error) {
    console.error("Erro ao mover:", error);
    alert("Ocorreu um erro ao tentar mover os pacientes. Verifique o console.");
  } finally {
    button.disabled = false;
    button.textContent = "Confirmar Movimentação";
  }
}

// O restante do arquivo (setupAllModalControls, setupEventListeners, etc.) permanece o mesmo.
function setupAllModalControls() {
  const cardModal = document.getElementById("card-modal");
  if (cardModal) {
    const closeModalBtn = document.getElementById("close-modal-btn");
    if (closeModalBtn) {
      closeModalBtn.addEventListener(
        "click",
        () => (cardModal.style.display = "none")
      );
    }
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener(
        "click",
        () => (cardModal.style.display = "none")
      );
    }
    cardModal.addEventListener("click", (e) => {
      if (e.target === cardModal) cardModal.style.display = "none";
    });
  }
  const moveModal = document.getElementById("move-card-modal");
  if (moveModal) {
    const closeMoveCardModalBtn = document.getElementById(
      "close-move-card-modal-btn"
    );
    if (closeMoveCardModalBtn) {
      closeMoveCardModalBtn.addEventListener(
        "click",
        () => (moveModal.style.display = "none")
      );
    }
    const cancelMoveBtn = document.getElementById("cancel-move-btn");
    if (cancelMoveBtn) {
      cancelMoveBtn.addEventListener(
        "click",
        () => (moveModal.style.display = "none")
      );
    }
    moveModal.addEventListener("click", (e) => {
      if (e.target === moveModal) moveModal.style.display = "none";
    });
    const confirmMoveBtn = document.getElementById("confirm-move-btn");
    if (confirmMoveBtn) {
      confirmMoveBtn.addEventListener("click", confirmMove);
    }
  }
}
function setupEventListeners() {
  const kanbanBoard = document.getElementById("kanban-board");
  if (!kanbanBoard) return;
  kanbanBoard.addEventListener("click", (event) => {
    const cardElement = event.target.closest(".kanban-card");
    if (cardElement) {
      const cardId = cardElement.dataset.id;
      openCardModal(cardId);
    }
  });
}
function openMoveModal(cardId, cardData) {
  const moveModal = document.getElementById("move-card-modal");
  const select = document.getElementById("move-card-stage-select");
  document.getElementById("move-card-patient-name").textContent =
    cardData.nomeCompleto;
  document.getElementById("move-card-id").value = cardId;
  select.innerHTML = "";
  for (const key in COLUMNS_CONFIG) {
    if (key !== cardData.status) {
      select.innerHTML += `<option value="${key}">${COLUMNS_CONFIG[key]}</option>`;
    }
  }
  document.getElementById("card-modal").style.display = "none";
  moveModal.style.display = "flex";
}
async function openCardModal(cardId) {
  const modal = document.getElementById("card-modal");
  const modalTitle = document.getElementById("card-modal-title");
  const modalBody = document.getElementById("card-modal-body");
  const saveButton = document.getElementById("modal-save-btn");
  const moveButton = document.getElementById("modal-move-btn");
  const cardData = allCardsData[cardId];
  if (!cardData) return;
  modalTitle.textContent = `Detalhes: ${cardData.nomeCompleto}`;
  modal.style.display = "flex";
  modalBody.innerHTML = '<div class="loading-spinner"></div>';
  saveButton.style.display = "inline-block";
  moveButton.style.display = "inline-block";
  const newMoveButton = moveButton.cloneNode(true);
  moveButton.parentNode.replaceChild(newMoveButton, moveButton);
  newMoveButton.addEventListener("click", () =>
    openMoveModal(cardId, cardData)
  );
  try {
    const stage = cardData.status;
    const stageModule = await import(
      `./stages/${stage}.js?v=${new Date().getTime()}`
    );
    const contentElement = await stageModule.render(
      cardId,
      cardData,
      currentUserData
    );
    modalBody.innerHTML = "";
    modalBody.appendChild(contentElement);
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);
    if (typeof stageModule.save === "function") {
      newSaveButton.style.display = "inline-block";
      newSaveButton.addEventListener("click", async () => {
        newSaveButton.disabled = true;
        newSaveButton.textContent = "Salvando...";
        try {
          await stageModule.save(cardId, cardData, modalBody);
          modal.style.display = "none";
        } catch (error) {
          console.error("Erro ao salvar:", error);
          alert("Erro ao salvar: " + error.message);
        } finally {
          newSaveButton.disabled = false;
          newSaveButton.textContent = "Salvar";
        }
      });
    } else {
      newSaveButton.style.display = "none";
    }
  } catch (error) {
    console.error(
      `Erro ao carregar o módulo para a etapa ${cardData.status}:`,
      error
    );
    modalBody.innerHTML = `<div class="error-message">Não foi possível carregar os detalhes desta etapa.</div>`;
    saveButton.style.display = "none";
  }
}
