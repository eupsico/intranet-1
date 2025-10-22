// /modulos/gestao/js/plano-de-acao.js
// VERSÃO 2.2 (CORRIGIDO - Erro "type is not defined")

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "../../../assets/js/firebase-init.js";

let todasAsTarefas = [],
  gestoresCache = [],
  departamentosCache = [];
let currentUser = null;

export async function init(user, userData) {
  console.log("[PLANO] Módulo Plano de Ação iniciado.");
  currentUser = userData;
  await carregarDadosIniciais();
  setupEventListeners();
}

async function carregarDadosIniciais() {
  await Promise.all([
    fetchGestores(),
    fetchDepartamentos(),
    fetchAtasEPlanos(),
  ]);
  renderizarQuadroKanban();
}

async function fetchAtasEPlanos() {
  todasAsTarefas = [];
  try {
    const q = query(
      collection(firestoreDb, "gestao_atas"),
      orderBy("dataReuniao", "desc")
    );
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const ata = { id: doc.id, ...doc.data() };
      const dataReuniao = ata.dataReuniao
        ? new Date(ata.dataReuniao + "T00:00:00").toLocaleDateString("pt-BR")
        : "Data Indefinida";
      const origem = `${ata.tipo} - ${dataReuniao}`;

      // --- CORREÇÃO APLICADA AQUI ---
      const processarItens = (lista, tipo) => {
        // 'tipo' agora é um parâmetro da função
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
      // --- FIM DA CORREÇÃO ---

      processarItens(ata.planoDeAcao, "atividade");
      processarItens(ata.encaminhamentos, "encaminhamento");
    });
  } catch (error) {
    console.error("[PLANO] Erro ao buscar atas e planos:", error);
    // Lança o erro para ser apanhado pelo bloco superior e exibir uma mensagem ao utilizador.
    throw new Error(
      "Falha ao buscar dados das atas. Verifique as permissões do Firestore."
    );
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
    const snapshot = await getDocs(q);
    gestoresCache = snapshot.docs.map((doc) => ({
      nome: doc.data().nome,
      departamento: doc.data().departamento || "",
    }));
  } catch (error) {
    console.error("[PLANO] Erro ao buscar gestores:", error);
  }
}

