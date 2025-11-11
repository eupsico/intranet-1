// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 4.3 (2 Abas: Atas + Gráficos, Sem Agendamentos, Completo)

// Importações do Firebase
import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

// Variáveis globais
let todasAsAtas = []; // Array com todas as atas carregadas de "gestao_atas"
let unsubscribeAtas = null; // Função para cancelar listener das atas
let timeoutBusca = null; // Timeout para delay na busca

// Função para normalizar participantes (converte string para array se necessário)
function normalizarParticipantes(participantes) {
  if (participantes == null) {
    return []; // Array vazio se não existir
  }
  if (Array.isArray(participantes)) {
    return participantes; // Já é array, usa diretamente
  }
  if (typeof participantes === "string") {
    // Divide string por vírgulas ou quebras de linha, remove espaços e filtra vazios
    return participantes
      .split(/[\n,]+/)
      .map(function (nome) {
        return nome.trim(); // Remove espaços no início e fim
      })
      .filter(function (nome) {
        return nome.length > 0; // Remove nomes vazios
      });
  }
  console.warn(
    "[DASH] Formato inválido de participantes:",
    typeof participantes,
    participantes
  );
  return []; // Fallback para array vazio
}

// Função principal de inicialização do módulo
export function init() {
  console.log(
    "[DASH] Inicializando Dashboard de Reuniões (v4.3 - 2 Abas: Atas + Gráficos)."
  );
  configurarEventListeners();
  carregarDadosDasAtas();
}

// Função para carregar dados das atas
function carregarDadosDasAtas() {
  // Container para as atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas == null) {
    console.error(
      "[DASH] Elemento com ID 'atas-container' não encontrado no HTML."
    );
    return;
  }

  // Cancela listener anterior se existir
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
  }

  // Configura listener realtime para atas (coleção "gestao_atas")
  const consultaParaAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(
    consultaParaAtas,
    function (resultadoDaConsulta) {
      todasAsAtas = resultadoDaConsulta.docs.map(function (documentoDaAta) {
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

      // Atualiza gráficos (baseado apenas nas atas)
      atualizarGraficos();

      // Log de debugging
      console.log("[DASH] Atas carregadas:", todasAsAtas.length, "documentos.");
    }
  );
}

// Função para configurar todos os event listeners
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
  const seletorDeTipo = document.getElementById("tipo-filtro-atas");
  if (seletorDeTipo != null) {
    seletorDeTipo.addEventListener("change", aplicarFiltrosEExibirAtas);
  }

  // Event listener para filtro de status na aba Atas
  const seletorDeStatus = document.getElementById("status-filtro-atas");
  if (seletorDeStatus != null) {
    seletorDeStatus.addEventListener("change", aplicarFiltrosEExibirAtas);
  }

  // Event listener para busca por título (com delay para evitar muitas execuções)
  const campoDeBusca = document.getElementById("busca-titulo-atas");
  if (campoDeBusca != null) {
    campoDeBusca.addEventListener("input", function () {
      // Cancela timeout anterior se existir
      if (timeoutBusca != null) {
        clearTimeout(timeoutBusca);
      }
      // Cria novo timeout de 300ms
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  // Event listener para botão limpar filtros na aba Atas
  const botaoLimparFiltros = document.getElementById("limpar-filtros-atas");
  if (botaoLimparFiltros != null) {
    botaoLimparFiltros.addEventListener("click", function () {
      // Reset do filtro de tipo para "Todos"
      if (seletorDeTipo != null) {
        seletorDeTipo.value = "Todos";
      }
      // Reset do filtro de status para "Todos"
      if (seletorDeStatus != null) {
        seletorDeStatus.value = "Todos";
      }
      // Limpa campo de busca
      if (campoDeBusca != null) {
        campoDeBusca.value = "";
      }
      // Aplica filtros novamente
      aplicarFiltrosEExibirAtas();
    });
  }

  // Event listener para cliques nos botões de ação das atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener("click", function (eventoDeClique) {
      // Verifica se clicou em botão PDF
      if (eventoDeClique.target.matches(".btn-pdf")) {
        // Pega o ID da ata do elemento mais próximo com data-ata-id
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        gerarPDFDaAta(idDaAta);
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
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener("click", function (eventoDeClique) {
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

  // Event listener para suporte a touch em dispositivos móveis
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener(
      "touchstart",
      function (eventoDeTouch) {
        if (eventoDeTouch.target.matches(".ata-header, .btn")) {
          eventoDeTouch.preventDefault();
        }
      },
      { passive: false }
    );
  }
}

// Função para alternar entre abas
function alternarParaAba(idDaAba) {
  console.log("[DASH] Alternando para aba:", idDaAba);

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

// Função para atualizar estatísticas visuais (baseado apenas nas atas)
function atualizarEstatisticas() {
  const dataAtual = new Date();

  // Calcula estatísticas das atas carregadas
  const totalDeAtas = todasAsAtas.length;

  // Conta atas agendadas/futuras
  const atasAgendadas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtual;
  }).length;

  // Conta atas concluídas
  const atasConcluidas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataDaAta.getTime()) &&
      dataDaAta < dataAtual &&
      ata.status === "Concluída"
    );
  }).length;

  // Atualiza elementos HTML dos contadores
  const elementoTotal = document.getElementById("total-reunioes");
  const elementoProximas = document.getElementById("proximas-reunioes");
  const elementoConcluidas = document.getElementById("reunioes-concluidas");

  if (elementoTotal != null) {
    elementoTotal.textContent = totalDeAtas;
  }
  if (elementoProximas != null) {
    elementoProximas.textContent = atasAgendadas;
  }
  if (elementoConcluidas != null) {
    elementoConcluidas.textContent = atasConcluidas;
  }

  // Renderiza card da próxima reunião
  renderizarCardProximaReuniao();

  // Atualiza contador de atas na lista
  atualizarContadorDeAtas(totalDeAtas);
}

