// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.4 (Completo: Atas Registradas + Agendamentos Voluntários, sem abreviações)

// Importações do Firebase
import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

// Variáveis globais
let todasAsReunioes = []; // Array unificado: atas + agendamentos
let unsubscribeAtas = null; // Função para cancelar listener das atas
let unsubscribeAgendamentos = null; // Função para cancelar listener dos agendamentos
let timeoutBusca = null; // Timeout para debounce na busca

// Função para normalizar o campo participantes (string para array)
function normalizarParticipantes(participantes) {
  if (!participantes) {
    return []; // Retorna array vazio se não existir
  }

  if (Array.isArray(participantes)) {
    return participantes; // Já é um array, usa diretamente
  } else if (typeof participantes === "string") {
    // Se for string, divide por vírgulas ou quebras de linha
    return participantes
      .split(/[\n,]+/) // Divide por vírgula ou nova linha
      .map((nome) => nome.trim()) // Remove espaços em branco
      .filter((nome) => nome.length > 0); // Remove nomes vazios
  } else {
    // Log de aviso para formatos inesperados
    console.warn(
      "[DASH] Formato de participantes não reconhecido:",
      typeof participantes,
      participantes
    );
    return [];
  }
}

// Função principal de inicialização
export function init() {
  console.log(
    "[DASH] Módulo Dashboard de Reuniões iniciado (v3.4 - Completo)."
  );
  configurarEventListeners();
  carregarReunioesDoFirestore();
}

// Função para carregar todas as reuniões do Firestore (atas + agendamentos)
function carregarReunioesDoFirestore() {
  const containerDasAtas = document.getElementById("atas-container");

  // Se o container não existir no DOM, para a execução
  if (!containerDasAtas) {
    console.error("[DASH] Elemento #atas-container não encontrado no HTML.");
    return;
  }

  // Cancela listeners anteriores se existirem
  if (unsubscribeAtas) {
    unsubscribeAtas(); // Cancela listener das atas
  }
  if (unsubscribeAgendamentos) {
    unsubscribeAgendamentos(); // Cancela listener dos agendamentos
  }

  // Primeira query: carrega as atas registradas da coleção "gestao_atas"
  const queryParaAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc") // Ordena por dataReuniao em ordem descendente (mais recente primeiro)
  );

  // Configura listener em tempo real para atas
  unsubscribeAtas = onSnapshot(queryParaAtas, (snapshotDasAtas) => {
    const atasRegistradas = snapshotDasAtas.docs.map((documento) => ({
      id: documento.id, // ID do documento Firestore
      tipoEvento: "ata_registrada", // Marca como ata registrada para identificação
      origem: "Ata Registrada", // Origem para exibição
      ...documento.data(), // Espalha todos os dados do documento
      participantes: normalizarParticipantes(documento.data().participantes), // Normaliza campo participantes
    }));

    // Atualiza dados das reuniões chamando função específica
    atualizarDadosDasReunioes(atasRegistradas, "atas");
  });

  // Segunda query: carrega os agendamentos da coleção "agendamentos_voluntarios"
  const queryParaAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc") // Ordena por data de criação em ordem descendente
  );

  // Configura listener em tempo real para agendamentos
  unsubscribeAgendamentos = onSnapshot(
    queryParaAgendamentos,
    (snapshotDosAgendamentos) => {
      const agendamentosDosVoluntarios = snapshotDosAgendamentos.docs.map(
        (documento) => {
          // Cria objeto unificado para agendamento
          return {
            id: documento.id, // ID do documento Firestore
            tipoEvento: "agendamento_pendente", // Marca como agendamento pendente
            origem: "Agendamento Voluntários", // Origem para exibição
            titulo: documento.data().descricao || "Reunião com Voluntário", // Título baseado no campo descrição
            tipo: "Reunião com Voluntário", // Tipo unificado para filtro
            dataReuniao:
              documento.data().slots && documento.data().slots.length > 0
                ? documento.data().slots[0].data // Usa data do primeiro slot
                : documento.data().criadoEm, // Fallback para data de criação
            status: "Aguardando Ata", // Status padrão para agendamentos
            participantes: [], // Agendamentos não têm participantes ainda
            slots: documento.data().slots || [], // Mantém estrutura de slots
            gestor:
              documento.data().slots && documento.data().slots.length > 0
                ? documento.data().slots[0].gestorNome
                : "Gestor não especificado", // Gestor do primeiro slot
            resumo:
              documento.data().descricao ||
              "Agendamento criado via módulo de voluntários",
            local: documento.data().local || "Online", // Local se existir
          };
        }
      );

      // Atualiza dados das reuniões chamando função específica
      atualizarDadosDasReunioes(agendamentosDosVoluntarios, "agendamentos");
    }
  );

  // Função interna para processar e unificar dados quando uma das fontes é atualizada
  function atualizarDadosDasReunioes(dadosNovos, origemDosDados) {
    // Remove da lista global os itens antigos da mesma origem para evitar duplicatas
    todasAsReunioes = todasAsReunioes.filter(
      (reuniao) => reuniao.origem !== origemDosDados
    );

    // Adiciona os novos dados da origem atualizada
    todasAsReunioes = todasAsReunioes.concat(dadosNovos);

    // Ordena todas as reuniões por dataReuniao (de mais recente para mais antigo)
    todasAsReunioes.sort((reuniaoA, reuniaoB) => {
      const dataDaReuniaoA = new Date(reuniaoA.dataReuniao || 0);
      const dataDaReuniaoB = new Date(reuniaoB.dataReuniao || 0);
      return dataDaReuniaoB - dataDaReuniaoA;
    });

    // Atualiza estatísticas do dashboard
    atualizarEstatisticas();

    // Aplica filtros atuais e exibe as reuniões
    aplicarFiltrosEExibirReunioes();

    // Log para debugging
    console.log(
      `[DASH] Dados unificados atualizados: ${todasAsReunioes.length} eventos totais (atas + agendamentos).`
    );
  }
}

