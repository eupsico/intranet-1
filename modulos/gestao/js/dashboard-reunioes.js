// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 5.3 (Coluna "Presença" com Taxa de Comparecer)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let todosOsAgendamentos = [];
let unsubscribeAtas = null;
let unsubscribeAgendamentos = null;
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
  return [];
}

export function init() {
  console.log("[DASH] Dashboard iniciado (v5.3 - Presença de Voluntários).");
  configurarEventListeners();
  carregarDados();
}

function configurarEventListeners() {
  document.body.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link") || e.target.closest(".tab-link")) {
      e.preventDefault();
      const btn = e.target.matches(".tab-link")
        ? e.target
        : e.target.closest(".tab-link");
      const abaId = btn.dataset.tab;
      alternarAba(abaId);
    }
  });

  const tipoFiltro = document.getElementById("tipo-filtro");
  if (tipoFiltro)
    tipoFiltro.addEventListener("change", aplicarFiltrosEExibirAtas);

  const buscaInput = document.getElementById("busca-titulo");
  if (buscaInput) {
    buscaInput.addEventListener("input", () => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  const limparBtn = document.getElementById("limpar-filtros");
  if (limparBtn)
    limparBtn.addEventListener("click", () => {
      if (tipoFiltro) tipoFiltro.value = "Todos";
      if (buscaInput) buscaInput.value = "";
      aplicarFiltrosEExibirAtas();
    });
}

function alternarAba(abaId) {
  console.log("[DASH] Alternando para aba:", abaId);
  document
    .querySelectorAll(".tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const activeBtn = document.querySelector(`[data-tab="${abaId}"]`);
  const activeContent = document.getElementById(`${abaId}-tab`);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeContent) activeContent.classList.add("active");
}

function carregarDados() {
  const qAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(qAtas, (snapshot) => {
    todasAsAtas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      participantes: normalizarParticipantes(doc.data().participantes),
    }));
    aplicarFiltrosEExibirAtas();
    atualizarGraficos();
    console.log(`[DASH] Atas: ${todasAsAtas.length}`);
  });

  const qAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(qAgendamentos, (snapshot) => {
    todosOsAgendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    atualizarGraficos();
    console.log(`[DASH] Agendamentos: ${todosOsAgendamentos.length}`);
  });
}

