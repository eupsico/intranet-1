// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// Versão 2.3 (Implementa o carregamento de 'Alteração de Horário' como exemplo)

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser;

// Função principal de inicialização do módulo
export function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js V2.3 (Implementando Alteração de Horário) iniciado."
  );
  adminUser = userData;

  // Elementos do DOM
  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector(".tab-content-container"); //

  // --- Lógica de Troca de Abas ---
  function setupTabs() {
    if (!tabsContainer) return;
    tabsContainer.addEventListener("click", (event) => {
      const clickedTab = event.target.closest(".tab-link");
      if (!clickedTab) return;
      const targetTabId = clickedTab.dataset.tab;
      tabLinks.forEach((link) => link.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));
      clickedTab.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  }

  // --- FUNÇÃO HELPER GENÉRICA (Refatorada) ---
  /**
   * Carrega dados de solicitações de forma genérica
   * @param {string} collectionName - Nome da coleção no Firebase
   * @param {string} tableBodyId - ID do <tbody>
   * @param {string} emptyStateId - ID do <div> de estado vazio
   * @param {string} countBadgeId - ID do <span> do contador
   * @param {function} renderRow - Função que (data, docId) e retorna o HTML <tr>
   * @param {string} statusField - Nome do campo de status (ex: "status")
   * @param {string} dateField - Nome do campo de data para ordenar (ex: "dataSolicitacao")
   */
  function loadSolicitacoes(
    collectionName,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRow,
    statusField = "status",
    dateField = "dataSolicitacao"
  ) {
    console.log(`Carregando solicitações de [${collectionName}]...`);
    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) {
      console.error(
        `Elementos do DOM não encontrados para [${collectionName}]. Verifique IDs.`
      );
      return;
    }

    try {
      const q = query(
        collection(dbInstance, collectionName),
        orderBy(dateField, "desc")
      );

      onSnapshot(
        q,
        (querySnapshot) => {
          if (querySnapshot.empty) {
            tableBody.innerHTML = "";
            emptyState.style.display = "block";
            countBadge.style.display = "none";
            countBadge.textContent = "0";
            return;
          }

          tableBody.innerHTML = "";
          emptyState.style.display = "none";
          let pendingCount = 0;

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data[statusField] === "Pendente") {
              pendingCount++;
            }
            const tr = renderRow(data, doc.id);
            tableBody.innerHTML += tr;
          });

          if (pendingCount > 0) {
            countBadge.textContent = pendingCount;
            countBadge.style.display = "inline-block";
          } else {
            countBadge.style.display = "none";
          }
        },
        (error) => {
          console.error(`Erro ao buscar [${collectionName}]:`, error);
          tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
        }
      );
    } catch (error) {
      console.error(
        `Falha ao construir query para [${collectionName}]:`,
        error
      );
      tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Falha na query. Verifique o nome da coleção e índices.</td></tr>`;
    }
  }

  // --- Implementação das funções de carregamento ---

  function loadNovasSessoes() {
    const tableBody = document.getElementById("table-body-novas-sessoes");
    const emptyState = document.getElementById("empty-state-novas-sessoes");
    if (!tableBody || !emptyState) return;
    // TODO: Implementar. Você precisa saber o nome da coleção e os campos.
    // Exemplo:
    /*
    loadSolicitacoes(
        "solicitacoesNovasSessoes", // <- Nome da coleção (ADIVINHADO)
        "table-body-novas-sessoes",
        "empty-state-novas-sessoes",
        "count-novas-sessoes",
        (data, docId) => {
            const dataSol = data.dataSolicitacao ? data.dataSolicitacao.toDate().toLocaleDateString("pt-BR") : "N/A";
            const statusClass = `status-${String(data.status || "pendente").toLowerCase()}`;
            return `
                <tr>
                    <td>${dataSol}</td>
                    <td>${data.solicitanteNome || 'N/A'}</td>
                    <td>${data.pacienteNome || 'N/A'}</td>
                    <td class="motivo-cell">${data.motivo || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${data.status}</span></td>
                    <td><button class="action-button btn-acao-novas-sessoes" data-id="${docId}">Processar</button></td>
                </tr>
            `;
        }
    );
    */
  }

  // --- INÍCIO DA IMPLEMENTAÇÃO V2.3 ---
  function loadAlteracoesHorario() {
    // ATENÇÃO: Assumindo que o nome da coleção é 'solicitacoesAlteracaoHorario'
    // Se for outro nome, altere abaixo.
    loadSolicitacoes(
      "solicitacoesAlteracaoHorario", // <- Nome da coleção (ADIVINHADO)
      "table-body-alteracoes-horario",
      "empty-state-alteracoes-horario",
      "count-alteracoes-horario",
      (data, docId) => {
        const dataSol = data.dataSolicitacao
          ? data.dataSolicitacao.toDate().toLocaleDateString("pt-BR")
          : "N/A";
        const statusClass = `status-${String(
          data.status || "pendente"
        ).toLowerCase()}`;

        // ATENÇÃO: Ajuste este HTML com base nos dados reais da sua coleção
        return `
            <tr>
                <td>${dataSol}</td>
                <td>${data.solicitanteNome || "N/A"}</td>
                <td>${data.horarioAntigo || "N/A"}</td>
                <td>${data.horarioNovo || "N/A"}</td>
                <td class="motivo-cell">${data.motivo || "N/A"}</td>
                <td><span class="status-badge ${statusClass}">${
          data.status
        }</span></td>
                <td>
                    <button class="action-button btn-acao-alteracao" data-id="${docId}">
                        ${data.status === "Pendente" ? "Processar" : "Ver"}
                    </button>
                </td>
            </tr>
        `;
      }
    );
  }
  // --- FIM DA IMPLEMENTAÇÃO V2.3 ---

  function loadDesfechosPB() {
    const tableBody = document.getElementById("table-body-desfechos-pb");
    const emptyState = document.getElementById("empty-state-desfechos-pb");
    if (!tableBody || !emptyState) return;
    // TODO: Implementar.
  }

  function loadStatusContratos() {
    const tableBody = document.getElementById("table-body-status-contratos");
    const emptyState = document.getElementById("empty-state-status-contratos");
    if (!tableBody || !emptyState) return;
    // TODO: Implementar.
  }

  function loadExclusaoHorarios() {
    loadSolicitacoes(
      "solicitacoesExclusaoGrade",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      (data, docId) => {
        const dataSol = data.dataSolicitacao
          ? data.dataSolicitacao.toDate().toLocaleDateString("pt-BR")
          : "N/A";
        const horariosLabels =
          data.horariosParaExcluir?.map((h) => h.label).join(", ") ||
          "Erro: Horários não encontrados";
        const statusClass = `status-${String(
          data.status || "pendente"
        ).toLowerCase()}`;

        return `
            <tr>
                <td>${dataSol}</td>
                <td>${data.solicitanteNome}</td>
                <td>${data.totalHorariosAtual}</td>
                <td>${horariosLabels}</td>
                <td class="motivo-cell">${data.motivo}</td>
                <td><span class="status-badge ${statusClass}">${
          data.status
        }</span></td>
                <td>
                    <button class="action-button btn-acao-exclusao" data-id="${docId}">
                        ${data.status === "Pendente" ? "Aprovar" : "Ver"}
                    </button>
                </td>
            </tr>
        `;
      }
    );
  }

  // --- Funções do Modal (Específicas de Exclusão) ---
  // (openExclusaoModal, setupModalFormLogic, handleSalvarExclusao)
  // ... (O código das V2.2 para essas funções permanece o MESMO) ...
  async function openExclusaoModal(docId, solicitacaoData) {
    modalTitle.textContent = "Processar Solicitação de Exclusão";
    try {
      const response = await fetch("./modal-exclusao-grade.html"); //
      if (!response.ok) throw new Error("Falha ao carregar o HTML do modal.");
      modalBodyContent.innerHTML = await response.text();
    } catch (error) {
      console.error(error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar o formulário.</p>`;
      openModal();
      return;
    }
    document.getElementById("modal-solicitante-nome").textContent =
      solicitacaoData.solicitanteNome;
    document.getElementById("modal-solicitante-motivo").textContent =
      solicitacaoData.motivo;
    const horariosList = document.getElementById("modal-horarios-list");
    horariosList.innerHTML =
      solicitacaoData.horariosParaExcluir
        ?.map((h) => `<li>${h.label} (${h.path})</li>`)
        .join("") || "<li>Erro ao carregar horários</li>";
    modalFooterActions
      .querySelectorAll(".dynamic-action-btn")
      .forEach((btn) => btn.remove());
    if (solicitacaoData.status === "Pendente") {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.id = "btn-salvar-exclusao";
      saveButton.className = "action-button dynamic-action-btn";
      saveButton.textContent = "Salvar Resposta";
      modalFooterActions.appendChild(saveButton);
      saveButton.addEventListener("click", () => handleSalvarExclusao(docId), {
        once: true,
      });
      setupModalFormLogic();
    } else {
      const feedback = solicitacaoData.adminFeedback || {};
      if (feedback.foiExcluido) {
        document.querySelector(
          `input[name="foiExcluido"][value="${feedback.foiExcluido}"]`
        ).checked = true;
      }
      document.getElementById("dataExclusao").valueAsDate =
        feedback.dataExclusao ? feedback.dataExclusao.toDate() : null;
      document.getElementById("mensagemAdmin").value =
        feedback.mensagemAdmin || "";
      document.getElementById("motivoRejeicao").value =
        feedback.motivoRejeicao || "";
      modalBodyContent
        .querySelectorAll("input, textarea, select")
        .forEach((el) => (el.disabled = true));
      setupModalFormLogic();
    }
    openModal();
  }
  function setupModalFormLogic() {
    const radioSim = document.getElementById("radioExcluidoSim");
    const radioNao = document.getElementById("radioExcluidoNao");
    const camposSim = document.getElementById("campos-feedback-sim");
    const camposNao = document.getElementById("campos-feedback-nao");
    if (!radioSim || !radioNao || !camposSim || !camposNao) return;
    const toggleFields = () => {
      camposSim.style.display = radioSim.checked ? "block" : "none";
      camposNao.style.display = radioNao.checked ? "block" : "none";
    };
    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields();
  }
  async function handleSalvarExclusao(docId) {
    const saveButton = document.getElementById("btn-salvar-exclusao");
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="loading-spinner-small"></span> Salvando...`;
    const foiExcluido = document.querySelector(
      'input[name="foiExcluido"]:checked'
    )?.value;
    const dataExclusaoInput = document.getElementById("dataExclusao").value;
    const mensagemAdmin = document.getElementById("mensagemAdmin").value;
    const motivoRejeicao = document.getElementById("motivoRejeicao").value;
    if (!foiExcluido) {
      alert("Selecione 'Sim' ou 'Não'.");
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta";
      return;
    }
    let statusFinal = "";
    const adminFeedback = {
      foiExcluido: foiExcluido,
      dataResolucao: serverTimestamp(),
      adminNome: adminUser.nome || "Admin",
    };
    if (foiExcluido === "sim") {
      if (!dataExclusaoInput || !mensagemAdmin) {
        alert("Para 'Sim', a data da exclusão e a mensagem são obrigatórias.");
        saveButton.disabled = false;
        saveButton.innerHTML = "Salvar Resposta";
        return;
      }
      statusFinal = "Concluída";
      adminFeedback.dataExclusao = Timestamp.fromDate(
        new Date(dataExclusaoInput + "T00:00:00")
      );
      adminFeedback.mensagemAdmin = mensagemAdmin;
    } else {
      if (!motivoRejeicao) {
        alert("Para 'Não', o motivo da rejeição é obrigatório.");
        saveButton.disabled = false;
        saveButton.innerHTML = "Salvar Resposta";
        return;
      }
      statusFinal = "Rejeitada";
      adminFeedback.motivoRejeicao = motivoRejeicao;
    }
    try {
      const docRef = doc(dbInstance, "solicitacoesExclusaoGrade", docId);
      await updateDoc(docRef, {
        status: statusFinal,
        adminFeedback: adminFeedback,
      });
      console.log("Solicitação atualizada com sucesso!");
      closeModal();
    } catch (error) {
      console.error("Erro ao atualizar solicitação:", error);
      alert("Erro ao salvar. Tente novamente.");
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta";
    }
  }

  // --- Funções do Modal (Genéricas) ---
  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
    modalBodyContent.innerHTML = "";
    modalFooterActions
      .querySelectorAll(".dynamic-action-btn")
      .forEach((btn) => btn.remove());
    modalTitle.textContent = "Detalhes da Solicitação";
  }

  // --- Inicialização ---
  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario(); // <-- AGORA ESTÁ SENDO CHAMADO
  loadDesfechosPB();
  loadStatusContratos();
  loadExclusaoHorarios();

  // --- Listener de Evento Genérico (V2.3) ---
  if (tabContentContainer) {
    tabContentContainer.addEventListener("click", async (e) => {
      // Botão de Exclusão (Existente)
      const buttonExclusao = e.target.closest(".btn-acao-exclusao");
      if (buttonExclusao) {
        const docId = buttonExclusao.dataset.id;
        const docRef = doc(dbInstance, "solicitacoesExclusaoGrade", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          openExclusaoModal(docId, docSnap.data());
        } else {
          console.error("Documento não encontrado!");
          alert("Erro: Solicitação não encontrada.");
        }
        return; // Para a execução
      }

      // Botão de Alteração (Novo)
      const buttonAlteracao = e.target.closest(".btn-acao-alteracao");
      if (buttonAlteracao) {
        const docId = buttonAlteracao.dataset.id;
        console.log("Clicou em 'Processar' para alteração de horário:", docId);
        alert(
          "TODO: Criar o modal para 'Alteração de Horário' (ex: openAlteracaoHorarioModal())."
        );
        // TODO: Você precisará criar uma função 'openAlteracaoHorarioModal(docId)'
        // similar à 'openExclusaoModal' para processar este item.
        return;
      }

      // TODO: Adicionar 'else if' para os outros botões
      // (ex: .btn-acao-novas-sessoes)
    });
  }

  // Event listeners do modal (Fechar/Cancelar)
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }
}
