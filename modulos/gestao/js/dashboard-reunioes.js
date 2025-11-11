// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.5 (Simples: Atas + Contagem Voluntários nas Stats, Apenas Atas na Lista)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let totalAgendamentosVoluntarios = 0;
let unsubscribeAtas = null;
let unsubscribeVoluntarios = null;
let timeoutBusca = null;

// Função para normalizar o campo participantes (converte string para array se necessário)
function normalizarParticipantes(participantes) {
  if (participantes == null) {
    return [];
  }
  if (Array.isArray(participantes)) {
    return participantes;
  }
  if (typeof participantes === "string") {
    return participantes
      .split(/[\n,]+/)
      .map(function (nome) {
        return nome.trim();
      })
      .filter(function (nome) {
        return nome.length > 0;
      });
  }
  console.warn(
    "[DASH] Formato de participantes não reconhecido:",
    typeof participantes
  );
  return [];
}

// Função principal de inicialização do dashboard
export function init() {
  console.log(
    "[DASH] Módulo Dashboard de Reuniões iniciado (v3.5 - Atas + Stats Voluntários)."
  );
  configurarEventListeners();
  carregarDadosDoDashboard();
}

// Função para carregar todos os dados necessários (atas + contagem de agendamentos)
function carregarDadosDoDashboard() {
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas == null) {
    console.error("[DASH] Elemento #atas-container não encontrado no HTML.");
    return;
  }

  // Cancela listeners anteriores se existirem
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
  }
  if (unsubscribeVoluntarios != null) {
    unsubscribeVoluntarios();
    unsubscribeVoluntarios = null;
  }

  // Configura listener para as atas registradas (coleção principal)
  const queryDasAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(queryDasAtas, function (snapshotDasAtas) {
    todasAsAtas = snapshotDasAtas.docs.map(function (documentoDaAta) {
      return {
        id: documentoDaAta.id,
        ...documentoDaAta.data(),
        participantes: normalizarParticipantes(
          documentoDaAta.data().participantes
        ),
      };
    });
    atualizarEstatisticas();
    aplicarFiltrosEExibirReunioes();
    console.log("[DASH] Atas carregadas:", todasAsAtas.length, "atas.");
  });

  // Configura listener para contagem de agendamentos (apenas para estatísticas)
  const queryDosAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeVoluntarios = onSnapshot(
    queryDosAgendamentos,
    function (snapshotDosAgendamentos) {
      totalAgendamentosVoluntarios = snapshotDosAgendamentos.docs.length;
      atualizarEstatisticas();
      console.log(
        "[DASH] Agendamentos contados:",
        totalAgendamentosVoluntarios,
        "para estatísticas."
      );
    }
  );
}

// Função para configurar todos os event listeners do dashboard
function configurarEventListeners() {
  // Event listener para mudança no filtro por tipo
  const seletorDeTipo = document.getElementById("tipo-filtro");
  if (seletorDeTipo != null) {
    seletorDeTipo.addEventListener("change", aplicarFiltrosEExibirReunioes);
  }

  // Event listener para mudança no filtro por status
  const seletorDeStatus = document.getElementById("status-filtro");
  if (seletorDeStatus != null) {
    seletorDeStatus.addEventListener("change", aplicarFiltrosEExibirReunioes);
  }

  // Event listener para busca por título (com debounce para evitar muitas execuções)
  const campoDeBusca = document.getElementById("busca-titulo");
  if (campoDeBusca != null) {
    campoDeBusca.addEventListener("input", function () {
      // Cancela o timeout anterior se existir
      if (timeoutBusca != null) {
        clearTimeout(timeoutBusca);
      }
      // Define um novo timeout de 300 milissegundos
      timeoutBusca = setTimeout(aplicarFiltrosEExibirReunioes, 300);
    });
  }

  // Event listener para o botão limpar filtros
  const botaoLimparFiltros = document.getElementById("limpar-filtros");
  if (botaoLimparFiltros != null) {
    botaoLimparFiltros.addEventListener("click", function () {
      // Reset do filtro de tipo
      if (seletorDeTipo != null) {
        seletorDeTipo.value = "Todos";
      }
      // Reset do filtro de status
      if (seletorDeStatus != null) {
        seletorDeStatus.value = "Todos";
      }
      // Limpa o campo de busca
      if (campoDeBusca != null) {
        campoDeBusca.value = "";
      }
      // Aplica os filtros novamente
      aplicarFiltrosEExibirReunioes();
    });
  }

  // Event listener para ações clicáveis dentro do container das atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener("click", function (eventoDeClique) {
      // Verifica se o clique foi em um botão PDF
      if (eventoDeClique.target.matches(".btn-pdf")) {
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        gerarPDF(idDaAta);
      }
      // Verifica se o clique foi em um botão de feedback
      else if (eventoDeClique.target.matches(".btn-feedback")) {
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        abrirFormularioDeFeedback(idDaAta);
      }
      // Verifica se o clique foi em um botão de editar
      else if (eventoDeClique.target.matches(".btn-editar")) {
        const idDaAta =
          eventoDeClique.target.closest(".ata-item").dataset.ataId;
        editarAta(idDaAta);
      }
    });
  }

  // Event listener para suporte a touch em dispositivos móveis
  if (containerDasAtas != null) {
    containerDasAtas.addEventListener(
      "touchstart",
      function (eventoDeTouch) {
        // Previne comportamentos padrão em botões e headers para evitar zoom
        if (eventoDeTouch.target.matches(".ata-header, .btn")) {
          eventoDeTouch.preventDefault();
        }
      },
      { passive: false }
    );
  }
}

