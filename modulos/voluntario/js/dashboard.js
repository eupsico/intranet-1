// Arquivo: /modulos/voluntario/js/dashboard.js
// Versão: 2.1 (Atualiza links da grade e adiciona card "Minhas Solicitações")

// 1. Importa todas as funções necessárias do nosso arquivo central de inicialização
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
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");
  // NOVO: Container para o novo card de solicitações
  const solicitacoesContainer = document.getElementById(
    "solicitacoes-container"
  );

  if (!summaryContainer || !infoCardContainer) return;

  let dadosDasGrades = {};
  let valoresConfig = {}; // Armazena a configuração de valores
  const diasDaSemana = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
  };

  /**
   * Busca as configurações de valores do financeiro no Firestore usando a sintaxe v9.
   */
  async function fetchValoresConfig() {
    try {
      const docRef = doc(db, "financeiro", "configuracoes"); // Sintaxe v9
      const docSnap = await getDoc(docRef); // Sintaxe v9

      if (docSnap.exists()) {
        const data = docSnap.data();
        valoresConfig = data.valores || { online: 0, presencial: 0 };
      } else {
        console.error("Documento 'financeiro/configuracoes' não encontrado!");
        valoresConfig = { online: 0, presencial: 0 };
      }
    } catch (error) {
      console.error("Erro ao buscar configurações de valores:", error);
      valoresConfig = { online: 0, presencial: 0 };
    }
  }

  /**
   * Renderiza o painel "Meu Resumo Semanal".
   * (Links de "Atualize sua grade" foram alterados)
   */
  function renderSummaryPanel() {
    if (!userData || !userData.username) {
      summaryContainer.innerHTML =
        "<p>Não foi possível identificar o usuário para exibir o resumo.</p>";
      return;
    }

    const userUsername = userData.username;
    const userFullName = userData.nome; // Corrigido de 'name' para 'nome'
    let horasOnline = 0,
      horasPresencial = 0;
    let agendamentosOnline = [],
      agendamentosPresencial = [];

    for (const path in dadosDasGrades) {
      const nomeNaGrade = dadosDasGrades[path];
      if (nomeNaGrade === userUsername || nomeNaGrade === userFullName) {
        const parts = path.split(".");
        if (parts.length === 4) {
          const tipo = parts[0];
          const diaKey = parts[1];
          const horaFormatada = parts[2].replace("-", ":");
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
                    <div class="summary-card">
                        <h4>💰 Resumo Financeiro</h4>
                        <ul>
                            <li>
                                <span class="financeiro-horas">Total de horas: <strong>${totalHoras}</strong></span>
                                <span class="financeiro-valor">Valor total a pagar: ${valorFormatado}</span>
                                <small>O pagamento deve ser realizado até o dia 10.</small>
                            </li>
                        </ul>
                    </div>
                    <div class="summary-card">
                        <h4>🖥️ Grade Online (${horasOnline})</h4>
                        <ul>${
                          agendamentosOnline.length > 0
                            ? agendamentosOnline.join("")
                            : "<li>Nenhum horário online.</li>"
                        }</ul>
                        <a href="#recursos" class="card-footer-link" onclick="setTimeout(() => abrirAba('alterar-grade'), 100)">Solicitar exclusão de horários.</a>
Solicitar exclusão de horários.</a>
                    </div>
                    <div class="summary-card">
                        <h4>🏢 Grade Presencial (${horasPresencial})</h4>
                        <ul>${
                          agendamentosPresencial.length > 0
                            ? agendamentosPresencial.join("")
                            : "<li>Nenhum horário presencial.</li>"
                        }</ul>
                        <a href="#recursos" class="card-footer-link" onclick="setTimeout(() => abrirAba('alterar-grade'), 100)">Solicitar exclusão de horários.</a>
Solicitar exclusão de horários.</a>
                    </div>
                </div>
            </div>`;
  }

  /**
   * Busca e renderiza os novos cards de informação.
   */
  async function renderInfoCards() {
    let cardsHtml = "";

    // Card de Disponibilidade
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
    cardsHtml += `
            <div class="info-card">
                <h3>🗓️ Minha Disponibilidade</h3>
                <ul class="disponibilidade-list">${disponibilidadeHtml}</ul>
                <a href="#recursos" class="card-footer-link">Atualize sua disponibilidade em Recursos.</a>
            </div>`;

    // Card de Próxima Supervisão
    const proximaSupervisao = await getProximaSupervisao();
    cardsHtml += `
            <div class="info-card">
                <h3>🎓 Próxima Supervisão</h3>
                <ul><li>${proximaSupervisao}</li></ul>
            </div>`;

    // Card de Agendamentos Futuros (apenas para supervisores)
    if (userData.funcoes && userData.funcoes.includes("supervisor")) {
      const agendamentosFuturos = await getAgendamentosFuturosSupervisor();
      cardsHtml += `
                <div class="info-card">
                    <h3>⭐ Agendamentos (Supervisor)</h3>
                    <ul>${agendamentosFuturos}</ul>
                </div>`;
    }

    infoCardContainer.innerHTML = `<div class="info-card-grid">${cardsHtml}</div>`;
  }

  /**
   * Busca a próxima supervisão agendada usando a sintaxe v9.
   */
  async function getProximaSupervisao() {
    try {
      const hoje = new Date();
      // Sintaxe v9 para criar a consulta
      const q = query(
        collection(db, "agendamentos"),
        where("profissionalUid", "==", user.uid),
        where("dataAgendamento", ">=", hoje),
        orderBy("dataAgendamento"),
        limit(1)
      );

      const querySnapshot = await getDocs(q); // Sintaxe v9

      if (querySnapshot.empty) {
        return "Nenhuma supervisão agendada.";
      }

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
      console.error("Erro ao buscar próxima supervisão:", error);
      return "Não foi possível carregar a informação.";
    }
  }

  /**
   * Busca os próximos agendamentos para um supervisor usando a sintaxe v9.
   */
  async function getAgendamentosFuturosSupervisor() {
    try {
      const hoje = new Date();
      // Sintaxe v9 para criar a consulta
      const q = query(
        collection(db, "agendamentos"),
        where("supervisorUid", "==", user.uid),
        where("dataAgendamento", ">=", hoje),
        orderBy("dataAgendamento")
      );

      const querySnapshot = await getDocs(q); // Sintaxe v9

      if (querySnapshot.empty) {
        return "<li>Nenhum agendamento futuro.</li>";
      }

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
      console.error("Erro ao buscar agendamentos do supervisor:", error);
      return "<li>Não foi possível carregar os agendamentos.</li>";
    }
  }

  // --- NOVA FUNÇÃO ---
  /**
   * Busca e renderiza o card "Minhas Solicitações"
   */
  async function renderMinhasSolicitacoes() {
    if (!solicitacoesContainer) return; // Se o container não existir no HTML, não faz nada

    solicitacoesContainer.innerHTML = `
            <div class="info-card" id="card-minhas-solicitacoes">
                <h3><i class="fas fa-tasks"></i> Minhas Solicitações</h3>
                <h4>Solicitações em Aberto</h4>
                <div id="solicitacoes-abertas-content">
                    <div class="loading-spinner-small"></div>
                </div>
                <hr>
                <h4>Concluídas (Últimos 30 dias)</h4>
                <div id="solicitacoes-concluidas-content">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
        `;

    const abertasContent = document.getElementById(
      "solicitacoes-abertas-content"
    );
    const concluidasContent = document.getElementById(
      "solicitacoes-concluidas-content"
    );

    const umMesAtras = new Date();
    umMesAtras.setDate(umMesAtras.getDate() - 30);

    // Query para todas as solicitações do usuário
    const q = query(
      collection(db, "solicitacoesExclusaoGrade"),
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
          "<p>Nenhuma solicitação concluída recentemente.</p>";
        return;
      }

      querySnapshot.forEach((doc) => {
        const sol = doc.data();

        const dataSol = sol.dataSolicitacao
          ? sol.dataSolicitacao.toDate().toLocaleDateString("pt-BR")
          : "Data pendente";

        const horarios = sol.horariosParaExcluir.map((h) => h.label).join(", ");

        // Define o status e o feedback do admin
        let statusHtml = "";
        let feedbackHtml = "";

        const statusClass = `status-${String(sol.status).toLowerCase()}`;
        statusHtml = `<span class_ ="status-badge ${statusClass}">${sol.status}</span>`;

        if (sol.status === "Concluída" && sol.adminFeedback) {
          const dataExclusao = sol.adminFeedback.dataExclusao
            ? sol.adminFeedback.dataExclusao
                .toDate()
                .toLocaleDateString("pt-BR")
            : "";
          feedbackHtml = `<p class="feedback-admin"><strong>Admin:</strong> ${
            sol.adminFeedback.mensagemAdmin || "Horário excluído."
          } (Em: ${dataExclusao})</p>`;
        } else if (sol.status === "Rejeitada" && sol.adminFeedback) {
          feedbackHtml = `<p class="feedback-admin feedback-rejeitado"><strong>Admin:</strong> ${
            sol.adminFeedback.motivoRejeicao || "Solicitação rejeitada."
          }</p>`;
        }

        const itemHtml = `
                    <li class="solicitacao-item">
                        <div class="solicitacao-header">
                            <strong>Data:</strong> ${dataSol} ${statusHtml}
                        </div>
                        <div class="solicitacao-body">
                            <p><strong>Horários:</strong> ${horarios}</p>
                            <p><strong>Motivo:</strong> ${sol.motivo}</p>
                            ${feedbackHtml}
                        </div>
                    </li>
                `;

        if (sol.status === "Pendente") {
          abertasHtml += itemHtml;
        } else {
          // Verifica se foi concluída/rejeitada no último mês
          const dataResolucao = sol.adminFeedback?.dataResolucao
            ? sol.adminFeedback.dataResolucao.toDate()
            : null;
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
        : "<p>Nenhuma solicitação concluída nos últimos 30 dias.</p>";
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      abertasContent.innerHTML = `<p class="alert alert-error">Erro ao carregar solicitações.</p>`;
      concluidasContent.innerHTML = "";
    }
  }

  /**
   * Função principal que inicializa a renderização do dashboard.
   */
  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';
    infoCardContainer.innerHTML = '<div class="loading-spinner"></div>';

    await fetchValoresConfig();
    await renderInfoCards();
    // CHAMA A NOVA FUNÇÃO
    renderMinhasSolicitacoes().catch(console.error);

    const gradesDocRef = doc(db, "administrativo", "grades"); // Sintaxe v9

    // Usando onSnapshot com a sintaxe v9
    const unsubscribe = onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel();
      },
      (error) => {
        console.error("Erro ao carregar resumo da grade:", error);
        summaryContainer.innerHTML = `<p class="alert alert-error">Não foi possível carregar o resumo semanal.</p>`;
      }
    );

    // Opcional: Guardar a função `unsubscribe` para chamá-la quando o usuário sair da view
  }

  start().catch(console.error);
}
