// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 4.0 (Completo: Todas funções incluídas, tabs funcionais, realtime, sem abreviações)

// =============================================================================
// IMPORTAÇÕES DO FIREBASE
// =============================================================================
import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// =============================================================================
// VARIÁVEIS GLOBAIS
// =============================================================================
let todasAsAtas = []; // Array com todas as atas carregadas de "gestao_atas"
let todosOsAgendamentos = []; // Array com todos os agendamentos de "agendamentos_voluntarios"
let unsubscribeAtas = null; // Função para cancelar listener das atas
let unsubscribeAgendamentos = null; // Função para cancelar listener dos agendamentos
let timeoutBusca = null; // Timeout para delay na busca (evita múltiplas execuções)

// =============================================================================
// FUNÇÕES UTILITÁRIAS
// =============================================================================

// Função para normalizar o campo "participantes" (pode vir como string ou array)
function normalizarParticipantes(participantes) {
  // Se não existir participantes, retorna array vazio
  if (participantes == null) {
    return [];
  }

  // Se já é um array, retorna diretamente
  if (Array.isArray(participantes)) {
    return participantes;
  }

  // Se for uma string, divide por vírgulas ou quebras de linha
  if (typeof participantes === "string") {
    // Remove espaços em branco e filtra itens vazios
    return participantes
      .split(/[\n,]+/)
      .map(function (nome) {
        return nome.trim(); // Remove espaços no início e fim
      })
      .filter(function (nome) {
        return nome.length > 0; // Remove nomes vazios
      });
  }

  // Log de aviso para formatos não reconhecidos
  console.warn(
    "[DASH] Formato de participantes não reconhecido:",
    typeof participantes,
    participantes
  );
  return []; // Fallback para array vazio
}

// =============================================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// =============================================================================
export function init() {
  console.log("[DASH] Inicializando Dashboard de Reuniões (v4.0 - Completo).");

  // Configura todos os event listeners
  configurarEventListeners();

  // Carrega dados das duas coleções
  carregarDadosDasColecoes();
}

