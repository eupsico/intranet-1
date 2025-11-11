// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 3.1 (Corrigido: validação de participantes como array/string)

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

// Função helper para normalizar participantes
function normalizarParticipantes(participantes) {
  if (!participantes) return [];

  if (Array.isArray(participantes)) {
    return participantes;
  } else if (typeof participantes === "string") {
    // Converte string para array (vírgula ou quebra de linha)
    return participantes
      .split(/[\n,]+/)
      .map((nome) => nome.trim())
      .filter((nome) => nome.length > 0);
  } else {
    console.warn(
      "[DASH] Formato de participantes inválido:",
      typeof participantes,
      participantes
    );
    return [];
  }
}

export function init() {
  console.log(
    "[DASH] Módulo Dashboard de Reuniões iniciado (v3.1 - Corrigido participantes)."
  );
  setupEventListeners();
  loadAtasFromFirestore();
}

function loadAtasFromFirestore() {
  if (unsubscribeAtas) unsubscribeAtas();

  const atasContainer = document.getElementById("atas-container");
  if (!atasContainer) {
    console.error("[DASH] Container #atas-container não encontrado.");
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
        participantes: normalizarParticipantes(doc.data().participantes), // Normaliza aqui
      }));

      atualizarStats();
      filtrarEExibirAtas();

      const loadingEl = atasContainer.querySelector(".loading-spinner");
      if (loadingEl) loadingEl.style.display = "none";

      console.log(`[DASH] Dados atualizados: ${todasAsAtas.length} atas.`);
    },
    (error) => {
      console.error("[DASH] Erro ao carregar:", error);
      atasContainer.innerHTML = `
            <div class="alert alert-danger">
                <span class="material-symbols-outlined">error</span>
                Erro ao carregar atas: ${error.message}
            </div>
        `;
    }
  );
}

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

  const totalEl = document.getElementById("total-reunioes");
  const proximasEl = document.getElementById("proximas-reunioes");
  const concluidasEl = document.getElementById("reunioes-concluidas");

  if (totalEl) totalEl.textContent = totalReunioes;
  if (proximasEl) proximasEl.textContent = proximasReunioes;
  if (concluidasEl) concluidasEl.textContent = reunioesConcluidas;

  renderizarProximaReuniao();
  const proximaContainer = document.getElementById("proxima-reuniao-container");
  if (proximaContainer) {
    proximaContainer.style.display = proximasReunioes > 0 ? "block" : "none";
  }

  atualizarContadorAtas(totalReunioes);
}

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

  const detalhesBtn = document.getElementById("ver-detalhes-proxima");
  const calendarioBtn = document.getElementById("calendario-proxima");
  if (detalhesBtn) {
    detalhesBtn.onclick = () => {
      console.log("[DASH] Detalhes:", proxima.id);
      alert(`Navegando para: ${proxima.titulo || "ID: " + proxima.id}`);
    };
  }
  if (calendarioBtn) {
    calendarioBtn.onclick = () => {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        proxima.titulo || "Reunião"
      )}&dates=${dataProxima
        .toISOString()
        .slice(
          0,
          -1
        )}Z/${dataProxima.toISOString()}&details=Reunião no EuPsico&location=${encodeURIComponent(
        proxima.local || "Online"
      )}`;
      window.open(url, "_blank");
    };
  }
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
      if (e.target.matches(".btn-pdf")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        gerarPDF(ataId);
      } else if (e.target.matches(".btn-feedback")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        abrirFeedback(ataId);
      } else if (e.target.matches(".btn-editar")) {
        e.preventDefault();
        const ataId = e.target.closest(".ata-item").dataset.ataId;
        editarAta(ataId);
      }
    });
  }

  // Accordions nativos (não Bootstrap para evitar dependências)
  atasContainer.addEventListener("click", (e) => {
    if (e.target.matches('[data-bs-toggle="collapse"]')) {
      e.preventDefault();
      const targetId = e.target.getAttribute("data-bs-target");
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        targetEl.classList.toggle("show");
        e.target.classList.toggle("collapsed");
      }
    }
  });

  // Countdown update
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
      const dataAta = new Date(ata.dataReuniao);
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
    (a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao)
  );

  const atasContainer = document.getElementById("atas-container");
  if (atasContainer) {
    if (atasFiltradas.length === 0) {
      atasContainer.innerHTML = `
                <div class="alert alert-info text-center">
                    <span class="material-symbols-outlined">search_off</span>
                    Nenhuma ata encontrada.
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
    atualizarStats();
  }
}

