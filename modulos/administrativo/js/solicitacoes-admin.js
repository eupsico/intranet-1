// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO MODIFICADA PARA NOVAS SESSÕES (Corrigida) ---
// *** ALTERAÇÃO: Adicionado campo condicional 'Número de Sessões' e verificações de segurança ***

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc, // Para atualizar a grade
  addDoc, // Para criar sessões
  serverTimestamp,
  onSnapshot,
  Timestamp,
  writeBatch, // Para criar múltiplas sessões atomicamente
} from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser;
let dadosDaGradeAdmin = {}; // Variável global para armazenar dados da grade
let salasPresenciaisAdmin = []; // Variável global para salas

// --- Funções Auxiliares ---
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  // Tenta converter string YYYY-MM-DD
  if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    try {
      // Adiciona T03:00:00 para tentar ajustar fuso local (Brasília) se a data original não tiver hora
      const date = new Date(timestamp + "T03:00:00");
      // Verifica se a data é válida antes de formatar
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) {
      console.warn("Erro ao formatar data string:", timestamp, e);
      // Ignora erro e retorna N/A
    }
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
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
  };
  return mapaTipos[tipoInterno] || tipoInterno;
}

// Função para carregar dados da grade (chamada no init)
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

// Função para carregar salas (chamada no init ou ao abrir modal)
async function carregarSalasDoFirebase() {
  if (salasPresenciaisAdmin.length > 0) return; // Já carregou
  try {
    const configRef = doc(dbInstance, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists() && docSnap.data().listas?.salasPresenciais) {
      salasPresenciaisAdmin = docSnap.data().listas.salasPresenciais;
      console.log("Salas presenciais carregadas:", salasPresenciaisAdmin);
    } else {
      console.warn(
        "Lista de salas presenciais não encontrada nas configurações."
      );
      salasPresenciaisAdmin = [];
    }
  } catch (error) {
    console.error("Erro ao carregar salas:", error);
    salasPresenciaisAdmin = [];
  }
}