// =============================================================================
// CONFIGURAÇÃO DE EVENT LISTENERS
// =============================================================================
function configurarEventListeners() {
  // Event listener para switch de abas (clique em .tab-link)
  const containerPrincipal = document.querySelector(".view-container");
  if (containerPrincipal != null) {
    containerPrincipal.addEventListener("click", function (eventoDeClique) {
      // Verifica se clicou em um botão de aba
      if (eventoDeClique.target.matches(".tab-link")) {
        // Previne comportamento padrão do navegador
        eventoDeClique.preventDefault();

        // Pega o ID da aba clicada
        const idDaAba = eventoDeClique.target.dataset.tab;

        // Alterna para a aba clicada
        alternarParaAba(idDaAba);
      }
    });
  } else {
    console.error(
      "[DASH] Container .view-container não encontrado para event listeners."
    );
  }

  // Event listener para filtro de tipo na aba Atas
  const seletorTipoAtas = document.getElementById("tipo-filtro-atas");
  if (seletorTipoAtas != null) {
    seletorTipoAtas.addEventListener("change", aplicarFiltrosEExibirAtas);
  }

  // Event listener para filtro de busca na aba Atas
  const campoBuscaAtas = document.getElementById("busca-titulo-atas");
  if (campoBuscaAtas != null) {
    campoBuscaAtas.addEventListener("input", function () {
      // Cancela timeout anterior se existir
      if (timeoutBusca != null) {
        clearTimeout(timeoutBusca);
      }
      // Cria novo timeout de 300ms para evitar muitas execuções durante digitação
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  // Event listener para botão limpar filtros na aba Atas
  const botaoLimparFiltrosAtas = document.getElementById("limpar-filtros-atas");
  if (botaoLimparFiltrosAtas != null) {
    botaoLimparFiltrosAtas.addEventListener("click", function () {
      // Reset do filtro de tipo
      if (seletorTipoAtas != null) {
        seletorTipoAtas.value = "Todos";
      }
      // Limpa campo de busca
      if (campoBuscaAtas != null) {
        campoBuscaAtas.value = "";
      }
      // Aplica filtros novamente
      aplicarFiltrosEExibirAtas();
    });
  }

  // Event listener para cliques em botões de ação das atas
  const containerAtas = document.getElementById("atas-container");
  if (containerAtas != null) {
    containerAtas.addEventListener("click", function (eventoDeClique) {
      // Verifica se clicou em botão PDF
      if (eventoDeClique.target.matches(".btn-pdf")) {
        // Pega o ID da ata do elemento mais próximo com data-ata-id
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        gerarPDF(idDaAta);
      }
      // Verifica se clicou em botão de feedback
      else if (eventoDeClique.target.matches(".btn-feedback")) {
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        abrirFormularioDeFeedback(idDaAta);
      }
      // Verifica se clicou em botão de editar
      else if (eventoDeClique.target.matches(".btn-editar")) {
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        editarAta(idDaAta);
      }
    });
  }

  // Event listener para expandir/contrair accordions das atas
  if (containerAtas != null) {
    containerAtas.addEventListener("click", function (eventoDeClique) {
      if (eventoDeClique.target.closest(".ata-header")) {
        // Encontra o item da ata mais próximo
        const itemDaAta = eventoDeClique.target.closest(".ata-item");
        // Encontra o conteúdo da ata
        const conteudoDaAta = itemDaAta.querySelector(".ata-conteudo");
        if (conteudoDaAta != null) {
          // Alterna visibilidade do conteúdo
          if (conteudoDaAta.style.display === "none") {
            conteudoDaAta.style.display = "block";
          } else {
            conteudoDaAta.style.display = "none";
          }
        }
      }
    });
  }

  // Event listener para checkboxes de presença na aba Agendamentos
  const containerAgendamentos = document.getElementById(
    "agendamentos-container"
  );
  if (containerAgendamentos != null) {
    containerAgendamentos.addEventListener(
      "change",
      async function (eventoDeMudanca) {
        if (eventoDeMudanca.target.matches(".checkbox-presenca")) {
          const checkboxPresenca = eventoDeMudanca.target;
          const idAgendamento = checkboxPresenca.dataset.agendamentoId;
          const indexSlot = parseInt(checkboxPresenca.dataset.slotIndex);
          const indexVaga = parseInt(checkboxPresenca.dataset.vagaIndex);
          const estaPresente = checkboxPresenca.checked;

          // Atualiza presença no Firestore
          atualizarPresenca(
            checkboxPresenca,
            idAgendamento,
            indexSlot,
            indexVaga,
            estaPresente
          );
        }
      }
    );
  }

  // Event listener para accordions na aba Agendamentos
  if (containerAgendamentos != null) {
    containerAgendamentos.addEventListener("click", function (eventoDeClique) {
      if (eventoDeClique.target.closest(".accordion-header")) {
        const headerAccordion =
          eventoDeClique.target.closest(".accordion-header");
        const conteudoAccordion = headerAccordion.nextElementSibling;
        if (conteudoAccordion != null) {
          conteudoAccordion.classList.toggle("active");
          const iconeAccordion =
            headerAccordion.querySelector(".accordion-icon");
          if (iconeAccordion != null) {
            iconeAccordion.textContent = conteudoAccordion.classList.contains(
              "active"
            )
              ? "−"
              : "+";
          }
        }
      }
    });
  }
}

// =============================================================================
// CARREGAMENTO DE DADOS
// =============================================================================
function carregarDadosDasColecoes() {
  // Container para as atas
  const containerParaAtas = document.getElementById("atas-container");
  const containerParaAgendamentos = document.getElementById(
    "agendamentos-container"
  );

  // Se algum container não existir, loga erro e para
  if (containerParaAtas == null || containerParaAgendamentos == null) {
    console.error(
      "[DASH] Um ou mais containers não encontrados. Atas:",
      !!containerParaAtas,
      "Agendamentos:",
      !!containerParaAgendamentos
    );
    return;
  }

  // Cancela listeners anteriores
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
  }
  if (unsubscribeAgendamentos != null) {
    unsubscribeAgendamentos();
    unsubscribeAgendamentos = null;
  }

  // Configura listener realtime para atas (coleção "gestao_atas")
  const consultaParaAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(consultaParaAtas, (resultadoDaConsulta) => {
    todasAsAtas = resultadoDaConsulta.docs.map((documentoDaAta) => {
      return {
        id: documentoDaAta.id, // ID único do documento
        ...documentoDaAta.data(), // Espalha todos os campos do documento
        participantes: normalizarParticipantes(
          documentoDaAta.data().participantes
        ), // Normaliza campo participantes
      };
    });

    // Renderiza aba Atas
    renderizarAbaAtas();

    // Atualiza gráficos (usa dados de atas + agendamentos)
    atualizarGraficos();

    // Log de debugging
    console.log("[DASH] Atas carregadas:", todasAsAtas.length, "documentos.");
  });

  // Configura listener realtime para agendamentos (coleção "agendamentos_voluntarios")
  const consultaParaAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(
    consultaParaAgendamentos,
    (resultadoDaConsulta) => {
      todosOsAgendamentos = resultadoDaConsulta.docs.map(
        (documentoDoAgendamento) => {
          return {
            id: documentoDoAgendamento.id, // ID único do documento
            ...documentoDoAgendamento.data(), // Espalha todos os campos do documento
          };
        }
      );

      // Renderiza aba Agendamentos
      renderizarAbaAgendamentos();

      // Atualiza gráficos
      atualizarGraficos();

      // Log de debugging
      console.log(
        "[DASH] Agendamentos carregados:",
        todosOsAgendamentos.length,
        "documentos."
      );
    }
  );
}

// =============================================================================
// ABA ATAS - LISTAGEM DETALHADA
// =============================================================================
function renderizarAbaAtas() {
  // Container onde serão inseridas as atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas == null) {
    console.error("[DASH] Container #atas-container não encontrado.");
    return;
  }

  // Pega valores atuais dos filtros
  const valorFiltroTipo =
    document.getElementById("tipo-filtro-atas")?.value || "Todos";
  const valorBuscaTitulo =
    document.getElementById("busca-titulo-atas")?.value.toLowerCase() || "";

  // Cria cópia do array de todas as atas
  let atasFiltradas = [...todasAsAtas];

  // Aplica filtro por tipo se não for "Todos"
  if (valorFiltroTipo !== "Todos") {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      // Verifica se o tipo da ata contém o valor do filtro
      return ata.tipo?.toLowerCase().includes(valorFiltroTipo.toLowerCase());
    });
  }

  // Aplica filtro por busca no título se houver termo
  if (valorBuscaTitulo) {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      // Verifica título e tipo da ata
      return (
        ata.titulo?.toLowerCase().includes(valorBuscaTitulo) ||
        ata.tipo?.toLowerCase().includes(valorBuscaTitulo)
      );
    });
  }

  // Ordena atas por dataReuniao (mais recente primeiro)
  atasFiltradas.sort(function (ataA, ataB) {
    const dataAtaA = new Date(ataA.dataReuniao || 0);
    const dataAtaB = new Date(ataB.dataReuniao || 0);
    return dataAtaB - dataAtaA;
  });

  // Se não há atas filtradas
  if (atasFiltradas.length === 0) {
    containerDasAtas.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">search_off</span>
                Nenhuma ata encontrada para este filtro.
            </div>
        `;
    return;
  }

  // Gera HTML para cada ata filtrada
  const htmlDasAtas = atasFiltradas
    .map(function (ata) {
      return gerarAccordionIndividualDaAta(ata);
    })
    .join("");

  // Insere HTML no container
  containerDasAtas.innerHTML = `
        <div class="accordion">
            ${htmlDasAtas}
        </div>
    `;

  // Configura event listeners para os accordions
  configurarEventListenersDosAccordions();

  // Atualiza contador de atas
  atualizarContadorDeAtas(atasFiltradas.length);
}

// Função para gerar HTML de um accordion individual de ata
function gerarAccordionIndividualDaAta(ata) {
  try {
    // Converte dataReuniao para objeto Date
    const dataDaAta = new Date(ata.dataReuniao || 0);
    const dataAtualAgora = new Date();

    // Determina se a ata é futura, concluída ou cancelada
    const ataEhFutura =
      !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtualAgora;
    const ataEhConcluida =
      !isNaN(dataDaAta.getTime()) &&
      dataDaAta < dataAtualAgora &&
      ata.status === "Concluída";
    const ataEhCancelada = ata.status === "Cancelada";

    // Define cor e ícone do status
    let classeCorStatus = "text-muted";
    let iconeStatus = "help_outline";
    let textoStatus = "Registrada";
    if (ataEhFutura) {
      classeCorStatus = "text-info";
      iconeStatus = "schedule";
      textoStatus = "Agendada";
    } else if (ataEhConcluida) {
      classeCorStatus = "text-success";
      iconeStatus = "check_circle";
      textoStatus = "Concluída";
    } else if (ataEhCancelada) {
      classeCorStatus = "text-danger";
      iconeStatus = "cancel";
      textoStatus = "Cancelada";
    }

    // Formata data para exibição
    const dataFormatada = !isNaN(dataDaAta.getTime())
      ? dataDaAta.toLocaleDateString("pt-BR")
      : "Data inválida";

    // Normaliza participantes para badges
    const participantes = normalizarParticipantes(ata.participantes);
    const previewParticipantes = participantes.slice(0, 3);
    const maisParticipantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    // Conteúdo dos detalhes básicos
    const conteudoDetalhesBasicos = `
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      ata.tipo || "Não especificado"
                    }</p>
                    <p><strong>Data:</strong> <span class="${classeCorStatus}">${dataFormatada}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Local:</strong> ${ata.local || "Online"}</p>
                    <p><strong>Responsável:</strong> ${
                      ata.responsavel || "Não especificado"
                    }</p>
                </div>
            </div>
        `;

    // Conteúdo dos participantes
    const conteudoParticipantes =
      participantes.length > 0
        ? `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-info me-1">group</span> Participantes</h6>
                <div class="d-flex flex-wrap gap-1 mb-1">
                    ${previewParticipantes
                      .map(function (nome) {
                        return `<span class="badge bg-light text-dark">${nome}</span>`;
                      })
                      .join("")}
                    ${
                      maisParticipantes
                        ? `<span class="badge bg-secondary">${maisParticipantes}</span>`
                        : ""
                    }
                </div>
                <small class="text-muted">Total: ${participantes.length}</small>
            </div>
        `
        : "";

    // Conteúdo do resumo
    const textoResumo =
      ata.resumo ||
      ata.notas ||
      ata.pontosDiscutidos ||
      "Sem resumo disponível.";
    const conteudoResumo = `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-primary me-1">description</span> Resumo</h6>
                <p class="mb-0">${textoResumo}</p>
            </div>
        `;

    // Botões de ação
    const botoesDeAcao = `
            <div class="ata-acoes mt-3">
                <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="Gerar PDF" data-ata-id="${ata.id}">
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                </button>
                <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Abrir Feedback" data-ata-id="${ata.id}">
                    <span class="material-symbols-outlined">feedback</span>
                </button>
                <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar Ata" data-ata-id="${ata.id}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
            </div>
        `;

    // HTML completo do accordion
    return `
            <div class="accordion-item mb-4" data-ata-id="${ata.id}">
                <div class="accordion-header">
                    <span class="material-symbols-outlined me-2" style="color: ${classeCorStatus};">${iconeStatus}</span>
                    <h5 class="mb-0">${ata.titulo || ata.tipo || "Reunião"}</h5>
                    <span class="badge ms-2 bg-secondary">${textoStatus}</span>
                    <span class="accordion-icon ms-auto">+</span>
                </div>
                <div class="accordion-content">
                    ${conteudoDetalhesBasicos}
                    ${conteudoParticipantes}
                    ${conteudoResumo}
                    ${botoesDeAcao}
                </div>
            </div>
        `;
  } catch (erro) {
    console.error(
      "[DASH] Erro ao gerar accordion da ata:",
      erro,
      "ID da ata:",
      ata.id
    );
    return `
            <div class="accordion-item mb-4 border-danger">
                <div class="accordion-header">
                    <span class="material-symbols-outlined me-2" style="color: red;">error</span>
                    <h5 class="mb-0 text-danger">Erro na Ata</h5>
                </div>
                <div class="accordion-content">
                    <p class="text-danger">Erro ao carregar detalhes. ID: ${ata.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para configurar event listeners dos accordions (expandir/contrair)
function configurarEventListenersDosAccordions() {
  const containerAtas = document.getElementById("atas-container");
  if (containerAtas == null) return;

  // Encontra todos os headers de accordion
  const todosOsHeaders = containerAtas.querySelectorAll(".accordion-header");
  todosOsHeaders.forEach(function (header) {
    // Adiciona event listener para expandir/contrair
    header.addEventListener("click", function () {
      // Encontra o conteúdo correspondente
      const conteudoCorrespondente = header.nextElementSibling;

      // Alterna classe active para animar com CSS
      if (conteudoCorrespondente != null) {
        conteudoCorrespondente.classList.toggle("active");

        // Alterna ícone (+ para -)
        const iconeAccordion = header.querySelector(".accordion-icon");
        if (iconeAccordion != null) {
          if (conteudoCorrespondente.classList.contains("active")) {
            iconeAccordion.textContent = "−";
          } else {
            iconeAccordion.textContent = "+";
          }
        }
      }
    });
  });
}

// =============================================================================
// ABA AGENDAMENTOS - LISTAGEM DE PENDENTES
// =============================================================================
function renderizarAbaAgendamentos() {
  // Container para os agendamentos
  const containerAgendamentos = document.getElementById(
    "agendamentos-container"
  );
  if (containerAgendamentos == null) {
    console.error("[DASH] Container #agendamentos-container não encontrado.");
    return;
  }

  // Se não há agendamentos
  if (todosOsAgendamentos.length === 0) {
    containerAgendamentos.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">event_off</span>
                Nenhum agendamento encontrado.
            </div>
        `;
    return;
  }

  // Ordena agendamentos por data do primeiro slot (mais próximo primeiro)
  todosOsAgendamentos.sort(function (agendamentoA, agendamentoB) {
    // Pega data do primeiro slot ou data de criação como fallback
    const primeiroSlotA =
      agendamentoA.slots && agendamentoA.slots.length > 0
        ? agendamentoA.slots[0]
        : null;
    const dataSlotA = primeiroSlotA
      ? new Date(primeiroSlotA.data)
      : new Date(agendamentoA.criadoEm || 0);

    const primeiroSlotB =
      agendamentoB.slots && agendamentoB.slots.length > 0
        ? agendamentoB.slots[0]
        : null;
    const dataSlotB = primeiroSlotB
      ? new Date(primeiroSlotB.data)
      : new Date(agendamentoB.criadoEm || 0);

    return dataSlotA - dataSlotB;
  });

  // Gera HTML para cada agendamento
  const htmlDosAgendamentos = todosOsAgendamentos
    .map(function (agendamento) {
      return gerarAccordionDoAgendamento(agendamento);
    })
    .join("");

  // Insere HTML no container
  containerAgendamentos.innerHTML = `
        <div class="accordion">
            ${htmlDosAgendamentos}
        </div>
    `;

  // Configura event listeners para accordions dos agendamentos
  configurarAccordionsDosAgendamentos();

  // Configura event listeners para checkboxes de presença
  configurarCheckboxesDePresenca();

  // Atualiza contador de agendamentos
  atualizarContadorAgendamentos(todosOsAgendamentos.length);
}

// Função para gerar HTML de um accordion de agendamento
function gerarAccordionDoAgendamento(agendamento) {
  try {
    // Pega o primeiro slot para data/hora principal
    const primeiroSlot =
      agendamento.slots && agendamento.slots.length > 0
        ? agendamento.slots[0]
        : {};
    const dataPrimeiroSlot = new Date(
      primeiroSlot.data || agendamento.criadoEm || 0
    );

    // Calcula total de inscritos e presentes no agendamento
    let totalInscritos = 0;
    let totalPresentes = 0;

    // Percorre todos os slots e vagas
    (agendamento.slots || []).forEach(function (slot) {
      (slot.vagas || []).forEach(function (vaga) {
        totalInscritos++;
        if (vaga.presente === true) {
          totalPresentes++;
        }
      });
    });

    // Determina título do agendamento
    const tituloAgendamento =
      agendamento.descricao || `Agendamento ${agendamento.id.slice(-6)}`;
    const dataFormatada = dataPrimeiroSlot.toLocaleDateString("pt-BR");

    return `
            <div class="accordion-item mb-4" data-agendamento-id="${
              agendamento.id
            }">
                <div class="accordion-header">
                    <span class="material-symbols-outlined me-2">event</span>
                    <h5 class="mb-0">${tituloAgendamento}</h5>
                    <span class="badge ms-2 bg-info text-info">${totalInscritos} inscritos</span>
                    <span class="badge ms-2 bg-success text-success">${totalPresentes} presentes</span>
                    <span class="accordion-icon ms-auto">+</span>
                </div>
                <div class="accordion-content">
                    <div class="table-container">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Slot</th>
                                    <th>Data/Hora</th>
                                    <th>Profissional</th>
                                    <th>Gestor</th>
                                    <th>Presença</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${gerarLinhasDasVagas(agendamento)}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-3">
                        <button class="btn btn-sm btn-outline-primary" onclick="verDetalhesAgendamento('${
                          agendamento.id
                        }')">
                            Ver Detalhes do Agendamento
                        </button>
                    </div>
                </div>
            </div>
        `;
  } catch (erro) {
    console.error(
      "[DASH] Erro ao gerar accordion do agendamento:",
      erro,
      "ID:",
      agendamento.id
    );
    return `
            <div class="accordion-item mb-4 border-danger">
                <div class="accordion-header">
                    <span class="material-symbols-outlined me-2" style="color: red;">error</span>
                    <h5 class="mb-0 text-danger">Erro no Agendamento</h5>
                </div>
                <div class="accordion-content">
                    <p class="text-danger">Erro ao carregar detalhes. ID: ${agendamento.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para gerar linhas HTML das vagas de um agendamento
function gerarLinhasDasVagas(agendamento) {
  try {
    const todasAsLinhas = [];

    // Percorre todos os slots do agendamento
    (agendamento.slots || []).forEach(function (slot) {
      // Percorre todas as vagas do slot
      (slot.vagas || []).forEach(function (vaga) {
        // Determina nome do profissional
        const nomeProfissional =
          vaga.profissionalNome || vaga.profissionalId || "Não identificado";
        const estaPresente = vaga.presente || false;
        const idDaVaga = vaga.id || `vaga-${Date.now()}`; // Gera ID único se não existir

        // Adiciona linha HTML
        todasAsLinhas.push(`
                    <tr>
                        <td>${
                          slot.horaInicio || "Horário não definido"
                        } - ${slot.horaFim || "Fim não definido"}</td>
                        <td>${nomeProfissional}</td>
                        <td>${slot.gestorNome || "Gestor não especificado"}</td>
                        <td>
                            <input type="checkbox" 
                                   class="checkbox-presenca" 
                                   data-agendamento-id="${agendamento.id}"
                                   data-slot-index="${agendamento.slots.indexOf(
                                     slot
                                   )}"
                                   data-vaga-index="${slot.vagas.indexOf(vaga)}"
                                   ${estaPresente ? "checked" : ""}>
                        </td>
                    </tr>
                `);
      });
    });

    // Se não há vagas, retorna linha vazia
    if (todasAsLinhas.length === 0) {
      return '<tr><td colspan="5" class="text-center text-muted">Nenhuma vaga configurada neste agendamento.</td></tr>';
    }

    // Junta todas as linhas
    return todasAsLinhas.join("");
  } catch (erro) {
    console.error("[DASH] Erro ao gerar linhas das vagas:", erro);
    return '<tr><td colspan="5" class="text-danger">Erro ao carregar vagas.</td></tr>';
  }
}

// Função para configurar event listeners dos accordions dos agendamentos
function configurarAccordionsDosAgendamentos() {
  const containerAgendamentos = document.getElementById(
    "agendamentos-container"
  );
  if (containerAgendamentos == null) return;

  // Encontra todos os headers de accordion
  const todosOsHeaders =
    containerAgendamentos.querySelectorAll(".accordion-header");
  todosOsHeaders.forEach(function (header) {
    // Adiciona listener para expandir/contrair
    header.addEventListener("click", function () {
      // Encontra conteúdo correspondente
      const conteudoCorrespondente = header.nextElementSibling;
      if (conteudoCorrespondente != null) {
        // Alterna classe active
        conteudoCorrespondente.classList.toggle("active");

        // Alterna ícone (+ para -)
        const iconeDoAccordion = header.querySelector(".accordion-icon");
        if (iconeDoAccordion != null) {
          if (conteudoCorrespondente.classList.contains("active")) {
            iconeDoAccordion.textContent = "−";
          } else {
            iconeDoAccordion.textContent = "+";
          }
        }
      }
    });
  });
}

// Função para configurar checkboxes de presença (atualiza Firestore)
function configurarCheckboxesDePresenca() {
  const containerAgendamentos = document.getElementById(
    "agendamentos-container"
  );
  if (containerAgendamentos == null) return;

  // Encontra todos os checkboxes de presença
  const todosOsCheckboxes =
    containerAgendamentos.querySelectorAll(".checkbox-presenca");
  todosOsCheckboxes.forEach(function (checkbox) {
    // Adiciona listener para mudança
    checkbox.addEventListener("change", async function (eventoDeMudanca) {
      const idDoAgendamento = this.dataset.agendamentoId;
      const indiceDoSlot = parseInt(this.dataset.slotIndex);
      const indiceDaVaga = parseInt(this.dataset.vagaIndex);
      const estaPresente = this.checked;

      // Chama função para atualizar presença
      await atualizarPresencaDoParticipante(
        idDoAgendamento,
        indiceDoSlot,
        indiceDaVaga,
        estaPresente
      );
    });
  });
}

// Função para atualizar presença de participante no Firestore
async function atualizarPresencaDoParticipante(
  idDoAgendamento,
  indiceDoSlot,
  indiceDaVaga,
  estaPresente
) {
  try {
    // Constrói referência ao documento do agendamento
    const documentoAgendamento = doc(
      firestoreDb,
      "agendamentos_voluntarios",
      idDoAgendamento
    );

    // Pega documento atualizado
    const snapshotDoDocumento = await getDoc(documentoAgendamento);

    // Se documento não existe, para
    if (!snapshotDoDocumento.exists()) {
      console.error(
        "[DASH] Documento do agendamento não encontrado:",
        idDoAgendamento
      );
      return;
    }

    // Pega dados do agendamento
    const dadosDoAgendamento = snapshotDoDocumento.data();

    // Verifica se slot existe
    if (dadosDoAgendamento.slots && dadosDoAgendamento.slots[indiceDoSlot]) {
      // Verifica se vaga existe no slot
      const slotEspecifico = dadosDoAgendamento.slots[indiceDoSlot];
      if (slotEspecifico.vagas && slotEspecifico.vagas[indiceDaVaga]) {
        // Atualiza campo presente da vaga
        slotEspecifico.vagas[indiceDaVaga].presente = estaPresente;

        // Prepara dados para atualizar no Firestore
        const dadosParaAtualizar = {
          slots: dadosDoAgendamento.slots,
        };

        // Atualiza documento no Firestore
        await updateDoc(documentoAgendamento, dadosParaAtualizar);

        console.log(
          "[DASH] Presença atualizada:",
          estaPresente ? "Presente" : "Ausente",
          "para vaga",
          indiceDaVaga
        );

        // Feedback visual (opcional)
        checkbox.parentElement.classList.add("update-feedback");
        setTimeout(function () {
          checkbox.parentElement.classList.remove("update-feedback");
        }, 1500);
      } else {
        console.error("[DASH] Vaga não encontrada no slot especificado.");
      }
    } else {
      console.error("[DASH] Slot não encontrado no agendamento.");
    }
  } catch (erro) {
    console.error("[DASH] Erro ao atualizar presença:", erro);
    // Reverte checkbox
    const checkbox = document.querySelector(
      `[data-agendamento-id="${idDoAgendamento}"][data-slot-index="${indiceDoSlot}"][data-vaga-index="${indiceDaVaga}"]`
    );
    if (checkbox != null) {
      checkbox.checked = !estaPresente;
    }
  }
}

// Função para ver detalhes de agendamento
function verDetalhesAgendamento(idDoAgendamento) {
  console.log("[DASH] Abrindo detalhes do agendamento:", idDoAgendamento);
  // Placeholder - pode implementar navegação para página específica
  alert(`Navegando para detalhes do agendamento ID: ${idDoAgendamento}`);
}

// =============================================================================
// ABA GRÁFICOS - ESTATÍSTICAS CONSOLIDADAS
// =============================================================================
function atualizarGraficos() {
  // Container para estatísticas
  const containerGraficos = document.getElementById("graficos-tab");
  if (containerGraficos == null) return;

  // Calcula estatísticas gerais
  const totalDeAtas = todasAsAtas.length;
  const totalDeAgendamentos = todosOsAgendamentos.length;
  const totalDeEventos = totalDeAtas + totalDeAgendamentos;

  // Atualiza elementos HTML dos contadores
  const elementoTotalEventos = document.getElementById("total-reunioes");
  const elementoProximasReunioes = document.getElementById("proximas-reunioes");
  const elementoReunioesConcluidas = document.getElementById(
    "reunioes-concluidas"
  );

  if (elementoTotalEventos != null) {
    elementoTotalEventos.textContent = totalDeEventos;
  }

  // Conta agendamentos futuros (usando primeiro slot)
  const agendamentosFuturos = todosOsAgendamentos.filter(function (
    agendamento
  ) {
    const primeiroSlot =
      agendamento.slots && agendamento.slots.length > 0
        ? agendamento.slots[0]
        : null;
    const dataDoSlot = primeiroSlot
      ? new Date(primeiroSlot.data)
      : new Date(agendamento.criadoEm || 0);
    return !isNaN(dataDoSlot.getTime()) && dataDoSlot > new Date();
  }).length;

  if (elementoProximasReunioes != null) {
    elementoProximasReunioes.textContent = agendamentosFuturos;
  }

  // Conta atas concluídas
  const atasConcluidas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataDaAta.getTime()) &&
      dataDaAta < new Date() &&
      ata.status === "Concluída"
    );
  }).length;

  if (elementoReunioesConcluidas != null) {
    elementoReunioesConcluidas.textContent = atasConcluidas;
  }

  // Renderiza gráficos (placeholders para Chart.js ou implementações custom)
  renderizarGraficoPresenca();
  renderizarGraficoStatus();
}

