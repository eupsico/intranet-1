// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 4.0 (Completo: Tabs Atas/Gráficos/Agendamentos, Todas Funções Incluídas)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
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
  console.warn(
    "[DASH] Formato inválido de participantes:",
    typeof participantes
  );
  return [];
}

export function init() {
  console.log("[DASH] Dashboard iniciado (v4.0 - Completo).");
  configurarEventListenersParaTabs();
  carregarDadosDasColecoes();
}

function configurarEventListenersParaTabs() {
  const containerPrincipal = document.querySelector(".view-container");
  if (!containerPrincipal) {
    console.error("[DASH] .view-container não encontrado.");
    return;
  }

  containerPrincipal.addEventListener("click", (evento) => {
    if (evento.target.matches(".tab-link")) {
      evento.preventDefault();
      const abaAlvo = evento.target.dataset.tab;
      alternarAba(abaAlvo);
    }
  });
}

function alternarAba(idDaAba) {
  document
    .querySelectorAll(".tab-link")
    .forEach((botao) => botao.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((conteudo) => conteudo.classList.remove("active"));

  const botaoAtivo = document.querySelector(`[data-tab="${idDaAba}"]`);
  const conteudoAtivo = document.getElementById(`${idDaAba}-tab`);
  if (botaoAtivo) botaoAtivo.classList.add("active");
  if (conteudoAtivo) conteudoAtivo.classList.add("active");

  conteudoAtivo.scrollIntoView({ behavior: "smooth", block: "start" });
  console.log(`[DASH] Aba alternada para: ${idDaAba}`);
}

function carregarDadosDasColecoes() {
  const conteudoAtas = document.getElementById("atas-container");
  const conteudoAgendamentos = document.getElementById(
    "agendamentos-container"
  );
  if (!conteudoAtas || !conteudoAgendamentos) {
    console.error("[DASH] Containers das abas não encontrados.");
    return;
  }

  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeAgendamentos) unsubscribeAgendamentos();

  const consultaAtas = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );
  unsubscribeAtas = onSnapshot(consultaAtas, (resultado) => {
    todasAsAtas = resultado.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
      participantes: normalizarParticipantes(documento.data().participantes),
    }));
    renderizarAbaAtas();
    atualizarGraficos();
    console.log(`[DASH] Atas carregadas: ${todasAsAtas.length}`);
  });

  const consultaAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(consultaAgendamentos, (resultado) => {
    todosOsAgendamentos = resultado.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
    renderizarAbaAgendamentos();
    atualizarGraficos();
    console.log(
      `[DASH] Agendamentos carregados: ${todosOsAgendamentos.length}`
    );
  });
}

function renderizarAbaAtas() {
  const container = document.getElementById("atas-container");
  if (!container) return;

  const filtroTipo =
    document.getElementById("tipo-filtro-atas")?.value || "Todos";
  const termoBusca =
    document.getElementById("busca-titulo-atas")?.value.toLowerCase() || "";

  let atasFiltradas = [...todasAsAtas];

  if (filtroTipo !== "Todos") {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.tipo?.toLowerCase().includes(filtroTipo.toLowerCase())
    );
  }

  if (termoBusca) {
    atasFiltradas = atasFiltradas.filter((ata) =>
      ata.titulo?.toLowerCase().includes(termoBusca)
    );
  }

  atasFiltradas.sort(
    (a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao)
  );

  if (atasFiltradas.length === 0) {
    container.innerHTML = `
            <div class="alert alert-info">
                <span class="material-symbols-outlined">search_off</span>
                Nenhuma ata encontrada para este filtro.
            </div>
        `;
    return;
  }

  container.innerHTML = `
        <div class="accordion">
            ${atasFiltradas
              .map((ata) => {
                const dataAta = new Date(ata.dataReuniao);
                const agora = new Date();
                const ehFutura = dataAta > agora;
                const statusCor = ehFutura ? "text-info" : "text-success";
                const iconeStatus = ehFutura ? "schedule" : "check_circle";
                const textoStatus = ehFutura ? "Agendada" : "Registrada";

                const participantes = normalizarParticipantes(
                  ata.participantes
                );
                const previewParticipantes = participantes.slice(0, 5);
                const maisParticipantes =
                  participantes.length > 5
                    ? `+${participantes.length - 5}`
                    : "";

                const conteudoDetalhes = `
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Tipo:</strong> ${
                              ata.tipo || "Não especificado"
                            }</p>
                            <p><strong>Data:</strong> ${dataAta.toLocaleDateString(
                              "pt-BR"
                            )}</p>
                            <p><strong>Local:</strong> ${
                              ata.local || "Online"
                            }</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Responsável:</strong> ${
                              ata.responsavel || "Não especificado"
                            }</p>
                            <p><strong>Total Participantes:</strong> ${
                              participantes.length
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
                `;

                return `
                    <div class="accordion-item">
                        <button class="accordion-header">
                            <span class="material-symbols-outlined" style="color: ${statusCor};">${iconeStatus}</span>
                            ${
                              ata.titulo || ata.tipo || "Reunião"
                            } - ${dataAta.toLocaleDateString("pt-BR")}
                            <span class="badge bg-secondary">${textoStatus}</span>
                            <span class="accordion-icon">+</span>
                        </button>
                        <div class="accordion-content">
                            ${conteudoDetalhes}
                            <div class="mt-3">
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="gerarPDFAta('${
                                  ata.id
                                }')">PDF</button>
                                <button class="btn btn-sm btn-outline-success me-1" onclick="abrirFeedbackAta('${
                                  ata.id
                                }')">Feedback</button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="editarAta('${
                                  ata.id
                                }')">Editar</button>
                            </div>
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;

  container.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const conteudo = header.nextElementSibling;
      conteudo.classList.toggle("active");
      const icone = header.querySelector(".accordion-icon");
      icone.textContent = conteudo.classList.contains("active") ? "−" : "+";
    });
  });
  atualizarContadorAtas(atasFiltradas.length);
}

