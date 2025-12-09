// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.5 (Atualizado: Ordem Exata da Configuração + Negrito)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

let todosEventos = [];
let todosUsuarios = [];
let vistaAtual = "pendencias";

// Armazena a LISTA ORDENADA vinda do banco de dados
let listaPerguntasOrdenada = [];

// Mapa de fallback caso o banco falhe
const MAPA_PERGUNTAS_FALLBACK = {
  clareza: "O tema foi claro?",
  objetivos: "Objetivos alcançados?",
  duracao: "O tempo da reunião foi bem aproveitado?",
  competencias: "Pensando em seu papel, quais competências foram trabalhadas?",
  aprendizado: "Qual aprendizado adquirido?",
  valor: "Quais aspectos da cultura foram reforçados?",
  sugestoes: "Sugestões/Comentários",
};

export async function init() {
  console.log("[RELATÓRIOS] Iniciando módulo v2.5...");
  configurarEventos();

  await Promise.all([
    carregarConfiguracaoFeedback(),
    carregarEventos(),
    carregarUsuarios(),
  ]);

  renderizarVistaAtual();
}

// ✅ ATUALIZADO: Salva a lista completa para manter a ordem
async function carregarConfiguracaoFeedback() {
  try {
    const docRef = doc(firestoreDb, "configuracoesSistema", "modelo_feedback");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.perguntas && Array.isArray(data.perguntas)) {
        // Salva a lista exata como está no banco (preserva a ordem da sua imagem)
        listaPerguntasOrdenada = data.perguntas;
        console.log("✅ Lista de perguntas carregada e ordenada.");
      }
    }
  } catch (e) {
    console.warn("⚠️ Erro ao carregar configurações (usando fallback):", e);
  }
}