// Função para renderizar gráfico de presença
function renderizarGraficoPresenca() {
  // Elemento canvas para gráfico de presença
  const canvasPresenca = document.getElementById("chart-presenca");
  if (canvasPresenca == null) return;

  // Pega elemento pai para inserir conteúdo
  const containerDoGrafico = canvasPresenca.parentElement;

  // Por simplicidade, usa placeholder HTML (implementar Chart.js depois)
  containerDoGrafico.innerHTML = `
        <div class="text-center">
            <h5>Distribuição de Eventos</h5>
            <div class="bg-light p-3 rounded">
                <p><strong>Total de Atas:</strong> ${todasAsAtas.length}</p>
                <p><strong>Total de Agendamentos:</strong> ${
                  todosOsAgendamentos.length
                }</p>
                <div class="progress mb-2">
                    <div class="progress-bar" role="progressbar" style="width: ${
                      todasAsAtas.length > 0
                        ? (todasAsAtas.length /
                            (todasAsAtas.length + todosOsAgendamentos.length)) *
                          100
                        : 0
                    }%">
                        ${todasAsAtas.length}
                    </div>
                </div>
                <small class="text-muted">Atas vs Agendamentos</small>
            </div>
        </div>
    `;
}

// Função para renderizar gráfico de status
function renderizarGraficoStatus() {
  // Elemento canvas para gráfico de status
  const canvasStatus = document.getElementById("chart-status");
  if (canvasStatus == null) return;

  // Pega elemento pai
  const containerDoStatus = canvasStatus.parentElement;

  // Placeholder HTML para gráfico de status
  containerDoStatus.innerHTML = `
        <div class="text-center">
            <h5>Status das Reuniões</h5>
            <div class="bg-light p-3 rounded">
                <p><strong>Concluídas:</strong> ${
                  todasAsAtas.filter((ata) => ata.status === "Concluída").length
                }</p>
                <p><strong>Agendadas:</strong> ${
                  todosOsAgendamentos.filter((agendamento) => {
                    const primeiroSlot =
                      agendamento.slots && agendamento.slots.length > 0
                        ? agendamento.slots[0]
                        : null;
                    const dataSlot = primeiroSlot
                      ? new Date(primeiroSlot.data)
                      : new Date();
                    return dataSlot > new Date();
                  }).length
                }</p>
                <p><strong>Pendentes:</strong> ${todosOsAgendamentos.length}</p>
            </div>
        </div>
    `;
}

