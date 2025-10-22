// Arquivo: /modulos/voluntario/js/view-dashboard-voluntario.js
// --- VERSÃO CORRIGIDA: Adiciona busca e exibição de 'Minhas Solicitações' ---

import {
  db,
  doc,
  getDoc,
  onSnapshot,
  // Novas importações:
  collection,
  query,
  where,
  orderBy,
  limit,
} from "../../../assets/js/firebase-init.js";

// --- Funções Auxiliares ---
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

function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    reavaliacao: "Solicitação Reavaliação",
    exclusao_horario: "Exclusão de Horário",
    inclusao_alteracao_grade: "Inclusão/Alt. Grade", // Nome mais curto para dashboard
  };
  // Retorna nome amigável ou o próprio tipo se não mapeado
  return (
    mapaTipos[tipoInterno] ||
    tipoInterno.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

export function init(db_ignored, user, userData) {
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");
  // Seletores para Minhas Solicitações
  const solicitacoesTableBody = document.getElementById(
    "dashboard-solicitacoes-tbody"
  );
  const solicitacoesEmptyState = document.getElementById(
    "dashboard-solicitacoes-empty"
  );

  // Verifica se todos os elementos essenciais existem
  if (
    !summaryContainer ||
    !infoCardContainer ||
    !solicitacoesTableBody ||
    !solicitacoesEmptyState
  ) {
    console.error(
      "Elementos essenciais do dashboard (resumo, avisos ou tabela de solicitações) não encontrados. Verifique os IDs no HTML."
    );
    // Decide se quer parar ou continuar sem a seção que falta
    if (summaryContainer)
      summaryContainer.innerHTML =
        '<p class="alert alert-error">Erro ao carregar componente de resumo.</p>';
    if (infoCardContainer)
      infoCardContainer.innerHTML =
        '<p class="alert alert-error">Erro ao carregar componente de avisos.</p>';
    if (solicitacoesTableBody)
      solicitacoesTableBody.innerHTML =
        '<tr><td colspan="4" class="alert alert-error">Erro ao carregar componente de solicitações.</td></tr>';
    return; // Interrompe a inicialização se elementos cruciais faltam
  }

  let dadosDasGrades = {};
  let valoresConfig = {};
  const diasDaSemana = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
  };
  const userRoles = userData.funcoes || [];
  const hasFinanceAccess =
    userRoles.includes("admin") || userRoles.includes("financeiro");

  // --- Funções de Carregamento e Renderização (Resumo Semanal e Avisos) ---
  async function fetchValoresConfig() {
    if (!hasFinanceAccess) {
      valoresConfig = { online: 0, presencial: 0 };
      return;
    }
    try {
      const docRef = doc(db, "financeiro", "configuracoes");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        valoresConfig = data.valores || { online: 0, presencial: 0 };
      } else {
        console.warn("Documento 'financeiro/configuracoes' não encontrado!"); // Warn em vez de Error
        valoresConfig = { online: 0, presencial: 0 };
      }
    } catch (error) {
      console.error("Erro ao buscar configurações de valores:", error);
      valoresConfig = { online: 0, presencial: 0 };
    }
  }

  function renderSummaryPanel() {
    if (!userData || (!userData.username && !userData.name)) {
      // Verifica nome também
      summaryContainer.innerHTML =
        '<p class="info-card alert alert-warning">Não foi possível identificar o usuário para exibir o resumo.</p>';
      return;
    }

    const userIdentifier = userData.username || userData.name; // Usa username ou nome completo
    let horasOnline = 0;
    let horasPresencial = 0;
    const agendamentosOnline = [];
    const agendamentosPresencial = [];

    // Itera sobre a grade achatada
    for (const path in dadosDasGrades) {
      const nomeNaGrade = dadosDasGrades[path];
      // Compara com identificador do usuário (username ou nome)
      if (
        nomeNaGrade &&
        (nomeNaGrade === userIdentifier || nomeNaGrade === userData.name)
      ) {
        const parts = path.split("."); // ex: online.segunda.09-00.col0
        if (parts.length === 4) {
          const [tipo, diaKey, horaRaw] = parts;
          // Verifica se diaKey é válido antes de acessar diasDaSemana
          if (diasDaSemana[diaKey]) {
            const horaFormatada = horaRaw.replace("-", ":");
            const diaNome = diasDaSemana[diaKey];
            const horarioCompleto = `<li>${diaNome} - ${horaFormatada}</li>`;

            if (tipo === "online") {
              horasOnline++;
              agendamentosOnline.push(horarioCompleto);
            } else if (tipo === "presencial") {
              horasPresencial++;
              agendamentosPresencial.push(horarioCompleto);
            }
          } else {
            console.warn(
              `Chave de dia inválida encontrada na grade: ${diaKey} em ${path}`
            );
          }
        } else {
          // Loga caminhos inesperados para depuração
          // console.log("Caminho inesperado na grade:", path);
        }
      }
    }

    const totalHoras = horasOnline + horasPresencial;

    let financeiroHtml = "";
    if (hasFinanceAccess) {
      const valorOnline = valoresConfig.online || 0;
      const valorPresencial = valoresConfig.presencial || 0;
      const valorTotalAPagar =
        horasOnline * valorOnline + horasPresencial * valorPresencial;
      const valorFormatado = valorTotalAPagar.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      financeiroHtml = `
            <div class="summary-card">
                <h4>💰 Resumo Financeiro Estimado</h4>
                <ul>
                    <li>
                        <span class="financeiro-horas">Total de horas na grade: <strong>${totalHoras}</strong></span>
                        <span class="financeiro-valor">Valor estimado a receber: ${valorFormatado}</span>
                        <small>Valor baseado na grade atual. Pagamento até o dia 10 do mês seguinte.</small>
                    </li>
                </ul>
            </div>`;
    } else {
      financeiroHtml = `
            <div class="summary-card">
                <h4>⏱️ Horas na Grade</h4>
                 <ul>
                    <li>
                        <span class="financeiro-horas">Total de horas semanais: <strong>${totalHoras}</strong></span>
                    </li>
                </ul>
            </div>`;
    }

    summaryContainer.innerHTML = `
        <div class="summary-panel dashboard-section"> {/* Adiciona classe dashboard-section */}
            <div class="section-header"> {/* Adiciona header */}
                 <h2>Meu Resumo Semanal da Grade</h2>
            </div>
            <div id="summary-details-container" class="summary-cards"> {/* Usa grid de cards */}
                ${financeiroHtml}
                <div class="card"> {/* Usa classe card */}
                    <h3>🖥️ Grade Online (${horasOnline})</h3>
                    <ul>${
                      agendamentosOnline.length > 0
                        ? agendamentosOnline.join("")
                        : "<li>Nenhum horário online.</li>"
                    }</ul>
                </div>
                <div class="card"> {/* Usa classe card */}
                    <h3>🏢 Grade Presencial (${horasPresencial})</h3>
                    <ul>${
                      agendamentosPresencial.length > 0
                        ? agendamentosPresencial.join("")
                        : "<li>Nenhum horário presencial.</li>"
                    }</ul>
                </div>
            </div>
        </div>`;
  }

  function renderInfoCard() {
    // TODO: Buscar avisos dinamicamente do Firestore se necessário
    infoCardContainer.innerHTML = `
        <div class="dashboard-section"> {/* Adiciona classe dashboard-section */}
            <div class="section-header"> {/* Adiciona header */}
                <h2>📢 Avisos Gerais</h2>
            </div>
            <div class="info-card-grid">
                <div class="info-card"> {/* Mantém info-card para estilo */}
                    <ul>
                        <li>Nenhum aviso no momento.</li>
                        {/* Adicionar mais avisos aqui se necessário */}
                    </ul>
                </div>
            </div>
        </div>`;
  }

  // --- Função: Carregar e Renderizar Minhas Solicitações ---
  function loadAndRenderMinhasSolicitacoes() {
    console.log("Carregando Minhas Solicitações...");
    solicitacoesTableBody.innerHTML = `<tr><td colspan="4"><div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando...</td></tr>`;
    solicitacoesEmptyState.style.display = "none";

    try {
      const q = query(
        collection(db, "solicitacoes"),
        where("solicitanteId", "==", user.uid), // Filtra pelo ID do usuário logado
        orderBy("dataSolicitacao", "desc"),
        limit(15) // Limita para não sobrecarregar o dashboard
      );

      // Usa onSnapshot
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          // Guarda unsubscribe
          solicitacoesTableBody.innerHTML = ""; // Limpa antes de popular

          if (querySnapshot.empty) {
            solicitacoesEmptyState.style.display = "block";
          } else {
            solicitacoesEmptyState.style.display = "none";
            querySnapshot.forEach((doc) => {
              const sol = doc.data();
              const docId = doc.id;
              const dataFormatada = formatarData(sol.dataSolicitacao);
              const tipoFormatado = formatarTipoSolicitacao(sol.tipo);
              const statusClass = `status-${String(
                sol.status || "pendente"
              ).toLowerCase()}`;

              const tr = document.createElement("tr");
              tr.innerHTML = `
                        <td>${tipoFormatado}</td>
                        <td>${sol.pacienteNome || "N/A"}</td>
                        <td><span class="status-badge ${statusClass}">${
                sol.status
              }</span></td>
                        <td>${dataFormatada}</td>
                        {/* <td><button class="action-button small" data-sol-id="${docId}">Detalhes</button></td> */} {/* Botão opcional */}
                    `;
              solicitacoesTableBody.appendChild(tr);

              // Mostra feedback do admin se existir e não estiver pendente
              if (sol.adminFeedback && sol.status !== "Pendente") {
                const trFeedback = document.createElement("tr");
                trFeedback.classList.add("feedback-row");
                // Usa textContent para segurança contra XSS na mensagem do admin
                const feedbackMsg = document.createElement("small");
                feedbackMsg.innerHTML = `<strong>Resposta (${formatarData(
                  sol.adminFeedback.dataResolucao
                )}):</strong> `;
                const msgText = document.createTextNode(
                  sol.adminFeedback.mensagemAdmin ||
                    sol.adminFeedback.motivoRejeicao ||
                    "Processado."
                );
                feedbackMsg.appendChild(msgText);

                const tdFeedback = document.createElement("td");
                tdFeedback.colSpan = 4; // Abrange todas as colunas
                tdFeedback.classList.add("feedback-admin");
                if (sol.status === "Rejeitada") {
                  tdFeedback.classList.add("feedback-rejeitado");
                }
                tdFeedback.appendChild(feedbackMsg);
                trFeedback.appendChild(tdFeedback);

                solicitacoesTableBody.appendChild(trFeedback);
              }
            });
          }
        },
        (error) => {
          console.error("Erro ao buscar Minhas Solicitações:", error);
          solicitacoesTableBody.innerHTML = `<tr><td colspan="4" class="text-error">Erro ao carregar solicitações: ${error.message}</td></tr>`;
          solicitacoesEmptyState.style.display = "none";
        }
      );
      // TODO: Gerenciar 'unsubscribe'
    } catch (error) {
      console.error(
        "Falha ao construir query para Minhas Solicitações:",
        error
      );
      solicitacoesTableBody.innerHTML = `<tr><td colspan="4" class="text-error">Erro ao construir busca de solicitações.</td></tr>`;
      solicitacoesEmptyState.style.display = "none";
    }
  }

  // --- Função Start (Inicialização) ---
  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>'; // Loading inicial resumo
    renderInfoCard(); // Renderiza avisos estáticos (ou com loading se buscar dados)
    loadAndRenderMinhasSolicitacoes(); // Inicia carregamento das solicitações
    await fetchValoresConfig(); // Busca configs financeiras em paralelo

    // Listener para a grade (mantido)
    const gradesDocRef = doc(db, "administrativo", "grades");
    const unsubscribeGrade = onSnapshot(
      // Guarda unsubscribe
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel(); // Renderiza/Atualiza resumo da grade
      },
      (error) => {
        console.error("Erro ao escutar atualizações da grade:", error);
        summaryContainer.innerHTML = `<div class="info-card alert alert-error">Não foi possível carregar o resumo semanal da grade.</div>`;
      }
    );
    // TODO: Gerenciar 'unsubscribeGrade'
  }

  // Inicia o processo
  start().catch((error) => {
    console.error("Erro geral na inicialização do dashboard:", error);
    // Exibe mensagem de erro geral se a inicialização falhar
    document.body.innerHTML =
      '<p class="alert alert-error" style="margin: 20px;">Erro crítico ao carregar o dashboard. Tente recarregar a página.</p>';
  });
} // Fim da função init
