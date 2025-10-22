// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO MODIFICADA (Incluindo Botão Notificar Contrato) ---

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs, // Usado para Contratos Pendentes
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  addDoc,
} from "../../../assets/js/firebase-init.js";
// import { deleteDoc } from "../../../assets/js/firebase-init.js"; // Se necessário

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
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') V.MODIFICADA iniciado."
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
  const tabContentContainer = document.querySelector(".tab-content-container");

  // Configuração Abas
  function setupTabs() {
    if (!tabsContainer) return;
    tabsContainer.addEventListener("click", (event) => {
      const clickedTab = event.target.closest(".tab-link");
      if (!clickedTab) return;
      const targetTabId = clickedTab.dataset.tab;
      // Remove active class from all links and contents
      tabLinks.forEach((link) => link.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));
      // Add active class to the clicked tab and corresponding content
      clickedTab.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add("active");
      } else {
        console.warn(`Conteúdo da aba não encontrado para ID: ${targetTabId}`);
      }
    });
    // Ativa a primeira aba por padrão ao carregar (opcional)
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

    // Limpa estado anterior e mostra carregando
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
        // Armazena a função para desinscrever
        q,
        (querySnapshot) => {
          tableBody.innerHTML = ""; // Limpa a tabela antes de popular
          const pendingCount = querySnapshot.size;

          if (querySnapshot.empty) {
            emptyState.style.display = "block";
            countBadge.style.display = "none";
            countBadge.textContent = "0";
            // console.log(`Nenhuma solicitação de [${tipoSolicitacao}] pendente encontrada.`);
          } else {
            emptyState.style.display = "none";
            countBadge.textContent = pendingCount;
            countBadge.style.display = "inline-block";
            // console.log(`${pendingCount} solicitações de [${tipoSolicitacao}] pendentes encontradas.`);

            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const docId = doc.id;
              const tr = renderRowFunction(data, docId);
              if (tr instanceof Node) {
                // Garante que é um elemento DOM antes de adicionar
                tableBody.appendChild(tr);
              } else {
                tableBody.innerHTML += tr; // Fallback se retornar string HTML
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
      // Ex: armazenar unsubscribes em um array e chamar cada um ao desmontar o módulo/página.
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
      7 // Data, Prof, Paciente, Horário Solicitado, Início Pref., Status, Ações
    );
  }

  function loadAlteracoesHorario() {
    loadSolicitacoesPorTipo(
      "alteracao_horario",
      "table-body-alteracoes-horario",
      "empty-state-alteracoes-horario",
      "count-alteracoes-horario",
      renderAlteracaoHorarioRow,
      9 // Data, Prof, Paciente, De, Para, Início, Justificativa, Status, Ações
    );
  }

  function loadDesfechosPB() {
    loadSolicitacoesPorTipo(
      "desfecho",
      "table-body-desfechos-pb",
      "empty-state-desfechos-pb",
      "count-desfechos-pb",
      renderDesfechoRow,
      8 // Data Reg, Data Desf, Prof, Paciente, Tipo, Motivo, Status, Ações
    );
  }

  function loadReavaliacao() {
    loadSolicitacoesPorTipo(
      "reavaliacao",
      "table-body-reavaliacao", // Certifique-se que existe no HTML
      "empty-state-reavaliacao", // Certifique-se que existe no HTML
      "count-reavaliacao", // Certifique-se que existe no HTML
      renderReavaliacaoRow,
      8 // Data Sol, Prof, Paciente, Valor Atual, Motivo, Pref. Agenda, Status, Ações
    );
  }

  function loadInclusaoAlteracaoGradePB() {
    loadSolicitacoesPorTipo(
      "inclusao_alteracao_grade",
      "table-body-inclusao-grade-pb", // Certifique-se que existe no HTML
      "empty-state-inclusao-grade-pb", // Certifique-se que existe no HTML
      "count-inclusao-grade-pb", // Certifique-se que existe no HTML
      renderInclusaoAlteracaoGradePBRow,
      9 // Data Sol, Prof, Paciente, Dia, Hora, Mod, Sala, Data Início, Status, Ações
    );
  }

  // *** ALTERADO: loadStatusContratos (Task 2) ***
  async function loadStatusContratos() {
    console.log("Carregando Status Contratos...");
    const tableBodyId = "table-body-status-contratos";
    const emptyStateId = "empty-state-status-contratos";
    const countBadgeId = "count-status-contratos";
    // *** MODIFICADO (Task 2): Colspan atualizado para 5 (incluindo Ações) ***
    const colspan = 5;

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
      // Busca pacientes em PB (status 'em_atendimento_pb' ou 'cadastrar_horario_psicomanager')
      // Firestore NÃO suporta OR em campos diferentes na mesma query.
      // Solução: Fazer duas queries e juntar os resultados.
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
      const processedPacientes = new Set(); // Para evitar duplicar pacientes entre as queries

      const processSnapshot = (snapshot) => {
        snapshot.forEach((doc) => {
          const pacienteId = doc.id;
          if (processedPacientes.has(pacienteId)) return; // Já processou este paciente
          processedPacientes.add(pacienteId);

          const pacienteData = doc.data();

          // Verifica CADA atendimento PB ativo ('ativo' no statusAtendimento)
          // IMPORTANTE: Ajuste 'statusAtendimento' se o nome do campo for diferente
          const atendimentosAtivos =
            pacienteData.atendimentosPB?.filter(
              (at) => at.statusAtendimento === "ativo"
            ) || [];

          atendimentosAtivos.forEach((atendimento) => {
            // Se o contrato NÃO está assinado neste atendimento ativo
            if (!atendimento.contratoAssinado) {
              // *** MODIFICADO (Task 2): Adicionado profissionalId ***
              pendingContracts.push({
                pacienteId: pacienteId,
                pacienteNome:
                  pacienteData.nomeCompleto || "Nome não encontrado",
                profissionalNome:
                  atendimento.profissionalNome || "Profissional não encontrado",
                profissionalId: atendimento.profissionalId || null, // Adicionado
                statusContrato: "Pendente",
                lastUpdate: pacienteData.lastUpdate, // Pega a última atualização do paciente
              });
            }
          });
        });
      };

      processSnapshot(pbSnapshot);
      processSnapshot(cadastrarSnapshot);

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
          const tr = document.createElement("tr"); // Cria elemento TR
          // *** MODIFICADO (Task 2): Adicionado botão de notificação ***
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
          tableBody.appendChild(tr); // Adiciona o TR ao tbody
        });
      }
    } catch (error) {
      console.error("Erro ao carregar status de contratos:", error);
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  }

  // *** Análise (Task 3/4): Esta função já está correta ***
  // Lê da coleção 'solicitacoes'.
  function loadExclusaoHorarios() {
    console.log(
      "Verificando se há solicitações de exclusão na coleção 'solicitacoes'..."
    );
    loadSolicitacoesPorTipo(
      "exclusao_horario",
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      renderExclusaoHorarioRow,
      7
    );

    // Adiciona um listener extra para verificar se a coleção antiga tem dados (APENAS PARA DIAGNÓSTICO)
    // REMOVA OU COMENTE ISSO APÓS A MIGRAÇÃO SER CONFIRMADA
    const checkOldCollection = async () => {
      try {
        const qOld = query(
          collection(dbInstance, "solicitacoesExclusaoGrade"),
          limit(1) // Importar 'limit' do firebase-init.js se for usar
        );
        const oldSnapshot = await getDocs(qOld);
        if (!oldSnapshot.empty) {
          console.warn(
            "AVISO: Foram encontrados dados na coleção antiga 'solicitacoesExclusaoGrade'. Eles foram migrados para a coleção 'solicitacoes' com tipo 'exclusao_horario'?"
          );
        } else {
          console.log(
            "Coleção antiga 'solicitacoesExclusaoGrade' parece estar vazia ou não existe."
          );
        }
      } catch (error) {
        // Ignora erro se a coleção não existir
        if (
          error.code !== "permission-denied" &&
          error.code !== "unimplemented"
        ) {
          // Evita logar erros esperados
          console.warn(
            "Não foi possível verificar a coleção antiga 'solicitacoesExclusaoGrade':",
            error.message
          );
        }
      }
    };
    // checkOldCollection(); // Descomente para verificar a coleção antiga no console
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
    // Cria elemento TR
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
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="novas_sessoes">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
    `;
    return tr; // Retorna o elemento TR
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
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="alteracao_horario">
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
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="desfecho">
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
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="reavaliacao">
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
            <button class="action-button btn-processar-solicitacao"
                    data-doc-id="${docId}"
                    data-tipo="inclusao_alteracao_grade">
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
        <td><span class="status-badge ${statusClass}">${data.status}</span></td>
        <td>
          <button class="action-button btn-processar-solicitacao"
                  data-doc-id="${docId}"
                  data-tipo="exclusao_horario">
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
    `;
    return tr;
  }

  // --- Lógica do Modal Genérico (com path corrigido e logs) ---
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
      // Assumindo: solicitacoes-admin.js está em /modulos/administrativo/js/
      // e os modais estão em /modulos/administrativo/page/
      let modalHtmlPath = `../page/`; // Caminho base a partir da pasta 'js' para a pasta 'page'

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

      console.log("Tentando carregar modal de:", modalHtmlPath); // Log para depuração
      const response = await fetch(modalHtmlPath);
      if (!response.ok) {
        console.error(
          `Fetch falhou: ${response.status} ${response.statusText} para ${modalHtmlPath}`
        );
        throw new Error(
          `Falha ao carregar o HTML do modal (${response.statusText}). Verifique o caminho e se o arquivo existe em modulos/administrativo/page/`
        );
      }
      modalBodyContent.innerHTML = await response.text();

      preencherCamposModal(tipo, solicitacaoData);
      configurarAcoesModal(docId, tipo, solicitacaoData);
    } catch (error) {
      console.error("Erro ao abrir modal genérico:", error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes: ${error.message}</p>`;
      modalFooterActions.innerHTML = ""; // Limpa botões em caso de erro
      modalFooterActions.appendChild(modalCancelBtn); // Garante que Cancelar ainda funcione
    }
  }

  // --- Funções preencherCamposModal, setTextContentIfExists, setValueIfExists (Completas) ---
  function preencherCamposModal(tipo, data) {
    const detalhes = data.detalhes || {};

    // Campos Comuns
    setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome);
    setTextContentIfExists("#modal-paciente-nome", data.pacienteNome);
    setTextContentIfExists(
      "#modal-data-solicitacao",
      formatarData(data.dataSolicitacao)
    );

    try {
      // Adiciona try-catch para debug de preenchimento
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
          // setTextContentIfExists("#modal-ns-justificativa", detalhes.justificativa); // Descomentar se existir
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
          // Novos
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
                ) // Fallback
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

    // Preenche feedback (mantido)
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
        ); // Fallback
      }
      modalBodyContent
        .querySelectorAll("input:not([type=hidden]), select, textarea")
        .forEach((el) => (el.disabled = true)); // Desabilita apenas inputs visíveis
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
      element.textContent = value ?? "N/A"; // Usa ?? para tratar null/undefined
    } else {
      // console.warn(`Elemento não encontrado para setText: ${selector}`); // Comentado para reduzir logs
    }
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) {
      element.value = value ?? ""; // Usa ?? para tratar null/undefined
    } else {
      // console.warn(`Elemento não encontrado para setValue: ${selector}`); // Comentado
    }
  }

  // --- Funções configurarAcoesModal, handleGenericSolicitacaoAction (Completas) ---
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
        setupModalFormLogicExclusao(); // Chama a lógica específica do form de exclusão
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
          // Limpa campo de mensagem ao abrir
          const adminMessageText = adminMessageGroup.querySelector(
            "#admin-message-text"
          );
          if (adminMessageText) adminMessageText.value = "";
        } else {
          console.warn(
            "Elemento #modal-admin-message-group não encontrado no HTML do modal."
          );
        }
      }
    } else {
      // Se não está Pendente
      // Preenche dados de feedback para Exclusão (se aplicável)
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
          else
            console.warn(
              "Radio button de exclusão não encontrado para valor:",
              foiExcluidoValue
            );
        }
        setValueIfExists(
          "#dataExclusao",
          feedback.dataExclusao
            ? feedback.dataExclusao.toDate().toISOString().split("T")[0]
            : ""
        ); // Formata data para input date
        setValueIfExists("#mensagemAdmin", feedback.mensagemAdmin);
        setValueIfExists("#motivoRejeicao", feedback.motivoRejeicao);

        setupModalFormLogicExclusao();
        // Desabilita todos, exceto botões de fechar
        modalBodyContent
          .querySelectorAll("input:not([type=hidden]), select, textarea")
          .forEach((el) => (el.disabled = true));
      }
      // Esconde grupo de MENSAGEM NOVA se não estiver Pendente
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
          // Adicionar outros cases se necessário
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
      // Mostra a mensagem de erro específica que veio das funções processarAprovacao... ou do updateDoc
      alert(`Erro ao processar: ${error.message}`);
      // Reabilita botões
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  }

  // --- Funções de Processamento Específicas (Completas) ---
  async function processarAprovacaoAlteracaoHorario(solicitacao) {
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
        // Tenta encontrar pelo ID do profissional se o atendimentoId falhar (fallback)
        const fallbackIndex = atendimentosPB.findIndex(
          (at) =>
            at.profissionalId === solicitacao.solicitanteId &&
            at.statusAtendimento === "ativo"
        );
        if (fallbackIndex === -1) {
          throw new Error(
            `Atendimento ativo não encontrado para o profissional ${solicitacao.solicitanteNome} no paciente ${pacienteId}.`
          );
        }
        console.warn(
          `Atendimento ID ${atendimentoId} não encontrado, usando fallback pelo profissionalId.`
        );
        // Se usar fallback, precisa garantir que é o atendimento correto a ser alterado.
        // Idealmente, o atendimentoId deveria estar sempre correto na solicitação.
        // index = fallbackIndex; // Descomentar com cautela
        throw new Error(`Atendimento ID ${atendimentoId} não encontrado.`); // Mais seguro lançar erro
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
          `AÇÃO NECESSÁRIA: Atualizar grade para paciente ${pacienteId}, atendimento ${atendimentoId}.`
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
    console.log("Processando aprovação de Desfecho:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { tipoDesfecho, dataDesfecho } = detalhes;

    if (!pacienteId || !atendimentoId || !tipoDesfecho || !dataDesfecho) {
      throw new Error(
        "Dados incompletos para processar desfecho (pacienteId, atendimentoId, tipoDesfecho, dataDesfecho)."
      );
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
        // Fallback (menos seguro)
        const fallbackIndex = atendimentosPB.findIndex(
          (at) =>
            at.profissionalId === solicitacao.solicitanteId &&
            at.statusAtendimento === "ativo"
        );
        if (fallbackIndex === -1) {
          throw new Error(
            `Atendimento ativo não encontrado para o profissional ${solicitacao.solicitanteNome} no paciente ${pacienteId}.`
          );
        }
        console.warn(
          `Atendimento ID ${atendimentoId} não encontrado para desfecho, usando fallback pelo profissionalId.`
        );
        // index = fallbackIndex; // Descomentar com cautela
        throw new Error(`Atendimento ID ${atendimentoId} não encontrado.`);
      }

      // ATENÇÃO: Verifique o nome correto do campo ('status' ou 'statusAtendimento')
      const nomeCampoStatusAtendimento = "status"; // <<< AJUSTE AQUI SE NECESSÁRIO

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
              : pacienteData.status; // Mantém status se continuar
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      // Marca o atendimento como concluído e adiciona detalhes do desfecho
      atendimentosPB[index][nomeCampoStatusAtendimento] = novoStatusAtendimento;
      atendimentosPB[index].desfecho = {
        ...detalhes, // Inclui motivo/encaminhamento
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };
      // Remove horário apenas se realmente concluído (não apenas encaminhado continuando)
      if (
        novoStatusPaciente === "alta" ||
        novoStatusPaciente === "desistencia" ||
        novoStatusPaciente === "encaminhado_externo"
      ) {
        // delete atendimentosPB[index].horarioSessao; // Ou horarioSessoes
      }

      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      };
      if (novoStatusPaciente !== pacienteData.status) {
        updateData.status = novoStatusPaciente; // Atualiza status GERAL
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

      // Verifica se já não está aguardando reavaliação para evitar sobrescrever statusAnterior
      if (pacienteData.status !== novoStatus) {
        await updateDoc(pacienteRef, {
          status: novoStatus,
          statusAnteriorReavaliacao: statusAnterior, // Só atualiza se o status mudou
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Status do paciente ${pacienteId} atualizado para ${novoStatus}. Status anterior (${statusAnterior}) salvo.`
        );
      } else {
        await updateDoc(pacienteRef, {
          // Apenas atualiza o timestamp da aprovação
          solicitacaoReavaliacaoAprovadaEm: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log(
          `Paciente ${pacienteId} já estava aguardando reavaliação. Timestamp de aprovação atualizado.`
        );
      }

      // TODO: Notificar Serviço Social?
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
    console.log(
      "Processando aprovação de Inclusão/Alteração na Grade (PB):",
      solicitacao
    );
    console.log(
      `Confirmação de Inclusão/Alteração na Grade para Paciente ${solicitacao.pacienteId} registrada.`
    );
    alert("Confirmação de ação na grade registrada.");
    // Nenhuma ação adicional na trilha é feita aqui por padrão.
  }

  // --- Lógica Específica Modal Exclusão Horário (Completa) ---
  function setupModalFormLogicExclusao() {
    const radioSim = modalBodyContent.querySelector("#radioExcluidoSim");
    const radioNao = modalBodyContent.querySelector("#radioExcluidoNao");
    const camposSim = modalBodyContent.querySelector("#campos-feedback-sim");
    const camposNao = modalBodyContent.querySelector("#campos-feedback-nao");

    if (!radioSim || !radioNao || !camposSim || !camposNao) {
      console.warn(
        "Elementos do formulário de exclusão (Sim/Não) não encontrados no modal."
      );
      return; // Sai se não encontrar os elementos
    }

    const toggleFields = () => {
      // Garante que os campos existem antes de tentar mudar o display
      if (camposSim)
        camposSim.style.display = radioSim.checked ? "block" : "none";
      if (camposNao)
        camposNao.style.display = radioNao.checked ? "block" : "none";
    };

    radioSim.removeEventListener("change", toggleFields); // Remove para evitar duplicados
    radioNao.removeEventListener("change", toggleFields);
    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);
    toggleFields(); // Define estado inicial
  }

  async function handleSalvarExclusao(docId, solicitacaoData) {
    const saveButton = document.getElementById("btn-salvar-exclusao");
    if (!saveButton) {
      console.error("Botão #btn-salvar-exclusao não encontrado.");
      return;
    }
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="loading-spinner-small"></span> Salvando...`;

    // Busca os valores DENTRO do modalBodyContent
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
          // Tenta criar data. Adiciona hora fixa para evitar problemas de fuso
          const dateObj = new Date(dataExclusaoInput + "T12:00:00Z"); // Use UTC ou fuso local consistente
          if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
          adminFeedback.dataExclusao = Timestamp.fromDate(dateObj);
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
        // Adicionar chamada para Cloud Function aqui, se existir
        // try {
        //   const excluirHorarios = httpsCallable(functions, 'excluirHorariosGrade');
        //   await excluirHorarios({ solicitacaoId: docId, horarios: solicitacaoData.detalhes?.horariosParaExcluir });
        //   console.log("Chamada para excluir horários da grade enviada.");
        // } catch (cfError) {
        //    console.error("Erro ao chamar Cloud Function para excluir horários:", cfError);
        //    alert("Atenção: Erro ao tentar executar a exclusão automática da grade. Verifique manualmente.");
        // }
      } else {
        // nao
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
      // Garante que o botão seja reabilitado mesmo em caso de erro
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  }

  // *** ADICIONADO (Task 2): Nova função para notificar contrato ***
  async function handleNotificarContrato(
    pacienteId,
    pacienteNome,
    profissionalId,
    profissionalNome
  ) {
    console.log(
      `Notificando ${profissionalNome} (ID: ${profissionalId}) sobre contrato pendente do paciente ${pacienteNome} (ID: ${pacienteId})`
    );

    const confirmacao = confirm(
      `Deseja realmente enviar uma notificação para ${profissionalNome} sobre o contrato pendente do paciente ${pacienteNome}?`
    );

    if (!confirmacao) {
      console.log("Notificação cancelada pelo admin.");
      return;
    }

    // **Ação:** Enviar uma notificação/mensagem.
    // A implementação exata (ex: salvar na coleção 'notificacoes' ou 'mensagens')
    // depende da arquitetura do seu app.

    // **Exemplo de implementação (se você tiver 'notificacoes' e 'addDoc' importado):**

    try {
      const notificacaoRef = collection(dbInstance, "notificacoes");
      await addDoc(notificacaoRef, {
        paraUsuarioId: profissionalId,
        tipo: "aviso_contrato_pendente",
        titulo: "Contrato Terapêutico Pendente",
        mensagem: `Olá, ${profissionalNome}. Por favor, verifique o envio do contrato terapêutico para assinatura do paciente ${pacienteNome}.`,
        dataEnvio: serverTimestamp(),
        lida: false,
        pacienteId: pacienteId,
        criadoPor: adminUser.uid || "N/A",
      });

      alert("Notificação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar notificação de contrato:", error);
      alert(`Erro ao tentar enviar notificação: ${error.message}`);
    }

    // **Implementação Provisória (Placeholder):**
    // Remova este bloco e descomente o bloco acima quando a coleção de notificações estiver pronta.
    console.warn(
      "Ação 'enviar mensagem' (handleNotificarContrato) executada, mas a lógica de envio (ex: addDoc para 'notificacoes') precisa ser implementada."
    );
    alert(
      `Notificação para ${profissionalNome} registrada (simulação). Implemente a lógica de envio em handleNotificarContrato no JS.`
    );
  }
  // *** FIM DA NOVA FUNÇÃO (Task 2) ***

  // --- Funções do Modal (Genéricas - open/close) ---
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
  loadStatusContratos(); // Implementado
  loadExclusaoHorarios(); // Verificado

  // --- Listener de Evento Genérico (MODIFICADO para Task 2) ---
  if (tabContentContainer) {
    tabContentContainer.addEventListener("click", async (e) => {
      // Delegação de evento para botões com a classe específica
      const button = e.target.closest(".btn-processar-solicitacao");

      if (button) {
        // Previne comportamento padrão se for link ou outro elemento
        e.preventDefault();

        const docId = button.dataset.docId;
        const tipo = button.dataset.tipo;

        if (docId && tipo) {
          console.log(`Botão processar clicado: ID=${docId}, Tipo=${tipo}`); // Log
          openGenericSolicitacaoModal(docId, tipo);
        } else {
          console.error(
            "Doc ID ou Tipo não encontrado no botão de processar:",
            button.dataset
          );
          alert("Erro: Não foi possível identificar a solicitação.");
        }
      }

      // *** ADICIONADO (Task 2): Listener para o botão de notificar contrato ***
      const notificarButton = e.target.closest(".btn-notificar-contrato");
      if (notificarButton) {
        e.preventDefault();
        const pacienteId = notificarButton.dataset.pacienteId;
        const pacienteNome = notificarButton.dataset.pacienteNome;
        const profissionalId = notificarButton.dataset.profissionalId;
        const profissionalNome = notificarButton.dataset.profissionalNome;

        if (!profissionalId || profissionalId === "null") {
          alert(
            "Erro: ID do profissional não encontrado. Não é possível notificar."
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
      // *** FIM DO BLOCO ADICIONADO (Task 2) ***
    });
  } else {
    console.error(
      "Container de conteúdo das abas não encontrado (ID: tab-content-container). Listener de clique não adicionado."
    );
  }

  // Event listeners do modal (Fechar/Cancelar)
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  else console.warn("Botão de fechar modal (X) não encontrado.");

  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  else console.warn("Botão de cancelar modal não encontrado.");

  if (modal) {
    modal.addEventListener("click", (event) => {
      // Fecha se clicar no overlay (fundo escuro)
      if (event.target === modal) {
        closeModal();
      }
    });
  } else {
    console.error(
      "Elemento do modal principal não encontrado (ID: solicitacao-details-modal)."
    );
  }
} // Fim da função init
