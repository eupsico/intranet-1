// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO MODIFICADA PARA NOVAS SESSÕES (Corrigida) ---
// *** ALTERAÇÃO: Adicionado fila de Solicitação de Encaminhamento e lógica de processamento ***

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
  } // Tenta converter string YYYY-MM-DD
  if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    try {
      // Adiciona T03:00:00 para tentar ajustar fuso local (Brasília) se a data original não tiver hora
      const date = new Date(timestamp + "T03:00:00"); // Verifica se a data é válida antes de formatar
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) {
      console.warn("Erro ao formatar data string:", timestamp, e); // Ignora erro e retorna N/A
    }
  }
  return "N/A";
}

function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    encaminhamento: "Solicitação de Encaminhamento", // NOVO: Tipo de solicitação de encaminhamento PB
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
  adminUser = userData; // Carregar dados da grade e salas no início

  await loadGradeDataAdmin();
  await carregarSalasDoFirebase(); // --- Seletores DOM (mantidos) ---

  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector("#tab-content-container"); // --- Configuração Abas (mantida) ---

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
    }); // Ativa a primeira aba por padrão se nenhuma estiver ativa
    if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
      tabLinks[0].click();
    }
  } // --- Função Genérica: Carregar Solicitações (mantida) ---

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
                console.warn("Função renderRow não retornou um Node:", tr); // Tentar adicionar como string (fallback)
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
      ); // TODO: Gerenciar unsubscribe quando a página/módulo for descarregado // Ex: armazenar unsubscribes em um array e chamar unsubscribe() para cada uno
    } catch (error) {
      console.error(
        `Falha ao construir query para [${tipoSolicitacao}]:`,
        error
      );
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Falha na query. Verifique o nome da coleção e índices.</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  } // --- Implementação das funções de carregamento ---

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
  // NOVA FUNÇÃO: Carrega as solicitações de Encaminhamento
  function loadEncaminhamentos() {
    loadSolicitacoesPorTipo(
      "encaminhamento",
      "table-body-encaminhamento", // ID da tabela (assumido no HTML)
      "empty-state-encaminhamento", // ID (assumido no HTML)
      "count-encaminhamento", // ID (assumido no HTML)
      renderEncaminhamentoRow,
      7 // Colspan: Data, Profissional, Paciente, Serviço, Motivo, Status, Ações
    );
  } // As funções abaixo (loadReavaliacao, loadInclusaoAlteracaoGradePB) // não têm tabelas correspondentes no HTML fornecido (solicitacoes-admin.html), // então elas irão falhar ou não fazer nada se os IDs não existirem.

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
        const pacienteData = doc.data(); // Verificar se o status é relevante (opcional, mas bom para performance)

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
      }); // Ordenar por nome do paciente

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
  } // --- Funções de Renderização ---

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
      detalhes.motivo || "N/A" // Apenas motivo de Alta/Desistência
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
  // NOVA FUNÇÃO: Renderiza a linha para Solicitação de Encaminhamento
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
            <td class="motivo-cell">${
      detalhes.motivoEncaminhamento || "N/A"
    }</td>
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="encaminhamento">
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
  } // --- Lógica do Modal Genérico (Ajustada para novas sessoes) ---

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
        case "encaminhamento":
          modalHtmlPath += "modal-encaminhamento.html"; // NOVO: Modal para Encaminhamento
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

      modalBodyContent.innerHTML = await response.text(); // Preenche os campos COMUNS e específicos

      preencherCamposModal(tipo, solicitacaoData); // Configura os botões e lógica específica (Aprovar/Rejeitar/Salvar)

      configurarAcoesModal(docId, tipo, solicitacaoData); // Adiciona lógica JS específica APÓS carregar o HTML do modal

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
  } // --- Funções Auxiliares do Modal (Ajustada para novas sessoes) ---

  function preencherCamposModal(tipo, data) {
    const detalhes = data.detalhes || {}; // Campos comuns

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
          ); // ***** NOVO: Preenche a recorrência solicitada *****
          setTextContentIfExists(
            "#modal-ns-recorrencia",
            detalhes.recorrenciaSolicitada || "N/A"
          ); // (Aguardando este campo vir do detalhe-paciente) // ************************************************* // Preenche campo readonly do profissional no novo form
          setValueIfExists("#admin-ag-profissional-nome", data.solicitanteNome); // Carrega as salas no dropdown
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
            detalhes.motivo // Apenas motivo de Alta/Desistência
          );
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

          // Renderizar disponibilidade específica
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
    } // Exibir feedback anterior (mantido)

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
      } // Desabilitar inputs/textareas da resposta se já foi respondido
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = true));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = true)); // Para outros tipos // Para exclusão
      modalBodyContent
        .querySelectorAll(
          'input[name="foiExcluido"], #dataExclusao, #mensagemAdmin, #motivoRejeicao'
        )
        .forEach((el) => (el.disabled = true));
    } else {
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      );
      if (feedbackContainer) feedbackContainer.style.display = "none"; // Habilitar campos se for pendente
      modalBodyContent
        .querySelectorAll(
          "#admin-agendamento-section input:not([type=hidden]), #admin-agendamento-section select, #admin-agendamento-section textarea"
        )
        .forEach((el) => (el.disabled = false));
      modalBodyContent
        .querySelectorAll("#modal-admin-message-group textarea")
        .forEach((el) => (el.disabled = false)); // Para exclusão
      modalBodyContent
        .querySelectorAll(
          'input[name="foiExcluido"], #dataExclusao, #mensagemAdmin, #motivoRejeicao'
        )
        .forEach((el) => (el.disabled = false)); // Reaplicar lógica de habilitação da sala em novas sessões
      const tipoSessaoSelect = modalBodyContent.querySelector(
        "#admin-ag-tipo-sessao"
      );
      if (tipoSessaoSelect) tipoSessaoSelect.dispatchEvent(new Event("change")); // Dispara change para ajustar estado inicial // Ajustar estado inicial para exclusão
      if (tipo === "exclusao_horario") {
        setupModalFormLogicExclusao(); // Garante que a lógica de show/hide seja aplicada
      }
    }
  } // --- Funções auxiliares para preencher/setar valor (mantidas) ---
  function setTextContentIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector); // Usa ?? 'N/A' para tratar null e undefined como 'N/A'
    if (element) element.textContent = value ?? "N/A";
    else console.warn(`Elemento não encontrado para setText: ${selector}`);
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector); // Usa ?? '' para tratar null e undefined como string vazia
    if (element) element.value = value ?? "";
    else console.warn(`Elemento não encontrado para setValue: ${selector}`);
  } // --- Configura Ações e Handlers do Modal (Ajustada para novas sessoes) ---

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
        modalFooterActions.appendChild(saveButton); // setupModalFormLogicExclusao() é chamado após preencher os campos
      } else if (tipo === "encaminhamento") {
        // Botões específicos para Encaminhamento
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

        // Mostra campo de mensagem genérico
        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        );
        if (adminMessageGroup) {
          adminMessageGroup.style.display = "block";
        }
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
        modalFooterActions.appendChild(rejectButton); // Mostra campo de mensagem genérico (se existir no HTML carregado)

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
  } // --- Handler GENÉRICO para Aprovar/Rejeitar (NÃO usado para novas_sessoes e exclusao) ---

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
    } // Desabilitar botões e mostrar loading

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
      ); // Executar ações pós-aprovação

      if (novoStatus === "Aprovada") {
        console.log("Executando ações pós-aprovação para:", tipo);
        switch (tipo) {
          case "alteracao_horario":
            await processarAprovacaoAlteracaoHorario(solicitacaoData);
            break;
          case "encaminhamento":
            await processarAprovacaoEncaminhamento(solicitacaoData); // NOVO HANDLER
            break;
          case "desfecho":
            await processarAprovacaoDesfecho(solicitacaoData);
            break;
          case "reavaliacao":
            await processarAprovacaoReavaliacao(solicitacaoData);
            break;
          case "inclusao_alteracao_grade":
            await processarAprovacaoInclusaoGrade(solicitacaoData);
            break; // Não inclui novas_sessoes e exclusao aqui
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
      alert(`Erro ao processar: ${error.message}`); // Reabilitar botões
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  } // --- Funções de Processamento Pós-Aprovação ---

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
      ); // --- Ação na Grade ---

      if (novosDados.alterarGrade === "Sim") {
        console.log(
          `Tentando atualizar grade para profissional ${solicitacao.solicitanteId}`
        ); // É necessário o ID do profissional (solicitanteId)
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
      console.error("Erro ao atualizar trilha ou grade:", error); // Lançar erro para que a mensagem de falha geral seja exibida
      throw new Error(
        `Falha ao atualizar dados do paciente ou grade: ${error.message}`
      );
    }
  }
  // NOVA FUNÇÃO: Processar Encaminhamento
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
      // 1. Atualizar o status do ATENDIMENTO PB para concluído/encaminhado
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

      // Marcar o atendimento PB como concluído por encaminhamento
      atendimentosPB[index].statusAtendimento = "concluido_encaminhamento";
      atendimentosPB[index].desfecho = {
        ...detalhes, // Inclui todos os detalhes do encaminhamento
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
        tipoDesfecho: "Encaminhamento",
      };

      // AÇÃO NECESSÁRIA PÓS-DESFECHO: Liberar horário na grade
      const horarioParaLiberar = atendimentosPB[index].horarioSessoes;
      const profissionalId = atendimentosPB[index].profissionalId;
      if (horarioParaLiberar && profissionalId) {
        await limparHorarioGrade(profissionalId, horarioParaLiberar);
      }

      // 2. Mover o paciente para a fila 'Encaminhar PB' (novo status) e atualizar a disponibilidade
      const novoStatusPaciente = "encaminhar_para_pb";

      const updateData = {
        atendimentosPB: atendimentosPB,
        status: novoStatusPaciente, // Move para a nova fila de encaminhamento
        disponibilidadeEspecifica: disponibilidadeParaEncaminhamento, // Atualiza a disponibilidade para o próximo atendimento
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
          break; // REMOVIDO case "Encaminhamento"
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      } // Atualiza o atendimento específico

      atendimentosPB[index][nomeCampoStatusAtendimento] = novoStatusAtendimento; // Armazena todos os detalhes do desfecho no atendimento
      atendimentosPB[index].desfecho = {
        ...detalhes, // Inclui motivo
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };

      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      }; // Atualiza o status GERAL do paciente SOMENTE se ele mudou
      if (novoStatusPaciente !== pacienteData.status) {
        updateData.status = novoStatusPaciente;
      }

      await updateDoc(pacienteRef, updateData);
      console.log(
        `Desfecho registrado na trilha para ${pacienteId}. Status Paciente: ${
          updateData.status || pacienteData.status
        }`
      ); // AÇÃO NECESSÁRIA PÓS-DESFECHO: Liberar horário na grade

      const horarioParaLiberar = atendimentosPB[index].horarioSessoes;
      const profissionalId = atendimentosPB[index].profissionalId;
      if (horarioParaLiberar && profissionalId) {
        console.warn(
          `AÇÃO NECESSÁRIA: Liberar horário na grade para ${profissionalId}: ${horarioParaLiberar.diaSemana}, ${horarioParaLiberar.horario}, ${horarioParaLiberar.tipoAtendimento}, ${horarioParaLiberar.salaAtendimento}`
        ); // Implementar a chamada para a função que limpa a grade aqui
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
      }; // Atualiza o status principal apenas se for diferente, e guarda o anterior

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
    console.log("Processando aprovação: Inclusão/Alt. Grade", solicitacao); // Aqui, a ação principal é atualizar a grade. A solicitação é apenas uma confirmação.
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
      ); // Não precisa alterar a trilha do paciente aqui, pois isso já foi feito // quando o voluntário informou os horários no modal dele.
    } catch (error) {
      console.error("Erro ao atualizar a grade via aprovação:", error);
      throw new Error(
        `Falha ao atualizar a grade: ${error.message}. A solicitação foi marcada como 'Aprovada', mas a grade pode não ter sido atualizada.`
      );
    }
  } // --- Lógica Específica Modal Exclusão Horário (mantida) ---

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
        camposNao.style.display = radioNao.checked ? "block" : "none"; // Ajustar 'required' dinamicamente

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
        adminFeedback.mensagemAdmin = mensagemAdmin; // --- AÇÃO NA GRADE ---

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
  } // --- Função para Notificar Contrato (mantida) ---

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

      const userData = userDocSnap.data(); // Tentar múltiplos campos de telefone
      let telefone = userData.contato || userData.telefone || userData.celular; // Adicionar outros campos se houver

      if (!telefone) {
        throw new Error(`Telefone não cadastrado para ${profissionalNome}.`);
      } // 2. Limpar e formatar o número

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
        } // Validação final de comprimento pode ser adicionada aqui se necessário
        if (numeroLimpo.length < 12) {
          // 55 + DDD (2) + Numero (min 8)
          throw new Error(
            `Formato de telefone inválido ou incompleto para ${profissionalNome}: ${telefone}`
          );
        }
      } // 3. Montar a mensagem

      const mensagem = `Olá ${profissionalNome}. Lembrete: O contrato terapêutico do paciente ${pacienteNome} está pendente de envio/assinatura. Por favor, verifique.`; // 4. Codificar a mensagem para URL

      const mensagemCodificada = encodeURIComponent(mensagem); // 5. Montar a URL do WhatsApp

      const whatsappUrl = `https://wa.me/${numeroLimpo}?text=${mensagemCodificada}`; // 6. Abrir em nova aba

      window.open(whatsappUrl, "_blank");
      console.log("Link do WhatsApp aberto:", whatsappUrl);
      alert(`Abrindo WhatsApp para enviar lembrete para ${profissionalNome}.`);
    } catch (error) {
      console.error("Erro ao tentar notificar via WhatsApp:", error);
      alert(`Erro ao notificar: ${error.message}`);
    }
  } // --- Funções Genéricas do Modal (Abrir/Fechar - mantidas) ---

  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
    if (modalBodyContent) modalBodyContent.innerHTML = ""; // Limpa conteúdo
    if (modalFooterActions) modalFooterActions.innerHTML = ""; // Limpa ações // Readiciona o botão cancelar ao footer (importante!)
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn);
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação"; // Reseta título
  } // --- Inicialização (mantida) ---

  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadEncaminhamentos(); // NOVO: Carrega a fila de encaminhamentos // loadReavaliacao(); // Aba não existe // loadInclusaoAlteracaoGradePB(); // Aba não existe
  loadStatusContratos();
  loadExclusaoHorarios(); // --- Listener de Evento Principal (Delegação - mantido) ---

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
      } // Botões "Notificar Contrato"

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
  } // --- Event Listeners do Modal (Fechar/Cancelar - mantidos) ---

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
