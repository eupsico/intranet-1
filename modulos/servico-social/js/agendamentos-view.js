// Arquivo: /modulos/servico-social/js/agendamentos-view.js
// --- VERSÃO CORRIGIDA 2 (Busca solicitações PENDENTES de reavaliação) ---

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

let currentUserData = null;

// *** NOVO: Função auxiliar para formatar datas ***
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return "N/A";
}

export function init(user, userData) {
  currentUserData = userData;
  setupTabs();
  loadTriagemData(); // Carrega triagem por padrão
}

function setupTabs() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const tabId = link.dataset.tab;
      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      link.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      if (tabId === "triagem") {
        loadTriagemData();
      } else if (tabId === "reavaliacao") {
        loadReavaliacaoData(); // Chama a função corrigida
      }
    });
  });
  // Ativa a primeira aba ao carregar, se nenhuma estiver ativa
  if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
    tabLinks[0].dispatchEvent(new Event("click")); // Simula clique na primeira aba
  }
}

// --- Lógica da Aba de Triagem (Sem alterações) ---
async function loadTriagemData() {
  const tableBody = document.getElementById("triagem-table-body");
  const emptyState = document.getElementById("triagem-empty-state");
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML =
    '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';
  emptyState.style.display = "none";

  const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    const trilhaRef = collection(db, "trilhaPaciente");
    const queryConstraints = [
      where("status", "==", "triagem_agendada"),
      orderBy("dataTriagem", "asc"),
      orderBy("horaTriagem", "asc"),
    ];

    if (!isAdmin) {
      queryConstraints.push(
        where("assistenteSocialId", "==", currentUserData.uid)
      );
    }

    const q = query(trilhaRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
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
            </tr>`;
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

// --- Lógica da Aba de Reavaliação (MODIFICADA NOVAMENTE) ---
async function loadReavaliacaoData() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  const emptyState = document.getElementById("reavaliacao-empty-state");
  if (!tableBody || !emptyState) return;

  // *** MODIFICADO: Ajustado colspan para 6 colunas (Paciente, Solicitante, Data Solic., Motivo, Valor Atual, Ação) ***
  tableBody.innerHTML =
    '<tr><td colspan="6"><div class="loading-spinner"></div></td></tr>';
  emptyState.style.display = "none";

  try {
    // *** MODIFICADO: Consulta na coleção 'solicitacoes' por tipo 'reavaliacao' e status 'Pendente' ***
    const solicitacoesRef = collection(db, "solicitacoes");
    const queryConstraints = [
      where("tipo", "==", "reavaliacao"),
      where("status", "==", "Pendente"),
      orderBy("dataSolicitacao", "asc"), // Ordena pelas mais antigas primeiro
    ];

    const q = query(solicitacoesRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.textContent = "Nenhuma solicitação de reavaliação pendente."; // Mensagem ajustada
      emptyState.style.display = "block";
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const solicitacaoId = docSnapshot.id;
      const detalhes = data.detalhes || {};

      const dataSolicitacaoFormatada = formatarData(data.dataSolicitacao); // Usa a função auxiliar

      // Formata o valor da contribuição atual (vem dos detalhes da solicitação)
      const valorAtualFormatado = detalhes.valorContribuicaoAtual
        ? `R$ ${parseFloat(detalhes.valorContribuicaoAtual)
            .toFixed(2)
            .replace(".", ",")}`
        : "N/A";

      // *** MODIFICADO: Estrutura da linha para exibir dados da SOLICITAÇÃO e botão de agendar ***
      rowsHtml += `
            <tr>
                <td>${data.pacienteNome || "N/A"}</td>
                <td>${data.solicitanteNome || "N/A"}</td> 
                <td>${dataSolicitacaoFormatada}</td>
                <td class="motivo-cell">${detalhes.motivo || "N/A"}</td> 
                <td>${valorAtualFormatado}</td>
                <td>
                    <a href="#disponibilidade-agendamentos/${
                      data.pacienteId
                    }?solicitacaoId=${solicitacaoId}" class="action-button">
                        Agendar Reavaliação
                    </a>
                </td>
            </tr>`;
    });

    tableBody.innerHTML = rowsHtml;
  } catch (error) {
    console.error(
      "Erro ao carregar solicitações de reavaliação pendentes:",
      error
    );
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar as solicitações de reavaliação.";
    emptyState.style.display = "block";
  }
}
