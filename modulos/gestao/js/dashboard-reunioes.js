// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 5.4 (Unificação de Atas e Agendamentos no Dashboard)

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
 * Transforma os slots de agendamentos em objetos compatíveis com a estrutura de atas.
 */
function getListaUnificada() {
  const listaUnificada = [];

  // 1. Adiciona as Atas existentes (copiando propriedades)
  todasAsAtas.forEach((ata) => {
    listaUnificada.push({
      ...ata,
      origem: "ata",
      statusCalculado: ata.status || "Concluída", // Assume concluída se não tiver status
      dataOrdenacao: new Date(ata.dataReuniao + "T00:00:00"), // Assume YYYY-MM-DD
    });
  });

  // 2. Processa Agendamentos de Voluntários e seus Slots
  todosOsAgendamentos.forEach((agendamento) => {
    if (agendamento.slots && Array.isArray(agendamento.slots)) {
      agendamento.slots.forEach((slot, index) => {
        // Mapeia participantes do slot
        const participantesSlot = (slot.vagas || []).map(
          (v) => v.nome || v.profissionalNome || "Anônimo"
        );

        // Cria objeto compatível
        listaUnificada.push({
          id: `${agendamento.id}_slot_${index}`, // ID virtual único
          titulo: agendamento.tipo || "Agendamento",
          tipo: agendamento.tipo || "Reunião Agendada",
          dataReuniao: slot.data,
          horaInicio: slot.horaInicio, // Extra para exibição
          local: "Online", // Padrão para agendamentos desse tipo
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
          linkOriginal: agendamento.id, // Referência para ações futuras se necessário
        });
      });
    }
  });

  return listaUnificada;
}

export function init() {
  console.log(
    "[DASH] Dashboard iniciado (v5.4 - Unificado Atas e Agendamentos)."
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
  if (tipoFiltro)
    tipoFiltro.addEventListener("change", aplicarFiltrosEExibirAtas);

  const buscaInput = document.getElementById("busca-titulo");
  if (buscaInput) {
    buscaInput.addEventListener("input", () => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(aplicarFiltrosEExibirAtas, 300);
    });
  }

  const limparBtn = document.getElementById("limpar-filtros");
  if (limparBtn)
    limparBtn.addEventListener("click", () => {
      if (tipoFiltro) tipoFiltro.value = "Todos";
      if (buscaInput) buscaInput.value = "";
      aplicarFiltrosEExibirAtas();
    });
}

function alternarAba(abaId) {
  console.log("[DASH] Alternando para aba:", abaId);
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
  // Carrega Atas
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
    // Atualiza interface sempre que houver mudança
    aplicarFiltrosEExibirAtas();
    atualizarGraficos();
    console.log(`[DASH] Atas carregadas: ${todasAsAtas.length}`);
  });

  // Carrega Agendamentos
  const qAgendamentos = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );
  unsubscribeAgendamentos = onSnapshot(qAgendamentos, (snapshot) => {
    todosOsAgendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Atualiza interface sempre que houver mudança
    aplicarFiltrosEExibirAtas();
    atualizarGraficos();
    console.log(
      `[DASH] Agendamentos carregados: ${todosOsAgendamentos.length}`
    );
  });
}

