// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.1 (Corrigido handling de datas Firestore e erro de Timestamp)

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

// Função utilitária para formatar datas (corrige erro de Timestamp)
function formatarData(dataReuniao) {
  if (!dataReuniao) return "Data indisponível";

  try {
    let data;
    if (dataReuniao.toDate && typeof dataReuniao.toDate === "function") {
      // É um Timestamp do Firebase
      data = dataReuniao.toDate();
    } else if (typeof dataReuniao === "string") {
      // É uma string ISO ou timestamp
      data = new Date(dataReuniao);
    } else if (dataReuniao instanceof Date) {
      // Já é um Date
      data = dataReuniao;
    } else {
      // Fallback: assume string ou número
      data = new Date(dataReuniao);
    }

    // Valida se a data é válida
    if (isNaN(data.getTime())) {
      return "Data inválida";
    }

    return data.toLocaleDateString("pt-BR");
  } catch (error) {
    console.warn(
      "[RELATÓRIO] Erro ao formatar data:",
      error,
      "Valor:",
      dataReuniao
    );
    return "Data indisponível";
  }
}

export async function init() {
  console.log(
    "[RELATÓRIO] Módulo de Relatórios iniciado (v2.1 - Corrigido datas)."
  );
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

    console.log(
      `[RELATÓRIO] Carregados ${todasAsAtas.length} atas e ${todosOsProfissionais.length} profissionais.`
    );

    // Renderiza apenas se os containers existirem (evita erros em partial)
    if (document.getElementById("resumo-container")) {
      renderizarResumo(todasAsAtas, todosOsProfissionais);
    }
    if (document.getElementById("participacao-container")) {
      renderizarParticipacao(todasAsAtas, todosOsProfissionais);
    }
    if (document.getElementById("feedback-container")) {
      renderizarFeedbacks(todasAsAtas, todosOsProfissionais);
    }

    // Remove loading spinners após render
    document
      .querySelectorAll(".loading-spinner")
      .forEach((spinner) => (spinner.style.display = "none"));
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao carregar relatórios:", error);
    mostrarErro(
      "Erro ao carregar dados do Firestore. Verifique a conexão e tente novamente."
    );
  }
}

function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  // Event delegation para tabs
  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      trocarAba(targetTab);
    }
  });

  // Touch fallback para mobile
  viewContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.matches(".tab-link")) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Delegation para accordions (apenas na aba feedbacks)
  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".accordion-header")) {
      const content = e.target.nextElementSibling;
      const icon = e.target.querySelector(".accordion-icon");
      content.classList.toggle("active");
      if (icon) {
        icon.textContent = content.classList.contains("active") ? "−" : "+";
      }
    }
  });
}

