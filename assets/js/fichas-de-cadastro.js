/**
 * Arquivo: assets/js/fichas-de-cadastro.js
 * Versão 2.0 - Com autenticação via e-mail corporativo (sem token)
 * Descrição: Controla a página pública de cadastro de novo colaborador.
 */

import { db, auth, functions, storage } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import {
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Elementos do DOM
const loadingOverlay = document.getElementById("loading-overlay");
const loginContainer = document.getElementById("login-container");
const formContainer = document.getElementById("form-container");
const form = document.getElementById("ficha-inscricao-form");
const messageContainer = document.getElementById("message-container");

// Elementos de login
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const btnLogin = document.getElementById("btn-login");

// Elementos do formulário
const nomeInput = document.getElementById("prof-nome");
const emailInput = document.getElementById("prof-email");
const profissaoSelect = document.getElementById("prof-profissao");
const btnSubmit = document.getElementById("btn-submit-ficha");

// Cloud Functions
const submeterFichaInscricao = httpsCallable(
  functions,
  "submeterFichaInscricao"
);

/**
 * Função principal - Verificar se usuário está logado
 */
window.addEventListener("load", async () => {
  setLoading(true, "Carregando...");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuário está logado
      console.log("✅ Usuário logado:", user.email);

      // Verificar se é e-mail corporativo
      if (!user.email.endsWith("@eupsico.org.br")) {
        setLoading(false);
        return showError(
          "Acesso negado. Use seu e-mail corporativo @eupsico.org.br"
        );
      }

      // Mostrar formulário
      await carregarFormulario(user);
    } else {
      // Mostrar tela de login
      setLoading(false);
      mostrarTelaLogin();
    }
  });
});

/**
 * Mostrar tela de login
 */
function mostrarTelaLogin() {
  loginContainer.style.display = "block";
  formContainer.style.display = "none";
  messageContainer.style.display = "none";
}

/**
 * Processar login
 */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email.endsWith("@eupsico.org.br")) {
    return showMessage("Use seu e-mail corporativo @eupsico.org.br", "error");
  }

  setLoading(true, "Fazendo login...");
  btnLogin.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login realizado com sucesso");
    // O onAuthStateChanged vai carregar o formulário automaticamente
  } catch (error) {
    console.error("❌ Erro no login:", error);
    setLoading(false);
    btnLogin.disabled = false;

    let mensagem = "Erro ao fazer login. Verifique suas credenciais.";

    if (error.code === "auth/wrong-password") {
      mensagem =
        "Senha incorreta. Verifique a senha temporária enviada pelo RH.";
    } else if (error.code === "auth/user-not-found") {
      mensagem = "E-mail não encontrado. Verifique o e-mail corporativo.";
    } else if (error.code === "auth/invalid-email") {
      mensagem = "E-mail inválido.";
    }

    showMessage(mensagem, "error");
  }
});

/**
 * Carregar formulário para usuário logado
 */
async function carregarFormulario(user) {
  try {
    setLoading(true, "Carregando seus dados...");

    // Preencher dados básicos
    if (nomeInput) nomeInput.value = user.displayName || "";
    if (emailInput) emailInput.value = user.email;

    // Carregar lista de profissões
    await carregarListaDeProfissoes();

    // Mostrar formulário
    loginContainer.style.display = "none";
    formContainer.style.display = "block";
    messageContainer.style.display = "none";
    setLoading(false);
  } catch (error) {
    console.error("❌ Erro ao carregar formulário:", error);
    setLoading(false);
    showError("Erro ao carregar formulário. Tente novamente.");
  }
}

/**
 * Carrega a lista de profissões das configurações do sistema
 */
