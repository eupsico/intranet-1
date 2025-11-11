// /modulos/gestao/js/plano-de-acao.js
// VERSÃO 3.0 (MELHORADO: Realtime, Drag-Drop, Filtros, Status Visual)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  writeBatch,
} from "../../../assets/js/firebase-init.js";

let todasAsTarefas = [];
let gestoresCache = [];
let departamentosCache = [];
let currentUser = null;
let unsubscribeAtas = null;
let draggedCard = null;

export async function init(user, userData) {
  console.log("[PLANO] Módulo Plano de Ação iniciado (v3.0).");
  currentUser = userData;
  await carregarDadosIniciais();
  configurarEventListeners();
}

async function carregarDadosIniciais() {
  try {
    await Promise.all([
      fetchGestores(),
      fetchDepartamentos(),
      fetchAtasEPlanosRealtime(),
    ]);
    renderizarQuadroKanban();
    console.log("[PLANO] Dados iniciais carregados.");
  } catch (erro) {
    console.error("[PLANO] Erro ao carregar dados iniciais:", erro);
    exibirErro("Falha ao carregar dados do plano de ação.");
  }
}

async function fetchAtasEPlanosRealtime() {
  try {
    const q = query(
      collection(firestoreDb, "gestao_atas"),
      orderBy("dataReuniao", "desc")
    );

    if (unsubscribeAtas) unsubscribeAtas();

    unsubscribeAtas = onSnapshot(q, (snapshot) => {
      todasAsTarefas = [];
      snapshot.forEach((docAta) => {
        const ata = { id: docAta.id, ...docAta.data() };
        const dataReuniao = ata.dataReuniao
          ? new Date(ata.dataReuniao + "T00:00:00").toLocaleDateString("pt-BR")
          : "Data Indefinida";
        const origem = `${ata.tipo || "Reunião"} - ${dataReuniao}`;

        const processarItens = (lista, tipo) => {
          if (Array.isArray(lista)) {
            lista.forEach((item, index) => {
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);

              if (item.prazo && item.status !== "Concluído") {
                const prazo = new Date(item.prazo + "T00:00:00");
                if (prazo < hoje) {
                  item.status = "Atrasado";
                }
              }

              todasAsTarefas.push({
                ...item,
                type: tipo,
                ataId: ata.id,
                itemIndex: index,
                origem,
              });
            });
          }
        };

        processarItens(ata.planoDeAcao, "atividade");
        processarItens(ata.encaminhamentos, "encaminhamento");
      });

      renderizarQuadroKanban();
      console.log(
        `[PLANO] ${todasAsTarefas.length} tarefas carregadas (realtime).`
      );
    });
  } catch (erro) {
    console.error("[PLANO] Erro ao buscar atas:", erro);
    throw new Error("Falha ao buscar plano de ação. Verifique permissões.");
  }
}

async function fetchGestores() {
  if (gestoresCache.length > 0) return;
  try {
    const q = query(
      collection(firestoreDb, "usuarios"),
      where("funcoes", "array-contains", "gestor"),
      orderBy("nome")
    );
    const snapshot = await onSnapshot(q, (snap) => {
      gestoresCache = snap.docs.map((doc) => ({
        nome: doc.data().nome,
        departamento: doc.data().departamento || "",
      }));
      console.log("[PLANO] Gestores carregados:", gestoresCache.length);
    });
  } catch (erro) {
    console.error("[PLANO] Erro ao buscar gestores:", erro);
    gestoresCache = [];
  }
}

async function fetchDepartamentos() {
  if (departamentosCache.length > 0) return;
  try {
    const configRef = doc(firestoreDb, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists() && docSnap.data().listas?.departamentos) {
      departamentosCache = docSnap.data().listas.departamentos.sort();
      console.log(
        "[PLANO] Departamentos carregados:",
        departamentosCache.length
      );
    } else {
      console.warn("[PLANO] Nenhuma lista de departamentos encontrada.");
    }
  } catch (erro) {
    console.error("[PLANO] Erro ao buscar departamentos:", erro);
    departamentosCache = [];
  }
}

