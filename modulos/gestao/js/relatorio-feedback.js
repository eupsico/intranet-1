// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 4.2 - CORREÇÃO: Renderização correta por aba e sincronização com listeners

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// ==========================================
// ESTADO GLOBAL DO MÓDULO
// ==========================================
let dadosCache = {
  atas: [],
  profissionais: [],
  agendamentos: [],
  carregado: false,
};

let unsubscribeAtas = null;
let unsubscribeProf = null;
let unsubscribeAgend = null;

// ✅ NOVO: Debounce para renderização + Aba ativa atual
let renderTimeout = null;
let abaAtualAtiva = "resumo"; // Rastreia qual aba está ativa AGORA

const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
export function init() {
  console.log(
    "%c[RELATÓRIO] Init v4.2 - Correção de renderização por aba",
    "color:#00ff00; font-weight: bold;"
  );
  dadosCache = {
    atas: [],
    profissionais: [],
    agendamentos: [],
    carregado: false,
  };
  cleanup();
  setupEventListeners();
  exibirLoadingNaAbaAtiva();
  carregarDadosComListener();
}

// ==========================================
// LÓGICA DE DADOS (Listeners em tempo real)
// ==========================================
function carregarDadosComListener() {
  console.log("[RELATÓRIO] Configurando listeners em tempo real...");

  // Listener 1: Atas Técnicas
  const qAtas = query(
    collection(firestoreDb, "gestao_atas"),
    where("tipo", "==", "Reunião Técnica")
  );
  unsubscribeAtas = onSnapshot(
    qAtas,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT ATAS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );
      dadosCache.atas = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      marcarComoCarregado();
      renderizarComDebounce();
    },
    (error) => {
      console.error("%c[RELATÓRIO] ❌ ERRO atas:", "color:#ff0000;", error);
      mostrarErroGeral("Erro ao carregar atas. Verifique sua conexão.");
    }
  );

  // Listener 2: Profissionais
  const qProf = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
  unsubscribeProf = onSnapshot(
    qProf,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT PROFISSIONAIS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );
      dadosCache.profissionais = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      marcarComoCarregado();
      renderizarComDebounce();
    },
    (error) => {
      console.error(
        "%c[RELATÓRIO] ❌ ERRO profissionais:",
        "color:#ff0000;",
        error
      );
    }
  );

  // Listener 3: Agendamentos
  const qAgend = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgend = onSnapshot(
    qAgend,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT AGENDAMENTOS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );
      dadosCache.agendamentos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      marcarComoCarregado();
      renderizarComDebounce();
    },
    (error) => {
      console.error(
        "%c[RELATÓRIO] ❌ ERRO agendamentos:",
        "color:#ff0000;",
        error
      );
    }
  );
}

// ✅ CORRIGIDA: Debounce agora respeita qual aba está ativa
function renderizarComDebounce() {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }
  renderTimeout = setTimeout(() => {
    console.log(
      "%c[RELATÓRIO] ⏱️ Debounce concluído - Renderizando aba: " +
        abaAtualAtiva,
      "color:#ffaa00; font-weight: bold;"
    );
    renderizarAbaEspecifica(abaAtualAtiva);
  }, 100); // Aguarda 100ms sem atualizações antes de renderizar
}

function marcarComoCarregado() {
  if (dadosCache.profissionais.length > 0) {
    const antes = dadosCache.carregado;
    dadosCache.carregado = true;
    if (!antes) {
      console.log(
        "%c[RELATÓRIO] ✅ DADOS CARREGADOS!",
        "color:#00ff00; font-weight: bold; font-size: 14px;"
      );
      console.log("[RELATÓRIO] Cache:", {
        atas: dadosCache.atas.length,
        profissionais: dadosCache.profissionais.length,
        agendamentos: dadosCache.agendamentos.length,
      });
    }
  }
}

// ==========================================
// LÓGICA DE NAVEGAÇÃO E RENDERIZAÇÃO
// ==========================================
function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) {
    console.error("[RELATÓRIO] ❌ view-container não encontrado!");
    return;
  }

  viewContainer.addEventListener("click", (e) => {
    const tabLink = e.target.closest(".tab-link");
    if (tabLink) {
      e.preventDefault();
      const idAba = tabLink.dataset.tab;
      console.log(
        `%c[RELATÓRIO] 👆 Clique na aba: ${idAba}`,
        "color:#00aaff; font-weight: bold;"
      );
      ativarAba(idAba);
      return;
    }

    const accordionHeader = e.target.closest(".accordion-header");
    if (accordionHeader) {
      e.preventDefault();
      toggleAccordion(accordionHeader);
    }
  });

  viewContainer.addEventListener("change", (e) => {
    if (e.target.matches(".checkbox-presenca")) {
      marcarPresenca(e.target);
    }
  });
}

