// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.2 (Corrigido: statusCor definido, validações completas, accordions nativos)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let unsubscribeAtas = null;
let timeoutBusca = null;

function normalizarParticipantes(participantes) {
  if (!participantes) return [];
  if (Array.isArray(participantes)) return participantes;
  if (typeof participantes === "string") {
    return participantes
      .split(/[\n,]+/)
      .map((nome) => nome.trim())
      .filter((nome) => nome.length > 0);
  }
  console.warn(
    "[DASH] Formato inválido de participantes:",
    typeof participantes
  );
  return [];
}

export function init() {
  console.log("[DASH] Dashboard iniciado (v3.2 - Corrigido statusCor).");
  setupEventListeners();
  loadAtasFromFirestore();
}

function loadAtasFromFirestore() {
  if (unsubscribeAtas) unsubscribeAtas();

  const atasContainer = document.getElementById("atas-container");
  if (!atasContainer) {
    console.error("[DASH] Container não encontrado.");
    return;
  }

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
        participantes: normalizarParticipantes(doc.data().participantes),
      }));

      atualizarStats();
      filtrarEExibirAtas();

      const loadingEl = atasContainer.querySelector(".loading-spinner");
      if (loadingEl) loadingEl.remove();

      console.log(`[DASH] Atualizado: ${todasAsAtas.length} atas.`);
    },
    (error) => {
      console.error("[DASH] Erro:", error);
      atasContainer.innerHTML = `<div class="alert alert-danger">Erro ao carregar: ${error.message}</div>`;
    }
  );
}

function atualizarStats() {
  const agora = new Date();

  const totalReunioes = todasAsAtas.length;
  const proximasReunioes = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataAta.getTime()) &&
      dataAta > agora &&
      (ata.status === "Agendada" || !ata.status)
    );
  }).length;

  const reunioesConcluidas = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao || 0);
    return (
      !isNaN(dataAta.getTime()) && dataAta < agora && ata.status === "Concluída"
    );
  }).length;

  if (document.getElementById("total-reunioes"))
    document.getElementById("total-reunioes").textContent = totalReunioes;
  if (document.getElementById("proximas-reunioes"))
    document.getElementById("proximas-reunioes").textContent = proximasReunioes;
  if (document.getElementById("reunioes-concluidas"))
    document.getElementById("reunioes-concluidas").textContent =
      reunioesConcluidas;

  renderizarProximaReuniao();
  const proximaContainer = document.getElementById("proxima-reuniao-container");
  if (proximaContainer)
    proximaContainer.style.display = proximasReunioes > 0 ? "block" : "none";

  atualizarContadorAtas(totalReunioes);
}