// =============================================================================
// ABA GRÁFICOS - CONTADORES
// =============================================================================
function atualizarContadorDeAtas(quantidade) {
  const elementoContador = document.getElementById("contador-atas");
  if (elementoContador != null) {
    elementoContador.textContent = quantidade;
    // Altera cor do badge baseado se tem itens ou não
    if (quantidade > 0) {
      elementoContador.className = "badge bg-primary ms-2";
    } else {
      elementoContador.className = "badge bg-secondary ms-2";
    }
  }
}

function atualizarContadorAgendamentos(quantidade) {
  const elementoContador = document.getElementById("contador-agendamentos");
  if (elementoContador != null) {
    elementoContador.textContent = quantidade;
    if (quantidade > 0) {
      elementoContador.className = "badge bg-warning ms-2";
    } else {
      elementoContador.className = "badge bg-secondary ms-2";
    }
  }
}

// =============================================================================
// FUNÇÕES DE AÇÃO (PLACEHOLDERS PARA EXPANSÃO)
// =============================================================================
function gerarPDF(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  if (ata == null) {
    console.error("[DASH] Ata não encontrada para PDF:", idDaAta);
    return;
  }
  console.log("[DASH] Gerando PDF da ata:", ata.titulo);
  alert(
    `Gerando PDF da ata "${
      ata.titulo || idDaAta
    }" (implementar com jsPDF ou window.print()).`
  );
}

