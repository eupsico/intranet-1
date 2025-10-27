// modulos/rh/js/desligamento.js
// Versão: 2.1 (Fix de Inicialização e Correção de Bug do Firestore)

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  FieldValue,
  getDoc, // ADICIONADO: Necessário para buscar um documento único por referência
} from "../../../assets/js/firebase-init.js";
// Importa a função do novo utilitário user-management
import { fetchActiveEmployees } from "../../../assets/js/utils/user-management.js";

const desligamentoCollection = collection(db, "desligamentos");
const usuariosCollection = collection(db, "usuarios");
const solicitacoesTiCollection = collection(db, "solicitacoes_ti");

const listaDesligamentos = document.getElementById("lista-desligamentos");
const modalDesligamento = document.getElementById("modal-desligamento");
const selectColaborador = document.getElementById("colaborador-id");
const formDesligamento = document.getElementById("form-desligamento");

// Variável para armazenar dados do usuário logado (para auditoria)
let currentUserId = "ID_DO_USUARIO_LOGADO";

/**
 * FUNÇÃO DE INICIALIZAÇÃO PRINCIPAL DO MÓDULO.
 * Chamada pelo rh-painel.js.
 * @param {object} user - Objeto de usuário do Firebase Auth.
 * @param {object} userData - Dados de perfil do usuário logado no Firestore.
 */
export function initdesligamento(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Desligamentos...");

  // Define o ID do usuário logado para auditoria
  currentUserId = user.uid || "ID_DO_USUARIO_LOGADO";

  document
    .getElementById("btn-iniciar-desligamento")
    .addEventListener("click", () => abrirModalNovoDesligamento());
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => (modalDesligamento.style.display = "none")
    );
  }); // Eventos para as tabs de filtro

  document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .btn-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarProcessos(status);
    });
  }); // Adiciona listener aos botões de ação dentro do modal

  formDesligamento.addEventListener("click", handleDesligamentoActions); // Adiciona listener para processar a criação inicial ao selecionar o colaborador (Mantido o evento change fora do escopo init)
  selectColaborador.addEventListener("change", handleSelectColaboradorChange); // Carrega dados iniciais

  carregarColaboradoresAtivos();
  carregarProcessos("preparacao"); // Fase inicial
}

/**
 * Carrega a lista de colaboradores ativos para o campo Select, utilizando o utilitário.
 */
async function carregarColaboradoresAtivos() {
  const colaboradores = await fetchActiveEmployees();

  selectColaborador.innerHTML =
    '<option value="">Selecione o colaborador...</option>';

  if (colaboradores.length === 0) {
    console.warn(
      "Nenhum colaborador ativo encontrado para iniciar o desligamento."
    );
    const option = document.createElement("option");
    option.textContent = "Nenhum colaborador ativo encontrado.";
    option.disabled = true;
    selectColaborador.appendChild(option);
    return;
  }

  colaboradores.forEach((col) => {
    const option = document.createElement("option");
    option.value = col.id;
    option.textContent = col.nome || col.email || "Nome Indisponível";
    selectColaborador.appendChild(option);
  });
}

/**
 * Abre o modal para iniciar um novo processo de Desligamento.
 */
function abrirModalNovoDesligamento() {
  document.getElementById("desligamento-id").value = "";
  formDesligamento.reset();
  selectColaborador.disabled = false; // Exibe apenas os campos iniciais (seleção de colaborador, motivo, data)
  document.getElementById("desligamento-checklist").style.display = "none"; // Oculta a seleção de colaborador se já tiver um processo aberto (não é o caso aqui, mas boa prática)
  const colaboradorGroup = selectColaborador.closest(".form-group");
  if (colaboradorGroup) colaboradorGroup.style.display = "block";

  modalDesligamento.style.display = "flex";
}

/**
 * Processa a criação inicial de um registro de Desligamento, acionada pelo 'change' no select.
 * Função renomeada e adaptada para ser chamada como event listener.
 */
