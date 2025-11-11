// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.0 (Com aba de Participação, event delegation e otimizações Firestore)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let todosOsProfissionais = [];
const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

export async function init() {
  console.log("[RELATÓRIO] Módulo de Relatórios iniciado (v2.0).");
  setupEventListeners();
  await carregarRelatorios();
}

async function carregarRelatorios() {
  try {
    const [atasSnapshot, profissionaisSnapshot] = await Promise.all([
      getDocs(
        query(
          collection(firestoreDb, "gestao_atas"),
          where("tipo", "==", "Reunião Técnica")
        )
      ),
      getDocs(query(collection(firestoreDb, "usuarios"), orderBy("nome"))),
    ]);

    todasAsAtas = atasSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    todosOsProfissionais = profissionaisSnapshot.docs.map(
      (doc) => doc.data().nome
    );

    // Renderiza a aba ativa por padrão (resumo geral)
    renderizarResumo(todasAsAtas, todosOsProfissionais);
    renderizarParticipacao(todasAsAtas, todosOsProfissionais);
    renderizarFeedbacks(todasAsAtas, todosOsProfissionais);

    console.log(
      `[RELATÓRIO] Carregados ${todasAsAtas.length} atas e ${todosOsProfissionais.length} profissionais.`
    );
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao carregar relatórios:", error);
    mostrarErro("Erro ao carregar dados do Firestore. Verifique a conexão.");
  }
}

function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  // Event delegation centralizado para tabs (corrige cliques intermitentes)
  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      trocarAba(targetTab);
      console.log(`[RELATÓRIO] Tab trocada para: ${targetTab}`);
    }
  });

  // Fallback para touch events em mobile (melhora responsividade)
  viewContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.matches(".tab-link")) {
        e.preventDefault(); // Evita zoom indesejado
      }
    },
    { passive: false }
  );
}

