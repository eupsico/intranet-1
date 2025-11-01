// assets/js/candidatura-publica.js
// Versão: 2.2 - Ajustada para evitar preflight OPTIONS e permitir resposta CORS

import {
  db,
  collection,
  getDocs,
  query,
  where,
  functions,
  httpsCallable,
} from "./firebase-init.js";

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxB7aRviy5muNFULBkWOP_mdpm5aeCFXL3ouiadEfNzE8RpSmMJdCSifuuqYRRTqfwpxw/exec"; 

const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATURAS_COLLECTION_NAME = "candidaturas";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

const formCandidatura = document.getElementById("form-candidatura");
const selectVaga = document.getElementById("select-vaga");
const btnSubmit = document.getElementById("btn-submit");
const msgFeedback = document.getElementById("mensagem-feedback");
const vagaSelectGroup = document.getElementById("vaga-select-group");
const loadingVagas = document.getElementById("loading-vagas");

const cepCandidato = document.getElementById("cep-candidato");
const enderecoRua = document.getElementById("endereco-rua");
const cidadeEndereco = document.getElementById("cidade-endereco");
const estadoEndereco = document.getElementById("estado-endereco");

const salvarCandidaturaCallable = httpsCallable(functions, "salvarCandidatura");

/**
 * Função que envia o arquivo ao Apps Script sem preflight OPTIONS.
 */
