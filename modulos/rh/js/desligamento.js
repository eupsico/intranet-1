// modulos/rh/js/desligamento.js

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  firebase,
} from "../../../assets/js/firebase-init.js";
// Assumindo que a função para buscar usuários ativos está em um utilitário
import { fetchActiveEmployees } from "../../../assets/js/utils/user-management.js"; // Novo utilitário hipotético

const desligamentoCollection = collection(db, "desligamentos");
const usuariosCollection = collection(db, "usuarios");
const solicitacoesTiCollection = collection(db, "solicitacoes_ti");

const listaDesligamentos = document.getElementById("lista-desligamentos");
const modalDesligamento = document.getElementById("modal-desligamento");
const selectColaborador = document.getElementById("colaborador-id");
const formDesligamento = document.getElementById("form-desligamento");

/**
 * Inicializa o módulo de Desligamento.
 */
function initDesligamento() {
  console.log("Módulo de Gestão de Desligamentos carregado.");

  document
    .getElementById("btn-iniciar-desligamento")
    .addEventListener("click", () => abrirModalNovoDesligamento());
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => (modalDesligamento.style.display = "none")
    );
  });

  // Eventos para as tabs de filtro
  document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .btn-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarProcessos(status);
    });
  });

  // Adiciona listener aos botões de ação dentro do modal
  formDesligamento.addEventListener("click", handleDesligamentoActions);

  // Carrega dados iniciais
  carregarColaboradoresAtivos();
  carregarProcessos("preparacao"); // Fase inicial
}

/**
 * Carrega a lista de colaboradores ativos para o campo Select.
 */
async function carregarColaboradoresAtivos() {
  // Busca usuários com status 'ativo' ou similar
  // TODO: Implementar a fetchActiveEmployees corretamente para buscar usuários
  // Mock:
  try {
    const snapshot = await getDocs(
      query(usuariosCollection, where("status", "==", "ativo"))
    );
    selectColaborador.innerHTML =
      '<option value="">Selecione o colaborador...</option>';

    snapshot.forEach((doc) => {
      const user = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = user.nome || "Nome Indisponível";
      selectColaborador.appendChild(option);
    });
  } catch (error) {
    console.warn(
      "Não foi possível carregar a lista de colaboradores ativos. Usando mock."
    );
    // Mock de colaboradores se a busca falhar
    const mockColaboradores = [
      { id: "user123", nome: "João da Silva" },
      { id: "user456", nome: "Maria Oliveira" },
    ];
    selectColaborador.innerHTML =
      '<option value="">Selecione o colaborador...</option>';
    mockColaboradores.forEach((col) => {
      const option = document.createElement("option");
      option.value = col.id;
      option.textContent = col.nome;
      selectColaborador.appendChild(option);
    });
  }
}

/**
 * Abre o modal para iniciar um novo processo de Desligamento.
 */
function abrirModalNovoDesligamento() {
  document.getElementById("desligamento-id").value = "";
  formDesligamento.reset();
  selectColaborador.disabled = false;
  document.getElementById("desligamento-checklist").style.display = "none";
  modalDesligamento.style.display = "flex";
}

/**
 * Processa a criação inicial de um registro de Desligamento.
 */
selectColaborador.addEventListener("change", async (e) => {
  const colaboradorId = e.target.value;
  if (!colaboradorId) return;

  // TODO: Implementar lógica de busca para evitar duplicidade de desligamentos

  // Define os dados iniciais do processo de desligamento
  const novoRegistro = {
    colaboradorId: colaboradorId,
    nomeColaborador:
      selectColaborador.options[selectColaborador.selectedIndex].text,
    motivo: "",
    dataEfetiva: null,
    statusAtual: "preparacao",
    documentacao: {
      status: "pendente",
      detalhes: "",
    },
    recuperacoes: {
      status: "pendente",
      detalhes: "",
    },
    acessosTI: {
      status: "pendente",
      detalhes: null,
      solicitacaoId: null,
    },
    historico: [
      {
        data: new Date(),
        acao: "Processo de desligamento iniciado pelo RH.",
      },
    ],
  };

  try {
    const docRef = await addDoc(desligamentoCollection, novoRegistro);
    document.getElementById("desligamento-id").value = docRef.id;
    selectColaborador.disabled = true;
    document.getElementById("desligamento-checklist").style.display = "block";
    alert("Processo de desligamento iniciado. Preencha os detalhes.");
    // A lógica de preenchimento inicial dos campos (motivo, data) será feita
    // pelo próprio usuário do RH após selecionar o colaborador.
  } catch (error) {
    console.error("Erro ao iniciar Desligamento:", error);
    alert("Erro ao iniciar o registro de Desligamento.");
    selectColaborador.value = "";
  }
});

