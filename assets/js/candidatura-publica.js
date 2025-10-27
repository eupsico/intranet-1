// assets/js/candidatura-publica.js

// Importa as funções necessárias do Firebase SDK (caminho ajustado para o contexto de assets)
import {
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  ref,
  uploadBytes,
  getDownloadURL,
} from "./firebase-init.js";

const vagasCollection = collection(db, "vagas");
const candidatosCollection = collection(db, "candidatos");
const formCandidatura = document.getElementById("form-candidatura");
const selectVaga = document.getElementById("select-vaga");
const btnSubmit = document.getElementById("btn-submit");
const msgFeedback = document.getElementById("mensagem-feedback");
const vagaSelectGroup = document.getElementById("vaga-select-group");
const loadingVagas = document.getElementById("loading-vagas");

/**
 * Função para carregar as vagas ativas e popular o campo Select.
 */
async function carregarVagasAtivas() {
  try {
    // Busca apenas as vagas que estão na fase de 'em-divulgacao'
    const q = query(vagasCollection, where("status", "==", "em-divulgacao"));
    const snapshot = await getDocs(q);

    selectVaga.innerHTML = '<option value="">Selecione a vaga...</option>'; // Reseta opções

    if (snapshot.empty) {
      loadingVagas.textContent =
        "Não há vagas abertas para candidatura no momento.";
      btnSubmit.disabled = true;
      return;
    }

    snapshot.forEach((doc) => {
      const vaga = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = vaga.nome;
      selectVaga.appendChild(option);
    });

    // Vagas carregadas, mostra o campo e habilita o botão de envio
    loadingVagas.style.display = "none";
    vagaSelectGroup.style.display = "block";
    btnSubmit.disabled = false;
  } catch (error) {
    console.error("Erro ao carregar vagas:", error);
    loadingVagas.textContent =
      "Erro ao carregar as vagas. Tente novamente mais tarde.";
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
    '<div class="loading-spinner">Enviando candidatura...</div>';

  const vagaId = selectVaga.value;
  const nome = document.getElementById("nome-candidato").value;
  const email = document.getElementById("email-candidato").value;
  const telefone = document.getElementById("telefone-candidato").value;
  const arquivoCurriculo = document.getElementById("anexo-curriculo").files[0];

  if (!vagaId || !nome || !email || !telefone || !arquivoCurriculo) {
    exibirFeedback(
      "mensagem-erro",
      "Por favor, preencha todos os campos e anexe o currículo.",
      true
    );
    return;
  }

  // Validação de tamanho do arquivo (máximo 5MB)
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
    // 1. UPLOAD DO ARQUIVO PARA O FIREBASE STORAGE
    const filePath = `curriculos/${vagaId}/${nome.replace(
      /\s/g,
      "_"
    )}_${Date.now()}_${arquivoCurriculo.name}`;
    const storageRef = ref(storage, filePath);

    // Use uploadBytes para fazer o upload do blob (arquivo)
    const snapshot = await uploadBytes(storageRef, arquivoCurriculo);
    const curriculumURL = await getDownloadURL(snapshot.ref);

    // 2. SALVAR OS DADOS NO FIRESTORE
    const novaCandidatura = {
      vagaId: vagaId,
      nomeCandidato: nome,
      email: email,
      telefone: telefone,
      curriculumURL: curriculumURL,
      status: "Entrada - Currículo Recebido", // Primeira fase do funil
      dataCandidatura: new Date(),
    };

    await addDoc(candidatosCollection, novaCandidatura);

    // 3. ATUALIZAR CONTADOR DE CANDIDATOS NA VAGA (Opcional, mas útil)
    // Isso deve ser idealmente feito por uma Cloud Function para garantir atomicidade,
    // mas aqui fazemos de forma simples para o protótipo:
    // TODO: Implementar Cloud Function ou transação.

    exibirFeedback(
      "mensagem-sucesso",
      `Candidatura enviada com sucesso para a vaga! Em breve entraremos em contato.`,
      false
    );
    formCandidatura.reset();
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
 * @param {string} classe Classe CSS para estilização (sucesso/erro).
 * @param {string} mensagem Texto da mensagem.
 * @param {boolean} reHabilitar Define se o botão deve ser reabilitado após o erro.
 */
function exibirFeedback(classe, mensagem, reHabilitar) {
  msgFeedback.innerHTML = `<div class="${classe}">${mensagem}</div>`;
  if (reHabilitar) {
    btnSubmit.disabled = false;
  } else {
    // Se foi sucesso, mantém desabilitado e limpa após um tempo
    setTimeout(() => {
      msgFeedback.innerHTML = "";
      carregarVagasAtivas(); // Recarrega as vagas para um novo envio
    }, 5000);
  }
}

// Inicializa o módulo
document.addEventListener("DOMContentLoaded", carregarVagasAtivas);
formCandidatura.addEventListener("submit", handleCandidatura);
