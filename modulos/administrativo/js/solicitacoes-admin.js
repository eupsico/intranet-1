// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO CORRIGIDA E COMPLETA ---

import {
  db,
  collection,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  writeBatch,
  getDocs,
} from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser;
let dadosDaGradeAdmin = {};
let salasPresenciaisAdmin = [];
let listaFeriadosSistema = [];

// --- Funções Auxiliares ---
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    try {
      const date = new Date(timestamp + "T03:00:00");
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) {
      console.warn("Erro ao formatar data string:", timestamp, e);
    }
  }
  return "N/A";
}

function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    encaminhamento: "Solicitação de Encaminhamento",
    reavaliacao: "Solicitação Reavaliação",
    exclusao_horario: "Exclusão de Horário",
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
  };
  return mapaTipos[tipoInterno] || tipoInterno;
}

// Função para carregar dados da grade
async function loadGradeDataAdmin() {
  try {
    const gradeRef = doc(dbInstance, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDaGradeAdmin = gradeSnap.data();
      console.log("Dados da grade carregados para admin.");
    } else {
      console.warn(
        "Documento da grade (administrativo/grades) não encontrado."
      );
      dadosDaGradeAdmin = {};
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade para admin:", error);
    dadosDaGradeAdmin = {};
  }
}

// --- ATUALIZADO: Carrega Salas E Feriados ---
async function carregarConfiguracoesGerais() {
  if (salasPresenciaisAdmin.length > 0 && listaFeriadosSistema.length > 0)
    return;

  try {
    const configRef = doc(dbInstance, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      const dados = docSnap.data();

      // 1. Carregar Salas
      if (dados.listas?.salasPresenciais) {
        salasPresenciaisAdmin = dados.listas.salasPresenciais;
        console.log("Salas carregadas:", salasPresenciaisAdmin);
      }

      // 2. Carregar Feriados
      if (dados.listas?.feriados) {
        // Limpa espaços extras das strings
        listaFeriadosSistema = dados.listas.feriados.map((f) => f.trim());
        console.log("Feriados carregados:", listaFeriadosSistema);
      }
    } else {
      console.warn("Configurações gerais não encontradas.");
      salasPresenciaisAdmin = [];
      listaFeriadosSistema = [];
    }
  } catch (error) {
    console.error("Erro ao carregar configurações gerais:", error);
    salasPresenciaisAdmin = [];
    listaFeriadosSistema = [];
  }
}

// Função principal de inicialização
export async function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.CORRIGIDA iniciado."
  );
  adminUser = userData;

  await loadGradeDataAdmin();
  await carregarConfiguracoesGerais();

  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector("#tab-content-container");

  function setupTabs() {
    if (!tabsContainer) return;
    tabsContainer.addEventListener("click", (event) => {
      const clickedTab = event.target.closest(".tab-link");
      if (!clickedTab) return;
      const targetTabId = clickedTab.dataset.tab;
      tabLinks.forEach((link) => link.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));
      clickedTab.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add("active");
      } else {
        console.warn(`Conteúdo da aba não encontrado para ID: ${targetTabId}`);
      }
    });
    if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
      tabLinks[0].click();
    }
  }

  // --- Função Genérica: Carregar Solicitações ---
  function loadSolicitacoesPorTipo(
    tipoSolicitacao,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRowFunction,
    colspan = 7
  ) {
    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) {
      console.error(
        `Elementos do DOM não encontrados para [${tipoSolicitacao}].`
      );
      return;
    }

    tableBody.innerHTML = `<tr><td colspan="${colspan}"><div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando...</td></tr>`;
    emptyState.style.display = "none";
    countBadge.style.display = "none";
    countBadge.textContent = "0";

    try {
      const q = query(
        collection(dbInstance, "solicitacoes"),
        where("tipo", "==", tipoSolicitacao),
        where("status", "==", "Pendente"),
        orderBy("dataSolicitacao", "desc")
      );

      onSnapshot(
        q,
        (querySnapshot) => {
          tableBody.innerHTML = "";
          const pendingCount = querySnapshot.size;

          if (querySnapshot.empty) {
            emptyState.style.display = "block";
            countBadge.style.display = "none";
            countBadge.textContent = "0";
          } else {
            emptyState.style.display = "none";
            countBadge.textContent = pendingCount;
            countBadge.style.display = "inline-block";

            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const docId = doc.id;
              const tr = renderRowFunction(data, docId);
              if (tr instanceof Node) {
                tableBody.appendChild(tr);
              } else {
                try {
                  tableBody.innerHTML += tr;
                } catch (e) {
                  console.error("Falha ao adicionar linha como string:", e);
                }
              }
            });
          }
        },
        (error) => {
          console.error(
            `Erro ao buscar [${tipoSolicitacao}] em tempo real:`,
            error
          );
          tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
        }
      );
    } catch (error) {
      console.error(
        `Falha ao construir query para [${tipoSolicitacao}]:`,
        error
      );
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Falha na query.</td></tr>`;
    }
  }

  // --- Implementação das funções de carregamento ---
  function loadNovasSessoes() {
    loadSolicitacoesPorTipo(
      "novas_sessoes",
      "table-body-novas-sessoes",
      "empty-state-novas-sessoes",
      "count-novas-sessoes",
      renderNovasSessoesRow,
      7
    );
  }
  function loadAlteracoesHorario() {
    loadSolicitacoesPorTipo(
      "alteracao_horario",
      "table-body-alteracoes-horario",
      "empty-state-alteracoes-horario",
      "count-alteracoes-horario",
      renderAlteracaoHorarioRow,
      9
    );
  }
  function loadDesfechosPB() {
    loadSolicitacoesPorTipo(
      "desfecho",
      "table-body-desfechos-pb",
      "empty-state-desfechos-pb",
      "count-desfechos-pb",
      renderDesfechoRow,
      8
    );
  }
  function loadEncaminhamentos() {
    loadSolicitacoesPorTipo(
      "encaminhamento",
      "table-body-encaminhamento",
      "empty-state-encaminhamento",
      "count-encaminhamento",
      renderEncaminhamentoRow,
      7
    );
  }
  function loadExclusaoHorarios() {
    loadSolicitacoesPorTipo(
      "exclusao_horario",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      renderExclusaoHorarioRow,
      7
    );
  }

  async function loadStatusContratos() {
    const tableBodyId = "table-body-status-contratos";
    const emptyStateId = "empty-state-status-contratos";
    const countBadgeId = "count-status-contratos";
    const colspan = 5;

    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) return;

    tableBody.innerHTML = `<tr><td colspan="${colspan}"><div class="loading-spinner-small" style="margin: 10px auto;"></div> Buscando...</td></tr>`;

    try {
      const qCombined = query(collection(dbInstance, "trilhaPaciente"));
      const snapshot = await getDocs(qCombined);

      let pendingContracts = [];
      snapshot.forEach((doc) => {
        const pacienteId = doc.id;
        const pacienteData = doc.data();

        if (
          !["em_atendimento_pb", "cadastrar_horario_psicomanager"].includes(
            pacienteData.status
          )
        )
          return;

        const atendimentosAtivos =
          pacienteData.atendimentosPB?.filter(
            (at) => at.statusAtendimento === "ativo"
          ) || [];

        atendimentosAtivos.forEach((atendimento) => {
          if (!atendimento.contratoAssinado) {
            pendingContracts.push({
              pacienteId: pacienteId,
              pacienteNome: pacienteData.nomeCompleto || "Nome não encontrado",
              profissionalNome:
                atendimento.profissionalNome || "Profissional não encontrado",
              profissionalId: atendimento.profissionalId || null,
              statusContrato: "Pendente",
              lastUpdate: pacienteData.lastUpdate,
            });
          }
        });
      });

      pendingContracts.sort((a, b) =>
        a.pacienteNome.localeCompare(b.pacienteNome)
      );

      if (pendingContracts.length === 0) {
        tableBody.innerHTML = "";
        emptyState.style.display = "block";
        countBadge.style.display = "none";
      } else {
        tableBody.innerHTML = "";
        emptyState.style.display = "none";
        countBadge.textContent = pendingContracts.length;
        countBadge.style.display = "inline-block";

        pendingContracts.forEach((item) => {
          const dataAtualizacao = formatarData(item.lastUpdate);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${item.pacienteNome}</td>
            <td>${item.profissionalNome}</td>
            <td><span class="status-badge status-pendente">${item.statusContrato}</span></td>
            <td>${dataAtualizacao}</td>
            <td><button class="action-button btn-notificar-contrato" 
            data-paciente-id="${item.pacienteId}" data-paciente-nome="${item.pacienteNome}"
            data-profissional-id="${item.profissionalId}" data-profissional-nome="${item.profissionalNome}"
            title="Notificar profissional sobre contrato pendente via WhatsApp">Notificar</button></td>`;
          tableBody.appendChild(tr);
        });
      }
    } catch (error) {
      console.error("Erro ao carregar status de contratos:", error);
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados.</td></tr>`;
    }
  }

  // --- Funções de Renderização ---
  function renderNovasSessoesRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioFormatada = detalhes.dataInicioPreferencial
      ? formatarData(detalhes.dataInicioPreferencial)
      : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.diaSemana || "N/A"}, ${detalhes.horario || "N/A"} (${
      detalhes.modalidade || "N/A"
    })</td>
        <td>${dataInicioFormatada}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="novas_sessoes">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>
    `;
    return tr;
  }

  function renderAlteracaoHorarioRow(data, docId) {
    const detalhes = data.detalhes || {};
    const antigos = detalhes.dadosAntigos || {};
    const novos = detalhes.dadosNovos || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioNova = novos.dataInicio
      ? formatarData(novos.dataInicio)
      : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${antigos.dia || "N/A"}, ${antigos.horario || "N/A"} (${
      antigos.modalidade || "N/A"
    })</td>
        <td>${novos.dia || "N/A"}, ${novos.horario || "N/A"} (${
      novos.modalidade || "N/A"
    })</td>
          <td>${dataInicioNova}</td>
        <td class="motivo-cell">${detalhes.justificativa || "N/A"}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="alteracao_horario">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>
    `;
    return tr;
  }

  function renderDesfechoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataDesf = detalhes.dataDesfecho
      ? formatarData(detalhes.dataDesfecho)
      : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${dataSol}</td>
          <td>${dataDesf}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.tipoDesfecho || "N/A"}</td>
        <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="desfecho">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>
    `;
    return tr;
  }

  function renderEncaminhamentoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.servicoEncaminhado || "N/A"}</td>
        <td class="motivo-cell">${detalhes.motivoEncaminhamento || "N/A"}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="encaminhamento">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>
    `;
    return tr;
  }

  function renderExclusaoHorarioRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const horariosLabels =
      detalhes.horariosParaExcluir?.map((h) => h.label).join(", ") || "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${detalhes.totalHorariosAtual ?? "N/A"}</td>
        <td>${horariosLabels}</td>
        <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="exclusao_horario">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>
    `;
    return tr;
  }

  // --- LÓGICA DE NOVAS SESSÕES ---

  function carregarSalasDropdownAdmin() {
    const salaSelect = document.getElementById("admin-ag-sala");
    if (salaSelect) {
      salaSelect.innerHTML =
        '<option value="">Selecione o Tipo de Sessão primeiro...</option>';
    }
  }

  function setupModalLogicNovasSessoes(data) {
    const recorrenciaSelect = document.getElementById("admin-ag-recorrencia");
    const quantidadeContainer = document.getElementById(
      "admin-ag-quantidade-container"
    );
    const tipoSessaoSelect = document.getElementById("admin-ag-tipo-sessao");
    const salaSelect = document.getElementById("admin-ag-sala");
    const horaInicioInput = document.getElementById("admin-ag-hora-inicio");
    const horaFimInput = document.getElementById("admin-ag-hora-fim");
    const quantidadeInput = document.getElementById("admin-ag-quantidade");

    if (recorrenciaSelect && quantidadeContainer) {
      recorrenciaSelect.addEventListener("change", (e) => {
        if (e.target.value === "unica") {
          quantidadeContainer.style.display = "none";
          if (quantidadeInput) quantidadeInput.value = "1";
        } else {
          quantidadeContainer.style.display = "block";
          if (quantidadeInput && quantidadeInput.value === "1") {
            quantidadeInput.value = "4";
          }
        }
      });
      recorrenciaSelect.dispatchEvent(new Event("change"));
    }

    if (tipoSessaoSelect && salaSelect) {
      tipoSessaoSelect.addEventListener("change", (e) => {
        salaSelect.innerHTML = '<option value="">Selecione...</option>';
        const tipo = e.target.value;
        if (tipo === "Online") {
          const opt = document.createElement("option");
          opt.value = "Online";
          opt.textContent = "Atendimento Online";
          opt.selected = true;
          salaSelect.appendChild(opt);
        } else if (tipo === "Presencial") {
          if (salasPresenciaisAdmin && salasPresenciaisAdmin.length > 0) {
            salasPresenciaisAdmin.forEach((sala) => {
              const opt = document.createElement("option");
              opt.value = sala;
              opt.textContent = sala;
              salaSelect.appendChild(opt);
            });
          } else {
            salaSelect.innerHTML =
              '<option value="">Nenhuma sala cadastrada</option>';
          }
        }
      });
    }

    if (horaInicioInput && horaFimInput) {
      horaInicioInput.addEventListener("change", (e) => {
        const inicio = e.target.value;
        if (inicio) {
          const [horas, minutos] = inicio.split(":").map(Number);
          const dataTemp = new Date();
          dataTemp.setHours(horas);
          dataTemp.setMinutes(minutos + 50);
          const horasFim = String(dataTemp.getHours()).padStart(2, "0");
          const minutosFim = String(dataTemp.getMinutes()).padStart(2, "0");
          horaFimInput.value = `${horasFim}:${minutosFim}`;
        }
      });
    }
  }
  // --- NOVA FUNÇÃO DE VERIFICAÇÃO DE FERIADOS (Dinâmica) ---
  function ehFeriado(data) {
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();

    const feriadoFixo = `${dia}/${mes}`; // Ex: 25/12
    const feriadoCompleto = `${dia}/${mes}/${ano}`; // Ex: 13/02/2024

    // Verifica se alguma entrada na lista do sistema coincide
    // A lista pode conter strings puras como "25/12" ou "25/12 (Natal)"
    // Vamos verificar se a data *começa* com o padrão, para ignorar descrições entre parênteses se houver

    return listaFeriadosSistema.some((f) => {
      const fLimpo = f.split(" ")[0]; // Pega só a data antes do primeiro espaço (se houver descrição)
      return fLimpo === feriadoFixo || fLimpo === feriadoCompleto;
    });
  }

  // --- ATUALIZADO: Handler com verificação de feriado ---
  // --- Função Principal: Processar Novas Sessões (CORRIGIDA: Gera dataHora) ---
  async function handleNovasSessoesAction(docId, action, solicitacaoData) {
    const btnAprovar = document.getElementById("btn-aprovar-novas-sessoes");
    const btnRejeitar = document.getElementById("btn-rejeitar-novas-sessoes");
    const mensagemInput = document.getElementById("admin-ag-message-text");
    const mensagem = mensagemInput ? mensagemInput.value.trim() : "";

    const dataInicio = document.getElementById("admin-ag-data-inicio")?.value;
    const horaInicio = document.getElementById("admin-ag-hora-inicio")?.value;
    const horaFim = document.getElementById("admin-ag-hora-fim")?.value;
    const recorrencia = document.getElementById("admin-ag-recorrencia")?.value;
    const qtdSessoes = parseInt(
      document.getElementById("admin-ag-quantidade")?.value || "1"
    );
    const tipoSessao = document.getElementById("admin-ag-tipo-sessao")?.value;
    const sala = document.getElementById("admin-ag-sala")?.value;

    if (btnAprovar) btnAprovar.disabled = true;
    if (btnRejeitar) btnRejeitar.disabled = true;

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const adminFeedback = {
        statusFinal: action,
        mensagemAdmin: mensagem,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
      };

      if (action === "Rejeitada") {
        if (!mensagem)
          throw new Error(
            "Para rejeitar, é obrigatório informar uma mensagem/motivo."
          );
        await updateDoc(docRef, {
          status: "Rejeitada",
          adminFeedback: adminFeedback,
        });
        alert("Solicitação rejeitada com sucesso.");
      } else if (action === "Aprovada") {
        if (
          !dataInicio ||
          !horaInicio ||
          !recorrencia ||
          !tipoSessao ||
          !sala
        ) {
          throw new Error(
            "Preencha todos os campos obrigatórios do agendamento (*)."
          );
        }
        if (!solicitacaoData.pacienteId) {
          throw new Error(
            "Erro: ID do paciente não encontrado na solicitação."
          );
        }

        const batch = writeBatch(dbInstance);
        const sessoesRef = collection(
          dbInstance,
          "trilhaPaciente",
          solicitacaoData.pacienteId,
          "sessoes"
        );
        const pacienteRef = doc(
          dbInstance,
          "trilhaPaciente",
          solicitacaoData.pacienteId
        );

        let dataBase = new Date(dataInicio + "T00:00:00");

        let sessoesCriadas = 0;
        let tentativasSeguranca = 0;
        const MAX_TENTATIVAS = 100;

        while (
          sessoesCriadas < qtdSessoes &&
          tentativasSeguranca < MAX_TENTATIVAS
        ) {
          tentativasSeguranca++;

          if (ehFeriado(dataBase)) {
            console.log(`Pulando feriado: ${dataBase.toLocaleDateString()}`);
            avancarData(dataBase, recorrencia);
            continue;
          }

          const novaSessaoRef = doc(sessoesRef);
          const dataString = dataBase.toISOString().split("T")[0];

          // --- CORREÇÃO: Criar objeto Date combinando dia e hora ---
          const dataHoraIso = new Date(`${dataString}T${horaInicio}:00`);
          // ---------------------------------------------------------

          const sessaoData = {
            pacienteId: solicitacaoData.pacienteId || null,
            pacienteNome: solicitacaoData.pacienteNome || "N/A",
            profissionalId: solicitacaoData.solicitanteId || null,
            profissionalNome: solicitacaoData.solicitanteNome || "N/A",
            data: dataString, // Campo Legado/Visualização simples
            horaInicio: horaInicio, // Campo Legado/Visualização simples
            horaFim: horaFim,
            dataHora: Timestamp.fromDate(dataHoraIso), // *** CAMPO CRUCIAL PARA ORDENAÇÃO ***
            status: "Agendado",
            modalidade: tipoSessao,
            sala: sala,
            criadoEm: serverTimestamp(),
            origemSolicitacaoId: docId,
          };

          batch.set(novaSessaoRef, sessaoData);
          sessoesCriadas++;

          avancarData(dataBase, recorrencia);

          if (recorrencia === "unica" || recorrencia === "") break;
        }

        if (tentativasSeguranca >= MAX_TENTATIVAS) {
          console.warn("Limite de tentativas atingido.");
        }

        batch.update(docRef, {
          status: "Concluída",
          adminFeedback: adminFeedback,
        });
        batch.update(pacienteRef, {
          status: "em_atendimento_pb",
          lastUpdate: serverTimestamp(),
        });

        await batch.commit();
        alert(
          `Sucesso! ${sessoesCriadas} sessões geradas e status do paciente atualizado.`
        );
      }
      closeModal();
    } catch (error) {
      console.error("Erro ao processar novas sessões:", error);
      alert("Erro: " + error.message);
      if (btnAprovar) btnAprovar.disabled = false;
      if (btnRejeitar) btnRejeitar.disabled = false;
    }
  }
  function avancarData(dateObj, recorrencia) {
    if (recorrencia === "semanal") dateObj.setDate(dateObj.getDate() + 7);
    else if (recorrencia === "quinzenal")
      dateObj.setDate(dateObj.getDate() + 14);
    else if (recorrencia === "mensal") dateObj.setMonth(dateObj.getMonth() + 1);
  }
  // --- Função Principal para Abrir Modal (RESTAURADA) ---
  async function openGenericSolicitacaoModal(docId, tipo) {
    console.log(`Abrindo modal para ${tipo}, ID: ${docId}`);
    modalTitle.textContent = `Processar Solicitação (${formatarTipoSolicitacao(
      tipo
    )})`;
    modalBodyContent.innerHTML = '<div class="loading-spinner"></div>';
    modalFooterActions.innerHTML = "";
    modalFooterActions.appendChild(modalCancelBtn);
    openModal();

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Solicitação não encontrada!");
      const solicitacaoData = { id: docSnap.id, ...docSnap.data() };

      let modalHtmlPath = `../page/`;
      switch (tipo) {
        case "novas_sessoes":
          modalHtmlPath += "modal-novas-sessoes.html";
          break;
        case "alteracao_horario":
          modalHtmlPath += "modal-alteracao-horario.html";
          break;
        case "desfecho":
          modalHtmlPath += "modal-desfecho.html";
          break;
        case "encaminhamento":
          modalHtmlPath += "modal-encaminhamento.html";
          break;
        case "reavaliacao":
          modalHtmlPath += "modal-reavaliacao.html";
          break;
        case "inclusao_alteracao_grade":
          modalHtmlPath += "modal-inclusao-alteracao-grade.html";
          break;
        case "exclusao_horario":
          modalHtmlPath += "modal-exclusao-grade.html";
          break;
        default:
          throw new Error(`Tipo de solicitação desconhecido: ${tipo}`);
      }

      const response = await fetch(modalHtmlPath);
      if (!response.ok)
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}).`
        );
      modalBodyContent.innerHTML = await response.text();

      preencherCamposModal(tipo, solicitacaoData);
      configurarAcoesModal(docId, tipo, solicitacaoData);

      if (tipo === "novas_sessoes") {
        setupModalLogicNovasSessoes(solicitacaoData);
      } else if (tipo === "exclusao_horario") {
        setupModalFormLogicExclusao();
      }
    } catch (error) {
      console.error("Erro ao abrir modal genérico:", error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes: ${error.message}</p>`;
      modalFooterActions.innerHTML = "";
      modalFooterActions.appendChild(modalCancelBtn);
    }
  }

  function preencherCamposModal(tipo, data) {
    const detalhes = data.detalhes || {};

    setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
    setValueIfExists("#modal-solicitante-id", data.solicitanteId);
    setTextContentIfExists("#modal-paciente-nome", data.pacienteNome);
    setTextContentIfExists(
      "#modal-data-solicitacao",
      formatarData(data.dataSolicitacao)
    );

    try {
      switch (tipo) {
        case "novas_sessoes":
          setTextContentIfExists("#modal-ns-dia", detalhes.diaSemana);
          setTextContentIfExists("#modal-ns-horario", detalhes.horario);
          setTextContentIfExists("#modal-ns-modalidade", detalhes.modalidade);
          setTextContentIfExists("#modal-ns-sala", detalhes.sala);
          setTextContentIfExists(
            "#modal-ns-data-inicio",
            formatarData(detalhes.dataInicioPreferencial)
          );
          setTextContentIfExists(
            "#modal-ns-recorrencia",
            detalhes.frequencia || "N/A"
          );
          setValueIfExists("#admin-ag-profissional-nome", data.solicitanteNome);
          carregarSalasDropdownAdmin();
          break;
        case "alteracao_horario":
          const antigos = detalhes.dadosAntigos || {};
          const novos = detalhes.dadosNovos || {};
          setTextContentIfExists("#modal-ah-dia-atual", antigos.dia);
          setTextContentIfExists("#modal-ah-horario-atual", antigos.horario);
          setTextContentIfExists(
            "#modal-ah-modalidade-atual",
            antigos.modalidade
          );
          setTextContentIfExists("#modal-ah-dia-novo", novos.dia);
          setTextContentIfExists("#modal-ah-horario-novo", novos.horario);
          setTextContentIfExists("#modal-ah-modalidade-nova", novos.modalidade);
          setTextContentIfExists("#modal-ah-frequencia-nova", novos.frequencia);
          setTextContentIfExists("#modal-ah-sala-nova", novos.sala);
          setTextContentIfExists(
            "#modal-ah-data-inicio-nova",
            formatarData(novos.dataInicio)
          );
          setTextContentIfExists("#modal-ah-alterar-grade", novos.alterarGrade);
          setTextContentIfExists(
            "#modal-ah-justificativa",
            detalhes.justificativa
          );
          break;
        case "desfecho":
          setTextContentIfExists("#modal-df-tipo", detalhes.tipoDesfecho);
          setTextContentIfExists(
            "#modal-df-data",
            formatarData(detalhes.dataDesfecho)
          );
          setTextContentIfExists(
            "#modal-df-sessoes",
            detalhes.sessoesRealizadas
          );
          setTextContentIfExists("#modal-df-motivo", detalhes.motivo);
          setTextContentIfExists("#modal-df-obs", detalhes.observacoesGerais);
          break;
        case "encaminhamento":
          setTextContentIfExists(
            "#modal-enc-servico",
            detalhes.servicoEncaminhado
          );
          setTextContentIfExists(
            "#modal-enc-motivo",
            detalhes.motivoEncaminhamento
          );
          setTextContentIfExists(
            "#modal-enc-demanda",
            detalhes.demandaPaciente
          );
          setTextContentIfExists(
            "#modal-enc-continua",
            detalhes.continuaAtendimentoEuPsico
          );
          setTextContentIfExists("#modal-enc-relato", detalhes.relatoCaso);
          setTextContentIfExists(
            "#modal-enc-sessoes",
            detalhes.sessoesRealizadas
          );
          setTextContentIfExists("#modal-enc-obs", detalhes.observacoesGerais);
          setTextContentIfExists(
            "#modal-enc-data",
            formatarData(detalhes.dataEncaminhamento)
          );
          const dispList = document.getElementById(
            "modal-enc-disponibilidade-list"
          );
          if (dispList && detalhes.disponibilidadeParaEncaminhamento) {
            dispList.innerHTML = detalhes.disponibilidadeParaEncaminhamento
              .map((item) => {
                const partes = item.split("_");
                let display = partes[0]
                  .replace(/-/g, " e ")
                  .replace("manha", "Manhã")
                  .replace("tarde", "Tarde")
                  .replace("noite", "Noite");
                if (partes.length > 1) display += ` às ${partes[1]}`;
                return `<li>${display}</li>`;
              })
              .join("");
          } else if (dispList) {
            dispList.innerHTML =
              "<li>Nenhuma disponibilidade detalhada fornecida.</li>";
          }
          break;
        case "reavaliacao":
          const pref = detalhes.preferenciaAgendamento || {};
          setTextContentIfExists(
            "#modal-rv-valor-atual",
            detalhes.valorContribuicaoAtual
          );
          setTextContentIfExists("#modal-rv-motivo", detalhes.motivo);
          setTextContentIfExists("#modal-rv-pref-modalidade", pref.modalidade);
          setTextContentIfExists(
            "#modal-rv-pref-data",
            formatarData(pref.data)
          );
          setTextContentIfExists("#modal-rv-pref-hora", pref.hora);
          break;
        case "inclusao_alteracao_grade":
          setTextContentIfExists("#modal-ig-dia", detalhes.diaSemana);
          setTextContentIfExists("#modal-ig-horario", detalhes.horario);
          setTextContentIfExists(
            "#modal-ig-modalidade",
            detalhes.modalidade || detalhes.tipoAtendimento
          );
          setTextContentIfExists("#modal-ig-sala", detalhes.salaAtendimento);
          setTextContentIfExists("#modal-ig-frequencia", detalhes.frequencia);
          setTextContentIfExists(
            "#modal-ig-data-inicio",
            formatarData(detalhes.dataInicio)
          );
          setTextContentIfExists("#modal-ig-obs", detalhes.observacoes);
          break;
        case "exclusao_horario":
          setTextContentIfExists(
            "#modal-solicitante-nome",
            data.solicitanteNome
          );
          setTextContentIfExists("#modal-solicitante-motivo", detalhes.motivo);
          const horariosList = document.getElementById("modal-horarios-list");
          if (horariosList) {
            horariosList.innerHTML =
              detalhes.horariosParaExcluir
                ?.map(
                  (h) =>
                    `<li>${h.label || "Sem Label"} (${
                      h.path || "Sem path"
                    })</li>`
                )
                .join("") || "<li>Nenhum horário especificado</li>";
          }
          break;
      }
    } catch (fillError) {
      console.error(
        `Erro ao preencher campos do modal para tipo ${tipo}:`,
        fillError
      );
      modalBodyContent.innerHTML += `<p class="alert alert-error">Erro interno ao exibir detalhes.</p>`;
    }

    if (data.adminFeedback && data.status !== "Pendente") {
      const feedback = data.adminFeedback;
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      );
      if (feedbackContainer) {
        feedbackContainer.style.display = "block";
        setTextContentIfExists("#view-admin-nome", feedback.adminNome);
        setTextContentIfExists(
          "#view-admin-data",
          formatarData(feedback.dataResolucao)
        );
        setTextContentIfExists("#view-admin-status", data.status);
        setTextContentIfExists(
          "#view-admin-mensagem",
          feedback.mensagemAdmin ||
            feedback.motivoRejeicao ||
            feedback.mensagem ||
            "Sem mensagem."
        );
      }
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = true));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = true));
      modalBodyContent
        .querySelectorAll(
          'input[name="foiExcluido"], #dataExclusao, #mensagemAdmin, #motivoRejeicao'
        )
        .forEach((el) => (el.disabled = true));
    } else {
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      );
      if (feedbackContainer) feedbackContainer.style.display = "none";
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = false));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = false));
      modalBodyContent
        .querySelectorAll(
          'input[name="foiExcluido"], #dataExclusao, #mensagemAdmin, #motivoRejeicao'
        )
        .forEach((el) => (el.disabled = false));
      const tipoSessaoSelect = modalBodyContent.querySelector(
        "#admin-ag-tipo-sessao"
      );
      if (tipoSessaoSelect) tipoSessaoSelect.dispatchEvent(new Event("change"));
      if (tipo === "exclusao_horario") setupModalFormLogicExclusao();
    }
  }

  function setTextContentIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) element.textContent = value ?? "N/A";
    else console.warn(`Elemento não encontrado para setText: ${selector}`);
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) element.value = value ?? "";
    else console.warn(`Elemento não encontrado para setValue: ${selector}`);
  }

  function configurarAcoesModal(docId, tipo, data) {
    modalFooterActions.innerHTML = "";
    modalFooterActions.appendChild(modalCancelBtn);

    if (data.status === "Pendente") {
      if (tipo === "novas_sessoes") {
        const approveButtonNs = document.createElement("button");
        approveButtonNs.type = "button";
        approveButtonNs.id = "btn-aprovar-novas-sessoes";
        approveButtonNs.className = "action-button success dynamic-action-btn";
        approveButtonNs.textContent = "Aprovar e Agendar";
        approveButtonNs.onclick = () =>
          handleNovasSessoesAction(docId, "Aprovada", data);
        modalFooterActions.appendChild(approveButtonNs);

        const rejectButtonNs = document.createElement("button");
        rejectButtonNs.type = "button";
        rejectButtonNs.id = "btn-rejeitar-novas-sessoes";
        rejectButtonNs.className = "action-button error dynamic-action-btn";
        rejectButtonNs.textContent = "Rejeitar";
        rejectButtonNs.onclick = () =>
          handleNovasSessoesAction(docId, "Rejeitada", data);
        modalFooterActions.appendChild(rejectButtonNs);
      } else if (tipo === "exclusao_horario") {
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "btn-salvar-exclusao";
        saveButton.className = "action-button dynamic-action-btn";
        saveButton.textContent = "Salvar Resposta (Exclusão)";
        saveButton.onclick = () => handleSalvarExclusao(docId, data);
        modalFooterActions.appendChild(saveButton);
      } else if (tipo === "encaminhamento") {
        const approveButtonEnc = document.createElement("button");
        approveButtonEnc.type = "button";
        approveButtonEnc.id = "btn-aprovar-encaminhamento";
        approveButtonEnc.className = "action-button success dynamic-action-btn";
        approveButtonEnc.textContent = "Aprovar e Mover para Fila PB";
        approveButtonEnc.onclick = () =>
          handleGenericSolicitacaoAction(docId, tipo, "Aprovada", data);
        modalFooterActions.appendChild(approveButtonEnc);

        const rejectButtonEnc = document.createElement("button");
        rejectButtonEnc.type = "button";
        rejectButtonEnc.id = "btn-rejeitar-encaminhamento";
        rejectButtonEnc.className = "action-button error dynamic-action-btn";
        rejectButtonEnc.textContent = "Rejeitar";
        rejectButtonEnc.onclick = () =>
          handleGenericSolicitacaoAction(docId, tipo, "Rejeitada", data);
        modalFooterActions.appendChild(rejectButtonEnc);

        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        );
        if (adminMessageGroup) adminMessageGroup.style.display = "block";
      } else {
        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.id = "btn-aprovar-solicitacao";
        approveButton.className = "action-button success dynamic-action-btn";
        approveButton.textContent = "Aprovar";
        approveButton.onclick = () =>
          handleGenericSolicitacaoAction(docId, tipo, "Aprovada", data);
        modalFooterActions.appendChild(approveButton);

        const rejectButton = document.createElement("button");
        rejectButton.type = "button";
        rejectButton.id = "btn-rejeitar-solicitacao";
        rejectButton.className = "action-button error dynamic-action-btn";
        rejectButton.textContent = "Rejeitar";
        rejectButton.onclick = () =>
          handleGenericSolicitacaoAction(docId, tipo, "Rejeitada", data);
        modalFooterActions.appendChild(rejectButton);

        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        );
        if (adminMessageGroup) {
          adminMessageGroup.style.display = "block";
          const adminMessageText = adminMessageGroup.querySelector(
            "#admin-message-text"
          );
          if (adminMessageText) adminMessageText.value = "";
        }
      }
    } else {
      const adminMessageGroup = document.getElementById(
        "modal-admin-message-group"
      );
      if (adminMessageGroup) adminMessageGroup.style.display = "none";
    }
  }

  async function handleGenericSolicitacaoAction(
    docId,
    tipo,
    novoStatus,
    solicitacaoData
  ) {
    const mensagemAdminInput = document.getElementById("admin-message-text");
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";

    if (novoStatus === "Rejeitada" && !mensagemAdmin) {
      alert("Forneça o motivo da rejeição.");
      mensagemAdminInput?.focus();
      return;
    }

    const approveButton = document.getElementById(
      tipo === "encaminhamento"
        ? "btn-aprovar-encaminhamento"
        : "btn-aprovar-solicitacao"
    );
    const rejectButton = document.getElementById(
      tipo === "encaminhamento"
        ? "btn-rejeitar-encaminhamento"
        : "btn-rejeitar-solicitacao"
    );
    if (approveButton) approveButton.disabled = true;
    if (rejectButton) rejectButton.disabled = true;
    const clickedButton = document.getElementById(
      novoStatus === "Aprovada"
        ? tipo === "encaminhamento"
          ? "btn-aprovar-encaminhamento"
          : "btn-aprovar-solicitacao"
        : tipo === "encaminhamento"
        ? "btn-rejeitar-encaminhamento"
        : "btn-rejeitar-solicitacao"
    );
    if (clickedButton)
      clickedButton.innerHTML = `<span class="loading-spinner-small"></span> Processando...`;

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const adminFeedback = {
        statusFinal: novoStatus,
        mensagemAdmin: mensagemAdmin,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
      };

      await updateDoc(docRef, {
        status: novoStatus,
        adminFeedback: adminFeedback,
      });

      console.log(
        `Solicitação ${docId} (${tipo}) atualizada para ${novoStatus}.`
      );

      if (novoStatus === "Aprovada") {
        console.log("Executando ações pós-aprovação para:", tipo);
        switch (tipo) {
          case "alteracao_horario":
            await processarAprovacaoAlteracaoHorario(solicitacaoData);
            break;
          case "encaminhamento":
            await processarAprovacaoEncaminhamento(solicitacaoData);
            break;
          case "desfecho":
            await processarAprovacaoDesfecho(solicitacaoData);
            break;
          case "reavaliacao":
            await processarAprovacaoReavaliacao(solicitacaoData);
            break;
          case "inclusao_alteracao_grade":
            await processarAprovacaoInclusaoGrade(solicitacaoData);
            break;
          default:
            console.log(
              `Nenhuma ação pós-aprovação genérica para tipo: ${tipo}`
            );
        }
      }

      alert(`Solicitação ${novoStatus.toLowerCase()} com sucesso!`);
      closeModal();
    } catch (error) {
      console.error(
        `Erro ao ${novoStatus.toLowerCase()} solicitação ${docId} (${tipo}):`,
        error
      );
      alert(`Erro ao processar: ${error.message}`);
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  }

  // --- Funções de Processamento Pós-Aprovação ---
  async function processarAprovacaoAlteracaoHorario(solicitacao) {
    console.log("Processando aprovação: Alteração de Horário", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const novosDados = detalhes.dadosNovos;
    if (!pacienteId || !atendimentoId || !novosDados)
      throw new Error("Dados incompletos para processar alteração.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado.`);
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = [...(pacienteData.atendimentosPB || [])];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );

      const nomeCampoHorario = "horarioSessoes";
      const horarioAtualizado = {
        ...(atendimentosPB[index][nomeCampoHorario] || {}),
        diaSemana: novosDados.dia,
        horario: novosDados.horario,
        tipoAtendimento: novosDados.modalidade,
        frequencia: novosDados.frequencia,
        salaAtendimento: novosDados.sala,
        dataInicio: novosDados.dataInicio,
        ultimaAlteracaoAprovadaEm: serverTimestamp(),
      };

      atendimentosPB[index][nomeCampoHorario] = horarioAtualizado;

      await updateDoc(pacienteRef, {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Horário atualizado na trilha para paciente ${pacienteId}, atendimento ${atendimentoId}.`
      );

      if (novosDados.alterarGrade === "Sim") {
        console.log(
          `Tentando atualizar grade para profissional ${solicitacao.solicitanteId}`
        );
        await atualizarGradeDoProfissional(
          solicitacao.solicitanteId,
          novosDados.dia,
          novosDados.horario,
          novosDados.modalidade,
          novosDados.sala,
          pacienteId,
          pacienteData.nomeCompleto || solicitacao.pacienteNome
        );
        console.log(
          `Grade atualizada (ou tentativa realizada) para ${solicitacao.solicitanteNome}.`
        );
      } else {
        console.log("Alteração na grade não solicitada.");
      }
    } catch (error) {
      console.error("Erro ao atualizar trilha ou grade:", error);
      throw new Error(
        `Falha ao atualizar dados do paciente ou grade: ${error.message}`
      );
    }
  }

  async function processarAprovacaoEncaminhamento(solicitacao) {
    console.log("Processando aprovação: Encaminhamento", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { servicoEncaminhado, disponibilidadeParaEncaminhamento } = detalhes;

    if (
      !pacienteId ||
      !atendimentoId ||
      !servicoEncaminhado ||
      !disponibilidadeParaEncaminhamento
    )
      throw new Error("Dados incompletos para processar encaminhamento.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);

    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado.`);
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = [...(pacienteData.atendimentosPB || [])];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );

      atendimentosPB[index].statusAtendimento = "concluido_encaminhamento";
      atendimentosPB[index].desfecho = {
        ...detalhes,
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
        tipoDesfecho: "Encaminhamento",
      };

      const horarioParaLiberar = atendimentosPB[index].horarioSessoes;
      const profissionalId = atendimentosPB[index].profissionalId;
      if (horarioParaLiberar && profissionalId) {
        await limparHorarioGrade(profissionalId, horarioParaLiberar);
      }

      const novoStatusPaciente = "encaminhar_para_pb";
      const updateData = {
        atendimentosPB: atendimentosPB,
        status: novoStatusPaciente,
        disponibilidadeEspecifica: disponibilidadeParaEncaminhamento,
        lastUpdate: serverTimestamp(),
      };

      await updateDoc(pacienteRef, updateData);
      console.log(
        `Encaminhamento aprovado. Paciente ${pacienteId} movido para a fila: ${novoStatusPaciente}.`
      );
    } catch (error) {
      console.error("Erro ao processar aprovação de encaminhamento:", error);
      throw new Error(`Falha ao processar encaminhamento: ${error.message}`);
    }
  }

  async function processarAprovacaoDesfecho(solicitacao) {
    console.log("Processando aprovação: Desfecho", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { tipoDesfecho, dataDesfecho } = detalhes;
    if (!pacienteId || !atendimentoId || !tipoDesfecho || !dataDesfecho)
      throw new Error("Dados incompletos para desfecho.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado.`);
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = [...(pacienteData.atendimentosPB || [])];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );

      const nomeCampoStatusAtendimento = "statusAtendimento";
      let novoStatusAtendimento = "";
      let novoStatusPaciente = pacienteData.status;

      switch (tipoDesfecho) {
        case "Alta":
          novoStatusAtendimento = "concluido_alta";
          novoStatusPaciente = "alta";
          break;
        case "Desistencia":
          novoStatusAtendimento = "concluido_desistencia";
          novoStatusPaciente = "desistencia";
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      atendimentosPB[index][nomeCampoStatusAtendimento] = novoStatusAtendimento;
      atendimentosPB[index].desfecho = {
        ...detalhes,
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };

      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      };
      if (novoStatusPaciente !== pacienteData.status) {
        updateData.status = novoStatusPaciente;
      }

      await updateDoc(pacienteRef, updateData);
      console.log(
        `Desfecho registrado na trilha para ${pacienteId}. Status Paciente: ${
          updateData.status || pacienteData.status
        }`
      );

      const horarioParaLiberar = atendimentosPB[index].horarioSessoes;
      const profissionalId = atendimentosPB[index].profissionalId;
      if (horarioParaLiberar && profissionalId) {
        console.warn(
          `AÇÃO NECESSÁRIA: Liberar horário na grade para ${profissionalId}: ${horarioParaLiberar.diaSemana}, ${horarioParaLiberar.horario}, ${horarioParaLiberar.tipoAtendimento}, ${horarioParaLiberar.salaAtendimento}`
        );
        await limparHorarioGrade(profissionalId, horarioParaLiberar);
      }
    } catch (error) {
      console.error("Erro ao atualizar trilha:", error);
      throw new Error(`Falha ao registrar desfecho: ${error.message}`);
    }
  }

  async function processarAprovacaoReavaliacao(solicitacao) {
    console.log("Processando aprovação: Reavaliação", solicitacao);
    const { pacienteId } = solicitacao;
    if (!pacienteId) throw new Error("ID do Paciente faltando.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado.`);
      const pacienteData = pacienteSnap.data();

      const novoStatus = "aguardando_reavaliacao";
      const statusAnterior = pacienteData.status;

      const updateData = {
        lastUpdate: serverTimestamp(),
        solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
      };

      if (pacienteData.status !== novoStatus) {
        updateData.status = novoStatus;
        updateData.statusAnteriorReavaliacao = statusAnterior;
        console.log(
          `Status do paciente ${pacienteId} -> ${novoStatus}. Status anterior (${statusAnterior}) salvo.`
        );
      } else {
        console.log(
          `Paciente ${pacienteId} já aguardava reavaliação. Timestamp atualizado.`
        );
      }

      await updateDoc(pacienteRef, updateData);
    } catch (error) {
      console.error("Erro ao atualizar trilha:", error);
      throw new Error(
        `Falha ao atualizar status para reavaliação: ${error.message}`
      );
    }
  }

  async function processarAprovacaoInclusaoGrade(solicitacao) {
    console.log("Processando aprovação: Inclusão/Alt. Grade", solicitacao);
    const { solicitanteId, pacienteId, pacienteNome, detalhes } = solicitacao;
    if (!solicitanteId || !detalhes) {
      throw new Error("Dados incompletos para processar inclusão na grade.");
    }
    try {
      await atualizarGradeDoProfissional(
        solicitanteId,
        detalhes.diaSemana,
        detalhes.horario,
        detalhes.modalidade || detalhes.tipoAtendimento,
        detalhes.salaAtendimento,
        pacienteId,
        pacienteNome
      );
      console.log(
        `Grade atualizada (ou tentativa realizada) para ${solicitacao.solicitanteNome} via aprovação de solicitação.`
      );
    } catch (error) {
      console.error("Erro ao atualizar a grade via aprovação:", error);
      throw new Error(
        `Falha ao atualizar a grade: ${error.message}. A solicitação foi marcada como 'Aprovada', mas a grade pode não ter sido atualizada.`
      );
    }
  }

  function setupModalFormLogicExclusao() {
    const radioSim = modalBodyContent.querySelector("#radioExcluidoSim");
    const radioNao = modalBodyContent.querySelector("#radioExcluidoNao");
    const camposSim = modalBodyContent.querySelector("#campos-feedback-sim");
    const camposNao = modalBodyContent.querySelector("#campos-feedback-nao");

    if (!radioSim || !radioNao || !camposSim || !camposNao) {
      console.warn(
        "Elementos do form de exclusão não encontrados no HTML carregado."
      );
      return;
    }

    const toggleFields = () => {
      if (camposSim)
        camposSim.style.display = radioSim.checked ? "block" : "none";
      if (camposNao)
        camposNao.style.display = radioNao.checked ? "block" : "none";

      const dataExclusaoInput = camposSim?.querySelector("#dataExclusao");
      const mensagemAdminInput = camposSim?.querySelector("#mensagemAdmin");
      const motivoRejeicaoInput = camposNao?.querySelector("#motivoRejeicao");

      if (dataExclusaoInput) dataExclusaoInput.required = radioSim.checked;
      if (mensagemAdminInput) mensagemAdminInput.required = radioSim.checked;
      if (motivoRejeicaoInput) motivoRejeicaoInput.required = radioNao.checked;
    };

    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields();
  }

  async function handleSalvarExclusao(docId, solicitacaoData) {
    const saveButton = document.getElementById("btn-salvar-exclusao");
    if (!saveButton) return;
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="loading-spinner-small"></span> Salvando...`;

    const foiExcluido = modalBodyContent.querySelector(
      'input[name="foiExcluido"]:checked'
    )?.value;
    const dataExclusaoInput =
      modalBodyContent.querySelector("#dataExclusao")?.value;
    const mensagemAdmin =
      modalBodyContent.querySelector("#mensagemAdmin")?.value;
    const motivoRejeicao =
      modalBodyContent.querySelector("#motivoRejeicao")?.value;

    try {
      if (!foiExcluido)
        throw new Error(
          "Selecione se o(s) horário(s) foi(ram) excluído(s) da grade ('Sim' ou 'Não')."
        );

      let statusFinal = "";
      const adminFeedback = {
        foiExcluido: foiExcluido,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
        dataExclusao: null,
        mensagemAdmin: null,
        motivoRejeicao: null,
      };

      if (foiExcluido === "sim") {
        if (!dataExclusaoInput || !mensagemAdmin)
          throw new Error(
            "Para 'Sim', a data da exclusão e uma mensagem para o voluntário são obrigatórias."
          );
        statusFinal = "Concluída";
        try {
          const dateObj = new Date(dataExclusaoInput + "T12:00:00Z");
          if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
          adminFeedback.dataExclusao = Timestamp.fromDate(dateObj);
        } catch (dateError) {
          throw new Error("Formato da data inválido. Use AAAA-MM-DD.");
        }
        adminFeedback.mensagemAdmin = mensagemAdmin;

        const horariosParaExcluir =
          solicitacaoData.detalhes?.horariosParaExcluir || [];
        if (horariosParaExcluir.length > 0) {
          console.log(
            `Tentando excluir horários da grade para ${solicitacaoData.solicitanteNome}...`
          );
          await excluirHorariosDaGrade(
            solicitacaoData.solicitanteId,
            horariosParaExcluir
          );
          console.log("Exclusão da grade concluída (ou tentativa realizada).");
        } else {
          console.warn(
            "Nenhum horário especificado para exclusão na solicitação:",
            docId
          );
        }
      } else {
        if (!motivoRejeicao)
          throw new Error("Para 'Não', o motivo da rejeição é obrigatório.");
        statusFinal = "Rejeitada";
        adminFeedback.motivoRejeicao = motivoRejeicao;
      }

      const docRef = doc(dbInstance, "solicitacoes", docId);
      await updateDoc(docRef, {
        status: statusFinal,
        adminFeedback: adminFeedback,
      });

      console.log(
        `Solicitação de exclusão ${docId} atualizada para ${statusFinal}`
      );
      alert("Resposta salva com sucesso!");
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar exclusão:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  }

  async function handleNotificarContrato(
    pacienteId,
    pacienteNome,
    profissionalId,
    profissionalNome
  ) {
    console.log(
      `Notificar ${profissionalNome} (ID: ${profissionalId}) sobre contrato de ${pacienteNome}`
    );
    const confirmacao = confirm(
      `Enviar lembrete via WhatsApp para ${profissionalNome} sobre o contrato pendente do paciente ${pacienteNome}?`
    );
    if (!confirmacao) {
      console.log("Notificação WhatsApp cancelada.");
      return;
    }

    try {
      const userDocRef = doc(dbInstance, "usuarios", profissionalId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error(
          `Usuário profissional com ID ${profissionalId} não encontrado.`
        );
      }

      const userData = userDocSnap.data();
      let telefone = userData.contato || userData.telefone || userData.celular;

      if (!telefone) {
        throw new Error(`Telefone não cadastrado para ${profissionalNome}.`);
      }

      let numeroLimpo = String(telefone).replace(/\D/g, "");
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = "55" + numeroLimpo;
      } else if (
        numeroLimpo.startsWith("55") &&
        (numeroLimpo.length === 12 || numeroLimpo.length === 13)
      ) {
      } else {
        if (!numeroLimpo.startsWith("55")) {
          numeroLimpo = "55" + numeroLimpo;
          console.warn(
            `Formato de telefone incerto para ${profissionalNome}, adicionando 55: ${telefone} -> ${numeroLimpo}`
          );
        }
        if (numeroLimpo.length < 12) {
          throw new Error(
            `Formato de telefone inválido ou incompleto para ${profissionalNome}: ${telefone}`
          );
        }
      }

      const mensagem = `Olá ${profissionalNome}. Lembrete: O contrato terapêutico do paciente ${pacienteNome} está pendente de envio/assinatura. Por favor, verifique.`;
      const mensagemCodificada = encodeURIComponent(mensagem);
      const whatsappUrl = `https://wa.me/${numeroLimpo}?text=${mensagemCodificada}`;

      window.open(whatsappUrl, "_blank");
      console.log("Link do WhatsApp aberto:", whatsappUrl);
      alert(`Abrindo WhatsApp para enviar lembrete para ${profissionalNome}.`);
    } catch (error) {
      console.error("Erro ao tentar notificar via WhatsApp:", error);
      alert(`Erro ao notificar: ${error.message}`);
    }
  }

  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
    if (modalBodyContent) modalBodyContent.innerHTML = "";
    if (modalFooterActions) modalFooterActions.innerHTML = "";
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn);
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação";
  }

  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadEncaminhamentos();
  loadStatusContratos();
  loadExclusaoHorarios();

  if (tabContentContainer) {
    console.log(
      "Listener de clique principal anexado a #tab-content-container."
    );
    tabContentContainer.addEventListener("click", async (e) => {
      const processarButton = e.target.closest(".btn-processar-solicitacao");
      if (processarButton) {
        e.preventDefault();
        const docId = processarButton.dataset.docId;
        const tipo = processarButton.dataset.tipo;
        if (docId && tipo) {
          console.log(`Processar: ID=${docId}, Tipo=${tipo}`);
          openGenericSolicitacaoModal(docId, tipo);
        } else {
          console.error(
            "Dados incompletos no botão processar:",
            processarButton.dataset
          );
          alert("Erro: Não foi possível identificar a solicitação.");
        }
      }

      const notificarButton = e.target.closest(".btn-notificar-contrato");
      if (notificarButton) {
        e.preventDefault();
        const pacienteId = notificarButton.dataset.pacienteId;
        const pacienteNome = notificarButton.dataset.pacienteNome;
        const profissionalId = notificarButton.dataset.profissionalId;
        const profissionalNome = notificarButton.dataset.profissionalNome;

        if (
          !profissionalId ||
          profissionalId === "null" ||
          profissionalId === "undefined"
        ) {
          console.error("ID Profissional inválido:", notificarButton.dataset);
          alert("Erro: ID do profissional não encontrado.");
          return;
        }
        handleNotificarContrato(
          pacienteId,
          pacienteNome,
          profissionalId,
          profissionalNome
        );
      }
    });
  } else {
    console.error("FALHA CRÍTICA: #tab-content-container não encontrado.");
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  else console.warn("Botão fechar modal (X) não encontrado.");
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  else console.warn("Botão cancelar modal não encontrado.");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  } else {
    console.error(
      "Elemento modal principal #solicitacao-details-modal não encontrado."
    );
  }
}
