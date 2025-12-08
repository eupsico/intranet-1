// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 6.0 (Unificado Eventos + KPIs Avançados)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todosEventos = [];
let unsubscribeEventos = null;
let timeoutBusca = null;

export function init() {
  console.log("[DASH] Dashboard iniciado (v6.0 - KPIs Avançados).");
  configurarEventListeners();
  carregarDados();
}

function configurarEventListeners() {
  // Alternância de Abas
  document.body.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link") || e.target.closest(".tab-link")) {
      e.preventDefault();
      const btn = e.target.matches(".tab-link")
        ? e.target
        : e.target.closest(".tab-link");
      const abaId = btn.dataset.tab;
      alternarAba(abaId);
    }

    // Botão Link Feedback
    if (e.target.closest(".btn-link-feedback")) {
      e.stopPropagation();
      const btn = e.target.closest(".btn-link-feedback");
      const id = btn.dataset.id;
      // O ID já vem composto (DocId_SlotIndex) da lista normalizada
      const link = `${window.location.origin}/modulos/gestao/page/feedback.html#${id}`;
      navigator.clipboard
        .writeText(link)
        .then(() => alert("Link de feedback copiado!"))
        .catch((err) => prompt("Copie o link manualmente:", link));
    }
  });

  // Filtros
  const filtros = ["tipo-filtro", "filtro-data-inicio", "filtro-data-fim"];
  filtros.forEach((id) =>
    document
      .getElementById(id)
      ?.addEventListener("change", aplicarFiltrosEExibir)
  );

  document.getElementById("busca-titulo")?.addEventListener("input", () => {
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(aplicarFiltrosEExibir, 300);
  });

  document.getElementById("limpar-filtros")?.addEventListener("click", () => {
    document.getElementById("tipo-filtro").value = "Todos";
    document.getElementById("busca-titulo").value = "";
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";
    aplicarFiltrosEExibir();
  });
}

function alternarAba(abaId) {
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
  // Busca na coleção unificada 'eventos'
  const q = query(
    collection(firestoreDb, "eventos"),
    orderBy("criadoEm", "desc")
  );

  unsubscribeEventos = onSnapshot(q, (snapshot) => {
    todosEventos = [];

    snapshot.forEach((docSnap) => {
      const dados = docSnap.data();
      const slots = dados.slots || [];

      // NORMALIZAÇÃO DE DADOS
      // Se tem slots (Eventos novos/múltiplos)
      if (slots.length > 0) {
        slots.forEach((slot, idx) => {
          todosEventos.push({
            id: docSnap.id, // ID do Documento
            uniqueId: `${docSnap.id}_${idx}`, // ID Composto para Feedback
            tipo: dados.tipo,
            titulo: dados.tipo,
            dataOrdenacao: new Date(slot.data + "T" + slot.horaInicio + ":00"),
            hora: slot.horaInicio,
            local: "Online",
            gestor: slot.gestorNome || "N/A",
            participantes: normalizarParticipantes(slot.vagas, true), // true = vem de objeto vagas
            status: slot.status || "Agendada",
            resumo: dados.descricao,

            // Dados para KPIs
            planoDeAcao: slot.planoDeAcao || [],
            encaminhamentos: slot.encaminhamentos || [],
            feedbacks: slot.feedbacks || [],
            vagas: slot.vagas || [], // Array de inscritos
            vagasLimitadas: dados.vagasLimitadas, // Bool
          });
        });
      }
      // Se é evento raiz (Legado ou Simples)
      else {
        const dataReuniao = dados.dataReuniao
          ? new Date(dados.dataReuniao + "T00:00:00")
          : new Date();
        todosEventos.push({
          id: docSnap.id,
          uniqueId: `${docSnap.id}_-1`,
          tipo: dados.tipo || "Reunião",
          titulo: dados.pauta || dados.tipo || "Reunião",
          dataOrdenacao: dataReuniao,
          hora: "00:00",
          local: "Geral",
          gestor: dados.responsavel || "N/A",
          participantes: normalizarParticipantes(dados.participantes, false),
          status: dados.status || "Concluída",

          // Dados para KPIs
          planoDeAcao: dados.planoDeAcao || [],
          encaminhamentos: dados.encaminhamentos || [],
          feedbacks: dados.feedbacks || [],
          vagas: [], // Legado geralmente não tem controle de vagas estrito
          vagasLimitadas: false,
        });
      }
    });

    aplicarFiltrosEExibir();
    calcularERenderizarKPIs(); // Nova função de gráficos avançados
  });
}

function normalizarParticipantes(input, isVagasObj) {
  if (!input) return [];
  if (isVagasObj) {
    return input.map((v) => v.nome || v.profissionalNome || "Anônimo");
  }
  // String ou Array de Strings
  if (Array.isArray(input)) return input;
  if (typeof input === "string") {
    return input
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
  }
  return [];
}

