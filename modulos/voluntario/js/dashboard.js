// Arquivo: /modulos/voluntario/js/dashboard.js
// --- VERSÃO MODIFICADA (Exibe detalhes das solicitações) ---

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
  Timestamp, // *** NOVO: Importar Timestamp para formatar data de resolução ***
} from "../../../assets/js/firebase-init.js";

// *** NOVO: Função auxiliar para formatar datas (igual à do admin) ***
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit", // Adiciona hora e minuto
    });
  }
  // Se for uma data JS legada (improvável, mas seguro incluir)
  if (timestamp instanceof Date) {
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

// *** NOVO: Função auxiliar para formatar tipo de solicitação ***
function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    reavaliacao: "Solicitação Reavaliação",
    exclusao_horario: "Exclusão de Horário",
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
    // Adicione outros tipos se existirem
  };
  return mapaTipos[tipoInterno] || tipoInterno; // Retorna o nome mapeado ou o interno se não encontrar
}

export function init(user, userData) {
  console.log("Módulo dashboard.js V.DETALHES_SOLICITACOES iniciado."); // *** MODIFICADO ***
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");
  const solicitacoesContainer = document.getElementById(
    "solicitacoes-container"
  );

  if (!summaryContainer || !infoCardContainer) return;

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
      // Verifica nome também
      summaryContainer.innerHTML =
        "<p>Não foi possível identificar o usuário.</p>";
      return;
    }
    const userIdentifier = userData.username || userData.nome; // Usa username ou nome
    const userFullName = userData.nome || userIdentifier; // Prefere nome completo
    let horasOnline = 0,
      horasPresencial = 0;
    let agendamentosOnline = [],
      agendamentosPresencial = [];

    for (const path in dadosDasGrades) {
      // Verifica se o valor corresponde ao username ou nome completo
      if (
        dadosDasGrades[path] === userIdentifier ||
        dadosDasGrades[path] === userFullName
      ) {
        const parts = path.split(".");
        if (parts.length === 4) {
          const [tipo, diaKey, horaRaw, colKey] = parts;
          const horaFormatada = horaRaw.replace("-", ":");
          const diaNome = diasDaSemana[diaKey] || diaKey; // Fallback para a chave se nome não encontrado
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
            <div class="summary-panel">
                <h3>Meu Resumo Semanal</h3>
                <div id="summary-details-container">
                    <div class="summary-card"><h4>💰 Resumo Financeiro</h4><ul><li><span class="financeiro-horas">Total de horas: <strong>${totalHoras}</strong></span><span class="financeiro-valor">Valor total a pagar: ${valorFormatado}</span><small>O pagamento deve ser realizado até o dia 10.</small></li></ul></div>
                    <div class="summary-card"><h4>🖥️ Grade Online (${horasOnline})</h4><ul>${
      agendamentosOnline.length > 0
        ? agendamentosOnline.join("")
        : "<li>Nenhum horário online.</li>"
    }</ul><a href="#recursos" class="card-footer-link" onclick="sessionStorage.setItem('targetTab', 'alterar-grade')">Solicitar exclusão de horários.</a></div>
                    <div class="summary-card"><h4>🏢 Grade Presencial (${horasPresencial})</h4><ul>${
      agendamentosPresencial.length > 0
        ? agendamentosPresencial.join("")
        : "<li>Nenhum horário presencial.</li>"
    }</ul><a href="#recursos" class="card-footer-link" onclick="sessionStorage.setItem('targetTab', 'alterar-grade')">Solicitar exclusão de horários.</a></div>
                </div>
            </div>`;
  }

  async function renderInfoCards() {
    let cardsHtml = "";
    let disponibilidadeHtml = "<li>Nenhuma disponibilidade cadastrada.</li>";
    if (userData.horarios && userData.horarios.length > 0) {
      const formatHorario = (h) => `${String(h).padStart(2, "0")}:00`;
      const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      disponibilidadeHtml = userData.horarios
        .map(
          (h) =>
            `<li class="disponibilidade-item"><strong>${capitalize(
              h.dia
            )} - ${formatHorario(h.horario)}:</strong> ${h.modalidade} (${
              h.status
            })</li>`
        )
        .join("");
    }
    cardsHtml += `<div class="info-card"><h3>🗓️ Minha Disponibilidade</h3><ul class="disponibilidade-list">${disponibilidadeHtml}</ul><a href="#recursos" class="card-footer-link">Atualize sua disponibilidade em Recursos.</a></div>`;
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
      if (querySnapshot.empty) return "Nenhuma supervisão agendada.";
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
      return "Não foi possível carregar.";
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
      if (querySnapshot.empty) return "<li>Nenhum agendamento futuro.</li>";
      return querySnapshot.docs
        .map((doc) => {
          const agendamento = doc.data();
          const data = agendamento.dataAgendamento
            .toDate()
            .toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          return `<li><strong>${data}</strong> com ${agendamento.profissionalNome}</li>`;
        })
        .join("");
    } catch (error) {
      console.error("Erro agendamentos supervisor:", error);
      return "<li>Não foi possível carregar.</li>";
    }
  }

  // --- FUNÇÃO MODIFICADA (renderMinhasSolicitacoes) ---
  async function renderMinhasSolicitacoes() {
    if (!solicitacoesContainer) return;

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

    // *** MODIFICADO: Remove filtro de tipo para buscar TODAS as solicitações do usuário ***
    const q = query(
      collection(db, "solicitacoes"),
      where("solicitanteId", "==", user.uid),
      orderBy("dataSolicitacao", "desc")
      // REMOVIDO: where("tipo", "==", "exclusao_horario"),
    );

    try {
      const querySnapshot = await getDocs(q);
      let abertasHtml = "";
      let concluidasHtml = "";

      if (querySnapshot.empty) {
        abertasContent.innerHTML = "<p>Nenhuma solicitação em aberto.</p>";
        concluidasContent.innerHTML =
          "<p>Nenhuma solicitação recente no histórico.</p>";
        return;
      }

      querySnapshot.forEach((doc) => {
        const sol = doc.data();
        const detalhes = sol.detalhes || {};

        // *** NOVOS CAMPOS EXTRAÍDOS ***
        const tipoSolicitacaoFormatado = formatarTipoSolicitacao(sol.tipo);
        const dataSolFormatada = formatarData(sol.dataSolicitacao); // Usa a nova função com hora
        const nomePaciente = sol.pacienteNome || null; // Pega o nome do paciente se existir
        const dataResolucaoFormatada = sol.adminFeedback?.dataResolucao
          ? formatarData(sol.adminFeedback.dataResolucao)
          : null;
        const nomeAdmin = sol.adminFeedback?.adminNome || null;

        // Monta o status
        const statusClass = `status-${String(
          sol.status || "pendente"
        ).toLowerCase()}`;
        const statusHtml = `<span class="status-badge ${statusClass}">${sol.status}</span>`;

        // Monta o feedback do admin (se houver)
        let feedbackHtml = "";
        if (sol.adminFeedback) {
          const mensagemFeedback =
            sol.adminFeedback.mensagemAdmin ||
            sol.adminFeedback.motivoRejeicao ||
            (sol.status === "Concluída" ? "Aprovada" : "Processada");
          feedbackHtml = `<p class="feedback-admin ${
            sol.status === "Rejeitada" ? "feedback-rejeitado" : ""
          }">
                                <strong>Admin (${nomeAdmin || "N/I"} em ${
            dataResolucaoFormatada || "N/I"
          }):</strong> ${mensagemFeedback}
                             </p>`;
        }

        // *** HTML DO ITEM MODIFICADO para incluir novas informações ***
        const itemHtml = `
              <li class="solicitacao-item">
                  <div class="solicitacao-header">
                      <strong>${tipoSolicitacaoFormatado}</strong> - ${statusHtml}
                      <small class="data-solicitacao">Solicitado em: ${dataSolFormatada}</small>
                  </div>
                  <div class="solicitacao-body">
                      ${
                        nomePaciente
                          ? `<p><strong>Paciente:</strong> ${nomePaciente}</p>`
                          : ""
                      }
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
                       ${feedbackHtml}
                  </div>
              </li>`;

        if (sol.status === "Pendente") {
          abertasHtml += itemHtml;
        } else {
          // Adiciona ao histórico se resolvida nos últimos 30 dias
          const dataResolucao = sol.adminFeedback?.dataResolucao?.toDate();
          if (dataResolucao && dataResolucao >= umMesAtras) {
            concluidasHtml += itemHtml;
          }
        }
      }); // Fim do forEach

      abertasContent.innerHTML = abertasHtml
        ? `<ul class="solicitacoes-list">${abertasHtml}</ul>`
        : "<p>Nenhuma solicitação em aberto.</p>";
      concluidasContent.innerHTML = concluidasHtml
        ? `<ul class="solicitacoes-list">${concluidasHtml}</ul>`
        : "<p>Nenhuma solicitação recente no histórico.</p>";
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      abertasContent.innerHTML = `<p class="alert alert-error">Erro ao carregar solicitações.</p>`;
      concluidasContent.innerHTML = "";
    }
  }
  // --- FIM DA FUNÇÃO MODIFICADA ---

  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';
    infoCardContainer.innerHTML = '<div class="loading-spinner"></div>';
    await fetchValoresConfig();
    await renderInfoCards();
    renderMinhasSolicitacoes().catch(console.error); // Renderiza o novo card
    const gradesDocRef = doc(db, "administrativo", "grades");
    const unsubscribe = onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel();
      },
      (error) => {
        console.error("Erro ao carregar resumo da grade:", error);
        summaryContainer.innerHTML = `<p class="alert alert-error">Não foi possível carregar o resumo.</p>`;
      }
    );
    // Guardar unsubscribe para limpar ao sair da view, se necessário
  }

  start().catch(console.error);
}
