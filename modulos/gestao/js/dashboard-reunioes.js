// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 5.6 (Filtro Padrão Futuro + Histórico por Periodo)

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

/**
 * Função auxiliar para unificar Atas (gestao_atas) e Agendamentos (agendamentos_voluntarios).
 */
function getListaUnificada() {
  const listaUnificada = [];

  // 1. Adiciona as Atas existentes
  todasAsAtas.forEach((ata) => {
    listaUnificada.push({
      ...ata,
      origem: "ata",
      statusCalculado: ata.status || "Concluída",
      dataOrdenacao: new Date(ata.dataReuniao + "T00:00:00"),
    });
  });

  // 2. Processa Agendamentos de Voluntários
  todosOsAgendamentos.forEach((agendamento) => {
    if (agendamento.slots && Array.isArray(agendamento.slots)) {
      agendamento.slots.forEach((slot, index) => {
        const participantesSlot = (slot.vagas || []).map(
          (v) => v.nome || v.profissionalNome || "Anônimo"
        );

        listaUnificada.push({
          id: `${agendamento.id}_slot_${index}`,
          titulo: agendamento.tipo || "Agendamento",
          tipo: agendamento.tipo || "Reunião Agendada",
          dataReuniao: slot.data,
          horaInicio: slot.horaInicio,
          local: "Online",
          responsavel: slot.gestorNome || "Não especificado",
          participantes: participantesSlot,
          resumo: agendamento.descricao
            ? `(Descrição do Agendamento): ${agendamento.descricao.substring(
                0,
                100
              )}...`
            : "",
          origem: "agendamento",
          statusCalculado: "Agendada",
          dataOrdenacao: new Date(`${slot.data}T${slot.horaInicio}:00`),
          linkOriginal: agendamento.id,
        });
      });
    }
  });

  return listaUnificada;
}

