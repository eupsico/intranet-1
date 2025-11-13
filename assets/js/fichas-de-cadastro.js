/**
 * Arquivo: assets/js/fichas-de-cadastro.js
 * Descrição: Controla a página pública de cadastro de novo colaborador.
 */

import { db, functions, storage } from "./firebase-init.js";
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
const form = document.getElementById("ficha-inscricao-form");
const messageContainer = document.getElementById("message-container");
const tokenInput = document.getElementById("token");
const nomeInput = document.getElementById("prof-nome");
const emailInput = document.getElementById("prof-email");
const profissaoSelect = document.getElementById("prof-profissao");
const btnSubmit = document.getElementById("btn-submit-ficha");

// Funções da Cloud Function
const validarTokenCadastro = httpsCallable(functions, "validarTokenCadastro");
const submeterFichaInscricao = httpsCallable(
  functions,
  "submeterFichaInscricao"
);

/**
 * Função principal - Chamada ao carregar a página
 */
window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    return showError(
      "Link inválido ou expirado. Por favor, solicite um novo link ao RH."
    );
  }

  tokenInput.value = token;

  try {
    // 1. Validar o token e buscar os dados
    console.log("Validando token...");
    const result = await validarTokenCadastro({ token: token });

    if (!result.data.sucesso) {
      throw new Error(result.data.erro || "Token inválido ou já utilizado.");
    }

    const dados = result.data;
    console.log("Token validado:", dados);

    // 2. Preencher o formulário
    if (nomeInput) nomeInput.value = dados.nome;
    if (emailInput) emailInput.value = dados.email;

    // 3. Carregar profissões (baseado no gestao_profissionais.js)
    await carregarListaDeProfissoes(dados.profissao);

    // 4. Mostrar formulário
    showForm();
  } catch (error) {
    console.error("Erro na validação do token:", error);
    showError(error.message);
  }
});

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
      let optionsHtml =
        '<option value="" disabled>Selecione uma profissão</option>';
      profissoes.forEach((p) => {
        const selected = p === profissaoDefault ? "selected" : "";
        optionsHtml += `<option value="${p}" ${selected}>${p}</option>`;
      });
      profissaoSelect.innerHTML = optionsHtml;
      // Se a profissão veio da vaga, seleciona ela
      if (profissaoDefault && !profissoes.includes(profissaoDefault)) {
        profissaoSelect.innerHTML += `<option value="${profissaoDefault}" selected>${profissaoDefault}</option>`;
      }
    } else {
      console.warn("Lista de profissões não encontrada.");
      profissaoSelect.innerHTML =
        '<option value="">Não foi possível carregar</option>';
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
  console.log("Submetendo formulário...");

  const token = tokenInput.value;
  const password = document.getElementById("prof-password").value;
  const passwordConfirm = document.getElementById(
    "prof-password-confirm"
  ).value;

  // Validações
  if (password !== passwordConfirm) {
    return showMessage("As senhas não conferem.", "error");
  }
  if (password.length < 6) {
    return showMessage("A senha deve ter no mínimo 6 caracteres.", "error");
  }

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
      token,
      "identidade",
      fileIdentidade
    );

    setLoading(true, "Enviando documentos (2/2)...");
    const diplomaURL = await uploadArquivo(token, "diploma", fileDiploma);

    // 2. Coletar dados do formulário
    const formData = {
      nome: nomeInput.value,
      email: emailInput.value,
      password: password,
      contato: document.getElementById("prof-contato").value,
      profissao: profissaoSelect.value,
      // Adicione outros campos aqui (CPF, Endereço, etc.)
      // ...
      documentos: {
        identidade: identidadeURL,
        diploma: diplomaURL,
        // Adicione outros URLs de docs aqui
      },
    };

    // 3. Enviar para a Cloud Function
    setLoading(true, "Criando seu usuário...");
    const result = await submeterFichaInscricao({
      token: token,
      formData: formData,
    });

    if (!result.data.sucesso) {
      throw new Error(result.data.erro || "Erro ao criar usuário.");
    }

    // 4. Sucesso
    setLoading(false);
    showForm(false);
    showMessage(
      "Cadastro realizado com sucesso!",
      "success",
      "Seu usuário foi criado e seus documentos enviados. O RH entrará em contato para os próximos passos. Você já pode fechar esta página."
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
async function uploadArquivo(token, tipoDocumento, file) {
  if (!file) throw new Error(`Arquivo ${tipoDocumento} não encontrado.`);

  // Usamos o token como parte do path para segurança
  const storageRef = ref(
    storage,
    `admissoes/${token}/${tipoDocumento}_${file.name}`
  );

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  console.log(`Arquivo ${tipoDocumento} enviado: ${downloadURL}`);
  return downloadURL;
}

// === Funções de UI ===

function setLoading(isLoading, message = "") {
  if (isLoading) {
    loadingOverlay.innerHTML = `<div class="loading-spinner"></div><p style="margin-top: 15px; color: #333;">${message}</p>`;
    loadingOverlay.classList.add("is-visible");
    if (btnSubmit) btnSubmit.disabled = true;
  } else {
    loadingOverlay.classList.remove("is-visible");
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function showForm(show = true) {
  form.style.display = show ? "block" : "none";
  loadingOverlay.classList.remove("is-visible");
}

function showError(message) {
  loadingOverlay.classList.remove("is-visible");
  form.style.display = "none";
  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
 	<div class="alert alert-danger">
 		<h4>Erro</h4>
 		<p>${message}</p>
 	</div>
 `;
}

function showMessage(title, type, message) {
  messageContainer.style.display = "block";
  messageContainer.innerHTML = `
 	<div class="alert alert-${type}">
 		<h4>${title}</h4>
 		<p>${message}</p>
 	</div>
 `;
}
