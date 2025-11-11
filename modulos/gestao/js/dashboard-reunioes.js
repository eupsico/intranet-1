// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.0 (Filtros avançados, stats realtime, próxima reunião com countdown, accordions com ações)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let unsubscribeAtas = null; // Para cleanup de listener
let timeoutBusca = null; // Para debounce na busca

export function init() {
  console.log("[DASH] Módulo Dashboard de Reuniões iniciado (v3.0).");
  setupEventListeners();
  loadAtasFromFirestore();
}

function loadAtasFromFirestore() {
  // Cleanup listener anterior se existir
  if (unsubscribeAtas) unsubscribeAtas();

  const atasContainer = document.getElementById("atas-container");
  if (!atasContainer) {
    console.error("[DASH] Container #atas-container não encontrado.");
    return;
  }

  // Query inicial por data descendente
  const q = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );

  unsubscribeAtas = onSnapshot(
    q,
    (snapshot) => {
      todasAsAtas = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Atualiza stats e filtra imediatamente
      atualizarStats();
      filtrarEExibirAtas();

      console.log(
        `[DASH] Dados atualizados: ${todasAsAtas.length} atas carregadas.`
      );

      // Remove loading inicial
      const loadingEl = atasContainer.querySelector(".loading-spinner");
      if (loadingEl) loadingEl.style.display = "none";
    },
    (error) => {
      console.error("[DASH] Erro ao carregar atas:", error);
      atasContainer.innerHTML = `
            <div class="alert alert-danger">
                <span class="material-symbols-outlined">error</span>
                Erro ao carregar atas do Firestore. ${error.message}
            </div>
        `;
    }
  );
}

// Atualiza stats cards em tempo real
function atualizarStats() {
  const agora = new Date();

  const totalReunioes = todasAsAtas.length;
  const proximasReunioes = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao);
    return dataAta > agora && (ata.status === "Agendada" || !ata.status);
  }).length;

  const reunioesConcluidas = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao);
    return dataAta < agora && ata.status === "Concluída";
  }).length;

  // Atualiza contadores
  document.getElementById("total-reunioes").textContent = totalReunioes;
  document.getElementById("proximas-reunioes").textContent = proximasReunioes;
  document.getElementById("reunioes-concluidas").textContent =
    reunioesConcluidas;

  // Mostra/oculta card da próxima reunião
  renderizarProximaReuniao();
  document.getElementById("proxima-reuniao-container").style.display =
    proximasReunioes > 0 ? "block" : "none";

  // Atualiza contador geral
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) contadorEl.textContent = todasAsAtas.length;
}

