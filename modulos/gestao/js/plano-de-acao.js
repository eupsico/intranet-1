// /modulos/gestao/js/plano-de-acao.js
// VERSÃO 3.5 (Unificado com Eventos e Suporte a Slots)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

let todasAsTarefas = [];
let gestoresCache = [];
let departamentosCache = [];
let currentUser = null;
let unsubscribeEventos = null;
let draggedCard = null;

export async function init(user, userData) {
  console.log("[PLANO] Módulo Plano de Ação iniciado (v3.5 - Eventos).");
  currentUser = userData;
  await carregarDadosIniciais();
  configurarEventListeners();
}

async function carregarDadosIniciais() {
  try {
    await Promise.all([
      fetchGestores(),
      fetchDepartamentos(),
      fetchTarefasRealtime(),
    ]);
    renderizarQuadroKanban();
    console.log("[PLANO] Dados iniciais carregados.");
  } catch (erro) {
    console.error("[PLANO] Erro ao carregar dados iniciais:", erro);
    exibirErro("Falha ao carregar dados do plano de ação.");
  }
}

/**
 * Busca tarefas em tempo real na coleção 'eventos'.
 * Varre tanto a raiz do documento quanto os slots internos.
 */
async function fetchTarefasRealtime() {
  try {
    // ALTERAÇÃO: Busca na coleção 'eventos'
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );

    if (unsubscribeEventos) unsubscribeEventos();

    unsubscribeEventos = onSnapshot(q, (snapshot) => {
      todasAsTarefas = [];

      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const docId = docSnap.id;
        const slots = dados.slots || [];

        // Função auxiliar para extrair tarefas de um objeto (seja raiz ou slot)
        const processarObjeto = (obj, origemTexto, slotIndex) => {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          // Processa Atividades (planoDeAcao)
          if (obj.planoDeAcao && Array.isArray(obj.planoDeAcao)) {
            obj.planoDeAcao.forEach((item, index) => {
              // Verifica atraso
              if (item.prazo && item.status !== "Concluído") {
                const prazo = new Date(item.prazo + "T00:00:00");
                if (prazo < hoje) item.status = "Atrasado";
              }

              todasAsTarefas.push({
                ...item,
                type: "atividade",
                docId: docId,
                slotIndex: slotIndex, // -1 para raiz, >=0 para slots
                itemIndex: index,
                origem: origemTexto,
                status: item.status || "A Fazer",
              });
            });
          }

          // Processa Encaminhamentos
          if (obj.encaminhamentos && Array.isArray(obj.encaminhamentos)) {
            obj.encaminhamentos.forEach((item, index) => {
              // Verifica atraso
              if (item.prazo && item.status !== "Concluído") {
                const prazo = new Date(item.prazo + "T00:00:00");
                if (prazo < hoje) item.status = "Atrasado";
              }

              todasAsTarefas.push({
                ...item,
                type: "encaminhamento",
                docId: docId,
                slotIndex: slotIndex,
                itemIndex: index,
                origem: origemTexto,
                status: item.status || "A Fazer",
              });
            });
          }
        };

        // 1. Processa Raiz (Eventos antigos ou simples)
        // Se tiver data definida usa, senão data de criação
        const dataRaiz = dados.dataReuniao
          ? new Date(dados.dataReuniao + "T00:00:00").toLocaleDateString(
              "pt-BR"
            )
          : "Data n/a";
        processarObjeto(dados, `${dados.tipo} (Geral) - ${dataRaiz}`, -1);

        // 2. Processa Slots (Eventos múltiplos)
        slots.forEach((slot, idx) => {
          const dataSlot = new Date(slot.data + "T00:00:00").toLocaleDateString(
            "pt-BR"
          );
          // Só processa se tiver tarefas no slot
          if (
            (slot.planoDeAcao && slot.planoDeAcao.length) ||
            (slot.encaminhamentos && slot.encaminhamentos.length)
          ) {
            processarObjeto(
              slot,
              `${dados.tipo} - ${dataSlot} (${slot.horaInicio})`,
              idx
            );
          }
        });
      });

      renderizarQuadroKanban();
      console.log(
        `[PLANO] ${todasAsTarefas.length} tarefas carregadas (realtime).`
      );
    });
  } catch (erro) {
    console.error("[PLANO] Erro ao buscar tarefas:", erro);
    throw new Error("Falha ao buscar plano de ação.");
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
    // Listener one-time
    const snap = await onSnapshot(q, (snap) => {
      gestoresCache = snap.docs.map((doc) => ({
        nome: doc.data().nome,
        departamento: doc.data().departamento || "",
      }));
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

  if (botaoLimpar) {
    botaoLimpar.addEventListener("click", () => {
      if (filtroStatus) filtroStatus.value = "Todos";
      if (filtroBusca) filtroBusca.value = "";
      if (filtroTipo) filtroTipo.value = "Todos";
      renderizarQuadroKanban();
    });
  }

  // Drag-and-Drop Global
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
    // Se não tem nada filtrado, exibe msg na coluna do filtro ou na primeira
    const colunaAlvo =
      statusFiltro !== "Todos" && colunas[statusFiltro]
        ? colunas[statusFiltro]
        : colunas["A Fazer"];
    if (colunaAlvo) {
      colunaAlvo.innerHTML =
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

  // Define cor baseado na urgência e status
  let corBorda = "border-secondary";
  let iconeUrgencia = "";

  if (item.status === "Atrasado") {
    corBorda = "border-danger";
    iconeUrgencia =
      '<span class="material-symbols-outlined text-danger" title="Atrasado">error</span>';
  } else if (
    diasRestantes !== null &&
    diasRestantes < 3 &&
    diasRestantes >= 0 &&
    item.status !== "Concluído"
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
  const tipoLabel =
    item.type === "encaminhamento" ? "Encaminhamento" : "Atividade";

  // IDENTIFICADOR ÚNICO: DocId | SlotIndex | ItemIndex | Tipo
  const identifier = `${item.docId}|${item.slotIndex}|${item.itemIndex}|${item.type}`;

  return `
        <div class="card mb-2 ${corBorda} cursor-move" draggable="true" data-identifier="${identifier}">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge ${corTipo}">${tipoLabel}</span>
                    ${iconeUrgencia}
                </div>
                <p class="card-text mb-2"><strong>${
                  item.descricao || item.motivo || "Sem descrição"
                }</strong></p>
                <small class="text-muted d-block mb-1">📌 ${item.origem}</small>
                <small class="text-muted d-block mb-1">👤 ${responsavel}</small>
                <small class="text-muted d-block">📅 ${prazo}</small>
                ${
                  diasRestantes !== null && item.status !== "Concluído"
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
                    </small>`
                    : ""
                }
                </div>
        </div>
    `;
}

// =================================================================================
// DRAG AND DROP HANDLERS
// =================================================================================

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

  // Descobre qual o status de destino da coluna
  // Tenta pegar do atributo data-status do pai .kanban-column
  const kanbanColumn = coluna.closest(".kanban-column");
  const statusTarget = kanbanColumn ? kanbanColumn.dataset.status : "A Fazer";

  const identifier = draggedCard.dataset.identifier;
  if (!identifier) return;

  // Desconstroi o ID: docId | slotIndex | itemIndex | tipo
  const [docId, slotIndexStr, itemIndexStr, tipo] = identifier.split("|");
  const slotIndex = parseInt(slotIndexStr);
  const itemIndex = parseInt(itemIndexStr);

  try {
    const docRef = doc(firestoreDb, "eventos", docId);
    const campoNome =
      tipo === "encaminhamento" ? "encaminhamentos" : "planoDeAcao";

    // Caso 1: Tarefa na Raiz (SlotIndex = -1)
    if (slotIndex === -1) {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const lista = data[campoNome] || [];

        if (lista[itemIndex]) {
          lista[itemIndex].status = statusTarget;
          await updateDoc(docRef, { [campoNome]: lista });
          console.log(`[PLANO] Tarefa raiz atualizada para: ${statusTarget}`);
        }
      }
    }
    // Caso 2: Tarefa dentro de um Slot (SlotIndex >= 0)
    else {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const slots = data.slots || [];

        if (slots[slotIndex]) {
          const lista = slots[slotIndex][campoNome] || [];

          if (lista[itemIndex]) {
            lista[itemIndex].status = statusTarget;

            // Atualiza o array inteiro de slots
            await updateDoc(docRef, { slots: slots });
            console.log(
              `[PLANO] Tarefa do slot ${slotIndex} atualizada para: ${statusTarget}`
            );
          }
        }
      }
    }
  } catch (erro) {
    console.error("[PLANO] Erro ao atualizar status:", erro);
    exibirErro("Falha ao atualizar status da tarefa.");
  }
}

function exibirErro(mensagem) {
  const alert = document.createElement("div");
  alert.className = "alert alert-danger alert-dismissible fade show";
  alert.style.position = "fixed";
  alert.style.top = "20px";
  alert.style.right = "20px";
  alert.style.zIndex = "9999";
  alert.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
  document.body.appendChild(alert); // Append no body para garantir visibilidade
  setTimeout(() => alert.remove(), 5000);
}

export function cleanup() {
  if (unsubscribeEventos) {
    unsubscribeEventos();
    console.log("[PLANO] Listener cancelado.");
  }
}