function renderizarProximaReuniao() {
  const agora = new Date();
  const proximas = todasAsAtas
    .filter((ata) => {
      const dataAta = new Date(ata.dataReuniao || 0);
      return !isNaN(dataAta.getTime()) && dataAta > agora;
    })
    .sort((a, b) => new Date(a.dataReuniao) - new Date(b.dataReuniao));

  const infoEl = document.getElementById("proxima-reuniao-info");
  if (!infoEl || proximas.length === 0) return;

  const proxima = proximas[0];
  const dataProxima = new Date(proxima.dataReuniao || 0);
  if (isNaN(dataProxima.getTime())) return;

  const diffEmMs = dataProxima - agora;
  const dias = Math.floor(diffEmMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor(
    (diffEmMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutos = Math.floor((diffEmMs % (1000 * 60 * 60)) / (1000 * 60));

  let tempoTexto = "";
  if (dias > 0) tempoTexto = `Em ${dias} dia${dias > 1 ? "s" : ""}`;
  else if (horas > 0) tempoTexto = `Em ${horas} hora${horas > 1 ? "s" : ""}`;
  else if (minutos > 0)
    tempoTexto = `Em ${minutos} minuto${minutos > 1 ? "s" : ""}`;
  else tempoTexto = "Em breve!";

  infoEl.innerHTML = `
        <h5>${proxima.titulo || proxima.tipo || "Reunião"}</h5>
        <p><strong>Tipo:</strong> ${proxima.tipo || "Não especificado"}</p>
        <p><strong>Data:</strong> ${dataProxima.toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        })}</p>
        <p><strong>Local:</strong> ${proxima.local || "Online"}</p>
        <p class="fw-bold">${tempoTexto}</p>
    `;

  const detalhesBtn = document.getElementById("ver-detalhes-proxima");
  if (detalhesBtn)
    detalhesBtn.onclick = () =>
      alert(`Detalhes: ${proxima.titulo || proxima.id}`);

  const calendarioBtn = document.getElementById("calendario-proxima");
  if (calendarioBtn)
    calendarioBtn.onclick = () => {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        proxima.titulo || "Reunião"
      )}&dates=${dataProxima
        .toISOString()
        .slice(
          0,
          -1
        )}Z/${dataProxima.toISOString()}&location=${encodeURIComponent(
        proxima.local || "Online"
      )}`;
      window.open(url, "_blank");
    };
}

function setupEventListeners() {
  const tipoFiltro = document.getElementById("tipo-filtro");
  const statusFiltro = document.getElementById("status-filtro");
  const buscaInput = document.getElementById("busca-titulo");
  const limparBtn = document.getElementById("limpar-filtros");
  const atasContainer = document.getElementById("atas-container");

  if (tipoFiltro) tipoFiltro.addEventListener("change", filtrarEExibirAtas);
  if (statusFiltro) statusFiltro.addEventListener("change", filtrarEExibirAtas);

  if (buscaInput) {
    buscaInput.addEventListener("input", () => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(filtrarEExibirAtas, 300);
    });
  }

  if (limparBtn) {
    limparBtn.addEventListener("click", () => {
      if (tipoFiltro) tipoFiltro.value = "Todos";
      if (statusFiltro) statusFiltro.value = "Todos";
      if (buscaInput) buscaInput.value = "";
      filtrarEExibirAtas();
    });
  }

  if (atasContainer) {
    atasContainer.addEventListener("click", (e) => {
      const ataItem = e.target.closest(".ata-item");
      if (!ataItem) return;

      const ataId = ataItem.dataset.ataId;
      if (!ataId) return;

      if (e.target.matches(".btn-pdf")) gerarPDF(ataId);
      else if (e.target.matches(".btn-feedback")) abrirFeedback(ataId);
      else if (e.target.matches(".btn-editar")) editarAta(ataId);

      // Toggle accordion principal
      if (e.target.closest(".ata-header")) {
        const conteudo = ataItem.querySelector(".ata-conteudo");
        if (conteudo) {
          conteudo.style.display =
            conteudo.style.display === "none" ? "block" : "none";
        }
      }
    });
  }

  setInterval(() => {
    if (
      document.getElementById("proxima-reuniao-container")?.style.display !==
      "none"
    ) {
      renderizarProximaReuniao();
    }
  }, 60000);
}

function filtrarEExibirAtas() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const statusFiltro =
    document.getElementById("status-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  let atasFiltradas = [...todasAsAtas];

  if (tipoFiltro !== "Todos") {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.tipo?.toLowerCase().includes(tipoFiltro.toLowerCase())
    );
  }

  if (statusFiltro !== "Todos") {
    const agora = new Date();
    atasFiltradas = atasFiltradas.filter((ata) => {
      const dataAta = new Date(ata.dataReuniao || 0);
      if (isNaN(dataAta.getTime())) return false;
      if (statusFiltro === "Agendada") return dataAta > agora;
      if (statusFiltro === "Concluída")
        return dataAta < agora && ata.status === "Concluída";
      if (statusFiltro === "Cancelada") return ata.status === "Cancelada";
      return true;
    });
  }

  if (buscaTermo) {
    atasFiltradas = atasFiltradas.filter(
      (ata) =>
        ata.titulo?.toLowerCase().includes(buscaTermo) ||
        ata.tipo?.toLowerCase().includes(buscaTermo)
    );
  }

  atasFiltradas.sort(
    (a, b) => new Date(b.dataReuniao || 0) - new Date(a.dataReuniao || 0)
  );

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
      try {
        atasContainer.innerHTML = atasFiltradas
          .map((ata) => renderSavedAtaAccordion(ata))
          .join("");
        atualizarContadorAtas(atasFiltradas.length);
      } catch (error) {
        console.error("[DASH] Erro ao renderizar:", error);
        atasContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro ao exibir atas: ${error.message}
                    </div>
                `;
      }
    }
  }
  atualizarStats();
}