export function init() {
  console.log(
    "[DASH] Dashboard iniciado (v5.6 - Filtros de Data e Layout Atualizado)."
  );
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
  const dataInicio = document.getElementById("filtro-data-inicio");
  const dataFim = document.getElementById("filtro-data-fim");
  const buscaInput = document.getElementById("busca-titulo");
  const limparBtn = document.getElementById("limpar-filtros");

  if (tipoFiltro)
    tipoFiltro.addEventListener("change", aplicarFiltrosEExibirAtas);
  if (dataInicio)
    dataInicio.addEventListener("change", aplicarFiltrosEExibirAtas);
  if (dataFim) dataFim.addEventListener("change", aplicarFiltrosEExibirAtas);

  if (buscaInput) {
    buscaInput.addEventListener("input", () => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  if (limparBtn)
    limparBtn.addEventListener("click", () => {
      if (tipoFiltro) tipoFiltro.value = "Todos";
      if (buscaInput) buscaInput.value = "";
      if (dataInicio) dataInicio.value = "";
      if (dataFim) dataFim.value = "";
      aplicarFiltrosEExibirAtas();
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
    aplicarFiltrosEExibirAtas();
    atualizarGraficos();
  });
}

function aplicarFiltrosEExibirAtas() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";
  const dataInicioVal = document.getElementById("filtro-data-inicio")?.value;
  const dataFimVal = document.getElementById("filtro-data-fim")?.value;

  let itensFiltrados = getListaUnificada();

  // 1. Filtro por Tipo
  if (tipoFiltro !== "Todos") {
    itensFiltrados = itensFiltrados.filter((item) =>
      item.tipo?.toLowerCase().includes(tipoFiltro.toLowerCase())
    );
  }

  // 2. Filtro por Texto
  if (buscaTermo) {
    itensFiltrados = itensFiltrados.filter((item) =>
      item.titulo?.toLowerCase().includes(buscaTermo)
    );
  }

  // 3. Filtro de Data (Lógica solicitada)
  const agora = new Date();
  agora.setHours(0, 0, 0, 0); // Zera hora para comparar apenas data

  if (dataInicioVal || dataFimVal) {
    // Se houver qualquer data selecionada, usa o filtro de período (Histórico)
    if (dataInicioVal) {
      const dtIni = new Date(dataInicioVal);
      itensFiltrados = itensFiltrados.filter(
        (item) => item.dataOrdenacao >= dtIni
      );
    }
    if (dataFimVal) {
      const dtFim = new Date(dataFimVal);
      // Ajusta para final do dia para incluir a data selecionada
      dtFim.setHours(23, 59, 59, 999);
      itensFiltrados = itensFiltrados.filter(
        (item) => item.dataOrdenacao <= dtFim
      );
    }
  } else {
    // PADRÃO: Se não houver data selecionada, mostra SOMENTE FUTURAS (>= hoje)
    itensFiltrados = itensFiltrados.filter(
      (item) => item.dataOrdenacao >= agora
    );
  }

  // Ordenação:
  // Se for visualização padrão (futuras), ordena Crescente (mais próxima primeiro).
  // Se for histórico (com datas), ordena Decrescente (mais recente primeiro).
  if (!dataInicioVal && !dataFimVal) {
    itensFiltrados.sort((a, b) => a.dataOrdenacao - b.dataOrdenacao);
  } else {
    itensFiltrados.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);
  }

  const container = document.getElementById("atas-container");
  if (!container) return;

  if (itensFiltrados.length === 0) {
    const msg =
      dataInicioVal || dataFimVal
        ? "Nenhuma reunião encontrada no período selecionado."
        : "Nenhuma reunião agendada para o futuro. Use os filtros de data para ver o histórico.";

    container.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">event_busy</span>
                <br>${msg}
            </div>
        `;
    atualizarContadorAtas(0);
    return;
  }

  container.innerHTML = itensFiltrados
    .map((item) => {
      const dataItem = item.dataOrdenacao;
      const ehFutura = dataItem >= agora;

      let statusCor = "text-success";
      let iconeStatus = "check_circle";

      if (ehFutura || item.statusCalculado === "Agendada") {
        statusCor = "text-info";
        iconeStatus = "event";
      }

      const participantes = item.participantes || [];
      const previewParticipantes = participantes.slice(0, 3);
      const maisParticipantes =
        participantes.length > 3 ? `+${participantes.length - 3}` : "";

      const horarioDisplay = item.horaInicio ? ` às ${item.horaInicio}` : "";

      const botaoAcao =
        item.origem === "agendamento"
          ? `<button class="btn btn-sm btn-outline-secondary" title="Ver Detalhes/Inscritos" 
                onclick="event.stopPropagation(); const content = this.closest('.ata-item').querySelector('.ata-conteudo'); content.style.display = content.style.display === 'none' ? 'block' : 'none';">
                <span class="material-symbols-outlined">visibility</span>
           </button>`
          : `<button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar Ata" onclick="event.stopPropagation(); window.location.hash = '#ata-de-reuniao';">
                <span class="material-symbols-outlined">edit</span>
           </button>`;

      return `
            <div class="ata-item card mb-4" data-id="${item.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" 
                     style="cursor: pointer;"
                     onclick="const content = this.parentElement.querySelector('.ata-conteudo'); content.style.display = content.style.display === 'none' ? 'block' : 'none';">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="material-symbols-outlined me-2" style="color: ${
                              ehFutura ? "#0dcaf0" : "#198754"
                            };">${iconeStatus}</span>
                            <h5 class="mb-0">${
                              item.titulo || item.tipo || "Reunião"
                            }</h5>
                            ${
                              item.origem === "agendamento"
                                ? '<span class="badge bg-info text-dark ms-2" style="font-size: 0.7em;">Agendada</span>'
                                : ""
                            }
                        </div>
                        <small class="text-muted">${dataItem.toLocaleDateString(
                          "pt-BR"
                        )}${horarioDisplay}</small>
                    </div>
                    <div class="ata-acoes">
                        ${
                          item.origem === "ata"
                            ? `
                            <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="Visualizar PDF (Em breve)" onclick="event.stopPropagation(); alert('Funcionalidade de PDF em desenvolvimento.');">
                                <span class="material-symbols-outlined">picture_as_pdf</span>
                            </button>
                        `
                            : ""
                        }
                        ${botaoAcao}
                    </div>
                </div>
                <div class="ata-conteudo card-body" style="display: none; border-top: 1px solid #e5e7eb;">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <p><strong>Tipo:</strong> ${
                              item.tipo || "Não especificado"
                            }</p>
                            <p><strong>Data:</strong> ${dataItem.toLocaleDateString(
                              "pt-BR"
                            )}${horarioDisplay}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Local:</strong> ${
                              item.local || "Online"
                            }</p>
                            <p><strong>Responsável:</strong> ${
                              item.responsavel || "Não especificado"
                            }</p>
                        </div>
                    </div>
                    ${
                      participantes.length > 0
                        ? `
                        <div class="mb-3 mt-3">
                            <h6 class="text-primary"><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: text-bottom;">group</span> Participantes Inscritos</h6>
                            <div class="d-flex flex-wrap gap-1">
                                ${previewParticipantes
                                  .map(
                                    (nome) =>
                                      `<span class="badge bg-light text-dark border">${nome}</span>`
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
                        : `
                        <div class="mb-3 mt-3">
                            <p class="text-muted fst-italic">Nenhum participante inscrito ainda.</p>
                        </div>
                    `
                    }
                    ${
                      item.resumo
                        ? `
                        <div class="mb-3">
                            <h6 class="text-primary">Descrição</h6>
                            <p class="small text-muted">${item.resumo}</p>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");

  atualizarContadorAtas(itensFiltrados.length);
}

function atualizarGraficos() {
  const agora = new Date();
  const listaUnificada = getListaUnificada();

  const totalGeral = listaUnificada.length;

  const reunioesFuturas = listaUnificada.filter(
    (item) => item.dataOrdenacao > agora
  ).length;
  const reunioesConcluidas = listaUnificada.filter(
    (item) =>
      item.dataOrdenacao < agora &&
      (item.statusCalculado === "Concluída" || item.origem === "ata")
  ).length;

  const totalEl = document.getElementById("total-reunioes");
  const proximasEl = document.getElementById("proximas-reunioes");
  const concluidasEl = document.getElementById("reunioes-concluidas");

  if (totalEl) totalEl.textContent = totalGeral;
  if (proximasEl) proximasEl.textContent = reunioesFuturas;
  if (concluidasEl) concluidasEl.textContent = reunioesConcluidas;

  renderizarTabelaAtasPorTipo(listaUnificada);
  renderizarTabelaAgendamentosPorGestor();
  renderizarProximaReuniao(listaUnificada);
}

function renderizarTabelaAtasPorTipo(listaUnificada) {
  const container = document.getElementById("grafico-atas-tipo");
  if (!container) return;

  const contagemPorTipo = {};
  listaUnificada.forEach((item) => {
    const tipo = item.tipo || "Outros";
    contagemPorTipo[tipo] = (contagemPorTipo[tipo] || 0) + 1;
  });

  const total = listaUnificada.length;
  if (total === 0) {
    container.innerHTML =
      '<div class="alert alert-info p-2 text-center">Sem dados.</div>';
    return;
  }

  const linhas = Object.entries(contagemPorTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, qtd]) => {
      const percentual = total > 0 ? Math.round((qtd / total) * 100) : 0;
      return `
                <tr>
                    <td><small>${tipo}</small></td>
                    <td class="text-center">${qtd}</td>
                    <td class="text-center"><small>${percentual}%</small></td>
                    <td><div class="progress" style="height: 10px;"><div class="progress-bar" style="width: ${percentual}%"></div></div></td>
                </tr>
            `;
    })
    .join("");

  container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm table-borderless mb-0">
                <thead><tr><th>Tipo</th><th class="text-center">Qtd</th><th class="text-center">%</th><th></th></tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
    `;
}

function renderizarTabelaAgendamentosPorGestor() {
  const container = document.getElementById("grafico-agendamentos-gestor");
  if (!container) return;

  const agendamentosPorGestor = {};
  todosOsAgendamentos.forEach((agendamento) => {
    (agendamento.slots || []).forEach((slot) => {
      const nome = slot.gestorNome || "N/A";
      agendamentosPorGestor[nome] =
        (agendamentosPorGestor[nome] || 0) + (slot.vagas || []).length;
    });
  });

  if (Object.keys(agendamentosPorGestor).length === 0) {
    container.innerHTML =
      '<div class="alert alert-info p-2 text-center">Sem agendamentos.</div>';
    return;
  }

  const linhas = Object.entries(agendamentosPorGestor)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([gestor, qtd]) =>
        `<tr><td><small>${gestor}</small></td><td class="text-center">${qtd}</td></tr>`
    )
    .join("");

  container.innerHTML = `<table class="table table-sm"><thead><tr><th>Gestor</th><th class="text-center">Inscritos</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function renderizarProximaReuniao(listaUnificada) {
  const agora = new Date();
  const proximas = listaUnificada
    .filter((item) => item.dataOrdenacao > agora)
    .sort((a, b) => a.dataOrdenacao - b.dataOrdenacao);

  const proximaContainer = document.getElementById("proxima-reuniao-container");
  const infoEl = document.getElementById("proxima-reuniao-info");

  if (!proximaContainer || !infoEl) return;

  if (proximas.length === 0) {
    proximaContainer.style.display = "none";
    return;
  }

  proximaContainer.style.display = "block";
  const proxima = proximas[0];
  const diffMs = proxima.dataOrdenacao - agora;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let tempoTexto = dias === 0 ? "É hoje!" : `Em ${dias} dias`;

  infoEl.innerHTML = `
        <h5 class="text-white">${proxima.titulo || "Reunião"}</h5>
        <p class="mb-1 text-white"><span class="material-symbols-outlined" style="font-size:16px; color: white; vertical-align:middle">event</span> ${proxima.dataOrdenacao.toLocaleString(
          "pt-BR",
          { dateStyle: "short", timeStyle: "short" }
        )}</p>
        <p class="mb-2 text-white" style=color: white;><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle">location_on</span> ${
          proxima.local || "Online"
        }</p>
        <p class="fw-bold text-warning mb-0">${tempoTexto}</p>
    `;

  const detalhesBtn = document.getElementById("ver-detalhes-proxima");
  if (detalhesBtn) {
    detalhesBtn.onclick = () => {
      const card = document.querySelector(`.ata-item[data-id="${proxima.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        const content = card.querySelector(".ata-conteudo");
        if (content && content.style.display === "none") {
          content.style.display = "block";
          card.style.transition = "box-shadow 0.3s";
          card.style.boxShadow = "0 0 15px rgba(13, 110, 253, 0.5)";
          setTimeout(() => (card.style.boxShadow = ""), 1500);
        }
      } else {
        alert("Detalhes indisponíveis na lista atual (verifique os filtros).");
      }
    };
  }

  const calendarioBtn = document.getElementById("calendario-proxima");
  if (calendarioBtn)
    calendarioBtn.onclick = () => {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        proxima.titulo
      )}&dates=${
        proxima.dataOrdenacao.toISOString().replace(/[-:]/g, "").split(".")[0]
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
}
