// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js

// Importações do Firebase (serão usadas depois para buscar dados)
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
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Função principal de inicialização do módulo
export function init(db, user, userData) {
  console.log("Módulo solicitacoes-admin.js iniciado.");

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
    console.log("Carregando solicitações de novas sessões...");
    const tableBody = document.getElementById("table-body-novas-sessoes");
    const emptyState = document.getElementById("empty-state-novas-sessoes");
    if (!tableBody || !emptyState) return;
    tableBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'solicitacoes_novas_sessoes'
  }

  function loadAlteracoesHorario() {
    console.log("Carregando solicitações de alteração de horário...");
    const tableBody = document.getElementById("table-body-alteracoes-horario");
    const emptyState = document.getElementById(
      "empty-state-alteracoes-horario"
    );
    if (!tableBody || !emptyState) return;
    tableBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'solicitacoes_alteracao_horario'
  }

  function loadDesfechosPB() {
    console.log("Carregando desfechos PB...");
    const tableBody = document.getElementById("table-body-desfechos-pb");
    const emptyState = document.getElementById("empty-state-desfechos-pb");
    if (!tableBody || !emptyState) return;
    tableBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    emptyState.style.display = "none";
    // TODO: Implementar busca no Firebase 'desfechos_atendimento_pb'
  }

  function loadStatusContratos() {
    console.log("Carregando status dos contratos...");
    const tableBody = document.getElementById("table-body-status-contratos");
    const emptyState = document.getElementById("empty-state-status-contratos");
    if (!tableBody || !emptyState) return;
    tableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    emptyState.style.display = "none";
    // TODO: Implementar busca nos dados dos pacientes/atendimentos
  }

  // --- Funções do Modal (ainda vazias) ---
  function openModal() {
    if (modal) modal.style.display = "flex";
  }

  function closeModal() {
    if (modal) modal.style.display = "none";
    modalBodyContent.innerHTML = ""; // Limpa conteúdo anterior
    modalFooterActions
      .querySelectorAll(".dynamic-action-btn")
      .forEach((btn) => btn.remove()); // Remove botões dinâmicos
  }

  // --- Inicialização ---
  setupTabs();
  loadNovasSessoes(); // Carrega a primeira aba por padrão
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadStatusContratos();

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