function abrirFormularioDeFeedback(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  if (ata == null) {
    console.error("[DASH] Ata não encontrada para feedback:", idDaAta);
    return;
  }
  console.log("[DASH] Abrindo formulário de feedback da ata:", ata.titulo);
  alert(`Abrindo formulário de feedback da ata "${ata.titulo || idDaAta}".`);
}

function editarAta(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  if (ata == null) {
    console.error("[DASH] Ata não encontrada para edição:", idDaAta);
    return;
  }
  console.log("[DASH] Editando ata:", ata.titulo);
  alert(
    `Editando ata "${
      ata.titulo || idDaAta
    }". Implementar navegação para editor.`
  );
}

// Função para ver detalhes do agendamento
function verDetalhesAgendamento(idDoAgendamento) {
  const agendamento = todosOsAgendamentos.find(function (
    agendamentoEncontrado
  ) {
    return agendamentoEncontrado.id === idDoAgendamento;
  });
  if (agendamento == null) {
    console.error("[DASH] Agendamento não encontrado:", idDoAgendamento);
    return;
  }
  console.log(
    "[DASH] Abrindo detalhes do agendamento:",
    agendamento.descricao || agendamento.id
  );
  alert(`Navegando para detalhes do agendamento ID: ${idDoAgendamento}`);
}

