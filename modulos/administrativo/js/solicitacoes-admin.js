// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO FINAL COMPLETA (Unificada e sem abreviações) ---

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
  serverTimestamp,
  onSnapshot,
  Timestamp,
  // addDoc, // Descomente se for usar a coleção 'notificacoes' para o botão "Notificar"
} from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser;

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
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)",
  };
  return mapaTipos[tipoInterno] || tipoInterno;
}

// Função principal de inicialização
export function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.FINAL COMPLETA iniciado."
  );
  adminUser = userData;

  // Seletores DOM
  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector("#tab-content-container"); // Seletor ID correto

  // Configuração Abas
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
    // Ativa a primeira aba por padrão
    if (tabLinks.length > 0 && !document.querySelector(".tab-link.active")) {
      tabLinks[0].click();
    }
  }

  // --- Função Genérica: Carregar Solicitações da Coleção Central ---
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
        `Elementos do DOM não encontrados para [${tipoSolicitacao}]. Verifique IDs: ${tableBodyId}, ${emptyStateId}, ${countBadgeId}`
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
                tableBody.appendChild(tr);
              } else {
                tableBody.innerHTML += tr; // Fallback
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
      // TODO: Gerenciar 'unsubscribe' ao sair da página para evitar memory leaks
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

  function loadReavaliacao() {
    loadSolicitacoesPorTipo(
      "reavaliacao",
      "table-body-reavaliacao",
      "empty-state-reavaliacao",
      "count-reavaliacao",
      renderReavaliacaoRow,
      8
    );
  }

  function loadInclusaoAlteracaoGradePB() {
    loadSolicitacoesPorTipo(
      "inclusao_alteracao_grade",
      "table-body-inclusao-grade-pb",
      "empty-state-inclusao-grade-pb",
      "count-inclusao-grade-pb",
      renderInclusaoAlteracaoGradePBRow,
      9
    );
  }

  // --- loadStatusContratos (Incluindo botão de notificação) ---
  async function loadStatusContratos() {
    console.log("Carregando Status Contratos...");
    const tableBodyId = "table-body-status-contratos";
    const emptyStateId = "empty-state-status-contratos";
    const countBadgeId = "count-status-contratos";
    const colspan = 5; // Paciente, Profissional, Status, Atualização, Ações

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
      const qPb = query(
        collection(dbInstance, "trilhaPaciente"),
        where("status", "==", "em_atendimento_pb")
      );
      const qCadastrar = query(
        collection(dbInstance, "trilhaPaciente"),
        where("status", "==", "cadastrar_horario_psicomanager")
      );

      const [pbSnapshot, cadastrarSnapshot] = await Promise.all([
        getDocs(qPb),
        getDocs(qCadastrar),
      ]);

      let pendingContracts = [];
      const processedPacientes = new Set();

      const processSnapshot = (snapshot) => {
        snapshot.forEach((doc) => {
          const pacienteId = doc.id;
          if (processedPacientes.has(pacienteId)) return;
          processedPacientes.add(pacienteId);
          const pacienteData = doc.data();
          const atendimentosAtivos =
            pacienteData.atendimentosPB?.filter(
              (at) => at.statusAtendimento === "ativo"
            ) || [];

          atendimentosAtivos.forEach((atendimento) => {
            if (!atendimento.contratoAssinado) {
              pendingContracts.push({
                pacienteId: pacienteId,
                pacienteNome:
                  pacienteData.nomeCompleto || "Nome não encontrado",
                profissionalNome:
                  atendimento.profissionalNome || "Profissional não encontrado",
                profissionalId: atendimento.profissionalId || null,
                statusContrato: "Pendente",
                lastUpdate: pacienteData.lastUpdate,
              });
            }
          });
        });
      };

      processSnapshot(pbSnapshot);
      processSnapshot(cadastrarSnapshot);

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
                                    data-paciente-id="${item.pacienteId}" 
                                    data-paciente-nome="${item.pacienteNome}"
                                    data-profissional-id="${item.profissionalId}"
                                    data-profissional-nome="${item.profissionalNome}"
                                    title="Notificar profissional sobre contrato pendente">
                                Notificar
                            </button>
                        </td>
                      `;
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

  // --- Função loadExclusaoHorarios (Lê da coleção 'solicitacoes') ---
  function loadExclusaoHorarios() {
    console.log(
      "Carregando solicitações de exclusão da coleção 'solicitacoes'..."
    );
    loadSolicitacoesPorTipo(
      "exclusao_horario",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      renderExclusaoHorarioRow,
      7
    );
  }

  // --- Funções de Renderização ---

  function renderNovasSessoesRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioFormatada = detalhes.dataInicioPreferencial
      ? formatarData(
          Timestamp.fromDate(
            new Date(detalhes.dataInicioPreferencial + "T03:00:00")
          )
        )
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
      ? formatarData(
          Timestamp.fromDate(new Date(novos.dataInicio + "T03:00:00"))
        )
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
      ? formatarData(
          Timestamp.fromDate(new Date(detalhes.dataDesfecho + "T03:00:00"))
        )
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
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
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
    const dataPrefFormatada = pref.data
      ? formatarData(Timestamp.fromDate(new Date(pref.data + "T03:00:00")))
      : "N/A";
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
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="reavaliacao">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
    `;
    return tr;
  }

  function renderInclusaoAlteracaoGradePBRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataInicioFormatada = detalhes.dataInicio
      ? formatarData(
          Timestamp.fromDate(new Date(detalhes.dataInicio + "T03:00:00"))
        )
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
        <td>${detalhes.modalidade || detalhes.tipoAtendimento || "N/A"}</td>
        <td>${detalhes.salaAtendimento || "N/A"}</td>
        <td>${dataInicioFormatada}</td>
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
            <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="inclusao_alteracao_grade">
                ${data.status === "Pendente" ? "Processar" : "Ver"}
            </button>
        </td>
    `;
    return tr;
  }

  function renderExclusaoHorarioRow(data, docId) {
    const detalhes = data.detalhes || {}; // Acessa dados dentro de 'detalhes'
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
        <td>
          <button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="exclusao_horario">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
    `;
    return tr;
  }

  // --- Lógica do Modal Genérico ---
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
      const solicitacaoData = docSnap.data();

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
        case "reavaliacao":
          modalHtmlPath += "modal-reavaliacao.html";
          break;
        case "inclusao_alteracao_grade":
          modalHtmlPath += "modal-inclusao-alteracao-grade.html";
          break;
        case "exclusao_horario":
          modalHtmlPath += "modal-exclusao-grade.html";
          break; // Reutiliza
        default:
          throw new Error(`Tipo de solicitação desconhecido: ${tipo}`);
      }

      console.log("Tentando carregar modal de:", modalHtmlPath);
      const response = await fetch(modalHtmlPath);
      if (!response.ok)
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}). Verifique o caminho.`
        );
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

  // --- Funções Auxiliares do Modal ---
  function preencherCamposModal(tipo, data) {
    const detalhes = data.detalhes || {};
    setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
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
                  Timestamp.fromDate(
                    new Date(detalhes.dataInicio + "T03:00:00")
                  )
                )
              : "N/A"
          );
          setTextContentIfExists("#modal-ig-obs", detalhes.observacoes);
          break;
        case "exclusao_horario": // Lê de 'detalhes'
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
          } else {
            console.warn(
              "Elemento #modal-horarios-list não encontrado no HTML de exclusão."
            );
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

    // Preenche feedback se já houver
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
      // Desabilita campos de input
      modalBodyContent
        .querySelectorAll("input:not([type=hidden]), select, textarea")
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
    if (element) element.textContent = value ?? "N/A";
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) element.value = value ?? "";
  }

  // --- Configura Ações e Handlers do Modal ---
  function configurarAcoesModal(docId, tipo, data) {
    modalFooterActions.innerHTML = "";
    modalFooterActions.appendChild(modalCancelBtn);

    if (data.status === "Pendente") {
      if (tipo === "exclusao_horario") {
        // Botão específico para salvar resposta de exclusão
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "btn-salvar-exclusao";
        saveButton.className = "action-button dynamic-action-btn";
        saveButton.textContent = "Salvar Resposta (Exclusão)";
        saveButton.onclick = () => handleSalvarExclusao(docId, data);
        modalFooterActions.appendChild(saveButton);
        setupModalFormLogicExclusao(); // Habilita lógica do form Sim/Não
      } else {
        // Botões padrão Aprovar/Rejeitar
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

        // Mostra campo de mensagem para Admin
        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        );
        if (adminMessageGroup) {
          adminMessageGroup.style.display = "block";
          const adminMessageText = adminMessageGroup.querySelector(
            "#admin-message-text"
          );
          if (adminMessageText) adminMessageText.value = ""; // Limpa ao abrir
        } else {
          console.warn(
            "Elemento #modal-admin-message-group não encontrado no HTML do modal."
          );
        }
      }
    } else {
      // Se não está Pendente (já processada)
      if (tipo === "exclusao_horario" && data.adminFeedback) {
        // Preenche os campos do form de exclusão com a resposta anterior
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
        setValueIfExists(
          "#dataExclusao",
          feedback.dataExclusao
            ? feedback.dataExclusao.toDate().toISOString().split("T")[0]
            : ""
        );
        setValueIfExists("#mensagemAdmin", feedback.mensagemAdmin);
        setValueIfExists("#motivoRejeicao", feedback.motivoRejeicao);
        setupModalFormLogicExclusao(); // Aplica a lógica Sim/Não para mostrar os campos corretos
        // Desabilita todos os campos do form de exclusão
        modalBodyContent
          .querySelectorAll("input:not([type=hidden]), select, textarea")
          .forEach((el) => (el.disabled = true));
      }
      // Esconde o campo de *nova* mensagem do admin
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
        mensagemAdmin: mensagemAdmin, // Será vazia se aprovado sem msg
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

      // Executa ações específicas PÓS-aprovação (atualizar trilha, etc.)
      if (novoStatus === "Aprovada") {
        console.log("Executando ações de aprovação para:", tipo);
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
          // Não há ação automática para novas_sessoes ou exclusao_horario (Admin faz manualmente)
          default:
            console.log(
              `Nenhuma ação de aprovação específica definida para tipo: ${tipo}`
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
      alert(`Erro ao processar: ${error.message}`); // Mostra erro específico (ex: da trilha)
      // Reabilita botões em caso de erro
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  }

  // --- Funções de Processamento Específicas Pós-Aprovação ---
  async function processarAprovacaoAlteracaoHorario(solicitacao) {
    console.log("Processando aprovação de Alteração de Horário:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const novosDados = detalhes.dadosNovos;
    if (!pacienteId || !atendimentoId || !novosDados)
      throw new Error("Dados incompletos para processar alteração de horário.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1) {
        // Tenta fallback pelo ID do profissional (menos seguro)
        const fallbackIndex = atendimentosPB.findIndex(
          (at) =>
            at.profissionalId === solicitacao.solicitanteId &&
            at.statusAtendimento === "ativo"
        );
        if (fallbackIndex === -1)
          throw new Error(
            `Atendimento ativo não encontrado para o profissional ${solicitacao.solicitanteNome} no paciente ${pacienteId}.`
          );
        console.warn(
          `Atendimento ID ${atendimentoId} não encontrado, usando fallback pelo profissionalId.`
        );
        // Idealmente, o atendimentoId deve estar correto na solicitação. Lançar erro é mais seguro.
        throw new Error(`Atendimento ID ${atendimentoId} não encontrado.`);
      }

      // ATENÇÃO: Verifique o nome correto do campo ('horarioSessao' ou 'horarioSessoes')
      const nomeCampoHorario = "horarioSessoes"; // <<< AJUSTE AQUI SE NECESSÁRIO
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
        console.warn(
          `AÇÃO NECESSÁRIA: Atualizar grade manualmente para paciente ${pacienteId}, atendimento ${atendimentoId}.`
        );
        // Aqui poderia chamar uma Cloud Function se a lógica for complexa
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
    console.log("Processando aprovação de Desfecho:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { tipoDesfecho, dataDesfecho } = detalhes;
    if (!pacienteId || !atendimentoId || !tipoDesfecho || !dataDesfecho)
      throw new Error("Dados incompletos para processar desfecho.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      const pacienteData = pacienteSnap.data();
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (index === -1) {
        const fallbackIndex = atendimentosPB.findIndex(
          (at) =>
            at.profissionalId === solicitacao.solicitanteId &&
            at.statusAtendimento === "ativo"
        );
        if (fallbackIndex === -1)
          throw new Error(
            `Atendimento ativo não encontrado para o profissional ${solicitacao.solicitanteNome} no paciente ${pacienteId}.`
          );
        console.warn(
          `Atendimento ID ${atendimentoId} não encontrado para desfecho, usando fallback.`
        );
        throw new Error(`Atendimento ID ${atendimentoId} não encontrado.`);
      }

      // ATENÇÃO: Verifique o nome correto do campo ('status' ou 'statusAtendimento')
      const nomeCampoStatusAtendimento = "statusAtendimento"; // <<< AJUSTE AQUI SE NECESSÁRIO
      let novoStatusAtendimento = "";
      let novoStatusPaciente = pacienteData.status; // Mantém por padrão

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
          if (detalhes.continuaAtendimentoEuPsico === "Não")
            novoStatusPaciente = "encaminhado_externo";
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      // Atualiza o status do ATENDIMENTO específico
      atendimentosPB[index][nomeCampoStatusAtendimento] = novoStatusAtendimento;
      // Adiciona informações do desfecho ao atendimento
      atendimentosPB[index].desfecho = {
        ...detalhes,
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };

      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      };
      // Atualiza o status GERAL do paciente, se necessário
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
    console.log("Processando aprovação de Reavaliação:", solicitacao);
    const { pacienteId } = solicitacao;
    if (!pacienteId)
      throw new Error("ID do Paciente faltando para processar reavaliação.");

    const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
    try {
      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists())
        throw new Error(`Paciente ${pacienteId} não encontrado na trilha.`);
      const pacienteData = pacienteSnap.data();

      const novoStatus = "aguardando_reavaliacao";
      const statusAnterior = pacienteData.status;

      if (pacienteData.status !== novoStatus) {
        await updateDoc(pacienteRef, {
          status: novoStatus,
          statusAnteriorReavaliacao: statusAnterior, // Salva o status anterior
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Status do paciente ${pacienteId} atualizado para ${novoStatus}. Status anterior (${statusAnterior}) salvo.`
        );
      } else {
        // Se já estava aguardando, apenas atualiza o timestamp
        await updateDoc(pacienteRef, {
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Paciente ${pacienteId} já estava aguardando reavaliação. Timestamp de aprovação atualizado.`
        );
      }
      // TODO: Adicionar lógica para notificar o Serviço Social, se necessário.
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
    // Geralmente, a inclusão/alteração na grade é uma ação manual do admin após aprovar.
    // Esta função serve mais como um log/confirmação.
    console.log(
      "Processando aprovação de Inclusão/Alteração na Grade (PB):",
      solicitacao
    );
    console.log(
      `Confirmação de Inclusão/Alteração na Grade para Paciente ${
        solicitacao.pacienteId || "N/A"
      } registrada.`
    );
    // alert("Confirmação de ação na grade registrada. Lembre-se de realizar a alteração manualmente se necessário.");
  }

  // --- Lógica Específica Modal Exclusão Horário ---
  function setupModalFormLogicExclusao() {
    // Mostra/Esconde campos dependendo se foi excluído (Sim) ou rejeitado (Não)
    const radioSim = modalBodyContent.querySelector("#radioExcluidoSim");
    const radioNao = modalBodyContent.querySelector("#radioExcluidoNao");
    const camposSim = modalBodyContent.querySelector("#campos-feedback-sim");
    const camposNao = modalBodyContent.querySelector("#campos-feedback-nao");

    if (!radioSim || !radioNao || !camposSim || !camposNao) {
      console.warn(
        "Elementos do formulário de exclusão (Sim/Não) não encontrados no modal."
      );
      return;
    }

    const toggleFields = () => {
      if (camposSim)
        camposSim.style.display = radioSim.checked ? "block" : "none";
      if (camposNao)
        camposNao.style.display = radioNao.checked ? "block" : "none";
    };

    // Usa change em vez de click para radios
    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields(); // Define estado inicial ao carregar o modal
  }

  async function handleSalvarExclusao(docId, solicitacaoData) {
    // Salva a resposta do Admin para uma solicitação de exclusão
    const saveButton = document.getElementById("btn-salvar-exclusao");
    if (!saveButton) {
      console.error("Botão #btn-salvar-exclusao não encontrado.");
      return;
    }
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="loading-spinner-small"></span> Salvando...`;

    // Busca valores dos campos DENTRO do modal
    const foiExcluido = modalBodyContent.querySelector(
      'input[name="foiExcluido"]:checked'
    )?.value; // "sim" ou "nao"
    const dataExclusaoInput =
      modalBodyContent.querySelector("#dataExclusao")?.value; // YYYY-MM-DD
    const mensagemAdmin =
      modalBodyContent.querySelector("#mensagemAdmin")?.value; // Mensagem se Sim
    const motivoRejeicao =
      modalBodyContent.querySelector("#motivoRejeicao")?.value; // Mensagem se Nao

    try {
      if (!foiExcluido)
        throw new Error(
          "Selecione se o horário foi excluído ('Sim') ou a solicitação foi rejeitada ('Não')."
        );

      let statusFinal = "";
      const adminFeedback = {
        foiExcluido: foiExcluido, // Armazena "sim" ou "nao"
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
      };

      if (foiExcluido === "sim") {
        if (!dataExclusaoInput || !mensagemAdmin)
          throw new Error(
            "Para 'Sim', a data da exclusão e a mensagem de confirmação são obrigatórias."
          );
        statusFinal = "Concluída";
        try {
          // Tenta criar data. Adiciona hora fixa UTC para evitar problemas de fuso no input date
          const dateObj = new Date(dataExclusaoInput + "T12:00:00Z");
          if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
          adminFeedback.dataExclusao = Timestamp.fromDate(dateObj); // Salva como Timestamp
        } catch (dateError) {
          throw new Error(
            "Data de exclusão inválida. Use o formato AAAA-MM-DD."
          );
        }
        adminFeedback.mensagemAdmin = mensagemAdmin; // Mensagem de confirmação
        console.warn(
          `AÇÃO NECESSÁRIA: Excluir horários da grade manualmente para solicitação ${docId}. Horários:`,
          solicitacaoData.detalhes?.horariosParaExcluir
        );
        // Aqui poderia chamar uma Cloud Function para tentar excluir automaticamente, se implementado.
      } else {
        // foiExcluido === "nao"
        if (!motivoRejeicao)
          throw new Error("Para 'Não', o motivo da rejeição é obrigatório.");
        statusFinal = "Rejeitada";
        adminFeedback.motivoRejeicao = motivoRejeicao; // Mensagem de rejeição
      }

      // Atualiza o documento na coleção 'solicitacoes'
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
      // Reabilita o botão em caso de erro
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  }

  // --- Função para Notificar Contrato Pendente ---
  async function handleNotificarContrato(
    pacienteId,
    pacienteNome,
    profissionalId,
    profissionalNome
  ) {
    console.log(
      `Tentando notificar ${profissionalNome} (ID: ${profissionalId}) sobre contrato pendente do paciente ${pacienteNome} (ID: ${pacienteId})`
    );
    const confirmacao = confirm(
      `Deseja realmente enviar uma notificação para ${profissionalNome} sobre o contrato pendente do paciente ${pacienteNome}?`
    );
    if (!confirmacao) {
      console.log("Notificação cancelada pelo admin.");
      return;
    }

    // --- IMPLEMENTAÇÃO DA NOTIFICAÇÃO ---
    // A forma de notificar depende da arquitetura:
    // Opção 1: Criar um documento numa coleção 'notificacoes' para o profissional ler.
    // Opção 2: Enviar um email/push (requer configuração adicional ou Cloud Function).
    // Opção 3: Adicionar um campo no perfil do profissional.

    // Exemplo Opção 1 (requer 'addDoc' importado e coleção 'notificacoes'):
    /*
        try {
          const notificacaoRef = collection(dbInstance, "notificacoes");
          await addDoc(notificacaoRef, {
            paraUsuarioId: profissionalId,
            tipo: "aviso_contrato_pendente",
            titulo: "Contrato Terapêutico Pendente",
            mensagem: `Olá, ${profissionalNome}. Por favor, verifique o envio do contrato terapêutico para assinatura do paciente ${pacienteNome}.`,
            dataEnvio: serverTimestamp(),
            lida: false,
            pacienteId: pacienteId, // Link opcional para o paciente
            criadoPorNome: adminUser.nome || "Admin",
            criadoPorId: adminUser.uid || "N/A"
          });
          alert("Notificação enviada com sucesso!");
        } catch (error) {
          console.error("Erro ao enviar notificação de contrato:", error);
          alert(`Erro ao tentar enviar notificação: ${error.message}`);
        }
        */

    // Implementação Provisória (Placeholder - REMOVA QUANDO IMPLEMENTAR A OPÇÃO ACIMA)
    console.warn(
      "Ação 'enviar mensagem' (handleNotificarContrato) executada, mas a lógica de envio (ex: addDoc para 'notificacoes') precisa ser implementada."
    );
    alert(
      `Notificação para ${profissionalNome} registrada (simulação). Implemente a lógica de envio real em handleNotificarContrato.`
    );
  }

  // --- Funções Genéricas do Modal (Abrir/Fechar) ---
  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
    if (modalBodyContent) modalBodyContent.innerHTML = ""; // Limpa conteúdo
    if (modalFooterActions) modalFooterActions.innerHTML = ""; // Limpa botões dinâmicos
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn); // Readiciona Cancelar
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação";
  }

  // --- Inicialização ---
  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadReavaliacao();
  loadInclusaoAlteracaoGradePB();
  loadStatusContratos();
  loadExclusaoHorarios();

  // --- Listener de Evento Principal (Delegação de Eventos) ---
  if (tabContentContainer) {
    console.log(
      "Listener de clique principal anexado com sucesso a #tab-content-container."
    );
    tabContentContainer.addEventListener("click", async (e) => {
      // Delegação para botões "Processar"
      const processarButton = e.target.closest(".btn-processar-solicitacao");
      if (processarButton) {
        e.preventDefault();
        const docId = processarButton.dataset.docId;
        const tipo = processarButton.dataset.tipo;
        if (docId && tipo) {
          console.log(`Botão processar clicado: ID=${docId}, Tipo=${tipo}`);
          openGenericSolicitacaoModal(docId, tipo);
        } else {
          console.error(
            "Doc ID ou Tipo não encontrado no botão de processar:",
            processarButton.dataset
          );
          alert("Erro: Não foi possível identificar a solicitação.");
        }
      }

      // Delegação para botões "Notificar Contrato"
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
          console.error(
            "ID do Profissional inválido:",
            notificarButton.dataset
          );
          alert(
            "Erro: ID do profissional não encontrado neste registro. Não é possível notificar."
          );
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
    // Este erro não deve mais ocorrer pois o seletor foi corrigido
    console.error(
      "FALHA CRÍTICA: Container de conteúdo das abas #tab-content-container não encontrado. Listeners de clique não funcionarão."
    );
  }

  // --- Event Listeners do Modal (Fechar/Cancelar) ---
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  else console.warn("Botão de fechar modal (X) não encontrado.");

  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  else console.warn("Botão de cancelar modal não encontrado.");

  if (modal) {
    // Fecha modal se clicar fora da caixa de conteúdo
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  } else {
    console.error(
      "Elemento do modal principal #solicitacao-details-modal não encontrado."
    );
  }
} // Fim da função init