function aplicarFiltrosEExibirAtas() {
  const tipoFiltro = document.getElementById("tipo-filtro")?.value || "Todos";
  const buscaTermo =
    document.getElementById("busca-titulo")?.value.toLowerCase() || "";

  // Usa a lista unificada em vez de apenas todasAsAtas
  let itensFiltrados = getListaUnificada();

  if (tipoFiltro !== "Todos") {
    itensFiltrados = itensFiltrados.filter((item) =>
      item.tipo?.toLowerCase().includes(tipoFiltro.toLowerCase())
    );
  }

  if (buscaTermo) {
    itensFiltrados = itensFiltrados.filter((item) =>
      item.titulo?.toLowerCase().includes(buscaTermo)
    );
  }

  // Ordena por data (mais recente primeiro)
  itensFiltrados.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

  const container = document.getElementById("atas-container");
  if (!container) return;

  if (itensFiltrados.length === 0) {
    container.innerHTML = `
            <div class="alert alert-info text-center">
                <span class="material-symbols-outlined">search_off</span>
                Nenhuma reunião ou ata encontrada.
            </div>
        `;
    atualizarContadorAtas(0);
    return;
  }

  container.innerHTML = itensFiltrados
    .map((item) => {
      // Lógica de Data e Status
      const dataItem = item.dataOrdenacao;
      const agora = new Date();
      // Considera futura se a data for maior que agora
      const ehFutura = dataItem > agora;

      let statusCor = "text-success";
      let iconeStatus = "check_circle";

      if (ehFutura || item.statusCalculado === "Agendada") {
        statusCor = "text-info";
        iconeStatus = "schedule";
      }

      // Preparação de participantes para exibição
      const participantes = item.participantes || [];
      const previewParticipantes = participantes.slice(0, 3);
      const maisParticipantes =
        participantes.length > 3 ? `+${participantes.length - 3}` : "";

      // Exibe horário se disponível (comum em agendamentos)
      const horarioDisplay = item.horaInicio ? ` às ${item.horaInicio}` : "";

      return `
            <div class="ata-item card mb-4" data-id="${item.id}">
                <div class="card-header d-flex justify-content-between align-items-center p-3" onclick="this.parentElement.querySelector('.ata-conteudo').style.display = this.parentElement.querySelector('.ata-conteudo').style.display === 'none' ? 'block' : 'none';">
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
                            <button class="btn btn-sm btn-outline-primary btn-pdf me-1" title="PDF" onclick="event.stopPropagation(); alert('PDF: ${item.id}');">
                                <span class="material-symbols-outlined">picture_as_pdf</span>
                            </button>
                            <button class="btn btn-sm btn-outline-success btn-feedback me-1" title="Feedback" onclick="event.stopPropagation(); alert('Feedback: ${item.id}');">
                                <span class="material-symbols-outlined">feedback</span>
                            </button>
                        `
                            : ""
                        }
                        ${
                          item.origem === "agendamento"
                            ? `
                            <button class="btn btn-sm btn-outline-secondary" title="Ver Detalhes" onclick="event.stopPropagation(); alert('Detalhes do Agendamento ID: ${item.linkOriginal}');">
                                <span class="material-symbols-outlined">visibility</span>
                            </button>
                        `
                            : `
                            <button class="btn btn-sm btn-outline-secondary btn-editar" title="Editar" onclick="event.stopPropagation(); alert('Editar: ${item.id}');">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                        `
                        }
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
                        <div class="mb-3">
                            <h6>Participantes (Inscritos/Presentes)</h6>
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
                            <small class="text-muted">Total: ${
                              participantes.length
                            }</small>
                        </div>
                    `
                        : ""
                    }
                    ${
                      item.resumo
                        ? `
                        <div class="mb-3">
                            <h6>Resumo / Descrição</h6>
                            <p>${item.resumo}</p>
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

  // Filtra Futuras (Data > Agora)
  const reunioesFuturas = listaUnificada.filter((item) => {
    return item.dataOrdenacao > agora;
  }).length;

  // Filtra Concluídas (Data < Agora E Status == Concluída ou origem Ata)
  const reunioesConcluidas = listaUnificada.filter((item) => {
    return (
      item.dataOrdenacao < agora &&
      (item.statusCalculado === "Concluída" || item.origem === "ata")
    );
  }).length;

  const totalEl = document.getElementById("total-reunioes");
  const proximasEl = document.getElementById("proximas-reunioes");
  const concluidasEl = document.getElementById("reunioes-concluidas");

  if (totalEl) totalEl.textContent = totalGeral;
  if (proximasEl) proximasEl.textContent = reunioesFuturas;
  if (concluidasEl) concluidasEl.textContent = reunioesConcluidas;

  renderizarTabelaAtasPorTipo(listaUnificada);
  renderizarTabelaAgendamentosPorGestor(); // Mantém lógica original para este gráfico específico
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
    container.innerHTML = `
            <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
                <h5 class="mb-0">
                    <span class="material-symbols-outlined me-2" style="vertical-align: middle;">bar_chart</span>
                    Reuniões por Tipo
                </h5>
            </div>
            <div class="alert alert-info text-center">
                <p class="mb-0">Nenhuma reunião registrada.</p>
            </div>
        `;
    return;
  }

  const linhas = Object.entries(contagemPorTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, qtd]) => {
      const percentual = total > 0 ? Math.round((qtd / total) * 100) : 0;
      return `
                <tr>
                    <td><strong>${tipo}</strong></td>
                    <td class="text-center">${qtd}</td>
                    <td class="text-center">
                        <span class="badge bg-primary">${percentual}%</span>
                    </td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${percentual}%"></div>
                        </div>
                    </td>
                </tr>
            `;
    })
    .join("");

  container.innerHTML = `
        <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
            <h5 class="mb-0">
                <span class="material-symbols-outlined me-2" style="vertical-align: middle;">bar_chart</span>
                Reuniões por Tipo
            </h5>
        </div>
        <div class="table-responsive">
            <table class="table table-hover table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Tipo de Reunião</th>
                        <th class="text-center">Qtd</th>
                        <th class="text-center">%</th>
                        <th>Visualização</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;
}

function renderizarTabelaAgendamentosPorGestor() {
  const container = document.getElementById("grafico-agendamentos-gestor");
  if (!container) return;

  const agendamentosPorGestor = {};
  let totalAgendamentosComGestor = 0;

  todosOsAgendamentos.forEach((agendamento) => {
    (agendamento.slots || []).forEach((slot) => {
      const gestorNome = slot.gestorNome || "Gestor não especificado";
      const vagas = (slot.vagas || []).length;
      agendamentosPorGestor[gestorNome] =
        (agendamentosPorGestor[gestorNome] || 0) + vagas;
      totalAgendamentosComGestor += vagas;
    });
  });

  if (totalAgendamentosComGestor === 0) {
    container.innerHTML = `
            <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
                <h5 class="mb-0">
                    <span class="material-symbols-outlined me-2" style="vertical-align: middle;">group</span>
                    Agendamentos com Voluntários por Gestor
                </h5>
            </div>
            <div class="alert alert-info text-center">
                <p class="mb-0">Nenhum agendamento encontrado.</p>
            </div>
        `;
    return;
  }

  // Calcula presença por gestor
  const presencaPorGestor = {};
  todosOsAgendamentos.forEach((agendamento) => {
    (agendamento.slots || []).forEach((slot) => {
      const gestorNome = slot.gestorNome || "Gestor não especificado";
      if (!presencaPorGestor[gestorNome]) {
        presencaPorGestor[gestorNome] = { total: 0, presente: 0 };
      }
      (slot.vagas || []).forEach((vaga) => {
        presencaPorGestor[gestorNome].total++;
        if (vaga.presente) presencaPorGestor[gestorNome].presente++;
      });
    });
  });

  const linhas = Object.entries(agendamentosPorGestor)
    .sort((a, b) => b[1] - a[1])
    .map(([gestor, qtd]) => {
      const percentual =
        totalAgendamentosComGestor > 0
          ? Math.round((qtd / totalAgendamentosComGestor) * 100)
          : 0;

      // Calcula presença deste gestor
      const dadosPresenca = presencaPorGestor[gestor] || {
        total: 0,
        presente: 0,
      };
      const percentualPresenca =
        dadosPresenca.total > 0
          ? Math.round((dadosPresenca.presente / dadosPresenca.total) * 100)
          : 0;

      let corPresenca = "bg-danger";
      if (percentualPresenca >= 75) corPresenca = "bg-success";
      else if (percentualPresenca >= 50) corPresenca = "bg-warning";

      const iconePresenca =
        percentualPresenca >= 75
          ? "check_circle"
          : percentualPresenca >= 50
          ? "schedule"
          : "close";

      return `
                <tr>
                    <td><strong>${gestor}</strong></td>
                    <td class="text-center">${qtd}</td>
                    <td class="text-center">
                        <span class="badge bg-success">${percentual}%</span>
                    </td>
                    <td class="text-center">
                        <div class="d-flex align-items-center justify-content-center gap-2">
                            <span class="material-symbols-outlined ${
                              corPresenca === "bg-success"
                                ? "text-success"
                                : corPresenca === "bg-warning"
                                ? "text-warning"
                                : "text-danger"
                            }" style="font-size: 20px;">${iconePresenca}</span>
                            <span class="badge ${corPresenca}">${
        dadosPresenca.presente
      }/${dadosPresenca.total} (${percentualPresenca}%)</span>
                        </div>
                    </td>
                </tr>
            `;
    })
    .join("");

  container.innerHTML = `
        <div class="card-header bg-light p-3 mb-3" style="border-radius: 4px;">
            <h5 class="mb-0">
                <span class="material-symbols-outlined me-2" style="vertical-align: middle;">group</span>
                Agendamentos com Voluntários por Gestor
            </h5>
        </div>
        <div class="table-responsive">
            <table class="table table-hover table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Gestor</th>
                        <th class="text-center">Agendamentos</th>
                        <th class="text-center">Percentual</th>
                        <th class="text-center">Presença</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;
}