// =============================================================================
// FUNÇÕES DE LIMPEZA
// =============================================================================
export function cleanup() {
  // Cancela listener das atas
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener das atas cancelado.");
  }

  // Cancela listener dos agendamentos
  if (unsubscribeAgendamentos != null) {
    unsubscribeAgendamentos();
    unsubscribeAgendamentos = null;
    console.log("[DASH] Listener dos agendamentos cancelado.");
  }

  // Limpa timeout de busca
  if (timeoutBusca != null) {
    clearTimeout(timeoutBusca);
    timeoutBusca = null;
  }

  console.log("[DASH] Limpeza de recursos concluída.");
}

// =============================================================================
// FUNÇÃO PARA ALTERNAR ABAS
// =============================================================================
function alternarParaAba(idDaAba) {
  console.log("[DASH] Alternando para aba:", idDaAba);

  // Remove classe active de todos os botões de aba
  const todosOsBotoes = document.querySelectorAll(".tab-link");
  todosOsBotoes.forEach(function (botao) {
    botao.classList.remove("active");
  });

  // Remove classe active de todos os conteúdos de aba
  const todosOsConteudos = document.querySelectorAll(".tab-content");
  todosOsConteudos.forEach(function (conteudo) {
    conteudo.classList.remove("active");
  });

  // Adiciona classe active no botão clicado
  const botaoClicado = document.querySelector(`[data-tab="${idDaAba}"]`);
  if (botaoClicado != null) {
    botaoClicado.classList.add("active");
  }

  // Adiciona classe active no conteúdo da aba
  const conteudoDaAba = document.getElementById(`${idDaAba}-tab`);
  if (conteudoDaAba != null) {
    conteudoDaAba.classList.add("active");
    // Faz scroll suave para a aba ativa
    conteudoDaAba.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    console.error("[DASH] Conteúdo da aba não encontrado:", `${idDaAba}-tab`);
  }
}

