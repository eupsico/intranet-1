// assets/js/candidatura-publica.js
// Versão: 1.9 - Tentativa de correção de comunicação com Cloud Function (Content-Type: text/plain).

// Importa as funções necessárias e as instâncias (functions, httpsCallable)
import {
  db,
  collection,
  getDocs,
  query,
  where,
  functions,
  httpsCallable,
} from "./firebase-init.js";

// =====================================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO DE UPLOAD
// =====================================================================

// ✅ URL REAL DA CLOUD FUNCTION
const WEB_APP_URL = "https://uploadcandidatura-tlwthl477q-uc.a.run.app";

const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATURAS_COLLECTION_NAME = "candidaturas"; // Coleção de destino no Firestore

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// Elementos do DOM
const formCandidatura = document.getElementById("form-candidatura");
const selectVaga = document.getElementById("select-vaga");
const btnSubmit = document.getElementById("btn-submit");
const msgFeedback = document.getElementById("mensagem-feedback");
const vagaSelectGroup = document.getElementById("vaga-select-group");
const loadingVagas = document.getElementById("loading-vagas");

// Campos de Endereço
const cepCandidato = document.getElementById("cep-candidato");
const enderecoRua = document.getElementById("endereco-rua");
const cidadeEndereco = document.getElementById("cidade-endereco");
const estadoEndereco = document.getElementById("estado-endereco");

// Inicialização e Callable Function
// ⚠️ Função descontinuada, pois a lógica de salvar metadados foi para a Cloud Function HTTP.
const salvarCandidaturaCallable = httpsCallable(functions, "salvarCandidatura");

/**
 * Função que lê o arquivo binário e o envia como Base64 para a Cloud Function.
 * @param {File} file Arquivo do currículo.
 * @param {string} vagaTitulo Título da vaga.
 * @param {string} nomeCandidato Nome do candidato.
 * @param {object} dadosCandidatura Objeto completo de metadados da candidatura.
 * @returns {Promise<string>} Promessa que resolve com o link (URL) do arquivo no Storage.
 */
