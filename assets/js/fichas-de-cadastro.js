/**
 * Arquivo: assets/js/fichas-de-cadastro.js
 * Versão 3.0 - Autenticação simplificada (mesma estratégia do app.js)
 * Descrição: Formulário de cadastro com login Google
 */

import { db, auth, functions, storage } from "./firebase-init.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import {
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
// ELEMENTOS DO DOM
// ============================================
let loadingOverlay = null;
let loginView = null;
let formContainer = null;
let form = null;
let messageContainer = null;
let nomeInput = null;
let emailInput = null;
let profissaoSelect = null;
let btnSubmit = null;

// Cloud Functions
const submeterFichaInscricao = httpsCallable(
  functions,
  "submeterFichaInscricao"
);

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Inicializando página de cadastro...");

  // Atribuir referências aos elementos
  loadingOverlay = document.getElementById("loading-overlay");
  loginView = document.getElementById("login-view");
  formContainer = document.getElementById("form-container");
  form = document.getElementById("ficha-inscricao-form");
  messageContainer = document.getElementById("message-container");
  nomeInput = document.getElementById("prof-nome");
  emailInput = document.getElementById("prof-email");
  profissaoSelect = document.getElementById("prof-profissao");
  btnSubmit = document.getElementById("btn-submit-ficha");

  // Verificar autenticação
  verificarAutenticacao();

  // Setup form submission
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
});

// ============================================
// VERIFICAR AUTENTICAÇÃO
// ============================================
function verificarAutenticacao() {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (user) {
        console.log("✅ Usuário logado:", user.email);

        // Verificar se é e-mail corporativo
        if (!user.email.endsWith("@eupsico.org.br")) {
          setLoading(false);
          mostrarErro(
            "❌ Acesso negado. Use sua conta corporativa @eupsico.org.br"
          );
          await signOut(auth);
          mostrarTelaLogin();
          return;
        }

        // Carregar formulário
        await carregarFormulario(user);
      } else {
        // Mostrar tela de login
        setLoading(false);
        mostrarTelaLogin();
      }
    } catch (error) {
      console.error("❌ Erro na verificação:", error);
      setLoading(false);
      mostrarTelaLogin();
    }
  });
}