// ✅ CORRIGIDA: Agora marca qual aba está ativa
function ativarAba(tabId) {
  console.log(`[RELATÓRIO] >> ativarAba(${tabId})`);

  // ✅ CRÍTICO: Atualiza a aba ativa ANTES de renderizar
  abaAtualAtiva = tabId;

  document
    .querySelectorAll(".tab-link")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  const btn = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
  const content = document.getElementById(tabId);
  if (btn) btn.classList.add("active");
  if (content) content.classList.add("active");

  renderizarAbaEspecifica(tabId);
}

// ✅ NOVA: Renderiza apenas a aba solicitada (não a ativa)
function renderizarAbaEspecifica(tabId) {
  const content = document.getElementById(tabId);
  if (!content) {
    console.warn(`[RELATÓRIO] ⚠️ Aba ${tabId} não encontrada!`);
    return;
  }

  console.log(
    `%c[RELATÓRIO] 🎨 Renderizando aba específica: ${tabId}`,
    "color:#00ff00; font-weight: bold;"
  );

  if (!dadosCache.carregado) {
    console.log(
      `[RELATÓRIO] ⏳ Dados ainda não carregados. Mostrando loading...`
    );
    exibirLoadingNaAba(tabId);
    return;
  }

  const container = content.querySelector(".card");
  if (!container) {
    console.error(
      `%c[RELATÓRIO] ❌ Container .card não encontrado!`,
      "color:#ff0000; font-weight: bold;"
    );
    return;
  }

  switch (tabId) {
    case "resumo":
      renderizarResumo(container);
      break;
    case "participacao":
      renderizarParticipacao(container);
      break;
    case "feedbacks":
      renderizarFeedbacks(container);
      break;
    case "agendados":
      renderizarAgendados(container);
      break;
  }

  console.log(
    "%c[RELATÓRIO] ✅ Renderização concluída!",
    "color:#00ff00; font-weight: bold;"
  );
}

// ✅ ANTIGA renderizarAbaAtiva REMOVIDA - estava causando o problema!
// Agora usamos renderizarAbaEspecifica que sabe qual aba renderizar

function exibirLoadingNaAbaAtiva() {
  const abaAtiva = document.querySelector(".tab-content.active");
  if (abaAtiva) {
    exibirLoadingNaAba(abaAtiva.id);
  }
}

