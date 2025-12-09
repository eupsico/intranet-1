// Arquivo: /modulos/voluntario/js/view-dashboard-voluntario.js
// --- VERSÃO ATUALIZADA: Com Card Próxima Reunião e Código Completo ---

import {
  db,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp, // Adicionado caso precise manipular timestamp diretamente
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
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString("pt-BR", {
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
    inclusao_alteracao_grade: "Inclusão/Alt. Grade",
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
  const solicitacoesTableBody = document.getElementById(
    "dashboard-solicitacoes-tbody"
  );
  const solicitacoesEmptyState = document.getElementById(
    "dashboard-solicitacoes-empty"
  );
  const nextMeetingContainer = document.getElementById(
    "proxima-reuniao-voluntario"
  );

  // Verifica se todos os elementos essenciais existem
  if (
    !summaryContainer ||
    !infoCardContainer ||
    !solicitacoesTableBody ||
    !solicitacoesEmptyState
  ) {
    console.error("Elementos essenciais do dashboard não encontrados.");
    if (summaryContainer)
      summaryContainer.innerHTML =
        '<p class="alert alert-error">Erro ao carregar componente de resumo.</p>';
    return;
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

  // --- Função 1: Carregar Próxima Reunião (NOVO) ---
  async function loadNextMeeting() {
    if (!nextMeetingContainer) return;

    try {
      const agora = new Date();
      // Busca eventos recentes criados (para performance, pegamos os últimos 20 e filtramos em memória)
      const q = query(
        collection(db, "eventos"),
        orderBy("criadoEm", "desc"),
        limit(20)
      );

      const querySnapshot = await getDocs(q);
      let eventosFuturos = [];

      querySnapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const slots = dados.slots || [];

        // Normaliza para array de objetos com data unificada
        if (slots.length > 0) {
          // Eventos com Slots (Múltiplos horários)
          slots.forEach((slot) => {
            if (slot.data && slot.horaInicio) {
              const dataHora = new Date(
                slot.data + "T" + slot.horaInicio + ":00"
              );
              if (dataHora > agora) {
                eventosFuturos.push({
                  id: docSnap.id,
                  titulo: dados.tipo,
                  data: dataHora,
                  gestor: slot.gestorNome || "Gestão",
                  link: slot.linkReuniao || "#",
                  pauta: dados.descricao || "Sem pauta",
                });
              }
            }
          });
        } else {
          // Evento Simples (Sem Slots)
          if (dados.dataReuniao) {
            const hora = dados.horaInicio || "00:00";
            const dataHora = new Date(dados.dataReuniao + "T" + hora + ":00");
            if (dataHora > agora) {
              eventosFuturos.push({
                id: docSnap.id,
                titulo: dados.tipo || "Reunião Geral",
                data: dataHora,
                gestor: dados.responsavel || "Gestão",
                link: dados.link || "#",
                pauta: dados.pauta || "Sem pauta",
              });
            }
          }
        }
      });

      // Ordena por data (mais próxima primeiro)
      eventosFuturos.sort((a, b) => a.data - b.data);

      if (eventosFuturos.length > 0) {
        const prox = eventosFuturos[0];
        const diffMs = prox.data - agora;
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const dataFormatada = prox.data.toLocaleDateString("pt-BR");
        const horaFormatada = prox.data.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        nextMeetingContainer.innerHTML = `
                <h4><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Próxima Reunião</h4>
                <h2>${prox.titulo}</h2>
                <div class="meeting-details">
                    <div class="meeting-date">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        ${dataFormatada} às ${horaFormatada}
                    </div>
                    <div class="meeting-countdown">
                        Faltam ${diasRestantes} dia(s)
                    </div>
                </div>
                <div class="meeting-actions">
                    <button class="btn-meeting-action" onclick="alert('Detalhes: ${prox.pauta.replace(
                      /'/g,
                      ""
                    )}')">Ver Detalhes</button>
                    </div>
            `;
        nextMeetingContainer.style.display = "block";
      } else {
        nextMeetingContainer.style.display = "none";
      }
    } catch (e) {
      console.error("Erro ao carregar próxima reunião:", e);
      nextMeetingContainer.style.display = "none";
    }
  }

  // --- Função 2: Carregar Configurações Financeiras ---
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
        console.warn("Documento 'financeiro/configuracoes' não encontrado!");
        valoresConfig = { online: 0, presencial: 0 };
      }
    } catch (error) {
      console.error("Erro ao buscar configurações de valores:", error);
      valoresConfig = { online: 0, presencial: 0 };
    }
  }

  // --- Função 3: Renderizar Painel de Resumo ---
  function renderSummaryPanel() {
    if (!userData || (!userData.username && !userData.name)) {
      summaryContainer.innerHTML =
        '<p class="info-card alert alert-warning">Não foi possível identificar o usuário para exibir o resumo.</p>';
      return;
    }

    const userIdentifier = userData.username || userData.name;
    let horasOnline = 0;
    let horasPresencial = 0;
    const agendamentosOnline = [];
    const agendamentosPresencial = [];

    // Itera sobre a grade achatada
    for (const path in dadosDasGrades) {
      const nomeNaGrade = dadosDasGrades[path];
      if (
        nomeNaGrade &&
        (nomeNaGrade === userIdentifier || nomeNaGrade === userData.name)
      ) {
        const parts = path.split("."); // ex: online.segunda.09-00.col0
        if (parts.length === 4) {
          const [tipo, diaKey, horaRaw] = parts;
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
          }
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
        <div class="summary-panel dashboard-section">
            <div class="section-header">
                 <h2>Meu Resumo Semanal da Grade</h2>
            </div>
            <div id="summary-details-container" class="summary-cards">
                ${financeiroHtml}
                <div class="card">
                    <h3>🖥️ Grade Online (${horasOnline})</h3>
                    <ul>${
                      agendamentosOnline.length > 0
                        ? agendamentosOnline.join("")
                        : "<li>Nenhum horário online.</li>"
                    }</ul>
                </div>
                <div class="card">
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

  // --- Função 4: Renderizar Card de Avisos ---
  function renderInfoCard() {
    infoCardContainer.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <h2>📢 Avisos Gerais</h2>
            </div>
            <div class="info-card-grid">
                <div class="info-card">
                    <ul>
                        <li>Nenhum aviso no momento.</li>
                    </ul>
                </div>
            </div>
        </div>`;
  }

  // --- Função 5: Carregar e Renderizar Minhas Solicitações ---
  function loadAndRenderMinhasSolicitacoes() {
    console.log("Carregando Minhas Solicitações...");
    solicitacoesTableBody.innerHTML = `<tr><td colspan="4"><div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando...</td></tr>`;
    solicitacoesEmptyState.style.display = "none";

    try {
      const q = query(
        collection(db, "solicitacoes"),
        where("solicitanteId", "==", user.uid),
        orderBy("dataSolicitacao", "desc"),
        limit(15)
      );

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          solicitacoesTableBody.innerHTML = "";

          if (querySnapshot.empty) {
            solicitacoesEmptyState.style.display = "block";
          } else {
            solicitacoesEmptyState.style.display = "none";
            querySnapshot.forEach((doc) => {
              const sol = doc.data();
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
                    `;
              solicitacoesTableBody.appendChild(tr);

              // Mostra feedback do admin se existir
              if (sol.adminFeedback && sol.status !== "Pendente") {
                const trFeedback = document.createElement("tr");
                trFeedback.classList.add("feedback-row");
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
                tdFeedback.colSpan = 4;
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
    } catch (error) {
      console.error(
        "Falha ao construir query para Minhas Solicitações:",
        error
      );
      solicitacoesTableBody.innerHTML = `<tr><td colspan="4" class="text-error">Erro ao construir busca de solicitações.</td></tr>`;
      solicitacoesEmptyState.style.display = "none";
    }
  }

  // --- Função Start (Inicialização Geral) ---
  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';

    // Inicia carregamentos
    renderInfoCard();
    loadAndRenderMinhasSolicitacoes();
    loadNextMeeting(); // <--- CHAMADA DA NOVA FUNÇÃO
    await fetchValoresConfig();

    const gradesDocRef = doc(db, "administrativo", "grades");
    const unsubscribeGrade = onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel();
      },
      (error) => {
        console.error("Erro ao escutar atualizações da grade:", error);
        summaryContainer.innerHTML = `<div class="info-card alert alert-error">Não foi possível carregar o resumo semanal da grade.</div>`;
      }
    );
  }

  start().catch((error) => {
    console.error("Erro geral na inicialização do dashboard:", error);
    document.body.innerHTML =
      '<p class="alert alert-error" style="margin: 20px;">Erro crítico ao carregar o dashboard. Tente recarregar a página.</p>';
  });
}
