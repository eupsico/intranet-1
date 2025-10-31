// Versão: 1.10 - Implementação de Logs Robustos no Frontend.

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

// URL REAL do Google Apps Script para processar o upload do currículo.
// **ATUALIZE ESTA URL com a de EXECUÇÃO obtida após o RE-DEPLOY com 'Anyone'.**
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycby6TK_5vteV6RPdjvhuCp8bl1V1Vz_Q_Vg1cLBLPyJffkQ7EevTBiGQhvfx97IUeQJKFQ/exec";

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
const salvarCandidaturaCallable = httpsCallable(functions, "salvarCandidatura");

/**
 * Função que lê o arquivo binário e o envia como Base64 para o Apps Script.
 * @param {File} file Arquivo do currículo.
 * @param {string} vagaTitulo Título da vaga.
 * @param {string} nomeCandidato Nome do candidato.
 * @returns {Promise<string>} Promessa que resolve com o link (URL) do arquivo no Drive.
 */
function uploadCurriculoToAppsScript(file, vagaTitulo, nomeCandidato) {
  return new Promise((resolve, reject) => {
    if (!file) {
        console.error("LOG-CLIENTE: NENHUM ARQUIVO ANEXADO.");
        return reject(new Error("Nenhum arquivo anexado."));
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      // O Google Apps Script pode não conseguir processar strings Base64 muito grandes.
      // Assumimos que o tamanho do arquivo é < 5MB, mas a string Base64 é ~33% maior.
      const fileData = e.target.result.split(",")[1];

      const payload = {
        // Reduzindo o Base64 para log, pois é muito grande
        fileData: `[Base64 Data, Length: ${fileData.length}]`, 
        mimeType: file.type,
        fileName: file.name,
        nomeCandidato: nomeCandidato,
        vagaTitulo: vagaTitulo,
      };

      console.log("LOG-CLIENTE: Payload de envio (Sem Base64):", payload);
      console.log("LOG-CLIENTE: Enviando POST para:", WEB_APP_URL);
      
      // O JSON real com a Base64 completa
      const fullPayload = { ...payload, fileData: e.target.result.split(",")[1] }; 

      fetch(WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8", 
        },
        body: JSON.stringify(fullPayload),
      })
        .then((res) => {
          console.log(`LOG-CLIENTE: Resposta Recebida. Status HTTP: ${res.status} ${res.statusText}`);
          
          // O Google Apps Script sempre retorna 200 OK. O problema é a leitura do corpo.
          // Se o CORS fosse resolvido, esta linha seria executada.
          if (!res.ok) {
            console.error("LOG-CLIENTE: Resposta HTTP de erro do servidor GAS. Status:", res.status);
            throw new Error(
              `Resposta HTTP inválida do Apps Script: ${res.status} ${res.statusText}`
            );
          }
          
          // Tentamos ler o JSON. Se o CORS bloqueou o corpo, isso falhará.
          return res.json()
            .catch(jsonError => {
                console.error("LOG-CLIENTE: Erro ao parsear JSON. Isso pode ser um indicativo de CORS mal resolvido ou resposta HTML/Vazio.", jsonError);
                throw new Error("Falha ao processar resposta do servidor (provavelmente erro de CORS ou resposta vazia).");
            });
        })
        .then((response) => {
          console.log("LOG-CLIENTE: Resposta JSON do Apps Script:", response);
          if (response.status === "success" && response.fileUrl) {
            resolve(response.fileUrl);
          } else {
            console.error("LOG-CLIENTE: Servidor Apps Script retornou status de erro:", response.message);
            reject(
              new Error(
                response.message || "Erro desconhecido no servidor Apps Script."
              )
            );
          }
        })
        .catch((error) => {
          // ESTE É O BLOCO DE ERRO DE REDE/CORS (TypeError: Failed to fetch)
          console.error("LOG-CLIENTE: 💥 FETCH/REDE FALHOU COMPLETAMENTE. DETALHES:", error);
          reject(
            new Error(
              `Falha na comunicação com o servidor de upload. Detalhes: ${error.message}`
            )
          );
        });
    };

    reader.onerror = function (error) {
      console.error("LOG-CLIENTE: Erro ao ler o arquivo no leitor:", error);
      reject(new Error("Erro ao ler o arquivo: " + error.message));
    };

    reader.readAsDataURL(file);
  });
}
/**
 * Função que envia os dados da candidatura para o Firebase.
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
 * Função principal que lida com o envio do formulário.
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

  // Validação
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
    // Etapa 1: Upload do currículo (AQUI CAI O ERRO DE CORS)
    const linkCurriculoDrive = await uploadCurriculoToAppsScript(
      arquivoCurriculo,
      tituloVagaOriginal,
      nome
    );

    // Etapa 2: Envio da candidatura (SÓ RODA SE A ETAPA 1 FOR SUCESSO)
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