// ============================================
// MOSTRAR TELA DE LOGIN
// ============================================
function mostrarTelaLogin() {
  if (!loginView || !formContainer || !messageContainer) return;

  formContainer.style.display = "none";
  messageContainer.style.display = "none";
  loginView.style.display = "block";

  // Renderizar HTML de login
  const isSubPage = window.location.pathname.includes("/modulos/");
  const pathPrefix = isSubPage ? "../../../" : "./";

  loginView.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <img src="${pathPrefix}assets/img/logo-branca.png" alt="Logo EuPsico" style="height: 60px; margin-bottom: 20px;">
      <h2>🔐 Ficha de Admissão</h2>
      <p style="color: #666; margin-bottom: 30px;">
        Por favor, faça login para continuar.<br>
        Utilize sua conta corporativa @eupsico.org.br para acessar.
      </p>
      <button id="btn-login-google" style="
        padding: 14px 24px;
        background: #fff;
        color: #333;
        border: 2px solid #4285F4;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
      ">
        <i class="fab fa-google"></i> Entrar com Google
      </button>
    </div>
  `;

  // Adicionar event listener
  const btnLoginGoogle = document.getElementById("btn-login-google");
  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", handleGoogleLogin);
  }
}

// ============================================
// LOGIN COM GOOGLE
// ============================================
async function handleGoogleLogin() {
  setLoading(true, "Redirecionando para Google...");

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log("✅ Login Google bem-sucedido:", user.email);

    // onAuthStateChanged vai carregar o formulário automaticamente
  } catch (error) {
    console.error("❌ Erro no login Google:", error);
    setLoading(false);

    let mensagem = "Erro ao fazer login com Google. Tente novamente.";

    if (error.code === "auth/popup-closed-by-user") {
      mensagem = "Você fechou a janela de login. Por favor, tente novamente.";
    } else if (error.code === "auth/popup-blocked") {
      mensagem = "Pop-up foi bloqueado. Permita pop-ups e tente novamente.";
    } else if (error.code === "auth/cancelled-popup-request") {
      mensagem = "Login cancelado.";
    }

    mostrarMensagem(mensagem, "error");
  }
}

// ============================================
// CARREGAR FORMULÁRIO
// ============================================
async function carregarFormulario(user) {
  try {
    setLoading(true, "Carregando formulário...");

    // Preencher dados básicos
    if (nomeInput) {
      nomeInput.value = user.displayName || "";
    }

    if (emailInput) {
      emailInput.value = user.email;
    }

    // Carregar lista de profissões
    await carregarListaDeProfissoes();

    // Mostrar formulário
    if (loginView) loginView.style.display = "none";
    if (formContainer) formContainer.style.display = "block";
    if (messageContainer) messageContainer.style.display = "none";

    setLoading(false);
  } catch (error) {
    console.error("❌ Erro ao carregar formulário:", error);
    setLoading(false);
    mostrarErro("Erro ao carregar formulário. Tente novamente.");
  }
}

// ============================================
// CARREGAR LISTA DE PROFISSÕES
// ============================================
async function carregarListaDeProfissoes() {
  if (!profissaoSelect) return;

  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists() && docSnap.data().listas?.profissoes) {
      const profissoes = docSnap.data().listas.profissoes;

      let optionsHtml = '<option value="">Selecione sua profissão</option>';
      profissoes.forEach((p) => {
        optionsHtml += `<option value="${p}">${p}</option>`;
      });

      profissaoSelect.innerHTML = optionsHtml;
    } else {
      console.warn("⚠️ Lista de profissões não encontrada");
      profissaoSelect.innerHTML =
        '<option value="">Lista não disponível</option>';
    }
  } catch (error) {
    console.error("❌ Erro ao carregar profissões:", error);
  }
}

// ============================================
// SUBMETER FORMULÁRIO
// ============================================
async function handleFormSubmit(e) {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    mostrarMensagem(
      "Você precisa estar logado para enviar o formulário.",
      "error"
    );
    return;
  }

  console.log("📝 Submetendo formulário...");
  setLoading(true, "Enviando cadastro...");

  try {
    // 1. Validar arquivos
    const fileIdentidade = document.getElementById("doc-identidade");
    const fileDiploma = document.getElementById("doc-diploma");

    if (!fileIdentidade?.files[0]) {
      throw new Error("Por favor, anexe o documento de identidade.");
    }

    if (!fileDiploma?.files[0]) {
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
    mostrarSucesso(
      "✅ Cadastro realizado com sucesso!",
      "Seu cadastro foi enviado. O RH entrará em contato para os próximos passos."
    );
  } catch (error) {
    console.error("❌ Erro ao submeter:", error);
    setLoading(false);
    mostrarMensagem(`Erro ao submeter cadastro: ${error.message}`, "error");
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
    console.error(`❌ Erro ao fazer upload:`, error);
    throw error;
  }
}

// ============================================
// FUNÇÕES DE UI
// ============================================

function setLoading(isLoading, message = "") {
  if (!loadingOverlay) return;

  if (isLoading) {
    loadingOverlay.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    loadingOverlay.classList.add("is-visible");
    if (btnSubmit) btnSubmit.disabled = true;
  } else {
    loadingOverlay.classList.remove("is-visible");
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function mostrarErro(mensagem) {
  if (!messageContainer) {
    console.error("❌", mensagem);
    alert(mensagem);
    return;
  }

  if (loadingOverlay) loadingOverlay.classList.remove("is-visible");
  if (loginView) loginView.style.display = "none";
  if (formContainer) formContainer.style.display = "none";

  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
    <div class="alert error">
      <i class="fas fa-exclamation-circle"></i>
      <strong>${mensagem}</strong>
    </div>
  `;
}

function mostrarMensagem(titulo, tipo, descricao = "") {
  if (!messageContainer) {
    alert(titulo);
    return;
  }

  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
    <div class="alert ${tipo}">
      <i class="fas fa-${
        tipo === "success" ? "check-circle" : "exclamation-circle"
      }"></i>
      <strong>${titulo}</strong>
      ${descricao ? `<p>${descricao}</p>` : ""}
    </div>
  `;
}

function mostrarSucesso(titulo, descricao = "") {
  mostrarMensagem(titulo, "success", descricao);
}

// ============================================
// FIM DO ARQUIVO
// ============================================
