// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.3 (Completo: Todas funções incluídas, títulos corrigidos, erros fixos)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let todosOsProfissionais = [];
let todosOsAgendamentos = [];
const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

function formatarData(dataReuniao) {
  if (!dataReuniao) return "Data indisponível";
  try {
    let data;
    if (dataReuniao.toDate && typeof dataReuniao.toDate === "function") {
      data = dataReuniao.toDate();
    } else if (typeof dataReuniao === "string") {
      data = new Date(dataReuniao);
    } else if (dataReuniao instanceof Date) {
      data = dataReuniao;
    } else {
      data = new Date(dataReuniao);
    }
    if (isNaN(data.getTime())) return "Data inválida";
    return data.toLocaleDateString("pt-BR");
  } catch (error) {
    console.warn("[RELATÓRIO] Erro ao formatar data:", error);
    return "Data indisponível";
  }
}

export async function init() {
  console.log("[RELATÓRIO] Módulo de Relatórios iniciado (v2.3 - Completo).");
  setupEventListeners();
  await carregarRelatorios();
}

async function carregarRelatorios() {
  try {
    const [atasSnapshot, profissionaisSnapshot, agendamentosSnapshot] =
      await Promise.all([
        getDocs(
          query(
            collection(firestoreDb, "gestao_atas"),
            where("tipo", "==", "Reunião Técnica")
          )
        ),
        getDocs(query(collection(firestoreDb, "usuarios"), orderBy("nome"))),
        getDocs(
          query(
            collection(firestoreDb, "agendamentos_voluntarios"),
            orderBy("criadoEm", "desc")
          )
        ),
      ]);

    todasAsAtas = atasSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    todosOsProfissionais = profissionaisSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    todosOsAgendamentos = agendamentosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(
      `[RELATÓRIO] Carregados: ${todasAsAtas.length} atas, ${todosOsProfissionais.length} profissionais, ${todosOsAgendamentos.length} agendamentos.`
    );

    // Renderiza abas com verificação de containers
    renderizarAbaSeExistir("resumo", () =>
      renderizarResumo(todasAsAtas, todosOsProfissionais)
    );
    renderizarAbaSeExistir("participacao", () =>
      renderizarParticipacao(todasAsAtas, todosOsProfissionais)
    );
    renderizarAbaSeExistir("feedbacks", () =>
      renderizarFeedbacks(todasAsAtas, todosOsProfissionais)
    );
    renderizarAbaSeExistir("agendados", () =>
      renderizarAgendados(todosOsAgendamentos, todosOsProfissionais)
    );

    // Remove spinners
    document
      .querySelectorAll(".loading-spinner")
      .forEach((spinner) => (spinner.style.display = "none"));
    console.log("[RELATÓRIO] Todas as abas renderizadas com sucesso.");
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao carregar:", error);
    mostrarErro("Erro ao carregar dados. Verifique conexão.");
  }
}

function renderizarAbaSeExistir(tabId, renderFunction) {
  const container = document.getElementById(`${tabId}-container`);
  if (container) {
    try {
      renderFunction();
    } catch (error) {
      console.error(`[RELATÓRIO] Erro ao renderizar aba ${tabId}:`, error);
      container.innerHTML =
        '<div class="alert alert-danger">Erro ao carregar esta seção.</div>';
    }
  }
}

function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  // Tabs
  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      trocarAba(targetTab);
    }
  });

  // Accordions fixos
  viewContainer.addEventListener("click", (e) => {
    if (e.target.closest(".accordion-header")) {
      e.preventDefault();
      const header = e.target.closest(".accordion-header");
      const accordionItem = header.closest(".accordion-item");
      const content = header.nextElementSibling;
      const icon = header.querySelector(".accordion-icon");

      const isActive = accordionItem.classList.toggle("active");
      if (content) {
        content.style.maxHeight = isActive
          ? `${content.scrollHeight}px`
          : "0px";
      }
      if (icon) {
        icon.textContent = isActive ? "−" : "+";
      }
    }
  });

  // Checkboxes de presença
  viewContainer.addEventListener("change", (e) => {
    if (e.target.matches(".checkbox-presenca")) {
      marcarPresenca(e.target);
    }
  });

  // Touch support
  viewContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.matches(".tab-link, .accordion-header")) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
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

  // Lazy render para Agendados
  if (tabId === "agendados" && !activeContent.classList.contains("rendered")) {
    renderizarAgendados(todosOsAgendamentos, todosOsProfissionais);
    activeContent.classList.add("rendered");
  }
}