async function handleSelectColaboradorChange(e) {
  const colaboradorId = e.target.value;
  if (!colaboradorId) return; // TODO: Implementar lógica de busca para evitar duplicidade de desligamentos
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
        usuario: currentUserId,
      },
    ],
  };

  try {
    const docRef = await addDoc(desligamentoCollection, novoRegistro);
    document.getElementById("desligamento-id").value = docRef.id;
    selectColaborador.disabled = true;
    document.getElementById("desligamento-checklist").style.display = "block";
    window.showToast(
      "Processo de desligamento iniciado. Preencha os detalhes.",
      "success"
    );

    // Oculta a seleção de colaborador e exibe o nome (simulação)
    const colaboradorGroup = selectColaborador.closest(".form-group");
    if (colaboradorGroup) colaboradorGroup.style.display = "none"; // Recarrega a lista para mostrar o novo processo

    carregarProcessos("preparacao");
  } catch (error) {
    console.error("Erro ao iniciar Desligamento:", error);
    window.showToast("Erro ao iniciar o registro de Desligamento.", "error");
    selectColaborador.value = "";
  }
}

/**
 * Carrega e exibe os processos de desligamento com base no status.
 * @param {string} status
 */
async function carregarProcessos(status) {
  listaDesligamentos.innerHTML =
    '<div class="loading-spinner">Carregando processos...</div>';

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
      count++; // Renderização simplificada

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

    listaDesligamentos.innerHTML = htmlProcessos; // Atualiza o contador na aba de status

    document.querySelector(
      `.btn-tab[data-status="${status}"]`
    ).textContent = `${status.replace("-", " ").toUpperCase()} (${count})`; // Adiciona eventos para botões de gerenciar

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
    // CORRIGIDO: Usando getDoc para um único documento e checando a existência
    const deslSnap = await getDoc(desligamentoRef);

    if (!deslSnap.exists()) {
      window.showToast("Processo de desligamento não encontrado.", "error");
      return;
    }

    const deslData = deslSnap.data(); // 1. Popula campos básicos

    document.getElementById("desligamento-id").value = desligamentoId;
    document.getElementById("motivo-desligamento").value =
      deslData.motivo || "";
    document.getElementById("data-desligamento").value =
      deslData.dataEfetiva || "";
    selectColaborador.disabled = true; // Mantém a edição bloqueada após iniciar

    // Oculta a seleção de colaborador e exibe o nome (simulação)
    const colaboradorGroup = selectColaborador.closest(".form-group");
    if (colaboradorGroup) colaboradorGroup.style.display = "none";

    // 2. Popula campos do checklist
    // Nota: O select colaborador precisa ter a opção correta selecionada para o caso de o processo já existir.
    selectColaborador.value = deslData.colaboradorId;

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

    document.getElementById("data-baixa").value = deslData.dataBaixa || ""; // Exibe o checklist e o modal

    document.getElementById("desligamento-checklist").style.display = "block";
    modalDesligamento.style.display = "flex";
  } catch (error) {
    console.error("Erro ao carregar detalhes do Desligamento:", error);
    window.showToast("Erro ao carregar detalhes.", "error");
  }
}

/**
 * Centraliza o tratamento dos eventos de clique nos botões de ação do modal.
 * @param {Event} e
 */