// Função para renderizar card da próxima reunião (baseado apenas nas atas)
function renderizarCardProximaReuniao() {
  const dataAtual = new Date();

  // Filtra atas futuras
  const atasFuturas = todasAsAtas
    .filter(function (ata) {
      const dataDaAta = new Date(ata.dataReuniao || 0);
      return !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtual;
    })
    .sort(function (ataA, ataB) {
      return new Date(ataA.dataReuniao) - new Date(ataB.dataReuniao);
    });

  const elementoInformacao = document.getElementById("proxima-reuniao-info");
  if (elementoInformacao == null || atasFuturas.length === 0) {
    return;
  }

  const ataProxima = atasFuturas[0];
  const dataProximaAta = new Date(ataProxima.dataReuniao || 0);

  if (isNaN(dataProximaAta.getTime())) {
    return;
  }

  const diferencaEmMilissegundos = dataProximaAta - dataAtual;
  const diasRestantes = Math.floor(
    diferencaEmMilissegundos / (1000 * 60 * 60 * 24)
  );
  const horasRestantes = Math.floor(
    (diferencaEmMilissegundos % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutosRestantes = Math.floor(
    (diferencaEmMilissegundos % (1000 * 60 * 60)) / (1000 * 60)
  );

  let textoTempo = "";
  if (diasRestantes > 0) {
    textoTempo = `Em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`;
  } else if (horasRestantes > 0) {
    textoTempo = `Em ${horasRestantes} hora${horasRestantes > 1 ? "s" : ""}`;
  } else if (minutosRestantes > 0) {
    textoTempo = `Em ${minutosRestantes} minuto${
      minutosRestantes > 1 ? "s" : ""
    }`;
  } else {
    textoTempo = "Em breve!";
  }

  elementoInformacao.innerHTML = `
        <h5>${ataProxima.titulo || ataProxima.tipo || "Reunião Agendada"}</h5>
        <p><strong>Tipo:</strong> ${ataProxima.tipo || "Não especificado"}</p>
        <p><strong>Data:</strong> ${dataProximaAta.toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        })}</p>
        <p><strong>Local:</strong> ${ataProxima.local || "Online"}</p>
        <p class="fw-bold">${textoTempo}</p>
    `;

  const botaoVerDetalhes = document.getElementById("ver-detalhes-proxima");
  if (botaoVerDetalhes != null) {
    botaoVerDetalhes.onclick = function () {
      alert(`Navegando para detalhes da ata: ${ataProxima.id}`);
    };
  }

  const botaoCalendario = document.getElementById("calendario-proxima");
  if (botaoCalendario != null) {
    botaoCalendario.onclick = function () {
      const urlCalendario = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        ataProxima.titulo || "Reunião"
      )}&dates=${dataProximaAta
        .toISOString()
        .slice(
          0,
          -1
        )}Z/${dataProximaAta.toISOString()}&details=Reunião no EuPsico&location=${encodeURIComponent(
        ataProxima.local || "Online"
      )}`;
      window.open(urlCalendario, "_blank");
    };
  }
}

// Função para aplicar filtros e exibir atas
function aplicarFiltrosEExibirAtas() {
  // Pega valores atuais dos filtros
  const valorFiltroTipo =
    document.getElementById("tipo-filtro-atas")?.value || "Todos";
  const valorFiltroStatus =
    document.getElementById("status-filtro-atas")?.value || "Todos";
  const termoDeBusca =
    document.getElementById("busca-titulo-atas")?.value.toLowerCase() || "";

  // Cria cópia de todas as atas
  let atasFiltradas = [...todasAsAtas];

  // Aplica filtro por tipo se não for "Todos"
  if (valorFiltroTipo !== "Todos") {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      return ata.tipo?.toLowerCase().includes(valorFiltroTipo.toLowerCase());
    });
  }

  // Aplica filtro por status se não for "Todos"
  if (valorFiltroStatus !== "Todos") {
    const dataAtualAgora = new Date();
    atasFiltradas = atasFiltradas.filter(function (ata) {
      const dataDaAta = new Date(ata.dataReuniao || 0);
      if (valorFiltroStatus === "Agendada") {
        return dataDaAta > dataAtualAgora;
      } else if (valorFiltroStatus === "Concluída") {
        return dataDaAta < dataAtualAgora && ata.status === "Concluída";
      } else if (valorFiltroStatus === "Cancelada") {
        return ata.status === "Cancelada";
      }
      return true;
    });
  }

  // Aplica filtro de busca se houver termo
  if (termoDeBusca) {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      return (
        ata.titulo?.toLowerCase().includes(termoDeBusca) ||
        ata.tipo?.toLowerCase().includes(termoDeBusca)
      );
    });
  }

  // Ordena as atas filtradas por dataReuniao (mais recente primeiro)
  atasFiltradas.sort(function (ataA, ataB) {
    const dataAtaA = new Date(ataA.dataReuniao || 0);
    const dataAtaB = new Date(ataB.dataReuniao || 0);
    return dataAtaB - dataAtaA;
  });

  // Container onde serão inseridas as atas filtradas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas != null) {
    // Se não há atas filtradas
    if (atasFiltradas.length === 0) {
      containerDasAtas.innerHTML = `
                <div class="alert alert-info text-center">
                    <span class="material-symbols-outlined">search_off</span>
                    Nenhuma ata encontrada para este filtro.
                </div>
            `;
    } else {
      try {
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
      } catch (erro) {
        console.error("[DASH] Erro ao gerar HTML das atas:", erro);
        containerDasAtas.innerHTML = `
                    <div class="alert alert-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro ao exibir atas: ${erro.message}
                    </div>
                `;
      }
    }
  }

  // Atualiza estatísticas (mesmo com filtros aplicados)
  atualizarEstatisticas();
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

    // Define cor, ícone e texto do status
    let classeCorDoStatus = "text-muted";
    let iconeDoStatus = "help_outline";
    let textoDoStatus = "Registrada";
    if (ataEhFutura) {
      classeCorDoStatus = "text-info";
      iconeDoStatus = "schedule";
      textoDoStatus = "Agendada";
    } else if (ataEhConcluida) {
      classeCorDoStatus = "text-success";
      iconeDoStatus = "check_circle";
      textoDoStatus = "Concluída";
    } else if (ataEhCancelada) {
      classeCorDoStatus = "text-danger";
      iconeDoStatus = "cancel";
      textoDoStatus = "Cancelada";
    }

    // Formata data para exibição
    const dataFormatada = !isNaN(dataDaAta.getTime())
      ? dataDaAta.toLocaleDateString("pt-BR")
      : "Data inválida";

    // Normaliza participantes para badges
    const participantes = normalizarParticipantes(ata.participantes);
    const previewDosParticipantes = participantes.slice(0, 3);
    const maisParticipantesRestantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    // Conteúdo dos detalhes básicos
    const conteudoDosDetalhesBasicos = `
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      ata.tipo || "Não especificado"
                    }</p>
                    <p><strong>Data:</strong> <span class="${classeCorDoStatus}">${dataFormatada}</span></p>
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
    const conteudoDosParticipantes =
      participantes.length > 0
        ? `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-info me-1">group</span> Participantes</h6>
                <div class="d-flex flex-wrap gap-1 mb-1">
                    ${previewDosParticipantes
                      .map(function (nome) {
                        return `<span class="badge bg-light text-dark">${nome}</span>`;
                      })
                      .join("")}
                    ${
                      maisParticipantesRestantes
                        ? `<span class="badge bg-secondary">${maisParticipantesRestantes}</span>`
                        : ""
                    }
                </div>
                <small class="text-muted">Total: ${participantes.length}</small>
            </div>
        `
        : "";

    // Conteúdo do resumo
    const textoDoResumo =
      ata.resumo ||
      ata.notas ||
      ata.pontosDiscutidos ||
      "Sem resumo disponível.";
    const conteudoDoResumo = `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-primary me-1">description</span> Resumo</h6>
                <p class="mb-0">${textoDoResumo}</p>
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

    // HTML completo do accordion da ata
    return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${classeCorDoStatus};">${iconeDoStatus}</span>
                            <h5 class="mb-0">${
                              ata.titulo || ata.tipo || "Reunião"
                            }</h5>
                            <span class="badge ms-2 bg-info text-info">Ata</span>
                        </div>
                        <small class="text-muted">${dataFormatada}</small>
                    </div>
                    <div class="ata-acoes">
                        <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="PDF" data-ata-id="${
                          ata.id
                        }">
                            <span class="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                        <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Feedback" data-ata-id="${
                          ata.id
                        }">
                            <span class="material-symbols-outlined">feedback</span>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar" data-ata-id="${
                          ata.id
                        }">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                </div>
                <div class="ata-conteudo card-body" style="display: none; border-top: 1px solid #e5e7eb;">
                    ${conteudoDosDetalhesBasicos}
                    ${conteudoDosParticipantes}
                    ${conteudoDoResumo}
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
            <div class="ata-item card mb-4 border-danger">
                <div class="card-body">
                    <p class="text-danger">Erro ao carregar ata ${ata.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para configurar event listeners dos accordions (expandir/contrair)
function configurarEventListenersDosAccordions() {
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas == null) {
    return;
  }

  // Encontra todos os headers de accordion
  const todosOsHeaders = containerDasAtas.querySelectorAll(".ata-header");
  todosOsHeaders.forEach(function (header) {
    // Adiciona event listener para expandir/contrair
    header.addEventListener("click", function () {
      // Encontra o conteúdo correspondente
      const conteudoCorrespondente =
        header.parentElement.querySelector(".ata-conteudo");

      if (conteudoCorrespondente != null) {
        // Alterna visibilidade do conteúdo
        if (conteudoCorrespondente.style.display === "none") {
          conteudoCorrespondente.style.display = "block";
        } else {
          conteudoCorrespondente.style.display = "none";
        }
      }
    });
  });
}

// Função para atualizar contador de atas
function atualizarContadorDeAtas(quantidade) {
  const elementoContador = document.getElementById("contador-atas");
  if (elementoContador != null) {
    elementoContador.textContent = quantidade;
    // Altera cor do badge se tem itens ou não
    if (quantidade > 0) {
      elementoContador.className = "badge bg-primary ms-2";
    } else {
      elementoContador.className = "badge bg-secondary ms-2";
    }
  }
}

// Função para gerar PDF de uma ata
function gerarPDFDaAta(idDaAta) {
  // Encontra a ata pelo ID
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });

  if (ata == null) {
    console.error("[DASH] Ata não encontrada para gerar PDF:", idDaAta);
    return;
  }

  console.log("[DASH] Gerando PDF da ata:", ata.titulo);
  // Aqui seria implementada a geração real de PDF com jsPDF ou outra biblioteca
  alert(
    `Gerando PDF da ata "${
      ata.titulo || "ID: " + idDaAta
    }" (implementar com jsPDF ou window.print()).`
  );
}

