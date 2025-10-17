// Arquivo: /modulos/voluntario/js/ficha-supervisao.js
// Versão 4.0 (Atualizado para a sintaxe modular do Firebase v9)

// 1. Importa as funções necessárias do nosso arquivo central de inicialização
import {
  db,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

let currentUser;
let currentUserData;

/**
 * Função Principal (INIT): Ponto de entrada do módulo.
 * A assinatura foi simplificada para receber os dados diretamente.
 */
export function init(user, userData) {
  currentUser = user;
  currentUserData = userData;

  // Garante que o DOM está pronto antes de manipular os elementos
  // Usar setTimeout(..., 0) é uma boa prática para isso.
  setTimeout(() => {
    const form = document.getElementById("form-supervisao");
    if (!form) {
      console.error(
        "Erro Crítico: O formulário #form-supervisao não foi encontrado."
      );
      return;
    }
    setupNovaFicha();
    setupEventListeners();
  }, 0);
}

/**
 * Prepara o formulário para uma nova entrada, limpando campos e resetando botões.
 */
function setupNovaFicha() {
  const form = document.getElementById("form-supervisao");
  if (form) form.reset();

  const nomePsicologo = document.getElementById("psicologo-nome");
  if (nomePsicologo && currentUserData) {
    nomePsicologo.value = currentUserData.nome || "";
  }

  const documentIdInput = document.getElementById("document-id");
  if (documentIdInput) documentIdInput.value = "";

  const outraContainer = document.getElementById("outra-abordagem-container");
  if (outraContainer) outraContainer.style.display = "none";

  const saveButton = document.getElementById("btn-salvar-inicial");
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Etapa Inicial";
  }

  loadSupervisores();
}

/**
 * Adiciona os listeners de eventos aos elementos do formulário.
 */
function setupEventListeners() {
  const saveButton = document.getElementById("btn-salvar-inicial");
  if (saveButton) {
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);
    newSaveButton.addEventListener("click", handleFinalSave);
  }
  const abordagemSelect = document.getElementById("abordagem-teorica");
  const outraAbordagemContainer = document.getElementById(
    "outra-abordagem-container"
  );

  if (abordagemSelect && outraAbordagemContainer) {
    abordagemSelect.addEventListener("change", () => {
      if (abordagemSelect.value === "Outra") {
        outraAbordagemContainer.style.display = "block";
      } else {
        outraAbordagemContainer.style.display = "none";
      }
    });
  }
}

/**
 * Verifica se os campos marcados como obrigatórios estão preenchidos.
 * @returns {boolean} - True se todos os campos obrigatórios estiverem preenchidos.
 */
function verificarCamposObrigatorios() {
  const camposObrigatorios = document.querySelectorAll(
    ".required-for-autosave"
  );
  for (const campo of camposObrigatorios) {
    if (!campo.value.trim()) {
      return false;
    }
  }
  return true;
}

/**
 * Carrega a lista de supervisores do Firestore usando a sintaxe v9.
 */