function configurarEventos() {
  document.querySelectorAll(".rel-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".rel-tab")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      vistaAtual = e.currentTarget.dataset.view;

      const btnPrint = document.getElementById("btn-imprimir");
      if (btnPrint)
        btnPrint.style.display = vistaAtual === "historico" ? "block" : "none";

      renderizarVistaAtual();
    });
  });

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
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );
    const snapshot = await getDocs(q);

    todosEventos = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const slots = data.slots || [];

      if (slots.length > 0) {
        slots.forEach((slot) => {
          todosEventos.push(normalizarEvento(data, slot));
        });
      } else {
        todosEventos.push(normalizarEvento(data, null));
      }
    });
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados: ${error.message}</div>`;
  }
}

function normalizarEvento(raiz, slot) {
  const base = slot || raiz;
  const dataIso = slot
    ? slot.data
    : raiz.dataReuniao || raiz.criadoEm?.toDate().toISOString().split("T")[0];

  return {
    titulo: raiz.tipo,
    dataObj: new Date(dataIso + "T00:00:00"),
    dataStr: dataIso,
    gestor: base.gestorNome || raiz.responsavel || "N/A",
    planoDeAcao: base.planoDeAcao || [],
    encaminhamentos: base.encaminhamentos || [],
    feedbacks: base.feedbacks || [],
    vagas: base.vagas || [],
    status: base.status || "Agendada",
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

function renderAssiduidade(eventos, busca, container) {
  const mapaAssiduidade = {};
  todosUsuarios.forEach((u) => {
    mapaAssiduidade[u.uid] = {
      nome: u.nome,
      email: u.email,
      totalPresencas: 0,
      eventosParticipados: [],
    };
  });

  let totalEventosNoPeriodo = eventos.length;

  eventos.forEach((ev) => {
    if (ev.feedbacks && ev.feedbacks.length > 0) {
      ev.feedbacks.forEach((fb) => {
        let userKey = fb.uid;
        if (!userKey) {
          const found = todosUsuarios.find((u) => u.nome === fb.nome);
          if (found) userKey = found.uid;
        }
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

  let listaFinal = Object.values(mapaAssiduidade);

  if (busca) {
    listaFinal = listaFinal.filter((u) => u.nome.toLowerCase().includes(busca));
  }

  listaFinal.sort((a, b) => b.totalPresencas - a.totalPresencas);

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

    let classCor = "text-muted";
    if (totalEventosNoPeriodo > 0) {
      if (perc >= 75) classCor = "text-success";
      else if (perc >= 50) classCor = "text-warning";
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

function renderQualitativo(dados, busca, container) {
  let html = `
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Reunião</th>
                    <th>Participante</th>
                    <th class="text-end">Ações</th>
                </tr>
            </thead>
            <tbody>`;

  let count = 0;
  dados.forEach((evento) => {
    evento.feedbacks.forEach((fb, index) => {
      const nome = fb.nome || "Anônimo";

      if (
        !busca ||
        nome.toLowerCase().includes(busca) ||
        evento.titulo.toLowerCase().includes(busca)
      ) {
        const dataF = evento.dataObj.toLocaleDateString("pt-BR");

        const dadosFeedback = encodeURIComponent(JSON.stringify(fb));
        const dadosEvento = encodeURIComponent(
          JSON.stringify({
            titulo: evento.titulo,
            data: dataF,
            gestor: evento.gestor,
          })
        );

        html += `
            <tr>
                <td>${dataF}</td>
                <td>${evento.titulo}</td>
                <td>${nome}</td>
                <td class="text-end">
                    <button class="btn-export" onclick="abrirModalDetalhesFeedback('${dadosFeedback}', '${dadosEvento}')">
                        <span class="material-symbols-outlined" style="font-size: 18px;">visibility</span> Ver Respostas
                    </button>
                </td>
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
// FUNÇÃO: ABRIR MODAL DETALHES FEEDBACK (ATUALIZADO)
// ============================================================================
window.abrirModalDetalhesFeedback = function (
  dadosFeedbackEnc,
  dadosEventoEnc
) {
  const feedback = JSON.parse(decodeURIComponent(dadosFeedbackEnc));
  const evento = JSON.parse(decodeURIComponent(dadosEventoEnc));

  const modalId = "modal-detalhes-feedback";
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  let resumoHtml = `<div class="qa-list">`;

  const chavesIgnoradas = new Set(["timestamp", "uid", "nome", "email"]);
  const chavesProcessadas = new Set();

  // 1. Tenta renderizar na ordem correta usando a lista carregada do banco
  if (listaPerguntasOrdenada.length > 0) {
    listaPerguntasOrdenada.forEach((pergunta) => {
      const key = pergunta.id; // Ex: 'clareza', 'competencias'
      const textoPergunta = pergunta.texto;

      if (feedback[key] !== undefined) {
        resumoHtml += `
                    <div class="qa-item mb-3 p-3 bg-light rounded border">
                        <p class="mb-2 text-primary" style="font-size: 1.05rem;"><strong>${textoPergunta}</strong></p>
                        <p class="mb-0 text-dark bg-white p-2 rounded border-start border-3 border-primary">${
                          feedback[key] || "<em>Sem resposta</em>"
                        }</p>
                    </div>
                `;
        chavesProcessadas.add(key);
      }
    });
  } else {
    // Fallback: Usa o MAPA_PERGUNTAS_FALLBACK se a lista não carregou
    Object.keys(MAPA_PERGUNTAS_FALLBACK).forEach((key) => {
      if (feedback[key] !== undefined) {
        const textoPergunta = MAPA_PERGUNTAS_FALLBACK[key];
        resumoHtml += `
                    <div class="qa-item mb-3 p-3 bg-light rounded border">
                        <p class="mb-2 text-primary" style="font-size: 1.05rem;"><strong>${textoPergunta}</strong></p>
                        <p class="mb-0 text-dark bg-white p-2 rounded border-start border-3 border-primary">${
                          feedback[key] || "<em>Sem resposta</em>"
                        }</p>
                    </div>
                `;
        chavesProcessadas.add(key);
      }
    });
  }

  // 2. Renderiza perguntas que podem ter ficado de fora (legado ou novas não mapeadas)
  Object.entries(feedback).forEach(([key, value]) => {
    if (!chavesIgnoradas.has(key) && !chavesProcessadas.has(key)) {
      const perguntaTexto = `Questão (${key})`;

      resumoHtml += `
                <div class="qa-item mb-3 p-3 bg-light rounded border">
                    <p class="mb-2 text-primary" style="font-size: 1.05rem;"><strong>${perguntaTexto}</strong></p>
                    <p class="mb-0 text-dark bg-white p-2 rounded border-start border-3 border-secondary">${
                      value || "<em>Sem resposta</em>"
                    }</p>
                </div>
            `;
    }
  });

  resumoHtml += `</div>`;

  modal = document.createElement("div");
  modal.id = modalId;
  modal.innerHTML = `
        <div class="modal-overlay is-visible" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div class="modal-content bg-white rounded shadow-lg" style="width: 90%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                    <h5 class="mb-0">Resumo do Feedback</h5>
                    <button onclick="fecharModalDetalhesFeedback()" class="btn-close border-0 bg-transparent" style="font-size: 1.5rem;">&times;</button>
                </div>
                <div class="modal-body p-4" style="overflow-y: auto;">
                    <div class="info-reuniao mb-4 pb-3 border-bottom">
                        <h6 class="text-uppercase text-muted small mb-2 fw-bold">Detalhes da Reunião</h6>
                        <p class="mb-1"><strong>Tema:</strong> ${evento.titulo}</p>
                        <p class="mb-1"><strong>Data:</strong> ${evento.data}</p>
                        <p class="mb-0"><strong>Profissional:</strong> ${feedback.nome}</p>
                    </div>
                    
                    <h6 class="text-uppercase text-muted small mb-3 fw-bold">Respostas do Formulário</h6>
                    ${resumoHtml}
                </div>
                <div class="modal-footer p-3 border-top text-end">
                    <button onclick="fecharModalDetalhesFeedback()" class="btn btn-secondary btn-sm">Fechar</button>
                </div>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
};

window.fecharModalDetalhesFeedback = function () {
  const modal = document.getElementById("modal-detalhes-feedback");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};

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

function renderHistorico(dados, container) {
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

    const listaPart =
      (ata.vagas.length > 0
        ? ata.vagas.map((v) => v.nome || v.profissionalNome)
        : ata.participantesConfirmados
        ? ata.participantesConfirmados.split(",")
        : []
      ).join(", ") || "Conforme lista de presença digital.";

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

function exportarCSV() {
  const { eventos } = filtrarDados();
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

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