// =============================================================================
// FUNÇÃO PARA APLICAR FILTROS E EXIBIR ATAS
// =============================================================================
function aplicarFiltrosEExibirAtas() {
  // Elemento container das atas
  const containerAtas = document.getElementById("atas-container");
  if (containerAtas == null) {
    console.error("[DASH] Container #atas-container não encontrado.");
    return;
  }

  // Pega valores dos filtros
  const filtroPorTipo =
    document.getElementById("tipo-filtro-atas")?.value || "Todos";
  const termoDaBusca =
    document.getElementById("busca-titulo-atas")?.value.toLowerCase() || "";

  // Cria cópia de todas as atas
  let atasQueAtendemFiltro = [...todasAsAtas];

  // Filtra por tipo se não for "Todos"
  if (filtroPorTipo !== "Todos") {
    atasQueAtendemFiltro = atasQueAtendemFiltro.filter(function (ata) {
      // Verifica se o tipo da ata contém o valor do filtro (case-insensitive)
      return ata.tipo?.toLowerCase().includes(filtroPorTipo.toLowerCase());
    });
  }

  // Filtra por busca no título se houver termo
  if (termoDaBusca) {
    atasQueAtendemFiltro = atasQueAtendemFiltro.filter(function (ata) {
      // Verifica título ou tipo da ata
      return (
        ata.titulo?.toLowerCase().includes(termoDaBusca) ||
        ata.tipo?.toLowerCase().includes(termoDaBusca)
      );
    });
  }

  // Ordena atas por dataReuniao (mais recente primeiro)
  atasQueAtendemFiltro.sort(function (ataA, ataB) {
    const dataAtaA = new Date(ataA.dataReuniao || 0);
    const dataAtaB = new Date(ataB.dataReuniao || 0);
    // Ordena de data mais recente para mais antiga
    return dataAtaB - dataAtaA;
  });

  // Se não há atas filtradas
  if (atasQueAtendemFiltro.length === 0) {
    containerAtas.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">search_off</span>
                Nenhuma ata encontrada para este filtro.
            </div>
        `;
    // Atualiza contador
    atualizarContadorDeAtas(0);
    return;
  }

  // Gera HTML para todas as atas filtradas
  const htmlParaInserir = atasQueAtendemFiltro
    .map(function (ata) {
      return gerarAccordionIndividualDaAta(ata);
    })
    .join("");

  // Insere HTML no container
  containerAtas.innerHTML = `
        <div class="accordion">
            ${htmlParaInserir}
        </div>
    `;

  // Configura event listeners para accordions
  configurarEventListenersDosAccordions();

  // Atualiza contador visual
  atualizarContadorDeAtas(atasQueAtendemFiltro.length);
}

// =============================================================================
// ATUALIZAÇÃO DE GRÁFICOS
// =============================================================================
function atualizarGraficos() {
  // Elemento container da aba Gráficos
  const containerGraficos = document.getElementById("graficos-tab");
  if (containerGraficos == null) {
    return;
  }

  // Calcula totais
  const totalDeAtasRegistradas = todasAsAtas.length;
  const totalDeAgendamentosPendentes = todosOsAgendamentos.length;
  const totalGeralDeEventos =
    totalDeAtasRegistradas + totalDeAgendamentosPendentes;

  // Atualiza elemento total de eventos
  const elementoTotal = document.getElementById("total-reunioes");
  if (elementoTotal != null) {
    elementoTotal.textContent = totalGeralDeEventos;
  }

  // Conta agendamentos futuros (usando data do primeiro slot)
  const agendamentosQueSaoFuturos = todosOsAgendamentos.filter(function (
    agendamento
  ) {
    // Pega primeiro slot para data
    const primeiroSlot =
      agendamento.slots && agendamento.slots.length > 0
        ? agendamento.slots[0]
        : null;
    const dataDoPrimeiroSlot = primeiroSlot
      ? new Date(primeiroSlot.data)
      : new Date(agendamento.criadoEm || 0);
    // Verifica se é futura
    return (
      !isNaN(dataDoPrimeiroSlot.getTime()) && dataDoPrimeiroSlot > new Date()
    );
  }).length;

  // Atualiza elemento próximas reuniões
  const elementoProximas = document.getElementById("proximas-reunioes");
  if (elementoProximas != null) {
    elementoProximas.textContent = agendamentosQueSaoFuturos;
  }

  // Conta atas concluídas
  const atasQueEstaoConcluidas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataDaAta.getTime()) &&
      dataDaAta < new Date() &&
      ata.status === "Concluída"
    );
  }).length;

  // Atualiza elemento reuniões concluídas
  const elementoConcluidas = document.getElementById("reunioes-concluidas");
  if (elementoConcluidas != null) {
    elementoConcluidas.textContent = atasQueEstaoConcluidas;
  }

  // Atualiza gráfico de presença
  renderizarGraficoDePresenca();

  // Atualiza gráfico de status
  renderizarGraficoDeStatus();
}

// Função para renderizar gráfico de presença (placeholder para Chart.js)
function renderizarGraficoDePresenca() {
  const elementoCanvasPresenca = document.getElementById("chart-presenca");
  if (elementoCanvasPresenca == null) {
    return;
  }

  // Container pai do canvas
  const containerPai = elementoCanvasPresenca.parentElement;

  // Por simplicidade, substitui canvas por div com dados
  containerPai.innerHTML = `
        <div class="text-center">
            <h5>Distribuição de Eventos</h5>
            <div class="bg-light p-3 rounded">
                <p class="mb-2"><strong>Total de Atas:</strong> ${
                  todasAsAtas.length
                }</p>
                <p class="mb-2"><strong>Total de Agendamentos:</strong> ${
                  todosOsAgendamentos.length
                }</p>
                <div class="progress mb-2">
                    <div class="progress-bar progress-bar-striped" 
                         role="progressbar" 
                         style="width: ${
                           todasAsAtas.length > 0
                             ? (todasAsAtas.length /
                                 (todasAsAtas.length +
                                   todosOsAgendamentos.length)) *
                               100
                             : 0
                         }%">
                        Atas
                    </div>
                </div>
                <small class="text-muted">Gráfico de presença por tipo de evento</small>
            </div>
        </div>
    `;
}

// Função para renderizar gráfico de status (placeholder para Chart.js)
function renderizarGraficoDeStatus() {
  const elementoCanvasStatus = document.getElementById("chart-status");
  if (elementoCanvasStatus == null) {
    return;
  }

  // Container pai do canvas
  const containerPai = elementoCanvasStatus.parentElement;

  // Substitui canvas por div com estatísticas
  containerPai.innerHTML = `
        <div class="text-center">
            <h5>Status das Reuniões</h5>
            <div class="bg-light p-3 rounded">
                <p class="mb-2"><strong>Atas Concluídas:</strong> ${
                  todasAsAtas.filter(function (ata) {
                    const dataDaAta = new Date(ata.dataReuniao || 0);
                    return (
                      !isNaN(dataDaAta.getTime()) &&
                      dataDaAta < new Date() &&
                      ata.status === "Concluída"
                    );
                  }).length
                }</p>
                <p class="mb-2"><strong>Agendamentos Futuros:</strong> ${
                  todosOsAgendamentos.filter(function (agendamento) {
                    const primeiroSlot =
                      agendamento.slots && agendamento.slots.length > 0
                        ? agendamento.slots[0]
                        : null;
                    const dataDoSlot = primeiroSlot
                      ? new Date(primeiroSlot.data)
                      : new Date();
                    return (
                      !isNaN(dataDoSlot.getTime()) && dataDoSlot > new Date()
                    );
                  }).length
                }</p>
                <p class="mb-2"><strong>Agendamentos Pendentes:</strong> ${
                  todosOsAgendamentos.length
                }</p>
            </div>
        </div>
    `;
}

// =============================================================================
// FUNÇÕES DE CONTROLE VISUAL
// =============================================================================
function atualizarContadorDeAtas(quantidade) {
  const elementoContadorAtas = document.getElementById("contador-atas");
  if (elementoContadorAtas != null) {
    elementoContadorAtas.textContent = quantidade;
    // Altera cor do badge se tem itens
    if (quantidade > 0) {
      elementoContadorAtas.className = "badge bg-primary ms-2";
    } else {
      elementoContadorAtas.className = "badge bg-secondary ms-2";
    }
  }
}

function atualizarContadorAgendamentos(quantidade) {
  const elementoContadorAgendamentos = document.getElementById(
    "contador-agendamentos"
  );
  if (elementoContadorAgendamentos != null) {
    elementoContadorAgendamentos.textContent = quantidade;
    // Altera cor do badge
    if (quantidade > 0) {
      elementoContadorAgendamentos.className = "badge bg-warning ms-2";
    } else {
      elementoContadorAgendamentos.className = "badge bg-secondary ms-2";
    }
  }
}

// =============================================================================
// FUNÇÕES DE AÇÃO (PLACEHOLDERS PARA IMPLEMENTAÇÕES FUTURAS)
// =============================================================================
function gerarPDF(idDaAta) {
  // Função para gerar PDF de uma ata
  const ataParaPDF = todasAsAtas.find(function (ata) {
    return ata.id === idDaAta;
  });

  if (ataParaPDF == null) {
    console.error("[DASH] Ata não encontrada para gerar PDF:", idDaAta);
    return;
  }

  console.log("[DASH] Gerando PDF da ata:", ataParaPDF.titulo);
  // Aqui seria implementada a geração real de PDF
  alert(
    `Gerando PDF da ata "${
      ataParaPDF.titulo || "ID: " + idDaAta
    }" (implementar com jsPDF ou biblioteca de PDF).`
  );
}

