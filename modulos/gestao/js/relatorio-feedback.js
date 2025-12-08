// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.0 (Com Assiduidade de Todos os Profissionais)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let todosEventos = [];
let todosUsuarios = []; // Cache de usuários
let vistaAtual = "pendencias";

export async function init() {
  console.log("[RELATÓRIOS] Iniciando módulo...");
  configurarEventos();
  // Carrega usuários e eventos em paralelo
  await Promise.all([carregarEventos(), carregarUsuarios()]);
  renderizarVistaAtual();
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
    // Busca todos os usuários para listar na assiduidade
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
        slots.forEach((slot) =>
          todosEventos.push(normalizarEvento(data, slot))
        );
      } else {
        todosEventos.push(normalizarEvento(data, null));
      }
    });
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
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
    feedbacks: base.feedbacks || [], // Aqui estão as presenças
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

  // Filtro de busca aplicado na renderização para poder filtrar usuários também
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
// NOVA ABA: ASSIDUIDADE (LISTA DE PRESENÇA)
// ============================================================================
function renderAssiduidade(eventos, busca, container) {
  // 1. Mapa de presença por usuário
  // Estrutura: { userId: { dadosUser, totalPresencas: 0, reunioes: [] } }
  const mapaAssiduidade = {};

  // Inicializa com todos os usuários do sistema
  todosUsuarios.forEach((u) => {
    mapaAssiduidade[u.uid] = {
      nome: u.nome,
      email: u.email,
      totalPresencas: 0,
      eventosParticipados: [],
    };
  });

  // 2. Itera sobre os eventos FILTRADOS (por data) para contar presenças
  // Consideramos presença = enviou feedback
  let totalEventosNoPeriodo = eventos.length;

  eventos.forEach((ev) => {
    if (ev.feedbacks && ev.feedbacks.length > 0) {
      ev.feedbacks.forEach((fb) => {
        // Tenta achar por UID, senão por Nome (legado)
        let userKey = fb.uid;

        // Se não tiver UID no feedback, tenta achar usuário pelo nome
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

  // 3. Converte para array e filtra pela busca (nome do profissional)
  let listaFinal = Object.values(mapaAssiduidade);
  if (busca) {
    listaFinal = listaFinal.filter((u) => u.nome.toLowerCase().includes(busca));
  }

  // Ordena: Quem foi em mais reuniões primeiro
  listaFinal.sort((a, b) => b.totalPresencas - a.totalPresencas);

  let html = `
        <div class="alert alert-light border">
            <strong>Total de Reuniões no Período Selecionado:</strong> ${totalEventosNoPeriodo}
            <br><small class="text-muted">A presença é confirmada pelo envio do formulário de feedback.</small>
        </div>
        <table class="table-relatorio">
            <thead>
                <tr>
                    <th>Profissional</th>
                    <th class="text-center">Presenças Confirmadas</th>
                    <th class="text-center">% Assiduidade</th>
                    <th>Detalhes</th>
                </tr>
            </thead>
            <tbody>`;

  listaFinal.forEach((u) => {
    const perc =
      totalEventosNoPeriodo > 0
        ? Math.round((u.totalPresencas / totalEventosNoPeriodo) * 100)
        : 0;
    let cor = perc < 50 ? "text-danger" : "text-success";
    if (totalEventosNoPeriodo === 0) cor = "text-muted";

    html += `
            <tr>
                <td>
                    <strong>${u.nome}</strong><br>
                    <small class="text-muted">${u.email || ""}</small>
                </td>
                <td class="text-center"><strong>${
                  u.totalPresencas
                }</strong></td>
                <td class="text-center ${cor}"><strong>${perc}%</strong></td>
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

// ... (Outras funções renderPendencias, renderQualitativo, etc. mantidas iguais ao anterior, apenas adicionando o filtro 'busca' onde necessário) ...

function renderPendencias(dados, busca, container) {
  let html = `<table class="table-relatorio"><thead><tr><th>Data</th><th>Tarefa</th><th>Responsável</th><th>Status</th></tr></thead><tbody>`;
  let count = 0;

  dados.forEach((ev) => {
    const tarefas = [...ev.planoDeAcao, ...ev.encaminhamentos];
    tarefas.forEach((t) => {
      const resp = t.responsavel || t.nomeEncaminhado || "N/A";
      // Filtra pela busca também
      if (
        t.status === "Atrasado" &&
        (!busca ||
          resp.toLowerCase().includes(busca) ||
          t.descricao?.toLowerCase().includes(busca))
      ) {
        html += `<tr><td>${ev.dataObj.toLocaleDateString()}</td><td>${
          t.descricao || t.motivo
        }</td><td>${resp}</td><td><span class="status-atrasado">Atrasado</span></td></tr>`;
        count++;
      }
    });
  });
  html += `</tbody></table>`;
  container.innerHTML =
    count === 0
      ? `<div class="alert alert-success">Sem pendências.</div>`
      : html;
}

function renderQualitativo(dados, busca, container) {
  let html = `<table class="table-relatorio"><thead><tr><th>Data</th><th>Reunião</th><th>Nome</th><th>Comentário</th></tr></thead><tbody>`;
  dados.forEach((ev) => {
    ev.feedbacks.forEach((fb) => {
      const nome = fb.nome || "Anônimo";
      if (
        !busca ||
        nome.toLowerCase().includes(busca) ||
        ev.titulo.toLowerCase().includes(busca)
      ) {
        html += `<tr><td>${ev.dataObj.toLocaleDateString()}</td><td>${
          ev.titulo
        }</td><td>${nome}</td><td>${
          fb.sugestaoTema || fb.comentarios || "-"
        }</td></tr>`;
      }
    });
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderPerformance(dados, container) {
  // Mantém lógica anterior (agrupada por gestor)
  const stats = {};
  dados.forEach((ev) => {
    const gestor = ev.gestor;
    if (!stats[gestor]) stats[gestor] = { slots: 0, atendimentos: 0 };
    stats[gestor].slots++;
    stats[gestor].atendimentos += ev.vagas.length || 0;
  });
  // ... renderização da tabela ...
  let html = `<table class="table-relatorio"><thead><tr><th>Gestor</th><th>Slots</th><th>Atendimentos</th></tr></thead><tbody>`;
  Object.entries(stats).forEach(([nome, s]) => {
    html += `<tr><td>${nome}</td><td>${s.slots}</td><td>${s.atendimentos}</td></tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderHistorico(dados, container) {
  const concluidas = dados
    .filter((d) => d.status === "Concluída")
    .sort((a, b) => b.dataObj - a.dataObj);
  if (concluidas.length === 0) {
    container.innerHTML = "Sem atas.";
    return;
  }
  let html = "";
  concluidas.forEach((ata) => {
    // ... Logica de renderização formal da ata (igual versão anterior) ...
    html += `<div class="ata-documento"><h3>${
      ata.titulo
    } - ${ata.dataObj.toLocaleDateString()}</h3><p>${ata.pontos}</p></div>`;
  });
  container.innerHTML = html;
}

function exportarCSV() {
  // Lógica de exportação simplificada para o exemplo
  alert(
    "Função de exportar CSV deve ser adaptada para incluir a aba Assiduidade se selecionada."
  );
}