function configurarEventListeners() {
  // Filtros
  const filtroStatus = document.getElementById("filtro-status");
  const filtroBusca = document.getElementById("filtro-busca");
  const filtroTipo = document.getElementById("filtro-tipo");
  const botaoLimpar = document.getElementById("limpar-filtros");

  if (filtroStatus)
    filtroStatus.addEventListener("change", renderizarQuadroKanban);
  if (filtroBusca)
    filtroBusca.addEventListener("input", renderizarQuadroKanban);
  if (filtroTipo) filtroTipo.addEventListener("change", renderizarQuadroKanban);
  if (botaoLimpar)
    botaoLimpar.addEventListener("click", () => {
      if (filtroStatus) filtroStatus.value = "Todos";
      if (filtroBusca) filtroBusca.value = "";
      if (filtroTipo) filtroTipo.value = "Todos";
      renderizarQuadroKanban();
    });

  // Drag-and-Drop
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragend", handleDragEnd);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("drop", handleDrop);

  console.log("[PLANO] Event listeners configurados.");
}

function renderizarQuadroKanban() {
  const colunas = {
    "A Fazer": document.querySelector("#coluna-a-fazer .cards-container"),
    "Em Andamento": document.querySelector(
      "#coluna-em-andamento .cards-container"
    ),
    Atrasado: document.querySelector("#coluna-atrasado .cards-container"),
    Concluído: document.querySelector("#coluna-concluido .cards-container"),
  };

  // Limpa colunas
  Object.values(colunas).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  // Aplica filtros
  const statusFiltro =
    document.getElementById("filtro-status")?.value || "Todos";
  const buscaFiltro =
    document.getElementById("filtro-busca")?.value.toLowerCase() || "";
  const tipoFiltro = document.getElementById("filtro-tipo")?.value || "Todos";

  let tarefasFiltradas = todasAsTarefas.filter((item) => {
    const statusMatch =
      statusFiltro === "Todos" || item.status === statusFiltro;
    const buscaMatch =
      buscaFiltro === "" ||
      item.descricao?.toLowerCase().includes(buscaFiltro) ||
      item.responsavel?.toLowerCase().includes(buscaFiltro) ||
      item.motivo?.toLowerCase().includes(buscaFiltro);
    const tipoMatch = tipoFiltro === "Todos" || item.type === tipoFiltro;

    return statusMatch && buscaMatch && tipoMatch;
  });

  if (tarefasFiltradas.length === 0) {
    const coluna = colunas[statusFiltro] || colunas["A Fazer"];
    if (coluna) {
      coluna.innerHTML =
        '<div class="alert alert-info text-center">Nenhuma tarefa encontrada.</div>';
    }
    return;
  }

  // Distribui tarefas nas colunas
  tarefasFiltradas.forEach((item) => {
    const status = item.status || "A Fazer";
    if (colunas[status]) {
      colunas[status].innerHTML += criarCardHtml(item);
    }
  });

  console.log(
    `[PLANO] Kanban renderizado (${tarefasFiltradas.length} tarefas).`
  );
}

