// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 4.1 (Corrigido: Tab listeners robustos com debug)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
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
  console.log("[DASH] Dashboard iniciado (v4.1 - Tabs corrigidas).");

  // Debug: Verifica se HTML está presente
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) {
    console.error("[DASH] .view-container não encontrado! Verifique HTML.");
    return;
  }
  console.log("[DASH] .view-container encontrado:", viewContainer);

  // Verifica se tabs existem
  const tabLinks = document.querySelectorAll(".tab-link");
  console.log("[DASH] Encontrados", tabLinks.length, "tab-links no DOM.");

  setupTabListeners(); // Configura tabs
  carregarDados();
}

// Listener para tabs (robusto, com debug)
function setupTabListeners() {
  // Tenta múltiplos seletores para garantir captura
  const selectors = [".view-container", "body", document.body];
  const tabLinks = document.querySelectorAll(".tab-link");

  console.log(
    "[DASH] Configurando tab listeners para",
    tabLinks.length,
    "tabs."
  );

  // Usa document.body como fallback garantido
  document.body.addEventListener("click", function (e) {
    // Verifica se clicou em botão de tab
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      console.log("[DASH] Clique detectado na tab:", targetTab);

      // Remove active de todas
      document.querySelectorAll(".tab-link").forEach((btn) => {
        btn.classList.remove("active");
      });
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      // Adiciona active no clicado
      e.target.classList.add("active");

      // Mostra conteúdo da aba
      const activeContent = document.getElementById(targetTab);
      if (activeContent) {
        activeContent.classList.add("active");
        activeContent.scrollIntoView({ behavior: "smooth", block: "start" });
        console.log("[DASH] Tab ativada:", targetTab);
      } else {
        console.error("[DASH] Container", targetTab, "não encontrado!");
      }
    }
  });

  // Listener adicional para debug (remove depois)
  document.addEventListener("DOMContentLoaded", () => {
    console.log(
      "[DASH] DOM carregado. Tabs disponíveis:",
      document.querySelectorAll(".tab-link").length
    );
  });
}

// Carrega dados
function carregarDados() {
  const atasContainer = document.getElementById("atas-container");
  const agendamentosContainer = document.getElementById(
    "agendamentos-container"
  );
  if (!atasContainer || !agendamentosContainer) {
    console.error(
      "[DASH] Containers não encontrados. Atas:",
      !!atasContainer,
      "Agendamentos:",
      !!agendamentosContainer
    );
    return;
  }

  // Atas
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
    renderAtasTab();
    atualizarGraficos();
    console.log(`[DASH] Atas: ${todasAsAtas.length}`);
  });

  // Agendamentos
  const qAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(qAgendamentos, (snapshot) => {
    todosOsAgendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    renderAgendamentosTab();
    atualizarGraficos();
    console.log(`[DASH] Agendamentos: ${todosOsAgendamentos.length}`);
  });
}

