// Arquivo: /modulos/servico-social/js/agendamentos-view.js
// --- VERSÃO CORRIGIDA (Busca reavaliações pendentes na trilha) ---

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

// --- Lógica da Aba de Reavaliação (MODIFICADA) ---
async function loadReavaliacaoData() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  const emptyState = document.getElementById("reavaliacao-empty-state");
  if (!tableBody || !emptyState) return;

  // *** MODIFICADO: Ajustado colspan para 6 colunas (Nome, Tel, Valor Atual, Solicitado Por, Data Solicitação, Ação) ***
  tableBody.innerHTML =
    '<tr><td colspan="6"><div class="loading-spinner"></div></td></tr>';
  emptyState.style.display = "none";

  // Não precisamos mais filtrar por admin/assistente aqui, pois a lista é de pacientes aguardando *qualquer* assistente
  // const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    // *** MODIFICADO: Consulta na coleção 'trilhaPaciente' ***
    const trilhaRef = collection(db, "trilhaPaciente");
    const queryConstraints = [
      // *** MODIFICADO: Filtro de status correto ***
      where("status", "==", "aguardando_reavaliacao"),
      // *** MODIFICADO: Ordenar pela data em que a solicitação foi aprovada (se disponível) ou lastUpdate ***
      orderBy("solicitacaoReavaliacaoAprovadaEm", "desc"), // Ordena pelos mais recentes primeiro
      // orderBy("lastUpdate", "desc") // Fallback de ordenação
    ];

    // *** REMOVIDO: Filtro por assistenteSocialId não se aplica aqui ***
    // if (!isAdmin) { ... }

    const q = query(trilhaRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.textContent =
        "Nenhum paciente aguardando agendamento de reavaliação."; // Mensagem ajustada
      emptyState.style.display = "block";
      return;
    }

    let rowsHtml = "";
    for (const docSnapshot of snapshot.docs) {
      // Usar for...of para permitir await dentro do loop
      const data = docSnapshot.data();
      const pacienteId = docSnapshot.id;

      // Tenta buscar o nome do profissional que solicitou (pode não estar na trilha)
      // Idealmente, o ID do solicitante estaria na trilha ou buscaríamos a última solicitação aprovada.
      // Simplificação: Exibe "N/I" por enquanto. Para exibir o nome, precisaríamos buscar na coleção 'solicitacoes'
      let solicitanteNome = "N/I";
      // let dataSolicitacaoAprovada = data.solicitacaoReavaliacaoAprovadaEm?.toDate ? data.solicitacaoReavaliacaoAprovadaEm.toDate().toLocaleDateString("pt-BR") : "N/A";
      // Pegar data da última atualização como fallback se 'solicitacaoReavaliacaoAprovadaEm' não existir
      let dataStatusUpdate = data.lastUpdate?.toDate
        ? data.lastUpdate.toDate().toLocaleDateString("pt-BR")
        : "N/A";
      if (data.solicitacaoReavaliacaoAprovadaEm?.toDate) {
        dataStatusUpdate = data.solicitacaoReavaliacaoAprovadaEm
          .toDate()
          .toLocaleDateString("pt-BR");
      }

      // Formata o valor da contribuição atual
      const valorAtualFormatado = data.valorContribuicao
        ? `R$ ${parseFloat(data.valorContribuicao)
            .toFixed(2)
            .replace(".", ",")}`
        : "N/A";

      // *** MODIFICADO: Estrutura da linha e botão de ação ***
      rowsHtml += `
            <tr>
                <td>${data.nomeCompleto || "N/A"}</td>
                <td>${data.telefoneCelular || "N/A"}</td>
                <td>${valorAtualFormatado}</td>
                <td>${solicitanteNome}</td> {/* Idealmente buscar da solicitação original */}
                <td>${dataStatusUpdate}</td> {/* Data que entrou no status */}
                <td>
                    {/* O botão agora deve levar para uma tela/modal de AGENDAR a reavaliação */}
                    {/* Exemplo: #agendar-reavaliacao/id_do_paciente */}
                    <a href="#disponibilidade-agendamentos/${pacienteId}" class="action-button">
                        Agendar Reavaliação
                    </a>
                    {/* Ou link direto para fila-atendimento se a intenção for já realizar */}
                    {/* <a href="#fila-atendimento/${pacienteId}/reavaliacao/NOVO" class="action-button">Realizar Reavaliação</a> */}
                </td>
            </tr>`;
    } // Fim do for...of

    tableBody.innerHTML = rowsHtml;
  } catch (error) {
    console.error("Erro ao carregar pacientes aguardando reavaliação:", error);
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar os pacientes para reavaliação.";
    emptyState.style.display = "block";
  }
}