async function handleDesligamentoActions(e) {
  const desligamentoId = document.getElementById("desligamento-id").value;
  if (!desligamentoId) return;

  // Ignora cliques que não são botões de ação (ex: no formulário em si)
  if (e.target.tagName !== "BUTTON" || e.target.type !== "button") return;

  const desligamentoRef = doc(db, "desligamentos", desligamentoId);

  if (e.target.classList.contains("btn-gerar-docs")) {
    // Assume que a ação gera a documentação (ex: PDF)
    const detalhes = document.getElementById("documentacao-detalhes").value;
    await updateDoc(desligamentoRef, {
      "documentacao.status": "finalizado",
      "documentacao.detalhes": detalhes,
      historico: FieldValue.arrayUnion({
        data: new Date(),
        acao: "Documentação de desligamento finalizada e preparada.",
        usuario: currentUserId,
      }),
    });
    window.showToast(
      "Documentação finalizada. Prossiga para as recuperações e TI.",
      "success"
    );
    carregarDetalhesDesligamento(desligamentoId);
  } else if (e.target.classList.contains("btn-marcar-ativos-ok")) {
    const detalhes = document.getElementById(
      "recuperacao-ativos-detalhes"
    ).value;
    await updateDoc(desligamentoRef, {
      "recuperacoes.status": "recuperado",
      "recuperacoes.detalhes": detalhes,
      historico: FieldValue.arrayUnion({
        data: new Date(),
        acao: "Ativos e bens da empresa marcados como recuperados.",
        usuario: currentUserId,
      }),
    });
    window.showToast(
      "Recuperação de ativos marcada como concluída.",
      "success"
    );
    carregarDetalhesDesligamento(desligamentoId);
  } else if (e.target.classList.contains("btn-enviar-cancelamento-ti")) {
    const detalhes = document.getElementById("cancelamento-ti-detalhes").value;
    const colaboradorName =
      selectColaborador.options[selectColaborador.selectedIndex].text; // 1. Cria o registro de solicitação de TI para cancelamento

    const solicitacao = {
      tipo: "Cancelamento de Usuário/Acessos (Offboarding)",
      desligamentoId: desligamentoId,
      colaborador: colaboradorName,
      detalhes: detalhes,
      status: "Pendente TI",
      dataSolicitacao: new Date(),
      solicitanteId: currentUserId,
    };
    const docSolicitacao = await addDoc(solicitacoesTiCollection, solicitacao);

    // 2. Atualiza o registro de Desligamento
    await updateDoc(desligamentoRef, {
      statusAtual: "pendente-ti",
      "acessosTI.status": "solicitado",
      "acessosTI.detalhes": detalhes,
      "acessosTI.solicitacaoId": docSolicitacao.id,
      historico: FieldValue.arrayUnion({
        data: new Date(),
        acao: "Solicitação de cancelamento de acessos enviada à TI.",
        usuario: currentUserId,
      }),
    });

    window.showToast(
      "Solicitação de cancelamento de acessos enviada à TI.",
      "warning"
    );
    carregarDetalhesDesligamento(desligamentoId);
    carregarProcessos("pendente-ti");
  } else if (e.target.classList.contains("btn-finalizar-desligamento")) {
    const dataBaixa = document.getElementById("data-baixa").value;

    const deslDoc = await getDoc(desligamentoRef);
    const deslData = deslDoc.data();

    if (
      deslData.documentacao.status !== "finalizado" ||
      deslData.recuperacoes.status !== "recuperado" ||
      // A confirmação da TI sobre o cancelamento deve ser marcada na solicitação_ti,
      // mas faremos uma checagem básica aqui, dependendo do campo do deslData
      deslData.acessosTI.status !== "concluido"
    ) {
      if (
        !confirm(
          "Atenção: Nem todas as etapas estão concluídas (Documentação, Recuperação ou TI). Deseja finalizar mesmo assim?"
        )
      ) {
        return;
      }
    } // 1. Atualiza status no registro de desligamento

    await updateDoc(desligamentoRef, {
      statusAtual: "realizado",
      dataBaixa: dataBaixa,
      historico: FieldValue.arrayUnion({
        data: new Date(),
        acao: "Desligamento finalizado e baixa registrada.",
        usuario: currentUserId,
      }),
    }); // 2. Atualiza status do usuário (muda na coleção principal 'usuarios')

    const usuarioRef = doc(db, "usuarios", deslData.colaboradorId);
    await updateDoc(usuarioRef, {
      status: "inativo",
      dataInativacao: new Date(),
    });

    window.showToast(
      "Processo de Desligamento FINALIZADO com sucesso.",
      "success"
    );
    modalDesligamento.style.display = "none";
    carregarProcessos("realizado");
  }
}
