// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// Versão 2.0 (Implementa a lógica da aba "Exclusão Horários")

import {
  getFirestore,
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
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// Variável global para o db
let dbInstance;
let adminUser; // Armazena o usuário admin que está logado

// Função principal de inicialização do módulo
export function init(db, user, userData) {
  console.log("Módulo solicitacoes-admin.js iniciado.");
  dbInstance = db; // Armazena a instância do DB
  adminUser = userData; // Armazena dados do admin logado

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

  // --- Lógica de Troca de Abas ---
  function setupTabs() {
    if (!tabsContainer) return;

    tabsContainer.addEventListener("click", (event) => {
      const clickedTab = event.target.closest(".tab-link");
      if (!clickedTab) return;

      const targetTabId = clickedTab.dataset.tab;

      // Remove 'active' de todas as abas e conteúdos
      tabLinks.forEach((link) => link.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Adiciona 'active' na aba clicada e no conteúdo correspondente
      clickedTab.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add("active");
      } else {
        console.error(`Conteúdo da aba não encontrado: ${targetTabId}`);
      }
    });
  }

  // --- Funções de Carregamento de Dados (ainda vazias) ---
  function loadNovasSessoes() {
    // console.log("Carregando solicitações de novas sessões...");
    const tableBody = document.getElementById("table-body-novas-sessoes");
    const emptyState = document.getElementById("empty-state-novas-sessoes");
    if (!tableBody || !emptyState) return;
    // tableBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    // emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'solicitacoes_novas_sessoes'
  }

  function loadAlteracoesHorario() {
    // console.log("Carregando solicitações de alteração de horário...");
    const tableBody = document.getElementById("table-body-alteracoes-horario");
    const emptyState = document.getElementById(
      "empty-state-alteracoes-horario"
    );
    if (!tableBody || !emptyState) return;
    // tableBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    // emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'solicitacoes_alteracao_horario'
  }

  function loadDesfechosPB() {
    // console.log("Carregando desfechos PB...");
    const tableBody = document.getElementById("table-body-desfechos-pb");
    const emptyState = document.getElementById("empty-state-desfechos-pb");
    if (!tableBody || !emptyState) return;
    // tableBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    // emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'desfechos_atendimento_pb'
  }

  function loadStatusContratos() {
    // console.log("Carregando status dos contratos...");
    const tableBody = document.getElementById("table-body-status-contratos");
    const emptyState = document.getElementById("empty-state-status-contratos");
    if (!tableBody || !emptyState) return;
    // tableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    // emptyState.style.display = "none";
    // TODO: Implementar busca nos dados dos pacientes/atendimentos
  }

  // --- INÍCIO: NOVAS FUNÇÕES (EXCLUSÃO DE HORÁRIOS) ---

  /**
   * Carrega e monitora as solicitações de exclusão de horários
   */
  function loadExclusaoHorarios() {
    console.log("Carregando solicitações de exclusão de horários...");
    const tableBody = document.getElementById("table-body-exclusao-horarios");
    const emptyState = document.getElementById("empty-state-exclusao-horarios");
    const countBadge = document.getElementById("count-exclusao-horarios");

    if (!tableBody || !emptyState || !countBadge) {
      console.error("Elementos da tabela de exclusão não encontrados.");
      return;
    }

    const q = query(
      collection(dbInstance, "solicitacoesExclusaoGrade"),
      orderBy("dataSolicitacao", "desc")
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

        tableBody.innerHTML = ""; // Limpa a tabela
        emptyState.style.display = "none";
        let pendingCount = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === "Pendente") {
            pendingCount++;
          }

          const dataSol = data.dataSolicitacao
            ? data.dataSolicitacao.toDate().toLocaleDateString("pt-BR")
            : "N/A";

          const horariosLabels = data.horariosParaExcluir
            .map((h) => h.label)
            .join(", ");

          const statusClass = `status-${String(data.status).toLowerCase()}`;

          const tr = document.createElement("tr");
          tr.innerHTML = `
                        <td>${dataSol}</td>
                        <td>${data.solicitanteNome}</td>
                        <td>${data.totalHorariosAtual}</td>
                        <td>${horariosLabels}</td>
                        <td class="motivo-cell">${data.motivo}</td>
                        <td><span class="status-badge ${statusClass}">${
            data.status
          }</span></td>
                        <td>
                            <button class="btn btn-primary btn-sm btn-acao-exclusao" data-id="${
                              doc.id
                            }">
                                ${
                                  data.status === "Pendente" ? "Aprovar" : "Ver"
                                }
                            </button>
                        </td>
                    `;
          tableBody.appendChild(tr);
        });

        // Atualiza o contador de pendentes
        if (pendingCount > 0) {
          countBadge.textContent = pendingCount;
          countBadge.style.display = "inline-block";
        } else {
          countBadge.style.display = "none";
        }
      },
      (error) => {
        console.error("Erro ao buscar solicitações de exclusão:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Erro ao carregar dados.</td></tr>`;
      }
    );
  }

  /**
   * Abre o modal para processar a solicitação de exclusão
   * @param {string} docId - ID do documento da solicitação
   * @param {object} solicitacaoData - Dados da solicitação
   */
  async function openExclusaoModal(docId, solicitacaoData) {
    modalTitle.textContent = "Processar Solicitação de Exclusão";

    // 1. Carrega o HTML do formulário do modal
    try {
      const response = await fetch(
        "modulos/administrativo/page/modal-exclusao-grade.html"
      );
      if (!response.ok) throw new Error("Falha ao carregar o HTML do modal.");
      modalBodyContent.innerHTML = await response.text();
    } catch (error) {
      console.error(error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar o formulário.</p>`;
      openModal();
      return;
    }

    // 2. Preenche os detalhes da solicitação
    document.getElementById("modal-solicitante-nome").textContent =
      solicitacaoData.solicitanteNome;
    document.getElementById("modal-solicitante-motivo").textContent =
      solicitacaoData.motivo;
    const horariosList = document.getElementById("modal-horarios-list");
    horariosList.innerHTML = solicitacaoData.horariosParaExcluir
      .map((h) => `<li>${h.label} (${h.path})</li>`)
      .join("");

    // 3. Adiciona os botões de ação dinâmicos
    // Limpa botões antigos (exceto o "Fechar" padrão)
    modalFooterActions
      .querySelectorAll(".dynamic-action-btn")
      .forEach((btn) => btn.remove());

    if (solicitacaoData.status === "Pendente") {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.id = "btn-salvar-exclusao";
      saveButton.className = "btn btn-primary dynamic-action-btn";
      saveButton.textContent = "Salvar Resposta";
      modalFooterActions.appendChild(saveButton);

      // 4. Adiciona listener ao botão Salvar
      saveButton.addEventListener("click", () => handleSalvarExclusao(docId), {
        once: true,
      }); // {once: true} previne clicks duplicados

      // 5. Adiciona lógica de visibilidade do formulário
      setupModalFormLogic();
    } else {
      // Se não estiver pendente, apenas exibe os dados preenchidos
      const feedback = solicitacaoData.adminFeedback || {};
      document.querySelector(
        `input[name="foiExcluido"][value="${feedback.foiExcluido}"]`
      ).checked = true;
      document.getElementById("dataExclusao").valueAsDate =
        feedback.dataExclusao ? feedback.dataExclusao.toDate() : null;
      document.getElementById("mensagemAdmin").value =
        feedback.mensagemAdmin || "";
      document.getElementById("motivoRejeicao").value =
        feedback.motivoRejeicao || "";
      // Desabilita todos os campos
      modalBodyContent
        .querySelectorAll("input, textarea")
        .forEach((el) => (el.disabled = true));
      setupModalFormLogic(); // Roda para mostrar os campos corretos
    }

    // 6. Abre o modal
    openModal();
  }

  /**
   * Adiciona a lógica de show/hide para os campos do formulário do modal
   */
  function setupModalFormLogic() {
    const radioSim = document.getElementById("radioExcluidoSim");
    const radioNao = document.getElementById("radioExcluidoNao");
    const camposSim = document.getElementById("campos-feedback-sim");
    const camposNao = document.getElementById("campos-feedback-nao");

    const toggleFields = () => {
      camposSim.style.display = radioSim.checked ? "block" : "none";
      camposNao.style.display = radioNao.checked ? "block" : "none";
    };

    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields(); // Chama na inicialização
  }

  /**
   * Salva a resposta do admin para a solicitação de exclusão
   * @param {string} docId
   */
  async function handleSalvarExclusao(docId) {
    const saveButton = document.getElementById("btn-salvar-exclusao");
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="loading-spinner-small"></span> Salvando...`;

    const foiExcluido = document.querySelector(
      'input[name="foiExcluido"]:checked'
    )?.value; // "sim" ou "nao"
    const dataExclusaoInput = document.getElementById("dataExclusao").value;
    const mensagemAdmin = document.getElementById("mensagemAdmin").value;
    const motivoRejeicao = document.getElementById("motivoRejeicao").value;

    // Validação
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
      adminNome: adminUser.nomeCompleto || "Admin",
    };

    if (foiExcluido === "sim") {
      if (!dataExclusaoInput || !mensagemAdmin) {
        alert("Para 'Sim', a data da exclusão e a mensagem são obrigatórias.");
        saveButton.disabled = false;
        saveButton.innerHTML = "Salvar Resposta";
        return;
      }
      statusFinal = "Concluída";
      adminFeedback.dataExclusao = new Date(dataExclusaoInput + "T00:00:00"); // Adiciona hora para evitar problemas de fuso
      adminFeedback.mensagemAdmin = mensagemAdmin;
    } else {
      // (foiExcluido === "nao")
      if (!motivoRejeicao) {
        alert("Para 'Não', o motivo da rejeição é obrigatório.");
        saveButton.disabled = false;
        saveButton.innerHTML = "Salvar Resposta";
        return;
      }
      statusFinal = "Rejeitada";
      adminFeedback.motivoRejeicao = motivoRejeicao;
    }

    // Atualiza o documento no Firestore
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

  // --- FIM: NOVAS FUNÇÕES ---

  // --- Funções do Modal (Genéricas) ---
  function openModal() {
    if (modal) modal.style.display = "flex";
  }

  function closeModal() {
    if (modal) modal.style.display = "none";
    modalBodyContent.innerHTML = ""; // Limpa conteúdo anterior
    modalFooterActions
      .querySelectorAll(".dynamic-action-btn")
      .forEach((btn) => btn.remove()); // Remove botões dinâmicos
    modalTitle.textContent = "Detalhes da Solicitação"; // Reseta título
  }

  // --- Inicialização ---
  setupTabs();
  loadNovasSessoes(); // Carrega a primeira aba por padrão
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadStatusContratos();
  loadExclusaoHorarios(); // CHAMA A NOVA FUNÇÃO

  // Adiciona listener de evento na tabela de exclusão (event delegation)
  const tableBodyExclusao = document.getElementById(
    "table-body-exclusao-horarios"
  );
  if (tableBodyExclusao) {
    tableBodyExclusao.addEventListener("click", async (e) => {
      const button = e.target.closest(".btn-acao-exclusao");
      if (button) {
        const docId = button.dataset.id;
        // Busca os dados mais recentes antes de abrir o modal
        const docRef = doc(dbInstance, "solicitacoesExclusaoGrade", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          openExclusaoModal(docId, docSnap.data());
        } else {
          console.error("Documento não encontrado!");
          alert("Erro: Solicitação não encontrada.");
        }
      }
    });
  }

  // Event listeners do modal
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  // Fecha o modal se clicar fora do conteúdo
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }
}