// Função para atualizar estatísticas do dashboard (inclui contagem de agendamentos)
function atualizarEstatisticas() {
  const dataAtualAgora = new Date();

  // Calcula estatísticas das atas registradas
  const totalDeAtas = todasAsAtas.length;

  // Conta atas futuras (agendadas)
  const atasFuturas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtualAgora;
  }).length;

  // Conta atas concluídas (passadas)
  const atasConcluidas = todasAsAtas.filter(function (ata) {
    const dataDaAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataDaAta.getTime()) &&
      dataDaAta < dataAtualAgora &&
      ata.status === "Concluída"
    );
  }).length;

  // Total geral inclui agendamentos voluntários
  const totalDeReunioes = totalDeAtas + totalAgendamentosVoluntarios;
  const proximasReunioes = atasFuturas + totalAgendamentosVoluntarios; // Assume todos agendamentos como futuras
  const reunioesConcluidas = atasConcluidas;

  // Atualiza elementos HTML dos contadores
  const elementoTotal = document.getElementById("total-reunioes");
  if (elementoTotal != null) {
    elementoTotal.textContent = totalDeReunioes;
  }

  const elementoProximas = document.getElementById("proximas-reunioes");
  if (elementoProximas != null) {
    elementoProximas.textContent = proximasReunioes;
  }

  const elementoConcluidas = document.getElementById("reunioes-concluidas");
  if (elementoConcluidas != null) {
    elementoConcluidas.textContent = reunioesConcluidas;
  }

  // Renderiza informações da próxima reunião
  renderizarProximaReuniao();

  // Atualiza o contador visual de atas na lista
  atualizarContadorDeAtas(totalDeAtas);
}