// Renderiza card da próxima reunião com countdown
function renderizarProximaReuniao() {
  const agora = new Date();
  const proximas = todasAsAtas
    .filter((ata) => {
      const dataAta = new Date(ata.dataReuniao);
      return dataAta > agora;
    })
    .sort((a, b) => new Date(a.dataReuniao) - new Date(b.dataReuniao));

  const infoEl = document.getElementById("proxima-reuniao-info");
  if (!infoEl || proximas.length === 0) return;

  const proxima = proximas[0];
  const dataProxima = new Date(proxima.dataReuniao);
  const diffEmMs = dataProxima - agora;

  // Calcula tempo restante
  const diasRestantes = Math.floor(diffEmMs / (1000 * 60 * 60 * 24));
  const horasRestantes = Math.floor(
    (diffEmMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutosRestantes = Math.floor(
    (diffEmMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  let tempoTexto = "";
  if (diasRestantes > 0) {
    tempoTexto = `Em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`;
  } else if (horasRestantes > 0) {
    tempoTexto = `Em ${horasRestantes} hora${horasRestantes > 1 ? "s" : ""}`;
  } else if (minutosRestantes > 0) {
    tempoTexto = `Em ${minutosRestantes} minuto${
      minutosRestantes > 1 ? "s" : ""
    }`;
  } else {
    tempoTexto = "Em breve!";
  }

  infoEl.innerHTML = `
        <div class="proxima-detalhes">
            <h5>${proxima.titulo || proxima.tipo || "Reunião Agendada"}</h5>
            <p><strong>Tipo:</strong> ${proxima.tipo || "Não especificado"}</p>
            <p><strong>Data:</strong> ${dataProxima.toLocaleString("pt-BR", {
              dateStyle: "full",
              timeStyle: "short",
            })}</p>
            <p><strong>Local:</strong> ${proxima.local || "Online"}</p>
            <p class="text-primary fw-bold">${tempoTexto}</p>
        </div>
    `;

  // Event listeners para botões
  document.getElementById("ver-detalhes-proxima").onclick = () => {
    // Navega para ata específica (implementar navegação)
    console.log("[DASH] Abrindo detalhes da próxima reunião:", proxima.id);
    alert(
      `Navegando para detalhes da reunião: ${
        proxima.titulo || "ID: " + proxima.id
      }`
    );
  };

  document.getElementById("calendario-proxima").onclick = () => {
    // Gera link iCal ou Google Calendar
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      proxima.titulo || "Reunião"
    )}&dates=${dataProxima
      .toISOString()
      .slice(
        0,
        -1
      )}Z/${dataProxima.toISOString()}&details=Reunião agendada no sistema EuPsico&location=${encodeURIComponent(
      proxima.local || "Online"
    )}`;
    window.open(url, "_blank");
    console.log("[DASH] Adicionando ao calendário:", proxima.id);
  };
}

function setupEventListeners() {
  // Filtro por tipo
  const tipoFiltro = document.getElementById("tipo-filtro");
  if (tipoFiltro) {
    tipoFiltro.addEventListener("change", filtrarEExibirAtas);
  }

  // Filtro por status
  const statusFiltro = document.getElementById("status-filtro");
  if (statusFiltro) {
    statusFiltro.addEventListener("change", filtrarEExibirAtas);
  }

  // Busca com debounce
  const buscaInput = document.getElementById("busca-titulo");
  if (buscaInput) {
    buscaInput.addEventListener("input", () => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(filtrarEExibirAtas, 300); // 300ms debounce
    });
  }

  // Limpar filtros
  const limparBtn = document.getElementById("limpar-filtros");
  if (limparBtn) {
    limparBtn.addEventListener("click", () => {
      if (tipoFiltro) tipoFiltro.value = "Todos";
      if (statusFiltro) statusFiltro.value = "Todos";
      if (buscaInput) buscaInput.value = "";
      filtrarEExibirAtas();
    });
  }

  // Delegation para ações nos accordions
  const atasContainer = document.getElementById("atas-container");
  if (atasContainer) {
    atasContainer.addEventListener("click", (e) => {
      // Botão PDF
      if (e.target.matches(".btn-pdf")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        gerarPDF(ataId);
      }

      // Botão Feedback
      if (e.target.matches(".btn-feedback")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        abrirFeedback(ataId);
      }

      // Botão Editar
      if (e.target.matches(".btn-editar")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        editarAta(ataId);
      }
    });
  }

  // Countdown update (atualiza a cada minuto para próxima reunião)
  setInterval(() => {
    if (
      document.getElementById("proxima-reuniao-container").style.display !==
      "none"
    ) {
      renderizarProximaReuniao();
    }
  }, 60000); // 1 minuto
}

function filtrarEExibirAtas() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const statusFiltro =
    document.getElementById("status-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  let atasFiltradas = [...todasAsAtas];

  // Filtro por tipo
  if (tipoFiltro !== "Todos") {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.tipo?.toLowerCase().includes(tipoFiltro.toLowerCase())
    );
  }

  // Filtro por status
  if (statusFiltro !== "Todos") {
    const agora = new Date();
    atasFiltradas = atasFiltradas.filter((ata) => {
      const dataAta = new Date(ata.dataReuniao);
      if (statusFiltro === "Agendada") {
        return dataAta > agora;
      } else if (statusFiltro === "Concluída") {
        return dataAta < agora && ata.status === "Concluída";
      } else if (statusFiltro === "Cancelada") {
        return ata.status === "Cancelada";
      }
    });
  }

  // Filtro por busca (título ou tipo)
  if (buscaTermo) {
    atasFiltradas = atasFiltradas.filter(
      (ata) =>
        ata.titulo?.toLowerCase().includes(buscaTermo) ||
        ata.tipo?.toLowerCase().includes(buscaTermo)
    );
  }

  // Ordena por data
  atasFiltradas.sort(
    (a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao)
  );

  // Renderiza accordions
  const atasContainer = document.getElementById("atas-container");
  if (atasContainer) {
    if (atasFiltradas.length === 0) {
      atasContainer.innerHTML = `
                <div class="alert alert-info text-center">
                    <span class="material-symbols-outlined">search_off</span>
                    Nenhuma ata encontrada para este filtro.
                </div>
            `;
    } else {
      atasContainer.innerHTML = atasFiltradas
        .map((ata) => renderSavedAtaAccordion(ata))
        .join("");
      atualizarContadorAtas(atasFiltradas.length);
    }

    atualizarStats(); // Garante stats atualizadas
  }
}

// Renderiza accordion individual aprimorado
function renderSavedAtaAccordion(ata) {
  const dataAta = new Date(ata.dataReuniao);
  const agora = new Date();
  const isFuturo = dataAta > agora;
  const isConcluida = dataAta < agora && ata.status === "Concluída";
  const isCancelada = ata.status === "Cancelada";

  const formattedDate = dataAta.toLocaleDateString("pt-BR");
  const statusBadge = isFuturo
    ? "bg-info"
    : isConcluida
    ? "bg-success"
    : isCancelada
    ? "bg-danger"
    : "bg-warning";
  const statusTexto = isFuturo
    ? "Agendada"
    : isConcluida
    ? "Concluída"
    : isCancelada
    ? "Cancelada"
    : "Em Andamento";

  // Determina status visual
  let statusIcon = "schedule";
  let statusCor = "text-info";
  if (isFuturo) {
    statusIcon = "schedule";
    statusCor = "text-info";
  } else if (isConcluida) {
    statusIcon = "check_circle";
    statusCor = "text-success";
  } else if (isCancelada) {
    statusIcon = "cancel";
    statusCor = "text-danger";
  }

  // Conteúdo do accordion
  const conteudoItems = [];

  // Tipo e data
  conteudoItems.push({
    titulo: "Detalhes Básicos",
    conteudo: `
            <div class="row mb-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      ata.tipo || "Não especificado"
                    }</p>
                    <p><strong>Data:</strong> ${formattedDate}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Local:</strong> ${ata.local || "Online"}</p>
                    <p><strong>Responsável:</strong> ${
                      ata.responsavel || "Não especificado"
                    }</p>
                </div>
            </div>
        `,
  });

  // Participantes
  if (ata.participantes && ata.participantes.length > 0) {
    conteudoItems.push({
      titulo: "Participantes",
      conteudo: `
                <div class="participants-list">
                    ${ata.participantes
                      .slice(0, 10)
                      .map(
                        (nome) => `
                        <span class="badge bg-light text-dark me-1 mb-1">${nome}</span>
                    `
                      )
                      .join("")}
                    ${
                      ata.participantes.length > 10
                        ? `<span class="badge bg-secondary">+${
                            ata.participantes.length - 10
                          } outros</span>`
                        : ""
                    }
                </div>
            `,
    });
  }

  // Notas/resumo
  if (ata.notas || ata.resumo) {
    conteudoItems.push({
      titulo: "Resumo/Notas",
      conteudo: `
                <div class="ata-conteudo">
                    <p class="mb-0">${
                      ata.resumo || ata.notas || "Sem resumo disponível."
                    }</p>
                </div>
            `,
    });
  }

  const conteudoAccordion = conteudoItems
    .map(
      (item) => `
        <div class="accordion-item mb-3">
            <h6 class="accordion-header mb-0">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#collapse-${ata.id}-${item.titulo
        .replace(/\s+/g, "-")
        .toLowerCase()}">
                    ${item.titulo}
                </button>
            </h6>
            <div id="collapse-${ata.id}-${item.titulo
        .replace(/\s+/g, "-")
        .toLowerCase()}" 
                 class="accordion-collapse collapse" data-bs-parent="#atas-container">
                <div class="accordion-body">
                    ${item.conteudo}
                </div>
            </div>
        </div>
    `
    )
    .join("");

  return `
        <div class="ata-item" data-ata-id="${ata.id}">
            <div class="accordion-item mb-4">
                <div class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#collapse-ata-${ata.id}">
                        <div class="ata-header-content">
                            <div class="ata-titulo-section">
                                <span class="material-symbols-outlined ata-icon">${statusIcon}</span>
                                <h5 class="mb-0">${
                                  ata.titulo || ata.tipo || "Reunião"
                                }</h5>
                                <span class="badge ${statusBadge} ms-2">${statusTexto}</span>
                            </div>
                            <div class="ata-meta">
                                <small class="text-muted">${formattedDate}</small>
                                <div class="ata-actions">
                                    <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="Gerar PDF">
                                        <span class="material-symbols-outlined">picture_as_pdf</span>
                                    </button>
                                    <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Abrir Feedback">
                                        <span class="material-symbols-outlined">feedback</span>
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar Ata">
                                        <span class="material-symbols-outlined">edit</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </button>
                </div>
                <div id="collapse-ata-${
                  ata.id
                }" class="accordion-collapse collapse" data-bs-parent="#atas-container">
                    <div class="accordion-body">
                        ${conteudoAccordion}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function atualizarContadorAtas(qtd) {
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) {
    contadorEl.textContent = qtd;
    contadorEl.className = qtd > 0 ? "badge bg-primary" : "badge bg-secondary";
  }
}

