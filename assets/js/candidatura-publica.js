// assets/js/candidatura-publica.js

// Importa as funções necessárias do Firebase SDK (caminho ajustado para o contexto de assets)
import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "./firebase-init.js";

/**
 * Simula a função de upload para o Google Drive.
 * Em um ambiente real, esta função faria um fetch(POST) para uma Cloud Function/API.
 */
async function uploadFileToDrive(file, vagaId, nomeCandidato) {
  // --- LÓGICA DE SIMULAÇÃO (DEVE SER SUBSTITUÍDA POR UMA CHAMADA REAL DE BACKEND) ---
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (file.size > 0) {
        const simulatedLink = `https://drive.google.com/open?id=DRIVE_ID_SIMULADO_${vagaId}_${nomeCandidato.replace(
          /\s/g,
          "_"
        )}`;
        console.log(
          `[SIMULAÇÃO] Arquivo enviado para o Drive. Link: ${simulatedLink}`
        );
        resolve(simulatedLink);
      } else {
        reject(
          new Error("Erro simulado: Arquivo vazio. O upload real falharia.")
        );
      }
    }, 1500); // Simula o tempo de latência de upload
  });
}

const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATURAS_COLLECTION_NAME = "candidaturas";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidaturasCollection = collection(db, CANDIDATURAS_COLLECTION_NAME);

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

/**
 * Função para carregar as vagas ativas e popular o campo Select.
 * CORRIGIDO: Usa o campo de status correto ("status") e o valor correto ("em-divulgacao").
 */
async function carregarVagasAtivas() {
  try {
    // Consulta o Firestore buscando vagas com o status 'em-divulgacao'
    const q = query(vagasCollection, where("status", "==", "em-divulgacao"));
    const snapshot = await getDocs(q);

    selectVaga.innerHTML = '<option value="">Selecione a vaga...</option>'; // Reseta opções

    if (snapshot.empty) {
      // CORREÇÃO UX: Não há vagas, exibe mensagem final e OCULTA o spinner.
      loadingVagas.textContent =
        "Não há vagas abertas para candidatura no momento.";
      loadingVagas.style.display = "block"; // Mantém a mensagem visível
      vagaSelectGroup.style.display = "none";
      btnSubmit.disabled = true;
      return;
    }

    // Vagas carregadas, oculta o spinner e mostra o select
    loadingVagas.style.display = "none";
    vagaSelectGroup.style.display = "block";
    btnSubmit.disabled = false;

    snapshot.forEach((doc) => {
      const vaga = doc.data();
      const option = document.createElement("option");
      option.value = doc.id; // O título da vaga é o campo 'nome'
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
  const cep = cepCandidato.value.replace(/\D/g, ""); // Remove caracteres não numéricos

  if (cep.length !== 8) return; // Bloqueia campos enquanto busca

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

    exibirFeedback("", "", false); // Limpa feedback de erro, se houver
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
 * @param {Event} e
 */
async function handleCandidatura(e) {
  e.preventDefault();

  btnSubmit.disabled = true;
  msgFeedback.innerHTML =
    '<div class="loading-spinner">Enviando candidatura e currículo...</div>'; // 1. Coleta de Dados

  const vagaSelectOption = selectVaga.options[selectVaga.selectedIndex];
  const vagaId = selectVaga.value;
  const tituloVagaOriginal = vagaSelectOption.getAttribute("data-titulo"); // Pega o título salvo

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

  const arquivoCurriculo = document.getElementById("anexo-curriculo").files[0]; // Validação básica

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
    // 2. UPLOAD DO ARQUIVO PARA O GOOGLE DRIVE (Via Backend/Cloud Function - USANDO PLACEHOLDER)
    // O nome do arquivo no Drive usará o nome da vaga e o nome do candidato para organização
    const linkCurriculoDrive = await uploadFileToDrive(
      arquivoCurriculo,
      vagaId,
      nome
    ); // 3. SALVAR OS DADOS NO FIRESTORE (Coleção candidaturas)

    const novaCandidatura = {
      vaga_id: vagaId,
      titulo_vaga_original: tituloVagaOriginal, // Salva o título para referência

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

      link_curriculo_drive: linkCurriculoDrive, // Link do Drive // Novos campos para o fluxo de RH

      status_recrutamento: "Candidatura Recebida (Triagem Pendente)", // Status inicial // ATENÇÃO: Assumo que firebase.firestore.FieldValue.serverTimestamp() está disponível
      data_candidatura: new Date(),
    };

    await addDoc(candidaturasCollection, novaCandidatura);

    exibirFeedback(
      "mensagem-sucesso",
      `Candidatura enviada com sucesso para a vaga de ${tituloVagaOriginal}! Em breve, nosso RH entrará em contato.`,
      false
    );
    formCandidatura.reset(); // Limpar o conteúdo dos campos de endereço, que são readonly após a busca de CEP
    enderecoRua.value = "";
    cidadeEndereco.value = "";
    estadoEndereco.value = "";
  } catch (error) {
    console.error("Erro completo na candidatura:", error);
    exibirFeedback(
      "mensagem-erro",
      `Erro ao enviar a candidatura. Tente novamente. Detalhes: ${error.message}`,
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