// CORRIGIDO: renderSavedAtaAccordion com validação
function renderSavedAtaAccordion(ata) {
  try {
    const dataAta = new Date(ata.dataReuniao || "Invalid Date");
    const agora = new Date();
    const isFuturo = !isNaN(dataAta.getTime()) && dataAta > agora;
    const isConcluida =
      !isNaN(dataAta.getTime()) &&
      dataAta < agora &&
      ata.status === "Concluída";
    const isCancelada = ata.status === "Cancelada";

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
      : "Em Andamento";
    const statusIcon = isFuturo
      ? "schedule"
      : isConcluida
      ? "check_circle"
      : isCancelada
      ? "cancel"
      : "hourglass_empty";

    const participantes = normalizarParticipantes(ata.participantes); // CORREÇÃO: Usa helper
    const participantesPreview = participantes.slice(0, 3);
    const maisParticipantes =
      participantes.length > 3 ? `+${participantes.length - 3}` : "";

    const conteudoItems = [];

    // Detalhes básicos
    conteudoItems.push({
      titulo: "Detalhes",
      conteudo: `
                <div class="row g-3">
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

    // Participantes (CORRIGIDO)
    if (participantes.length > 0) {
      conteudoItems.push({
        titulo: "Participantes",
        conteudo: `
                    <div class="participants-container">
                        ${participantesPreview
                          .map(
                            (nome) => `
                            <span class="badge bg-light text-dark me-1 mb-1">${nome}</span>
                        `
                          )
                          .join("")}
                        ${
                          maisParticipantes
                            ? `<span class="badge bg-secondary me-1 mb-1">${maisParticipantes}</span>`
                            : ""
                        }
                        <small class="text-muted">Total: ${
                          participantes.length
                        }</small>
                    </div>
                `,
      });
    }

    // Resumo/Notas
    if (ata.notas || ata.resumo || ata.pontos || ata.decisoes) {
      const resumoTexto = [ata.resumo, ata.notas, ata.pontos, ata.decisoes]
        .filter(Boolean)
        .join(" | ");

      conteudoItems.push({
        titulo: "Resumo",
        conteudo: `
                    <div class="ata-resumo">
                        <p class="mb-0">${
                          resumoTexto || "Sem resumo disponível."
                        }</p>
                    </div>
                `,
      });
    }

    // Plano de ação (se existir)
    if (ata.planoDeAcao && ata.planoDeAcao.length > 0) {
      conteudoItems.push({
        titulo: "Plano de Ação",
        conteudo: `
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Tarefa</th>
                                    <th>Responsável</th>
                                    <th>Prazo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ata.planoDeAcao
                                  .map(
                                    (item) => `
                                    <tr>
                                        <td>${
                                          item.descricao || "Não especificado"
                                        }</td>
                                        <td>${
                                          item.responsavel || "Não atribuído"
                                        }</td>
                                        <td>${
                                          item.prazo
                                            ? new Date(
                                                item.prazo
                                              ).toLocaleDateString("pt-BR")
                                            : "Sem prazo"
                                        }</td>
                                    </tr>
                                `
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                `,
      });
    }

    const conteudoAccordion = conteudoItems
      .map(
        (item, index) => `
            <div class="detail-section mb-3">
                <h6 class="detail-title">${item.titulo}</h6>
                <div class="detail-content">${item.conteudo}</div>
            </div>
        `
      )
      .join("");

    return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div class="ata-header-left">
                        <span class="material-symbols-outlined ata-status-icon ${statusCor} me-2">${statusIcon}</span>
                        <h5 class="card-title mb-0">${
                          ata.titulo || ata.tipo || "Reunião"
                        }</h5>
                        <span class="badge ${statusBadge}">${statusTexto}</span>
                    </div>
                    <div class="ata-header-right">
                        <small class="text-muted me-3">${formattedDate}</small>
                        <div class="ata-actions">
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
                </div>
                <div class="card-body">
                    <div class="ata-conteudo">${conteudoAccordion}</div>
                </div>
            </div>
        `;
  } catch (error) {
    console.error(
      "[DASH] Erro ao renderizar accordion:",
      error,
      "Ata:",
      ata.id
    );
    return `
            <div class="ata-item card mb-4 border-danger">
                <div class="card-header bg-light">
                    <h5 class="card-title mb-0 text-danger">
                        <span class="material-symbols-outlined">error</span>
                        Erro ao carregar ata ${ata.id}
                    </h5>
                </div>
                <div class="card-body">
                    <p class="text-danger">Dados corrompidos. Contate o administrador.</p>
                </div>
            </div>
        `;
  }
}

function atualizarContadorAtas(qtd) {
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) {
    contadorEl.textContent = qtd;
    contadorEl.className =
      qtd > 0 ? "badge bg-primary ms-2" : "badge bg-secondary ms-2";
  }
}

// Ações (placeholders)
function gerarPDF(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  if (!ata) return console.error("[DASH] Ata não encontrada:", ataId);
  console.log("[DASH] PDF:", ata.titulo);
  alert(`PDF de "${ata.titulo}" (implementar jsPDF ou print).`);
}

function abrirFeedback(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Feedback:", ata?.titulo);
  alert(
    `Feedback de "${ata?.titulo}" (navegar para feedback.html?ataId=${ataId}).`
  );
}

function editarAta(ataId) {
  const ata = todasAsAtas.find((a) => a.id === ataId);
  console.log("[DASH] Edit:", ata?.titulo);
  alert(
    `Editando "${ata?.titulo}" (navegar para ata-de-reuniao.html?id=${ataId}&edit=true).`
  );
}

export function cleanup() {
  if (unsubscribeAtas) {
    unsubscribeAtas();
    unsubscribeAtas = null;
    console.log("[DASH] Cleanup executado.");
  }
  clearTimeout(timeoutBusca);
}
