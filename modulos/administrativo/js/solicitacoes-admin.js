// Arquivo: /modulos/administrativo/js/solicitacoes-admin.js
// --- VERSÃO MODIFICADA PARA LER DA COLEÇÃO CENTRAL 'solicitacoes' ---

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs, // Usaremos getDoc para modais, mas onSnapshot para tabelas
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot, // Para escutar atualizações em tempo real nas tabelas
  Timestamp,
} from "../../../assets/js/firebase-init.js";
// Adicionar importação de deleteDoc se for remover solicitações da trilha após processar
// import { deleteDoc } from "../../../assets/js/firebase-init.js";

let dbInstance = db;
let adminUser; // Dados do admin logado

// --- Funções Auxiliares ---
function formatarData(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric", // hour: '2-digit', minute: '2-digit' // Descomentar se precisar da hora
    });
  }
  return "N/A";
}

// Mapeamento de tipos internos para nomes amigáveis
function formatarTipoSolicitacao(tipoInterno) {
  const mapaTipos = {
    novas_sessoes: "Novas Sessões",
    alteracao_horario: "Alteração Horário/Modalidade",
    desfecho: "Registro de Desfecho",
    reavaliacao: "Solicitação Reavaliação",
    exclusao_horario: "Exclusão de Horário",
    inclusao_alteracao_grade: "Inclusão/Alt. Grade (PB)", // Tipo adicionado em modals.js // Adicione outros tipos conforme necessário
  };
  return mapaTipos[tipoInterno] || tipoInterno; // Retorna o nome mapeado ou o interno
}