function aplicarFiltrosEExibirAtas() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  let atasFiltradas = [...todasAsAtas];

  if (tipoFiltro !== "Todos") {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.tipo?.toLowerCase().includes(tipoFiltro.toLowerCase())
    );
  }

  if (buscaTermo) {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.titulo?.toLowerCase().includes(buscaTermo)
    );
  }

  atasFiltradas.sort(
    (a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao)
  );

  const container = document.getElementById("atas-container");
  if (!container) return;

  if (atasFiltradas.length === 0) {
    container.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">search_off</span>
                Nenhuma ata encontrada.
            </div>
        `;
    atualizarContadorAtas(0);
    return;
  }

  container.innerHTML = atasFiltradas
    .map((ata) => {
      const dataAta = new Date(ata.dataReuniao);
      const agora = new Date();
      const ehFutura = dataAta > agora;
      const statusCor = ehFutura ? "text-info" : "text-success";
      const iconeStatus = ehFutura ? "schedule" : "check_circle";

      const participantes = normalizarParticipantes(ata.participantes);
      const previewParticipantes = participantes.slice(0, 3);
      const maisParticipantes =
        participantes.length > 3 ? `+${participantes.length - 3}` : "";

      return `
            <div class="ata-item card mb-4" data-ata-id="${ata.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${statusCor};">${iconeStatus}</span>
                            <h5 class="mb-0">${
                              ata.titulo || ata.tipo || "Reunião"
                            }</h5>
                        </div>
                        <small class="text-muted">${dataAta.toLocaleDateString(
                          "pt-BR"
                        )}</small>
                    </div>
                    <div class="ata-acoes">
                        <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="PDF" onclick="event.stopPropagation(); alert('PDF: ${
                          ata.id
                        }');">
                            <span class="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                        <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Feedback" onclick="event.stopPropagation(); alert('Feedback: ${
                          ata.id
                        }');">
                            <span class="material-symbols-outlined">feedback</span>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar" onclick="event.stopPropagation(); alert('Editar: ${
                          ata.id
                        }');">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                </div>
                <div class="ata-conteudo card-body" style="display: none; border-top: 1px solid #e5e7eb;">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <p><strong>Tipo:</strong> ${
                              ata.tipo || "Não especificado"
                            }</p>
                            <p><strong>Data:</strong> ${dataAta.toLocaleDateString(
                              "pt-BR"
                            )}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Local:</strong> ${
                              ata.local || "Online"
                            }</p>
                            <p><strong>Responsável:</strong> ${
                              ata.responsavel || "Não especificado"
                            }</p>
                        </div>
                    </div>
                    ${
                      participantes.length > 0
                        ? `
                        <div class="mb-3">
                            <h6>Participantes</h6>
                            <div class="d-flex flex-wrap gap-1">
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
                            <small class="text-muted">Total: ${
                              participantes.length
                            }</small>
                        </div>
                    `
                        : ""
                    }
                    ${
                      ata.resumo
                        ? `
                        <div class="mb-3">
                            <h6>Resumo</h6>
                            <p>${ata.resumo}</p>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");

  atualizarContadorAtas(atasFiltradas.length);
}

function atualizarGraficos() {
  const agora = new Date();

  const totalAtas = todasAsAtas.length;
  const atasFuturas = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao);
    return !isNaN(dataAta.getTime()) && dataAta > agora;
  }).length;
  const atasConcluidas = todasAsAtas.filter((ata) => {
    const dataAta = new Date(ata.dataReuniao);
    return (
      !isNaN(dataAta.getTime()) && dataAta < agora && ata.status === "Concluída"
    );
  }).length;

  const totalEl = document.getElementById("total-reunioes");
  const proximasEl = document.getElementById("proximas-reunioes");
  const concluidasEl = document.getElementById("reunioes-concluidas");

  if (totalEl) totalEl.textContent = totalAtas;
  if (proximasEl) proximasEl.textContent = atasFuturas;
  if (concluidasEl) concluidasEl.textContent = atasConcluidas;

  renderizarTabelaAtasPorTipo();
  renderizarTabelaAgendamentosPorGestor();
  renderizarProximaReuniao();
}

function renderizarTabelaAtasPorTipo() {
  const container = document.getElementById("grafico-atas-tipo");
  if (!container) return;

  const atasPorTipo = {};
  todasAsAtas.forEach((ata) => {
    const tipo = ata.tipo || "Outros";
    atasPorTipo[tipo] = (atasPorTipo[tipo] || 0) + 1;
  });

  const totalAtas = todasAsAtas.length;

  if (totalAtas === 0) {
    container.innerHTML = `
            <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
                <h5 class="mb-0">
                    <span class="material-symbols-outlined me-2" style="vertical-align: middle;">bar_chart</span>
                    Atas por Tipo de Reunião
                </h5>
            </div>
            <div class="alert alert-info text-center">
                <p class="mb-0">Nenhuma ata registrada.</p>
            </div>
        `;
    return;
  }

  const linhas = Object.entries(atasPorTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, qtd]) => {
      const percentual =
        totalAtas > 0 ? Math.round((qtd / totalAtas) * 100) : 0;
      return `
                <tr>
                    <td><strong>${tipo}</strong></td>
                    <td class="text-center">${qtd}</td>
                    <td class="text-center">
                        <span class="badge bg-primary">${percentual}%</span>
                    </td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${percentual}%"></div>
                        </div>
                    </td>
                </tr>
            `;
    })
    .join("");

  container.innerHTML = `
        <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
            <h5 class="mb-0">
                <span class="material-symbols-outlined me-2" style="vertical-align: middle;">bar_chart</span>
                Atas por Tipo de Reunião
            </h5>
        </div>
        <div class="table-responsive">
            <table class="table table-hover table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Tipo de Reunião</th>
                        <th class="text-center">Quantidade</th>
                        <th class="text-center">Percentual</th>
                        <th>Gráfico</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;
}