function uploadCurriculoToAppsScript(file, vagaTitulo, nomeCandidato) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo anexado."));

    const reader = new FileReader();
    reader.onload = function (e) {
      const fileData = e.target.result.split(",")[1];

      // Envia via FormData (evita preflight)
      const formData = new FormData();
      formData.append("fileData", fileData);
      formData.append("mimeType", file.type);
      formData.append("fileName", file.name);
      formData.append("nomeCandidato", nomeCandidato);
      formData.append("vagaTitulo", vagaTitulo);

      console.log(`LOG-CLIENTE: Enviando POST (fetch) para: ${WEB_APP_URL}`);

      fetch(WEB_APP_URL, {
        method: "POST",
        body: formData, // 👈 sem headers personalizados
      })
        .then((res) => res.json())
        .then((response) => {
          console.log("LOG-CLIENTE: Resposta JSON do Apps Script:", response);
          if (response.status === "success" && response.fileUrl) {
            resolve(response.fileUrl);
          } else {
            reject(
              new Error(
                response.message || "Erro desconhecido no servidor Apps Script."
              )
            );
          }
        })
        .catch((error) => {
          console.error("LOG-CLIENTE: 💥 FETCH/REDE FALHOU. DETALHES:", error);
          reject(
            new Error(
              `Falha na comunicação com o servidor de upload. Detalhes: ${error.message}.`
            )
          );
        });
    };
    reader.onerror = function (error) {
      reject(new Error("Erro ao ler o arquivo: " + error.message));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Envia os dados da candidatura para o Firebase.
 */
async function enviarCandidaturaParaFirebase(dadosCandidatura) {
  try {
    const result = await salvarCandidaturaCallable(dadosCandidatura);
    if (result.data && result.data.success) {
      exibirFeedback(
        "mensagem-sucesso",
        `Candidatura enviada com sucesso para a vaga de ${dadosCandidatura.titulo_vaga_original}!`,
        false
      );
      formCandidatura.reset();
      enderecoRua.value = "";
      cidadeEndereco.value = "";
      estadoEndereco.value = "";
    } else {
      throw new Error(
        result.data.message || "Erro desconhecido ao processar candidatura."
      );
    }
  } catch (error) {
    console.error("Erro ao salvar candidatura no Firebase:", error);
    exibirFeedback(
      "mensagem-erro",
      `Erro ao salvar candidatura. Detalhes: ${error.message}`,
      true
    );
  }
}

/**
 * Carrega vagas ativas.
 */
async function carregarVagasAtivas() {
  try {
    const q = query(vagasCollection, where("status", "==", "em-divulgacao"));
    const snapshot = await getDocs(q);

    selectVaga.innerHTML = '<option value="">Selecione a vaga...</option>';

    if (snapshot.empty) {
      loadingVagas.textContent =
        "Não há vagas abertas para candidatura no momento.";
      loadingVagas.style.display = "block";
      vagaSelectGroup.style.display = "none";
      btnSubmit.disabled = true;
      return;
    }

    loadingVagas.style.display = "none";
    vagaSelectGroup.style.display = "block";
    btnSubmit.disabled = false;

    snapshot.forEach((doc) => {
      const vaga = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = vaga.nome;
      option.setAttribute("data-titulo", vaga.nome);
      selectVaga.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar vagas:", error);
    loadingVagas.textContent =
      "Erro ao carregar as vagas. Tente novamente mais tarde.";
    btnSubmit.disabled = true;
    vagaSelectGroup.style.display = "none";
  }
}

/**
 * Consulta CEP e preenche endereço.
 */
async function buscarCEP() {
  const cep = cepCandidato.value.replace(/\D/g, "");
  if (cep.length !== 8) return;

  enderecoRua.value = "Buscando...";
  cidadeEndereco.value = "Buscando...";
  estadoEndereco.value = "Buscando...";

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (data.erro) {
      exibirFeedback(
        "mensagem-erro",
        "CEP não encontrado. Verifique e digite o endereço manualmente.",
        true
      );
      enderecoRua.value = "";
      cidadeEndereco.value = "";
      estadoEndereco.value = "";
      return;
    }

    enderecoRua.value = data.logradouro || "";
    cidadeEndereco.value = data.localidade || "";
    estadoEndereco.value = data.uf || "";
    exibirFeedback("", "", false);
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    exibirFeedback(
      "mensagem-erro",
      "Falha na comunicação com a API de CEP. Preencha manualmente.",
      true
    );
  }
}

/**
 * Handler principal do formulário.
 */
async function handleCandidatura(e) {
  e.preventDefault();
  btnSubmit.disabled = true;
  msgFeedback.innerHTML =
    '<div class="loading-spinner">Enviando candidatura e currículo...</div>';

  const vagaSelectOption = selectVaga.options[selectVaga.selectedIndex];
  const vagaId = selectVaga.value;
  const tituloVagaOriginal = vagaSelectOption.getAttribute("data-titulo");
  const nome = document.getElementById("nome-candidato").value.trim();
  const email = document.getElementById("email-candidato").value.trim();
  const telefone = document.getElementById("telefone-candidato").value.trim();
  const cep = cepCandidato.value.trim();
  const numero = document.getElementById("numero-endereco").value.trim();
  const cidade = cidadeEndereco.value.trim();
  const estado = estadoEndereco.value.trim();
  const resumoExperiencia = document
    .getElementById("resumo-experiencia")
    .value.trim();
  const habilidades = document
    .getElementById("habilidades-competencias")
    .value.trim();
  const comoConheceu = document.getElementById("como-conheceu").value;
  const arquivoCurriculo = document.getElementById("anexo-curriculo").files[0];

  if (
    !vagaId ||
    !nome ||
    !email ||
    !telefone ||
    !cep ||
    !numero ||
    !cidade ||
    !estado ||
    !resumoExperiencia ||
    !habilidades ||
    !comoConheceu ||
    !arquivoCurriculo
  ) {
    exibirFeedback(
      "mensagem-erro",
      "Preencha todos os campos obrigatórios e anexe o currículo.",
      true
    );
    return;
  }

  const maxFileSize = 5 * 1024 * 1024;
  if (arquivoCurriculo.size > maxFileSize) {
    exibirFeedback(
      "mensagem-erro",
      "O arquivo do currículo não pode exceder 5MB.",
      true
    );
    return;
  }

  try {
    const linkCurriculoDrive = await uploadCurriculoToAppsScript(
      arquivoCurriculo,
      tituloVagaOriginal,
      nome
    );

    const novaCandidatura = {
      vaga_id: vagaId,
      titulo_vaga_original: tituloVagaOriginal,
      nome_completo: nome,
      email: email,
      telefone_contato: telefone,
      cep: cep,
      numero_endereco: numero,
      cidade: cidade,
      estado: estado,
      resumo_experiencia: resumoExperiencia,
      habilidades_competencias: habilidades,
      como_conheceu: comoConheceu,
      link_curriculo_drive: linkCurriculoDrive,
    };

    await enviarCandidaturaParaFirebase(novaCandidatura);
  } catch (error) {
    console.error("Erro completo na candidatura:", error);
    exibirFeedback(
      "mensagem-erro",
      `Erro ao enviar a candidatura. Detalhes: ${error.message}`,
      true
    );
  }
}

function exibirFeedback(classe, mensagem, reHabilitar) {
  msgFeedback.innerHTML = `<div class="${classe}">${mensagem}</div>`;
  if (reHabilitar) {
    btnSubmit.disabled = false;
  } else if (classe === "mensagem-sucesso") {
    setTimeout(() => {
      msgFeedback.innerHTML = "";
      carregarVagasAtivas();
    }, 5000);
  } else if (!classe) {
    msgFeedback.innerHTML = "";
  }
}

cepCandidato.addEventListener("blur", buscarCEP);
document.addEventListener("DOMContentLoaded", carregarVagasAtivas);
formCandidatura.addEventListener("submit", handleCandidatura);