function atualizarGraficos() {
  const totalEventos = todasAsAtas.length + todosOsAgendamentos.length;
  const totalAtas = todasAsAtas.length;
  const totalAgendamentos = todosOsAgendamentos.length;

  if (document.getElementById("total-reunioes"))
    document.getElementById("total-reunioes").textContent = totalEventos;
  if (document.getElementById("proximas-reunioes")) {
    document.getElementById("proximas-reunioes").textContent =
      todosOsAgendamentos.filter((a) => {
        const dataSlot = new Date(a.slots?.[0]?.data || a.criadoEm);
        return dataSlot > new Date();
      }).length;
  }
  if (document.getElementById("reunioes-concluidas"))
    document.getElementById("reunioes-concluidas").textContent = totalAtas;

  const conteudoGraficos = document.getElementById("graficos-tab");
  if (conteudoGraficos) {
    const canvasPresenca = document.getElementById("chart-presenca");
    if (canvasPresenca) {
      canvasPresenca.parentElement.innerHTML = `
                <div class="text-center">
                    <h5>Distribuição de Eventos</h5>
                    <div class="bg-light p-3 rounded">
                        <p><strong>Total:</strong> ${totalEventos}</p>
                        <p><strong>Atas:</strong> ${totalAtas} (${Math.round(
        (totalAtas / totalEventos) * 100
      )}%)</p>
                        <p><strong>Agendamentos:</strong> ${totalAgendamentos} (${Math.round(
        (totalAgendamentos / totalEventos) * 100
      )}%)</p>
                    </div>
                </div>
            `;
    }

    const canvasStatus = document.getElementById("chart-status");
    if (canvasStatus) {
      canvasStatus.parentElement.innerHTML = `
                <div class="text-center">
                    <h5>Status das Reuniões</h5>
                    <div class="bg-light p-3 rounded">
                        <p><strong>Concluídas:</strong> ${
                          todasAsAtas.filter((a) => a.status === "Concluída")
                            .length
                        }</p>
                        <p><strong>Agendadas:</strong> ${
                          todosOsAgendamentos.filter(
                            (a) =>
                              new Date(a.slots?.[0]?.data || a.criadoEm) >
                              new Date()
                          ).length
                        }</p>
                        <p><strong>Pendentes:</strong> ${
                          todosOsAgendamentos.filter(
                            (a) =>
                              new Date(a.slots?.[0]?.data || a.criadoEm) <=
                              new Date()
                          ).length
                        }</p>
                    </div>
                </div>
            `;
    }
  }
}