// Função para renderizar o card da próxima reunião
function renderizarProximaReuniao() {
  const dataAtualAgora = new Date();

  // Filtra atas futuras
  const atasFuturas = todasAsAtas
    .filter(function (ata) {
      const dataDaAta = new Date(ata.dataReuniao || 0);
      return !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtualAgora;
    })
    .sort(function (ataA, ataB) {
      return new Date(ataA.dataReuniao) - new Date(ataB.dataReuniao);
    });

  // Elemento onde será inserido o conteúdo da próxima reunião
  const elementoDeInformacao = document.getElementById("proxima-reuniao-info");
  if (elementoDeInformacao == null || atasFuturas.length === 0) {
    return;
  }

  // Pega a ata mais próxima (primeira da lista ordenada)
  const ataProxima = atasFuturas[0];
  const dataProximaAta = new Date(ataProxima.dataReuniao || 0);

  // Se a data não é válida, para a execução
  if (isNaN(dataProximaAta.getTime())) {
    return;
  }

  // Calcula diferença em milissegundos entre agora e a ata
  const diferencaEmMilissegundos = dataProximaAta - dataAtualAgora;

  // Converte para dias, horas e minutos restantes
  const diasRestantes = Math.floor(
    diferencaEmMilissegundos / (1000 * 60 * 60 * 24)
  );
  const horasRestantes = Math.floor(
    (diferencaEmMilissegundos % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutosRestantes = Math.floor(
    (diferencaEmMilissegundos % (1000 * 60 * 60)) / (1000 * 60)
  );

  // Determina texto do countdown baseado no tempo restante
  let textoDoCountdown = "";
  if (diasRestantes > 0) {
    textoDoCountdown = `Em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`;
  } else if (horasRestantes > 0) {
    textoDoCountdown = `Em ${horasRestantes} hora${
      horasRestantes > 1 ? "s" : ""
    }`;
  } else if (minutosRestantes > 0) {
    textoDoCountdown = `Em ${minutosRestantes} minuto${
      minutosRestantes > 1 ? "s" : ""
    }`;
  } else {
    textoDoCountdown = "Em breve!";
  }

  // Insere conteúdo HTML no elemento
  elementoDeInformacao.innerHTML = `
        <h5>${ataProxima.titulo || ataProxima.tipo || "Ata Agendada"}</h5>
        <p><strong>Tipo:</strong> ${ataProxima.tipo || "Não especificado"}</p>
        <p><strong>Data:</strong> ${dataProximaAta.toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        })}</p>
        <p><strong>Local:</strong> ${ataProxima.local || "Online"}</p>
        <p class="fw-bold">${textoDoCountdown}</p>
    `;

  // Configura botão "Ver Detalhes" da próxima ata
  const botaoVerDetalhes = document.getElementById("ver-detalhes-proxima");
  if (botaoVerDetalhes != null) {
    botaoVerDetalhes.onclick = function () {
      console.log("[DASH] Abrindo detalhes da próxima ata:", ataProxima.id);
      alert(
        `Navegando para detalhes da ata: ${
          ataProxima.titulo || "ID: " + ataProxima.id
        }`
      );
    };
  }

  // Configura botão "Adicionar ao Calendário"
  const botaoAdicionarCalendario =
    document.getElementById("calendario-proxima");
  if (botaoAdicionarCalendario != null) {
    botaoAdicionarCalendario.onclick = function () {
      // Cria URL para Google Calendar com os detalhes da ata
      const urlDoCalendario = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        ataProxima.titulo || "Ata de Reunião"
      )}&dates=${dataProximaAta
        .toISOString()
        .slice(
          0,
          -1
        )}Z/${dataProximaAta.toISOString()}&details=Ata agendada no sistema EuPsico&location=${encodeURIComponent(
        ataProxima.local || "Online"
      )}`;
      // Abre em nova aba
      window.open(urlDoCalendario, "_blank");
    };
  }
}

// Função para aplicar filtros e exibir as atas
function aplicarFiltrosEExibirReunioes() {
  // Obtém valores dos filtros
  const valorDoFiltroDeTipo =
    document.getElementById("tipo-filtro")?.value || "Todos";
  const valorDoFiltroDeStatus =
    document.getElementById("status-filtro")?.value || "Todos";
  const termoDeBusca =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  // Cria uma cópia do array de todas as atas
  let atasFiltradas = [...todasAsAtas];

  // Aplica filtro por tipo se não for "Todos"
  if (valorDoFiltroDeTipo !== "Todos") {
    atasFiltradas = atasFiltradas.filter(function (ata) {
      return ata.tipo
        ?.toLowerCase()
        .includes(valorDoFiltroDeTipo.toLowerCase());
    });
  }

  // Aplica filtro por status se não for "Todos"
  if (valorDoFiltroDeStatus !== "Todos") {
    const dataAtualAgora = new Date();
    atasFiltradas = atasFiltradas.filter(function (ata) {
      const dataDaAta = new Date(ata.dataReuniao || 0);
      if (valorDoFiltroDeStatus === "Agendada") {
        return dataDaAta > dataAtualAgora;
      } else if (valorDoFiltroDeStatus === "Concluída") {
        return dataDaAta < dataAtualAgora && ata.status === "Concluída";
      } else if (valorDoFiltroDeStatus === "Cancelada") {
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
    const dataReuniaoAtaA = new Date(ataA.dataReuniao || 0);
    const dataReuniaoAtaB = new Date(ataB.dataReuniao || 0);
    return dataReuniaoAtaB - dataReuniaoAtaA;
  });

  // Elemento onde serão inseridas as atas
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas != null) {
    // Se não há atas que atendam os filtros
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
        containerDasAtas.innerHTML = atasFiltradas
          .map(function (ata) {
            return gerarAccordionDaAta(ata);
          })
          .join("");
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

// Função para gerar o HTML de um accordion individual de ata
function gerarAccordionDaAta(ata) {
  try {
    // Converte dataReuniao para objeto Date
    const dataDaAta = new Date(ata.dataReuniao || 0);
    const dataAtualAgora = new Date();

    // Determina se a ata é futura
    const ataEhFutura =
      !isNaN(dataDaAta.getTime()) && dataDaAta > dataAtualAgora;

    // Determina status visual da ata
    let classeCorDoStatus = "text-muted";
    let iconeDoStatus = "help_outline";
    let textoDoStatus = ataEhFutura ? "Agendada" : "Registrada";

    if (ataEhFutura) {
      classeCorDoStatus = "text-info";
      iconeDoStatus = "schedule";
    } else if (ata.status === "Concluída") {
      classeCorDoStatus = "text-success";
      iconeDoStatus = "check_circle";
    } else if (ata.status === "Cancelada") {
      classeCorDoStatus = "text-danger";
      iconeDoStatus = "cancel";
    }

    // Formata data para exibição
    const dataFormatada = !isNaN(dataDaAta.getTime())
      ? dataDaAta.toLocaleDateString("pt-BR")
      : "Data inválida";

    // Normaliza participantes
    const participantes = normalizarParticipantes(ata.participantes);
    const previewDosParticipantes = participantes.slice(0, 3);
    const maisParticipantesRestantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    // Constrói conteúdo dos detalhes básicos
    const conteudoDosDetalhesBasicos = `
            <div class="row g-3">
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

    // Constrói conteúdo dos participantes (se existirem)
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
                <small class="text-muted">Total de participantes: ${
                  participantes.length
                }</small>
            </div>
        `
        : "";

    // Constrói conteúdo do resumo (se existir)
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

    // Monta HTML completo do accordion da ata
    return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${classeCorDoStatus};">${iconeDoStatus}</span>
                            <h5 class="mb-0">${
                              ata.titulo || ata.tipo || "Ata de Reunião"
                            }</h5>
                            <span class="badge ms-2 bg-info text-info">Ata Registrada</span>
                        </div>
                        <small class="text-muted">${dataFormatada}</small>
                    </div>
                    <div class="ata-acoes">
                        <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="Gerar PDF">
                            <span class="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                        <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Feedback">
                            <span class="material-symbols-outlined">feedback</span>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar">
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
    console.error("[DASH] Erro ao gerar accordion da ata:", erro);
    return `
            <div class="ata-item card mb-4 border-danger">
                <div class="card-body">
                    <p class="text-danger">Erro ao carregar detalhes da ata ${ata.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para atualizar o contador visual de atas
function atualizarContadorDeAtas(quantidadeDeAtas) {
  const elementoContador = document.getElementById("contador-atas");
  if (elementoContador != null) {
    elementoContador.textContent = quantidadeDeAtas;
    elementoContador.className =
      quantidadeDeAtas > 0
        ? "badge bg-primary ms-2"
        : "badge bg-secondary ms-2";
  }
}

// Função para gerar PDF de uma ata
function gerarPDF(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  if (ata == null) {
    console.error("[DASH] Ata não encontrada para gerar PDF:", idDaAta);
    return;
  }
  console.log("[DASH] Gerando PDF da ata:", ata.titulo);
  alert(
    `Gerando PDF da ata "${ata.titulo}" (implementar com jsPDF ou print). ID: ${idDaAta}`
  );
}

// Função para abrir formulário de feedback de uma ata
function abrirFormularioDeFeedback(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  console.log("[DASH] Abrindo feedback da ata:", ata ? ata.titulo : idDaAta);
  alert(
    `Abrindo formulário de feedback da ata "${ata ? ata.titulo : idDaAta}"`
  );
}

// Função para editar uma ata
function editarAta(idDaAta) {
  const ata = todasAsAtas.find(function (ataEncontrada) {
    return ataEncontrada.id === idDaAta;
  });
  console.log("[DASH] Editando ata:", ata ? ata.titulo : idDaAta);
  alert(`Editando ata "${ata ? ata.titulo : idDaAta}"`);
}

// Função para limpar recursos (cancelar listeners) quando sair da view
export function cleanup() {
  if (unsubscribeAtas != null) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener das atas cancelado.");
  }

  if (unsubscribeVoluntarios != null) {
    unsubscribeVoluntarios();
    unsubscribeVoluntarios = null;
    console.log("[DASH] Listener dos agendamentos cancelado.");
  }

  if (timeoutBusca != null) {
    clearTimeout(timeoutBusca);
    timeoutBusca = null;
  }

  console.log("[DASH] Todos os recursos limpos.");
}
