// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// Versão 2.4 (Busca 'Alteração de Horário' diretamente da trilhaPaciente)

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs, // Usaremos getDocs em vez de onSnapshot para a busca na trilha
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot, // Mantido para outras abas
  Timestamp,
} from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser;

// Função principal de inicialização do módulo
export function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js V2.4 (Buscando Alterações da Trilha) iniciado."
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
  const tabContentContainer = document.querySelector(".tab-content-container");

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

  // --- FUNÇÃO HELPER GENÉRICA (Para coleções DEDICADAS) ---
  // (Mantida para Exclusão Horários e outras futuras)
  function loadSolicitacoes(
    collectionName,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRow,
    statusField = "status",
    dateField = "dataSolicitacao"
  ) {
    // ... (código da V2.3 sem alterações) ...
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
            const tr = renderRow(data, doc.id); // Passa data E doc.id
            tableBody.innerHTML += tr; // Adiciona a linha
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
    // TODO: Implementar busca (pode usar loadSolicitacoes se tiver coleção dedicada)
  }

  // --- INÍCIO DA ALTERAÇÃO V2.4 ---
  /**
   * Carrega solicitações de alteração de horário buscando na trilhaPaciente
   */
  async function loadAlteracoesHorario() {
    console.log("Carregando alterações de horário da trilhaPaciente...");
    const tableBody = document.getElementById("table-body-alteracoes-horario");
    const emptyState = document.getElementById(
      "empty-state-alteracoes-horario"
    );
    const countBadge = document.getElementById("count-alteracoes-horario");

    if (!tableBody || !emptyState || !countBadge) {
      console.error("Elementos da tabela de alteração não encontrados.");
      return;
    }

    tableBody.innerHTML =
      '<tr><td colspan="7">Buscando na Trilha do Paciente...</td></tr>'; // Feedback visual
    emptyState.style.display = "none";
    countBadge.style.display = "none";
    countBadge.textContent = "0";

    try {
      const q = query(collection(dbInstance, "trilhaPaciente"));
      const querySnapshot = await getDocs(q); // Busca todos os pacientes

      let pendingSolicitacoes = [];

      querySnapshot.forEach((doc) => {
        const pacienteData = doc.data();
        const pacienteId = doc.id;
        const atendimentosPB = pacienteData.atendimentosPB || {};

        // Itera sobre cada atendimento PB do paciente
        for (const atendimentoId in atendimentosPB) {
          const atendimento = atendimentosPB[atendimentoId];
          const solicitacao = atendimento.solicitacaoAlteracaoHorario; // Pega a solicitação dentro do atendimento

          // Verifica se existe uma solicitação e se está pendente
          if (solicitacao && solicitacao.status === "Pendente") {
            // Adiciona informações extras para renderização
            pendingSolicitacoes.push({
              ...solicitacao, // Dados originais da solicitação
              pacienteId: pacienteId, // ID do paciente (pode ser útil)
              atendimentoId: atendimentoId, // ID do atendimento
              // Adiciona o nome do paciente se não estiver na solicitação (fallback)
              pacienteNome:
                solicitacao.pacienteNome ||
                pacienteData.nomeCompleto ||
                "Nome não encontrado",
              // Guarda a referência completa para facilitar a aprovação/rejeição
              _trilhaPath: `atendimentosPB.${atendimentoId}.solicitacaoAlteracaoHorario`,
            });
          }
        }
      });

      // Ordena as solicitações pendentes pela data (mais novas primeiro)
      pendingSolicitacoes.sort(
        (a, b) =>
          (b.dataSolicitacao?.toDate() || 0) -
          (a.dataSolicitacao?.toDate() || 0)
      );

      // Renderiza a tabela
      if (pendingSolicitacoes.length === 0) {
        tableBody.innerHTML = "";
        emptyState.style.display = "block";
        countBadge.style.display = "none";
      } else {
        tableBody.innerHTML = ""; // Limpa o "Buscando..."
        emptyState.style.display = "none";
        countBadge.textContent = pendingSolicitacoes.length;
        countBadge.style.display = "inline-block";

        pendingSolicitacoes.forEach((sol) => {
          const dataSol = sol.dataSolicitacao
            ? sol.dataSolicitacao.toDate().toLocaleDateString("pt-BR")
            : "N/A";
          const statusClass = `status-pendente`; // Sempre pendente aqui

          // Renderiza a linha da tabela (ajuste conforme necessário)
          const tr = `
              <tr>
                  <td>${dataSol}</td>
                  <td>${sol.solicitanteNome || "N/A"}</td>
                  <td>${sol.pacienteNome}</td> 
                  <td>${sol.dadosAntigos?.dia || "N/A"}, ${
            sol.dadosAntigos?.horario || "N/A"
          }</td>
                  <td>${sol.dadosNovos?.dia || "N/A"}, ${
            sol.dadosNovos?.horario || "N/A"
          } (${sol.dadosNovos?.modalidade || "N/A"})</td>
                  <td class="motivo-cell">${sol.justificativa || "N/A"}</td>
                  <td><span class="status-badge ${statusClass}">Pendente</span></td>
                  <td>
                      <button class="action-button btn-acao-alteracao-trilha" 
                              data-paciente-id="${sol.pacienteId}" 
                              data-atendimento-id="${sol.atendimentoId}"
                              data-trilha-path="${sol._trilhaPath}">
                          Processar
                      </button>
                  </td>
              </tr>
          `;
          tableBody.innerHTML += tr;
        });
      }
    } catch (error) {
      console.error("Erro ao buscar alterações na trilhaPaciente:", error);
      tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Erro ao carregar dados da Trilha do Paciente.</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  }
  // --- FIM DA ALTERAÇÃO V2.4 ---

  function loadDesfechosPB() {
    // TODO: Implementar busca (provavelmente na trilhaPaciente, buscando por status específico)
  }

  function loadStatusContratos() {
    // TODO: Implementar busca (provavelmente na trilhaPaciente)
  }

  function loadExclusaoHorarios() {
    // Mantém o uso da função genérica pois lê de coleção dedicada
    loadSolicitacoes(
      "solicitacoesExclusaoGrade",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      (data, docId) => {
        // Recebe docId aqui
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
                    <button class="action-button btn-acao-exclusao" data-doc-id="${docId}"> ${
          data.status === "Pendente" ? "Aprovar" : "Ver"
        }
                    </button>
                </td>
            </tr>
        `;
      }
    );
  }

  // --- Funções do Modal (Específicas de Exclusão - Ajustadas para usar docId) ---
  // (openExclusaoModal, setupModalFormLogic, handleSalvarExclusao)
  async function openExclusaoModal(docId) {
    // Recebe docId diretamente
    try {
      const docRef = doc(dbInstance, "solicitacoesExclusaoGrade", docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Solicitação não encontrada!");
      }
      const solicitacaoData = docSnap.data();

      modalTitle.textContent = "Processar Solicitação de Exclusão";

      const response = await fetch("./modal-exclusao-grade.html");
      if (!response.ok) throw new Error("Falha ao carregar o HTML do modal.");
      modalBodyContent.innerHTML = await response.text();

      document.getElementById("modal-solicitante-nome").textContent =
        solicitacaoData.solicitanteNome;
      document.getElementById("modal-solicitante-motivo").textContent =
        solicitacaoData.motivo;
      const horariosList = document.getElementById("modal-horarios-list");
      horariosList.innerHTML =
        solicitacaoData.horariosParaExcluir
          ?.map((h) => `<li>${h.label} (${h.path})</li>`)
          .join("") || "<li>Erro</li>";

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
        saveButton.addEventListener(
          "click",
          () => handleSalvarExclusao(docId),
          { once: true }
        ); // Passa docId
        setupModalFormLogic();
      } else {
        const feedback = solicitacaoData.adminFeedback || {};
        if (feedback.foiExcluido) {
          const radioToCheck = document.querySelector(
            `input[name="foiExcluido"][value="${feedback.foiExcluido}"]`
          );
          if (radioToCheck) radioToCheck.checked = true;
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
        setupModalFormLogic(); // Chama para garantir a exibição correta
      }
      openModal();
    } catch (error) {
      console.error("Erro ao abrir modal de exclusão:", error);
      alert(`Erro ao carregar detalhes: ${error.message}`);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes da solicitação.</p>`;
      openModal(); // Abre o modal mesmo com erro para mostrar a mensagem
    }
  }
  // (setupModalFormLogic permanece igual)
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

    // Adiciona listeners apenas uma vez
    if (!radioSim.hasAttribute("data-listener-added")) {
      radioSim.addEventListener("change", toggleFields);
      radioNao.addEventListener("change", toggleFields);
      radioSim.setAttribute("data-listener-added", "true");
    }
    toggleFields(); // Chama para definir o estado inicial
  }
  // (handleSalvarExclusao permanece igual, usando Timestamp importado)
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
      try {
        // Converte a data do input (YYYY-MM-DD) para Timestamp
        adminFeedback.dataExclusao = Timestamp.fromDate(
          new Date(dataExclusaoInput + "T00:00:00")
        );
      } catch (dateError) {
        alert("Data de exclusão inválida.");
        saveButton.disabled = false;
        saveButton.innerHTML = "Salvar Resposta";
        return;
      }
      adminFeedback.mensagemAdmin = mensagemAdmin;
    } else {
      // foiExcluido === "nao"
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

      console.log("Solicitação de exclusão atualizada com sucesso!");
      closeModal();
    } catch (error) {
      console.error("Erro ao atualizar solicitação de exclusão:", error);
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
  loadAlteracoesHorario(); // <-- AGORA BUSCA NA TRILHA
  loadDesfechosPB();
  loadStatusContratos();
  loadExclusaoHorarios(); // <-- Busca na coleção dedicada

  // --- Listener de Evento Genérico (Ajustado para Alteração vindo da Trilha) ---
  if (tabContentContainer) {
    tabContentContainer.addEventListener("click", async (e) => {
      // Botão de Exclusão (Lê da coleção dedicada)
      const buttonExclusao = e.target.closest(".btn-acao-exclusao");
      if (buttonExclusao) {
        const docId = buttonExclusao.dataset.docId; // Pega o ID do documento
        if (docId) {
          openExclusaoModal(docId); // Abre o modal passando o ID
        } else {
          console.error("Doc ID não encontrado no botão de exclusão");
        }
        return;
      }

      // Botão de Alteração (Lê da trilha)
      const buttonAlteracaoTrilha = e.target.closest(
        ".btn-acao-alteracao-trilha"
      );
      if (buttonAlteracaoTrilha) {
        const pacienteId = buttonAlteracaoTrilha.dataset.pacienteId;
        const atendimentoId = buttonAlteracaoTrilha.dataset.atendimentoId;
        const trilhaPath = buttonAlteracaoTrilha.dataset.trilhaPath; // Caminho para a solicitação dentro da trilha
        console.log("Processar alteração da trilha:", {
          pacienteId,
          atendimentoId,
          trilhaPath,
        });
        alert(
          "TODO: Criar modal para processar alteração vinda da Trilha do Paciente."
        );
        // TODO: Criar openAlteracaoTrilhaModal(pacienteId, atendimentoId, trilhaPath)
        // Esta função precisará ler o documento trilhaPaciente, extrair a solicitação,
        // exibir no modal e, ao salvar, ATUALIZAR o status DENTRO da trilhaPaciente
        // e opcionalmente remover/atualizar a entrada na coleção 'solicitacoesAlteracaoHorario' se ela ainda existir.
        return;
      }

      // TODO: Adicionar 'else if' para os outros botões (Novas Sessões, Desfechos, etc.)
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
