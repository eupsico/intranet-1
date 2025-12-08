// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.1 (Código Completo: Assiduidade, Histórico Formal e Exportação)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let todosEventos = [];
let todosUsuarios = []; // Cache de todos os profissionais do sistema
let vistaAtual = "pendencias";

export async function init() {
  console.log("[RELATÓRIOS] Iniciando módulo...");
  configurarEventos();
  // Carrega usuários e eventos em paralelo para otimizar
  await Promise.all([carregarEventos(), carregarUsuarios()]);
  renderizarVistaAtual();
}

function configurarEventos() {
  // Alternância de Abas
  document.querySelectorAll(".rel-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".rel-tab")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      vistaAtual = e.currentTarget.dataset.view;

      // Controle do botão de impressão (só aparece no histórico)
      const btnPrint = document.getElementById("btn-imprimir");
      if (btnPrint)
        btnPrint.style.display = vistaAtual === "historico" ? "block" : "none";

      renderizarVistaAtual();
    });
  });

  // Botões de Ação
  document
    .getElementById("btn-aplicar-filtros")
    .addEventListener("click", renderizarVistaAtual);
  document
    .getElementById("btn-exportar-csv")
    .addEventListener("click", exportarCSV);
  document
    .getElementById("btn-imprimir")
    .addEventListener("click", () => window.print());
}

async function carregarUsuarios() {
  try {
    const q = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
    const snap = await getDocs(q);
    todosUsuarios = snap.docs.map((d) => ({
      uid: d.id,
      nome: d.data().nome || "Sem Nome",
      email: d.data().email,
      funcoes: d.data().funcoes || [],
    }));
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);
  }
}

async function carregarEventos() {
  const container = document.getElementById("relatorio-content");
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // Busca na coleção unificada 'eventos'
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );
    const snapshot = await getDocs(q);

    todosEventos = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const slots = data.slots || [];

      // Se for evento com slots (moderno/múltiplos horários)
      if (slots.length > 0) {
        slots.forEach((slot) => {
          todosEventos.push(normalizarEvento(data, slot));
        });
      } else {
        // Evento simples/legado (raiz)
        todosEventos.push(normalizarEvento(data, null));
      }
    });
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
    titulo: raiz.tipo,
    dataObj: new Date(dataIso + "T00:00:00"),
    dataStr: dataIso, // YYYY-MM-DD
    gestor: base.gestorNome || raiz.responsavel || "N/A",
    // Arrays de interesse
    planoDeAcao: base.planoDeAcao || [],
    encaminhamentos: base.encaminhamentos || [],
    feedbacks: base.feedbacks || [], // Aqui estão as presenças confirmadas
    vagas: base.vagas || [], // Inscritos prévios
    // Status
    status: base.status || "Agendada",
    // Detalhes da Ata
    pontos: base.pontos || "",
    decisoes: base.decisoes || "",
    pauta: raiz.descricao || raiz.pauta || "",
  };
}

function filtrarDados() {
  const inicio = document.getElementById("rel-data-inicio").value;
  const fim = document.getElementById("rel-data-fim").value;
  const busca = document.getElementById("rel-busca").value.toLowerCase();

  let filtrados = todosEventos;

  if (inicio) {
    const dIni = new Date(inicio);
    filtrados = filtrados.filter((d) => d.dataObj >= dIni);
  }
  if (fim) {
    const dFim = new Date(fim);
    dFim.setHours(23, 59, 59);
    filtrados = filtrados.filter((d) => d.dataObj <= dFim);
  }

  // O filtro de texto (busca) é retornado para ser aplicado especificamente em cada renderização
  // pois a busca pode ser por nome de usuário (Assiduidade) ou por tema (Histórico)
  return { eventos: filtrados, termoBusca: busca };
}

function renderizarVistaAtual() {
  const { eventos, termoBusca } = filtrarDados();
  const container = document.getElementById("relatorio-content");
  container.innerHTML = "";

  switch (vistaAtual) {
    case "pendencias":
      renderPendencias(eventos, termoBusca, container);
      break;
    case "assiduidade":
      renderAssiduidade(eventos, termoBusca, container);
      break;
    case "qualitativo":
      renderQualitativo(eventos, termoBusca, container);
      break;
    case "performance":
      renderPerformance(eventos, container);
      break;
    case "historico":
      renderHistorico(eventos, container);
      break;
  }
}