async function loadSupervisores() {
  const select = document.getElementById("supervisor-nome");
  if (!select) return;

  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    // SINTAXE V9: Usa as funções query, collection e where
    const supervisoresQuery = query(
      collection(db, "usuarios"),
      where("funcoes", "array-contains", "supervisor"),
      where("inativo", "==", false)
    );

    const querySnapshot = await getDocs(supervisoresQuery); // SINTAXE V9

    if (querySnapshot.empty) {
      select.innerHTML =
        '<option value="">Nenhum supervisor encontrado</option>';
      return;
    }

    const supervisores = [];
    querySnapshot.forEach((doc) => {
      supervisores.push({ uid: doc.id, ...doc.data() });
    });

    supervisores.sort((a, b) => a.nome.localeCompare(b.nome));

    select.innerHTML = '<option value="">Selecione um supervisor</option>';
    supervisores.forEach((supervisor) => {
      const option = document.createElement("option");
      option.value = supervisor.uid;
      option.dataset.nome = supervisor.nome; // Armazena o nome no dataset
      option.textContent = supervisor.nome;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar supervisores:", error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

/**
 * Coleta todos os dados dos campos do formulário e os estrutura em um objeto.
 * @returns {object} - Objeto com os dados da ficha.
 */
function coletarDadosIniciais() {
  const supervisorSelect = document.getElementById("supervisor-nome");
  const selectedSupervisorOption =
    supervisorSelect.options[supervisorSelect.selectedIndex];

  // O campo de abordagem teórica não estava sendo coletado, adicionei ele.
  const abordagemSelect = document.getElementById("abordagem-teorica");
  const abordagem = abordagemSelect.value;

  return {
    psicologoUid: currentUser.uid,
    psicologoNome: document.getElementById("psicologo-nome").value,

    // Mantive a estrutura original dos seus dados
    identificacaoGeral: {
      supervisorUid: selectedSupervisorOption.value,
      supervisorNome: selectedSupervisorOption.dataset.nome || "",
      dataSupervisao: document.getElementById("data-supervisao").value,
      dataInicioTerapia: document.getElementById("data-inicio-terapia").value,
    },
    identificacaoPsicologo: {
      periodo: document.getElementById("psicologo-periodo").value,
      abordagem: abordagem,
    },
    identificacaoCaso: {
      iniciais: document
        .getElementById("paciente-iniciais")
        .value.toUpperCase(),
      idade: document.getElementById("paciente-idade").value,
      genero: document.getElementById("paciente-genero").value,
      numSessoes: document.getElementById("paciente-sessoes").value,
      queixa: document.getElementById("queixa-demanda").value,
    },
    // As fases e observações são inicializadas como objetos vazios, como no original
    fase1: {},
    fase2: {},
    fase3: {},
    observacoesFinais: {},
  };
}

/**
 * Lida com o clique do botão de salvar, validando e enviando os dados para o Firestore com a sintaxe v9.
 */
async function handleFinalSave() {
  if (!verificarCamposObrigatorios()) {
    showLocalModal(
      "Por favor, preencha todos os campos com asterisco (*).",
      "error"
    );
    return;
  }

  const saveButton = document.getElementById("btn-salvar-inicial");
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  const formData = coletarDadosIniciais();
  const dadosParaSalvar = {
    ...formData,
    criadoEm: serverTimestamp(), // SINTAXE V9
    lastUpdated: serverTimestamp(), // SINTAXE V9
  };

  try {
    // SINTAXE V9: Usa collection e addDoc
    const collectionRef = collection(db, "fichas-supervisao-casos");
    const newDocRef = await addDoc(collectionRef, dadosParaSalvar);

    console.log("Ficha criada com o ID: ", newDocRef.id);
    showLocalModal(
      'Ficha salva com sucesso! Para editar, acesse a aba "Meus Acompanhamentos".',
      "success",
      () => {
        setupNovaFicha(); // Reseta o formulário
      }
    );
  } catch (error) {
    console.error("Erro ao salvar a ficha:", error);
    showLocalModal(
      "Ocorreu um erro ao salvar a ficha. Tente novamente.",
      "error",
      () => {
        saveButton.disabled = false;
        saveButton.textContent = "Salvar Etapa Inicial";
      }
    );
  }
}

/**
 * Exibe um modal de notificação local. (Nenhuma alteração necessária aqui)
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'error'} type - O tipo de modal.
 * @param {function} [onCloseCallback] - Função a ser executada ao fechar.
 */
function showLocalModal(message, type = "success", onCloseCallback) {
  const existingModal = document.getElementById("local-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "local-modal";
  modalOverlay.className = "local-modal-overlay";

  const modalBox = document.createElement("div");
  modalBox.className = "local-modal-box";
  modalBox.classList.add(type);

  const modalContent = document.createElement("div");
  modalContent.className = "local-modal-content";
  modalContent.textContent = message;

  const modalActions = document.createElement("div");
  modalActions.className = "local-modal-actions";

  const okButton = document.createElement("button");
  okButton.className = "action-button";
  okButton.textContent = "OK";

  modalActions.appendChild(okButton);
  modalBox.appendChild(modalContent);
  modalBox.appendChild(modalActions);
  modalOverlay.appendChild(modalBox);

  document.body.appendChild(modalOverlay);

  const closeModal = () => {
    modalOverlay.remove();
    if (typeof onCloseCallback === "function") {
      onCloseCallback();
    }
  };

  okButton.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}
