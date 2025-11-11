// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.2 (Accordions fixos + Aba Agendados com checkboxes de presença)

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
  console.log(
    "[RELATÓRIO] Módulo de Relatórios iniciado (v2.2 - Accordions + Agendados)."
  );
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

    // Renderiza abas existentes
    if (document.getElementById("resumo-container"))
      renderizarResumo(todasAsAtas, todosOsProfissionais);
    if (document.getElementById("participacao-container"))
      renderizarParticipacao(todasAsAtas, todosOsProfissionais);
    if (document.getElementById("feedback-container"))
      renderizarFeedbacks(todasAsAtas, todosOsProfissionais);
    if (document.getElementById("agendados-container"))
      renderizarAgendados(todosOsAgendamentos, todosOsProfissionais);

    document
      .querySelectorAll(".loading-spinner")
      .forEach((spinner) => (spinner.style.display = "none"));
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao carregar:", error);
    mostrarErro("Erro ao carregar dados. Verifique conexão.");
  }
}

function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  // Delegation para tabs
  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      trocarAba(targetTab);
    }
  });

  // CORREÇÃO: Delegation para accordions (corrige não abertura)
  viewContainer.addEventListener("click", (e) => {
    if (e.target.closest(".accordion-header")) {
      e.preventDefault();
      const header = e.target.closest(".accordion-header");
      const accordionItem = header.closest(".accordion-item");
      const content = header.nextElementSibling;
      const icon = header.querySelector(".accordion-icon");

      accordionItem.classList.toggle("active");
      if (content) {
        content.style.maxHeight = accordionItem.classList.contains("active")
          ? `${content.scrollHeight}px`
          : "0px";
      }
      if (icon) {
        icon.textContent = accordionItem.classList.contains("active")
          ? "−"
          : "+";
      }
      console.log(
        "[RELATÓRIO] Accordion toggled:",
        accordionItem.classList.contains("active")
      );
    }
  });

  // Delegation para checkboxes de presença (aba Agendados)
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

// [Mantém as funções renderizarResumo, renderizarParticipacao do anterior - omito por brevidade]
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
                                        const profissional = profissionais.find(
                                          (p) => p.id === fb.profissionalId
                                        );
                                        const nomeProfissional = profissional
                                          ? profissional.nome
                                          : "Anônimo";
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
    console.error("[RELATÓRIO] Erro ao renderizar feedbacks:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar feedbacks.</div>';
  }
}

// NOVA: Renderização da aba "Agendados"
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

    // Processa todos os slots e inscritos
    const todosInscritos = [];
    agendamentos.forEach((agendamento) => {
      (agendamento.slots || []).forEach((slot) => {
        (slot.vagas || []).forEach((vaga) => {
          if (vaga.profissionalId) {
            const profissional = profissionais.find(
              (p) => p.id === vaga.profissionalId
            );
            todosInscritos.push({
              agendamentoId: agendamento.id,
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
      .map((agendamento) => ({
        ...agendamento,
        inscritos: todosInscritos.filter(
          (i) => i.agendamentoId === agendamento.id
        ),
      }))
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
                                    Agendamento ${agendamento.id.slice(
                                      -6
                                    )} - Criado em ${formatarData(
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
                                    ${
                                      totalInscritos > 0
                                        ? `
                                        <div style="margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 4px;">
                                            <button class="btn btn-primary btn-sm" onclick="exportarAgendados('${agendamento.id}')">
                                                Exportar este agendamento (CSV)
                                            </button>
                                        </div>
                                    `
                                        : ""
                                    }
                                </div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `;
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao renderizar agendados:", error);
    container.innerHTML =
      '<div class="alert alert-danger">Erro ao carregar agendamentos.</div>';
  }
}

// NOVA: Função para marcar presença
async function marcarPresenca(checkbox) {
  const agendamentoId = checkbox.dataset.agendamentoId;
  const slotData = checkbox.dataset.slotData;
  const slotHoraInicio = checkbox.dataset.slotHoraInicio;
  const vagaId = checkbox.dataset.vagaId;
  const presente = checkbox.checked;

  try {
    // Encontra agendamento e slot
    const agendamento = todosOsAgendamentos.find((a) => a.id === agendamentoId);
    if (!agendamento) throw new Error("Agendamento não encontrado");

    const slot = agendamento.slots.find(
      (s) => s.data === slotData && s.horaInicio === slotHoraInicio
    );
    if (!slot) throw new Error("Slot não encontrado");

    const vaga = slot.vagas.find((v) => v.id === vagaId);
    if (vaga) {
      vaga.presente = presente;
      await updateDoc(
        doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
        {
          slots: agendamento.slots,
        }
      );
      console.log(
        "[RELATÓRIO] Presença atualizada:",
        presente ? "Presente" : "Ausente"
      );

      // Feedback visual
      checkbox.parentElement.style.background = presente
        ? "#d4edda"
        : "#f8d7da";
      setTimeout(() => (checkbox.parentElement.style.background = ""), 1500);
    }
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao marcar presença:", error);
    checkbox.checked = !presente; // Reverte
    alert("Erro ao atualizar presença. Tente novamente.");
  }
}

// NOVA: Exportar agendados específico
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

// [Mantém as outras funções: calcularMediaFeedbacks, calcularParticipacoes, mostrarErro, downloadCSV, exportarRelatorioParticipacao, etc. do anterior]