function aplicarFiltrosEExibir() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";
  const dataInicioVal = document.getElementById("filtro-data-inicio")?.value;
  const dataFimVal = document.getElementById("filtro-data-fim")?.value;

  let itensFiltrados = todosEventos.filter((item) => {
    const matchTipo = tipoFiltro === "Todos" || item.tipo === tipoFiltro;
    const matchBusca =
      !buscaTermo ||
      item.titulo.toLowerCase().includes(buscaTermo) ||
      item.gestor.toLowerCase().includes(buscaTermo);
    return matchTipo && matchBusca;
  });

  // Filtro de Data
  if (dataInicioVal || dataFimVal) {
    const dIni = dataInicioVal
      ? new Date(dataInicioVal)
      : new Date("2000-01-01");
    const dFim = dataFimVal ? new Date(dataFimVal) : new Date("2100-01-01");
    dFim.setHours(23, 59, 59);
    itensFiltrados = itensFiltrados.filter(
      (item) => item.dataOrdenacao >= dIni && item.dataOrdenacao <= dFim
    );
  }

  // Ordenação
  itensFiltrados.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

  renderizarLista(itensFiltrados);
  atualizarCardProximaReuniao(itensFiltrados);
}

function renderizarLista(lista) {
  const container = document.getElementById("atas-container");
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = `<div class="alert alert-info text-center">Nenhuma reunião encontrada.</div>`;
    document.getElementById("contador-atas").textContent = "0";
    return;
  }

  document.getElementById("contador-atas").textContent = lista.length;

  container.innerHTML = lista
    .map((item) => {
      const isFutura = item.dataOrdenacao > new Date();
      const corIcone = isFutura
        ? "#0dcaf0"
        : item.status === "Concluída"
        ? "#198754"
        : "#ffc107";
      const icone = item.status === "Concluída" ? "task_alt" : "event";
      const qtdParticipantes = item.participantes.length;

      return `
            <div class="ata-item card mb-3" style="border-left: 5px solid ${corIcone};">
                <div class="card-header bg-white d-flex justify-content-between align-items-center p-3" 
                     onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
                     style="cursor: pointer;">
                    
                    <div class="d-flex align-items-center flex-grow-1">
                        <span class="material-symbols-outlined me-3" style="font-size: 28px; color: ${corIcone};">${icone}</span>
                        <div>
                            <h5 class="mb-0" style="font-size: 1rem; font-weight: 600;">${
                              item.titulo
                            }</h5>
                            <small class="text-muted">
                                ${item.dataOrdenacao.toLocaleDateString(
                                  "pt-BR"
                                )} às ${item.hora} • ${item.gestor}
                            </small>
                        </div>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                         <span class="badge bg-light text-dark border">${qtdParticipantes} part.</span>
                         <button class="btn btn-sm btn-outline-success btn-link-feedback" data-id="${
                           item.uniqueId
                         }" title="Link de Feedback">
                            <span class="material-symbols-outlined" style="font-size: 18px;">share</span>
                        </button>
                    </div>
                </div>
                
                <div class="ata-conteudo card-body bg-light" style="display: none; border-top: 1px solid #eee;">
                    <p class="mb-1"><strong>Status:</strong> ${item.status}</p>
                    <p class="mb-2"><strong>Participantes:</strong> ${
                      item.participantes.join(", ") || "Nenhum registrado"
                    }</p>
                    ${
                      item.resumo
                        ? `<p class="small text-muted mb-0"><em>"${item.resumo}"</em></p>`
                        : ""
                    }
                </div>
            </div>`;
    })
    .join("");
}

function atualizarCardProximaReuniao(lista) {
  const agora = new Date();
  const proximas = lista
    .filter((i) => i.dataOrdenacao > agora)
    .sort((a, b) => a.dataOrdenacao - b.dataOrdenacao);

  const card = document.getElementById("proxima-reuniao-container");
  const info = document.getElementById("proxima-reuniao-info");

  if (proximas.length === 0) {
    if (card) card.style.display = "none";
    return;
  }

  if (card) card.style.display = "block";
  const prox = proximas[0];
  const diffDias = Math.ceil(
    (prox.dataOrdenacao - agora) / (1000 * 60 * 60 * 24)
  );

  if (info) {
    info.innerHTML = `
            <h5 class="text-white mb-1">${prox.titulo}</h5>
            <div class="d-flex align-items-center gap-2 text-white-50 mb-2">
                <span class="material-symbols-outlined" style="font-size: 16px;">calendar_month</span>
                ${prox.dataOrdenacao.toLocaleDateString()} às ${prox.hora}
            </div>
            <span class="badge bg-warning text-dark">Em ${diffDias} dias</span>
        `;
  }
}