// Função para atualizar estatísticas visuais do dashboard
function atualizarEstatisticas() {
  const dataAtual = new Date();

  // Calcula estatísticas baseadas em todas as reuniões carregadas
  const totalDeReunioes = todasAsReunioes.length;

  // Conta reuniões futuras (agendadas)
  const reunioesProximas = todasAsReunioes.filter((reuniao) => {
    const dataDaReuniao = new Date(reuniao.dataReuniao || 0);
    // Considera reunião como futura se a dataReuniao for posterior à data atual
    return !isNaN(dataDaReuniao.getTime()) && dataDaReuniao > dataAtual;
  }).length;

  // Conta reuniões concluídas (atas registradas passadas)
  const reunioesConcluidas = todasAsReunioes.filter((reuniao) => {
    const dataDaReuniao = new Date(reuniao.dataReuniao || 0);
    // Considera reunião como concluída se for uma ata registrada e data passada
    return (
      !isNaN(dataDaReuniao.getTime()) &&
      dataDaReuniao < dataAtual &&
      reuniao.status === "Concluída"
    );
  }).length;

  // Atualiza elementos HTML dos contadores
  const elementoTotal = document.getElementById("total-reunioes");
  const elementoProximas = document.getElementById("proximas-reunioes");
  const elementoConcluidas = document.getElementById("reunioes-concluidas");

  // Verifica se os elementos existem antes de atualizar
  if (elementoTotal) elementoTotal.textContent = totalDeReunioes;
  if (elementoProximas) elementoProximas.textContent = reunioesProximas;
  if (elementoConcluidas) elementoConcluidas.textContent = reunioesConcluidas;

  // Renderiza informações da próxima reunião
  renderizarProximaReuniao();

  // Controla visibilidade do container da próxima reunião
  const containerProximaReuniao = document.getElementById(
    "proxima-reuniao-container"
  );
  if (containerProximaReuniao) {
    // Mostra se há reuniões futuras ou agendamentos pendentes
    const temReuniaoProxima = todasAsReunioes.some((reuniao) => {
      const dataDaReuniao = new Date(reuniao.dataReuniao || 0);
      return (
        reuniao.status === "Aguardando Ata" ||
        (!isNaN(dataDaReuniao.getTime()) && dataDaReuniao > dataAtual)
      );
    });
    containerProximaReuniao.style.display = temReuniaoProxima
      ? "block"
      : "none";
  }

  // Atualiza contador geral de reuniões
  atualizarContadorDeReunioes(totalDeReunioes);
}

