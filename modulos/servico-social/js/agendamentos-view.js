// Arquivo: /modulos/servico-social/js/agendamentos-view.js
// --- VERSÃO CORRIGIDA 3 (Busca solicitações PENDENTES e linka para FILA) ---

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

// Função auxiliar para formatar datas (simplificada para DD/MM/AAAA)
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
  // Garante que a primeira aba seja carregada se nenhuma estiver ativa
  if (!document.querySelector(".tab-link.active")) {
    loadTriagemData(); // Carrega triagem por padrão inicial
  } else if (
    document.querySelector(".tab-link.active[data-tab='reavaliacao']")
  ) {
    loadReavaliacaoData(); // Se a aba reavaliação já estiver ativa, carrega ela
  } else {
    loadTriagemData(); // Senão, carrega triagem
  }
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
      const activeContent = document.getElementById(tabId);
      if (activeContent) activeContent.classList.add("active");

      if (tabId === "triagem") {
        loadTriagemData();
      } else if (tabId === "reavaliacao") {
        loadReavaliacaoData(); // Chama a função corrigida
      }
    });
  });
  // Ativa a primeira aba ao carregar, se nenhuma estiver ativa
  if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
    const firstTab = tabLinks[0];
    firstTab.classList.add("active");
    const firstContent = document.getElementById(firstTab.dataset.tab);
    if (firstContent) firstContent.classList.add("active");
    // Não chama loadTriagemData aqui, pois será chamado no init
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

// --- Lógica da Aba de Reavaliação (CORRIGIDA PARA FLUXO DIRETO) ---
async function loadReavaliacaoData() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  const emptyState = document.getElementById("reavaliacao-empty-state");
  if (!tableBody || !emptyState) return;

  // Colspan 6: Paciente, Solicitante, Data Solic., Motivo, Valor Atual, Ação
  tableBody.innerHTML =
    '<tr><td colspan="6"><div class="loading-spinner"></div></td></tr>';
  emptyState.style.display = "none";

  try {
    // Buscar SOLICITAÇÕES de reavaliação PENDENTES
    const solicitacoesRef = collection(db, "solicitacoes");
    const q = query(
      solicitacoesRef,
      where("tipo", "==", "reavaliacao"),
      where("status", "==", "Pendente"),
      orderBy("dataSolicitacao", "asc") // Mais antigas primeiro
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.textContent = "Nenhuma solicitação de reavaliação pendente.";
      emptyState.style.display = "block";
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const solicitacaoId = docSnapshot.id; // ID da solicitação
      const pacienteId = data.pacienteId; // ID do paciente (deve estar na solicitação)
      const detalhes = data.detalhes || {};

      if (!pacienteId) {
        console.warn(
          `Solicitação de reavaliação ${solicitacaoId} sem pacienteId.`
        );
        return; // Pula esta solicitação se não tiver ID do paciente
      }

      const dataSolicitacaoFormatada = formatarData(data.dataSolicitacao);
      const valorAtualFormatado = detalhes.valorContribuicaoAtual
        ? `R$ ${parseFloat(detalhes.valorContribuicaoAtual)
            .toFixed(2)
            .replace(".", ",")}`
        : "N/A";

      // Botão leva para fila-atendimento, passando pacienteId e solicitacaoId
      rowsHtml += `
            <tr>
                <td>${data.pacienteNome || "N/A"}</td>
                <td>${data.solicitanteNome || "N/A"}</td>
                <td>${dataSolicitacaoFormatada}</td>
                <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
                <td>${valorAtualFormatado}</td>
                <td>
                    {/* *** MODIFICADO: Link direto para fila-atendimento com pacienteId e solicitacaoId *** */}
                    <a href="#fila-atendimento/${pacienteId}/reavaliacao/${solicitacaoId}" class="action-button">
                        Realizar Reavaliação
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