// Função para abrir formulário de feedback de uma ata
function abrirFormularioDeFeedback(idDaAta) {
  // Encontra a ata pelo ID
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });

  if (ata == null) {
    console.error("[DASH] Ata não encontrada para feedback:", idDaAta);
    return;
  }

  console.log("[DASH] Abrindo feedback da ata:", ata.titulo);
  // Aqui seria implementada navegação para página de feedback ou modal
  alert(
    `Abrindo formulário de feedback da ata "${
      ata.titulo || idDaAta
    }". Implementar navegação para feedback.html?ataId=${idDaAta}.`
  );
}

// Função para editar uma ata
function editarAta(idDaAta) {
  // Encontra a ata pelo ID
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });

  if (ata == null) {
    console.error("[DASH] Ata não encontrada para edição:", idDaAta);
    return;
  }

  console.log("[DASH] Editando ata:", ata.titulo);
  // Aqui seria implementada navegação para editor
  alert(
    `Editando ata "${
      ata.titulo || idDaAta
    }". Implementar navegação para editor de atas.`
  );
}

// Função para limpar recursos (cancelar listeners) quando sair da view
export function cleanup() {
  // Cancela listener das atas se existir
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener das atas cancelado.");
  }

  // Limpa timeout de busca se existir
  if (timeoutBusca != null) {
    clearTimeout(timeoutBusca);
    timeoutBusca = null;
  }

  console.log("[DASH] Limpeza de recursos concluída.");
}
