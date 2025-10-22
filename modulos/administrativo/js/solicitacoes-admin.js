// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO FINAL COMPLETA (WhatsApp implementado) ---

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc, // Necessário para buscar o telefone
  getDoc, // Necessário para buscar o telefone
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  // addDoc, // Se fosse usar a coleção 'notificacoes'
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
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.WHATSAPP iniciado."
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
  const tabContentContainer = document.querySelector("#tab-content-container");

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
      // TODO: Gerenciar unsubscribe
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
    tr.innerHTML = `<td>${dataSol}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${data.pacienteNome || "N/A"}</td><td>${
      detalhes.diaSemana || "N/A"
    }, ${detalhes.horario || "N/A"} (${
      detalhes.modalidade || "N/A"
    })</td><td>${dataInicioFormatada}</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="novas_sessoes">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
    tr.innerHTML = `<td>${dataSol}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${data.pacienteNome || "N/A"}</td><td>${antigos.dia || "N/A"}, ${
      antigos.horario || "N/A"
    } (${antigos.modalidade || "N/A"})</td><td>${novos.dia || "N/A"}, ${
      novos.horario || "N/A"
    } (${
      novos.modalidade || "N/A"
    })</td><td>${dataInicioNova}</td><td class="motivo-cell">${
      detalhes.justificativa || "N/A"
    }</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="alteracao_horario">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
    tr.innerHTML = `<td>${dataSol}</td><td>${dataDesf}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${data.pacienteNome || "N/A"}</td><td>${
      detalhes.tipoDesfecho || "N/A"
    }</td><td class="motivo-cell">${
      detalhes.motivo || detalhes.motivoEncaminhamento || "N/A"
    }</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="desfecho">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
    tr.innerHTML = `<td>${dataSol}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${data.pacienteNome || "N/A"}</td><td>${
      detalhes.valorContribuicaoAtual || "N/A"
    }</td><td class="motivo-cell">${
      detalhes.motivo || "N/A"
    }</td><td>${dataPrefFormatada} ${pref.hora || ""} (${
      pref.modalidade || "N/A"
    })</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="reavaliacao">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
    tr.innerHTML = `<td>${dataSol}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${data.pacienteNome || "N/A"}</td><td>${
      detalhes.diaSemana || "N/A"
    }</td><td>${detalhes.horario || "N/A"}</td><td>${
      detalhes.modalidade || detalhes.tipoAtendimento || "N/A"
    }</td><td>${
      detalhes.salaAtendimento || "N/A"
    }</td><td>${dataInicioFormatada}</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="inclusao_alteracao_grade">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
    tr.innerHTML = `<td>${dataSol}</td><td>${
      data.solicitanteNome || "N/A"
    }</td><td>${
      detalhes.totalHorariosAtual ?? "N/A"
    }</td><td>${horariosLabels}</td><td class="motivo-cell">${
      detalhes.motivo || "N/A"
    }</td><td><span class="status-badge ${statusClass}">${
      data.status
    }</span></td><td><button class="action-button btn-processar-solicitacao" data-doc-id="${docId}" data-tipo="exclusao_horario">${
      data.status === "Pendente" ? "Processar" : "Ver"
    }</button></td>`;
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
          break;
        default:
          throw new Error(`Tipo de solicitação desconhecido: ${tipo}`);
      }
      console.log("Tentando carregar modal de:", modalHtmlPath);
      const response = await fetch(modalHtmlPath);
      if (!response.ok)
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}).`
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
        if (adminMessageGroup) {
          adminMessageGroup.style.display = "block";
          const adminMessageText = adminMessageGroup.querySelector(
            "#admin-message-text"
          );
          if (adminMessageText) adminMessageText.value = "";
        } else {
          console.warn("#modal-admin-message-group não encontrado.");
        }
      }
    } else {
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
        setValueIfExists(
          "#dataExclusao",
          feedback.dataExclusao
            ? feedback.dataExclusao.toDate().toISOString().split("T")[0]
            : ""
        );
        setValueIfExists("#mensagemAdmin", feedback.mensagemAdmin);
        setValueIfExists("#motivoRejeicao", feedback.motivoRejeicao);
        setupModalFormLogicExclusao();
        modalBodyContent
          .querySelectorAll("input:not([type=hidden]), select, textarea")
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
    const mensagemAdminInput = document.getElementById("admin-message-text");
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";
    if (novoStatus === "Rejeitada" && !mensagemAdmin) {
      alert("Forneça o motivo da rejeição.");
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
            console.log(`Nenhuma ação pós-aprovação para tipo: ${tipo}`);
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
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );
      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );
      const nomeCampoHorario = "horarioSessoes"; // Ajuste se necessário
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
      if (novosDados.alterarGrade === "Sim")
        console.warn(
          `AÇÃO NECESSÁRIA: Atualizar grade manualmente para ${pacienteId}.`
        );
    } catch (error) {
      console.error("Erro ao atualizar trilha:", error);
      throw new Error(`Falha ao atualizar dados do paciente: ${error.message}`);
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
      const atendimentosPB = pacienteData.atendimentosPB || [];
      const index = atendimentosPB.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );
      if (index === -1)
        throw new Error(
          `Atendimento ID ${atendimentoId} não encontrado no paciente ${pacienteId}.`
        );
      const nomeCampoStatusAtendimento = "statusAtendimento"; // Ajuste se necessário
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
        case "Encaminhamento":
          novoStatusAtendimento = "concluido_encaminhamento";
          if (detalhes.continuaAtendimentoEuPsico === "Não")
            novoStatusPaciente = "encaminhado_externo";
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
      if (novoStatusPaciente !== pacienteData.status)
        updateData.status = novoStatusPaciente;
      await updateDoc(pacienteRef, updateData);
      console.log(
        `Desfecho registrado na trilha para ${pacienteId}. Status Paciente: ${
          updateData.status || pacienteData.status
        }`
      );
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
      if (pacienteData.status !== novoStatus) {
        await updateDoc(pacienteRef, {
          status: novoStatus,
          statusAnteriorReavaliacao: statusAnterior,
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Status do paciente ${pacienteId} -> ${novoStatus}. Status anterior (${statusAnterior}) salvo.`
        );
      } else {
        await updateDoc(pacienteRef, {
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Paciente ${pacienteId} já aguardava reavaliação. Timestamp atualizado.`
        );
      }
    } catch (error) {
      console.error("Erro ao atualizar trilha:", error);
      throw new Error(
        `Falha ao atualizar status para reavaliação: ${error.message}`
      );
    }
  }
  async function processarAprovacaoInclusaoGrade(solicitacao) {
    console.log("Processando aprovação: Inclusão/Alt. Grade", solicitacao);
    console.log(
      `Confirmação registrada para Paciente ${solicitacao.pacienteId || "N/A"}.`
    );
    // alert("Confirmação registrada. Realize a alteração manualmente na grade.");
  }

  // --- Lógica Específica Modal Exclusão Horário ---
  function setupModalFormLogicExclusao() {
    const radioSim = modalBodyContent.querySelector("#radioExcluidoSim");
    const radioNao = modalBodyContent.querySelector("#radioExcluidoNao");
    const camposSim = modalBodyContent.querySelector("#campos-feedback-sim");
    const camposNao = modalBodyContent.querySelector("#campos-feedback-nao");
    if (!radioSim || !radioNao || !camposSim || !camposNao) {
      console.warn("Elementos do form de exclusão não encontrados.");
      return;
    }
    const toggleFields = () => {
      if (camposSim)
        camposSim.style.display = radioSim.checked ? "block" : "none";
      if (camposNao)
        camposNao.style.display = radioNao.checked ? "block" : "none";
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
          throw new Error("Para 'Sim', data e mensagem são obrigatórias.");
        statusFinal = "Concluída";
        try {
          const dateObj = new Date(dataExclusaoInput + "T12:00:00Z");
          if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
          adminFeedback.dataExclusao = Timestamp.fromDate(dateObj);
        } catch (dateError) {
          throw new Error("Data inválida (AAAA-MM-DD).");
        }
        adminFeedback.mensagemAdmin = mensagemAdmin;
        console.warn(
          `AÇÃO NECESSÁRIA: Excluir horários manualmente para ${docId}. Horários:`,
          solicitacaoData.detalhes?.horariosParaExcluir
        );
      } else {
        if (!motivoRejeicao)
          throw new Error("Para 'Não', o motivo é obrigatório.");
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
      alert("Resposta salva!");
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar exclusão:", error);
      alert(`Erro: ${error.message}`);
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  }

  // --- Função para Notificar Contrato Pendente via WhatsApp ---
  // *** MODIFICADO: Implementa lógica do WhatsApp ***
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
      let telefone = userData.contato; // Assumindo campo 'telefone'

      if (!telefone) {
        throw new Error(`Telefone não cadastrado para ${profissionalNome}.`);
      }

      // 2. Limpar e formatar o número (remover não-dígitos, garantir código do país 55)
      let numeroLimpo = telefone.replace(/\D/g, "");
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        // Formato nacional (DDD + numero)
        numeroLimpo = "55" + numeroLimpo; // Adiciona 55 se não tiver
      } else if (
        numeroLimpo.startsWith("55") &&
        (numeroLimpo.length === 12 || numeroLimpo.length === 13)
      ) {
        // Já está no formato internacional correto
      } else {
        throw new Error(
          `Formato de telefone inválido para ${profissionalNome}: ${telefone}`
        );
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

  // --- Funções Genéricas do Modal (Abrir/Fechar) ---
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
        ); // Chama a nova função
      }
    });
  } else {
    console.error("FALHA CRÍTICA: #tab-content-container não encontrado.");
  }

  // --- Event Listeners do Modal (Fechar/Cancelar) ---
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
} // Fim da função init