// Render aba Atas
function renderAtasTab() {
  const container = document.getElementById("atas-container");
  if (!container) return;

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

  if (atasFiltradas.length === 0) {
    container.innerHTML =
      '<div class="alert alert-info">Nenhuma ata encontrada.</div>';
    return;
  }

  container.innerHTML = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Título</th>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${atasFiltradas
                      .map(
                        (ata) => `
                        <tr>
                            <td>${ata.titulo || "Reunião"}</td>
                            <td>${new Date(ata.dataReuniao).toLocaleDateString(
                              "pt-BR"
                            )}</td>
                            <td>${ata.tipo || "Não especificado"}</td>
                            <td><span class="badge bg-secondary">${
                              ata.status || "Concluída"
                            }</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="gerarPDF('${
                                  ata.id
                                }')">PDF</button>
                            </td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;

  atualizarContadorAtas(atasFiltradas.length);
}

// Render aba Agendamentos
function renderAgendamentosTab() {
  const container = document.getElementById("agendamentos-container");
  if (!container) return;

  if (todosOsAgendamentos.length === 0) {
    container.innerHTML =
      '<div class="alert alert-info">Nenhum agendamento pendente.</div>';
    return;
  }

  todosOsAgendamentos.sort((a, b) => {
    const dataA = new Date(a.slots?.[0]?.data || a.criadoEm);
    const dataB = new Date(b.slots?.[0]?.data || b.criadoEm);
    return dataA - dataB;
  });

  container.innerHTML = `
        <div class="accordion">
            ${todosOsAgendamentos
              .map((agendamento) => {
                const slot = agendamento.slots?.[0] || {};
                const dataSlot = new Date(slot.data || agendamento.criadoEm);
                const inscricaoCount = (slot.vagas || []).length;
                return `
                    <div class="accordion-item">
                        <button class="accordion-header">
                            <span class="material-symbols-outlined">event</span>
                            ${
                              agendamento.descricao || "Agendamento"
                            } - ${dataSlot.toLocaleDateString("pt-BR")}
                            <span class="badge bg-info">${inscricaoCount} inscritos</span>
                            <span class="accordion-icon">+</span>
                        </button>
                        <div class="accordion-content">
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Slot</th>
                                            <th>Data/Hora</th>
                                            <th>Inscritos</th>
                                            <th>Presença</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${
                                          slot.vagas
                                            ?.map((vaga) => {
                                              const profissional =
                                                vaga.profissionalNome ||
                                                "Pendente";
                                              const presente =
                                                vaga.presente || false;
                                              return `
                                                <tr>
                                                    <td>${slot.horaInicio} - ${
                                                slot.horaFim
                                              }</td>
                                                    <td>${profissional}</td>
                                                    <td>${
                                                      presente
                                                        ? "Presente"
                                                        : "Aguardando"
                                                    }</td>
                                                    <td>
                                                        <input type="checkbox" ${
                                                          presente
                                                            ? "checked"
                                                            : ""
                                                        } 
                                                               class="checkbox-presenca" 
                                                               data-agendamento-id="${
                                                                 agendamento.id
                                                               }"
                                                               data-vaga-id="${
                                                                 vaga.id
                                                               }">
                                                    </td>
                                                </tr>
                                            `;
                                            })
                                            .join("") ||
                                          '<tr><td colspan="4">Nenhum slot configurado.</td></tr>'
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;

  atualizarContadorAgendamentos(todosOsAgendamentos.length);

  // Configura accordions
  container.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      content.style.maxHeight = content.style.maxHeight
        ? null
        : content.scrollHeight + "px";
      header.querySelector(".accordion-icon").textContent = content.style
        .maxHeight
        ? "−"
        : "+";
    });
  });

  // Configura checkboxes de presença
  container.querySelectorAll(".checkbox-presenca").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const agendamentoId = e.target.dataset.agendamentoId;
      const vagaId = e.target.dataset.vagaId;
      const presente = e.target.checked;

      try {
        const agendamentoDoc = doc(
          firestoreDb,
          "agendamentos_voluntarios",
          agendamentoId
        );
        const agendamentoSnap = await getDoc(agendamentoDoc);
        if (agendamentoSnap.exists()) {
          const agendamento = agendamentoSnap.data();
          const slot = agendamento.slots.find((s) =>
            s.vagas?.some((v) => v.id === vagaId)
          );
          if (slot) {
            const vaga = slot.vagas.find((v) => v.id === vagaId);
            if (vaga) vaga.presente = presente;
            await updateDoc(agendamentoDoc, { slots: agendamento.slots });
            console.log(
              "[DASH] Presença atualizada:",
              presente ? "Sim" : "Não"
            );
          }
        }
      } catch (error) {
        console.error("[DASH] Erro na presença:", error);
        e.target.checked = !presente;
      }
    });
  });
}

function atualizarGraficos() {
  const totalEventos = todasAsAtas.length + todosOsAgendamentos.length;
  const totalAtas = todasAsAtas.length;
  const totalAgendamentos = todosOsAgendamentos.length;

  document.getElementById("total-reunioes").textContent = totalEventos;
  document.getElementById("proximas-reunioes").textContent =
    todosOsAgendamentos.filter((a) => {
      const dataSlot = new Date(a.slots?.[0]?.data || a.criadoEm);
      return dataSlot > new Date();
    }).length;
  document.getElementById("reunioes-concluidas").textContent = totalAtas;

  const ctxPresenca = document.getElementById("chart-presenca");
  if (ctxPresenca) {
    ctxPresenca.parentElement.innerHTML = `
            <div class="text-center">
                <p class="text-muted">Gráfico de Presença</p>
                <div class="bg-light p-3 rounded">
                    <p>Atas Registradas: <strong>${totalAtas}</strong></p>
                    <p>Agendamentos Pendentes: <strong>${totalAgendamentos}</strong></p>
                </div>
            </div>
        `;
  }

  const ctxStatus = document.getElementById("chart-status");
  if (ctxStatus) {
    ctxStatus.parentElement.innerHTML = `
            <div class="text-center">
                <p class="text-muted">Status das Reuniões</p>
                <div class="bg-light p-3 rounded">
                    <p>Total de Eventos: <strong>${totalEventos}</strong></p>
                    <p>Próximas: <strong>${todosOsAgendamentos.length}</strong></p>
                </div>
            </div>
        `;
  }
}

function atualizarContadorAtas(count) {
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) contadorEl.textContent = count;
}

function atualizarContadorAgendamentos(count) {
  const contadorEl = document.getElementById("contador-agendamentos");
  if (contadorEl) contadorEl.textContent = count;
}

function gerarPDF(ataId) {
  alert(`Gerando PDF da ata ID: ${ataId}`);
}

export function cleanup() {
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeAgendamentos) unsubscribeAgendamentos();
  console.log("[DASH] Cleanup executado.");
}