function uploadCurriculoToCloudFunction(
  file,
  vagaTitulo,
  nomeCandidato,
  dadosCandidatura
) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo anexado."));

    const reader = new FileReader();

    reader.onload = function (e) {
      const fileData = e.target.result.split(",")[1]; // Pega a parte Base64

      const payload = {
        // Dados do Arquivo
        fileData: fileData,
        mimeType: file.type,
        fileName: file.name, // Dados para a Cloud Function
        nomeCandidato: nomeCandidato,
        vagaTitulo: vagaTitulo, // Metadados completos da candidatura (para salvar no Firestore)
        ...dadosCandidatura,
      }; // Chamada HTTP POST para a Cloud Function

      fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "text/plain;charset=utf-8", // 👈 CORREÇÃO: Voltando para text/plain para forçar Simple Request e evitar falhas de CORS/Preflight
        },
      })
        .then((res) => {
          // Tratamento de erros HTTP (4xx ou 5xx)
          if (!res.ok) {
            return res
              .json()
              .then((errorData) => {
                throw new Error(
                  errorData.message || `Erro HTTP: ${res.status}`
                );
              })
              .catch(() => {
                throw new Error(`Erro HTTP Desconhecido: ${res.status}`);
              });
          }
          return res.json();
        })
        .then((response) => {
          // A Cloud Function deve retornar { status: 'success', fileUrl: '...', docId: '...' }
          if (response.status === "success" && response.fileUrl) {
            resolve(response.fileUrl); // Retorna o link do Storage
          } else {
            reject(
              new Error(
                response.message || "Erro desconhecido na Cloud Function."
              )
            );
          }
        })
        .catch((error) => {
          console.error("Fetch Error:", error);
          reject(
            new Error(
              `Falha na comunicação com o servidor de upload. Detalhes: ${error.message}`
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
 * Função para carregar as vagas ativas e popular o campo Select.
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
 * Consulta a API ViaCEP e preenche os campos de endereço.
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
      "Falha na comunicação com a API de CEP. Por favor, preencha o endereço manualmente.",
      true
    );
  }
}

/**
 * Lida com a submissão do formulário de candidatura.
 * Fluxo migrado para Cloud Function HTTP (upload e salvamento de dados unificados).
 */
async function handleCandidatura(e) {
  e.preventDefault();

  btnSubmit.disabled = true;
  msgFeedback.innerHTML =
    '<div class="loading-spinner">Enviando candidatura e currículo...</div>'; // 1. Coleta de Dados

  const vagaSelectOption = selectVaga.options[selectVaga.selectedIndex];
  const vagaId = selectVaga.value;
  const tituloVagaOriginal = vagaSelectOption.getAttribute("data-titulo");

  const nome = document.getElementById("nome-candidato").value.trim();
  const email = document.getElementById("email-candidato").value.trim();
  const telefone = document.getElementById("telefone-candidato").value.trim(); // Campos de Localização

  const cep = cepCandidato.value.trim();
  const numero = document.getElementById("numero-endereco").value.trim();
  const cidade = cidadeEndereco.value.trim();
  const estado = estadoEndereco.value.trim(); // Campos de Experiência

  const resumoExperiencia = document
    .getElementById("resumo-experiencia")
    .value.trim();
  const habilidades = document
    .getElementById("habilidades-competencias")
    .value.trim();
  const comoConheceu = document.getElementById("como-conheceu").value;

  const arquivoCurriculo = document.getElementById("anexo-curriculo").files[0]; // 2. Validação básica

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
      "Por favor, preencha todos os campos obrigatórios e anexe o currículo.",
      true
    );
    return;
  } // Validação de tamanho do arquivo (máximo 5MB)

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
    // 4. PREPARAÇÃO DO OBJETO DE CANDIDATURA PARA O BACKEND (Cloud Function)
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
      como_conheceu: comoConheceu, // Adiciona um timestamp para o backend

      timestamp: new Date().toISOString(),
    }; // 3. UPLOAD DO ARQUIVO + SALVAR METADADOS (em uma única chamada à Cloud Function)

    await uploadCurriculoToCloudFunction(
      arquivoCurriculo,
      tituloVagaOriginal,
      nome,
      novaCandidatura // Passamos os metadados para a função
    ); // 5. AÇÃO DE SUCESSO

    exibirFeedback(
      "mensagem-sucesso",
      `Candidatura enviada com sucesso para a vaga de ${tituloVagaOriginal}! Em breve, nosso RH entrará em contato.`,
      false
    );
    formCandidatura.reset();
    enderecoRua.value = "";
    cidadeEndereco.value = "";
    estadoEndereco.value = "";
  } catch (error) {
    console.error("Erro completo na candidatura:", error);
    exibirFeedback(
      "mensagem-erro",
      `Erro ao enviar a candidatura. Detalhes: ${error.message}. Verifique o log do navegador (F12) e os logs da Cloud Function.`,
      true
    );
  }
}

/**
 * Exibe a mensagem de feedback para o usuário.
 */
function exibirFeedback(classe, mensagem, reHabilitar) {
  msgFeedback.innerHTML = `<div class="${classe}">${mensagem}</div>`;
  if (reHabilitar) {
    btnSubmit.disabled = false;
  } else {
    // Se foi sucesso, mantém desabilitado e limpa após um tempo
    if (classe === "mensagem-sucesso") {
      setTimeout(() => {
        msgFeedback.innerHTML = "";
        carregarVagasAtivas(); // Recarrega as vagas para um novo envio
      }, 5000);
    } else if (!classe) {
      // Se for apenas para limpar status (ex: CEP ok), não reabilita
      msgFeedback.innerHTML = "";
    }
  }
}

// Adiciona listener para consulta de CEP
cepCandidato.addEventListener("blur", buscarCEP);

// Inicializa o módulo
document.addEventListener("DOMContentLoaded", carregarVagasAtivas);
formCandidatura.addEventListener("submit", handleCandidatura);
