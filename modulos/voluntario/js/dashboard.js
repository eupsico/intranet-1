// Arquivo: /modulos/voluntario/js/dashboard.js
// --- VERSÃO MODIFICADA (Solicitações Expansíveis) ---

import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
} from "../../../assets/js/firebase-init.js";

// Função auxiliar para formatar datas (DD/MM/AAAA HH:MM)
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit", // Adiciona hora
    });
  }
  if (timestamp instanceof Date) {
    // Fallback para objeto Date
    return timestamp.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "N/A";
}

// Função auxiliar para formatar tipo de solicitação
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

export function init(user, userData) {
  console.log("Módulo dashboard.js V.SOLICITACOES_EXPANSIVEIS iniciado.");
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");
  const solicitacoesContainer = document.getElementById(
    "solicitacoes-container"
  );

  if (!summaryContainer || !infoCardContainer || !solicitacoesContainer) {
    // Verifica solicitacoesContainer também
    console.error(
      "Um ou mais containers principais do dashboard não foram encontrados."
    );
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

  async function fetchValoresConfig() {
    try {
      const docRef = doc(db, "financeiro", "configuracoes");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        valoresConfig = docSnap.data().valores || { online: 0, presencial: 0 };
      } else {
        console.error("Doc 'financeiro/configuracoes' não encontrado!");
        valoresConfig = { online: 0, presencial: 0 };
      }
    } catch (error) {
      console.error("Erro config valores:", error);
      valoresConfig = { online: 0, presencial: 0 };
    }
  }

  function renderSummaryPanel() {
    if (!userData || (!userData.username && !userData.nome)) {
      summaryContainer.innerHTML = "<p>Usuário não identificado.</p>";
      return;
    }
    const userIdentifier = userData.username || userData.nome;
    const userFullName = userData.nome || userIdentifier;
    let horasOnline = 0,
      horasPresencial = 0;
    let agendamentosOnline = [],
      agendamentosPresencial = [];

    for (const path in dadosDasGrades) {
      if (
        dadosDasGrades[path] === userIdentifier ||
        dadosDasGrades[path] === userFullName
      ) {
        const parts = path.split(".");
        if (parts.length === 4) {
          const [tipo, diaKey, horaRaw] = parts;
          const horaFormatada = horaRaw.replace("-", ":");
          const diaNome = diasDaSemana[diaKey] || diaKey;
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

    const valorOnline = valoresConfig.online || 0;
    const valorPresencial = valoresConfig.presencial || 0;
    const totalHoras = horasOnline + horasPresencial;
    const valorTotalAPagar =
      horasOnline * valorOnline + horasPresencial * valorPresencial;
    const valorFormatado = valorTotalAPagar.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    summaryContainer.innerHTML = `
            <div class="summary-panel"> <h3>Meu Resumo</h3> <div id="summary-details-container">
                <div class="summary-card"><h4>💰 Resumo Financeiro</h4><ul><li><span class="financeiro-horas">Total: <strong>${totalHoras}h</strong></span><span class="financeiro-valor">${valorFormatado}</span><small>O pagamento deve ser realizado até dia 10 do mês corrente.</small></li></ul></div>
                <div class="summary-card"><h4>🖥️ Grade Online (${horasOnline})</h4><ul>${
      agendamentosOnline.length > 0
        ? agendamentosOnline.join("")
        : "<li>Nenhum horário.</li>"
    }</ul><a href="#recursos" class="card-footer-link" onclick="sessionStorage.setItem('targetTab', 'alterar-grade')">Solicitar exclusão</a></div>
                <div class="summary-card"><h4>🏢 Grade Presencial (${horasPresencial})</h4><ul>${
      agendamentosPresencial.length > 0
        ? agendamentosPresencial.join("")
        : "<li>Nenhum horário.</li>"
    }</ul><a href="#recursos" class="card-footer-link" onclick="sessionStorage.setItem('targetTab', 'alterar-grade')">Solicitar exclusão</a></div>
            </div> </div>`;
  }

  async function renderInfoCards() {
    let cardsHtml = "";
    let disponibilidadeHtml = "<li>Nenhuma cadastrada.</li>";
    if (userData.horarios && userData.horarios.length > 0) {
      const formatHorario = (h) => `${String(h).padStart(2, "0")}:00`;
      const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      disponibilidadeHtml = userData.horarios
        .map(
          (h) =>
            `<li class="disponibilidade-item"><strong>${capitalize(
              h.dia
            )} ${formatHorario(h.horario)}:</strong> ${h.modalidade} (${
              h.status
            })</li>`
        )
        .join("");
    }
    cardsHtml += `<div class="info-card"><h3>🗓️ Disponibilidade</h3><ul class="disponibilidade-list">${disponibilidadeHtml}</ul><a href="#recursos" class="card-footer-link">Atualizar em Recursos</a></div>`;
    const proximaSupervisao = await getProximaSupervisao();
    cardsHtml += `<div class="info-card"><h3>🎓 Próxima Supervisão</h3><ul><li>${proximaSupervisao}</li></ul></div>`;
    if (userData.funcoes && userData.funcoes.includes("supervisor")) {
      const agendamentosFuturos = await getAgendamentosFuturosSupervisor();
      cardsHtml += `<div class="info-card"><h3>⭐ Agendamentos (Supervisor)</h3><ul>${agendamentosFuturos}</ul></div>`;
    }
    infoCardContainer.innerHTML = `<div class="info-card-grid">${cardsHtml}</div>`;
  }

  async function getProximaSupervisao() {
    try {
      const hoje = new Date();
      const q = query(
        collection(db, "agendamentos"),
        where("profissionalUid", "==", user.uid),
        where("dataAgendamento", ">=", hoje),
        orderBy("dataAgendamento"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return "Nenhuma agendada.";
      const agendamento = querySnapshot.docs[0].data();
      const data = agendamento.dataAgendamento
        .toDate()
        .toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      return `<strong>${data}</strong> com ${agendamento.supervisorNome}`;
    } catch (error) {
      console.error("Erro busca supervisão:", error);
      return "Erro ao carregar.";
    }
  }

  async function getAgendamentosFuturosSupervisor() {
    try {
      const hoje = new Date();
      const q = query(
        collection(db, "agendamentos"),
        where("supervisorUid", "==", user.uid),
        where("dataAgendamento", ">=", hoje),
        orderBy("dataAgendamento")
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return "<li>Nenhum futuro.</li>";
      return querySnapshot.docs
        .map((doc) => {
          const agendamento = doc.data();
          const data = agendamento.dataAgendamento
            .toDate()
            .toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            });
          return `<li><strong>${data}</strong> com ${agendamento.profissionalNome}</li>`;
        })
        .join("");
    } catch (error) {
      console.error("Erro agendamentos supervisor:", error);
      return "<li>Erro ao carregar.</li>";
    }
  }

  // --- FUNÇÃO MODIFICADA (renderMinhasSolicitacoes) ---
  async function renderMinhasSolicitacoes() {
    solicitacoesContainer.innerHTML = `
            <div class="info-card" id="card-minhas-solicitacoes">
                <h3><i class="fas fa-tasks"></i> Minhas Solicitações</h3>
                <h4>Em Aberto</h4>
                <div id="solicitacoes-abertas-content"><div class="loading-spinner-small"></div></div>
                <hr>
                <h4>Histórico Recente (Últimos 30 dias)</h4>
                <div id="solicitacoes-concluidas-content"><div class="loading-spinner-small"></div></div>
            </div>`;

    const abertasContent = document.getElementById(
      "solicitacoes-abertas-content"
    );
    const concluidasContent = document.getElementById(
      "solicitacoes-concluidas-content"
    );
    const umMesAtras = new Date();
    umMesAtras.setDate(umMesAtras.getDate() - 30);

    // Busca TODAS as solicitações do usuário
    const q = query(
      collection(db, "solicitacoes"),
      where("solicitanteId", "==", user.uid),
      orderBy("dataSolicitacao", "desc")
    );

    try {
      const querySnapshot = await getDocs(q);
      let abertasHtml = "";
      let concluidasHtml = "";

      if (querySnapshot.empty) {
        abertasContent.innerHTML = "<p>Nenhuma solicitação em aberto.</p>";
        concluidasContent.innerHTML =
          "<p>Nenhuma solicitação recente no histórico.</p>";
      } else {
        querySnapshot.forEach((doc, index) => {
          // Adiciona index para IDs únicos
          const sol = doc.data();
          const detalhes = sol.detalhes || {};
          const solicitacaoId = doc.id; // ID único para o item

          const tipoSolicitacaoFormatado = formatarTipoSolicitacao(sol.tipo);
          const dataSolFormatada = formatarData(sol.dataSolicitacao);
          const nomePaciente = sol.pacienteNome || null;
          const dataResolucaoFormatada = sol.adminFeedback?.dataResolucao
            ? formatarData(sol.adminFeedback.dataResolucao)
            : null;
          const nomeAdmin = sol.adminFeedback?.adminNome || null;

          const statusClass = `status-${String(
            sol.status || "pendente"
          ).toLowerCase()}`;
          const statusHtml = `<span class="status-badge ${statusClass}">${sol.status}</span>`;

          let feedbackAdminHtml = "";
          if (sol.adminFeedback) {
            const mensagemFeedback =
              sol.adminFeedback.mensagemAdmin ||
              sol.adminFeedback.motivoRejeicao ||
              (sol.status === "Concluída" ? "Aprovada" : "Processada");
            feedbackAdminHtml = `<p class="feedback-admin ${
              sol.status === "Rejeitada" ? "feedback-rejeitado" : ""
            }">
                                    <strong>Admin (${nomeAdmin || "N/I"} em ${
              dataResolucaoFormatada || "N/I"
            }):</strong> ${mensagemFeedback}
                                 </p>`;
          }

          // *** HTML MODIFICADO PARA EXPANSÃO ***
          const itemHtml = `
                  <li class="solicitacao-item-container">
                      <div class="solicitacao-item-header" data-target-details="details-${solicitacaoId}">
                          <span class="solicitacao-tipo">${tipoSolicitacaoFormatado}</span>
                          ${
                            nomePaciente
                              ? `<span class="solicitacao-paciente">(${nomePaciente})</span>`
                              : ""
                          }
                          <span class="solicitacao-status">${statusHtml}</span>
                          <span class="solicitacao-indicator">+</span> </div>
                      <div class="solicitacao-item-details" id="details-${solicitacaoId}">
                           <p><strong>Solicitado em:</strong> ${dataSolFormatada}</p>
                           ${
                             sol.tipo === "exclusao_horario"
                               ? `<p><strong>Horários:</strong> ${
                                   detalhes.horariosParaExcluir
                                     ?.map((h) => h.label)
                                     .join(", ") || "N/A"
                                 }</p><p><strong>Motivo:</strong> ${
                                   detalhes.motivo || "N/A"
                                 }</p>`
                               : ""
                           }
                           ${
                             sol.tipo === "alteracao_horario"
                               ? `<p><strong>De:</strong> ${
                                   detalhes.dadosAntigos?.dia || ""
                                 } ${detalhes.dadosAntigos?.horario || ""} (${
                                   detalhes.dadosAntigos?.modalidade || ""
                                 })</p><p><strong>Para:</strong> ${
                                   detalhes.dadosNovos?.dia || ""
                                 } ${detalhes.dadosNovos?.horario || ""} (${
                                   detalhes.dadosNovos?.modalidade || ""
                                 })</p><p><strong>Justificativa:</strong> ${
                                   detalhes.justificativa || "N/A"
                                 }</p>`
                               : ""
                           }
                           ${
                             sol.tipo === "desfecho"
                               ? `<p><strong>Tipo Desfecho:</strong> ${
                                   detalhes.tipoDesfecho || "N/A"
                                 }</p><p><strong>Data Desfecho:</strong> ${
                                   detalhes.dataDesfecho
                                     ? formatarData(
                                         Timestamp.fromDate(
                                           new Date(
                                             detalhes.dataDesfecho + "T03:00:00"
                                           )
                                         )
                                       )
                                     : "N/A"
                                 }</p><p><strong>Motivo:</strong> ${
                                   detalhes.motivo ||
                                   detalhes.motivoEncaminhamento ||
                                   "N/A"
                                 }</p>`
                               : ""
                           }
                           ${
                             sol.tipo === "novas_sessoes"
                               ? `<p><strong>Horário Solicitado:</strong> ${
                                   detalhes.diaSemana || ""
                                 }, ${detalhes.horario || ""} (${
                                   detalhes.modalidade || ""
                                 })</p><p><strong>Início Pref.:</strong> ${
                                   detalhes.dataInicioPreferencial
                                     ? formatarData(
                                         Timestamp.fromDate(
                                           new Date(
                                             detalhes.dataInicioPreferencial +
                                               "T03:00:00"
                                           )
                                         )
                                       )
                                     : "N/A"
                                 }</p>`
                               : ""
                           }
                           ${
                             sol.tipo === "reavaliacao"
                               ? `<p><strong>Valor Atual:</strong> ${
                                   detalhes.valorContribuicaoAtual || "N/A"
                                 }</p><p><strong>Motivo:</strong> ${
                                   detalhes.motivo || "N/A"
                                 }</p>`
                               : ""
                           }
                           ${
                             sol.tipo === "inclusao_alteracao_grade"
                               ? `<p><strong>Horário:</strong> ${
                                   detalhes.diaSemana || ""
                                 }, ${detalhes.horario || ""} (${
                                   detalhes.modalidade || ""
                                 })</p><p><strong>Início:</strong> ${
                                   detalhes.dataInicio
                                     ? formatarData(
                                         Timestamp.fromDate(
                                           new Date(
                                             detalhes.dataInicio + "T03:00:00"
                                           )
                                         )
                                       )
                                     : "N/A"
                                 }</p>`
                               : ""
                           }
                           ${feedbackAdminHtml}
                      </div>
                  </li>`;
          // *** FIM HTML MODIFICADO ***

          if (sol.status === "Pendente") {
            abertasHtml += itemHtml;
          } else {
            const dataResolucao = sol.adminFeedback?.dataResolucao?.toDate();
            if (dataResolucao && dataResolucao >= umMesAtras) {
              concluidasHtml += itemHtml;
            }
          }
        }); // Fim forEach

        abertasContent.innerHTML = abertasHtml
          ? `<ul class="solicitacoes-list">${abertasHtml}</ul>`
          : "<p>Nenhuma solicitação em aberto.</p>";
        concluidasContent.innerHTML = concluidasHtml
          ? `<ul class="solicitacoes-list">${concluidasHtml}</ul>`
          : "<p>Nenhuma solicitação recente no histórico.</p>";
      } // Fim else (snapshot não vazio)

      // *** NOVO: Adiciona o listener para expansão após renderizar ***
      addToggleDetailsListener();
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      abertasContent.innerHTML = `<p class="alert alert-error">Erro ao carregar.</p>`;
      concluidasContent.innerHTML = "";
    }
  }
  // --- FIM FUNÇÃO MODIFICADA ---

  // *** NOVA FUNÇÃO: Adiciona listener de clique para expandir/colapsar ***
  function addToggleDetailsListener() {
    // Usa delegação de evento no container principal das solicitações
    solicitacoesContainer.removeEventListener("click", handleSolicitacaoClick); // Remove listener antigo se houver
    solicitacoesContainer.addEventListener("click", handleSolicitacaoClick);
  }

  // *** NOVA FUNÇÃO: Handler para o clique na solicitação ***
  function handleSolicitacaoClick(event) {
    const header = event.target.closest(".solicitacao-item-header");
    if (!header) return; // Sai se o clique não foi no cabeçalho

    const targetId = header.dataset.targetDetails;
    const details = document.getElementById(targetId);
    const indicator = header.querySelector(".solicitacao-indicator");

    if (details) {
      // Alterna a classe 'expanded' no container do item e no cabeçalho
      const container = header.closest(".solicitacao-item-container");
      if (container) container.classList.toggle("expanded");
      header.classList.toggle("expanded");

      // Alterna a visibilidade dos detalhes
      details.style.display =
        details.style.display === "block" ? "none" : "block";

      // Alterna o indicador
      if (indicator) {
        indicator.textContent = details.style.display === "block" ? "-" : "+";
      }
    } else {
      console.warn(`Elemento de detalhes não encontrado: #${targetId}`);
    }
  }
  // *** FIM NOVAS FUNÇÕES ***

  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';
    infoCardContainer.innerHTML = '<div class="loading-spinner"></div>';
    await fetchValoresConfig();
    await renderInfoCards();
    renderMinhasSolicitacoes().catch(console.error); // Renderiza o card de solicitações

    const gradesDocRef = doc(db, "administrativo", "grades");
    const unsubscribe = onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel();
      },
      (error) => {
        console.error("Erro ao carregar resumo da grade:", error);
        summaryContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar resumo.</p>`;
      }
    );
    // Guardar unsubscribe para limpar ao sair da view
  }

  start().catch(console.error);
}