async function carregarListaDeProfissoes(profissaoDefault = "") {
  if (!profissaoSelect) return;

  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists() && docSnap.data().listas?.profissoes) {
      const profissoes = docSnap.data().listas.profissoes;

      let optionsHtml = '<option value="">Selecione sua profissão</option>';
      profissoes.forEach((p) => {
        const selected = p === profissaoDefault ? "selected" : "";
        optionsHtml += `<option value="${p}" ${selected}>${p}</option>`;
      });

      profissaoSelect.innerHTML = optionsHtml;
    } else {
      console.warn("Lista de profissões não encontrada.");
      profissaoSelect.innerHTML =
        '<option value="">Lista não disponível</option>';
    }
  } catch (error) {
    console.error("Erro ao carregar lista de profissões:", error);
  }
}

/**
 * Trata a submissão do formulário
 */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    return showMessage(
      "Você precisa estar logado para enviar o formulário.",
      "error"
    );
  }

  console.log("Submetendo formulário...");

  setLoading(true, "Enviando cadastro...");

  try {
    // 1. Upload dos arquivos para o Storage
    const fileIdentidade = document.getElementById("doc-identidade").files[0];
    const fileDiploma = document.getElementById("doc-diploma").files[0];

    if (!fileIdentidade || !fileDiploma) {
      throw new Error("Por favor, anexe os documentos obrigatórios.");
    }

    setLoading(true, "Enviando documentos (1/2)...");
    const identidadeURL = await uploadArquivo(
      user.uid,
      "identidade",
      fileIdentidade
    );

    setLoading(true, "Enviando documentos (2/2)...");
    const diplomaURL = await uploadArquivo(user.uid, "diploma", fileDiploma);

    // 2. Coletar dados do formulário
    const formData = {
      nome: nomeInput.value,
      email: emailInput.value,
      contato: document.getElementById("prof-contato").value,
      profissao: profissaoSelect.value,
      userId: user.uid,
      documentos: {
        identidade: identidadeURL,
        diploma: diplomaURL,
      },
    };

    // 3. Enviar para a Cloud Function
    setLoading(true, "Salvando dados...");
    const result = await submeterFichaInscricao({ formData: formData });

    if (!result.data.sucesso) {
      throw new Error(result.data.erro || "Erro ao salvar cadastro.");
    }

    // 4. Sucesso
    setLoading(false);
    formContainer.style.display = "none";
    showMessage(
      "Cadastro realizado com sucesso!",
      "success",
      "Seu cadastro foi enviado. O RH entrará em contato para os próximos passos. Você já pode fechar esta página."
    );
  } catch (error) {
    console.error("Erro ao submeter:", error);
    setLoading(false);
    showMessage("Erro ao submeter cadastro", "error", error.message);
  }
});

/**
 * Função auxiliar para upload de arquivos
 */
async function uploadArquivo(userId, tipoDocumento, file) {
  if (!file) throw new Error(`Arquivo ${tipoDocumento} não encontrado.`);

  const storageRef = ref(
    storage,
    `admissoes/${userId}/${tipoDocumento}_${file.name}`
  );

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  console.log(`Arquivo ${tipoDocumento} enviado: ${downloadURL}`);
  return downloadURL;
}

// === Funções de UI ===

function setLoading(isLoading, message = "") {
  if (isLoading) {
    loadingOverlay.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    loadingOverlay.classList.add("is-visible");
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnLogin) btnLogin.disabled = true;
  } else {
    loadingOverlay.classList.remove("is-visible");
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnLogin) btnLogin.disabled = false;
  }
}

function showError(message) {
  loadingOverlay.classList.remove("is-visible");
  loginContainer.style.display = "none";
  formContainer.style.display = "none";
  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
    <div class="alert error">
      <i class="fas fa-exclamation-circle"></i>
      ${message}
    </div>
  `;
}

function showMessage(title, type, description = "") {
  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
    <div class="alert ${type}">
      <i class="fas fa-${
        type === "success" ? "check-circle" : "exclamation-circle"
      }"></i>
      <strong>${title}</strong>
      ${description ? `<p>${description}</p>` : ""}
    </div>
  `;
}