// Função principal de inicialização do módulo
export function init(db_ignored, user, userData) {
  console.log(
    "Módulo solicitacoes-admin.js (Coleção Central 'solicitacoes') iniciado."
  );
  adminUser = userData; // Guarda dados do admin logado // Seletores do DOM (mantidos)

  const tabsContainer = document.querySelector(".tabs-container");
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("solicitacao-details-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyContent = document.getElementById("modal-body-content");
  const modalFooterActions = document.getElementById("modal-footer-actions");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const tabContentContainer = document.querySelector(".tab-content-container"); // Configuração das Abas (mantida)

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
      }
    });
  }  // --- NOVA FUNÇÃO GENÉRICA: Carregar Solicitações da Coleção Central ---
  /**
   * Carrega solicitações pendentes de um tipo específico da coleção 'solicitacoes'.
   * @param {string} tipoSolicitacao - O valor do campo 'tipo' no Firestore.
   * @param {string} tableBodyId - ID do tbody da tabela HTML.
   * @param {string} emptyStateId - ID do elemento de estado vazio HTML.
   * @param {string} countBadgeId - ID do badge de contagem HTML.
   * @param {function} renderRowFunction - Função que recebe (data, docId) e retorna o HTML da linha (tr).
   * @param {number} colspan - Número de colunas na tabela para mensagens.
   */

  function loadSolicitacoesPorTipo(
    tipoSolicitacao,
    tableBodyId,
    emptyStateId,
    countBadgeId,
    renderRowFunction,
    colspan = 7 // Ajuste o default conforme necessário
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

    try {
      // Query para buscar solicitações PENDENTES do TIPO específico, ordenadas por data
      const q = query(
        collection(dbInstance, "solicitacoes"), // Coleção central
        where("tipo", "==", tipoSolicitacao), // Filtra pelo tipo
        where("status", "==", "Pendente"), // Filtra por status Pendente
        orderBy("dataSolicitacao", "desc") // Ordena mais recentes primeiro
      ); // Usa onSnapshot para escutar atualizações em tempo real

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          tableBody.innerHTML = ""; // Limpa a tabela antes de popular
          const pendingCount = querySnapshot.size; // Tamanho do snapshot já filtrado

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
              const docId = doc.id; // Chama a função específica para renderizar a linha desta solicitação
              const tr = renderRowFunction(data, docId);
              tableBody.innerHTML += tr; // Adiciona a linha HTML
            });
          }
        },
        (error) => {
          // Callback de erro do onSnapshot
          console.error(
            `Erro ao buscar [${tipoSolicitacao}] em tempo real:`,
            error
          );
          tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Erro ao carregar dados: ${error.message}</td></tr>`;
          emptyState.style.display = "none";
          countBadge.style.display = "none";
        }
      ); // Guardar a função unsubscribe para poder parar de ouvir depois, se necessário // (Ex: ao sair da página) - Por simplicidade, omitido aqui.
    } catch (error) {
      // Erro ao construir a query
      console.error(
        `Falha ao construir query para [${tipoSolicitacao}]:`,
        error
      );
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-error">Falha na query. Verifique o nome da coleção e índices.</td></tr>`;
      emptyState.style.display = "none";
      countBadge.style.display = "none";
    }
  } // --- Implementação das funções de carregamento (agora usam a função genérica) ---

  function loadNovasSessoes() {
    loadSolicitacoesPorTipo(
      "novas_sessoes",
      "table-body-novas-sessoes",
      "empty-state-novas-sessoes",
      "count-novas-sessoes",
      renderNovasSessoesRow,
      7 // Ajuste o colspan se a tabela tiver 7 colunas
    );
  }

  function loadAlteracoesHorario() {
    loadSolicitacoesPorTipo(
      "alteracao_horario",
      "table-body-alteracoes-horario",
      "empty-state-alteracoes-horario",
      "count-alteracoes-horario",
      renderAlteracaoHorarioRow,
      8 // Ajuste o colspan se a tabela tiver 8 colunas
    );
  }

  function loadDesfechosPB() {
    loadSolicitacoesPorTipo(
      "desfecho",
      "table-body-desfechos-pb",
      "empty-state-desfechos-pb",
      "count-desfechos-pb",
      renderDesfechoRow,
      7 // Ajuste o colspan
    );
  } // *** NOVO: Carregar Solicitações de Reavaliação ***

  function loadReavaliacao() {
    loadSolicitacoesPorTipo(
      "reavaliacao",
      "table-body-reavaliacao", // <<< VERIFIQUE/CRIE O ID NO HTML
      "empty-state-reavaliacao", // <<< VERIFIQUE/CRIE O ID NO HTML
      "count-reavaliacao", // <<< VERIFIQUE/CRIE O ID NO HTML
      renderReavaliacaoRow, // Função de renderização (abaixo)
      6 // Ajuste o colspan
    );
  }

  // *** NOVO: Carregar Solicitações de Inclusão/Alteração Grade PB ***
  function loadInclusaoAlteracaoGradePB() {
    loadSolicitacoesPorTipo(
      "inclusao_alteracao_grade", // Tipo definido em modals.js
      "table-body-inclusao-grade-pb", // <<< VERIFIQUE/CRIE O ID NO HTML (nova tabela/aba?)
      "empty-state-inclusao-grade-pb", // <<< VERIFIQUE/CRIE O ID NO HTML
      "count-inclusao-grade-pb", // <<< VERIFIQUE/CRIE O ID NO HTML
      renderInclusaoAlteracaoGradePBRow, // Função de renderização (abaixo)
      8 // Ajuste o colspan
    );
  }

  function loadStatusContratos() {
    // TODO: Implementar busca - Esta pode NÃO vir da coleção 'solicitacoes'.
    console.warn("loadStatusContratos ainda não implementado.");
  }

  function loadExclusaoHorarios() {
    // Agora também usa a função genérica
    loadSolicitacoesPorTipo(
      "exclusao_horario", // Tipo correspondente na coleção 'solicitacoes'
      "table-body-exclusao-horarios",
      "empty-state-exclusao-horarios",
      "count-exclusao-horarios",
      renderExclusaoHorarioRow,
      7 // Colspan da tabela de Exclusão
    );
  } // --- Funções de Renderização Específicas --- // (Adaptadas para ler de `data` e `data.detalhes`)

  function renderNovasSessoesRow(data, docId) {
    const detalhes = data.detalhes || {}; // Objeto de detalhes
    const dataSol = formatarData(data.dataSolicitacao);
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td>
        <td>${data.solicitanteNome || "N/A"}</td>
        <td>${data.pacienteNome || "N/A"}</td>
        {/* Acessa os campos dentro de 'detalhes' */}
        <td>${detalhes.diaSemana || "N/A"}, ${detalhes.horario || "N/A"} (${
      detalhes.modalidade || "N/A"
    })</td>
        <td>${detalhes.dataInicioPreferencial || "N/A"}</td>
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
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
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
        <td>${novos.dataInicio || "N/A"}</td>
        <td class="motivo-cell">${detalhes.justificativa || "N/A"}</td>
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

  function renderDesfechoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const dataSol = formatarData(data.dataSolicitacao);
    const dataDesf = detalhes.dataDesfecho
      ? formatarData(
          Timestamp.fromDate(new Date(detalhes.dataDesfecho + "T03:00:00"))
        )
      : "N/A"; // Formata data do desfecho
    const statusClass = `status-${String(
      data.status || "pendente"
    ).toLowerCase()}`;
    return `
      <tr>
        <td>${dataSol}</td> {/* Data da Solicitação */}
        <td>${dataDesf}</td> {/* Data do Desfecho */}
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
  } // *** NOVA FUNÇÃO DE RENDERIZAÇÃO: Reavaliação ***

  function renderReavaliacaoRow(data, docId) {
    const detalhes = data.detalhes || {};
    const pref = detalhes.preferenciaAgendamento || {};
    const dataSol = formatarData(data.dataSolicitacao);
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
        <td>${
      pref.data
        ? formatarData(Timestamp.fromDate(new Date(pref.data + "T03:00:00")))
        : "N/A"
    } ${pref.hora || ""} (${pref.modalidade || "N/A"})</td>
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

  // *** NOVA FUNÇÃO DE RENDERIZAÇÃO: Inclusão/Alteração Grade PB ***
  function renderInclusaoAlteracaoGradePBRow(data, docId) {
    const detalhes = data.detalhes || {}; // Contém os dados do horarioSessao
    const dataSol = formatarData(data.dataSolicitacao);
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
                <td>${
                  detalhes.modalidade || detalhes.tipoAtendimento || "N/A"
                }</td>
                <td>${detalhes.salaAtendimento || "N/A"}</td>
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
    const detalhes = data.detalhes || {}; // Assumindo que os detalhes foram movidos para cá
    const dataSol = formatarData(data.dataSolicitacao);
    const horariosLabels =
      detalhes.horariosParaExcluir?.map((h) => h.label).join(", ") || "Erro";
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
            ${data.status === "Pendente" ? "Processar" : "Ver"}
          </button>
        </td>
      </tr>
    `;
  }  // --- Lógica do Modal (Refatorada para ser Genérica) ---
  /**
   * Abre um modal genérico para processar/visualizar uma solicitação.
   * @param {string} docId - ID do documento na coleção 'solicitacoes'.
   * @param {string} tipo - Tipo da solicitação (ex: 'novas_sessoes').
   */

  async function openGenericSolicitacaoModal(docId, tipo) {
    console.log(`Abrindo modal para ${tipo}, ID: ${docId}`);
    modalTitle.textContent = `Processar Solicitação (${formatarTipoSolicitacao(
      tipo
    )})`;
    modalBodyContent.innerHTML = '<div class="loading-spinner"></div>'; // Mostra loading
    modalFooterActions.innerHTML = ""; // Limpa botões antigos
    modalFooterActions.appendChild(modalCancelBtn); // Garante que o botão Cancelar esteja lá

    openModal(); // Abre o modal imediatamente com o loading

    try {
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Solicitação não encontrada!");
      }
      const solicitacaoData = docSnap.data(); // Carrega o HTML específico para o tipo de solicitação // (Você precisará criar esses arquivos HTML)

      let modalHtmlPath = "";
      switch (tipo) {
        case "novas_sessoes":
          modalHtmlPath = "./modal-novas-sessoes.html"; // <<< CRIE ESTE ARQUIVO
          break;
        case "alteracao_horario":
          modalHtmlPath = "./modal-alteracao-horario.html"; // <<< CRIE ESTE ARQUIVO
          break;
        case "desfecho":
          modalHtmlPath = "./modal-desfecho.html"; // <<< CRIE ESTE ARQUIVO
          break;
        case "reavaliacao":
          modalHtmlPath = "./modal-reavaliacao.html"; // <<< CRIE ESTE ARQUIVO
          break;
        case "inclusao_alteracao_grade":
          modalHtmlPath = "./modal-inclusao-alteracao-grade.html"; // <<< CRIE ESTE ARQUIVO
          break;
        case "exclusao_horario": // Reutiliza o modal existente
          modalHtmlPath = "./modal-exclusao-grade.html"; // A lógica de preenchimento e save será tratada abaixo
          break;
        default:
          throw new Error(`Tipo de solicitação desconhecido: ${tipo}`);
      }

      const response = await fetch(modalHtmlPath);
      if (!response.ok)
        throw new Error(
          `Falha ao carregar o HTML do modal (${modalHtmlPath}).`
        );
      modalBodyContent.innerHTML = await response.text(); // Preenche os campos do modal com os dados da solicitação // (Esta função precisa ser criada/adaptada para cada tipo)

      preencherCamposModal(tipo, solicitacaoData); // Adiciona botões de ação (Aprovar/Rejeitar ou Salvar específico)

      configurarAcoesModal(docId, tipo, solicitacaoData);
    } catch (error) {
      console.error("Erro ao abrir modal genérico:", error);
      modalBodyContent.innerHTML = `<p class="alert alert-error">Erro ao carregar detalhes: ${error.message}</p>`;
      // Mantém o botão Cancelar visível
      modalFooterActions.innerHTML = "";
      modalFooterActions.appendChild(modalCancelBtn);
    }
  }
  /**
   * Preenche os campos do modal com base no tipo e nos dados.
   * (Precisa ser implementado/adaptado para cada tipo de modal HTML)
   */

  function preencherCamposModal(tipo, data) {
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
        setValueIfExists(
          "#modal-ns-data-inicio",
          detalhes.dataInicioPreferencial
        ); // Input date
        // setTextContentIfExists("#modal-ns-justificativa", detalhes.justificativa); // Se houver
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
        // Preenche os detalhes do horário a ser incluído/alterado
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
        // Reutiliza a lógica existente, adaptando seletores se necessário
        setTextContentIfExists("#modal-solicitante-nome", data.solicitanteNome); // Campo comum já preenchido
        setTextContentIfExists("#modal-solicitante-motivo", detalhes.motivo);
        const horariosList = document.getElementById("modal-horarios-list"); // Assume que o ID é o mesmo no HTML carregado
        if (horariosList) {
          horariosList.innerHTML =
            detalhes.horariosParaExcluir
              ?.map((h) => `<li>${h.label} (${h.path || "Sem path"})</li>`)
              .join("") || "<li>Erro</li>";
        }
        // A lógica de preencher o feedback (Sim/Não) será tratada em configurarAcoesModal
        break;
    }

    // Preenche o feedback do admin, se já existir (para visualização)
    if (data.adminFeedback && data.status !== "Pendente") {
      const feedback = data.adminFeedback;
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      ); // Container padrão para exibir feedback
      if (feedbackContainer) {
        feedbackContainer.style.display = "block";
        setTextContentIfExists("#view-admin-nome", feedback.adminNome);
        setTextContentIfExists(
          "#view-admin-data",
          formatarData(feedback.dataResolucao)
        );
        setTextContentIfExists("#view-admin-status", data.status); // Mostra o status final
        setTextContentIfExists(
          "#view-admin-mensagem",
          feedback.mensagemAdmin || feedback.motivoRejeicao || feedback.mensagem
        ); // Tenta diferentes campos de mensagem
      }

      // Desabilita campos do formulário principal se já foi processado
      modalBodyContent
        .querySelectorAll("form input, form select, form textarea")
        .forEach((el) => (el.disabled = true));
    } else {
      const feedbackContainer = document.getElementById(
        "modal-admin-feedback-view"
      );
      if (feedbackContainer) feedbackContainer.style.display = "none"; // Esconde se não houver feedback
    }
  }

  // Funções auxiliares para preencher/setar valor
  function setTextContentIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) {
      element.textContent = value || "N/A"; // Usa N/A como fallback
    } else {
      // console.warn(`Elemento não encontrado para setText: ${selector}`);
    }
  }
  function setValueIfExists(selector, value) {
    const element = modalBodyContent.querySelector(selector);
    if (element) {
      element.value = value || ""; // Usa string vazia como fallback para inputs
    } else {
      // console.warn(`Elemento não encontrado para setValue: ${selector}`);
    }
  }
  /**
   * Adiciona os botões e configura os handlers de ação no rodapé do modal.
   */

  function configurarAcoesModal(docId, tipo, data) {
    modalFooterActions.innerHTML = ""; // Limpa botões existentes primeiro
    modalFooterActions.appendChild(modalCancelBtn); // Adiciona o botão Cancelar

    if (data.status === "Pendente") {
      // Se for Exclusão de Horário, usa a lógica específica dela
      if (tipo === "exclusao_horario") {
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "btn-salvar-exclusao"; // Mantém ID para compatibilidade?
        saveButton.className = "action-button dynamic-action-btn";
        saveButton.textContent = "Salvar Resposta (Exclusão)";
        saveButton.onclick = () => handleSalvarExclusao(docId, data); // Passa dados para evitar re-fetch
        modalFooterActions.appendChild(saveButton); // Chama a função que configura a lógica Sim/Não do form de exclusão
        setupModalFormLogicExclusao();
      } else {
        // Para os outros tipos, botões genéricos Aprovar/Rejeitar
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

        // Adiciona campo de mensagem do admin para Aprovar/Rejeitar
        const adminMessageGroup = document.getElementById(
          "modal-admin-message-group"
        ); // Div padrão para mensagem do admin
        if (adminMessageGroup) adminMessageGroup.style.display = "block";
      }
    } else {
      // Se não está pendente, apenas mostra os dados preenchidos e desabilitados
      // (já feito em preencherCamposModal)
      // Poderia adicionar um botão "Fechar" se o Cancelar não for suficiente
      if (tipo === "exclusao_horario" && data.adminFeedback) {
        // Preenche o formulário de feedback Sim/Não para visualização
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

        setupModalFormLogicExclusao(); // Chama para exibir campos corretos
        modalBodyContent
          .querySelectorAll("input, textarea, select")
          .forEach((el) => (el.disabled = true)); // Garante desabilitação
      }
      const adminMessageGroup = document.getElementById(
        "modal-admin-message-group"
      );
      if (adminMessageGroup) adminMessageGroup.style.display = "none"; // Esconde campo de nova mensagem
    }
  }
  /**
   * Handler genérico para Aprovar/Rejeitar solicitações (exceto Exclusão de Horário).
   */

  async function handleGenericSolicitacaoAction(
    docId,
    tipo,
    novoStatus,
    solicitacaoData
  ) {
    const mensagemAdminInput = document.getElementById("admin-message-text"); // Textarea padrão para mensagem
    const mensagemAdmin = mensagemAdminInput
      ? mensagemAdminInput.value.trim()
      : "";

    // Rejeição exige mensagem
    if (novoStatus === "Rejeitada" && !mensagemAdmin) {
      alert("Por favor, forneça uma mensagem explicando o motivo da rejeição.");
      mensagemAdminInput?.focus(); // Foca no campo de mensagem
      return;
    }

    // Desabilita botões
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
      // 1. Atualizar o status e feedback na coleção 'solicitacoes'
      const docRef = doc(dbInstance, "solicitacoes", docId);
      const adminFeedback = {
        statusFinal: novoStatus,
        mensagemAdmin: mensagemAdmin, // Salva a mensagem (pode estar vazia se aprovado sem msg)
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

      // 2. Executar ações específicas de aprovação (se aplicável)
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
          // case 'novas_sessoes':
          //     // Nenhuma ação automática na trilha por enquanto? Admin cadastra na grade manualmente.
          //     console.log("Aprovação de Novas Sessões registrada. Admin deve cadastrar na grade.");
          //     break;
          // Não precisa de case para 'exclusao_horario', pois tem handler próprio.
        }
      }

      alert(`Solicitação ${novoStatus.toLowerCase()} com sucesso!`);
      closeModal();
      // O onSnapshot atualizará a tabela automaticamente.
    } catch (error) {
      console.error(
        `Erro ao ${novoStatus.toLowerCase()} solicitação ${docId} (${tipo}):`,
        error
      );
      alert(`Erro ao processar: ${error.message}`);
      // Reabilita botões em caso de erro
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
      if (clickedButton)
        clickedButton.textContent =
          novoStatus === "Aprovada" ? "Aprovar" : "Rejeitar";
    }
  }

  // --- Funções de Processamento Específicas (Chamadas em caso de Aprovação) ---

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
        throw new Error(
          `Atendimento ${atendimentoId} não encontrado para o paciente ${pacienteId}.`
        );
      }

      // Atualiza os dados do horarioSessao dentro do atendimento específico
      const horarioAtualizado = {
        ...(atendimentosPB[index].horarioSessao || {}), // Mantém dados existentes
        diaSemana: novosDados.dia,
        horario: novosDados.horario,
        tipoAtendimento: novosDados.modalidade,
        frequencia: novosDados.frequencia,
        salaAtendimento: novosDados.sala,
        dataInicio: novosDados.dataInicio, // Data de início da *nova* configuração
        // Poderia adicionar um histórico aqui se desejado
        ultimaAlteracaoAprovadaEm: serverTimestamp(), // Marca quando foi aprovado
      };

      atendimentosPB[index].horarioSessao = horarioAtualizado;

      // Atualiza o array no documento do paciente
      await updateDoc(pacienteRef, {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Horário atualizado na trilha para paciente ${pacienteId}, atendimento ${atendimentoId}.`
      );

      // TODO: Se 'novosDados.alterarGrade' for 'Sim', precisa notificar/integrar com a grade?
      if (novosDados.alterarGrade === "Sim") {
        console.warn(
          `Ação necessária: Atualizar grade para paciente ${pacienteId}, atendimento ${atendimentoId}.`
        );
        // Aqui poderia chamar uma Cloud Function, se existir, ou apenas logar para ação manual.
      }
    } catch (error) {
      console.error(
        "Erro ao atualizar trilhaPaciente para alteração de horário:",
        error
      );
      // Lança o erro para ser capturado pelo handleGenericSolicitacaoAction e notificar o usuário
      throw new Error(
        `Falha ao atualizar dados do paciente na trilha: ${error.message}`
      );
    }
  }

  async function processarAprovacaoDesfecho(solicitacao) {
    console.log("Processando aprovação de Desfecho:", solicitacao);
    const { pacienteId, atendimentoId, detalhes } = solicitacao;
    const { tipoDesfecho, dataDesfecho } = detalhes; // Pega tipo e data do desfecho

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

      // Define o novo status do *atendimento* e do *paciente*
      let novoStatusAtendimento = "";
      let novoStatusPaciente = ""; // Status geral do paciente
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
          // O status do paciente PODE depender se ele continua ou não
          if (detalhes.continuaAtendimentoEuPsico === "Não") {
            novoStatusPaciente = "encaminhado_externo"; // Ou um status similar
          } else {
            // Se continua, talvez o status do paciente não mude drasticamente,
            // ou vá para um estado de 'aguardando_novo_servico'? Depende do fluxo.
            // Por ora, vamos manter o status atual se ele continuar.
            novoStatusPaciente = pacienteData.status;
            console.log(
              "Paciente encaminhado, mas continua na EuPsico. Status do paciente mantido:",
              novoStatusPaciente
            );
          }
          break;
        default:
          throw new Error(`Tipo de desfecho inválido: ${tipoDesfecho}`);
      }

      // Adiciona os detalhes do desfecho ao objeto do atendimento
      atendimentosPB[index].status = novoStatusAtendimento;
      atendimentosPB[index].desfecho = {
        ...detalhes, // Inclui todos os detalhes (motivo, encaminhamento, etc.)
        aprovadoPor: adminUser.nome || "Admin",
        aprovadoEm: serverTimestamp(),
      };
      // Remove o objeto horarioSessao se o atendimento foi concluído? Opcional.
      // delete atendimentosPB[index].horarioSessao;

      // Atualiza o array e o status GERAL do paciente
      const updateData = {
        atendimentosPB: atendimentosPB,
        lastUpdate: serverTimestamp(),
      };
      // Só atualiza o status GERAL se ele mudou
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
    const { pacienteId, detalhes } = solicitacao;
    // A aprovação aqui significa que o admin CONCORDA que a reavaliação é necessária.
    // O próximo passo é AGENDAR essa reavaliação.

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

      // Ação: Mudar o status do paciente para indicar que ele precisa agendar/realizar a reavaliação.
      const novoStatus = "aguardando_reavaliacao"; // Ou um status similar

      // Guarda o status anterior para saber para onde voltar depois
      const statusAnterior = pacienteData.status;

      await updateDoc(pacienteRef, {
        status: novoStatus,
        statusAnteriorReavaliacao: statusAnterior, // Guarda o status de onde veio
        solicitacaoReavaliacaoAprovadaEm: serverTimestamp(), // Marca aprovação
        lastUpdate: serverTimestamp(),
      });
      console.log(
        `Status do paciente ${pacienteId} atualizado para ${novoStatus}.`
      );

      // Opcional: Enviar notificação para o Serviço Social agendar? Ou para o paciente?
      // alert("Aprovação registrada. O próximo passo é agendar a reavaliação com o Serviço Social.");
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
    // Esta aprovação geralmente significa que o admin VERIFICOU e REALIZOU a alteração
    // no sistema externo (Psicomanager?) ou na própria grade interna.
    // A ação principal aqui é apenas registrar que foi feito.

    // Poderia, opcionalmente, atualizar algo na trilhaPaciente se necessário,
    // mas a definição do horário já deve ter sido feita em handleHorariosPbSubmit.
    // Apenas logamos a confirmação.
    console.log(
      `Confirmação de Inclusão/Alteração na Grade para Paciente ${solicitacao.pacienteId} registrada.`
    );
    alert(
      "Confirmação de ação na grade registrada. Nenhuma alteração adicional na trilha foi feita por esta aprovação."
    );

    // Se houvesse um campo na trilhaPaciente como 'horarioConfirmadoNaGrade: false',
    // poderíamos atualizá-lo aqui para 'true'. Exemplo:
    /*
         const { pacienteId, atendimentoId } = solicitacao;
         if (pacienteId && atendimentoId) {
             const pacienteRef = doc(dbInstance, "trilhaPaciente", pacienteId);
             try {
                 // Lógica para encontrar o atendimento e atualizar um campo específico
                 // await updateDoc(pacienteRef, { [`atendimentosPB.${index}.horarioConfirmadoNaGrade`]: true });
             } catch (error) {
                 console.error("Erro ao marcar horário como confirmado na grade na trilha:", error);
             }
         }
         */
  } // --- Lógica Específica Modal Exclusão Horário (Adaptada) --- // Mantém a função, mas busca o HTML dentro do modal genérico

  function setupModalFormLogicExclusao() {
    // Usa modalBodyContent como raiz para buscar os elementos
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

    // Remove listeners antigos para evitar duplicação se o modal for reaberto
    radioSim.removeEventListener("change", toggleFields);
    radioNao.removeEventListener("change", toggleFields);

    radioSim.addEventListener("change", toggleFields);
    radioNao.addEventListener("change", toggleFields);

    toggleFields(); // Estado inicial
  } // Handler adaptado para ler do modal genérico e usar updateDoc na coleção 'solicitacoes'

  async function handleSalvarExclusao(docId, solicitacaoData) {
    // Recebe dados para evitar re-fetch
    const saveButton = document.getElementById("btn-salvar-exclusao"); // ID mantido
    if (!saveButton) return;
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
      // Envolve a lógica em try/catch
      if (!foiExcluido) {
        throw new Error("Selecione 'Sim' ou 'Não'.");
      }

      let statusFinal = "";
      const adminFeedback = {
        foiExcluido: foiExcluido,
        dataResolucao: serverTimestamp(),
        adminNome: adminUser.nome || "Admin",
        adminId: adminUser.uid || "N/A",
      };

      if (foiExcluido === "sim") {
        if (!dataExclusaoInput || !mensagemAdmin) {
          throw new Error(
            "Para 'Sim', a data da exclusão e a mensagem são obrigatórias."
          );
        }
        statusFinal = "Concluída"; // Ou "Aprovada"? Usar "Concluída" parece mais apropriado aqui.
        try {
          adminFeedback.dataExclusao = Timestamp.fromDate(
            new Date(dataExclusaoInput + "T12:00:00Z")
          ); // Usa UTC
        } catch (dateError) {
          throw new Error(
            "Data de exclusão inválida. Use o formato AAAA-MM-DD."
          );
        }
        adminFeedback.mensagemAdmin = mensagemAdmin;
        // TODO: Chamar Cloud Function ou lógica para REALMENTE excluir da grade?
        console.warn(
          `AÇÃO NECESSÁRIA: Excluir horários da grade para solicitação ${docId}. Horários:`,
          solicitacaoData.detalhes?.horariosParaExcluir
        );
        // Exemplo: await httpsCallable(functions, 'excluirHorariosGrade')({ solicitacaoId: docId });
      } else {
        // foiExcluido === "nao"
        if (!motivoRejeicao) {
          throw new Error("Para 'Não', o motivo da rejeição é obrigatório.");
        }
        statusFinal = "Rejeitada";
        adminFeedback.motivoRejeicao = motivoRejeicao;
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
      // O onSnapshot atualizará a tabela.
    } catch (error) {
      console.error("Erro ao salvar resposta de exclusão:", error);
      alert(`Erro ao salvar: ${error.message}`);
      saveButton.disabled = false;
      saveButton.innerHTML = "Salvar Resposta (Exclusão)";
    }
  } // --- Funções do Modal (Genéricas - open/close) ---

  function openModal() {
    if (modal) modal.style.display = "flex";
  }
  function closeModal() {
    if (modal) modal.style.display = "none"; // Limpa apenas conteúdo e botões dinâmicos
    if (modalBodyContent) modalBodyContent.innerHTML = "";
    if (modalFooterActions) modalFooterActions.innerHTML = ""; // Limpa tudo
    // Readiciona o botão Cancelar padrão
    if (modalCancelBtn && modalFooterActions)
      modalFooterActions.appendChild(modalCancelBtn);
    if (modalTitle) modalTitle.textContent = "Detalhes da Solicitação"; // Título padrão
  } // --- Inicialização ---

  setupTabs();
  loadNovasSessoes();
  loadAlteracoesHorario();
  loadDesfechosPB();
  loadReavaliacao(); // Adicionado
  loadInclusaoAlteracaoGradePB(); // Adicionado
  loadStatusContratos(); // TODO
  loadExclusaoHorarios(); // Agora lê de 'solicitacoes' // --- Listener de Evento Genérico (Simplificado) ---
  if (tabContentContainer) {
    tabContentContainer.addEventListener("click", async (e) => {
      const button = e.target.closest(".btn-processar-solicitacao"); // Classe comum para todos os botões

      if (button) {
        const docId = button.dataset.docId;
        const tipo = button.dataset.tipo;

        if (docId && tipo) {
          openGenericSolicitacaoModal(docId, tipo); // Chama o modal genérico
        } else {
          console.error(
            "Doc ID ou Tipo não encontrado no botão de processar:",
            button.dataset
          );
          alert("Erro: Não foi possível identificar a solicitação.");
        }
      }
      // Remover os listeners específicos antigos (btn-acao-exclusao, btn-acao-alteracao-trilha)
    });
  } // Event listeners do modal (Fechar/Cancelar - Mantidos)

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        // Fecha ao clicar fora
        closeModal();
      }
    });
  }
} // Fim da função init
