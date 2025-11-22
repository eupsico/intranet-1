/**
 * Arquivo: assets/js/fichas-de-cadastro.js
 * Versão 2.1 - Correção de Null References
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

// ============================================
// FUNÇÃO AUXILIAR PARA SEGURANÇA
// ============================================
function getElementSafe(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`⚠️ Elemento não encontrado no DOM: ${id}`);
  }
  return el;
}

// ============================================
// INICIALIZAR ELEMENTOS DO DOM
// ============================================
// Usar getElementSafe para evitar null references
let loadingOverlay = null;
let loginContainer = null;
let formContainer = null;
let form = null;
let messageContainer = null;
let loginForm = null;
let loginEmail = null;
let loginPassword = null;
let btnLogin = null;
let nomeInput = null;
let emailInput = null;
let profissaoSelect = null;
let btnSubmit = null;

// Função para inicializar referências DOM após o carregamento
function initializarElementosDOM() {
  loadingOverlay = getElementSafe("loading-overlay");
  loginContainer = getElementSafe("login-container");
  formContainer = getElementSafe("form-container");
  form = getElementSafe("ficha-inscricao-form");
  messageContainer = getElementSafe("message-container");
  loginForm = getElementSafe("login-form");
  loginEmail = getElementSafe("login-email");
  loginPassword = getElementSafe("login-password");
  btnLogin = getElementSafe("btn-login");
  nomeInput = getElementSafe("prof-nome");
  emailInput = getElementSafe("prof-email");
  profissaoSelect = getElementSafe("prof-profissao");
  btnSubmit = getElementSafe("btn-submit-ficha");

  console.log("✅ Elementos do DOM inicializados com sucesso");
}

// Cloud Functions
const submeterFichaInscricao = httpsCallable(
  functions,
  "submeterFichaInscricao"
);

// ============================================
// PONTO DE ENTRADA - AGUARDAR DOM PRONTO
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM carregado, iniciando aplicação...");
  initializarElementosDOM();
  setupEventListeners();
  verificarAutenticacao();
});

// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Login form
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Formulário de inscrição
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
}

// ============================================
// VERIFICAR AUTENTICAÇÃO NA INICIALIZAÇÃO
// ============================================
function verificarAutenticacao() {
  setLoading(true, "Carregando...");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("✅ Usuário logado:", user.email);

      // Verificar se é e-mail corporativo
      if (!user.email.endsWith("@eupsico.org.br")) {
        setLoading(false);
        return showError(
          "❌ Acesso negado. Use seu e-mail corporativo @eupsico.org.br"
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
}

// ============================================
// TELA DE LOGIN
// ============================================
function mostrarTelaLogin() {
  if (loginContainer) loginContainer.style.display = "block";
  if (formContainer) formContainer.style.display = "none";
  if (messageContainer) messageContainer.style.display = "none";
}

// ============================================
// PROCESSAR LOGIN
// ============================================
async function handleLogin(e) {
  e.preventDefault();

  if (!loginEmail || !loginPassword) {
    console.error("❌ Campos de login não encontrados");
    return;
  }

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email.endsWith("@eupsico.org.br")) {
    return showMessage("Use seu e-mail corporativo @eupsico.org.br", "error");
  }

  setLoading(true, "Fazendo login...");
  if (btnLogin) btnLogin.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login realizado com sucesso");
    // O onAuthStateChanged vai carregar o formulário automaticamente
  } catch (error) {
    console.error("❌ Erro no login:", error);
    setLoading(false);
    if (btnLogin) btnLogin.disabled = false;

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
}

// ============================================
// CARREGAR FORMULÁRIO PARA USUÁRIO LOGADO
// ============================================
async function carregarFormulario(user) {
  try {
    setLoading(true, "Carregando seus dados...");

    // Preencher dados básicos
    if (nomeInput) {
      nomeInput.value = user.displayName || "";
    } else {
      console.warn("⚠️ Campo nomeInput não encontrado");
    }

    if (emailInput) {
      emailInput.value = user.email;
    } else {
      console.warn("⚠️ Campo emailInput não encontrado");
    }

    // Carregar lista de profissões
    await carregarListaDeProfissoes();

    // Mostrar formulário
    if (loginContainer) loginContainer.style.display = "none";
    if (formContainer) formContainer.style.display = "block";
    if (messageContainer) messageContainer.style.display = "none";

    setLoading(false);
  } catch (error) {
    console.error("❌ Erro ao carregar formulário:", error);
    setLoading(false);
    showError("Erro ao carregar formulário. Tente novamente.");
  }
}

// ============================================
// CARREGAR LISTA DE PROFISSÕES
// ============================================
async function carregarListaDeProfissoes(profissaoDefault = "") {
  if (!profissaoSelect) {
    console.warn("⚠️ profissaoSelect não encontrado");
    return;
  }

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
      console.warn(
        "⚠️ Lista de profissões não encontrada em configuracoesSistema"
      );
      profissaoSelect.innerHTML =
        '<option value="">Lista não disponível</option>';
    }
  } catch (error) {
    console.error("❌ Erro ao carregar lista de profissões:", error);
  }
}

// ============================================
// SUBMETER FORMULÁRIO
// ============================================
async function handleFormSubmit(e) {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    return showMessage(
      "Você precisa estar logado para enviar o formulário.",
      "error"
    );
  }

  console.log("📝 Submetendo formulário...");

  setLoading(true, "Enviando cadastro...");

  try {
    // 1. Validar arquivos
    const fileIdentidade = document.getElementById("doc-identidade");
    const fileDiploma = document.getElementById("doc-diploma");

    if (!fileIdentidade || !fileIdentidade.files[0]) {
      throw new Error("Por favor, anexe o documento de identidade.");
    }

    if (!fileDiploma || !fileDiploma.files[0]) {
      throw new Error("Por favor, anexe o diploma/certificado.");
    }

    // 2. Upload dos arquivos
    setLoading(true, "Enviando documentos (1/2)...");
    const identidadeURL = await uploadArquivo(
      user.uid,
      "identidade",
      fileIdentidade.files[0]
    );

    setLoading(true, "Enviando documentos (2/2)...");
    const diplomaURL = await uploadArquivo(
      user.uid,
      "diploma",
      fileDiploma.files[0]
    );

    // 3. Coletar dados do formulário
    const contatoInput = document.getElementById("prof-contato");
    const formData = {
      nome: nomeInput?.value || "",
      email: emailInput?.value || "",
      contato: contatoInput?.value || "",
      profissao: profissaoSelect?.value || "",
      userId: user.uid,
      documentos: {
        identidade: identidadeURL,
        diploma: diplomaURL,
      },
    };

    // 4. Enviar para Cloud Function
    setLoading(true, "Salvando dados...");
    const result = await submeterFichaInscricao({ formData });

    if (!result.data.sucesso) {
      throw new Error(result.data.erro || "Erro ao salvar cadastro.");
    }

    // 5. Sucesso
    setLoading(false);
    if (formContainer) formContainer.style.display = "none";
    showMessage(
      "✅ Cadastro realizado com sucesso!",
      "success",
      "Seu cadastro foi enviado. O RH entrará em contato para os próximos passos. Você já pode fechar esta página."
    );
  } catch (error) {
    console.error("❌ Erro ao submeter:", error);
    setLoading(false);
    showMessage("Erro ao submeter cadastro", "error", error.message);
  }
}

// ============================================
// UPLOAD DE ARQUIVOS
// ============================================
async function uploadArquivo(userId, tipoDocumento, file) {
  if (!file) {
    throw new Error(`Arquivo ${tipoDocumento} não encontrado.`);
  }

  try {
    const storageRef = ref(
      storage,
      `admissoes/${userId}/${tipoDocumento}_${Date.now()}_${file.name}`
    );

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`✅ Arquivo ${tipoDocumento} enviado com sucesso`);
    return downloadURL;
  } catch (error) {
    console.error(`❌ Erro ao fazer upload de ${tipoDocumento}:`, error);
    throw error;
  }
}

// ============================================
// FUNÇÕES DE UI
// ============================================

function setLoading(isLoading, message = "") {
  if (!loadingOverlay) {
    console.warn("⚠️ loadingOverlay não encontrado");
    return;
  }

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
  if (loadingOverlay) {
    loadingOverlay.classList.remove("is-visible");
  }

  if (loginContainer) loginContainer.style.display = "none";
  if (formContainer) formContainer.style.display = "none";

  if (messageContainer) {
    messageContainer.style.display = "block";
    messageContainer.innerHTML = `
      <div class="alert error">
        <i class="fas fa-exclamation-circle"></i>
        <strong>${message}</strong>
      </div>
    `;
  } else {
    console.error("❌", message);
  }
}

function showMessage(title, type, description = "") {
  if (!messageContainer) {
    console.warn("⚠️ messageContainer não encontrado");
    alert(title);
    return;
  }

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

// ============================================
// FIM DO ARQUIVO
// ============================================
