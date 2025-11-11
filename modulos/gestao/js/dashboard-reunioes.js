// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.6 (Simples: Atas + Contagem de Agendamentos para Stats, Sem Tabs Complexos)

// Importações do Firebase
import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

// Variáveis globais
let todasAsAtas = []; // Todas as atas carregadas do Firestore
let totalAgendamentosVoluntarios = 0; // Total de agendamentos para estatísticas
let unsubscribeAtas = null; // Função para cancelar listener das atas
let unsubscribeAgendamentos = null; // Função para cancelar listener dos agendamentos
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
      .map((nome) => nome.trim())
      .filter((nome) => nome.length > 0);
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
  console.log("[DASH] Inicializando Dashboard de Reuniões (v3.6 - Simples).");
  configurarTodosOsEventListeners();
  carregarTodosOsDados();
}

// Função para carregar dados do dashboard
function carregarTodosOsDados() {
  // Container para as atas
  const containerParaAtas = document.getElementById("atas-container");
  if (containerParaAtas == null) {
    console.error(
      "[DASH] Elemento com ID 'atas-container' não encontrado no HTML."
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

  // Listener para atas (coleção "gestao_atas")
  const consultaParaAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(consultaParaAtas, (resultadoDaConsulta) => {
    todasAsAtas = resultadoDaConsulta.docs.map((documento) => {
      return {
        id: documento.id,
        ...documento.data(),
        participantes: normalizarParticipantes(documento.data().participantes),
      };
    });
    atualizarEstatisticas();
    aplicarFiltrosEExibirAtas();
    console.log("[DASH] Atas carregadas:", todasAsAtas.length, "documentos.");
  });

  // Listener para contagem de agendamentos (coleção "agendamentos_voluntarios", só para stats)
  const consultaParaAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(
    consultaParaAgendamentos,
    (resultadoDaConsulta) => {
      totalAgendamentosVoluntarios = resultadoDaConsulta.docs.length;
      atualizarEstatisticas();
      console.log(
        "[DASH] Contagem de agendamentos para stats:",
        totalAgendamentosVoluntarios,
        "documentos."
      );
    }
  );
}

// Função para configurar todos os event listeners
function configurarTodosOsEventListeners() {
  // Listener para mudança no filtro de tipo
  const seletorDeTipo = document.getElementById("tipo-filtro");
  if (seletorDeTipo != null) {
    seletorDeTipo.addEventListener("change", aplicarFiltrosEExibirAtas);
  }

  // Listener para mudança no filtro de status
  const seletorDeStatus = document.getElementById("status-filtro");
  if (seletorDeStatus != null) {
    seletorDeStatus.addEventListener("change", aplicarFiltrosEExibirAtas);
  }

  // Listener para busca (com delay para evitar muitas execuções)
  const campoDeBusca = document.getElementById("busca-titulo");
  if (campoDeBusca != null) {
    campoDeBusca.addEventListener("input", function () {
      if (timeoutBusca != null) {
        clearTimeout(timeoutBusca);
      }
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  // Listener para botão de limpar filtros
  const botaoLimparFiltros = document.getElementById("limpar-filtros");
  if (botaoLimparFiltros != null) {
    botaoLimparFiltros.addEventListener("click", function () {
      if (seletorDeTipo != null) {
        seletorDeTipo.value = "Todos";
      }
      if (seletorDeStatus != null) {
        seletorDeStatus.value = "Todos";
      }
      if (campoDeBusca != null) {
        campoDeBusca.value = "";
      }
      aplicarFiltrosEExibirAtas();
    });
  }

  // Listener para cliques nos botões de ação das atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener("click", function (eventoDeClique) {
      // Verifica se clicou em botão PDF
      if (eventoDeClique.target.matches(".btn-pdf")) {
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

  // Listener para expandir/contrair accordions das atas
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener("click", function (eventoDeClique) {
      if (eventoDeClique.target.closest(".ata-header")) {
        const ataItem = eventoDeClique.target.closest(".ata-item");
        const conteudoDaAta = ataItem.querySelector(".ata-conteudo");
        if (conteudoDaAta != null) {
          if (conteudoDaAta.style.display === "none") {
            conteudoDaAta.style.display = "block";
          } else {
            conteudoDaAta.style.display = "none";
          }
        }
      }
    });
  }

  // Listener para suporte a touch em dispositivos móveis
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

// Função para atualizar estatísticas visuais
function atualizarEstatisticas() {
  const dataAtual = new Date();

  // Calcula estatísticas das atas
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

  // Total inclui agendamentos para stats
  const totalGeral = totalDeAtas + totalAgendamentosVoluntarios;
  const proximas = atasAgendadas + totalAgendamentosVoluntarios;
  const concluidas = atasConcluidas;

  // Atualiza elementos HTML dos contadores
  const elementoTotal = document.getElementById("total-reunioes");
  const elementoProximas = document.getElementById("proximas-reunioes");
  const elementoConcluidas = document.getElementById("reunioes-concluidas");

  if (elementoTotal != null) {
    elementoTotal.textContent = totalGeral;
  }
  if (elementoProximas != null) {
    elementoProximas.textContent = proximas;
  }
  if (elementoConcluidas != null) {
    elementoConcluidas.textContent = concluidas;
  }

  // Renderiza card da próxima reunião
  renderizarCardProximaReuniao();

  // Atualiza contador de atas na lista
  atualizarContadorDeAtas(totalDeAtas);
}

// Função para renderizar card da próxima reunião
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
  const valorFiltroTipo =
    document.getElementById("tipo-filtro")?.value || "Todos";
  const valorFiltroStatus =
    document.getElementById("status-filtro")?.value || "Todos";
  const termoBusca =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  let atasFiltradas = [...todasAsAtas];

  if (valorFiltroTipo !== "Todos") {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      return ata.tipo?.toLowerCase().includes(valorFiltroTipo.toLowerCase());
    });
  }

  if (valorFiltroStatus !== "Todos") {
    const dataAtual = new Date();
    atasFiltradas = atasFiltradas.filter(function (ata) {
      const dataAta = new Date(ata.dataReuniao || 0);
      if (valorFiltroStatus === "Agendada") {
        return dataAta > dataAtual;
      } else if (valorFiltroStatus === "Concluída") {
        return dataAta < dataAtual && ata.status === "Concluída";
      } else if (valorFiltroStatus === "Cancelada") {
        return ata.status === "Cancelada";
      }
      return true;
    });
  }

  if (termoBusca) {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      return (
        ata.titulo?.toLowerCase().includes(termoBusca) ||
        ata.tipo?.toLowerCase().includes(termoBusca)
      );
    });
  }

  atasFiltradas.sort(function (ataA, ataB) {
    const dataAtaA = new Date(ataA.dataReuniao || 0);
    const dataAtaB = new Date(ataB.dataReuniao || 0);
    return dataAtaB - dataAtaA;
  });

  const containerAtas = document.getElementById("atas-container");
  if (containerAtas != null) {
    if (atasFiltradas.length === 0) {
      containerAtas.innerHTML = `
                <div class="alert alert-info text-center">
                    <span class="material-symbols-outlined">search_off</span>
                    Nenhuma ata encontrada para este filtro.
                </div>
            `;
    } else {
      try {
        containerAtas.innerHTML = atasFiltradas
          .map(function (ata) {
            return gerarAccordionDaAta(ata);
          })
          .join("");
        atualizarContadorDeAtas(atasFiltradas.length);
      } catch (erro) {
        console.error("[DASH] Erro ao exibir atas:", erro);
        containerAtas.innerHTML = `
                    <div class="alert alert-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro ao exibir atas: ${erro.message}
                    </div>
                `;
      }
    }
  }
  atualizarEstatisticas();
}

// Função para gerar accordion de uma ata
function gerarAccordionDaAta(ata) {
  try {
    const dataAta = new Date(ata.dataReuniao || 0);
    const dataAtual = new Date();
    const ataEhFutura = !isNaN(dataAta.getTime()) && dataAta > dataAtual;
    const ataEhConcluida =
      !isNaN(dataAta.getTime()) &&
      dataAta < dataAtual &&
      ata.status === "Concluída";
    const ataEhCancelada = ata.status === "Cancelada";

    let corStatus = "text-muted";
    let iconeStatus = "help_outline";
    let textoStatus = ataEhFutura
      ? "Agendada"
      : ataEhConcluida
      ? "Concluída"
      : "Registrada";

    if (ataEhFutura) {
      corStatus = "text-info";
      iconeStatus = "schedule";
    } else if (ataEhConcluida) {
      corStatus = "text-success";
      iconeStatus = "check_circle";
    } else if (ataEhCancelada) {
      corStatus = "text-danger";
      iconeStatus = "cancel";
    }

    const dataFormatada = !isNaN(dataAta.getTime())
      ? dataAta.toLocaleDateString("pt-BR")
      : "Data inválida";
    const participantes = normalizarParticipantes(ata.participantes);
    const previewParticipantes = participantes.slice(0, 3);
    const maisParticipantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    const conteudoDetalhes = `
            <div class="row g-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      ata.tipo || "Não especificado"
                    }</p>
                    <p><strong>Data:</strong> <span class="${corStatus}">${dataFormatada}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Local:</strong> ${ata.local || "Online"}</p>
                    <p><strong>Responsável:</strong> ${
                      ata.responsavel || "Não especificado"
                    }</p>
                </div>
            </div>
        `;

    const conteudoParticipantes =
      participantes.length > 0
        ? `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-info me-1">group</span> Participantes</h6>
                <div class="d-flex flex-wrap gap-1 mb-1">
                    ${previewParticipantes
                      .map(
                        (nome) =>
                          `<span class="badge bg-light text-dark">${nome}</span>`
                      )
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

    const resumoTexto = ata.resumo || ata.notas || "Sem resumo disponível.";
    const conteudoResumo = `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-primary me-1">description</span> Resumo</h6>
                <p class="mb-0">${resumoTexto}</p>
            </div>
        `;

    const conteudoAccordion = `
            ${conteudoDetalhes}
            ${conteudoParticipantes}
            ${conteudoResumo}
        `;

    return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${corStatus};">${iconeStatus}</span>
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
                    ${conteudoAccordion}
                </div>
            </div>
        `;
  } catch (erro) {
    console.error("[DASH] Erro ao gerar accordion da ata:", erro);
    return `
            <div class="ata-item card mb-4 border-danger">
                <div class="card-body">
                    <p class="text-danger">Erro ao carregar ata ${ata.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para atualizar contador de atas
function atualizarContadorDeAtas(quantidade) {
  const elementoContador = document.getElementById("contador-atas");
  if (elementoContador != null) {
    elementoContador.textContent = quantidade;
    elementoContador.className =
      quantidade > 0 ? "badge bg-primary ms-2" : "badge bg-secondary ms-2";
  }
}

// Função para gerar PDF
function gerarPDF(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  if (ata == null) {
    console.error("[DASH] Ata não encontrada para PDF:", idDaAta);
    return;
  }
  console.log("[DASH] Gerando PDF:", ata.titulo);
  alert(`Gerando PDF da ata "${ata.titulo}" (implementar com jsPDF ou print).`);
}

// Função para abrir feedback
function abrirFormularioDeFeedback(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  console.log("[DASH] Abrindo feedback:", ata?.titulo);
  alert(`Abrindo feedback da ata "${ata?.titulo || idDaAta}"`);
}

// Função para editar ata
function editarAta(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  console.log("[DASH] Editando ata:", ata?.titulo);
  alert(`Editando ata "${ata?.titulo || idDaAta}"`);
}

// Função para limpar recursos (chame ao sair da view)
export function cleanup() {
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener das atas cancelado.");
  }
  if (unsubscribeAgendamentos != null) {
    unsubscribeAgendamentos();
    unsubscribeAgendamentos = null;
    console.log("[DASH] Listener dos agendamentos cancelado.");
  }
  if (timeoutBusca != null) {
    clearTimeout(timeoutBusca);
    timeoutBusca = null;
  }
  console.log("[DASH] Limpeza completa realizada.");
}