function renderizarTabelaAgendamentosPorGestor() {
  const container = document.getElementById("grafico-agendamentos-gestor");
  if (!container) return;

  const agendamentosPorGestor = {};
  let totalAgendamentosComGestor = 0;

  todosOsAgendamentos.forEach((agendamento) => {
    (agendamento.slots || []).forEach((slot) => {
      const gestorNome = slot.gestorNome || "Gestor não especificado";
      const vagas = (slot.vagas || []).length;
      agendamentosPorGestor[gestorNome] =
        (agendamentosPorGestor[gestorNome] || 0) + vagas;
      totalAgendamentosComGestor += vagas;
    });
  });

  if (totalAgendamentosComGestor === 0) {
    container.innerHTML = `
            <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
                <h5 class="mb-0">
                    <span class="material-symbols-outlined me-2" style="vertical-align: middle;">group</span>
                    Agendamentos com Voluntários por Gestor
                </h5>
            </div>
            <div class="alert alert-info text-center">
                <p class="mb-0">Nenhum agendamento encontrado.</p>
            </div>
        `;
    return;
  }

  // Calcula presença por gestor
  const presencaPorGestor = {};
  todosOsAgendamentos.forEach((agendamento) => {
    (agendamento.slots || []).forEach((slot) => {
      const gestorNome = slot.gestorNome || "Gestor não especificado";
      if (!presencaPorGestor[gestorNome]) {
        presencaPorGestor[gestorNome] = { total: 0, presente: 0 };
      }
      (slot.vagas || []).forEach((vaga) => {
        presencaPorGestor[gestorNome].total++;
        if (vaga.presente) presencaPorGestor[gestorNome].presente++;
      });
    });
  });

  const linhas = Object.entries(agendamentosPorGestor)
    .sort((a, b) => b[1] - a[1])
    .map(([gestor, qtd]) => {
      const percentual =
        totalAgendamentosComGestor > 0
          ? Math.round((qtd / totalAgendamentosComGestor) * 100)
          : 0;

      // Calcula presença deste gestor
      const dadosPresenca = presencaPorGestor[gestor] || {
        total: 0,
        presente: 0,
      };
      const percentualPresenca =
        dadosPresenca.total > 0
          ? Math.round((dadosPresenca.presente / dadosPresenca.total) * 100)
          : 0;

      // Define cor baseado na presença
      let corPresenca = "bg-danger"; // Vermelho: baixa presença
      if (percentualPresenca >= 75)
        corPresenca = "bg-success"; // Verde: alta presença
      else if (percentualPresenca >= 50) corPresenca = "bg-warning"; // Amarelo: média presença

      const iconePresenca =
        percentualPresenca >= 75
          ? "check_circle"
          : percentualPresenca >= 50
          ? "schedule"
          : "close";

      return `
                <tr>
                    <td><strong>${gestor}</strong></td>
                    <td class="text-center">${qtd}</td>
                    <td class="text-center">
                        <span class="badge bg-success">${percentual}%</span>
                    </td>
                    <td class="text-center">
                        <div class="d-flex align-items-center justify-content-center gap-2">
                            <span class="material-symbols-outlined ${
                              corPresenca === "bg-success"
                                ? "text-success"
                                : corPresenca === "bg-warning"
                                ? "text-warning"
                                : "text-danger"
                            }" style="font-size: 20px;">${iconePresenca}</span>
                            <span class="badge ${corPresenca}">${
        dadosPresenca.presente
      }/${dadosPresenca.total} (${percentualPresenca}%)</span>
                        </div>
                    </td>
                </tr>
            `;
    })
    .join("");

  // Cards de resumo
  const cardsResumo = `
        <div class="row mb-3">
            <div class="col-md-6">
                <div class="card bg-light border-0" style="border-radius: 8px;">
                    <div class="card-body text-center">
                        <span class="material-symbols-outlined" style="font-size: 32px; color: #0d6efd;">event</span>
                        <h3 class="mt-2">${todosOsAgendamentos.length}</h3>
                        <p class="text-muted mb-0">Total de Agendamentos</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card bg-light border-0" style="border-radius: 8px;">
                    <div class="card-body text-center">
                        <span class="material-symbols-outlined" style="font-size: 32px; color: #198754;">person</span>
                        <h3 class="mt-2">${totalAgendamentosComGestor}</h3>
                        <p class="text-muted mb-0">Total de Vagas Agendadas</p>
                    </div>
                </div>
            </div>
        </div>
    `;

  container.innerHTML = `
        <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
            <h5 class="mb-0">
                <span class="material-symbols-outlined me-2" style="vertical-align: middle;">group</span>
                Agendamentos com Voluntários por Gestor
            </h5>
        </div>
        ${cardsResumo}
        <div class="table-responsive">
            <table class="table table-hover table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Gestor</th>
                        <th class="text-center">Agendamentos</th>
                        <th class="text-center">Percentual</th>
                        <th class="text-center">Presença</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;
}

function renderizarProximaReuniao() {
  const agora = new Date();
  const proximas = todasAsAtas
    .filter((ata) => {
      const dataAta = new Date(ata.dataReuniao);
      return !isNaN(dataAta.getTime()) && dataAta > agora;
    })
    .sort((a, b) => new Date(a.dataReuniao) - new Date(b.dataReuniao));

  const proximaContainer = document.getElementById("proxima-reuniao-container");
  const infoEl = document.getElementById("proxima-reuniao-info");

  if (!proximaContainer || !infoEl) return;

  if (proximas.length === 0) {
    proximaContainer.style.display = "none";
    return;
  }

  proximaContainer.style.display = "block";
  const proxima = proximas[0];
  const dataProxima = new Date(proxima.dataReuniao);
  const diffMs = dataProxima - agora;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

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
        <p class="fw-bold text-primary">${tempoTexto}</p>
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
      )}&dates=${
        dataProxima.toISOString().replace(/[-:]/g, "").split(".")[0]
      }Z&location=${encodeURIComponent(proxima.local || "Online")}`;
      window.open(url, "_blank");
    };
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

export function cleanup() {
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeAgendamentos) unsubscribeAgendamentos();
  clearTimeout(timeoutBusca);
  console.log("[DASH] Cleanup.");
}