function trocarAba(tabId) {
  document
    .querySelectorAll(".tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeContent) activeContent.classList.add("active");

  activeContent.scrollIntoView({ behavior: "smooth", block: "start" });

  // Renderiza conteúdo específico se necessário (lazy loading)
  if (
    tabId === "participacao" &&
    !activeContent.classList.contains("rendered")
  ) {
    renderizarParticipacao(todasAsAtas, todosOsProfissionais);
    activeContent.classList.add("rendered");
  }
}

// Renderização da aba "Resumo Geral" (com data corrigida)
function renderizarResumo(atas, profissionais) {
  const container = document.getElementById("resumo-container");
  if (!container) return;

  try {
    // Ordena atas por data (usando formatarData para evitar erro)
    const atasOrdenadas = [...atas].sort((a, b) => {
      const dataA = formatarData(a.dataReuniao);
      const dataB = formatarData(b.dataReuniao);
      return new Date(dataB) - new Date(dataA);
    });

    const totalReunioes = atas.length;
    const reunioesRecentes = atasOrdenadas.slice(0, 5);

    container.innerHTML = `
            <div class="card-header">
                <h3><span class="material-symbols-outlined">analytics</span> Resumo Geral das Reuniões</h3>
            </div>
            <div class="card-body">
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="material-symbols-outlined">event</span>
                        <h4>${totalReunioes}</h4>
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
                            ${reunioesRecentes
                              .map(
                                (ata) => `
                                <tr>
                                    <td>${ata.titulo || "Reunião Técnica"}</td>
                                    <td>${formatarData(ata.dataReuniao)}</td>
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
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao renderizar resumo:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar resumo. Dados corrompidos.</div>';
  }
}

// Renderização da aba "Resumo de Participação"
function renderizarParticipacao(atas, profissionais) {
  const container = document.getElementById("participacao-container");
  if (!container) return;

  try {
    const participacoes = calcularParticipacoes(atas, profissionais);
    const taxaMedia =
      participacoes.totalReunioes > 0
        ? (
            (participacoes.totalPresencas /
              (participacoes.totalReunioes * profissionais.length)) *
            100
          ).toFixed(1)
        : 0;

    container.innerHTML = `
            <div class="card-header">
                <h3><span class="material-symbols-outlined">group</span> Resumo de Participação</h3>
                <p>Taxa média de comparecimento: <strong>${taxaMedia}%</strong></p>
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
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao renderizar participação:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao calcular participação.</div>';
  }
}

// Renderização da aba "Feedbacks por Reunião"
function renderizarFeedbacks(atas, profissionais) {
  const container = document.getElementById("feedback-container");
  if (!container) return;

  try {
    const atasComFeedback = atas
      .filter((ata) => ata.feedbacks && ata.feedbacks.length > 0)
      .sort(
        (a, b) =>
          new Date(formatarData(b.dataReuniao)) -
          new Date(formatarData(a.dataReuniao))
      );

    if (atasComFeedback.length === 0) {
      container.innerHTML =
        '<div class="card-body"><div class="alert alert-info">Nenhuma ata com feedbacks encontrada.</div></div>';
      return;
    }

    container.innerHTML = `
            <div class="card-header">
                <h3><span class="material-symbols-outlined">feedback</span> Feedbacks por Reunião</h3>
            </div>
            <div class="card-body">
                <div class="accordion">
                    ${atasComFeedback
                      .map((ata) => {
                        const feedbacksHtml = (ata.feedbacks || [])
                          .map((fb) => {
                            const nomeProfissional =
                              fb.profissional || "Anônimo";
                            const respostasHtml = Object.keys(perguntasTexto)
                              .map(
                                (key) =>
                                  `<p><strong>${
                                    perguntasTexto[key]
                                  }</strong>: ${fb[key] || "N/R"}</p>`
                              )
                              .join("");
                            return `
                                <div class="feedback-card">
                                    <h4>${nomeProfissional}</h4>
                                    <div class="feedback-respostas">${respostasHtml}</div>
                                    ${
                                      fb.sugestaoTema
                                        ? `<p><strong>${perguntasTexto.sugestaoTema}</strong>: ${fb.sugestaoTema}</p>`
                                        : ""
                                    }
                                </div>
                            `;
                          })
                          .join("");

                        return `
                            <div class="accordion-item">
                                <button class="accordion-header" data-ata-id="${
                                  ata.id
                                }">
                                    <span class="material-symbols-outlined">event</span>
                                    ${
                                      ata.titulo || "Reunião Técnica"
                                    } - ${formatarData(ata.dataReuniao)}
                                    <span class="accordion-icon">+</span>
                                </button>
                                <div class="accordion-content">
                                    ${feedbacksHtml}
                                </div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `;
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao renderizar feedbacks:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar feedbacks.</div>';
  }
}

// Funções auxiliares (mantidas com correções de data)
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
    .map(([nome, dados]) => {
      const taxa =
        dados.totalReunioes > 0
          ? (dados.presencas / dados.totalReunioes) * 100
          : 0;
      return {
        nome,
        presencas: dados.presencas,
        ausencias: dados.ausencias,
        taxa,
      };
    })
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
    totalReunioes: atas.length,
    topParticipantes,
  };
}

function mostrarErro(mensagem) {
  const containers = document.querySelectorAll('[id$="-container"]');
  containers.forEach((container) => {
    container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
  });
}

// Funções de exportação (mantidas)
window.exportarRelatorioParticipacao = function () {
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
  alert(
    `Exportando dados de ${nome}... (Implementar export individual completo)`
  );
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