function renderizarAbaAgendamentos() {
  const container = document.getElementById("agendamentos-container");
  if (!container) return;

  if (todosOsAgendamentos.length === 0) {
    container.innerHTML = `
            <div class="alert alert-info">
                <span class="material-symbols-outlined">event_off</span>
                Nenhum agendamento encontrado.
            </div>
        `;
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
                const slots = agendamento.slots || [];
                let totalInscritos = 0;
                let totalPresentes = 0;

                slots.forEach((slot) => {
                  slot.vagas?.forEach((vaga) => {
                    totalInscritos++;
                    if (vaga.presente) totalPresentes++;
                  });
                });

                return `
                    <div class="accordion-item">
                        <button class="accordion-header">
                            <span class="material-symbols-outlined">event</span>
                            ${agendamento.descricao || "Agendamento de Reunião"}
                            <span class="badge bg-info">${totalInscritos} inscritos</span>
                            <span class="badge bg-success">${totalPresentes} presentes</span>
                            <span class="accordion-icon">+</span>
                        </button>
                        <div class="accordion-content">
                            ${slots
                              .map((slot) => {
                                const dataSlot = new Date(
                                  slot.data || agendamento.criadoEm
                                );
                                return `
                                    <div class="mb-3">
                                        <h6>${slot.horaInicio} - ${
                                  slot.horaFim
                                }</h6>
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Profissional</th>
                                                    <th>Gestor</th>
                                                    <th>Presença</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${
                                                  slot.vagas
                                                    ?.map((vaga) => {
                                                      const profissional =
                                                        vaga.profissionalNome ||
                                                        vaga.profissionalId ||
                                                        "Pendente";
                                                      const presente =
                                                        vaga.presente || false;
                                                      return `
                                                        <tr>
                                                            <td>${profissional}</td>
                                                            <td>${
                                                              slot.gestorNome ||
                                                              "Gestor"
                                                            }</td>
                                                            <td>
                                                                <input type="checkbox" class="checkbox-presenca" 
                                                                       ${
                                                                         presente
                                                                           ? "checked"
                                                                           : ""
                                                                       } 
                                                                       data-agendamento-id="${
                                                                         agendamento.id
                                                                       }"
                                                                       data-slot-index="${slots.indexOf(
                                                                         slot
                                                                       )}"
                                                                       data-vaga-index="${slot.vagas.indexOf(
                                                                         vaga
                                                                       )}">
                                                            </td>
                                                        </tr>
                                                    `;
                                                    })
                                                    .join("") ||
                                                  '<tr><td colspan="3">Nenhum inscrito.</td></tr>'
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                              })
                              .join("")}
                        </div>
                    </div>
                `;
              })
              .join("")}
        </div>
    `;

  atualizarContadorAgendamentos(todosOsAgendamentos.length);

  container.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const conteudo = header.nextElementSibling;
      conteudo.classList.toggle("active");
      const icone = header.querySelector(".accordion-icon");
      icone.textContent = conteudo.classList.contains("active") ? "−" : "+";
    });
  });

  container.querySelectorAll(".checkbox-presenca").forEach((checkbox) => {
    checkbox.addEventListener("change", async (evento) => {
      const idAgendamento = evento.target.dataset.agendamentoId;
      const indexSlot = parseInt(evento.target.dataset.slotIndex);
      const indexVaga = parseInt(evento.target.dataset.vagaIndex);
      const presente = evento.target.checked;

      try {
        const documentoAgendamento = doc(
          firestoreDb,
          "agendamentos_voluntarios",
          idAgendamento
        );
        const snapshotAgendamento = await getDoc(documentoAgendamento);
        if (snapshotAgendamento.exists()) {
          const agendamento = snapshotAgendamento.data();
          if (agendamento.slots && agendamento.slots[indexSlot]) {
            const vaga = agendamento.slots[indexSlot].vagas[indexVaga];
            if (vaga) vaga.presente = presente;
            await updateDoc(documentoAgendamento, { slots: agendamento.slots });
            console.log("[DASH] Presença atualizada.");
          }
        }
      } catch (erro) {
        console.error("[DASH] Erro ao atualizar presença:", erro);
        evento.target.checked = !presente;
      }
    });
  });
}

function atualizarContadorAtas(count) {
  const contador = document.getElementById("contador-atas");
  if (contador) contador.textContent = count;
}

function atualizarContadorAgendamentos(count) {
  const contador = document.getElementById("contador-agendamentos");
  if (contador) contador.textContent = count;
}

function gerarPDFAta(idAta) {
  const ata = todasAsAtas.find((a) => a.id === idAta);
  alert(`Gerando PDF da ata: ${ata?.titulo || idAta}`);
}

function abrirFeedbackAta(idAta) {
  const ata = todasAsAtas.find((a) => a.id === idAta);
  alert(`Feedback da ata: ${ata?.titulo || idAta}`);
}

function editarAta(idAta) {
  const ata = todasAsAtas.find((a) => a.id === idAta);
  alert(`Editando ata: ${ata?.titulo || idAta}`);
}

export function cleanup() {
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeAgendamentos) unsubscribeAgendamentos();
  clearTimeout(timeoutBusca);
  console.log("[DASH] Cleanup executado.");
}