// ============================================================================
// LÓGICA DE KPIS E GRÁFICOS AVANÇADOS
// ============================================================================

function calcularERenderizarKPIs() {
  // 1. Termômetro de Eficiência (Tarefas)
  let tarefasTotal = 0;
  let tarefasConcluidas = 0;
  let tarefasAtrasadas = 0;
  let tarefasAFazer = 0;

  // 2. NPS (Feedback)
  let totalNpsScore = 0;
  let totalNpsCount = 0;

  // 3. Ocupação (Mês Atual)
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  let vagasOfertadas = 0;
  let vagasPreenchidas = 0;

  // 4. Ranking Assiduidade
  const contagemParticipantes = {};

  todosEventos.forEach((ev) => {
    // A. Processar Tarefas (Plano de Ação + Encaminhamentos)
    const tarefasEvento = [...ev.planoDeAcao, ...ev.encaminhamentos];
    tarefasEvento.forEach((t) => {
      tarefasTotal++;
      if (t.status === "Concluído") tarefasConcluidas++;
      else if (t.status === "Atrasado") tarefasAtrasadas++;
      else tarefasAFazer++;
    });

    // B. Processar NPS (Feedbacks)
    ev.feedbacks.forEach((fb) => {
      // Clareza (Sim=100, Parc=50, Não=0)
      let scoreClareza = 0;
      if (fb.clareza === "Sim") scoreClareza = 100;
      else if (fb.clareza === "Parcialmente") scoreClareza = 50;

      // Objetivos (Sim=100, Não=0)
      let scoreObjetivos = 0;
      if (fb.objetivos === "Sim") scoreObjetivos = 100;

      // Média simples do feedback
      const mediaFb = (scoreClareza + scoreObjetivos) / 2;
      totalNpsScore += mediaFb;
      totalNpsCount++;
    });

    // C. Ocupação (Só Mês Atual)
    if (
      ev.dataOrdenacao.getMonth() === mesAtual &&
      ev.dataOrdenacao.getFullYear() === anoAtual
    ) {
      // Se vagas limitadas (Voluntário 1:1), Ofertada = 1. Senão, indefinido (assumimos Ocupação = Inscritos para não distorcer)
      const inscritos = ev.vagas.length;
      if (ev.vagasLimitadas) {
        vagasOfertadas += 1; // 1 Slot = 1 Vaga
        vagasPreenchidas += inscritos > 0 ? 1 : 0;
      } else {
        // Reunião Técnica (Ilimitada): não conta para % de ocupação para não distorcer,
        // ou conta Ofertada = Inscritos
        // Decisão: Contar apenas eventos limitados para métrica de ocupação real.
      }
    }

    // D. Ranking
    ev.participantes.forEach((nome) => {
      if (nome && nome !== "Anônimo") {
        contagemParticipantes[nome] = (contagemParticipantes[nome] || 0) + 1;
      }
    });
  });

  // RENDERIZAÇÃO
  renderizarGraficosHTML({
    tarefas: {
      total: tarefasTotal,
      concluidas: tarefasConcluidas,
      atrasadas: tarefasAtrasadas,
      aFazer: tarefasAFazer,
    },
    nps: totalNpsCount > 0 ? Math.round(totalNpsScore / totalNpsCount) : 0,
    ocupacao: { ofertadas: vagasOfertadas, preenchidas: vagasPreenchidas },
    ranking: Object.entries(contagemParticipantes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  });
}

function renderizarGraficosHTML(kpis) {
  const container = document.getElementById("graficos-tab");
  if (!container) return;

  // Calcula porcentagens para gráfico de rosca (Tarefas)
  const pConcluido =
    kpis.tarefas.total > 0
      ? (kpis.tarefas.concluidas / kpis.tarefas.total) * 100
      : 0;
  const pAtrasado =
    kpis.tarefas.total > 0
      ? (kpis.tarefas.atrasadas / kpis.tarefas.total) * 100
      : 0;
  const pAFazer =
    kpis.tarefas.total > 0
      ? (kpis.tarefas.aFazer / kpis.tarefas.total) * 100
      : 0;

  // Calcula Ocupação
  const percOcupacao =
    kpis.ocupacao.ofertadas > 0
      ? Math.round((kpis.ocupacao.preenchidas / kpis.ocupacao.ofertadas) * 100)
      : 0;

  // HTML DOS CARDS
  container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-md-3">
                <div class="card h-100 text-center p-3 shadow-sm border-0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <h6 class="mb-2 opacity-75">Satisfação (NPS Interno)</h6>
                    <h1 class="display-4 fw-bold mb-0">${kpis.nps}</h1>
                    <div class="mb-2">
                        ${renderizarEstrelas(kpis.nps)}
                    </div>
                    <small>Média baseada em feedbacks</small>
                </div>
            </div>

            <div class="col-md-3">
                <div class="card h-100 p-3 shadow-sm border-0">
                    <h6 class="text-muted mb-3">Ocupação (Voluntários)</h6>
                    <div class="d-flex justify-content-between align-items-end mb-2">
                        <h2 class="mb-0 text-primary">${percOcupacao}%</h2>
                        <small class="text-muted">${
                          kpis.ocupacao.preenchidas
                        }/${kpis.ocupacao.ofertadas} vagas</small>
                    </div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${percOcupacao}%"></div>
                    </div>
                    <small class="text-muted mt-2 d-block">Referente ao mês atual</small>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card h-100 p-3 shadow-sm border-0">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="text-muted mb-0">Eficiência (Tarefas)</h6>
                        <span class="badge bg-light text-dark border">Total: ${
                          kpis.tarefas.total
                        }</span>
                    </div>
                    <div class="d-flex align-items-center justify-content-around mt-3">
                        <div style="
                            width: 100px; height: 100px; border-radius: 50%;
                            background: conic-gradient(
                                #198754 0% ${pConcluido}%, 
                                #dc3545 ${pConcluido}% ${
    pConcluido + pAtrasado
  }%, 
                                #ffc107 ${pConcluido + pAtrasado}% 100%
                            );
                            position: relative;">
                            <div style="position: absolute; inset: 20px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <strong>${Math.round(pConcluido)}%</strong>
                            </div>
                        </div>
                        
                        <div style="font-size: 0.9em;">
                            <div class="mb-1"><span style="display:inline-block;width:10px;height:10px;background:#198754;border-radius:50%;margin-right:5px;"></span> Concluídas (${
                              kpis.tarefas.concluidas
                            })</div>
                            <div class="mb-1"><span style="display:inline-block;width:10px;height:10px;background:#dc3545;border-radius:50%;margin-right:5px;"></span> Atrasadas (${
                              kpis.tarefas.atrasadas
                            })</div>
                            <div><span style="display:inline-block;width:10px;height:10px;background:#ffc107;border-radius:50%;margin-right:5px;"></span> A Fazer (${
                              kpis.tarefas.aFazer
                            })</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-md-6">
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-transparent border-0">
                        <h6 class="mb-0 fw-bold text-primary"><span class="material-symbols-outlined" style="vertical-align: middle;">military_tech</span> Top Participantes</h6>
                    </div>
                    <div class="card-body p-0">
                        <ul class="list-group list-group-flush">
                            ${
                              kpis.ranking
                                .map(
                                  (r, index) => `
                                <li class="list-group-item d-flex justify-content-between align-items-center px-4">
                                    <span>
                                        <span class="badge ${
                                          index === 0
                                            ? "bg-warning text-dark"
                                            : "bg-light text-dark"
                                        } me-2 rounded-pill">${
                                    index + 1
                                  }º</span>
                                        ${r[0]}
                                    </span>
                                    <span class="fw-bold text-muted">${
                                      r[1]
                                    } reuniões</span>
                                </li>
                            `
                                )
                                .join("") ||
                              '<li class="list-group-item text-center text-muted">Sem dados suficientes</li>'
                            }
                        </ul>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                 <div class="card shadow-sm border-0">
                    <div class="card-header bg-transparent border-0">
                        <h6 class="mb-0 fw-bold">Tipos de Reunião</h6>
                    </div>
                    <div class="card-body" id="grafico-tipos-container">
                        ${renderizarGraficoTipos(todosEventos)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderizarEstrelas(score) {
  // Score 0-100 -> 0-5 Estrelas
  const estrelas = Math.round(score / 20);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= estrelas)
      html +=
        '<span class="material-symbols-outlined" style="color: #ffc107; font-variation-settings: \'FILL\' 1;">star</span>';
    else
      html +=
        '<span class="material-symbols-outlined" style="color: rgba(255,255,255,0.5);">star</span>';
  }
  return html;
}

function renderizarGraficoTipos(lista) {
  const tipos = {};
  lista.forEach((e) => (tipos[e.tipo] = (tipos[e.tipo] || 0) + 1));
  const total = lista.length;

  if (total === 0) return '<p class="text-center text-muted">Sem dados</p>';

  return Object.entries(tipos)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, qtd]) => {
      const perc = Math.round((qtd / total) * 100);
      return `
                <div class="mb-2">
                    <div class="d-flex justify-content-between small mb-1">
                        <span>${tipo}</span>
                        <span>${qtd}</span>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-secondary" style="width: ${perc}%"></div>
                    </div>
                </div>`;
    })
    .join("");
}

export function cleanup() {
  if (unsubscribeEventos) unsubscribeEventos();
  clearTimeout(timeoutBusca);
}