function renderizarProximaReuniao(listaUnificada) {
  const agora = new Date();

  // Filtra apenas as futuras
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
  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let tempoTexto = "";
  if (dias > 0) tempoTexto = `Em ${dias} dia${dias > 1 ? "s" : ""}`;
  else if (horas > 0) tempoTexto = `Em ${horas} hora${horas > 1 ? "s" : ""}`;
  else if (minutos > 0)
    tempoTexto = `Em ${minutos} minuto${minutos > 1 ? "s" : ""}`;
  else tempoTexto = "Em breve!";

  infoEl.innerHTML = `
        <h5>${proxima.titulo || proxima.tipo || "Reunião"}</h5>
        <p><strong>Tipo:</strong> ${proxima.tipo || "Não especificado"}</p>
        <p><strong>Data:</strong> ${proxima.dataOrdenacao.toLocaleString(
          "pt-BR",
          {
            dateStyle: "full",
            timeStyle: "short",
          }
        )}</p>
        <p><strong>Local:</strong> ${proxima.local || "Online"}</p>
        <p class="fw-bold text-primary">${tempoTexto}</p>
    `;

  const detalhesBtn = document.getElementById("ver-detalhes-proxima");
  if (detalhesBtn)
    detalhesBtn.onclick = () =>
      alert(`Detalhes da reunião: ${proxima.titulo || "ID " + proxima.id}`);

  const calendarioBtn = document.getElementById("calendario-proxima");
  if (calendarioBtn)
    calendarioBtn.onclick = () => {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        proxima.titulo || "Reunião"
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
  console.log("[DASH] Cleanup.");
}