/**
 * Carrega e exibe os processos de desligamento com base no status.
 * @param {string} status
 */
async function carregarProcessos(status) {
  listaDesligamentos.innerHTML = '<div class="loading-spinner"></div>';

  const q = query(desligamentoCollection, where("statusAtual", "==", status));

  try {
    const snapshot = await getDocs(q);
    let htmlProcessos = "";
    let count = 0;

    if (snapshot.empty) {
      listaDesligamentos.innerHTML = `<p id="mensagem-desligamentos">Nenhum processo na fase: **${status.toUpperCase()}**.</p>`;
      return;
    }

    snapshot.forEach((doc) => {
      const desl = doc.data();
      desl.id = doc.id;
      count++;

      // Renderização simplificada
      htmlProcessos += `
                <div class="card card-desligamento" data-id="${desl.id}">
                    <h4>${desl.nomeColaborador}</h4>
                    <p>Motivo: ${desl.motivo.substring(0, 50)}...</p>
                    <p>Data Prevista: ${desl.dataEfetiva || "N/A"}</p>
                    <button class="btn btn-sm btn-info btn-gerenciar" data-id="${
                      desl.id
                    }">Gerenciar Checklist</button>
                </div>
            `;
    });

    listaDesligamentos.innerHTML = htmlProcessos;

    // Atualiza o contador na aba de status
    document.querySelector(
      `.btn-tab[data-status="${status}"]`
    ).textContent = `${status.replace("-", " ").toUpperCase()} (${count})`;

    // Adiciona eventos para botões de gerenciar
    document.querySelectorAll(".btn-gerenciar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        carregarDetalhesDesligamento(e.target.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar processos de Desligamento:", error);
    listaDesligamentos.innerHTML =
      '<p class="error">Erro ao carregar a lista.</p>';
  }
}

/**
 * Carrega e popula o modal com os detalhes de um processo de Desligamento.
 * @param {string} desligamentoId
 */
async function carregarDetalhesDesligamento(desligamentoId) {
  const desligamentoRef = doc(db, "desligamentos", desligamentoId);
  try {
    const deslSnap = await getDocs(desligamentoRef);
    if (!deslSnap.exists()) {
      alert("Processo de Desligamento não encontrado.");
      return;
    }
    const deslData = deslSnap.data();

    // 1. Popula campos básicos
    document.getElementById("desligamento-id").value = desligamentoId;
    document.getElementById("motivo-desligamento").value =
      deslData.motivo || "";
    document.getElementById("data-desligamento").value =
      deslData.dataEfetiva || "";
    selectColaborador.disabled = true; // Mantém a edição bloqueada após iniciar

    // 2. Popula campos do checklist
    document.getElementById("documentacao-detalhes").value =
      deslData.documentacao.detalhes || "";
    document.getElementById(
      "status-documentacao"
    ).textContent = `Status: ${deslData.documentacao.status.toUpperCase()}`;

    document.getElementById("recuperacao-ativos-detalhes").value =
      deslData.recuperacoes.detalhes || "";
    document.getElementById(
      "status-ativos"
    ).textContent = `Status: ${deslData.recuperacoes.status.toUpperCase()}`;

    document.getElementById("cancelamento-ti-detalhes").value =
      deslData.acessosTI.detalhes || "";
    document.getElementById(
      "status-cancelamento-ti"
    ).textContent = `Status: ${deslData.acessosTI.status.toUpperCase()}`;

    document.getElementById("data-baixa").value = deslData.dataBaixa || "";

    // Exibe o checklist e o modal
    document.getElementById("desligamento-checklist").style.display = "block";
    modalDesligamento.style.display = "flex";
  } catch (error) {
    console.error("Erro ao carregar detalhes do Desligamento:", error);
    alert("Erro ao carregar detalhes. Verifique o console.");
  }
}