async function fetchDepartamentos() {
  if (departamentosCache.length > 0) return;
  try {
    const configRef = doc(firestoreDb, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (
      docSnap.exists() &&
      docSnap.data().listas &&
      docSnap.data().listas.departamentos
    ) {
      departamentosCache = docSnap.data().listas.departamentos.sort();
    } else {
      console.warn(
        "Nenhuma lista de departamentos encontrada em 'configuracoesSistema/geral/listas/departamentos'."
      );
    }
  } catch (error) {
    console.error("[PLANO] Erro ao buscar departamentos:", error);
  }
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
  Object.values(colunas).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  if (todasAsTarefas.length === 0) {
    colunas["A Fazer"].innerHTML =
      "<p style='padding: 10px; text-align: center;'>Nenhuma tarefa encontrada.</p>";
  }

  todasAsTarefas.forEach((item) => {
    const status = item.status || "A Fazer";
    if (colunas[status]) {
      colunas[status].innerHTML += criarCardHtml(item);
    }
  });
}

function criarCardHtml(item) {
  const responsavel = item.responsavel || item.nomeEncaminhado;
  const prazo = item.prazo
    ? new Date(item.prazo + "T00:00:00").toLocaleDateString("pt-BR")
    : "N/A";
  const identifier = `${item.ataId}|${item.itemIndex}`;

  return `
        <div class="kanban-card card-${
          item.type
        }" data-identifier="${identifier}" data-type="${item.type}">
            <p><strong>Responsável:</strong> ${responsavel}</p>
            <p><strong>Prazo:</strong> ${prazo}</p>
            <p>${item.descricao || item.motivo}</p>
            <small>Origem: ${item.origem}</small>
            <div class="card-actions">
                ${criarBotoesDeAcao(item)}
            </div>
        </div>`;
}

function criarBotoesDeAcao(item) {
  const status = item.status || "A Fazer";
  const btnAtualizar = `<button class="action-button update-btn">Ver/Atualizar</button>`;
  let statusButtons = "";

  if (status === "A Fazer")
    statusButtons = `<button class="action-button move-btn" data-new-status="Em Andamento">Iniciar ▶</button>`;
  if (status === "Em Andamento")
    statusButtons = `<button class="action-button move-btn" data-new-status="A Fazer">◀ Voltar</button><button class="action-button move-btn" data-new-status="Concluído">✔ Concluir</button>`;
  if (status === "Atrasado")
    statusButtons = `<button class="action-button move-btn" data-new-status="Em Andamento">Retomar ▶</button><button class="action-button move-btn" data-new-status="Concluído">✔ Concluir</button>`;
  if (status === "Concluído")
    statusButtons = `<button class="action-button move-btn" data-new-status="Em Andamento">◀ Reabrir</button>`;

  return `${btnAtualizar}<div class="status-buttons">${statusButtons}</div>`;
}

function setupEventListeners() {
  const board = document.querySelector(".kanban-board");
  if (board) {
    board.addEventListener("click", (e) => {
      const card = e.target.closest(".kanban-card");
      if (!card) return;

      const [ataId, itemIndexStr] = card.dataset.identifier.split("|");
      const itemIndex = parseInt(itemIndexStr, 10);
      const type = card.dataset.type;
      const item = todasAsTarefas.find(
        (t) => t.ataId === ataId && t.itemIndex === itemIndex && t.type === type
      );

      if (
        e.target.classList.contains("update-btn") ||
        e.target.classList.contains("move-btn")
      ) {
        const novoStatus = e.target.dataset.newStatus || null;
        abrirModalAtualizacao(item, novoStatus);
      }
    });
  }

  const modal = document.getElementById("update-modal");
  if (modal) {
    const btnFecharTopo = document.getElementById("btn-cancel-update");
    const btnFecharRodape = document.getElementById("btn-fechar-modal-rodape");
    const btnSalvarGeral = document.getElementById("btn-salvar-geral");

    btnFecharTopo.addEventListener(
      "click",
      () => (modal.style.display = "none")
    );
    btnFecharRodape.addEventListener(
      "click",
      () => (modal.style.display = "none")
    );

    const novoBtnSalvarGeral = btnSalvarGeral.cloneNode(true);
    btnSalvarGeral.parentNode.replaceChild(novoBtnSalvarGeral, btnSalvarGeral);
    novoBtnSalvarGeral.addEventListener("click", handleSalvarGeral);

    document.getElementById("modal-necessita-encaminhar").onchange = (e) => {
      document.getElementById("encaminhamento-vinculado-form").style.display = e
        .target.checked
        ? "block"
        : "none";
    };

    document.getElementById("modal-enc-gestor").onchange = (e) => {
      const gestor = gestoresCache.find((g) => g.nome === e.target.value);
      document.getElementById("modal-enc-departamento").value =
        gestor?.departamento || "";
    };
  }
}

async function handleSalvarGeral() {
  const necessitaEncaminhar = document.getElementById(
    "modal-necessita-encaminhar"
  ).checked;
  const saveButton = document.getElementById("btn-salvar-geral");
  saveButton.disabled = true;
  saveButton.textContent = "A guardar...";

  try {
    const textoAtualizacao = document
      .getElementById("modal-nova-atualizacao")
      .value.trim();
    const novoStatus =
      document.getElementById("update-modal").dataset.novoStatus;
    if (textoAtualizacao || novoStatus) {
      await handleSalvarAtualizacao();
    }

    if (necessitaEncaminhar) {
      await handleSalvarEncaminhamento();
    }

    document.getElementById("update-modal").style.display = "none";
    await carregarDadosIniciais();
  } catch (error) {
    console.error("Erro no salvamento geral:", error);
    alert(`Ocorreu um erro: ${error.message}`);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Alterações";
  }
}

async function handleSalvarAtualizacao() {
  const modal = document.getElementById("update-modal");
  const [ataId, itemIndexStr] = modal.dataset.identifier.split("|");
  const itemIndex = parseInt(itemIndexStr, 10);
  const type = modal.dataset.type;
  const novoStatus = modal.dataset.novoStatus;
  const textoAtualizacao = document.getElementById(
    "modal-nova-atualizacao"
  ).value;

  if (novoStatus && !textoAtualizacao.trim()) {
    throw new Error(
      "Por favor, descreva a atualização para poder mover o card."
    );
  }

  const ataRef = doc(firestoreDb, "gestao_atas", ataId);

  const docSnap = await getDoc(ataRef);
  if (!docSnap.exists()) throw new Error("Documento da ata não encontrado.");

  const ataData = docSnap.data();
  const fieldToUpdate =
    type === "atividade" ? "planoDeAcao" : "encaminhamentos";
  const arrayToUpdate = ataData[fieldToUpdate]
    ? [...ataData[fieldToUpdate]]
    : [];

  if (itemIndex < 0 || itemIndex >= arrayToUpdate.length) {
    throw new Error("Índice do item a ser atualizado é inválido.");
  }

  const itemToUpdate = arrayToUpdate[itemIndex];

  if (textoAtualizacao.trim()) {
    if (!itemToUpdate.historicoAtualizacoes) {
      itemToUpdate.historicoAtualizacoes = [];
    }
    itemToUpdate.historicoAtualizacoes.push({
      texto: textoAtualizacao,
      data: new Date().toISOString(),
      responsavel: currentUser?.nome || "Usuário",
    });
  }

  if (novoStatus) {
    itemToUpdate.status = novoStatus;
  }

  await updateDoc(ataRef, { [fieldToUpdate]: arrayToUpdate });
}

async function handleSalvarEncaminhamento() {
  const modal = document.getElementById("update-modal");
  const [ataId] = modal.dataset.identifier.split("|");

  const novoEncaminhamento = {
    nomeEncaminhado: document.getElementById("modal-enc-gestor").value,
    departamentoIndicado: document.getElementById("modal-enc-departamento")
      .value,
    motivo: document.getElementById("modal-enc-motivo").value,
    prazo: document.getElementById("modal-enc-prazo").value,
    status: "A Fazer",
    historicoAtualizacoes: [],
  };

  if (Object.values(novoEncaminhamento).some((v) => !v)) {
    throw new Error("Preencha todos os campos do novo encaminhamento.");
  }

  const ataRef = doc(firestoreDb, "gestao_atas", ataId);
  await updateDoc(ataRef, {
    encaminhamentos: arrayUnion(novoEncaminhamento),
  });
}

function abrirModalAtualizacao(item, novoStatus = null) {
  const modal = document.getElementById("update-modal");
  if (!item) return;

  modal.dataset.identifier = `${item.ataId}|${item.itemIndex}`;
  modal.dataset.type = item.type;
  modal.dataset.novoStatus = novoStatus || "";

  document.getElementById("modal-title").textContent =
    "Atualizar " + (item.type === "atividade" ? "Atividade" : "Encaminhamento");
  document.getElementById(
    "modal-origem"
  ).textContent = `Origem: ${item.origem}`;

  renderizarHistorico(item.historicoAtualizacoes);

  document.getElementById("modal-nova-atualizacao").value = "";
  document.getElementById("modal-necessita-encaminhar").checked = false;
  document.getElementById("encaminhamento-vinculado-form").style.display =
    "none";

  const gestorSelect = document.getElementById("modal-enc-gestor");
  gestorSelect.innerHTML =
    '<option value="">Selecione...</option>' +
    gestoresCache
      .map((g) => `<option value="${g.nome}">${g.nome}</option>`)
      .join("");

  const deptoSelect = document.getElementById("modal-enc-departamento");
  deptoSelect.innerHTML =
    '<option value="">Selecione...</option>' +
    departamentosCache
      .map((d) => `<option value="${d}">${d}</option>`)
      .join("");

  modal.style.display = "flex";
}

function renderizarHistorico(historico) {
  const container = document.getElementById("historico-atualizacoes");
  if (historico && historico.length > 0) {
    container.innerHTML = [...historico]
      .reverse()
      .map(
        (entrada) => `
            <div class="entrada-historico">
                <p>${entrada.texto}</p>
                <small>Por: ${entrada.responsavel} em ${new Date(
          entrada.data
        ).toLocaleString("pt-BR")}</small>
            </div>`
      )
      .join("");
  } else {
    container.innerHTML =
      '<p style="text-align:center; color:#888;">Nenhuma atualização registada.</p>';
  }
}