// ============================================================================
// A. RELATÓRIO DE PENDÊNCIAS E GARGALOS (ATRASADOS)
// ============================================================================
function renderPendencias(dados, busca, container) {
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
    // Junta Plano de Ação e Encaminhamentos com identificador de origem
    const tarefas = [
      ...evento.planoDeAcao.map((t) => ({ ...t, origemTipo: "Ação" })),
      ...evento.encaminhamentos.map((t) => ({
        ...t,
        origemTipo: "Encaminhamento",
      })),
    ];

    tarefas.forEach((t) => {
      const responsavel = t.responsavel || t.nomeEncaminhado || "N/A";
      const desc = t.descricao || t.motivo || "Sem descrição";

      // Filtro: Apenas Atrasados E (Busca vazia OU Busca coincide)
      if (
        t.status === "Atrasado" &&
        (!busca ||
          responsavel.toLowerCase().includes(busca) ||
          desc.toLowerCase().includes(busca))
      ) {
        const dataF = evento.dataObj.toLocaleDateString("pt-BR");

        html += `
                    <tr>
                        <td>${dataF}</td>
                        <td>${desc}<br><small class="text-muted">${evento.titulo}</small></td>
                        <td>${responsavel}</td>
                        <td>${t.origemTipo}</td>
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
// B. RELATÓRIO DE ASSIDUIDADE (TODOS OS PROFISSIONAIS)
// ============================================================================
function renderAssiduidade(eventos, busca, container) {
  // 1. Mapa inicial com todos os usuários do sistema
  const mapaAssiduidade = {};
  todosUsuarios.forEach((u) => {
    mapaAssiduidade[u.uid] = {
      nome: u.nome,
      email: u.email,
      totalPresencas: 0,
      eventosParticipados: [],
    };
  });

  // 2. Contar presenças baseadas no feedback enviado
  let totalEventosNoPeriodo = eventos.length;

  eventos.forEach((ev) => {
    if (ev.feedbacks && ev.feedbacks.length > 0) {
      ev.feedbacks.forEach((fb) => {
        let userKey = fb.uid;

        // Fallback: se não tiver UID no feedback, tenta achar usuário pelo nome
        if (!userKey) {
          const found = todosUsuarios.find((u) => u.nome === fb.nome);
          if (found) userKey = found.uid;
        }

        // Se encontrou o usuário no mapa (é um profissional cadastrado)
        if (userKey && mapaAssiduidade[userKey]) {
          mapaAssiduidade[userKey].totalPresencas++;
          mapaAssiduidade[userKey].eventosParticipados.push({
            data: ev.dataObj.toLocaleDateString("pt-BR"),
            titulo: ev.titulo,
          });
        }
      });
    }
  });

  // 3. Filtragem e Ordenação
  let listaFinal = Object.values(mapaAssiduidade);

  if (busca) {
    listaFinal = listaFinal.filter((u) => u.nome.toLowerCase().includes(busca));
  }

  // Ordena por quem foi em mais reuniões
  listaFinal.sort((a, b) => b.totalPresencas - a.totalPresencas);

  // 4. Renderização
  let html = `
        <div class="alert alert-light border">
            <strong>Total de Reuniões no Período Selecionado:</strong> ${totalEventosNoPeriodo}
            <br><small class="text-muted">A presença é contabilizada automaticamente quando o profissional envia o formulário de feedback.</small>
        </div>
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Profissional</th>
                    <th class="text-center">Presenças</th>
                    <th class="text-center">% Assiduidade</th>
                    <th>Últimas Participações</th>
                </tr>
            </thead>
            <tbody>`;

  listaFinal.forEach((u) => {
    const perc =
      totalEventosNoPeriodo > 0
        ? Math.round((u.totalPresencas / totalEventosNoPeriodo) * 100)
        : 0;

    // Cores de status
    let classCor = "text-muted";
    if (totalEventosNoPeriodo > 0) {
      if (perc >= 75) classCor = "text-success";
      else if (perc >= 50) classCor = "text-warning"; // ou uma cor neutra
      else classCor = "text-danger";
    }

    html += `
            <tr>
                <td>
                    <strong>${u.nome}</strong><br>
                    <small class="text-muted">${u.email || ""}</small>
                </td>
                <td class="text-center"><strong>${
                  u.totalPresencas
                }</strong></td>
                <td class="text-center ${classCor}"><strong>${perc}%</strong></td>
                <td>
                    <small>
                        ${u.eventosParticipados
                          .slice(0, 3)
                          .map((e) => `${e.data} (${e.titulo})`)
                          .join(", ")}
                        ${
                          u.eventosParticipados.length > 3
                            ? `e mais ${u.eventosParticipados.length - 3}...`
                            : ""
                        }
                        ${u.eventosParticipados.length === 0 ? "-" : ""}
                    </small>
                </td>
            </tr>
        `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ============================================================================
// C. RELATÓRIO QUALITATIVO (FEEDBACKS ESCRITOS)
// ============================================================================
function renderQualitativo(dados, busca, container) {
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
      const nome = fb.nome || "Anônimo";
      const sugestao = fb.sugestaoTema || fb.comentarios || "-";

      // Filtro de Busca
      if (
        !busca ||
        nome.toLowerCase().includes(busca) ||
        evento.titulo.toLowerCase().includes(busca)
      ) {
        const dataF = evento.dataObj.toLocaleDateString("pt-BR");

        // Calcula "Nota" aproximada
        let nota = 0;
        if (fb.clareza === "Sim") nota += 5;
        if (fb.objetivos === "Sim") nota += 5;

        html += `
                    <tr>
                        <td>${dataF}</td>
                        <td>${evento.titulo}</td>
                        <td>${nome}</td>
                        <td>${nota}/10</td>
                        <td>${sugestao}</td>
                    </tr>`;
        count++;
      }
    });
  });

  html += `</tbody></table>`;
  if (count === 0)
    container.innerHTML = `<div class="alert alert-info">Nenhum feedback encontrado com os filtros atuais.</div>`;
  else container.innerHTML = html;
}

// ============================================================================
// D. RELATÓRIO DE PERFORMANCE DE GESTORES
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

  // Converte para array e ordena
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
    const taxa = s.slots > 0 ? Math.round((s.atendimentos / s.slots) * 100) : 0;
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
// E. HISTÓRICO COMPLETO DE ATAS (DOCUMENTO FORMAL)
// ============================================================================
function renderHistorico(dados, container) {
  // Filtra apenas atas concluídas e ordena por data (mais recente primeiro)
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

    // Lista de Participantes (Inscritos ou Lista de Presença manual se existir no futuro)
    const listaPart =
      (ata.vagas.length > 0
        ? ata.vagas.map((v) => v.nome || v.profissionalNome)
        : ata.participantesConfirmados
        ? ata.participantesConfirmados.split(",")
        : []
      ).join(", ") || "Conforme lista de presença digital.";

    // Lista de Tarefas formatada
    let tarefasHtml = "<ul>";
    [...ata.planoDeAcao, ...ata.encaminhamentos].forEach((t) => {
      tarefasHtml += `<li><strong>${t.responsavel || "N/A"}:</strong> ${
        t.descricao || t.motivo
      } <small>(Prazo: ${t.prazo || "N/A"})</small></li>`;
    });
    tarefasHtml += "</ul>";

    if (tarefasHtml === "<ul></ul>")
      tarefasHtml = "<p>Nenhuma tarefa registrada.</p>";

    html += `
            <div class="ata-documento">
                <div class="ata-header">
                    <h3>ATA DE REUNIÃO</h3>
                    <div class="text-end" style="font-size: 0.9em;">
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
                
                <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                    <div style="border-top: 1px solid #000; width: 40%; text-align: center; padding-top: 5px;">
                        Assinatura Responsável
                    </div>
                    <div style="border-top: 1px solid #000; width: 40%; text-align: center; padding-top: 5px;">
                        Visto da Coordenação
                    </div>
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
  const { eventos, termoBusca } = filtrarDados();
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para suporte a acentos no Excel

  // Define colunas baseado na vista atual
  if (vistaAtual === "pendencias") {
    csvContent += "Data,Evento,Tarefa,Responsavel,Status\n";
    eventos.forEach((ev) => {
      [...ev.planoDeAcao, ...ev.encaminhamentos].forEach((t) => {
        if (t.status === "Atrasado") {
          const line = [
            ev.dataStr,
            ev.titulo,
            t.descricao || t.motivo,
            t.responsavel || "N/A",
            t.status,
          ]
            .map((field) => `"${String(field).replace(/"/g, '""')}"`)
            .join(",");
          csvContent += line + "\n";
        }
      });
    });
  } else if (vistaAtual === "qualitativo") {
    csvContent += "Data,Reuniao,Participante,Comentario\n";
    eventos.forEach((ev) => {
      ev.feedbacks.forEach((fb) => {
        const line = [
          ev.dataStr,
          ev.titulo,
          fb.nome || "Anônimo",
          fb.sugestaoTema || fb.comentarios || "",
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(",");
        csvContent += line + "\n";
      });
    });
  } else if (vistaAtual === "assiduidade") {
    csvContent += "Profissional,Email,TotalPresencas\n";
    // Recalcula lista de assiduidade para CSV (reutiliza lógica simples)
    const mapa = {};
    todosUsuarios.forEach(
      (u) => (mapa[u.uid] = { nome: u.nome, email: u.email, count: 0 })
    );

    eventos.forEach((ev) => {
      if (ev.feedbacks) {
        ev.feedbacks.forEach((fb) => {
          let uid = fb.uid;
          if (!uid) {
            const f = todosUsuarios.find((u) => u.nome === fb.nome);
            if (f) uid = f.uid;
          }
          if (uid && mapa[uid]) mapa[uid].count++;
        });
      }
    });

    Object.values(mapa).forEach((u) => {
      if (u.count > 0) {
        // Opcional: exportar todos ou só quem participou
        csvContent += `"${u.nome}","${u.email}","${u.count}"\n`;
      }
    });
  } else {
    alert(
      "Exportação disponível para as abas: Pendências, Assiduidade e Qualitativo."
    );
    return;
  }

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