// CORRIGIDO: renderSavedAtaAccordion com statusCor definido
function renderSavedAtaAccordion(ata) {
  try {
    const dataAta = new Date(ata.dataReuniao || 0);
    const agora = new Date();
    const isFuturo = !isNaN(dataAta.getTime()) && dataAta > agora;
    const isConcluida =
      !isNaN(dataAta.getTime()) &&
      dataAta < agora &&
      ata.status === "Concluída";
    const isCancelada = ata.status === "Cancelada";
    const hasStatus = ata.status || "Em Andamento";

    // CORREÇÃO: Define statusCor explicitamente baseado em condições
    let statusCor = "text-muted";
    let statusIcon = "help_outline";
    if (isFuturo) {
      statusCor = "text-info";
      statusIcon = "schedule";
    } else if (isConcluida) {
      statusCor = "text-success";
      statusIcon = "check_circle";
    } else if (isCancelada) {
      statusCor = "text-danger";
      statusIcon = "cancel";
    } else if (hasStatus === "Em Andamento") {
      statusCor = "text-warning";
      statusIcon = "hourglass_empty";
    }

    const formattedDate = !isNaN(dataAta.getTime())
      ? dataAta.toLocaleDateString("pt-BR")
      : "Data inválida";
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
      : hasStatus;

    const participantes = normalizarParticipantes(ata.participantes);
    const participantesPreview = participantes.slice(0, 3);
    const maisParticipantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    // Conteúdo básico
    const conteudoDetalhes = `
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <p><strong>Tipo:</strong> ${
                      ata.tipo || "Não especificado"
                    }</p>
                    <p><strong>Data:</strong> <span class="${statusCor}">${formattedDate}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Local:</strong> ${ata.local || "Online"}</p>
                    <p><strong>Responsável:</strong> ${
                      ata.responsavel || "Não especificado"
                    }</p>
                </div>
            </div>
        `;

    // Participantes
    const conteudoParticipantes =
      participantes.length > 0
        ? `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-info me-1">group</span> Participantes</h6>
                <div class="d-flex flex-wrap gap-1 mb-1">
                    ${participantesPreview
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

    // Resumo
    const resumoTexto =
      ata.resumo ||
      ata.notas ||
      ata.pontosDiscutidos ||
      "Sem resumo disponível.";
    const conteudoResumo = `
            <div class="mb-3">
                <h6 class="mb-2"><span class="material-symbols-outlined text-primary me-1">description</span> Resumo</h6>
                <p class="ata-resumo-text">${resumoTexto}</p>
            </div>
        `;

    const conteudoAccordion = `
            ${conteudoDetalhes}
            ${conteudoParticipantes}
            ${conteudoResumo}
        `;

    return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-start p-3" style="cursor: pointer;" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${statusCor}; font-size: 1.5rem;">${statusIcon}</span>
                            <h5 class="mb-0 flex-grow-1">${
                              ata.titulo || ata.tipo || "Reunião"
                            }</h5>
                            <span class="badge ${statusBadge} ms-2">${statusTexto}</span>
                        </div>
                        <div class="d-flex align-items-center mt-1">
                            <small class="text-muted me-3">${formattedDate}</small>
                        </div>
                    </div>
                    <div class="ata-actions ms-3 flex-shrink-0">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-pdf" title="PDF" data-ata-id="${
                          ata.id
                        }">
                            <span class="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                        <button class="btn btn-sm btn-outline-success me-1 btn-feedback" title="Feedback" data-ata-id="${
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
  } catch (error) {
    console.error(
      "[DASH] Erro no accordion:",
      error,
      "Ata:",
      ata?.id || "unknown"
    );
    return `
            <div class="ata-item card mb-4 border-danger">
                <div class="card-header bg-light">
                    <h5 class="mb-0 text-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro na Ata
                    </h5>
                </div>
                <div class="card-body">
                    <p>Dados corrompidos. ID: ${ata?.id || "unknown"}</p>
                </div>
            </div>
        `;
  }
}

function atualizarContadorAtas(qtd) {
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) {
    contadorEl.textContent = qtd;
    contadorEl.className = `badge ${
      qtd > 0 ? "bg-primary" : "bg-secondary"
    } ms-2`;
  }
}

function gerarPDF(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  if (!ata) return console.error("[DASH] PDF: Ata não encontrada");
  console.log("[DASH] PDF:", ata.titulo);
  alert(`PDF de "${ata.titulo}" (implementar).`);
}

function abrirFeedback(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Feedback:", ata?.titulo);
  alert(`Feedback: ${ata?.titulo || ataId}`);
}

function editarAta(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Edit:", ata?.titulo);
  alert(`Editando: ${ata?.titulo || ataId}`);
}

export function cleanup() {
  if (unsubscribeAtas) {
    unsubscribeAtas();
    console.log("[DASH] Cleanup.");
  }
  clearTimeout(timeoutBusca);
}
