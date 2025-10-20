// Arquivo: /modulos/servico-social/js/agendamentos-view.js
// Responsável por gerenciar as abas de Triagem e Reavaliação

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  getDoc,
} from "../../../assets/js/firebase-init.js";
// REMOVIDA: A linha "import { getUserData } from "../../../assets/js/app.js";" foi removida.

let currentUserData = null; // Guardar dados do usuário logado

export function init(user, userData) {
  currentUserData = userData; // Armazena os dados do usuário
  setupTabs();
  loadTriagemData(); // Carrega a aba de triagem por padrão
  // --- INÍCIO DA ALTERAÇÃO ---
  // REMOVIDO: addModalEventListeners(); // Não precisamos mais do modal
  // --- FIM DA ALTERAÇÃO ---
}

function setupTabs() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const tabId = link.dataset.tab;

      // Desativa todos
      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Ativa o clicado
      link.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      // Carrega os dados da aba correspondente
      if (tabId === "triagem") {
        loadTriagemData();
      } else if (tabId === "reavaliacao") {
        loadReavaliacaoData();
      }
    });
  });
}

// --- Lógica da Aba de Triagem (Sem alterações) ---
async function loadTriagemData() {
  const tableBody = document.getElementById("triagem-table-body");
  const emptyState = document.getElementById("triagem-empty-state");
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML =
    '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>'; // Colspan 8
  emptyState.style.display = "none";

  const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    const trilhaRef = collection(db, "trilhaPaciente");
    const queryConstraints = [
      where("status", "==", "triagem_agendada"),
      orderBy("dataTriagem", "asc"), // Ordenar pela data da triagem
      orderBy("horaTriagem", "asc"), // Depois pela hora
    ];

    if (!isAdmin) {
      queryConstraints.push(
        where("assistenteSocialId", "==", currentUserData.uid) // Filtrar pelo ID
      );
    }

    const q = query(trilhaRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = ""; // Limpa a tabela
      emptyState.style.display = "block"; // Mostra mensagem
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const dataAgendamento = data.dataTriagem
        ? new Date(data.dataTriagem + "T03:00:00").toLocaleDateString("pt-BR")
        : "Não definida";

      rowsHtml += `
          <tr>
              <td>${data.tipoTriagem || "N/A"}</td>
              <td>${data.nomeCompleto || "N/A"}</td>
              <td>${data.responsavel?.nome || "N/A"}</td>
              <td>${data.telefoneCelular || "N/A"}</td>
              <td>${dataAgendamento}</td>
              <td>${data.horaTriagem || "N/A"}</td>
              <td>${data.assistenteSocialNome || "N/A"}</td>
              <td>
                  <a href="#fila-atendimento/${doc.id}" class="action-button">
                      Preencher Ficha
                  </a>
              </td>
          </tr>
      `;
    });
    tableBody.innerHTML = rowsHtml;
  } catch (error) {
    console.error("Erro ao carregar agendamentos de triagem:", error);
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar os agendamentos de triagem.";
    emptyState.style.display = "block";
  }
}

// --- Lógica da Aba de Reavaliação (MODIFICADA) ---
async function loadReavaliacaoData() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  const emptyState = document.getElementById("reavaliacao-empty-state");
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML =
    '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>'; // Colspan 7
  emptyState.style.display = "none";

  const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    const agendamentosRef = collection(db, "agendamentos");
    const queryConstraints = [
      where("tipo", "==", "reavaliacao"),
      where("status", "in", ["agendado", "reagendado"]), // Buscar agendados ou reagendados
      orderBy("dataAgendamento", "asc"), // Ordenar por data/hora do Firebase Timestamp
    ];

    if (!isAdmin) {
      queryConstraints.push(
        where("assistenteSocialId", "==", currentUserData.uid) // Filtrar pelo ID
      );
    }

    const q = query(agendamentosRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const dataAgendamento = data.dataAgendamento?.toDate
        ? data.dataAgendamento.toDate().toLocaleDateString("pt-BR")
        : "N/A";
      const horaAgendamento = data.dataAgendamento?.toDate
        ? data.dataAgendamento
            .toDate()
            .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "N/A";
      const statusFormatado = (data.status || "agendado")
        .replace("_", " ")
        .replace(/^\w/, (c) => c.toUpperCase());

      // --- INÍCIO DA ALTERAÇÃO ---
      // O botão agora é um link <a> que aponta para a fila de atendimento,
      // passando o ID do paciente (trilhaId) e o ID do agendamento.
      rowsHtml += `
          <tr data-agendamento-id="${doc.id}" data-paciente-id="${
        data.pacienteId
      }">
              <td>${data.pacienteNome || "N/A"}</td>
              <td>${data.profissionalNome || "N/A"}</td>
              <td>${dataAgendamento}</td>
              <td>${horaAgendamento}</td>
              <td>${data.assistenteSocialNome || "N/A"}</td>
              <td><span class="status-badge status-${
                data.status || "agendado"
              }">${statusFormatado}</span></td>
              <td>
                  <a href="#fila-atendimento/${data.pacienteId}/reavaliacao/${
        doc.id
      }" class="action-button">
                      Realizar Reavaliação
                  </a>
              </td>
          </tr>
      `;
      // --- FIM DA ALTERAÇÃO ---
    });
    tableBody.innerHTML = rowsHtml;

    // REMOVIDO: addReavaliacaoButtonListeners(); // Não precisamos mais adicionar listeners aos botões
  } catch (error) {
    console.error("Erro ao carregar agendamentos de reavaliação:", error);
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar os agendamentos de reavaliação.";
    emptyState.style.display = "block";
  }
}