// Função para renderizar o card da próxima reunião
function renderizarProximaReuniao() {
  const dataAtual = new Date();

  // Filtra e ordena reuniões futuras
  const reunioesFuturas = todasAsReunioes
    .filter((reuniao) => {
      const dataDaReuniao = new Date(reuniao.dataReuniao || 0);
      return !isNaN(dataDaReuniao.getTime()) && dataDaReuniao > dataAtual;
    })
    .sort((reuniaoA, reuniaoB) => {
      // Ordena por dataReuniao, da mais próxima para mais distante
      return new Date(reuniaoA.dataReuniao) - new Date(reuniaoB.dataReuniao);
    });

  // Elemento onde será inserido o conteúdo da próxima reunião
  const elementoInformacao = document.getElementById("proxima-reuniao-info");

  // Se não há elemento ou não há reuniões futuras, para a execução
  if (!elementoInformacao || reunioesFuturas.length === 0) {
    return;
  }

  // Pega a reunião mais próxima (primeira da lista ordenada)
  const reuniaoProxima = reunioesFuturas[0];
  const dataProximaReuniao = new Date(reuniaoProxima.dataReuniao || 0);

  // Se a data não é válida, para a execução
  if (isNaN(dataProximaReuniao.getTime())) {
    return;
  }

  // Calcula diferença em milissegundos entre agora e a reunião
  const diferencaEmMilissegundos = dataProximaReuniao - dataAtual;

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
  let textoTempoRestante = "";
  if (diasRestantes > 0) {
    textoTempoRestante = `Em ${diasRestantes} dia${
      diasRestantes > 1 ? "s" : ""
    }`;
  } else if (horasRestantes > 0) {
    textoTempoRestante = `Em ${horasRestantes} hora${
      horasRestantes > 1 ? "s" : ""
    }`;
  } else if (minutosRestantes > 0) {
    textoTempoRestante = `Em ${minutosRestantes} minuto${
      minutosRestantes > 1 ? "s" : ""
    }`;
  } else {
    textoTempoRestante = "Em breve!";
  }

  // Tipo de evento para exibição
  let tipoDeEvento =
    reuniaoProxima.tipoEvento === "ata_registrada"
      ? "Ata Registrada"
      : "Agendamento de Voluntários";

  // Insere conteúdo HTML no elemento
  elementoInformacao.innerHTML = `
        <h5>${reuniaoProxima.titulo || reuniaoProxima.tipo || "Reunião"}</h5>
        <p><strong>Tipo:</strong> ${tipoDeEvento} - ${
    reuniaoProxima.tipo || "Não especificado"
  }</p>
        <p><strong>Data:</strong> ${dataProximaReuniao.toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        })}</p>
        <p><strong>Local:</strong> ${reuniaoProxima.local || "Online"}</p>
        <p class="fw-bold">${textoTempoRestante}</p>
    `;

  // Configura botão "Ver Detalhes"
  const botaoVerDetalhes = document.getElementById("ver-detalhes-proxima");
  if (botaoVerDetalhes) {
    botaoVerDetalhes.onclick = function () {
      if (reuniaoProxima.tipoEvento === "agendamento_pendente") {
        // Para agendamentos, abre página específica
        window.open(
          `/agendamento-voluntario.html?agendamentoId=${reuniaoProxima.id}`,
          "_blank"
        );
      } else {
        // Para atas registradas, mostra alerta (pode ser expandido)
        alert(`Navegando para detalhes da ata: ${reuniaoProxima.id}`);
      }
    };
  }

  // Configura botão "Adicionar ao Calendário"
  const botaoCalendario = document.getElementById("calendario-proxima");
  if (botaoCalendario) {
    botaoCalendario.onclick = function () {
      // Cria URL do Google Calendar com detalhes da reunião
      const urlDoCalendario = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        reuniaoProxima.titulo || "Reunião"
      )}&dates=${dataProximaReuniao
        .toISOString()
        .slice(
          0,
          -1
        )}Z/${dataProximaReuniao.toISOString()}&details=Evento do sistema EuPsico&location=${encodeURIComponent(
        reuniaoProxima.local || "Online"
      )}`;
      // Abre nova aba com Google Calendar
      window.open(urlDoCalendario, "_blank");
    };
  }
}

// Função para configurar todos os event listeners do dashboard
function configurarEventListeners() {
  // Event listener para mudança no filtro de tipo
  const seletorTipo = document.getElementById("tipo-filtro");
  if (seletorTipo) {
    seletorTipo.addEventListener("change", aplicarFiltrosEExibirReunioes);
  }

  // Event listener para mudança no filtro de status
  const seletorStatus = document.getElementById("status-filtro");
  if (seletorStatus) {
    seletorStatus.addEventListener("change", aplicarFiltrosEExibirReunioes);
  }

  // Event listener para busca (com debounce para evitar muitas execuções)
  const entradaBusca = document.getElementById("busca-titulo");
  if (entradaBusca) {
    entradaBusca.addEventListener("input", function () {
      // Cancela timeout anterior
      if (timeoutBusca) {
        clearTimeout(timeoutBusca);
      }
      // Define novo timeout de 300ms
      timeoutBusca = setTimeout(aplicarFiltrosEExibirReunioes, 300);
    });
  }

  // Event listener para botão limpar filtros
  const botaoLimpar = document.getElementById("limpar-filtros");
  if (botaoLimpar) {
    botaoLimpar.addEventListener("click", function () {
      // Reset filtro de tipo para "Todos"
      if (seletorTipo) seletorTipo.value = "Todos";

      // Reset filtro de status para "Todos"
      if (seletorStatus) seletorStatus.value = "Todos";

      // Limpa campo de busca
      if (entradaBusca) entradaBusca.value = "";

      // Aplica filtros novamente
      aplicarFiltrosEExibirReunioes();
    });
  }

  // Event listener para ações clicáveis no container das reuniões
  const containerReunioes = document.getElementById("atas-container");
  if (containerReunioes) {
    containerReunioes.addEventListener("click", function (eventoClicado) {
      // Procura elemento mais próximo que seja um item de reunião
      const itemDeReuniao = eventoClicado.target.closest(".reuniao-item");
      if (!itemDeReuniao) {
        return; // Sai se não encontrou
      }

      // Pega ID da reunião do elemento mais próximo
      const idDaReuniao = itemDeReuniao.dataset.eventoId;
      if (!idDaReuniao) {
        return; // Sai se não tem ID
      }

      // Verifica se clicou em botão PDF
      if (eventoClicado.target.matches(".btn-pdf")) {
        gerarPDFDaReuniao(idDaReuniao);
      }

      // Verifica se clicou em botão Feedback
      else if (eventoClicado.target.matches(".btn-feedback")) {
        abrirFormularioDeFeedback(idDaReuniao);
      }

      // Verifica se clicou em botão Editar
      else if (eventoClicado.target.matches(".btn-editar")) {
        editarReuniao(idDaReuniao);
      }
    });
  }

  // Event listener para suporte touch em dispositivos móveis
  const containerReunioesTouch = document.getElementById("atas-container");
  if (containerReunioesTouch) {
    containerReunioesTouch.addEventListener(
      "touchstart",
      function (eventoTouch) {
        // Impede zoom indesejado em mobile para botões e headers
        if (eventoTouch.target.matches(".reuniao-header, .btn")) {
          eventoTouch.preventDefault();
        }
      },
      { passive: false }
    );
  }

  // Intervalo para atualizar countdown da próxima reunião (a cada minuto)
  setInterval(function () {
    // Verifica se o container da próxima reunião está visível
    const containerProxima = document.getElementById(
      "proxima-reuniao-container"
    );
    if (containerProxima && containerProxima.style.display !== "none") {
      // Atualiza informações da próxima reunião
      renderizarProximaReuniao();
    }
  }, 60000); // Executa a cada 60.000 milissegundos (1 minuto)
}

// Função para aplicar filtros e exibir reuniões
function aplicarFiltrosEExibirReunioes() {
  // Pega valores atuais dos filtros
  const valorFiltroTipo =
    document.getElementById("tipo-filtro")?.value || "Todos";
  const valorFiltroStatus =
    document.getElementById("status-filtro")?.value || "Todos";
  const termoDeBusca =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  // Começa com cópia de todas as reuniões
  let reunioesFiltradas = [...todasAsReunioes];

  // Aplica filtro por tipo se não for "Todos"
  if (valorFiltroTipo !== "Todos") {
    reunioesFiltradas = reunioesFiltradas.filter((reuniao) => {
      return (
        reuniao.tipo?.toLowerCase().includes(valorFiltroTipo.toLowerCase()) ||
        reuniao.origem?.toLowerCase().includes(valorFiltroTipo.toLowerCase())
      );
    });
  }

  // Aplica filtro por status se não for "Todos"
  if (valorFiltroStatus !== "Todos") {
    const dataAtualAgora = new Date();
    reunioesFiltradas = reunioesFiltradas.filter((reuniao) => {
      // Para filtro "Agendada" ou "Aguardando Ata"
      if (
        valorFiltroStatus === "Agendada" ||
        valorFiltroStatus === "Aguardando Ata"
      ) {
        return (
          reuniao.status === valorFiltroStatus ||
          (reuniao.origem === "Agendamento Voluntários" &&
            !isNaN(new Date(reuniao.dataReuniao || 0).getTime()) &&
            new Date(reuniao.dataReuniao || 0) > dataAtualAgora)
        );
      }
      // Para filtro "Concluída"
      else if (valorFiltroStatus === "Concluída") {
        return reuniao.status === "Concluída";
      }
      return true; // Mantém se não matches nenhum caso específico
    });
  }

  // Aplica filtro de busca se houver termo
  if (termoDeBusca) {
    reunioesFiltradas = reunioesFiltradas.filter((reuniao) => {
      return (
        reuniao.titulo?.toLowerCase().includes(termoDeBusca) ||
        reuniao.tipo?.toLowerCase().includes(termoDeBusca) ||
        reuniao.origem?.toLowerCase().includes(termoDeBusca)
      );
    });
  }

  // Ordena as reuniões filtradas por dataReuniao (mais recente primeiro)
  reunioesFiltradas.sort(function (reuniaoA, reuniaoB) {
    const dataReuniaoA = new Date(reuniaoA.dataReuniao || 0);
    const dataReuniaoB = new Date(reuniaoB.dataReuniao || 0);
    return dataReuniaoB - dataReuniaoA;
  });

  // Elemento onde serão inseridas as reuniões
  const containerDasAtas = document.getElementById("atas-container");
  if (containerDasAtas) {
    // Se não há reuniões que atendam os filtros
    if (reunioesFiltradas.length === 0) {
      containerDasAtas.innerHTML = `
                <div class="alert alert-info text-center">
                    <span class="material-symbols-outlined">search_off</span>
                    Nenhuma reunião encontrada para este filtro.
                </div>
            `;
    } else {
      try {
        // Gera HTML para cada reunião filtrada
        containerDasAtas.innerHTML = reunioesFiltradas
          .map((reuniao) => {
            return gerarAccordionDeReuniao(reuniao);
          })
          .join("");

        // Atualiza contador de reuniões
        atualizarContadorDeReunioes(reunioesFiltradas.length);
      } catch (erro) {
        console.error("[DASH] Erro ao gerar HTML das reuniões:", erro);
        containerDasAtas.innerHTML = `
                    <div class="alert alert-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro ao exibir reuniões: ${erro.message}
                    </div>
                `;
      }
    }
  }

  // Atualiza estatísticas (mesmo com filtro, stats mostram totais gerais)
  atualizarEstatisticas();
}

// Função para gerar o HTML de um accordion individual de reunião
function gerarAccordionDeReuniao(reuniao) {
  try {
    // Converte dataReuniao para objeto Date
    const dataDaReuniao = new Date(reuniao.dataReuniao || 0);
    const dataAtualAgora = new Date();

    // Determina se a reunião é futura
    const reuniaoEhFutura =
      !isNaN(dataDaReuniao.getTime()) && dataDaReuniao > dataAtualAgora;

    // Determina se é uma ata registrada
    const ehAtaRegistrada = reuniao.origem === "Ata Registrada";

    // Determina se é um agendamento pendente
    const ehAgendamentoPendente = reuniao.origem === "Agendamento Voluntários";

    // Define tipo de evento para exibição
    let tipoDeEventoParaExibicao = reuniao.tipo || reuniao.origem || "Evento";

    // Define classe de cor e ícone do status
    let classeCorDoStatus = "text-muted";
    let iconeDoStatus = "help_outline";
    let textoDoStatus = reuniaoEhFutura
      ? "Próxima"
      : ehAtaRegistrada
      ? "Registrada"
      : "Pendente";

    if (reuniaoEhFutura) {
      classeCorDoStatus = "text-info";
      iconeDoStatus = "schedule";
    } else if (ehAtaRegistrada) {
      classeCorDoStatus = "text-success";
      iconeDoStatus = "check_circle";
    } else if (ehAgendamentoPendente) {
      classeCorDoStatus = "text-warning";
      iconeDoStatus = "hourglass_empty";
    }

    // Formata data para exibição
    const dataFormatada = !isNaN(dataDaReuniao.getTime())
      ? dataDaReuniao.toLocaleDateString("pt-BR")
      : "Data inválida";

    // Normaliza participantes
    const participantes = normalizarParticipantes(reuniao.participantes);
    const previewDosParticipantes = participantes.slice(0, 3);
    const maisParticipantesRestantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    // Constrói conteúdo dos detalhes básicos
    const conteudoDosDetalhesBasicos = `
            <div class="row g-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      reuniao.tipo || "Não especificado"
                    }</p>
                    <p><strong>Origem:</strong> <span class="${
                      ehAtaRegistrada ? "text-success" : "text-warning"
                    }">${reuniao.origem}</span></p>
                    <p><strong>Data:</strong> ${dataFormatada}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Local:</strong> ${reuniao.local || "Online"}</p>
                    <p><strong>Responsável:</strong> ${
                      reuniao.gestor ||
                      reuniao.responsavel ||
                      "Não especificado"
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
                      .map((nome) => {
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
    const conteudoDoResumo =
      reuniao.resumo || reuniao.notas
        ? `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-primary me-1">description</span> Resumo</h6>
                <p class="mb-0">${
                  reuniao.resumo || reuniao.notas || "Sem resumo disponível."
                }</p>
            </div>
        `
        : "";

    // Determina quais botões de ação mostrar
    let botoesDeAcao = "";
    if (ehAtaRegistrada) {
      botoesDeAcao = `
                <div class="acoesDaAta">
                    <button class="btn btn-sm btn-outline-primary btn-pdf me-1">PDF</button>
                    <button class="btn btn-sm btn-outline-success btn-feedback me-1">Feedback</button>
                    <button class="btn btn-sm btn-outline-secondary btn-editar">Editar</button>
                </div>
            `;
    } else if (ehAgendamentoPendente) {
      botoesDeAcao = `
                <div class="acoesDoAgendamento">
                    <button class="btn btn-sm btn-outline-primary">Ver Agendamento</button>
                </div>
            `;
    }

    // Monta HTML completo do accordion da reunião
    return `
            <div class="reuniao-item card mb-4" data-evento-id="${
              reuniao.id
            }" data-tipo-evento="${reuniao.tipoEvento}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.reuniao-conteudo').style.display = this.parentElement.querySelector('.reuniao-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${classeCorDoStatus};">${iconeDoStatus}</span>
                            <h5 class="mb-0">${
                              reuniao.titulo || tipoDeEventoParaExibicao
                            }</h5>
                            <span class="badge ms-2 bg-info text-info">Voluntários</span>
                        </div>
                        <small class="text-muted">${dataFormatada}</small>
                    </div>
                    ${botoesDeAcao}
                </div>
                <div class="reuniao-conteudo card-body" style="display: none; border-top: 1px solid #e5e7eb;">
                    ${conteudoDosDetalhesBasicos}
                    ${conteudoDosParticipantes}
                    ${conteudoDoResumo}
                </div>
            </div>
        `;
  } catch (erro) {
    console.error("[DASH] Erro ao gerar accordion da reunião:", erro);
    return `
            <div class="reuniao-item card mb-4 border-danger">
                <div class="card-body">
                    <p class="text-danger">Erro ao carregar detalhes da reunião ${reuniao.id}</p>
                </div>
            </div>
        `;
  }
}

// Função para atualizar o contador visual de reuniões
function atualizarContadorDeReunioes(quantidade) {
  const elementoContador = document.getElementById("contador-atas");
  if (elementoContador) {
    elementoContador.textContent = quantidade;
    // Muda cor do badge baseado se tem reuniões ou não
    elementoContador.className =
      quantidade > 0 ? "badge bg-primary ms-2" : "badge bg-secondary ms-2";
  }
}

// Função para gerar PDF de uma reunião (placeholder para implementação)
function gerarPDFDaReuniao(idDaReuniao) {
  const reuniao = todasAsReunioes.find(
    (reuniaoEncontrada) => reuniaoEncontrada.id === idDaReuniao
  );
  if (!reuniao) {
    console.error("[DASH] Reunião não encontrada para gerar PDF:", idDaReuniao);
    return;
  }

  console.log("[DASH] Gerando PDF da reunião:", reuniao.titulo);
  // Aqui você implementaria geração de PDF real com jsPDF ou outra biblioteca
  alert(
    `Gerando PDF da reunião "${reuniao.titulo}" (implementar função de PDF). ID: ${idDaReuniao}`
  );
}

// Função para abrir formulário de feedback de uma reunião
function abrirFormularioDeFeedback(idDaReuniao) {
  const reuniao = todasAsReunioes.find(
    (reuniaoEncontrada) => reuniaoEncontrada.id === idDaReuniao
  );
  console.log(
    "[DASH] Abrindo feedback da reunião:",
    reuniao ? reuniao.titulo : idDaReuniao
  );

  // Placeholder - implementaria navegação para página de feedback
  alert(
    `Abrindo formulário de feedback da reunião "${
      reuniao ? reuniao.titulo : idDaReuniao
    }"`
  );
}

// Função para editar uma reunião
function editarReuniao(idDaReuniao) {
  const reuniao = todasAsReunioes.find(
    (reuniaoEncontrada) => reuniaoEncontrada.id === idDaReuniao
  );
  console.log(
    "[DASH] Editando reunião:",
    reuniao ? reuniao.titulo : idDaReuniao
  );

  // Placeholder - implementaria navegação para editor
  alert(`Editando reunião "${reuniao ? reuniao.titulo : idDaReuniao}"`);
}

// Função para limpar recursos (cancelar listeners) quando sair da view
export function cleanup() {
  if (unsubscribeAtas) {
    unsubscribeAtas(); // Cancela listener das atas
    unsubscribeAtas = null;
  }

  if (unsubscribeAgendamentos) {
    unsubscribeAgendamentos(); // Cancela listener dos agendamentos
    unsubscribeAgendamentos = null;
  }

  if (timeoutBusca) {
    clearTimeout(timeoutBusca); // Limpa timeout da busca
    timeoutBusca = null;
  }

  console.log("[DASH] Todos os recursos limpos.");
}
