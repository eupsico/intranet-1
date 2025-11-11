// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 4.0 (Tabs: Atas | Gráficos | Agendamentos)

// Importações
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

// Função utilitária para normalizar participantes
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
  console.log("[DASH] Dashboard iniciado (v4.0 - Tabs separadas).");
  setupTabListeners();
  carregarDados();
}

// Configura listeners para tabs
function setupTabListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  viewContainer.addEventListener("click", (e) => {
    if (e.target.matches(".tab-link")) {
      e.preventDefault();
      const targetTab = e.target.dataset.tab;
      switchTab(targetTab);
    }
  });
}

// Switch de abas
function switchTab(tabId) {
  document
    .querySelectorAll(".tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(`${tabId}-tab`);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeContent) activeContent.classList.add("active");

  activeContent.scrollIntoView({ behavior: "smooth", block: "start" });

  console.log(`[DASH] Tab trocada para: ${tabId}`);
}

// Carrega dados de ambas coleções
function carregarDados() {
  const atasContainer = document.getElementById("atas-container");
  const agendamentosContainer = document.getElementById(
    "agendamentos-container"
  );
  if (!atasContainer || !agendamentosContainer) return;

  // Carrega atas (registadas)
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
    console.log(`[DASH] Atas carregadas: ${todasAsAtas.length}`);
  });

  // Carrega agendamentos (voluntários)
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
    console.log(
      `[DASH] Agendamentos carregados: ${todosOsAgendamentos.length}`
    );
  });
}

// Aba Atas (Listagem Detalhada)
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

// Aba Gráficos (Stats e Charts)
function atualizarGraficos() {
  // Stats gerais
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

  // Charts simples (placeholders - pode usar Chart.js)
  const ctxPresenca = document.getElementById("chart-presenca");
  if (ctxPresenca) {
    ctxPresenca.parentElement.innerHTML = `
            <div class="text-center">
                <p class="text-muted">Gráfico de Presença (implementar Chart.js)</p>
                <div class="bg-light p-3 rounded">
                    <p>Total Atas: ${totalAtas}</p>
                    <p>Total Agendamentos: ${totalAgendamentos}</p>
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
                    <p>Atas Registradas: ${totalAtas}</p>
                    <p>Agendamentos Pendentes: ${totalAgendamentos}</p>
                </div>
            </div>
        `;
  }
}

// Aba Agendamentos (Pendentes com Voluntários)
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

  // Event listeners para accordions e checkboxes
  container.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      content.classList.toggle("active");
      header.querySelector(".accordion-icon").textContent =
        content.classList.contains("active") ? "−" : "+";
    });
  });

  container.querySelectorAll(".checkbox-presenca").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const agendamentoId = e.target.dataset.agendamentoId;
      const vagaId = e.target.dataset.vagaId;
      const presente = e.target.checked;

      try {
        // Atualiza Firestore
        const agendamentoDoc = doc(
          firestoreDb,
          "agendamentos_voluntarios",
          agendamentoId
        );
        const agendamentoSnap = await getDoc(agendamentoDoc);
        if (agendamentoSnap.exists()) {
          const agendamento = agendamentoSnap.data();
          // Encontra e atualiza vaga
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
        console.error("[DASH] Erro ao atualizar presença:", error);
        e.target.checked = !presente;
      }
    });
  });
}

function atualizarContadorAtas(count) {
  const contadorEl = document.getElementById("contador-atas");
  if (contadorEl) contadorEl.textContent = count;
}

function atualizarContadorAgendamentos(count) {
  const contadorEl = document.getElementById("contador-agendamentos");
  if (contadorEl) contadorEl.textContent = count;
}

// Função de cleanup
export function cleanup() {
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeAgendamentos) unsubscribeAgendamentos();
  console.log("[DASH] Cleanup executado.");
}