function trocarAba(tabId) {
  // Remove active de todas as tabs e conteúdos
  document
    .querySelectorAll(".tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  // Ativa a aba selecionada
  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeContent) activeContent.classList.add("active");

  // Scroll suave para o topo da aba
  activeContent.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Renderização da aba "Resumo Geral" (estatísticas totais)
function renderizarResumo(atas, profissionais) {
  const container = document.getElementById("resumo-container");
  if (!container) return;

  container.innerHTML = `
        <div class="card-header">
            <h3>Resumo Geral das Reuniões</h3>
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
                    <p>Profissionais Cadastrados</p>
                </div>
                <div class="stat-card">
                    <span class="material-symbols-outlined">thumb_up</span>
                    <h4>${calcularMediaFeedbacks(atas)}</h4>
                    <p>Média de Satisfação (%)</p>
                </div>
            </div>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Reunião Mais Recente</th>
                            <th>Data</th>
                            <th>Participantes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${atas
                          .slice(0, 5)
                          .map(
                            (ata) => `
                            <tr>
                                <td>${ata.titulo || "Reunião Técnica"}</td>
                                <td>${new Date(
                                  ata.dataReuniao?.toDate()
                                ).toLocaleDateString("pt-BR")}</td>
                                <td>${ata.participantes?.length || 0}</td>
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

// Nova função para aba "Resumo de Participação" (estatísticas de presença)
function renderizarParticipacao(atas, profissionais) {
  const container = document.getElementById("participacao-container");
  if (!container) return;

  const participacoes = calcularParticipacoes(atas, profissionais);
  const taxaMedia = (
    (participacoes.totalPresencas / (atas.length * profissionais.length)) *
    100
  ).toFixed(1);

  container.innerHTML = `
        <div class="card-header">
            <h3>Resumo de Participação</h3>
            <p>Taxa média de comparecimento: ${taxaMedia}%</p>
        </div>
        <div class="card-body">
            <div class="stats-grid">
                <div class="stat-card success">
                    <span class="material-symbols-outlined">check_circle</span>
                    <h4>${participacoes.totalPresencas}</h4>
                    <p>Total de Presenças</p>
                </div>
                <div class="stat-card warning">
                    <span class="material-symbols-outlined">warning</span>
                    <h4>${participacoes.totalAusencias}</h4>
                    <p>Total de Ausências</p>
                </div>
                <div class="stat-card">
                    <span class="material-symbols-outlined">leaderboard</span>
                    <h4>${participacoes.topParticipantes.length}</h4>
                    <p>Top Participantes (>80%)</p>
                </div>
            </div>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Profissional</th>
                            <th>Presenças</th>
                            <th>Ausências</th>
                            <th>Taxa (%)</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${participacoes.topParticipantes
                          .map(
                            (prof) => `
                            <tr>
                                <td>${prof.nome}</td>
                                <td>${prof.presencas}</td>
                                <td>${prof.ausencias}</td>
                                <td>${prof.taxa.toFixed(1)}%</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="exportarParticipante('${
                                      prof.nome
                                    }')">Exportar</button>
                                </td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
                ${
                  participacoes.totalPresencas > 0
                    ? `
                    <button class="btn btn-primary mt-2" onclick="exportarRelatorioParticipacao()">Exportar CSV Completo</button>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

// Renderização da aba "Feedbacks por Reunião" (mantida com otimizações)
function renderizarFeedbacks(atas, profissionais) {
  const container = document.getElementById("feedback-container");
  if (!container) return;

  if (atas.length === 0) {
    container.innerHTML =
      '<p class="alert alert-info">Nenhuma ata com feedbacks encontrada.</p>';
    return;
  }

  container.innerHTML = `
        <div class="card-header">
            <h3>Feedbacks por Reunião</h3>
        </div>
        <div class="card-body">
            <div class="accordion">
                ${atas
                  .filter((ata) => ata.feedbacks && ata.feedbacks.length > 0)
                  .map(
                    (ata) => `
                        <div class="accordion-item">
                            <button class="accordion-header" data-ata-id="${
                              ata.id
                            }">
                                <span class="material-symbols-outlined">event</span>
                                ${ata.titulo || "Reunião"} - ${new Date(
                      ata.dataReuniao?.toDate()
                    ).toLocaleDateString("pt-BR")}
                                <span class="accordion-icon">+</span>
                            </button>
                            <div class="accordion-content">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Profissional</th>
                                            ${Object.keys(perguntasTexto)
                                              .map(
                                                (q) =>
                                                  `<th>${perguntasTexto[q]}</th>`
                                              )
                                              .join("")}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${ata.feedbacks
                                          .map(
                                            (fb) => `
                                            <tr>
                                                <td>${fb.profissional}</td>
                                                ${Object.keys(perguntasTexto)
                                                  .map(
                                                    (q) =>
                                                      `<td>${
                                                        fb[q] || "N/R"
                                                      }</td>`
                                                  )
                                                  .join("")}
                                            </tr>
                                        `
                                          )
                                          .join("")}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `
                  )
                  .join("")}
            </div>
        </div>
    `;

  // Event listeners para accordions (delegated)
  const accordionHeaders = container.querySelectorAll(".accordion-header");
  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector(".accordion-icon");
      content.classList.toggle("active");
      icon.textContent = content.classList.contains("active") ? "−" : "+";
    });
  });
}

// Funções auxiliares para cálculos
function calcularMediaFeedbacks(atas) {
  let totalFeedbacks = 0;
  let totalAvaliacoes = 0;
  atas.forEach((ata) => {
    if (ata.feedbacks) {
      ata.feedbacks.forEach((fb) => {
        const nota =
          (fb.clareza === "Sim" ? 1 : 0) +
          (fb.objetivos === "Sim" ? 1 : 0) +
          (fb.duracao === "Sim" ? 1 : 0);
        totalAvaliacoes += 3;
        totalFeedbacks += nota;
      });
    }
  });
  return totalAvaliacoes > 0
    ? Math.round((totalFeedbacks / totalAvaliacoes) * 100)
    : 0;
}

function calcularParticipacoes(atas, profissionais) {
  const participacoes = {};
  profissionais.forEach((prof) => {
    participacoes[prof] = { presencas: 0, ausencias: 0, totalReunioes: 0 };
  });

  atas.forEach((ata) => {
    const presentes = ata.participantes || [];
    profissionais.forEach((prof) => {
      participacoes[prof].totalReunioes++;
      if (presentes.includes(prof)) {
        participacoes[prof].presencas++;
      } else {
        participacoes[prof].ausencias++;
      }
    });
  });

  const topParticipantes = Object.entries(participacoes)
    .map(([nome, dados]) => ({
      nome,
      presencas: dados.presencas,
      ausencias: dados.ausencias,
      taxa: (dados.presencas / dados.totalReunioes) * 100,
    }))
    .filter((p) => p.taxa >= 80)
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, 10);

  return {
    totalPresencas: Object.values(participacoes).reduce(
      (sum, p) => sum + p.presencas,
      0
    ),
    totalAusencias: Object.values(participacoes).reduce(
      (sum, p) => sum + p.ausencias,
      0
    ),
    topParticipantes,
  };
}

function mostrarErro(mensagem) {
  const containers = document.querySelectorAll(".card");
  containers.forEach((container) => {
    container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
  });
}

// Funções globais para exportações (chamadas via onclick no HTML)
window.exportarRelatorioParticipacao = function () {
  // Implementação CSV básica - pode ser expandida
  const participacoes = calcularParticipacoes(
    todasAsAtas,
    todosOsProfissionais
  );
  let csv = "Profissional,Presenças,Ausências,Taxa(%)\n";
  participacoes.topParticipantes.forEach((p) => {
    csv += `${p.nome},${p.presencas},${p.ausencias},${p.taxa.toFixed(1)}\n`;
  });
  downloadCSV(csv, "relatorio-participacao.csv");
};

window.exportarParticipante = function (nome) {
  // Export individual - placeholder para expansão
  alert(`Exportando dados de ${nome}... (implementar função específica)`);
};

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