// Função principal de inicialização
export async function init(db_ignored, user, userData) {
  // Adicionado async
  console.log(
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.NOVAS_SESSOES iniciado."
  );
  adminUser = userData;

  // Carregar dados da grade e salas no início
  await loadGradeDataAdmin();
  await carregarSalasDoFirebase();

  // --- Seletores DOM (mantidos) ---
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

  // --- Configuração Abas (mantida) ---
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
    // Ativa a primeira aba por padrão se nenhuma estiver ativa
    if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
      tabLinks[0].click();
    }
  }

  // --- Função Genérica: Carregar Solicitações (mantida) ---
  function loadSolicitacoesPorTipo(
    tipoSolicitacao,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRowFunction,
    colspan = 7
  ) {
    console.log(`Carregando [${tipoSolicitacao}] da coleção 'solicitacoes'...`);
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

      const unsubscribe = onSnapshot(
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
                // Garante que é um elemento DOM
                tableBody.appendChild(tr);
              } else {
                console.warn("Função renderRow não retornou um Node:", tr);
                // Tentar adicionar como string (fallback)
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
          emptyState.style.display = "none";
          countBadge.style.display = "none";
        }
      );
      // TODO: Gerenciar unsubscribe quando a página/módulo for descarregado
      // Ex: armazenar unsubscribes em um array e chamar unsubscribe() para cada um
    } catch (error) {
      console.error(
        `Falha ao construir query para [${tipoSolicitacao}]:`,
        error
      );
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Falha na query. Verifique o nome da coleção e índices.</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
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

  // As funções abaixo (loadReavaliacao, loadInclusaoAlteracaoGradePB)
  // não têm tabelas correspondentes no HTML fornecido (solicitacoes-admin.html),
  // então elas irão falhar ou não fazer nada se os IDs não existirem.

  function loadReavaliacao() {
    loadSolicitacoesPorTipo(
      "reavaliacao",
      "table-body-reavaliacao", // ID da tabela não existe no HTML fornecido
      "empty-state-reavaliacao", // ID não existe
      "count-reavaliacao", // ID não existe
      renderReavaliacaoRow,
      8
    );
  }
  function loadInclusaoAlteracaoGradePB() {
    loadSolicitacoesPorTipo(
      "inclusao_alteracao_grade",
      "table-body-inclusao-grade-pb", // ID da tabela não existe no HTML fornecido
      "empty-state-inclusao-grade-pb", // ID não existe
      "count-inclusao-grade-pb", // ID não existe
      renderInclusaoAlteracaoGradePBRow,
      10
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
    console.log("Carregando Status Contratos...");
    const tableBodyId = "table-body-status-contratos";
    const emptyStateId = "empty-state-status-contratos";
    const countBadgeId = "count-status-contratos";
    const colspan = 5; // Inclui Ações

    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) {
      console.error("Elementos do DOM não encontrados para Status Contratos.");
      return;
    }

    tableBody.innerHTML = `<tr><td colspan="${colspan}"><div class="loading-spinner-small" style="margin: 10px auto;"></div> Buscando pacientes...</td></tr>`;
    emptyState.style.display = "none";
    countBadge.style.display = "none";
    countBadge.textContent = "0";

    try {
      // Query mais eficiente: buscar apenas pacientes com atendimentosPB
      const qCombined = query(collection(dbInstance, "trilhaPaciente"));
      const snapshot = await getDocs(qCombined);

      let pendingContracts = [];
      snapshot.forEach((doc) => {
        const pacienteId = doc.id;
        const pacienteData = doc.data();

        // Verificar se o status é relevante (opcional, mas bom para performance)
        if (
          !["em_atendimento_pb", "cadastrar_horario_psicomanager"].includes(
            pacienteData.status
          )
        ) {
          return; // Pula paciente se não estiver em um status relevante
        }

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
              lastUpdate: pacienteData.lastUpdate, // Para ordenação ou info
            });
          }
        });
      });

      // Ordenar por nome do paciente
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
                        <td>
                            <button class="action-button btn-notificar-contrato"
                                    data-paciente-id="${item.pacienteId}" data-paciente-nome="${item.pacienteNome}"
                                    data-profissional-id="${item.profissionalId}" data-profissional-nome="${item.profissionalNome}"
                                    title="Notificar profissional sobre contrato pendente via WhatsApp">
                                Notificar
                            </button>
                        </td>`;
          tableBody.appendChild(tr);
        });
      }
    } catch (error) {
      console.error("Erro ao carregar status de contratos:", error);
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  }

  // --- Funções de Renderização (mantidas) ---
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
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="novas_sessoes">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
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
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="alteracao_horario">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
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
            <td class="motivo-cell">${
              detalhes.motivo || detalhes.motivoEncaminhamento || "N/A"
            }</td>
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="desfecho">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
        `;
    return tr;
  }
  function renderReavaliacaoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const pref = detalhes.preferenciaAgendamento || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataPrefFormatada = pref.data ? formatarData(pref.data) : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${dataSol}</td>
            <td>${data.solicitanteNome || "N/A"}</td>
            <td>${data.pacienteNome || "N/A"}</td>
            <td>${detalhes.valorContribuicaoAtual || "N/A"}</td>
            <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
             <td>${dataPrefFormatada} ${pref.hora || ""} (${
      pref.modalidade || "N/A"
    })</td>
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="reavaliacao">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
        `;
    return tr;
  }
  function renderInclusaoAlteracaoGradePBRow(data, docId) {
    // Colspan 10 (9 colunas de dados + 1 ações)
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioFormatada = detalhes.dataInicio
      ? formatarData(detalhes.dataInicio)
      : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
                  <td>${dataSol}</td>
                  <td>${data.solicitanteNome || "N/A"}</td>
                  <td>${data.pacienteNome || "N/A"}</td>
                  <td>${detalhes.diaSemana || "N/A"}</td>
                  <td>${detalhes.horario || "N/A"}</td>
                  <td>${
                    detalhes.modalidade || detalhes.tipoAtendimento || "N/A"
                  }</td>
                  <td>${detalhes.salaAtendimento || "N/A"}</td>
                  <td>${dataInicioFormatada}</td>
                  <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
                  <td>
                      <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="inclusao_alteracao_grade">
                          ${data.status === "Pendente" ? "Processar" : "Ver"}
                      </button>
                  </td>
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
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="exclusao_horario">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
        `;
    return tr;
  }

  // --- Lógica do Modal Genérico (Ajustada para novas sessões) ---
  async function openGenericSolicitacaoModal(docId, tipo) {
    console.log(`Abrindo modal para ${tipo}, ID: ${docId}`);
    modalTitle.textContent = `Processar Solicitação (${formatarTipoSolicitacao(
      tipo
    )})`;
    modalBodyContent.innerHTML = '<div class="loading-spinner"></div>';
    modalFooterActions.innerHTML = ""; // Limpa botões
    modalFooterActions.appendChild(modalCancelBtn); // Adiciona Cancelar
    openModal();

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Solicitação não encontrada!");
      const solicitacaoData = { id: docSnap.id, ...docSnap.data() }; // Inclui ID

      let modalHtmlPath = `../page/`; // Caminho relativo ao JS
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

      console.log("Tentando carregar modal de:", modalHtmlPath);
      const response = await fetch(modalHtmlPath);
      if (!response.ok)
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}). Caminho: ${modalHtmlPath}`
        );

      modalBodyContent.innerHTML = await response.text();

      // Preenche os campos COMUNS e específicos
      preencherCamposModal(tipo, solicitacaoData);

      // Configura os botões e lógica específica (Aprovar/Rejeitar/Salvar)
      configurarAcoesModal(docId, tipo, solicitacaoData);

      // Adiciona lógica JS específica APÓS carregar o HTML do modal
      if (tipo === "novas_sessoes") {
        setupModalLogicNovasSessoes(solicitacaoData); // Configura listeners do novo form
      } else if (tipo === "exclusao_horario") {
        setupModalFormLogicExclusao(); // Configura listeners do form de exclusão
      }
    } catch (error) {
      console.error("Erro ao abrir modal genérico:", error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes: ${error.message}</p>`;
      modalFooterActions.innerHTML = ""; // Limpa botões se deu erro
      modalFooterActions.appendChild(modalCancelBtn); // Deixa só o Cancelar
    }
  }

  // --- Funções Auxiliares do Modal (Ajustada para novas sessões) ---
  function preencherCamposModal(tipo, data) {
    const detalhes = data.detalhes || {};

    // Campos comuns
    setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
    setValueIfExists("#modal-solicitante-id", data.solicitanteId); // Guarda ID do solicitante
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
          // ***** NOVO: Preenche a recorrência solicitada *****
          setTextContentIfExists(
            "#modal-ns-recorrencia",
            detalhes.recorrenciaSolicitada || "N/A"
          ); // (Aguardando este campo vir do detalhe-paciente)
          // *************************************************

          // Preenche campo readonly do profissional no novo form
          setValueIfExists("#admin-ag-profissional-nome", data.solicitanteNome);
          // Carrega as salas no dropdown
          carregarSalasDropdownAdmin(); // Chama função para popular o select
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
          setTextContentIfExists(
            "#modal-df-motivo",
            detalhes.motivo || detalhes.motivoEncaminhamento
          );
          const encDiv = document.getElementById(
            "modal-df-encaminhamento-details"
          );
          if (detalhes.tipoDesfecho === "Encaminhamento" && encDiv) {
            encDiv.style.display = "block";
            setTextContentIfExists(
              "#modal-df-enc-servico",
              detalhes.servicoEncaminhado
            );
            setTextContentIfExists(
              "#modal-df-enc-motivo",
              detalhes.motivoEncaminhamento
            );
            setTextContentIfExists(
              "#modal-df-enc-demanda",
              detalhes.demandaPaciente
            );
            setTextContentIfExists(
              "#modal-df-enc-continua",
              detalhes.continuaAtendimentoEuPsico
            );
            setTextContentIfExists("#modal-df-enc-relato", detalhes.relatoCaso);
          } else if (encDiv) {
            encDiv.style.display = "none";
          }
          setTextContentIfExists("#modal-df-obs", detalhes.observacoesGerais);
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
          ); // Repetido, mas ok
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
          } else {
            console.warn("Elemento #modal-horarios-list não encontrado.");
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

    // Exibir feedback anterior (mantido)
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
      // Desabilitar inputs/textareas da resposta se já foi respondido
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = true));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = true)); // Para outros tipos
      // Para exclusão
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
      // Habilitar campos se for pendente
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = false));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = false));
      // Para exclusão
      modalBodyContent
        .querySelectorAll(
          'input[name="foiExcluido"], #dataExclusao, #mensagemAdmin, #motivoRejeicao'
        )
        .forEach((el) => (el.disabled = false));
      // Reaplicar lógica de habilitação da sala em novas sessões
      const tipoSessaoSelect = modalBodyContent.querySelector(
        "#admin-ag-tipo-sessao"
      );
      if (tipoSessaoSelect) tipoSessaoSelect.dispatchEvent(new Event("change")); // Dispara change para ajustar estado inicial
      // Ajustar estado inicial para exclusão
      if (tipo === "exclusao_horario") {
        setupModalFormLogicExclusao(); // Garante que a lógica de show/hide seja aplicada
      }
    }
  }
  // --- Funções auxiliares para preencher/setar valor (mantidas) ---
  function setTextContentIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    // Usa ?? 'N/A' para tratar null e undefined como 'N/A'
    if (element) element.textContent = value ?? "N/A";
    else console.warn(`Elemento não encontrado para setText: ${selector}`);
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    // Usa ?? '' para tratar null e undefined como string vazia
    if (element) element.value = value ?? "";
    else console.warn(`Elemento não encontrado para setValue: ${selector}`);
  }

  // --- Configura Ações e Handlers do Modal (Ajustada para novas sessões) ---
  function configurarAcoesModal(docId, tipo, data) {
    modalFooterActions.innerHTML = ""; // Limpa
    modalFooterActions.appendChild(modalCancelBtn); // Adiciona Cancelar

    if (data.status === "Pendente") {
      if (tipo === "novas_sessoes") {
        // Botões específicos para Novas Sessões
        const approveButtonNs = document.createElement("button");
        approveButtonNs.type = "button";
        approveButtonNs.id = "btn-aprovar-novas-sessoes";
        approveButtonNs.className = "action-button success dynamic-action-btn";
        approveButtonNs.textContent = "Aprovar e Agendar";
        approveButtonNs.onclick = () =>
          handleNovasSessoesAction(docId, "Aprovada", data); // Chama handler específico
        modalFooterActions.appendChild(approveButtonNs);

        const rejectButtonNs = document.createElement("button");
        rejectButtonNs.type = "button";
        rejectButtonNs.id = "btn-rejeitar-novas-sessoes";
        rejectButtonNs.className = "action-button error dynamic-action-btn";
        rejectButtonNs.textContent = "Rejeitar";
        rejectButtonNs.onclick = () =>
          handleNovasSessoesAction(docId, "Rejeitada", data); // Chama handler específico
        modalFooterActions.appendChild(rejectButtonNs);
      } else if (tipo === "exclusao_horario") {
        // Botão Salvar para Exclusão
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "btn-salvar-exclusao";
        saveButton.className = "action-button dynamic-action-btn";
        saveButton.textContent = "Salvar Resposta (Exclusão)";
        saveButton.onclick = () => handleSalvarExclusao(docId, data); // Handler específico de exclusão
        modalFooterActions.appendChild(saveButton);
        // setupModalFormLogicExclusao() é chamado após preencher os campos
      } else {
        // Botões Genéricos Aprovar/Rejeitar para os outros tipos
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

        // Mostra campo de mensagem genérico (se existir no HTML carregado)
        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        );
        if (adminMessageGroup) {
          adminMessageGroup.style.display = "block";
          const adminMessageText = adminMessageGroup.querySelector(
            "#admin-message-text"
          );
          if (adminMessageText) adminMessageText.value = ""; // Limpa
        } else {
          // console.warn("#modal-admin-message-group não encontrado para tipo:", tipo);
          // Isso é esperado para novas_sessoes e exclusao, que têm seus próprios campos
        }
      }
    } else {
      // Se não está Pendente (já foi respondido)
      // Nenhum botão de ação, apenas o Cancelar já adicionado
      // Esconde o grupo de mensagem genérico se existir
      const adminMessageGroup = document.getElementById(
        "modal-admin-message-group"
      );
      if (adminMessageGroup) adminMessageGroup.style.display = "none";
    }
  }

  // --- Handler GENÉRICO para Aprovar/Rejeitar (NÃO usado para novas_sessoes e exclusao) ---
  async function handleGenericSolicitacaoAction(
    docId,
    tipo,
    novoStatus,
    solicitacaoData
  ) {
    const mensagemAdminInput = document.getElementById("admin-message-text"); // Campo genérico
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";

    if (novoStatus === "Rejeitada" && !mensagemAdmin) {
      alert("Forneça o motivo da rejeição.");
      mensagemAdminInput?.focus();
      return;
    }

    // Desabilitar botões e mostrar loading
    const approveButton = document.getElementById("btn-aprovar-solicitacao");
    const rejectButton = document.getElementById("btn-rejeitar-solicitacao");
    if (approveButton) approveButton.disabled = true;
    if (rejectButton) rejectButton.disabled = true;
    const clickedButton = document.getElementById(
      novoStatus === "Aprovada"
        ? "btn-aprovar-solicitacao"
        : "btn-rejeitar-solicitacao"
    );
    if (clickedButton)
      clickedButton.innerHTML = `<span class="loading-spinner-small"></span> Processando...`;

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const adminFeedback = {
        statusFinal: novoStatus,
        mensagemAdmin: mensagemAdmin, // Usa o campo genérico
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

      // Executar ações pós-aprovação
      if (novoStatus === "Aprovada") {
        console.log("Executando ações pós-aprovação para:", tipo);
        switch (tipo) {
          case "alteracao_horario":
            await processarAprovacaoAlteracaoHorario(solicitacaoData);
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
          // Não inclui novas_sessoes e exclusao aqui
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
      // Reabilitar botões
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  }

  // --- Funções de Processamento Pós-Aprovação (mantidas) ---
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
      const atendimentosPB = [...(pacienteData.atendimentosPB || [])]; // Cria cópia
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );

      const nomeCampoHorario = "horarioSessoes"; // Assumindo este nome
      const horarioAtualizado = {
        ...(atendimentosPB[index][nomeCampoHorario] || {}), // Preserva dados existentes
        diaSemana: novosDados.dia,
        horario: novosDados.horario,
        tipoAtendimento: novosDados.modalidade,
        frequencia: novosDados.frequencia,
        salaAtendimento: novosDados.sala,
        dataInicio: novosDados.dataInicio, // A data de início pode precisar ser validada/ajustada
        ultimaAlteracaoAprovadaEm: serverTimestamp(), // Rastreia aprovação
      };

      atendimentosPB[index][nomeCampoHorario] = horarioAtualizado;

      await updateDoc(pacienteRef, {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Horário atualizado na trilha para paciente ${pacienteId}, atendimento ${atendimentoId}.`
      );

      // --- Ação na Grade ---
      if (novosDados.alterarGrade === "Sim") {
        console.log(
          `Tentando atualizar grade para profissional ${solicitacao.solicitanteId}`
        );
        // É necessário o ID do profissional (solicitanteId)
        await atualizarGradeDoProfissional(
          solicitacao.solicitanteId, // ID do profissional
          novosDados.dia, // 'segunda', 'terca', etc. (Vem como 'Segunda-feira')
          novosDados.horario, // 'HH:MM'
          novosDados.modalidade, // 'Online' ou 'Presencial'
          novosDados.sala, // Nome da sala ou 'Online'
          pacienteId, // ID do paciente para registrar na grade
          pacienteData.nomeCompleto || solicitacao.pacienteNome // Nome do paciente
        );
        console.log(
          `Grade atualizada (ou tentativa realizada) para ${solicitacao.solicitanteNome}.`
        );
      } else {
        console.log("Alteração na grade não solicitada.");
      }
    } catch (error) {
      console.error("Erro ao atualizar trilha ou grade:", error);
      // Lançar erro para que a mensagem de falha geral seja exibida
      throw new Error(
        `Falha ao atualizar dados do paciente ou grade: ${error.message}`
      );
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
      const atendimentosPB = [...(pacienteData.atendimentosPB || [])]; // Copia
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );

      const nomeCampoStatusAtendimento = "statusAtendimento";
      let novoStatusAtendimento = "";
      let novoStatusPaciente = pacienteData.status; // Mantém o status atual por padrão

      switch (tipoDesfecho) {
        case "Alta":
          novoStatusAtendimento = "concluido_alta";
          novoStatusPaciente = "alta";
          break;
        case "Desistencia":
          novoStatusAtendimento = "concluido_desistencia";
          novoStatusPaciente = "desistencia";
          break;
        case "Encaminhamento":
          novoStatusAtendimento = "concluido_encaminhamento";
          // Muda status do paciente apenas se ele NÃO continuar na EuPsico
          if (detalhes.continuaAtendimentoEuPsico === "Não") {
            // Poderia ser um status mais específico como 'encaminhado_externo' se existir
            novoStatusPaciente = "encaminhado_externo"; // Ou manter 'alta'/'desistencia' dependendo do fluxo?
          } else {
            // Se continua, o status geral do paciente pode precisar de outra lógica
            // Talvez voltar para 'aguardando_vaga' ou outro? Depende da regra.
            // Por ora, se continua, não muda o status GERAL do paciente aqui.
            novoStatusPaciente = pacienteData.status;
          }
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      // Atualiza o atendimento específico
      atendimentosPB[index][nomeCampoStatusAtendimento] = novoStatusAtendimento;
      // Armazena todos os detalhes do desfecho no atendimento
      atendimentosPB[index].desfecho = {
        ...detalhes, // Inclui motivo, serviço encaminhado, etc.
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };

      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      };
      // Atualiza o status GERAL do paciente SOMENTE se ele mudou
      if (novoStatusPaciente !== pacienteData.status) {
        updateData.status = novoStatusPaciente;
      }

      await updateDoc(pacienteRef, updateData);
      console.log(
        `Desfecho registrado na trilha para ${pacienteId}. Status Paciente: ${
          updateData.status || pacienteData.status
        }`
      );

      // AÇÃO NECESSÁRIA PÓS-DESFECHO: Liberar horário na grade?
      const horarioParaLiberar = atendimentosPB[index].horarioSessoes;
      const profissionalId = atendimentosPB[index].profissionalId;
      if (horarioParaLiberar && profissionalId) {
        console.warn(
          `AÇÃO NECESSÁRIA: Liberar horário na grade para ${profissionalId}: ${horarioParaLiberar.diaSemana}, ${horarioParaLiberar.horario}, ${horarioParaLiberar.tipoAtendimento}, ${horarioParaLiberar.salaAtendimento}`
        );
        // Implementar a chamada para a função que limpa a grade aqui
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

      const novoStatus = "aguardando_reavaliacao"; // Status para indicar que o SS precisa agendar
      const statusAnterior = pacienteData.status; // Guarda o status atual

      const updateData = {
        lastUpdate: serverTimestamp(),
        solicitacaoReavaliacaoAprovadaEm: serverTimestamp(), // Marca quando foi aprovado
      };

      // Atualiza o status principal apenas se for diferente, e guarda o anterior
      if (pacienteData.status !== novoStatus) {
        updateData.status = novoStatus;
        updateData.statusAnteriorReavaliacao = statusAnterior; // Campo para guardar o status anterior
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
    // Aqui, a ação principal é atualizar a grade. A solicitação é apenas uma confirmação.
    const { solicitanteId, pacienteId, pacienteNome, detalhes } = solicitacao;
    if (!solicitanteId || !detalhes) {
      throw new Error("Dados incompletos para processar inclusão na grade.");
    }
    try {
      await atualizarGradeDoProfissional(
        solicitanteId,
        detalhes.diaSemana, // 'Segunda-feira', etc.
        detalhes.horario, // 'HH:MM'
        detalhes.modalidade || detalhes.tipoAtendimento, // Usar um dos dois
        detalhes.salaAtendimento,
        pacienteId,
        pacienteNome
      );
      console.log(
        `Grade atualizada (ou tentativa realizada) para ${solicitacao.solicitanteNome} via aprovação de solicitação.`
      );
      // Não precisa alterar a trilha do paciente aqui, pois isso já foi feito
      // quando o voluntário informou os horários no modal dele.
    } catch (error) {
      console.error("Erro ao atualizar a grade via aprovação:", error);
      throw new Error(
        `Falha ao atualizar a grade: ${error.message}. A solicitação foi marcada como 'Aprovada', mas a grade pode não ter sido atualizada.`
      );
    }
  }

  // --- Lógica Específica Modal Exclusão Horário (mantida) ---
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
      // Garante que os containers existem antes de tentar acessar style
      if (camposSim)
        camposSim.style.display = radioSim.checked ? "block" : "none";
      if (camposNao)
        camposNao.style.display = radioNao.checked ? "block" : "none";

      // Ajustar 'required' dinamicamente
      const dataExclusaoInput = camposSim?.querySelector("#dataExclusao");
      const mensagemAdminInput = camposSim?.querySelector("#mensagemAdmin");
      const motivoRejeicaoInput = camposNao?.querySelector("#motivoRejeicao");

      if (dataExclusaoInput) dataExclusaoInput.required = radioSim.checked;
      if (mensagemAdminInput) mensagemAdminInput.required = radioSim.checked;
      if (motivoRejeicaoInput) motivoRejeicaoInput.required = radioNao.checked;
    };

    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields(); // Chama para estado inicial
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
        foiExcluido: foiExcluido, // 'sim' ou 'nao'
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
        dataExclusao: null, // Inicializa como null
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
          // Converte a data para Timestamp do Firebase
          const dateObj = new Date(dataExclusaoInput + "T12:00:00Z"); // Adiciona hora para evitar problemas de fuso
          if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
          adminFeedback.dataExclusao = Timestamp.fromDate(dateObj);
        } catch (dateError) {
          throw new Error("Formato da data inválido. Use AAAA-MM-DD.");
        }
        adminFeedback.mensagemAdmin = mensagemAdmin;

        // --- AÇÃO NA GRADE ---
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
        // foiExcluido === 'nao'
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

  // --- Função para Notificar Contrato (mantida) ---
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
      // 1. Buscar o telefone do profissional
      const userDocRef = doc(dbInstance, "usuarios", profissionalId); // Assumindo coleção 'usuarios'
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error(
          `Usuário profissional com ID ${profissionalId} não encontrado.`
        );
      }

      const userData = userDocSnap.data();
      // Tentar múltiplos campos de telefone
      let telefone = userData.contato || userData.telefone || userData.celular; // Adicionar outros campos se houver

      if (!telefone) {
        throw new Error(`Telefone não cadastrado para ${profissionalNome}.`);
      }

      // 2. Limpar e formatar o número
      let numeroLimpo = String(telefone).replace(/\D/g, ""); // Garante que é string
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        // Formato nacional
        numeroLimpo = "55" + numeroLimpo;
      } else if (
        numeroLimpo.startsWith("55") &&
        (numeroLimpo.length === 12 || numeroLimpo.length === 13)
      ) {
        // Já está no formato internacional
      } else {
        // Tenta adicionar 55 mesmo se o formato for incerto (última tentativa)
        if (!numeroLimpo.startsWith("55")) {
          numeroLimpo = "55" + numeroLimpo;
          console.warn(
            `Formato de telefone incerto para ${profissionalNome}, adicionando 55: ${telefone} -> ${numeroLimpo}`
          );
        }
        // Validação final de comprimento pode ser adicionada aqui se necessário
        if (numeroLimpo.length < 12) {
          // 55 + DDD (2) + Numero (min 8)
          throw new Error(
            `Formato de telefone inválido ou incompleto para ${profissionalNome}: ${telefone}`
          );
        }
      }

      // 3. Montar a mensagem
      const mensagem = `Olá ${profissionalNome}. Lembrete: O contrato terapêutico do paciente ${pacienteNome} está pendente de envio/assinatura. Por favor, verifique.`;

      // 4. Codificar a mensagem para URL
      const mensagemCodificada = encodeURIComponent(mensagem);

      // 5. Montar a URL do WhatsApp
      const whatsappUrl = `https://wa.me/${numeroLimpo}?text=${mensagemCodificada}`;

      // 6. Abrir em nova aba
      window.open(whatsappUrl, "_blank");
      console.log("Link do WhatsApp aberto:", whatsappUrl);
      alert(`Abrindo WhatsApp para enviar lembrete para ${profissionalNome}.`);
    } catch (error) {
      console.error("Erro ao tentar notificar via WhatsApp:", error);
      alert(`Erro ao notificar: ${error.message}`);
    }
  }

  // --- Funções Genéricas do Modal (Abrir/Fechar - mantidas) ---
  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
    if (modalBodyContent) modalBodyContent.innerHTML = ""; // Limpa conteúdo
    if (modalFooterActions) modalFooterActions.innerHTML = ""; // Limpa ações
    // Readiciona o botão cancelar ao footer (importante!)
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn);
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação"; // Reseta título
  }

  // --- Inicialização (mantida) ---
  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  // loadReavaliacao(); // Aba não existe
  // loadInclusaoAlteracaoGradePB(); // Aba não existe
  loadStatusContratos();
  loadExclusaoHorarios();

  // --- Listener de Evento Principal (Delegação - mantido) ---
  if (tabContentContainer) {
    console.log(
      "Listener de clique principal anexado a #tab-content-container."
    );
    tabContentContainer.addEventListener("click", async (e) => {
      // Botões "Processar"
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

      // Botões "Notificar Contrato"
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
        ); // Chama a função
      }
    });
  } else {
    console.error("FALHA CRÍTICA: #tab-content-container não encontrado.");
  }

  // --- Event Listeners do Modal (Fechar/Cancelar - mantidos) ---
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  else console.warn("Botão fechar modal (X) não encontrado.");
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  else console.warn("Botão cancelar modal não encontrado.");
  if (modal) {
    modal.addEventListener("click", (event) => {
      // Fecha se clicar no overlay (fundo escuro), mas não no content
      if (event.target === modal) closeModal();
    });
  } else {
    console.error(
      "Elemento modal principal #solicitacao-details-modal não encontrado."
    );
  }

  // --- Funções Adicionais para Novas Sessões ---

  // Popula o dropdown de salas no modal
  function carregarSalasDropdownAdmin() {
    const salaSelect = modalBodyContent.querySelector("#admin-ag-sala");
    if (!salaSelect) {
      console.warn(
        "Dropdown de sala (#admin-ag-sala) não encontrado no modal."
      );
      return;
    }
    salaSelect.innerHTML = '<option value="">Selecione...</option>'; // Limpa e adiciona padrão
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    salasPresenciaisAdmin.forEach((sala) => {
      // Garante que não duplique 'Online' e que a sala não seja vazia
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
    // Pré-selecionar 'Online' se for o caso (será feito no setupModalLogic)
  }

  // Configura listeners e lógica inicial do form de agendamento do admin
  function setupModalLogicNovasSessoes(solicitacaoData) {
    const formAgendamento = modalBodyContent.querySelector(
      "#admin-agendamento-form"
    );
    if (!formAgendamento) {
      console.error(
        "Formulário #admin-agendamento-form não encontrado no modal."
      );
      return;
    }

    const dataInicioInput = formAgendamento.querySelector(
      "#admin-ag-data-inicio"
    );
    const horaInicioInput = formAgendamento.querySelector(
      "#admin-ag-hora-inicio"
    );
    const horaFimInput = formAgendamento.querySelector("#admin-ag-hora-fim");
    const tipoSessaoSelect = formAgendamento.querySelector(
      "#admin-ag-tipo-sessao"
    );
    const salaSelect = formAgendamento.querySelector("#admin-ag-sala");
    const feedbackDiv = formAgendamento.querySelector("#agendamento-feedback");
    const solicitanteIdInput = modalBodyContent.querySelector(
      "#modal-solicitante-id"
    ); // Pega ID do profissional

    // ***** NOVOS SELETORES *****
    const recorrenciaSelect = formAgendamento.querySelector(
      "#admin-ag-recorrencia"
    );
    const quantidadeContainer = formAgendamento.querySelector(
      "#admin-ag-quantidade-container"
    );
    const quantidadeInput = formAgendamento.querySelector(
      "#admin-ag-quantidade"
    );
    // ***************************

    // 1. Preencher valores com base na solicitação (se existirem)
    if (solicitacaoData.detalhes?.dataInicioPreferencial) {
      dataInicioInput.value = solicitacaoData.detalhes.dataInicioPreferencial;
    }
    if (solicitacaoData.detalhes?.horario) {
      horaInicioInput.value = solicitacaoData.detalhes.horario;
      calcularHoraFim(); // Calcula hora fim inicial
    }
    if (solicitacaoData.detalhes?.modalidade) {
      // Ajusta para 'Online' ou 'Presencial' (capitalizado)
      const modalidade =
        solicitacaoData.detalhes.modalidade.charAt(0).toUpperCase() +
        solicitacaoData.detalhes.modalidade.slice(1).toLowerCase();
      if (tipoSessaoSelect.querySelector(`option[value="${modalidade}"]`)) {
        tipoSessaoSelect.value = modalidade;
      }
    }
    if (solicitacaoData.detalhes?.sala) {
      // Tenta selecionar a sala solicitada, se existir no dropdown
      const salaSolicitada = solicitacaoData.detalhes.sala;
      const optionExists = Array.from(salaSelect.options).some(
        (opt) => opt.value === salaSolicitada
      );
      if (optionExists) {
        salaSelect.value = salaSolicitada;
      } else {
        console.warn(
          `Sala solicitada "${salaSolicitada}" não encontrada no dropdown.`
        );
        // Deixa como "Selecione..." ou seleciona Online se for o caso
        if (solicitacaoData.detalhes.modalidade.toLowerCase() === "online") {
          salaSelect.value = "Online";
        }
      }
    } else if (
      solicitacaoData.detalhes?.modalidade.toLowerCase() === "online"
    ) {
      salaSelect.value = "Online"; // Garante Online se modalidade for Online
    }

    // ***** NOVO: Pré-preenche a recorrência se ela vier da solicitação *****
    if (solicitacaoData.detalhes?.recorrenciaSolicitada) {
      const recorrenciaSolicitada =
        solicitacaoData.detalhes.recorrenciaSolicitada.toLowerCase(); // ex: 'semanal'
      if (
        recorrenciaSelect.querySelector(
          `option[value="${recorrenciaSolicitada}"]`
        )
      ) {
        recorrenciaSelect.value = recorrenciaSolicitada;
      }
    }
    // *******************************************************************

    // 2. Listener para Hora Início -> Calcular Hora Fim
    horaInicioInput.addEventListener("change", calcularHoraFim);

    function calcularHoraFim() {
      const horaInicio = horaInicioInput.value;
      if (horaInicio) {
        try {
          const [horas, minutos] = horaInicio.split(":").map(Number);
          const dataInicio = new Date();
          dataInicio.setHours(horas, minutos, 0, 0);
          dataInicio.setMinutes(dataInicio.getMinutes() + 50); // Adiciona 50 minutos
          const horaFim = dataInicio.toTimeString().substring(0, 5);
          horaFimInput.value = horaFim;
        } catch (e) {
          console.error("Erro ao calcular hora fim:", e);
          horaFimInput.value = ""; // Limpa se der erro
        }
      } else {
        horaFimInput.value = ""; // Limpa se hora início estiver vazia
      }
    }

    // 3. Listener para Tipo Sessão -> Habilitar/Ajustar Sala
    tipoSessaoSelect.addEventListener("change", ajustarSala);

    function ajustarSala() {
      const tipoSelecionado = tipoSessaoSelect.value;
      const isOnline = tipoSelecionado === "Online";
      salaSelect.disabled = isOnline;
      if (isOnline) {
        salaSelect.value = "Online"; // Força 'Online'
      } else {
        // Se era 'Online', limpa para forçar seleção (ou mantém se já era outra sala)
        if (salaSelect.value === "Online") {
          salaSelect.value = "";
        }
      }
      // Valida a grade sempre que o tipo ou sala mudar
      validarGradeAdmin();
    }

    // ***** NOVA LÓGICA: Listener para Recorrência -> Mostrar/Ocultar Quantidade *****
    if (recorrenciaSelect && quantidadeContainer && quantidadeInput) {
      recorrenciaSelect.addEventListener("change", toggleQuantidadeSessoes);

      function toggleQuantidadeSessoes() {
        const recorrencia = recorrenciaSelect.value;
        if (
          recorrencia === "semanal" ||
          recorrencia === "quinzenal" ||
          recorrencia === "mensal"
        ) {
          quantidadeContainer.style.display = "block";
          quantidadeInput.required = true;
        } else {
          // 'unica' ou ''
          quantidadeContainer.style.display = "none";
          quantidadeInput.required = false;
        }
      }
      toggleQuantidadeSessoes(); // Chama para estado inicial
    }
    // **************************************************************************

    // 4. Listeners para validar grade ao mudar campos relevantes
    const camposValidacao = [
      dataInicioInput,
      horaInicioInput,
      tipoSessaoSelect,
      salaSelect,
    ];
    camposValidacao.forEach((input) => {
      if (input) input.addEventListener("change", validarGradeAdmin);
    });

    // Chama as lógicas iniciais
    ajustarSala();
    validarGradeAdmin();
  }

  // Valida se o horário escolhido pelo admin está na grade do profissional
  function validarGradeAdmin() {
    const feedbackDiv = modalBodyContent.querySelector("#agendamento-feedback");
    if (!feedbackDiv) return; // Sai se o elemento não existe

    const profissionalId = modalBodyContent.querySelector(
      "#modal-solicitante-id"
    )?.value; // ID do profissional que solicitou
    const dataInicio = modalBodyContent.querySelector(
      "#admin-ag-data-inicio"
    )?.value;
    const horaInicio = modalBodyContent.querySelector(
      "#admin-ag-hora-inicio"
    )?.value;
    const tipoSessao = modalBodyContent.querySelector(
      "#admin-ag-tipo-sessao"
    )?.value;
    const sala = modalBodyContent.querySelector("#admin-ag-sala")?.value;

    feedbackDiv.style.display = "none"; // Esconde por padrão

    if (!profissionalId || !dataInicio || !horaInicio || !tipoSessao || !sala) {
      // console.log("Campos insuficientes para validar grade.");
      return; // Não valida se faltar dados essenciais
    }

    // Determinar o dia da semana a partir da data de início
    let diaSemana = "";
    try {
      const dataObj = new Date(dataInicio + "T12:00:00"); // Usa meio dia para evitar problemas de fuso
      const diaIndex = dataObj.getDay(); // 0 (Dom) a 6 (Sáb)
      const diasMap = [
        "domingo",
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado",
      ];
      diaSemana = diasMap[diaIndex];
      if (diaSemana === "domingo") {
        feedbackDiv.innerHTML =
          "<strong>Atenção:</strong> Não há grade aos domingos.";
        feedbackDiv.className = "info-note alert alert-warning";
        feedbackDiv.style.display = "block";
        return; // Não valida domingo
      }
    } catch (e) {
      console.error("Data de início inválida:", dataInicio, e);
      feedbackDiv.innerHTML = "<strong>Erro:</strong> Data de início inválida.";
      feedbackDiv.className = "info-note alert alert-error";
      feedbackDiv.style.display = "block";
      return;
    }

    const horaKey = horaInicio.replace(":", "-"); // Formato HH-MM
    let horarioJaExisteNaGrade = false;

    // Verifica na grade GLOBAL (dadosDaGradeAdmin) se o PROFISSIONAL já tem esse horário
    const gradeDoProfissional =
      dadosDaGradeAdmin?.profissionais?.[profissionalId]?.horarios;

    if (
      gradeDoProfissional &&
      gradeDoProfissional[diaSemana] &&
      gradeDoProfissional[diaSemana][horaKey]
    ) {
      // Horário existe na grade do profissional, verificar se tipo/sala batem
      const slotGrade = gradeDoProfissional[diaSemana][horaKey];
      if (tipoSessao === "Online" && slotGrade.tipo === "Online") {
        horarioJaExisteNaGrade = true;
      } else if (
        tipoSessao === "Presencial" &&
        slotGrade.tipo === "Presencial" &&
        slotGrade.local === sala
      ) {
        horarioJaExisteNaGrade = true;
      }
    }

    feedbackDiv.style.display = "block";
    if (horarioJaExisteNaGrade) {
      feedbackDiv.innerHTML =
        "<strong>OK:</strong> Horário já cadastrado na grade deste profissional.";
      feedbackDiv.className = "info-note alert alert-success";
    } else {
      feedbackDiv.innerHTML = `<strong>Atenção:</strong> Este horário (${diaSemana}, ${horaInicio}, ${tipoSessao}, ${sala}) <strong>NÃO</strong> está na grade atual do profissional. <strong>Ele será inserido na grade</strong> ao aprovar.`;
      feedbackDiv.className = "info-note alert alert-warning";
    }
  }

  // --- Handler específico para APROVAR/REJEITAR Novas Sessões ---
  async function handleNovasSessoesAction(docId, novoStatus, solicitacaoData) {
    const formAgendamento = modalBodyContent.querySelector(
      "#admin-agendamento-form"
    );
    // Verificar se o form foi encontrado
    if (!formAgendamento) {
      console.error("Formulário de agendamento não encontrado no modal.");
      alert("Erro interno: Formulário de agendamento não encontrado.");
      return;
    }

    const mensagemAdminInput = formAgendamento.querySelector(
      "#admin-ag-message-text"
    );
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";

    // Botões
    const approveButton = document.getElementById("btn-aprovar-novas-sessoes");
    const rejectButton = document.getElementById("btn-rejeitar-novas-sessoes");
    if (approveButton) approveButton.disabled = true;
    if (rejectButton) rejectButton.disabled = true;
    const clickedButton = document.getElementById(
      novoStatus === "Aprovada"
        ? "btn-aprovar-novas-sessoes"
        : "btn-rejeitar-novas-sessoes"
    );
    if (clickedButton)
      clickedButton.innerHTML = `<span class="loading-spinner-small"></span> Processando...`;

    try {
      // --- Lógica de Rejeição ---
      if (novoStatus === "Rejeitada") {
        if (!mensagemAdmin) {
          throw new Error("Forneça o motivo da rejeição.");
        }
        // Apenas atualiza a solicitação
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
          `Solicitação ${docId} (Novas Sessões) atualizada para ${novoStatus}.`
        );
        alert(`Solicitação ${novoStatus.toLowerCase()} com sucesso!`);
        closeModal();
        return; // Termina aqui para rejeição
      }

      // --- Lógica de Aprovação ---
      if (novoStatus === "Aprovada") {
        // 1. Validar o formulário de agendamento do admin
        if (!formAgendamento.checkValidity()) {
          // Força a validação do HTML5 a mostrar os campos inválidos
          formAgendamento.reportValidity();
          throw new Error(
            "Preencha todos os campos obrigatórios (*) do agendamento."
          );
        }

        // 2. Coletar dados do agendamento definido pelo admin
        const recorrencia = formAgendamento.querySelector(
          "#admin-ag-recorrencia"
        ).value;
        const numeroSessoesInput = formAgendamento.querySelector(
          "#admin-ag-quantidade"
        );

        const agendamentoAdmin = {
          profissionalId: solicitacaoData.solicitanteId,
          profissionalNome: solicitacaoData.solicitanteNome,
          pacienteId: solicitacaoData.pacienteId,
          pacienteNome: solicitacaoData.pacienteNome,
          atendimentoId: solicitacaoData.atendimentoId, // ID do atendimento PB
          dataInicio: formAgendamento.querySelector("#admin-ag-data-inicio")
            .value,
          horaInicio: formAgendamento.querySelector("#admin-ag-hora-inicio")
            .value,
          recorrencia: recorrencia,
          // ***** NOVO: Coleta o número de sessões *****
          numeroSessoes:
            recorrencia === "unica"
              ? 1
              : parseInt(numeroSessoesInput.value, 10) || 1, // Pega o valor ou default 1
          tipoSessao: formAgendamento.querySelector("#admin-ag-tipo-sessao")
            .value,
          sala: formAgendamento.querySelector("#admin-ag-sala").value,
          mensagemAdmin: mensagemAdmin, // Mensagem opcional
        };

        // Validação extra para número de sessões
        if (
          recorrencia !== "unica" &&
          (isNaN(agendamentoAdmin.numeroSessoes) ||
            agendamentoAdmin.numeroSessoes < 1 ||
            agendamentoAdmin.numeroSessoes > 52)
        ) {
          throw new Error(
            `Número de sessões inválido: ${agendamentoAdmin.numeroSessoes}. Deve ser um número entre 1 e 52.`
          );
        }

        // 3. Validar a grade novamente (verificação final)
        validarGradeAdmin(); // Roda a validação para atualizar a mensagem
        const feedbackDiv = formAgendamento.querySelector(
          "#agendamento-feedback"
        );
        const precisaInserirNaGrade = feedbackDiv.textContent.includes(
          "será inserido na grade"
        );

        // 4. Inserir na grade, SE necessário
        if (precisaInserirNaGrade) {
          console.log("Tentando inserir/atualizar horário na grade...");
          let diaSemanaGrade = "";
          try {
            const dataObj = new Date(agendamentoAdmin.dataInicio + "T12:00:00");
            const diaIndex = dataObj.getDay();
            const diasMap = [
              "domingo",
              "segunda",
              "terca",
              "quarta",
              "quinta",
              "sexta",
              "sabado",
            ];
            diaSemanaGrade = diasMap[diaIndex];
          } catch (e) {
            throw new Error(
              "Data de início inválida para determinar dia da semana."
            );
          }

          await atualizarGradeDoProfissional(
            agendamentoAdmin.profissionalId,
            diaSemanaGrade, // 'segunda', 'terca', etc.
            agendamentoAdmin.horaInicio, // 'HH:MM'
            agendamentoAdmin.tipoSessao, // 'Online' ou 'Presencial'
            agendamentoAdmin.sala, // Nome da sala ou 'Online'
            agendamentoAdmin.pacienteId,
            agendamentoAdmin.pacienteNome
          );
          console.log(
            "Inserção/atualização na grade concluída (ou tentativa)."
          );
        } else {
          console.log(
            "Horário já existe na grade, não será inserido/alterado."
          );
        }

        // 5. Criar as sessões na subcoleção do paciente
        console.log(
          `Criando ${agendamentoAdmin.numeroSessoes} sessões recorrentes...`
        );
        const sessoesCriadasIds = await criarSessoesRecorrentes(
          agendamentoAdmin
        );
        console.log(
          `Sessões criadas (${sessoesCriadasIds.length}):`,
          sessoesCriadasIds
        );

        // 6. Atualizar a solicitação para "Aprovada"
        const docRef = doc(dbInstance, "solicitacoes", docId);
        const adminFeedbackAprovacao = {
          statusFinal: novoStatus,
          mensagemAdmin: mensagemAdmin,
          dataResolucao: serverTimestamp(),
          adminNome: adminUser.nome || "Admin",
          adminId: adminUser.uid || "N/A",
          agendamentoRealizado: {
            dataInicio: agendamentoAdmin.dataInicio,
            horaInicio: agendamentoAdmin.horaInicio,
            recorrencia: agendamentoAdmin.recorrencia,
            numeroSessoes: agendamentoAdmin.numeroSessoes, // Salva o número de sessões
            tipoSessao: agendamentoAdmin.tipoSessao,
            sala: agendamentoAdmin.sala,
            sessoesCriadas: sessoesCriadasIds.length, // Quantidade
          },
        };
        await updateDoc(docRef, {
          status: novoStatus,
          adminFeedback: adminFeedbackAprovacao,
        });
        console.log(
          `Solicitação ${docId} (Novas Sessões) atualizada para ${novoStatus}.`
        );

        alert(
          `Solicitação ${novoStatus.toLowerCase()} e ${
            sessoesCriadasIds.length
          } sessões agendadas com sucesso!`
        );
        closeModal();
      }
    } catch (error) {
      console.error(
        `Erro ao ${novoStatus.toLowerCase()} solicitação ${docId} (Novas Sessões):`,
        error
      );
      alert(`Erro ao processar: ${error.message}`);
      // Reabilitar botões
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar e Agendar" : "Rejeitar";
    }
  }

  // --- Função para ATUALIZAR A GRADE do profissional ---
  async function atualizarGradeDoProfissional(
    profissionalId,
    diaSemana, // 'segunda', 'terca', 'Segunda-feira', etc
    horario, // 'HH:MM'
    tipo,
    sala,
    pacienteId,
    pacienteNome
  ) {
    console.log(
      `Atualizando grade: Prof=${profissionalId}, Dia=${diaSemana}, Hora=${horario}, Tipo=${tipo}, Sala=${sala}`
    );
    // Mapear nomes completos para chaves (se necessário)
    const diasMapReverso = {
      "Segunda-feira": "segunda",
      "Terça-feira": "terca",
      "Quarta-feira": "quarta",
      "Quinta-feira": "quinta",
      "Sexta-feira": "sexta",
      Sábado: "sabado",
      domingo: "domingo", // Adiciona os que já são minúsculos
      segunda: "segunda",
      terca: "terca",
      quarta: "quarta",
      quinta: "quinta",
      sexta: "sexta",
      sabado: "sabado",
    };
    // Garante que o diaSemana está no formato 'segunda', 'terca', etc.
    const diaChave = diasMapReverso[diaSemana] || diaSemana?.toLowerCase();
    if (!diaChave) {
      throw new Error(
        `Dia da semana inválido fornecido para atualizar grade: ${diaSemana}`
      );
    }
    const horaChave = horario?.replace(":", "-"); // HH-MM
    if (!horaChave) {
      throw new Error(
        `Horário inválido fornecido para atualizar grade: ${horario}`
      );
    }

    const gradeRef = doc(dbInstance, "administrativo", "grades");

    const slotData = {
      ocupado: true,
      tipo: tipo, // 'Online' ou 'Presencial'
      local: sala, // Nome da sala ou 'Online'
      pacienteId: pacienteId,
      pacienteNome: pacienteNome,
      atualizadoEm: serverTimestamp(),
    };

    const fieldPath = `profissionais.${profissionalId}.horarios.${diaChave}.${horaChave}`;

    try {
      await updateDoc(gradeRef, {
        [fieldPath]: slotData, // Usa a variável fieldPath como chave
      });
      console.log("Grade atualizada com sucesso para o horário:", fieldPath);
    } catch (error) {
      console.error("Erro ao atualizar a grade do profissional:", error);
      if (
        error.code === "not-found" ||
        error.message.includes("No document to update")
      ) {
        console.warn(
          "Documento da grade ou caminho do profissional/dia não existe. Tentando criar com setDoc + merge."
        );
        try {
          const updateData = {};
          updateData[
            `profissionais.${profissionalId}.horarios.${diaChave}.${horaKey}`
          ] = slotData;

          await setDoc(gradeRef, updateData, { merge: true });
          console.log(
            "Grade criada/mesclada com sucesso para o horário:",
            fieldPath
          );
        } catch (setError) {
          console.error("Erro ao tentar criar/mesclar a grade:", setError);
          throw new Error(
            `Falha ao criar/atualizar a grade: ${setError.message}`
          ); // Lança erro para o handler principal
        }
      } else {
        throw new Error(`Falha ao atualizar a grade: ${error.message}`); // Lança outros erros
      }
    }
  }

  // --- Função para CRIAR SESSÕES recorrentes ---
  // *** CORRIGIDA PARA LIDAR COM dataInicio/horaInicio POSSIVELMENTE UNDEFINED E USAR numeroSessoes ***
  async function criarSessoesRecorrentes(agendamento) {
    console.log("Iniciando criação de sessões:", agendamento);
    const {
      pacienteId,
      profissionalId,
      profissionalNome,
      atendimentoId,
      dataInicio,
      horaInicio,
      recorrencia,
      numeroSessoes, // ***** NOVO: Recebe o número de sessões *****
      tipoSessao,
      sala,
    } = agendamento;

    // ***** CORREÇÃO: Validar data e hora de início *****
    const dataInicioStr = dataInicio || "";
    const horaInicioStr = horaInicio || "";

    if (
      !pacienteId ||
      !atendimentoId ||
      !dataInicioStr || // Usa a string verificada
      !horaInicioStr || // Usa a string verificada
      !recorrencia
    ) {
      console.error("Dados insuficientes para criar sessões:", agendamento);
      throw new Error(
        "Dados insuficientes para criar sessões. Verifique data, hora e recorrência."
      );
    }
    // *************************************************

    const sessoesRef = collection(
      dbInstance,
      "trilhaPaciente",
      pacienteId,
      "sessoes"
    );
    const batch = writeBatch(dbInstance);
    const sessoesCriadasIds = [];

    // Constrói a data inicial de forma robusta
    let dataAtual;
    try {
      const [ano, mes, dia] = dataInicioStr.split("-").map(Number);
      const [hora, minuto] = horaInicioStr.split(":").map(Number);
      dataAtual = new Date(ano, mes - 1, dia, hora, minuto); // JS usa mês 0-11
      if (isNaN(dataAtual.getTime())) throw new Error("Data ou hora inválida");
    } catch (e) {
      console.error(
        "Erro ao parsear data/hora:",
        dataInicioStr,
        horaInicioStr,
        e
      );
      throw new Error(
        `Data (${dataInicioStr}) ou Hora (${horaInicioStr}) inválida.`
      );
    }

    // --- Lógica de Recorrência ---
    // ***** NOVO: Usa o número de sessões vindo do agendamento *****
    let sessoesParaCriar = 1; // Padrão se for 'unica'
    if (recorrencia !== "unica") {
      sessoesParaCriar = parseInt(numeroSessoes, 10);
      if (
        isNaN(sessoesParaCriar) ||
        sessoesParaCriar < 1 ||
        sessoesParaCriar > 52
      ) {
        // Limite de 52 (1 ano semanal)
        throw new Error(
          `Número de sessões inválido: ${numeroSessoes}. Deve ser um número entre 1 e 52.`
        );
      }
    }
    // **********************************************************

    for (let i = 0; i < sessoesParaCriar; i++) {
      // Verifica se a data é válida (já verificado na inicialização, mas checa de novo)
      if (isNaN(dataAtual.getTime())) {
        console.error(
          "Data inválida encontrada durante a criação de sessões:",
          dataAtual
        );
        throw new Error(`Data de início inválida: ${dataInicio}`);
      }

      const novaSessaoRef = doc(sessoesRef); // Gera ID automático
      const sessaoData = {
        pacienteId: pacienteId,
        profissionalId: profissionalId,
        profissionalNome: profissionalNome,
        atendimentoId: atendimentoId, // Vincula à PB específica
        dataHora: Timestamp.fromDate(new Date(dataAtual)), // Armazena como Timestamp
        recorrencia: recorrencia, // Guarda a recorrência usada
        tipoSessao: tipoSessao, // Presencial / Online
        sala: sala,
        status: "pendente", // Status inicial
        criadoEm: serverTimestamp(),
        criadoPor: {
          // Quem agendou
          id: adminUser.uid,
          nome: adminUser.nome,
        },
        anotacoes: null, // Campo para futuras anotações
      };
      batch.set(novaSessaoRef, sessaoData);
      sessoesCriadasIds.push(novaSessaoRef.id);

      // Calcula a próxima data
      if (recorrencia === "semanal") {
        dataAtual.setDate(dataAtual.getDate() + 7);
      } else if (recorrencia === "quinzenal") {
        dataAtual.setDate(dataAtual.getDate() + 14);
      } else if (recorrencia === "mensal") {
        dataAtual.setMonth(dataAtual.getMonth() + 1);
      } else {
        // 'unica'
        break; // Sai do loop após a primeira
      }
    }

    try {
      await batch.commit();
      console.log("Batch de criação de sessões concluído.");

      // -- ATUALIZAR TRILHA DO PACIENTE --
      const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
      const pacienteSnap = await getDoc(pacienteRef);
      if (pacienteSnap.exists()) {
        const pacienteData = pacienteSnap.data();
        const atendimentosPB = [...(pacienteData.atendimentosPB || [])];
        const index = atendimentosPB.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (index !== -1) {
          // Atualiza o objeto horarioSessoes dentro do atendimento específico
          const horarioSessaoAdmin = {
            responsavelId: adminUser.uid,
            responsavelNome: adminUser.nome,
            diaSemana: obterDiaDaSemana(agendamento.dataInicio), // Função auxiliar necessária
            horario: agendamento.horaInicio,
            tipoAtendimento: agendamento.tipoSessao,
            frequencia: agendamento.recorrencia,
            salaAtendimento: agendamento.sala,
            dataInicio: agendamento.dataInicio, // Data da primeira sessão criada
            definidoEm: serverTimestamp(),
            // O campo 'alterarGrade' não se aplica aqui diretamente
          };
          atendimentosPB[index].horarioSessoes = horarioSessaoAdmin;
          // O status do atendimento já deve ser 'ativo', definido pelo voluntário

          const updateTrilha = {
            atendimentosPB: atendimentosPB,
            // O status geral do paciente deve ser 'em_atendimento_pb'
            status: "em_atendimento_pb",
            lastUpdate: serverTimestamp(),
          };
          await updateDoc(pacienteRef, updateTrilha);
          console.log(
            "Trilha do paciente atualizada com informações do agendamento."
          );
        } else {
          console.warn(
            `Atendimento PB ${atendimentoId} não encontrado na trilha para atualizar horário.`
          );
        }
      } else {
        console.warn(
          `Paciente ${pacienteId} não encontrado para atualizar trilha após criar sessões.`
        );
      }

      return sessoesCriadasIds;
    } catch (error) {
      console.error(
        "Erro ao commitar batch de sessões ou atualizar trilha:",
        error
      );
      throw new Error(
        `Falha ao criar sessões no banco de dados: ${error.message}`
      );
    }
  }

  // Função auxiliar para obter dia da semana ('segunda', 'terca', etc.) a partir de 'AAAA-MM-DD'
  function obterDiaDaSemana(dataString) {
    try {
      // ***** CORREÇÃO: Adiciona verificação de string vazia/nula *****
      if (!dataString) throw new Error("string de data está vazia ou nula");
      const dataObj = new Date(dataString + "T12:00:00");
      if (isNaN(dataObj.getTime())) throw new Error("Data inválida"); // Verifica se a data é válida
      const diaIndex = dataObj.getDay();
      const diasMap = [
        "domingo",
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado",
      ];
      return diasMap[diaIndex];
    } catch (e) {
      console.error(
        "Erro ao obter dia da semana:",
        e,
        "Data String:",
        dataString
      );
      return "invalido";
    }
  }

  // --- Função para LIMPAR HORÁRIO NA GRADE (Placeholder) ---
  async function limparHorarioGrade(profissionalId, horarioInfo) {
    if (
      !profissionalId ||
      !horarioInfo ||
      !horarioInfo.diaSemana ||
      !horarioInfo.horario
    ) {
      console.warn("Dados insuficientes para limpar horário da grade.");
      return;
    }

    // Mapear nomes completos para chaves
    const diasMapReverso = {
      "Segunda-feira": "segunda",
      "Terça-feira": "terca",
      "Quarta-feira": "quarta",
      "Quinta-feira": "quinta",
      "Sexta-feira": "sexta",
      Sábado: "sabado",
      domingo: "domingo",
      segunda: "segunda",
      terca: "terca",
      quarta: "quarta",
      quinta: "quinta",
      sexta: "sexta",
      sabado: "sabado",
    };
    const diaChave =
      diasMapReverso[horarioInfo.diaSemana] ||
      horarioInfo.diaSemana?.toLowerCase();
    const horaChave = horarioInfo.horario?.replace(":", "-");

    if (!diaChave || !horaChave) {
      console.warn(
        `Dados insuficientes para limpar horário: ${diaChave}, ${horaChave}`
      );
      return;
    }

    const fieldPath = `profissionais.${profissionalId}.horarios.${diaChave}.${horaChave}`;

    console.warn(
      `AÇÃO NECESSÁRIA (IMPLEMENTAR): Limpar grade para Prof=${profissionalId}, Path=${fieldPath}`
    );
    // IMPLEMENTAÇÃO SUGESTIVA (setar para null):
    try {
      const gradeRef = doc(dbInstance, "administrativo", "grades");
      await updateDoc(gradeRef, {
        [fieldPath]: null, // Ou deleteField() se usar SDK Admin
      });
      console.log(`Horário ${fieldPath} limpo da grade (setado para null).`);
    } catch (error) {
      console.error(`Erro ao limpar horário ${fieldPath} da grade:`, error);
      // Não lançar erro aqui para não travar o fluxo de desfecho
      alert(
        `Atenção: O desfecho foi salvo, mas houve um erro ao limpar o horário ${horarioInfo.diaSemana} ${horarioInfo.horario} da grade. Avise o(a) ${adminUser.nome}.`
      );
    }
  }

  // --- Função para EXCLUIR HORÁRIOS DA GRADE ---
  async function excluirHorariosDaGrade(profissionalId, horariosParaExcluir) {
    if (
      !profissionalId ||
      !horariosParaExcluir ||
      horariosParaExcluir.length === 0
    ) {
      console.warn("Dados insuficientes para excluir horários da grade.");
      return;
    }
    console.log(
      `Excluindo ${horariosParaExcluir.length} horários da grade para ${profissionalId}...`
    );
    const gradeRef = doc(dbInstance, "administrativo", "grades");
    const updates = {};
    let hasError = false;

    horariosParaExcluir.forEach((horarioInfo) => {
      // horarioInfo.path deve ser algo como 'segunda.09-00' ou similar
      const pathParts = horarioInfo.path?.split(".");
      if (pathParts && pathParts.length === 2) {
        const diaChave = pathParts[0];
        const horaChave = pathParts[1];
        const fieldPath = `profissionais.${profissionalId}.horarios.${diaChave}.${horaChave}`;
        // Para remover o campo, idealmente usar FieldValue.delete() do SDK Admin (server-side).
        // No client-side, podemos setar para null ou um objeto vazio para indicar remoção.
        // Setar para null é mais simples.
        updates[fieldPath] = null; // Ou {} se preferir objeto vazio
        console.log(`Marcado para remoção (null): ${fieldPath}`);
      } else {
        console.error("Path inválido no horário para excluir:", horarioInfo);
        hasError = true; // Marca que houve erro, mas continua tentando os outros
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await updateDoc(gradeRef, updates);
        console.log("Horários marcados como null na grade.");
      } catch (error) {
        console.error("Erro ao tentar excluir horários da grade:", error);
        // Lança o erro para que a função handleSalvarExclusao possa tratá-lo
        throw new Error(`Falha ao excluir horários da grade: ${error.message}`);
      }
    } else if (hasError) {
      // Se houve erro nos paths mas nenhum update foi gerado
      throw new Error(
        "Formato inválido nos caminhos dos horários para exclusão."
      );
    } else {
      console.warn("Nenhum horário válido encontrado para excluir da grade.");
    }
  }

  // --- Inicialização e Listeners (Final) ---
  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  // loadReavaliacao(); // Aba não existe
  // loadInclusaoAlteracaoGradePB(); // Aba não existe
  loadStatusContratos();
  loadExclusaoHorarios();

  // --- Listener de Evento Principal (Delegação - mantido) ---
  if (tabContentContainer) {
    console.log(
      "Listener de clique principal anexado a #tab-content-container."
    );
    tabContentContainer.addEventListener("click", async (e) => {
      // Botões "Processar"
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

      // Botões "Notificar Contrato"
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
        ); // Chama a função
      }
    });
  } else {
    console.error("FALHA CRÍTICA: #tab-content-container não encontrado.");
  }

  // --- Event Listeners do Modal (Fechar/Cancelar - mantidos) ---
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  else console.warn("Botão fechar modal (X) não encontrado.");
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  else console.warn("Botão cancelar modal não encontrado.");
  if (modal) {
    modal.addEventListener("click", (event) => {
      // Fecha se clicar no overlay (fundo escuro), mas não no content
      if (event.target === modal) closeModal();
    });
  } else {
    console.error(
      "Elemento modal principal #solicitacao-details-modal não encontrado."
    );
  }
} // --- FIM DA FUNÇÃO INIT ---