// RESUMO GERAL (agora incluída)
function renderizarResumo(atas, profissionais) {
  const container = document.getElementById("resumo-container");
  if (!container) return;

  try {
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
    console.error("[RELATÓRIO] Erro no resumo:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar resumo.</div>';
  }
}

// RESUMO DE PARTICIPAÇÃO (incluída)
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
                            </tr>
                        </thead>
                        <tbody>
                            ${participacoes.topParticipantes
                              .slice(0, 10)
                              .map(
                                (prof) => `
                                <tr>
                                    <td>${prof.nome}</td>
                                    <td>${prof.presencas}</td>
                                    <td>${prof.ausencias}</td>
                                    <td>${prof.taxa.toFixed(1)}%</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                    <button class="btn btn-primary mt-2" onclick="exportarRelatorioParticipacao()">Exportar CSV Completo</button>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("[RELATÓRIO] Erro na participação:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar participação.</div>';
  }
}

// FEEDBACKS POR REUNIÃO (mantida)
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
                      .map(
                        (ata) => `
                        <div class="accordion-item">
                            <button class="accordion-header" type="button">
                                <span class="material-symbols-outlined">event</span>
                                ${
                                  ata.titulo || "Reunião Técnica"
                                } - ${formatarData(ata.dataReuniao)}
                                (${ata.feedbacks.length} feedbacks)
                                <span class="accordion-icon">+</span>
                            </button>
                            <div class="accordion-content">
                                <div class="feedback-list">
                                    ${ata.feedbacks
                                      .map((fb) => {
                                        const profissional =
                                          profissionais.find(
                                            (p) => p.id === fb.profissionalId
                                          ) ||
                                          profissionais.find(
                                            (p) => p.nome === fb.profissional
                                          );
                                        const nomeProfissional = profissional
                                          ? profissional.nome
                                          : fb.profissional || "Anônimo";
                                        const respostas = Object.entries(
                                          perguntasTexto
                                        )
                                          .map(
                                            ([key, texto]) =>
                                              `<p><strong>${texto}</strong>: ${
                                                fb[key] || "N/R"
                                              }</p>`
                                          )
                                          .join("");
                                        return `
                                            <div class="feedback-card">
                                                <h5>${nomeProfissional}</h5>
                                                <div class="feedback-respostas">${respostas}</div>
                                                ${
                                                  fb.sugestaoTema
                                                    ? `<p><em>Sugestão: ${fb.sugestaoTema}</em></p>`
                                                    : ""
                                                }
                                            </div>
                                        `;
                                      })
                                      .join("")}
                                </div>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;
  } catch (error) {
    console.error("[RELATÓRIO] Erro nos feedbacks:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar feedbacks.</div>';
  }
}

// AGENDADOS (com título corrigido)
function renderizarAgendados(agendamentos, profissionais) {
  const container = document.getElementById("agendados-container");
  if (!container) return;

  try {
    if (agendamentos.length === 0) {
      container.innerHTML = `
                <div class="card-header">
                    <h3><span class="material-symbols-outlined">event_available</span> Agendamentos</h3>
                </div>
                <div class="card-body">
                    <div class="alert alert-info">Nenhum agendamento encontrado.</div>
                </div>
            `;
      return;
    }

    const todosInscritos = [];
    agendamentos.forEach((agendamento) => {
      const tipoReuniao =
        agendamento.tipoDeReuniao || agendamento.tipo || "Reunião Técnica"; // CORREÇÃO: Usa tipoDeReuniao
      (agendamento.slots || []).forEach((slot) => {
        (slot.vagas || []).forEach((vaga) => {
          if (vaga.profissionalId) {
            const profissional = profissionais.find(
              (p) => p.id === vaga.profissionalId
            );
            todosInscritos.push({
              agendamentoId: agendamento.id,
              tipoReuniao, // Usado no título
              slotData: slot.data,
              slotHoraInicio: slot.horaInicio,
              slotHoraFim: slot.horaFim,
              gestorNome: slot.gestorNome || "Não especificado",
              nome: profissional ? profissional.nome : "Desconhecido",
              presente: vaga.presente || false,
              vagaId: vaga.id,
            });
          }
        });
      });
    });

    const inscritosPorAgendamento = agendamentos
      .map((agendamento) => {
        const tipoReuniao =
          agendamento.tipoDeReuniao || agendamento.tipo || "Reunião Técnica";
        const inscritos = todosInscritos.filter(
          (i) => i.agendamentoId === agendamento.id
        );
        return { ...agendamento, tipoReuniao, inscritos };
      })
      .filter((a) => a.inscritos.length > 0);

    container.innerHTML = `
            <div class="card-header">
                <h3><span class="material-symbols-outlined">event_available</span> Agendamentos Confirmados</h3>
                <p>Total de inscritos: ${todosInscritos.length}</p>
            </div>
            <div class="card-body">
                <div class="accordion">
                    ${inscritosPorAgendamento
                      .map((agendamento) => {
                        const totalInscritos = agendamento.inscritos.length;
                        return `
                            <div class="accordion-item">
                                <button class="accordion-header" type="button">
                                    <span class="material-symbols-outlined">schedule</span>
                                    ${
                                      agendamento.tipoReuniao
                                    } - Criado em ${formatarData(
                          agendamento.criadoEm
                        )}
                                    <span class="badge">${totalInscritos} inscritos</span>
                                    <span class="accordion-icon">+</span>
                                </button>
                                <div class="accordion-content">
                                    <div class="table-container">
                                        <table class="table">
                                            <thead>
                                                <tr>
                                                    <th>Profissional</th>
                                                    <th>Data</th>
                                                    <th>Horário</th>
                                                    <th>Gestor</th>
                                                    <th>Presença</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${agendamento.inscritos
                                                  .map(
                                                    (inscrito) => `
                                                    <tr>
                                                        <td>${
                                                          inscrito.nome
                                                        }</td>
                                                        <td>${formatarData(
                                                          inscrito.slotData
                                                        )}</td>
                                                        <td>${
                                                          inscrito.slotHoraInicio
                                                        } - ${
                                                      inscrito.slotHoraFim
                                                    }</td>
                                                        <td>${
                                                          inscrito.gestorNome
                                                        }</td>
                                                        <td class="text-center">
                                                            <input type="checkbox" class="checkbox-presenca" 
                                                                   ${
                                                                     inscrito.presente
                                                                       ? "checked"
                                                                       : ""
                                                                   } 
                                                                   data-agendamento-id="${
                                                                     inscrito.agendamentoId
                                                                   }"
                                                                   data-slot-data="${
                                                                     inscrito.slotData
                                                                   }"
                                                                   data-slot-hora-inicio="${
                                                                     inscrito.slotHoraInicio
                                                                   }"
                                                                   data-vaga-id="${
                                                                     inscrito.vagaId
                                                                   }">
                                                        </td>
                                                    </tr>
                                                `
                                                  )
                                                  .join("")}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style="margin-top: 1rem;">
                                        <button class="btn btn-primary btn-sm" onclick="exportarAgendados('${
                                          agendamento.id
                                        }')">
                                            Exportar este agendamento (CSV)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `;
  } catch (error) {
    console.error("[RELATÓRIO] Erro nos agendados:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar agendamentos.</div>';
  }
}

// FUNÇÕES AUXILIARES (todas incluídas)
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
    participacoes[prof.nome] = { presencas: 0, ausencias: 0, totalReunioes: 0 };
  });

  atas.forEach((ata) => {
    const presentes = ata.participantes || [];
    profissionais.forEach((prof) => {
      participacoes[prof.nome].totalReunioes++;
      if (presentes.includes(prof.nome)) {
        participacoes[prof.nome].presencas++;
      } else {
        participacoes[prof.nome].ausencias++;
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
    if (container.innerHTML.includes("loading-spinner")) {
      container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
    }
  });
  console.error("[RELATÓRIO] Erro geral:", mensagem);
}

// Função para marcar presença
async function marcarPresenca(checkbox) {
  const agendamentoId = checkbox.dataset.agendamentoId;
  const slotData = checkbox.dataset.slotData;
  const slotHoraInicio = checkbox.dataset.slotHoraInicio;
  const vagaId = checkbox.dataset.vagaId;
  const presente = checkbox.checked;

  try {
    const agendamentoDoc = doc(
      firestoreDb,
      "agendamentos_voluntarios",
      agendamentoId
    );
    const agendamentoSnap = await getDoc(agendamentoDoc);
    if (!agendamentoSnap.exists())
      throw new Error("Agendamento não encontrado");

    const agendamento = { id: agendamentoId, ...agendamentoSnap.data() };
    const slot = agendamento.slots.find(
      (s) => s.data === slotData && s.horaInicio === slotHoraInicio
    );
    if (!slot) throw new Error("Slot não encontrado");

    const vaga = slot.vagas.find((v) => v.id === vagaId);
    if (vaga) {
      vaga.presente = presente;
      await updateDoc(agendamentoDoc, { slots: agendamento.slots });
      console.log(
        "[RELATÓRIO] Presença atualizada:",
        presente ? "Presente" : "Ausente"
      );

      checkbox.parentElement.style.background = presente
        ? "#d4edda"
        : "#f8d7da";
      setTimeout(() => (checkbox.parentElement.style.background = ""), 1500);
    }
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao marcar presença:", error);
    checkbox.checked = !presente;
    alert("Erro ao atualizar presença.");
  }
}

// Export functions
window.exportarRelatorioParticipacao = function () {
  const participacoes = calcularParticipacoes(
    todasAsAtas,
    todosOsProfissionais
  );
  let csv = "Profissional,Presenças,Ausências,Taxa(%)\n";
  participacoes.topParticipantes.forEach((p) => {
    csv += `"${p.nome}",${p.presencas},${p.ausencias},${p.taxa.toFixed(1)}\n`;
  });
  downloadCSV(csv, "relatorio-participacao.csv");
};

window.exportarAgendados = function (agendamentoId) {
  const agendamento = todosOsAgendamentos.find((a) => a.id === agendamentoId);
  if (!agendamento) return alert("Agendamento não encontrado");

  let csv = "Profissional,Data,Horário,Presença\n";
  (agendamento.slots || []).forEach((slot) => {
    (slot.vagas || []).forEach((vaga) => {
      if (vaga.profissionalId) {
        const profissional = todosOsProfissionais.find(
          (p) => p.id === vaga.profissionalId
        );
        const nome = profissional ? profissional.nome : "Desconhecido";
        csv += `"${nome}","${formatarData(slot.data)}","${slot.horaInicio}-${
          slot.horaFim
        }",${vaga.presente ? "Sim" : "Não"}\n`;
      }
    });
  });
  downloadCSV(csv, `agendados-${agendamentoId.slice(-6)}.csv`);
};

window.exportarParticipante = function (nome) {
  alert(`Exportando dados de ${nome}... (Implementar export individual)`);
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

// Import getDoc (usado em marcarPresenca)
import { getDoc } from "../../../assets/js/firebase-init.js";