// Funções de ações (placeholders para expansão)
function gerarPDF(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  if (!ata) return console.error("[DASH] Ata não encontrada para PDF:", ataId);

  console.log("[DASH] Gerando PDF para:", ata.titulo);
  // Implementação: usar jsPDF ou window.print() com CSS @media print
  alert(
    `Gerando PDF da ata "${ata.titulo}" (implementar com jsPDF ou print). ID: ${ataId}`
  );
}

function abrirFeedback(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Abrindo feedback para:", ata?.titulo);

  // Navega para página de feedback ou modal
  alert(`Abrindo feedback da ata "${ata?.titulo || "ID: " + ataId}"`);
  // Exemplo: window.location.href = `/feedback.html?ataId=${ataId}`;
}

function editarAta(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Editando ata:", ata?.titulo);

  // Navega para editor ou abre modal
  alert(`Editando ata "${ata?.titulo || "ID: " + ataId}"`);
  // Exemplo: window.location.href = `/ata-de-reuniao.html?id=${ataId}&edit=true`;
}

// Cleanup ao sair da view (chamado por painel-gestao.js se implementado)
export function cleanup() {
  if (unsubscribeAtas) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Listener cleanup executado.");
  }
  clearTimeout(timeoutBusca);
}

// Inicialização Bootstrap collapse se necessário (para accordions nested)
document.addEventListener("DOMContentLoaded", () => {
  const bsCollapse = window.bootstrap?.Collapse;
  if (bsCollapse && !document.querySelector('[data-bs-toggle="collapse"]')) {
    console.log(
      "[DASH] Bootstrap Collapse não detectado - accordions nativos."
    );
  }
});
