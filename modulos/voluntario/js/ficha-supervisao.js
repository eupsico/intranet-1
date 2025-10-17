// Arquivo: /modulos/voluntario/js/ficha-supervisao.js
// Versão 5.0 (Refatorado para usar o Design System sem perder lógica)

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
 */
export function init(user, userData) {
  currentUser = user;
  currentUserData = userData;

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
  if (outraContainer) outraContainer.classList.add("hidden");

  // Garante que as seções de edição também fiquem ocultas
  const secoesEdicao = document.getElementById("secoes-edicao");
  if (secoesEdicao) secoesEdicao.classList.add("hidden");

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
    // Limpa listeners antigos para evitar duplicação de cliques
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
        outraAbordagemContainer.classList.remove("hidden");
      } else {
        outraAbordagemContainer.classList.add("hidden");
      }
    });
  }
}

/**
 * Verifica se os campos com o atributo 'required' estão preenchidos.
 * @returns {boolean} - True se todos os campos obrigatórios estiverem preenchidos.
 */
function verificarCamposObrigatorios() {
  const camposObrigatorios = document.querySelectorAll(
    "#form-supervisao [required]"
  );
  for (const campo of camposObrigatorios) {
    if (!campo.value.trim()) {
      return false; // Apenas retorna falso, a mensagem será exibida pelo chamador.
    }
  }
  return true;
}

/**
 * Carrega a lista de supervisores do Firestore.
 */
async function loadSupervisores() {
  const select = document.getElementById("supervisor-nome");
  if (!select) return;

  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const supervisoresQuery = query(
      collection(db, "usuarios"),
      where("funcoes", "array-contains", "supervisor"),
      where("inativo", "==", false)
    );
    const querySnapshot = await getDocs(supervisoresQuery);

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
      option.dataset.nome = supervisor.nome;
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

  const abordagemSelect = document.getElementById("abordagem-teorica");
  const abordagem = abordagemSelect.value;

  return {
    psicologoUid: currentUser.uid,
    psicologoNome: document.getElementById("psicologo-nome").value,
    identificacaoGeral: {
      supervisorUid: selectedSupervisorOption.value,
      supervisorNome: selectedSupervisorOption.dataset.nome || "",
      dataSupervisao: document.getElementById("data-supervisao").value,
      dataInicioTerapia: document.getElementById("data-inicio-terapia").value,
    },
    identificacaoPsicologo: {
      periodo: document.getElementById("psicologo-periodo").value,
      abordagem: abordagem,
      outraAbordagem: document.getElementById("outra-abordagem-texto").value,
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
    fase1: {},
    fase2: {},
    fase3: {},
    observacoesFinais: {},
  };
}

/**
 * Lida com o clique do botão de salvar, validando e enviando os dados para o Firestore.
 */
async function handleFinalSave() {
  if (!verificarCamposObrigatorios()) {
    // Em vez de um modal, usamos um alerta mais simples para validação.
    const messageContainer = document.getElementById("message-container");
    messageContainer.className = "alert alert-error";
    messageContainer.textContent =
      "Por favor, preencha todos os campos com asterisco (*).";
    return;
  }

  const saveButton = document.getElementById("btn-salvar-inicial");
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  // Limpa mensagens de erro antigas
  const messageContainer = document.getElementById("message-container");
  messageContainer.className = "hidden";

  const formData = coletarDadosIniciais();
  const dadosParaSalvar = {
    ...formData,
    criadoEm: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  };

  try {
    const collectionRef = collection(db, "fichas-supervisao-casos");
    const newDocRef = await addDoc(collectionRef, dadosParaSalvar);

    console.log("Ficha criada com o ID: ", newDocRef.id);
    showGlobalModal(
      // <--- MUDANÇA AQUI
      "Ficha salva com sucesso!",
      'Para editar, acesse a aba "Meus Acompanhamentos".',
      "success",
      () => {
        setupNovaFicha(); // Reseta o formulário
      }
    );
  } catch (error) {
    console.error("Erro ao salvar a ficha:", error);
    showGlobalModal(
      // <--- MUDANÇA AQUI
      "Ocorreu um erro ao salvar a ficha.",
      "Por favor, tente novamente. Se o erro persistir, contate o suporte.",
      "error",
      () => {
        saveButton.disabled = false;
        saveButton.textContent = "Salvar Etapa Inicial";
      }
    );
  }
}

/**
 * Exibe um modal GLOBAL usando as classes do design-system.css.
 * Substitui a antiga função showLocalModal.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'error'} type - O tipo de modal (usado para estilização opcional).
 * @param {function} [onCloseCallback] - Função a ser executada ao fechar.
 */
function showGlobalModal(title, message, type = "success", onCloseCallback) {
  const existingModal = document.getElementById("global-confirmation-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "global-confirmation-modal";
  // Usa a classe do Design System
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <h2>${title}</h2>
            <button class="close-modal-btn">&times;</button>
        </div>
        <div class="modal-body">
            <p>${message}</p>
        </div>
        <div class="modal-footer">
            <button class="action-button ok-btn">OK</button>
        </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Força a transição de opacidade
  setTimeout(() => modalOverlay.classList.add("is-visible"), 10);

  const closeModal = () => {
    modalOverlay.classList.remove("is-visible");
    setTimeout(() => {
      modalOverlay.remove();
      if (typeof onCloseCallback === "function") {
        onCloseCallback();
      }
    }, 300); // Espera a animação de fade-out
  };

  modalOverlay.querySelector(".ok-btn").addEventListener("click", closeModal);
  modalOverlay
    .querySelector(".close-modal-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}