/**
 * Centraliza o tratamento dos eventos de clique nos botões de ação do modal.
 * @param {Event} e
 */
async function handleDesligamentoActions(e) {
  const desligamentoId = document.getElementById("desligamento-id").value;
  if (!desligamentoId) return;

  const desligamentoRef = doc(db, "desligamentos", desligamentoId);

  if (e.target.classList.contains("btn-gerar-docs")) {
    // Assume que a ação gera a documentação (ex: PDF)
    const detalhes = document.getElementById("documentacao-detalhes").value;
    await updateDoc(desligamentoRef, {
      "documentacao.status": "finalizado",
      "documentacao.detalhes": detalhes,
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Documentação de desligamento finalizada e preparada.",
      }),
    });
    alert("Documentação finalizada. Prossiga para as recuperações e TI.");
    carregarDetalhesDesligamento(desligamentoId);
  } else if (e.target.classList.contains("btn-marcar-ativos-ok")) {
    const detalhes = document.getElementById(
      "recuperacao-ativos-detalhes"
    ).value;
    await updateDoc(desligamentoRef, {
      "recuperacoes.status": "recuperado",
      "recuperacoes.detalhes": detalhes,
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Ativos e bens da empresa marcados como recuperados.",
      }),
    });
    alert("Recuperação de ativos marcada como concluída.");
    carregarDetalhesDesligamento(desligamentoId);
  } else if (e.target.classList.contains("btn-enviar-cancelamento-ti")) {
    const detalhes = document.getElementById("cancelamento-ti-detalhes").value;
    const colaborador =
      selectColaborador.options[selectColaborador.selectedIndex].text;

    // 1. Cria o registro de solicitação de TI para cancelamento
    const solicitacao = {
      tipo: "Cancelamento de Usuário/Acessos",
      desligamentoId: desligamentoId,
      colaborador: colaborador,
      detalhes: detalhes,
      status: "Pendente TI",
      dataSolicitacao: new Date(),
    };
    const docSolicitacao = await addDoc(solicitacoesTiCollection, solicitacao);

    // 2. Atualiza o registro de Desligamento
    await updateDoc(desligamentoRef, {
      statusAtual: "pendente-ti",
      "acessosTI.status": "solicitado",
      "acessosTI.detalhes": detalhes,
      "acessosTI.solicitacaoId": docSolicitacao.id,
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Solicitação de cancelamento de acessos enviada à TI.",
      }),
    });

    alert("Solicitação de cancelamento de acessos enviada à TI.");
    carregarDetalhesDesligamento(desligamentoId);
    carregarProcessos("pendente-ti");
  } else if (e.target.classList.contains("btn-finalizar-desligamento")) {
    const dataBaixa = document.getElementById("data-baixa").value;

    // Validação básica se as etapas críticas foram concluídas (Documentação e TI/Recuperação)
    const deslData = (await getDocs(desligamentoRef)).data();
    if (
      deslData.documentacao.status !== "finalizado" ||
      deslData.recuperacoes.status !== "recuperado" ||
      deslData.acessosTI.status !== "concluido"
    ) {
      // Esta validação dependerá da confirmação da TI sobre o cancelamento
      if (
        !confirm(
          "Atenção: Nem todas as etapas estão concluídas (Documentação, Recuperação ou TI). Deseja finalizar mesmo assim?"
        )
      ) {
        return;
      }
    }

    // 1. Atualiza status no registro de desligamento
    await updateDoc(desligamentoRef, {
      statusAtual: "realizado",
      dataBaixa: dataBaixa,
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Desligamento finalizado e baixa registrada.",
      }),
    });

    // 2. Atualiza status do usuário (muda na coleção principal 'usuarios')
    const usuarioRef = doc(db, "usuarios", deslData.colaboradorId);
    await updateDoc(usuarioRef, {
      status: "inativo",
      dataInativacao: new Date(),
    });

    alert("Processo de Desligamento FINALIZADO com sucesso.");
    modalDesligamento.style.display = "none";
    carregarProcessos("realizado");
  }
}

document.addEventListener("DOMContentLoaded", initDesligamento);