function abrirFormularioDeFeedback(idDaAta) {
  // Função para abrir formulário de feedback
  const ataParaFeedback = todasAsAtas.find(function (ata) {
    return ata.id === idDaAta;
  });

  if (ataParaFeedback == null) {
    console.error("[DASH] Ata não encontrada para feedback:", idDaAta);
    return;
  }

  console.log("[DASH] Abrindo feedback da ata:", ataParaFeedback.titulo);
  // Aqui seria implementada navegação para página de feedback ou modal
  alert(
    `Abrindo formulário de feedback da ata "${
      ataParaFeedback.titulo || idDaAta
    }". Implementar navegação para feedback.html?ataId=${idDaAta}.`
  );
}

function editarAta(idDaAta) {
  // Função para editar ata
  const ataParaEdicao = todasAsAtas.find(function (ata) {
    return ata.id === idDaAta;
  });

  if (ataParaEdicao == null) {
    console.error("[DASH] Ata não encontrada para edição:", idDaAta);
    return;
  }

  console.log("[DASH] Editando ata:", ataParaEdicao.titulo);
  // Aqui seria implementada navegação para editor
  alert(
    `Editando ata "${
      ataParaEdicao.titulo || idDaAta
    }". Implementar navegação para editor de atas.`
  );
}

// =============================================================================
// FUNÇÃO DE LIMPEZA DE RECURSOS
// =============================================================================
export function cleanup() {
  // Cancela listener das atas se existir
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener das atas cancelado com sucesso.");
  }

  // Cancela listener dos agendamentos se existir
  if (unsubscribeAgendamentos != null) {
    unsubscribeAgendamentos();
    unsubscribeAgendamentos = null;
    console.log("[DASH] Listener dos agendamentos cancelado com sucesso.");
  }

  // Limpa timeout de busca se existir
  if (timeoutBusca != null) {
    clearTimeout(timeoutBusca);
    timeoutBusca = null;
    console.log("[DASH] Timeout de busca limpo.");
  }

  console.log("[DASH] Limpeza de todos os recursos concluída.");
}

// =============================================================================
// FUNÇÃO PARA ALTERNAR ENTRE ABAS
// =============================================================================
function alternarParaAba(idDaAba) {
  console.log("[DASH] Alternando para a aba:", idDaAba);

  // Remove classe 'active' de todos os botões de aba
  const todosOsBotoesDeAba = document.querySelectorAll(".tab-link");
  todosOsBotoesDeAba.forEach(function (botaoDeAba) {
    botaoDeAba.classList.remove("active");
  });

  // Remove classe 'active' de todos os conteúdos de aba
  const todosOsConteudosDeAba = document.querySelectorAll(".tab-content");
  todosOsConteudosDeAba.forEach(function (conteudoDeAba) {
    conteudoDeAba.classList.remove("active");
  });

  // Adiciona classe 'active' no botão da aba clicada
  const botaoClicado = document.querySelector(`[data-tab="${idDaAba}"]`);
  if (botaoClicado != null) {
    botaoClicado.classList.add("active");
  }

  // Adiciona classe 'active' no conteúdo da aba clicada
  const conteudoClicado = document.getElementById(`${idDaAba}-tab`);
  if (conteudoClicado != null) {
    conteudoClicado.classList.add("active");
    // Faz scroll suave para o conteúdo da aba
    conteudoClicado.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } else {
    console.error("[DASH] Conteúdo da aba não encontrado para:", idDaAba);
  }
}
