// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 1.0 (Relatórios Avançados - Baseado em Eventos)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let todosDados = [];
let vistaAtual = "pendencias";

export async function init() {
  console.log("[RELATÓRIOS] Iniciando módulo...");
  configurarEventos();
  await carregarDados();
}

function configurarEventos() {
  // Abas
  document.querySelectorAll(".rel-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".rel-tab")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      vistaAtual = e.currentTarget.dataset.view;

      // Mostra/Oculta botão imprimir
      const btnPrint = document.getElementById("btn-imprimir");
      if (btnPrint)
        btnPrint.style.display = vistaAtual === "historico" ? "block" : "none";

      renderizarVistaAtual();
    });
  });

  // Filtros
  document
    .getElementById("btn-aplicar-filtros")
    .addEventListener("click", renderizarVistaAtual);

  // Exportar
  document
    .getElementById("btn-exportar-csv")
    .addEventListener("click", exportarCSV);

  // Imprimir
  document
    .getElementById("btn-imprimir")
    .addEventListener("click", () => window.print());
}

async function carregarDados() {
  const container = document.getElementById("relatorio-content");
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );
    const snapshot = await getDocs(q);

    todosDados = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const slots = data.slots || [];

      // Se for evento com slots (moderno)
      if (slots.length > 0) {
        slots.forEach((slot) => {
          todosDados.push(normalizarEvento(data, slot));
        });
      } else {
        // Evento simples/legado
        todosDados.push(normalizarEvento(data, null));
      }
    });

    console.log(`[RELATÓRIOS] ${todosDados.length} registros processados.`);
    renderizarVistaAtual();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados: ${error.message}</div>`;
  }
}

function normalizarEvento(raiz, slot) {
  // Se slot existe, usa dados dele, senão usa dados da raiz
  const base = slot || raiz;
  const dataIso = slot
    ? slot.data
    : raiz.dataReuniao || raiz.criadoEm?.toDate().toISOString().split("T")[0];

  return {
    tipo: raiz.tipo,
    titulo: raiz.tipo,
    data: dataIso,
    dataObj: new Date(dataIso + "T00:00:00"),
    gestor: base.gestorNome || raiz.responsavel || "N/A",
    // Arrays de interesse
    planoDeAcao: base.planoDeAcao || [],
    encaminhamentos: base.encaminhamentos || [],
    feedbacks: base.feedbacks || [],
    vagas: base.vagas || [], // Inscritos
    // Status
    status: base.status || "Agendada",
    // Detalhes Ata
    pontos: base.pontos || "",
    decisoes: base.decisoes || "",
    pauta: raiz.descricao || raiz.pauta || "",
  };
}

function filtrarDados() {
  const inicio = document.getElementById("rel-data-inicio").value;
  const fim = document.getElementById("rel-data-fim").value;
  const busca = document.getElementById("rel-busca").value.toLowerCase();

  let filtrados = todosDados;

  if (inicio) {
    const dIni = new Date(inicio);
    filtrados = filtrados.filter((d) => d.dataObj >= dIni);
  }
  if (fim) {
    const dFim = new Date(fim);
    dFim.setHours(23, 59, 59);
    filtrados = filtrados.filter((d) => d.dataObj <= dFim);
  }
  if (busca) {
    filtrados = filtrados.filter(
      (d) =>
        d.titulo.toLowerCase().includes(busca) ||
        d.gestor.toLowerCase().includes(busca)
    );
  }

  return filtrados;
}

function renderizarVistaAtual() {
  const dados = filtrarDados();
  const container = document.getElementById("relatorio-content");
  container.innerHTML = "";

  switch (vistaAtual) {
    case "pendencias":
      renderPendencias(dados, container);
      break;
    case "qualitativo":
      renderQualitativo(dados, container);
      break;
    case "performance":
      renderPerformance(dados, container);
      break;
    case "historico":
      renderHistorico(dados, container);
      break;
  }
}

// ============================================================================
// A. RELATÓRIO DE PENDÊNCIAS E GARGALOS
// ============================================================================
function renderPendencias(dados, container) {
  let html = `
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Data Origem</th>
                    <th>Tarefa / Pendência</th>
                    <th>Responsável</th>
                    <th>Tipo</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>`;

  let count = 0;
  dados.forEach((evento) => {
    // Junta Plano de Ação e Encaminhamentos
    const tarefas = [
      ...evento.planoDeAcao.map((t) => ({ ...t, origem: "Ação" })),
      ...evento.encaminhamentos.map((t) => ({
        ...t,
        origem: "Encaminhamento",
      })),
    ];

    tarefas.forEach((t) => {
      // Filtra APENAS ATRASADOS (Conforme solicitado)
      // Opcional: Remover o if abaixo para ver todas as tarefas
      if (t.status === "Atrasado") {
        const responsavel = t.responsavel || t.nomeEncaminhado || "N/A";
        const desc = t.descricao || t.motivo || "Sem descrição";
        const dataF = evento.dataObj.toLocaleDateString("pt-BR");

        html += `
                    <tr>
                        <td>${dataF}</td>
                        <td>${desc}<br><small class="text-muted">${evento.titulo}</small></td>
                        <td>${responsavel}</td>
                        <td>${t.origem}</td>
                        <td><span class="status-atrasado">Atrasado</span></td>
                    </tr>`;
        count++;
      }
    });
  });

  html += `</tbody></table>`;

  if (count === 0) {
    container.innerHTML = `<div class="alert alert-success">Nenhuma pendência atrasada encontrada no período.</div>`;
  } else {
    container.innerHTML =
      `<div class="mb-2 text-end text-danger fw-bold">Total Atrasado: ${count}</div>` +
      html;
  }
}

// ============================================================================
// B. RELATÓRIO QUALITATIVO DE FEEDBACK
// ============================================================================
function renderQualitativo(dados, container) {
  let html = `
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Reunião</th>
                    <th>Participante</th>
                    <th>Avaliação</th>
                    <th>Sugestões / Comentários</th>
                </tr>
            </thead>
            <tbody>`;

  let count = 0;
  dados.forEach((evento) => {
    evento.feedbacks.forEach((fb) => {
      const dataF = evento.dataObj.toLocaleDateString("pt-BR");
      const nome = fb.nome || "Anônimo";
      const sugestao = fb.sugestaoTema || fb.comentarios || "-";

      // Calcula "Nota" baseada nas respostas binárias
      let nota = 0;
      if (fb.clareza === "Sim") nota += 5;
      if (fb.objetivos === "Sim") nota += 5;
      // Escala 0 a 10

      html += `
                <tr>
                    <td>${dataF}</td>
                    <td>${evento.titulo}</td>
                    <td>${nome}</td>
                    <td>${nota}/10</td>
                    <td>${sugestao}</td>
                </tr>`;
      count++;
    });
  });

  html += `</tbody></table>`;
  if (count === 0)
    container.innerHTML = `<div class="alert alert-info">Nenhum feedback registrado no período.</div>`;
  else container.innerHTML = html;
}

// ============================================================================
// C. RELATÓRIO DE PERFORMANCE DE GESTORES
// ============================================================================
function renderPerformance(dados, container) {
  const stats = {};

  dados.forEach((evento) => {
    const gestor = evento.gestor;
    if (!stats[gestor]) {
      stats[gestor] = { nome: gestor, slots: 0, atendimentos: 0 };
    }
    stats[gestor].slots++;
    stats[gestor].atendimentos += evento.vagas.length || 0;
  });

  // Converte para array e ordena por atendimentos
  const lista = Object.values(stats).sort(
    (a, b) => b.atendimentos - a.atendimentos
  );

  let html = `
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Nome do Gestor</th>
                    <th class="text-center">Total Slots Criados</th>
                    <th class="text-center">Atendimentos Realizados</th>
                    <th class="text-center">Taxa de Ocupação</th>
                </tr>
            </thead>
            <tbody>`;

  lista.forEach((s) => {
    // Taxa aproximada (Atendimentos / Slots).
    // Nota: Em reuniões coletivas, atendimentos > slots, então taxa pode passar de 100%.
    const taxa = s.slots > 0 ? Math.round((s.atendimentos / s.slots) * 100) : 0;

    // Define cor da barra
    let cor = taxa < 50 ? "bg-warning" : "bg-success";

    html += `
            <tr>
                <td><strong>${s.nome}</strong></td>
                <td class="text-center">${s.slots}</td>
                <td class="text-center">${s.atendimentos}</td>
                <td style="width: 200px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 10px;">
                            <div class="progress-bar ${cor}" style="width: ${Math.min(
      taxa,
      100
    )}%"></div>
                        </div>
                        <span class="small fw-bold">${taxa}%</span>
                    </div>
                </td>
            </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ============================================================================
