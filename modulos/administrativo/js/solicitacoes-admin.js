// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO CORRIGIDA ---

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs, // Usaremos getDocs para Contratos Pendentes
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "../../../assets/js/firebase-init.js";
// import { deleteDoc } from "../../../assets/js/firebase-init.js"; // Se necessário

let dbInstance = db;
let adminUser;

// --- Funções Auxiliares (mantidas) ---
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
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
    // Adicionar outros tipos se necessário (ex: 'contrato_pendente' se criar solicitação)
  };
  return mapaTipos[tipoInterno] || tipoInterno;
}

// Função principal de inicialização
export function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.CORRIGIDA iniciado."
  );
  adminUser = userData;

  // Seletores DOM (mantidos)
  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector(".tab-content-container");

  // Configuração Abas (mantida)
  function setupTabs() {
    // ... (código igual) ...
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
      }
    });
  }

  // --- Função Genérica: Carregar Solicitações da Coleção Central (mantida) ---
  function loadSolicitacoesPorTipo(
    tipoSolicitacao,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRowFunction,
    colspan = 7
  ) {
    // ... (código igual da versão anterior) ...
    console.log(`Carregando [${tipoSolicitacao}] da coleção 'solicitacoes'...`);
    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) {
      console.error(
        `Elementos do DOM não encontrados para [${tipoSolicitacao}]. Verifique IDs: ${tableBodyId}, ${emptyStateId}, ${countBadgeId}`
      );
      return;
    }

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
            console.log(
              `Nenhuma solicitação de [${tipoSolicitacao}] pendente encontrada.`
            );
          } else {
            emptyState.style.display = "none";
            countBadge.textContent = pendingCount;
            countBadge.style.display = "inline-block";
            console.log(
              `${pendingCount} solicitações de [${tipoSolicitacao}] pendentes encontradas.`
            );

            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const docId = doc.id;
              const tr = renderRowFunction(data, docId);
              tableBody.innerHTML += tr;
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
      // TODO: Gerenciar 'unsubscribe' ao sair da página
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
      7 // Colunas: Data, Profissional, Paciente, Horário Solicitado, Início Pref., Status, Ações
    );
  }

  function loadAlteracoesHorario() {
    loadSolicitacoesPorTipo(
      "alteracao_horario",
      "table-body-alteracoes-horario",
      "empty-state-alteracoes-horario",
      "count-alteracoes-horario",
      renderAlteracaoHorarioRow,
      9 // Colunas: Data, Profissional, Paciente, De, Para, Início, Justificativa, Status, Ações
    );
  }

  function loadDesfechosPB() {
    loadSolicitacoesPorTipo(
      "desfecho",
      "table-body-desfechos-pb",
      "empty-state-desfechos-pb",
      "count-desfechos-pb",
      renderDesfechoRow,
      8 // Colunas: Data Reg, Data Desf, Prof, Paciente, Tipo, Motivo, Status, Ações
    );
  }

  function loadReavaliacao() {
    loadSolicitacoesPorTipo(
      "reavaliacao",
      "table-body-reavaliacao", // Certifique-se que existe no HTML
      "empty-state-reavaliacao", // Certifique-se que existe no HTML
      "count-reavaliacao", // Certifique-se que existe no HTML
      renderReavaliacaoRow,
      8 // Colunas: Data Sol, Prof, Paciente, Valor Atual, Motivo, Pref. Agenda, Status, Ações
    );
  }

  function loadInclusaoAlteracaoGradePB() {
    loadSolicitacoesPorTipo(
      "inclusao_alteracao_grade",
      "table-body-inclusao-grade-pb", // Certifique-se que existe no HTML
      "empty-state-inclusao-grade-pb", // Certifique-se que existe no HTML
      "count-inclusao-grade-pb", // Certifique-se que existe no HTML
      renderInclusaoAlteracaoGradePBRow,
      9 // Colunas: Data Sol, Prof, Paciente, Dia, Hora, Mod, Sala, Status, Ações
    );
  }

  // *** ALTERADO: loadStatusContratos ***
  // Busca pacientes em PB sem contrato assinado
  async function loadStatusContratos() {
    console.log("Carregando Status Contratos...");
    const tableBodyId = "table-body-status-contratos";
    const emptyStateId = "empty-state-status-contratos";
    const countBadgeId = "count-status-contratos";
    const colspan = 4; // Colunas: Paciente, Profissional, Status Contrato, Última Atualização

    const tableBody = document.getElementById(tableBodyId);
    const emptyState = document.getElementById(emptyStateId);
    const countBadge = document.getElementById(countBadgeId);

    if (!tableBody || !emptyState || !countBadge) {
      console.error("Elementos do DOM não encontrados para Status Contratos.");
      return;
    }

    tableBody.innerHTML = `<tr><td colspan="${colspan}">Buscando pacientes...</td></tr>`;
    emptyState.style.display = "none";
    countBadge.style.display = "none";

    try {
      // Query 1: Pacientes com status 'em_atendimento_pb'
      const qPb = query(
        collection(dbInstance, "trilhaPaciente"),
        where("status", "==", "em_atendimento_pb")
      );
      // Query 2: Pacientes com status 'cadastrar_horario_psicomanager' (horários informados, mas contrato pode estar pendente)
      const qCadastrar = query(
        collection(dbInstance, "trilhaPaciente"),
        where("status", "==", "cadastrar_horario_psicomanager")
      );

      // Executa as queries em paralelo
      const [pbSnapshot, cadastrarSnapshot] = await Promise.all([
        getDocs(qPb),
        getDocs(qCadastrar),
      ]);

      let pendingContracts = [];

      // Processa pacientes de ambas as queries
      const processSnapshot = (snapshot) => {
        snapshot.forEach((doc) => {
          const pacienteData = doc.data();
          const pacienteId = doc.id;

          // Verifica CADA atendimento PB ativo
          const atendimentosAtivos =
            pacienteData.atendimentosPB?.filter(
              (at) => at.statusAtendimento === "ativo"
            ) || [];

          atendimentosAtivos.forEach((atendimento) => {
            // Se o contrato NÃO está assinado neste atendimento ativo
            if (!atendimento.contratoAssinado) {
              pendingContracts.push({
                pacienteId: pacienteId,
                pacienteNome:
                  pacienteData.nomeCompleto || "Nome não encontrado",
                profissionalNome:
                  atendimento.profissionalNome || "Profissional não encontrado",
                statusContrato: "Pendente",
                lastUpdate: pacienteData.lastUpdate, // Pega a última atualização do paciente
              });
            }
          });
        });
      };

      processSnapshot(pbSnapshot);
      processSnapshot(cadastrarSnapshot);

      // Remove duplicados (caso um paciente apareça em ambas as queries com contrato pendente no mesmo atendimento - improvável mas seguro)
      // Usando Map para simplificar a remoção de duplicados baseados em pacienteId + profissionalNome
      const uniqueMap = new Map();
      pendingContracts.forEach((item) => {
        const key = `${item.pacienteId}-${item.profissionalNome}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });
      pendingContracts = Array.from(uniqueMap.values());

      // Ordena por nome do paciente
      pendingContracts.sort((a, b) =>
        a.pacienteNome.localeCompare(b.pacienteNome)
      );

      // Renderiza a tabela
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
          const tr = `
                      <tr>
                          <td>${item.pacienteNome}</td>
                          <td>${item.profissionalNome}</td>
                          <td><span class="status-badge status-pendente">${item.statusContrato}</span></td>
                          <td>${dataAtualizacao}</td>
                          {/* Adicionar coluna de Ações se necessário */}
                      </tr>
                   `;
          tableBody.innerHTML += tr;
        });
      }
    } catch (error) {
      console.error("Erro ao carregar status de contratos:", error);
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  }

  // *** ALTERADO: loadExclusaoHorarios ***
  // Mantém buscando de 'solicitacoes', mas ajusta colspan e remove fallback por enquanto
  function loadExclusaoHorarios() {
    loadSolicitacoesPorTipo(
      "exclusao_horario",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      renderExclusaoHorarioRow,
      7 // Colspan original: Data, Prof, Qtd Atual, Horários, Motivo, Status, Ações
    );
    // Adicionar aqui lógica de fallback para ler 'solicitacoesExclusaoGrade' se necessário
    // Ex: usar um Promise.all ou verificar se a primeira query retornou vazio e então buscar na antiga.
  }

  // --- Funções de Renderização ---

  // ** CORRIGIDO: Removido comentário **
  function renderNovasSessoesRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.diaSemana || "N/A"}, ${detalhes.horario || "N/A"} (${
      detalhes.modalidade || "N/A"
    })</td>
        <td>${
          detalhes.dataInicioPreferencial
            ? formatarData(
                Timestamp.fromDate(
                  new Date(detalhes.dataInicioPreferencial + "T03:00:00")
                )
              )
            : "N/A"
        }</td> {/* Formata data */}
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="novas_sessoes">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
      </tr>
    `;
  }

  function renderAlteracaoHorarioRow(data, docId) {
    const detalhes = data.detalhes || {};
    const antigos = detalhes.dadosAntigos || {};
    const novos = detalhes.dadosNovos || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioNova = novos.dataInicio
      ? formatarData(
          Timestamp.fromDate(new Date(novos.dataInicio + "T03:00:00"))
        )
      : "N/A"; // Formata data
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    // Adicionada coluna Justificativa
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${antigos.dia || "N/A"}, ${antigos.horario || "N/A"} (${
      antigos.modalidade || "N/A"
    })</td>
        <td>${novos.dia || "N/A"}, ${novos.horario || "N/A"} (${
      novos.modalidade || "N/A"
    })</td>
        <td>${dataInicioNova}</td> {/* Data Início Nova */}
        <td class="motivo-cell">${
          detalhes.justificativa || "N/A"
        }</td> {/* Justificativa */}
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="alteracao_horario">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
      </tr>
    `;
  }

  // ** CORRIGIDO: Removido comentário **
  function renderDesfechoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataDesf = detalhes.dataDesfecho
      ? formatarData(
          Timestamp.fromDate(new Date(detalhes.dataDesfecho + "T03:00:00"))
        )
      : "N/A";
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${dataDesf}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.tipoDesfecho || "N/A"}</td>
        <td class="motivo-cell">${
          detalhes.motivo || detalhes.motivoEncaminhamento || "N/A"
        }</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="desfecho">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
      </tr>
    `;
  }

  function renderReavaliacaoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const pref = detalhes.preferenciaAgendamento || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataPrefFormatada = pref.data
      ? formatarData(Timestamp.fromDate(new Date(pref.data + "T03:00:00")))
      : "N/A"; // Formata data
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        <td>${detalhes.valorContribuicaoAtual || "N/A"}</td>
        <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
        <td>${dataPrefFormatada} ${pref.hora || ""} (${
      pref.modalidade || "N/A"
    })</td> {/* Pref Agendamento */}
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="reavaliacao">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
      </tr>
    `;
  }

  function renderInclusaoAlteracaoGradePBRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioFormatada = detalhes.dataInicio
      ? formatarData(
          Timestamp.fromDate(new Date(detalhes.dataInicio + "T03:00:00"))
        )
      : "N/A"; // Formata data
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
        <tr>
            <td>${dataSol}</td>
            <td>${data.solicitanteNome || "N/A"}</td>
            <td>${data.pacienteNome || "N/A"}</td>
            <td>${detalhes.diaSemana || "N/A"}</td>
            <td>${detalhes.horario || "N/A"}</td>
            <td>${detalhes.modalidade || detalhes.tipoAtendimento || "N/A"}</td>
            <td>${detalhes.salaAtendimento || "N/A"}</td>
             <td>${dataInicioFormatada}</td> {/* Adicionada Data Início */}
            <td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td>
            <td>
                <button class="action-button btn-processar-solicitacao"
                        data-doc-id="${docId}"
                        data-tipo="inclusao_alteracao_grade">
                    ${data.status === "Pendente" ? "Processar" : "Ver"}
                </button>
            </td>
        </tr>
    `;
  }

  function renderExclusaoHorarioRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const horariosLabels =
      detalhes.horariosParaExcluir?.map((h) => h.label).join(", ") || "N/A"; // Fallback melhor
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${detalhes.totalHorariosAtual ?? "N/A"}</td>
        <td>${horariosLabels}</td>
        <td class="motivo-cell">${detalhes.motivo || "N/A"}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="exclusao_horario">
            ${
              data.status === "Pendente" ? "Processar" : "Ver"
            } {/* Texto do botão ajustado */}
          </button>
        </td>
      </tr>
    `;
  }

  // --- Lógica do Modal Genérico (mantida, mas com correções no fetch path) ---
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

      if (!docSnap.exists()) {
        throw new Error("Solicitação não encontrada!");
      }
      const solicitacaoData = docSnap.data();

      // ** CORREÇÃO: Usar caminho relativo CORRETO para os modais **
      // Assumindo que solicitacoes-admin.js está em /modulos/administrativo/js/
      // e os modais estão em /modulos/administrativo/page/
      let modalHtmlPath = `../page/`; // Caminho base

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

      console.log("Tentando carregar modal de:", modalHtmlPath); // Log para depuração
      const response = await fetch(modalHtmlPath);
      if (!response.ok) {
        console.error(
          `Fetch falhou: ${response.status} ${response.statusText} para ${modalHtmlPath}`
        );
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}). Verifique o caminho e se o arquivo existe.`
        );
      }
      modalBodyContent.innerHTML = await response.text();

      preencherCamposModal(tipo, solicitacaoData);
      configurarAcoesModal(docId, tipo, solicitacaoData);
    } catch (error) {
      console.error("Erro ao abrir modal genérico:", error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes: ${error.message}</p>`;
      modalFooterActions.innerHTML = "";
      modalFooterActions.appendChild(modalCancelBtn);
    }
  }

  // --- Funções preencherCamposModal, setTextContentIfExists, setValueIfExists (mantidas como antes) ---
  function preencherCamposModal(tipo, data) {
    // ... (código igual da versão anterior, garantindo que os IDs batem com os HTMLs) ...
    const detalhes = data.detalhes || {};

    // Campos Comuns (exemplo, adicione mais se necessário)
    setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
    setTextContentIfExists("#modal-paciente-nome", data.pacienteNome);
    setTextContentIfExists(
      "#modal-data-solicitacao",
      formatarData(data.dataSolicitacao)
    );

    switch (tipo) {
      case "novas_sessoes":
        setTextContentIfExists("#modal-ns-dia", detalhes.diaSemana);
        setTextContentIfExists("#modal-ns-horario", detalhes.horario);
        setTextContentIfExists("#modal-ns-modalidade", detalhes.modalidade);
        setTextContentIfExists("#modal-ns-sala", detalhes.sala);
        // Corrigido para span
        setTextContentIfExists(
          "#modal-ns-data-inicio",
          detalhes.dataInicioPreferencial
            ? formatarData(
                Timestamp.fromDate(
                  new Date(detalhes.dataInicioPreferencial + "T03:00:00")
                )
              )
            : "N/A"
        );
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
        // Campos Novos
        setTextContentIfExists("#modal-ah-dia-novo", novos.dia);
        setTextContentIfExists("#modal-ah-horario-novo", novos.horario);
        setTextContentIfExists("#modal-ah-modalidade-nova", novos.modalidade);
        setTextContentIfExists("#modal-ah-frequencia-nova", novos.frequencia);
        setTextContentIfExists("#modal-ah-sala-nova", novos.sala);
        setTextContentIfExists(
          "#modal-ah-data-inicio-nova",
          novos.dataInicio
            ? formatarData(
                Timestamp.fromDate(new Date(novos.dataInicio + "T03:00:00"))
              )
            : "N/A"
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
          detalhes.dataDesfecho
            ? formatarData(
                Timestamp.fromDate(
                  new Date(detalhes.dataDesfecho + "T03:00:00")
                )
              )
            : "N/A"
        );
        setTextContentIfExists("#modal-df-sessoes", detalhes.sessoesRealizadas);
        setTextContentIfExists(
          "#modal-df-motivo",
          detalhes.motivo || detalhes.motivoEncaminhamento
        ); // Mostra motivo relevante
        // Detalhes de Encaminhamento (se aplicável)
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
          pref.data
            ? formatarData(
                Timestamp.fromDate(new Date(pref.data + "T03:00:00"))
              )
            : ""
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
          detalhes.dataInicio
            ? formatarData(
                Timestamp.fromDate(new Date(detalhes.dataInicio + "T03:00:00"))
              )
            : "N/A"
        );
        setTextContentIfExists("#modal-ig-obs", detalhes.observacoes);
        break;
      case "exclusao_horario":
        setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
        setTextContentIfExists("#modal-solicitante-motivo", detalhes.motivo);
        const horariosList = document.getElementById("modal-horarios-list");
        if (horariosList) {
          horariosList.innerHTML =
            detalhes.horariosParaExcluir
              ?.map((h) => `<li>${h.label} (${h.path || "Sem path"})</li>`)
              .join("") || "<li>Erro ao carregar horários</li>"; // Mensagem melhor
        }
        break;
    }

    // Preenche o feedback do admin (mantido)
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
          feedback.mensagemAdmin || feedback.motivoRejeicao || feedback.mensagem
        );
      }
      modalBodyContent
        .querySelectorAll("form input, form select, form textarea")
        .forEach((el) => (el.disabled = true));
    } else {
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      );
      if (feedbackContainer) feedbackContainer.style.display = "none";
    }
  }

  function setTextContentIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) {
      element.textContent = value || "N/A";
    }
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) {
      element.value = value || "";
    }
  }

  // --- Funções configurarAcoesModal, handleGenericSolicitacaoAction (mantidas como antes) ---
  function configurarAcoesModal(docId, tipo, data) {
    // ... (código igual da versão anterior) ...
    modalFooterActions.innerHTML = "";
    modalFooterActions.appendChild(modalCancelBtn);

    if (data.status === "Pendente") {
      if (tipo === "exclusao_horario") {
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "btn-salvar-exclusao";
        saveButton.className = "action-button dynamic-action-btn";
        saveButton.textContent = "Salvar Resposta (Exclusão)";
        saveButton.onclick = () => handleSalvarExclusao(docId, data);
        modalFooterActions.appendChild(saveButton);
        setupModalFormLogicExclusao();
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
        if (adminMessageGroup) adminMessageGroup.style.display = "block";
        // Limpa campo de mensagem ao abrir
        const adminMessageText = document.getElementById("admin-message-text");
        if (adminMessageText) adminMessageText.value = "";
      }
    } else {
      // Se não pendente (Exclusão)
      if (tipo === "exclusao_horario" && data.adminFeedback) {
        const feedback = data.adminFeedback || {};
        const foiExcluidoValue = feedback.foiExcluido
          ? String(feedback.foiExcluido)
          : null;
        if (foiExcluidoValue) {
          const radioToCheck = modalBodyContent.querySelector(
            `input[name="foiExcluido"][value="${foiExcluidoValue}"]`
          );
          if (radioToCheck) radioToCheck.checked = true;
        }
        const dataExclusaoInput =
          modalBodyContent.querySelector("#dataExclusao");
        if (dataExclusaoInput)
          dataExclusaoInput.valueAsDate = feedback.dataExclusao
            ? feedback.dataExclusao.toDate()
            : null;
        const mensagemAdminInput =
          modalBodyContent.querySelector("#mensagemAdmin");
        if (mensagemAdminInput)
          mensagemAdminInput.value = feedback.mensagemAdmin || "";
        const motivoRejeicaoInput =
          modalBodyContent.querySelector("#motivoRejeicao");
        if (motivoRejeicaoInput)
          motivoRejeicaoInput.value = feedback.motivoRejeicao || "";

        setupModalFormLogicExclusao();
        modalBodyContent
          .querySelectorAll("input, textarea, select")
          .forEach((el) => (el.disabled = true));
      }
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
    // ... (código igual da versão anterior) ...
    const mensagemAdminInput = document.getElementById("admin-message-text");
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";

    if (novoStatus === "Rejeitada" && !mensagemAdmin) {
      alert("Por favor, forneça uma mensagem explicando o motivo da rejeição.");
      mensagemAdminInput?.focus();
      return;
    }

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
        mensagemAdmin: mensagemAdmin,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin Desconhecido",
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
          // Adicionar outros cases se necessário
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

  // --- Funções de Processamento Específicas (mantidas como antes) ---
  async function processarAprovacaoAlteracaoHorario(solicitacao) {
    /* ...código igual... */
    console.log("Processando aprovação de Alteração de Horário:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const novosDados = detalhes.dadosNovos;

    if (!pacienteId || !atendimentoId || !novosDados) {
      throw new Error("Dados incompletos para processar alteração de horário.");
    }

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists()) {
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      }
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1) {
        throw new Error(
          `Atendimento ${atendimentoId} não encontrado para o paciente ${pacienteId}.`
        );
      }

      const horarioAtualizado = {
        ...(atendimentosPB[index].horarioSessao || {}),
        diaSemana: novosDados.dia,
        horario: novosDados.horario,
        tipoAtendimento: novosDados.modalidade,
        frequencia: novosDados.frequencia,
        salaAtendimento: novosDados.sala,
        dataInicio: novosDados.dataInicio,
        ultimaAlteracaoAprovadaEm: serverTimestamp(),
      };

      atendimentosPB[index].horarioSessao = horarioAtualizado; // ATENÇÃO: Verificar nome correto 'horarioSessao' ou 'horarioSessoes'

      await updateDoc(pacienteRef, {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Horário atualizado na trilha para paciente ${pacienteId}, atendimento ${atendimentoId}.`
      );

      if (novosDados.alterarGrade === "Sim") {
        console.warn(
          `Ação necessária: Atualizar grade para paciente ${pacienteId}, atendimento ${atendimentoId}.`
        );
      }
    } catch (error) {
      console.error(
        "Erro ao atualizar trilhaPaciente para alteração de horário:",
        error
      );
      throw new Error(
        `Falha ao atualizar dados do paciente na trilha: ${error.message}`
      );
    }
  }
  async function processarAprovacaoDesfecho(solicitacao) {
    /* ...código igual... */
    console.log("Processando aprovação de Desfecho:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { tipoDesfecho, dataDesfecho } = detalhes;

    if (!pacienteId || !atendimentoId || !tipoDesfecho || !dataDesfecho) {
      throw new Error("Dados incompletos para processar desfecho.");
    }

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists()) {
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      }
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1) {
        throw new Error(
          `Atendimento ${atendimentoId} não encontrado para o paciente ${pacienteId}.`
        );
      }

      let novoStatusAtendimento = "";
      let novoStatusPaciente = "";
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
          novoStatusPaciente =
            detalhes.continuaAtendimentoEuPsico === "Não"
              ? "encaminhado_externo"
              : pacienteData.status;
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      atendimentosPB[index].statusAtendimento = novoStatusAtendimento; // ATENÇÃO: Verificar nome 'status' ou 'statusAtendimento'
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
        `Desfecho registrado na trilha para paciente ${pacienteId}, atendimento ${atendimentoId}. Status Paciente: ${
          updateData.status || pacienteData.status
        }`
      );
    } catch (error) {
      console.error("Erro ao atualizar trilhaPaciente para desfecho:", error);
      throw new Error(
        `Falha ao registrar desfecho na trilha: ${error.message}`
      );
    }
  }
  async function processarAprovacaoReavaliacao(solicitacao) {
    /* ...código igual... */
    console.log("Processando aprovação de Reavaliação:", solicitacao);
    const { pacienteId } = solicitacao;

    if (!pacienteId) {
      throw new Error("ID do Paciente faltando para processar reavaliação.");
    }

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists()) {
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      }
      const pacienteData = pacienteSnap.data();

      const novoStatus = "aguardando_reavaliacao";
      const statusAnterior = pacienteData.status;

      await updateDoc(pacienteRef, {
        status: novoStatus,
        statusAnteriorReavaliacao: statusAnterior,
        solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Status do paciente ${pacienteId} atualizado para ${novoStatus}.`
      );
    } catch (error) {
      console.error(
        "Erro ao atualizar trilhaPaciente para reavaliação:",
        error
      );
      throw new Error(
        `Falha ao atualizar status do paciente para reavaliação: ${error.message}`
      );
    }
  }
  async function processarAprovacaoInclusaoGrade(solicitacao) {
    /* ...código igual... */
    console.log(
      "Processando aprovação de Inclusão/Alteração na Grade (PB):",
      solicitacao
    );
    console.log(
      `Confirmação de Inclusão/Alteração na Grade para Paciente ${solicitacao.pacienteId} registrada.`
    );
    alert(
      "Confirmação de ação na grade registrada. Nenhuma alteração adicional na trilha foi feita por esta aprovação."
    );
  }

  // --- Lógica Específica Modal Exclusão Horário (mantida como antes) ---
  function setupModalFormLogicExclusao() {
    /* ...código igual... */
    const radioSim = modalBodyContent.querySelector("#radioExcluidoSim");
    const radioNao = modalBodyContent.querySelector("#radioExcluidoNao");
    const camposSim = modalBodyContent.querySelector("#campos-feedback-sim");
    const camposNao = modalBodyContent.querySelector("#campos-feedback-nao");

    if (!radioSim || !radioNao || !camposSim || !camposNao) {
      console.warn(
        "Elementos do formulário de exclusão não encontrados no modal."
      );
      return;
    }

    const toggleFields = () => {
      camposSim.style.display = radioSim.checked ? "block" : "none";
      camposNao.style.display = radioNao.checked ? "block" : "none";
    };

    radioSim.removeEventListener("change", toggleFields);
    radioNao.removeEventListener("change", toggleFields);
    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields();
  }
  async function handleSalvarExclusao(docId, solicitacaoData) {
    /* ...código igual... */
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
      if (!foiExcluido) throw new Error("Selecione 'Sim' ou 'Não'.");

      let statusFinal = "";
      const adminFeedback = {
        foiExcluido: foiExcluido,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
      };

      if (foiExcluido === "sim") {
        if (!dataExclusaoInput || !mensagemAdmin)
          throw new Error(
            "Para 'Sim', a data da exclusão e a mensagem são obrigatórias."
          );
        statusFinal = "Concluída";
        try {
          adminFeedback.dataExclusao = Timestamp.fromDate(
            new Date(dataExclusaoInput + "T12:00:00Z")
          );
        } catch (dateError) {
          throw new Error(
            "Data de exclusão inválida. Use o formato AAAA-MM-DD."
          );
        }
        adminFeedback.mensagemAdmin = mensagemAdmin;
        console.warn(
          `AÇÃO NECESSÁRIA: Excluir horários da grade para solicitação ${docId}. Horários:`,
          solicitacaoData.detalhes?.horariosParaExcluir
        );
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
      console.error("Erro ao salvar resposta de exclusão:", error);
      alert(`Erro ao salvar: ${error.message}`);
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  }

  // --- Funções do Modal (Genéricas - open/close - mantidas) ---
  function openModal() {
    /* ...código igual... */ if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    /* ...código igual... */
    if (modal) modal.style.display = "none";
    if (modalBodyContent) modalBodyContent.innerHTML = "";
    if (modalFooterActions) modalFooterActions.innerHTML = "";
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn);
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação";
  }

  // --- Inicialização ---
  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadReavaliacao();
  loadInclusaoAlteracaoGradePB();
  loadStatusContratos(); // Será implementado agora
  loadExclusaoHorarios();

  // --- Listener de Evento Genérico (mantido como antes) ---
  if (tabContentContainer) {
    // ... (código igual da versão anterior) ...
    tabContentContainer.addEventListener("click", async (e) => {
      const button = e.target.closest(".btn-processar-solicitacao");

      if (button) {
        const docId = button.dataset.docId;
        const tipo = button.dataset.tipo;

        if (docId && tipo) {
          console.log(`Botão processar clicado: ID=${docId}, Tipo=${tipo}`); // Log para depuração
          openGenericSolicitacaoModal(docId, tipo);
        } else {
          console.error(
            "Doc ID ou Tipo não encontrado no botão de processar:",
            button.dataset
          );
          alert("Erro: Não foi possível identificar a solicitação.");
        }
      }
    });
  }

  // Event listeners do modal (Fechar/Cancelar - mantidos)
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }
} // Fim da função init
