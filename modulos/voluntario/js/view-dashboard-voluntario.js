// Arquivo: /modulos/voluntario/js/view-dashboard-voluntario.js
// --- VERSÃO CORRIGIDA: Adiciona busca e exibição de 'Minhas Solicitações' ---

import {
  db,
  doc,
  getDoc,
  onSnapshot, // Mantido para grade
  // Novas importações para buscar solicitações:
  collection,
  query,
  where,
  orderBy,
  limit, // Opcional, para limitar o número de solicitações exibidas
} from "../../../assets/js/firebase-init.js";

// Função auxiliar para formatar Timestamp ou retornar 'N/A' (pode mover para utils se usada em outros lugares)
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

// Função auxiliar para nomes amigáveis dos tipos (pode mover para utils)
function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    reavaliacao: "Solicitação Reavaliação",
    exclusao_horario: "Exclusão de Horário",
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
  };
  return mapaTipos[tipoInterno] || tipoInterno;
}

export function init(db_ignored, user, userData) {
  // db é importado, db_ignored não é usado
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");
  // *** NOVO: Seletor para a tabela de solicitações ***
  const solicitacoesTableBody = document.getElementById(
    "dashboard-solicitacoes-tbody"
  );
  const solicitacoesEmptyState = document.getElementById(
    "dashboard-solicitacoes-empty"
  );

  if (
    !summaryContainer ||
    !infoCardContainer ||
    !solicitacoesTableBody ||
    !solicitacoesEmptyState
  ) {
    // Verifica novos seletores
    console.error(
      "Elementos do container do dashboard ou tabela de solicitações não encontrados."
    );
    return;
  }

  let dadosDasGrades = {};
  let valoresConfig = {};
  const diasDaSemana = {
    /* ... (mantido) ... */
  };
  const userRoles = userData.funcoes || [];
  const hasFinanceAccess =
    userRoles.includes("admin") || userRoles.includes("financeiro");

  async function fetchValoresConfig() {
    /* ... (código igual) ... */
  }
  function renderSummaryPanel() {
    /* ... (código igual) ... */
  }
  function renderInfoCard() {
    /* ... (código igual) ... */
  }

  // *** NOVA FUNÇÃO: Carregar e Renderizar Minhas Solicitações ***
  function loadAndRenderMinhasSolicitacoes() {
    console.log("Carregando Minhas Solicitações...");
    solicitacoesTableBody.innerHTML =
      '<tr><td colspan="4"><div class="loading-spinner-small" style="margin: 10px auto;"></div></td></tr>'; // Mostra loading na tabela
    solicitacoesEmptyState.style.display = "none";

    try {
      const q = query(
        collection(db, "solicitacoes"),
        where("solicitanteId", "==", user.uid), // Filtra pelo ID do usuário logado
        orderBy("dataSolicitacao", "desc"), // Ordena pelas mais recentes
        limit(15) // Limita a 15 solicitações no dashboard (opcional)
      );

      // Usa onSnapshot para atualizações em tempo real
      onSnapshot(
        q,
        (querySnapshot) => {
          solicitacoesTableBody.innerHTML = ""; // Limpa a tabela

          if (querySnapshot.empty) {
            solicitacoesEmptyState.style.display = "block"; // Mostra mensagem de vazio
          } else {
            solicitacoesEmptyState.style.display = "none";
            querySnapshot.forEach((doc) => {
              const sol = doc.data();
              const docId = doc.id; // Pode ser útil para links futuros
              const dataFormatada = formatarData(sol.dataSolicitacao);
              const tipoFormatado = formatarTipoSolicitacao(sol.tipo); // Formata o tipo
              const statusClass = `status-${String(
                sol.status || "pendente"
              ).toLowerCase()}`;

              // Cria a linha da tabela (incluindo o tipo)
              const tr = document.createElement("tr");
              tr.innerHTML = `
                        <td>${tipoFormatado}</td>
                        <td>${
                          sol.pacienteNome || "N/A"
                        }</td> {/* Nome do Paciente */}
                        <td><span class="status-badge ${statusClass}">${
                sol.status
              }</span></td>
                        <td>${dataFormatada}</td>
                        {/* Adicionar coluna Ações se quiser linkar para detalhes */}
                    `;
              solicitacoesTableBody.appendChild(tr);

              // ** Opcional: Mostrar feedback do admin **
              if (sol.adminFeedback && sol.status !== "Pendente") {
                const trFeedback = document.createElement("tr");
                trFeedback.classList.add("feedback-row"); // Classe para estilização opcional
                trFeedback.innerHTML = `
                            <td colspan="4" class="feedback-admin ${
                              sol.status === "Rejeitada"
                                ? "feedback-rejeitado"
                                : ""
                            }">
                                <small><strong>Resposta (${formatarData(
                                  sol.adminFeedback.dataResolucao
                                )}):</strong> ${
                  sol.adminFeedback.mensagemAdmin ||
                  sol.adminFeedback.motivoRejeicao ||
                  "Processado."
                }</small>
                            </td>
                        `;
                solicitacoesTableBody.appendChild(trFeedback);
              }
            });
          }
        },
        (error) => {
          // Tratamento de erro do onSnapshot
          console.error("Erro ao buscar Minhas Solicitações:", error);
          solicitacoesTableBody.innerHTML = `<tr><td colspan="4" class="text-error">Erro ao carregar solicitações.</td></tr>`;
          solicitacoesEmptyState.style.display = "none";
        }
      );
    } catch (error) {
      // Tratamento de erro da query
      console.error(
        "Falha ao construir query para Minhas Solicitações:",
        error
      );
      solicitacoesTableBody.innerHTML = `<tr><td colspan="4" class="text-error">Erro ao buscar solicitações.</td></tr>`;
      solicitacoesEmptyState.style.display = "none";
    }
  }

  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';
    renderInfoCard(); // Renderiza avisos (mantido)
    loadAndRenderMinhasSolicitacoes(); // *** CHAMA A NOVA FUNÇÃO ***
    await fetchValoresConfig(); // Busca configs financeiras

    // Listener para a grade (mantido)
    const gradesDocRef = doc(db, "administrativo", "grades");
    onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel(); // Renderiza resumo da grade
      },
      (error) => {
        console.error("Erro ao escutar atualizações da grade:", error);
        summaryContainer.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Não foi possível carregar o resumo semanal.</div>`;
      }
    );
  }

  start().catch(console.error);
}