// ✅ NOVA: Exibe loading em uma aba específica
function exibirLoadingNaAba(tabId) {
  const content = document.getElementById(tabId);
  if (content) {
    const container = content.querySelector(".card");
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner"></div>
            <p>Carregando dados...</p>
        </div>
      `;
    }
  }
}

// ==========================================
// FUNÇÕES DE DESENHO (VIEW)
// ==========================================

function renderizarResumo(container) {
  console.log("[RELATÓRIO] >>> renderizarResumo() <<<");
  const { atas, profissionais } = dadosCache;

  const atasOrdenadas = [...atas].sort(
    (a, b) =>
      new Date(formatarData(b.dataReuniao)) -
      new Date(formatarData(a.dataReuniao))
  );
  const reunioesRecentes = atasOrdenadas.slice(0, 5);

  const satisfacaoMedia =
    atas.length > 0
      ? (
          atas.reduce((sum, ata) => {
            const feedbacks = ata.feedbacks || [];
            const mediaAta =
              feedbacks.reduce((s, fb) => s + (fb.clareza ? 1 : 0), 0) /
              (feedbacks.length || 1);
            return sum + mediaAta;
          }, 0) / atas.length
        ).toFixed(1)
      : "N/A";

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">analytics</span> Resumo Geral</h3>
    </div>
    <div class="card-body">
        <div class="stats-grid">
            <div class="stat-card">
                <span class="material-symbols-outlined">event</span>
                <h4>${atas.length}</h4>
                <p>Total de Reuniões</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">group</span>
                <h4>${profissionais.length}</h4>
                <p>Profissionais</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">thumb_up</span>
                <h4>${satisfacaoMedia}</h4>
                <p>Satisfação Média</p>
            </div>
        </div>

        <div class="mt-3">
            <h5>Últimas 5 Reuniões</h5>
            <div class="table-container">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Reunião</th>
                            <th>Data</th>
                            <th>Participantes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reunioesRecentes
                          .map(
                            (ata) => `
                        <tr>
                            <td>${ata.titulo || "Reunião Técnica"}</td>
                            <td>${formatarData(ata.dataReuniao)}</td>
                            <td>${contarParticipantes(ata.participantes)}</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  `;
}

function renderizarParticipacao(container) {
  console.log("[RELATÓRIO] >>> renderizarParticipacao() <<<");
  const { atas, profissionais } = dadosCache;

  const stats = calcularEstatisticasParticipacao(atas, profissionais);

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">group</span> Resumo de Participação</h3>
    </div>
    <div class="card-body">
        <div class="stats-grid">
            <div class="stat-card success">
                <span class="material-symbols-outlined">check_circle</span>
                <h4>${stats.totalPresencas}</h4>
                <p>Total Presenças</p>
            </div>
            <div class="stat-card warning">
                <span class="material-symbols-outlined">warning</span>
                <h4>${stats.totalAusencias}</h4>
                <p>Total Ausências</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">leaderboard</span>
                <h4>${stats.taxaMedia}%</h4>
                <p>Taxa Média Global</p>
            </div>
        </div>
        <div class="table-container mt-3">
             <div class="d-flex justify-content-between align-items-center mb-2">
                <h5>Ranking de Presença (Top 10)</h5>
                <button class="btn btn-primary btn-sm" onclick="exportarRelatorioParticipacao()">Exportar CSV</button>
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Profissional</th>
                        <th>Presenças</th>
                        <th>Ausências</th>
                        <th>Taxa (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.profissionalStats
                      .slice(0, 10)
                      .map(
                        (p) => `
                    <tr>
                        <td>${p.nome}</td>
                        <td>${p.presencas}</td>
                        <td>${p.ausencias}</td>
                        <td><strong>${p.taxa.toFixed(1)}%</strong></td>
                    </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    </div>
  `;
}

function renderizarFeedbacks(container) {
  console.log("[RELATÓRIO] >>> renderizarFeedbacks() <<<");
  const { atas } = dadosCache;

  const atasComFeedback = atas
    .filter((a) => a.feedbacks && a.feedbacks.length > 0)
    .sort(
      (a, b) =>
        new Date(formatarData(b.dataReuniao)) -
        new Date(formatarData(a.dataReuniao))
    );

  if (atasComFeedback.length === 0) {
    container.innerHTML =
      '<div class="card-body"><div class="alert alert-info">Nenhum feedback registrado até o momento.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">feedback</span> Feedbacks Detalhados</h3>
    </div>
    <div class="card-body">
        <div class="accordion">
            ${atasComFeedback
              .map(
                (ata) => `
            <div class="accordion-item">
                <button class="accordion-header" type="button">
                    <span class="material-symbols-outlined">event</span>
                    ${ata.titulo || "Reunião"} - ${formatarData(
                  ata.dataReuniao
                )}
                    <span class="badge ms-2">${ata.feedbacks.length}</span>
                    <span class="accordion-icon">+</span>
                </button>
                <div class="accordion-content">
                    ${ata.feedbacks
                      .map(
                        (fb) => `
                    <div class="feedback-card">
                        <div class="feedback-respostas">
                            ${
                              fb.clareza !== undefined
                                ? `<p><strong>Clareza:</strong> ${
                                    fb.clareza ? "✓" : "✗"
                                  }</p>`
                                : ""
                            }
                            ${
                              fb.objetivos !== undefined
                                ? `<p><strong>Objetivos:</strong> ${
                                    fb.objetivos ? "✓" : "✗"
                                  }</p>`
                                : ""
                            }
                            ${
                              fb.duracao !== undefined
                                ? `<p><strong>Duração:</strong> ${
                                    fb.duracao ? "✓" : "✗"
                                  }</p>`
                                : ""
                            }
                            ${
                              fb.sugestaoTema
                                ? `<p><em>"${fb.sugestaoTema}"</em></p>`
                                : ""
                            }
                        </div>
                    </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
            `
              )
              .join("")}
        </div>
    </div>
  `;
}

function renderizarAgendados(container) {
  console.log("[RELATÓRIO] >>> renderizarAgendados() <<<");
  const { agendamentos } = dadosCache;

  if (!agendamentos || agendamentos.length === 0) {
    container.innerHTML =
      '<div class="card-body"><div class="alert alert-info">Nenhum agendamento encontrado.</div></div>';
    return;
  }

  const listaAgendamentos = agendamentos.map((ag) => {
    const totalInscritos = (ag.slots || []).reduce(
      (acc, slot) => acc + (slot.vagas ? slot.vagas.length : 0),
      0
    );
    return { ...ag, totalInscritos };
  });

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">event_available</span> Lista de Agendamentos</h3>
    </div>
    <div class="card-body">
        <div class="accordion">
            ${listaAgendamentos
              .map(
                (ag) => `
            <div class="accordion-item">
                <button class="accordion-header" type="button">
                    <span class="material-symbols-outlined">schedule</span>
                    ${ag.tipo || "Agendamento"}
                    <small class="text-muted ms-2">Criado em ${formatarData(
                      ag.criadoEm
                    )}</small>
                    <span class="badge ms-auto">${
                      ag.totalInscritos
                    } inscritos</span>
                    <span class="accordion-icon">+</span>
                </button>
                <div class="accordion-content">
                    ${(ag.slots || [])
                      .map(
                        (slot, idx) => `
                    <div class="feedback-card">
                        <p><strong>Slot ${idx + 1}:</strong> ${slot.data} às ${
                          slot.hora
                        }</p>
                        <p><strong>Vagas:</strong> ${
                          (slot.vagas || []).length
                        }</p>
                    </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
            `
              )
              .join("")}
        </div>
    </div>
  `;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function toggleAccordion(header) {
  const item = header.closest(".accordion-item");
  if (!item) return;

  // Fecha outros itens da mesma seção (opcional)
  const items = header
    .closest(".accordion")
    .querySelectorAll(".accordion-item");
  items.forEach((i) => {
    if (i !== item) {
      i.classList.remove("active");
    }
  });

  item.classList.toggle("active");
}

function formatarData(data) {
  if (!data) return "N/A";
  if (typeof data === "object" && data.toDate) {
    data = data.toDate();
  }
  if (typeof data === "string") {
    data = new Date(data);
  }
  return data.toLocaleDateString("pt-BR");
}

function contarParticipantes(participantes) {
  return participantes ? Object.keys(participantes).length : 0;
}

function calcularEstatisticasParticipacao(atas, profissionais) {
  let totalPresencas = 0;
  let totalAusencias = 0;
  const profMap = {};

  profissionais.forEach((p) => {
    profMap[p.id] = {
      nome: p.nome,
      presencas: 0,
      ausencias: 0,
    };
  });

  atas.forEach((ata) => {
    if (ata.participantes) {
      Object.entries(ata.participantes).forEach(([profId, status]) => {
        if (profMap[profId]) {
          if (status === "presente") {
            profMap[profId].presencas++;
            totalPresencas++;
          } else if (status === "ausente") {
            profMap[profId].ausencias++;
            totalAusencias++;
          }
        }
      });
    }
  });

  const profissionalStats = Object.values(profMap)
    .map((p) => ({
      ...p,
      taxa:
        p.presencas + p.ausencias > 0
          ? (p.presencas / (p.presencas + p.ausencias)) * 100
          : 0,
    }))
    .sort((a, b) => b.taxa - a.taxa);

  const taxaMedia =
    totalPresencas + totalAusencias > 0
      ? ((totalPresencas / (totalPresencas + totalAusencias)) * 100).toFixed(1)
      : 0;

  return {
    totalPresencas,
    totalAusencias,
    taxaMedia,
    profissionalStats,
  };
}

function marcarPresenca(checkbox) {
  console.log("[RELATÓRIO] Atualizando presença...");
  // Implementação da marcação de presença
}

function mostrarErroGeral(mensagem) {
  console.error("[RELATÓRIO] ERRO:", mensagem);
  // Implementação de mostrar erro ao usuário
}

function exportarRelatorioParticipacao() {
  console.log("[RELATÓRIO] Exportando participação como CSV...");
  // Implementação de exportação
}

function cleanup() {
  console.log("[RELATÓRIO] Desinscrever listeners...");
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeProf) unsubscribeProf();
  if (unsubscribeAgend) unsubscribeAgend();

  // ✅ Limpa timeout pendente
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }

  console.log("[RELATÓRIO] Listeners desinscritos.");
}