function criarCardHtml(item) {
  const responsavel =
    item.responsavel || item.nomeEncaminhado || "Não atribuído";
  const prazo = item.prazo
    ? new Date(item.prazo + "T00:00:00").toLocaleDateString("pt-BR")
    : "N/A";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrazo = item.prazo ? new Date(item.prazo + "T00:00:00") : null;
  const diasRestantes = dataPrazo
    ? Math.ceil((dataPrazo - hoje) / (1000 * 60 * 60 * 24))
    : null;

  // Define cor baseado na urgência
  let corBorda = "border-secondary";
  let iconeUrgencia = "";
  if (item.status === "Atrasado") {
    corBorda = "border-danger";
    iconeUrgencia =
      '<span class="material-symbols-outlined text-danger" title="Atrasado">error</span>';
  } else if (
    diasRestantes !== null &&
    diasRestantes < 3 &&
    diasRestantes >= 0
  ) {
    corBorda = "border-warning";
    iconeUrgencia =
      '<span class="material-symbols-outlined text-warning" title="Próximo do prazo">schedule</span>';
  } else if (item.status === "Concluído") {
    corBorda = "border-success";
    iconeUrgencia =
      '<span class="material-symbols-outlined text-success" title="Concluído">check_circle</span>';
  }

  const corTipo =
    item.type === "encaminhamento"
      ? "bg-info text-white"
      : "bg-primary text-white";
  const identifier = `${item.ataId}|${item.itemIndex}|${item.type}`;

  return `
        <div class="card mb-2 ${corBorda} cursor-move" draggable="true" data-identifier="${identifier}">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge ${corTipo}">${
    item.type === "encaminhamento" ? "Encaminhamento" : "Atividade"
  }</span>
                    ${iconeUrgencia}
                </div>
                <p class="card-text mb-2"><strong>${
                  item.descricao || item.motivo || "Sem descrição"
                }</strong></p>
                <small class="text-muted d-block mb-1">📌 ${item.origem}</small>
                <small class="text-muted d-block mb-1">👤 ${responsavel}</small>
                <small class="text-muted d-block">📅 ${prazo}</small>
                ${
                  diasRestantes !== null
                    ? `
                    <small class="d-block mt-1">
                        <span class="badge ${
                          diasRestantes < 0
                            ? "bg-danger"
                            : diasRestantes < 3
                            ? "bg-warning"
                            : "bg-success"
                        }">
                            ${
                              diasRestantes < 0
                                ? `${Math.abs(diasRestantes)} dia(s) atrasado`
                                : diasRestantes === 0
                                ? "Vence hoje"
                                : `${diasRestantes} dia(s)`
                            }
                        </span>
                    </small>
                `
                    : ""
                }
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="abrirDetalhes('${identifier}')">
                    Ver Detalhes
                </button>
            </div>
        </div>
    `;
}

function handleDragStart(e) {
  if (e.target.matches('[draggable="true"]')) {
    draggedCard = e.target;
    e.target.style.opacity = "0.5";
    e.dataTransfer.effectAllowed = "move";
  }
}

function handleDragEnd(e) {
  if (draggedCard) {
    draggedCard.style.opacity = "1";
    draggedCard = null;
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

async function handleDrop(e) {
  e.preventDefault();
  if (!draggedCard) return;

  const coluna = e.target.closest(".cards-container");
  if (!coluna) return;

  const statusTarget =
    coluna.closest("[data-status]")?.dataset.status ||
    coluna.closest("#coluna-a-fazer")?.dataset.status ||
    "A Fazer";

  const identifier = draggedCard.dataset.identifier;
  const [ataId, itemIndex, tipo] = identifier.split("|");

  try {
    const docRef = doc(firestoreDb, "gestao_atas", ataId);
    const campoAlterar =
      tipo === "encaminhamento" ? "encaminhamentos" : "planoDeAcao";
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const dados = docSnap.data();
      const items = dados[campoAlterar] || [];
      if (items[itemIndex]) {
        items[itemIndex].status = statusTarget;
        await updateDoc(docRef, { [campoAlterar]: items });
        console.log(`[PLANO] Tarefa movida para: ${statusTarget}`);
      }
    }
  } catch (erro) {
    console.error("[PLANO] Erro ao atualizar status:", erro);
    exibirErro("Falha ao atualizar status da tarefa.");
  }
}

function abrirDetalhes(identifier) {
  console.log("[PLANO] Abrindo detalhes de:", identifier);
  alert(`Detalhes da tarefa: ${identifier} (implementar modal de edição)`);
}

function exibirErro(mensagem) {
  const alert = document.createElement("div");
  alert.className = "alert alert-danger alert-dismissible fade show";
  alert.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
  document.body.prepend(alert);
  setTimeout(() => alert.remove(), 5000);
}

export function cleanup() {
  if (unsubscribeAtas) {
    unsubscribeAtas();
    console.log("[PLANO] Listener cancelado.");
  }
}