// D. HISTÓRICO COMPLETO DE ATAS (FORMAL)
// ============================================================================
function renderHistorico(dados, container) {
  // Filtra apenas concluídas para o histórico formal
  const concluidas = dados
    .filter((d) => d.status === "Concluída")
    .sort((a, b) => b.dataObj - a.dataObj);

  if (concluidas.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">Nenhuma ata concluída encontrada para gerar o histórico.</div>`;
    return;
  }

  let html = ``;

  concluidas.forEach((ata) => {
    const dataF = ata.dataObj.toLocaleDateString("pt-BR");

    // Participantes formatados
    const listaPart =
      (ata.vagas.length > 0
        ? ata.vagas.map((v) => v.nome || v.profissionalNome)
        : []
      ).join(", ") || "Conforme lista de presença anexa.";

    // Tarefas formatadas
    let tarefasHtml = "<ul>";
    [...ata.planoDeAcao, ...ata.encaminhamentos].forEach((t) => {
      tarefasHtml += `<li><strong>${t.responsavel || "N/A"}:</strong> ${
        t.descricao || t.motivo
      } (Prazo: ${t.prazo || "N/A"})</li>`;
    });
    tarefasHtml += "</ul>";
    if (tarefasHtml === "<ul></ul>")
      tarefasHtml = "<p>Nenhuma tarefa registrada.</p>";

    html += `
            <div class="ata-documento">
                <div class="ata-header">
                    <h3>ATA DE REUNIÃO</h3>
                    <div class="text-end">
                        <strong>Data:</strong> ${dataF}<br>
                        <strong>Ref:</strong> ${ata.titulo}
                    </div>
                </div>

                <div class="ata-section">
                    <h5>1. Informações Gerais</h5>
                    <p><strong>Gestor Responsável:</strong> ${ata.gestor}</p>
                    <p><strong>Pauta / Tema:</strong> ${ata.pauta}</p>
                    <p><strong>Participantes:</strong> ${listaPart}</p>
                </div>

                <div class="ata-section">
                    <h5>2. Pontos Discutidos</h5>
                    <div class="ata-content-text">${
                      ata.pontos || "Não registrado."
                    }</div>
                </div>

                <div class="ata-section">
                    <h5>3. Decisões Tomadas</h5>
                    <div class="ata-content-text">${
                      ata.decisoes || "Não registrado."
                    }</div>
                </div>

                <div class="ata-section">
                    <h5>4. Plano de Ação e Encaminhamentos</h5>
                    ${tarefasHtml}
                </div>
                
                <div style="margin-top: 50px; border-top: 1px solid #ccc; width: 200px; text-align: center; padding-top: 5px;">
                    Assinatura do Responsável
                </div>
            </div>
        `;
  });

  container.innerHTML = html;
}

// ============================================================================
// EXPORTAÇÃO CSV
// ============================================================================
function exportarCSV() {
  const dados = filtrarDados();
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para acentos

  if (vistaAtual === "pendencias") {
    csvContent += "Data,Tarefa,Responsavel,Status\n";
    dados.forEach((d) => {
      [...d.planoDeAcao, ...d.encaminhamentos].forEach((t) => {
        if (t.status === "Atrasado") {
          csvContent += `"${d.data}","${t.descricao || t.motivo}","${
            t.responsavel || "N/A"
          }","${t.status}"\n`;
        }
      });
    });
  } else if (vistaAtual === "qualitativo") {
    csvContent += "Data,Reuniao,Participante,Comentario\n";
    dados.forEach((d) => {
      d.feedbacks.forEach((fb) => {
        const com = (fb.sugestaoTema || fb.comentarios || "").replace(
          /"/g,
          '""'
        );
        csvContent += `"${d.data}","${d.titulo}","${
          fb.nome || "Anônimo"
        }","${com}"\n`;
      });
    });
  }
  // Outros casos podem ser adicionados...

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `relatorio_${vistaAtual}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
