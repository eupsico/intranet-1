// ====================================================================
// assets/js/candidatura-publica.js - FIREBASE STORAGE VERSION
// ====================================================================

import {
  db,
  collection,
  getDocs,
  query,
  where,
  functions,
  httpsCallable,
} from "./firebase-init.js";

// ✅ NOVA URL - CLOUD FUNCTION DO FIREBASE
const CLOUD_FUNCTION_URL =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/uploadCurriculo";

const VAGAS_COLLECTION_NAME = "vagas";
const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// Elementos do DOM
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

// ====================================================================
// FUNÇÃO: Upload Currículo para Firebase Storage
// ====================================================================
function uploadCurriculoToCloudFunction(file, vagaTitulo, nomeCandidato) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo anexado."));

    const reader = new FileReader();
    reader.onload = function (e) {
      const fileData = e.target.result.split(",")[1];

      const payload = {
        fileData: fileData,
        mimeType: file.type,
        fileName: file.name,
        nomeCandidato: nomeCandidato,
        vagaTitulo: vagaTitulo,
      };

      console.log(`🔵 Enviando para Firebase Cloud Function`);
      console.log(
        `📄 Arquivo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
      );

      fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          console.log(`✅ Status HTTP: ${res.status}`);

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          return res.json();
        })
        .then((response) => {
          console.log("📦 Resposta da Cloud Function:", response);

          if (response.status === "success" && response.fileUrl) {
            console.log(
              "✅ Currículo salvo no Firebase Storage:",
              response.fileUrl
            );
            resolve(response.fileUrl);
          } else {
            reject(
              new Error(
                response.message || "Erro desconhecido na Cloud Function."
              )
            );
          }
        })
        .catch((error) => {
          console.error("💥 ERRO NO FETCH:", error);
          reject(
            new Error(
              `Falha na comunicação com o servidor. Detalhes: ${error.message}`
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

// ====================================================================
// FUNÇÃO: Salvar Candidatura no Firebase
// ====================================================================
async function enviarCandidaturaParaFirebase(dadosCandidatura) {
  try {
    const result = await salvarCandidaturaCallable(dadosCandidatura);
    if (result.data && result.data.success) {
      // ✅ CAMPO RENOMEADO: nome_completo → nome_candidato
      mostrarSucessoCandidatura(dadosCandidatura.nome_candidato);
    } else {
      throw new Error(
        result.data.message || "Erro desconhecido ao processar candidatura."
      );
    }
  } catch (error) {
    console.error("Erro ao salvar candidatura no Firebase:", error);
    // ATUALIZADO: Usando classes do Design System
    exibirFeedback(
      "alert alert-error",
      `Erro ao salvar candidatura. Detalhes: ${error.message}`,
      true
    );
  }
}
// ====================================================================
// FUNÇÃO: Carregar Vagas Ativas
// ====================================================================
async function carregarVagasAtivas() {
  try {
    const q = query(vagasCollection, where("status", "==", "em-divulgacao"));
    const snapshot = await getDocs(q);

    selectVaga.innerHTML = '<option value="">Selecione a vaga...</option>';

    if (snapshot.empty) {
      loadingVagas.textContent =
        "Não há vagas abertas para candidatura no momento.";
      // ATUALIZADO: Usando classes do Design System (hidden)
      loadingVagas.classList.remove("hidden");
      vagaSelectGroup.classList.add("hidden");
      btnSubmit.disabled = true;
      return;
    }

    // ATUALIZADO: Usando classes do Design System (hidden)
    loadingVagas.classList.add("hidden");
    vagaSelectGroup.classList.remove("hidden");
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
    // ATUALIZADO: Usando classes do Design System (hidden)
    vagaSelectGroup.classList.add("hidden");
  }
}

// ====================================================================
// FUNÇÃO: Buscar CEP
// ====================================================================
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
      // ATUALIZADO: Usando classes do Design System
      exibirFeedback(
        "alert alert-error",
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
    // ATUALIZADO: Usando classes do Design System
    exibirFeedback(
      "alert alert-error",
      "Falha na comunicação com a API de CEP. Preencha manualmente.",
      true
    );
  }
}

// ====================================================================
// FUNÇÃO: Handler Principal do Formulário - ATUALIZADO
// ====================================================================
async function handleCandidatura(e) {
  e.preventDefault();
  btnSubmit.disabled = true;
  // NOTA: A classe 'loading-spinner' já existe no design-system.css
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
  const rua = enderecoRua.value.trim();
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

  // Validação de campos obrigatórios
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
    // ATUALIZADO: Usando classes do Design System
    exibirFeedback(
      "alert alert-error",
      "Preencha todos os campos obrigatórios e anexe o currículo.",
      true
    );
    return;
  }

  // Validação de tamanho de arquivo
  const maxFileSize = 5 * 1024 * 1024;
  if (arquivoCurriculo.size > maxFileSize) {
    // ATUALIZADO: Usando classes do Design System
    exibirFeedback(
      "alert alert-error",
      "O arquivo do currículo não pode exceder 5MB.",
      true
    );
    return;
  }

  try {
    console.log("🚀 Iniciando upload do currículo...");
    const linkCurriculoDrive = await uploadCurriculoToCloudFunction(
      arquivoCurriculo,
      tituloVagaOriginal,
      nome
    );
    console.log("✅ Currículo enviado com sucesso! URL:", linkCurriculoDrive);

    // Coleta todos os dados do formulário para enviar
    const dadosFormulario = {
      data_nasc_candidato: document.getElementById("data-nascimento").value,
      genero_candidato: document.getElementById("genero").value,
      escolaridade_candidato: document.getElementById("escolaridade").value,
      area_formacao_candidato: document.getElementById("area-formacao").value,
      especializacoes_candidato:
        document.getElementById("especializacoes").value,
      disponibilidade_inicio_candidato: document.getElementById(
        "disponibilidade-inicio"
      ).value,
      experiencia_candidato: document.getElementById("experiencia-area").value,
      linkedin_url_candidato: document.getElementById("linkedin-url").value,
      portfolio_url_candidato: document.getElementById("portfolio-url").value,
      motivacao_candidato: document.getElementById("motivacao").value,
      pcd_candidato: document.getElementById("pcd").value,
    };

    const novaCandidatura = {
      vaga_id: vagaId,
      titulo_vaga_original: tituloVagaOriginal,
      nome_candidato: nome,
      email_candidato: email,
      telefone_contato: telefone,
      cep_candidato: cep,
      endereco_num_candidato: numero,
      endereco_rua_candidato: rua,
      cidade_candidato: cidade,
      estado_candidato: estado,
      resumo_experiencia: resumoExperiencia,
      habilidades_competencias: habilidades,
      como_conheceu: comoConheceu,
      link_curriculo_drive: linkCurriculoDrive,
      ...dadosFormulario, // Adiciona todos os outros campos
      status_candidato: "recebido", // Status inicial
      data_candidatura: new Date().toISOString(), // Data de envio
    };

    console.log("🔥 Salvando candidatura no Firebase...");
    await enviarCandidaturaParaFirebase(novaCandidatura);
  } catch (error) {
    console.error("❌ Erro completo na candidatura:", error);
    // ATUALIZADO: Usando classes do Design System
    exibirFeedback(
      "alert alert-error",
      `Erro ao enviar a candidatura. Detalhes: ${error.message}`,
      true
    );
  }
}

// ====================================================================
// FUNÇÃO: Mostrar Tela de Sucesso
// ====================================================================
function mostrarSucessoCandidatura(nomeCandidato) {
  // ATUALIZADO: O 'form-body' agora é '.modal-body'
  const formBody = document.querySelector(".modal-body");
  if (!formBody) {
    console.error("Container .modal-body não encontrado.");
    return;
  }

  // ATUALIZADO: Layout vertical e mensagem melhorada.
  // 'flex-direction: column' é essencial aqui pois a classe .alert do CSS original possui display:flex padrão.
  formBody.innerHTML = `
    <div class="alert alert-success" style="flex-direction: column; text-align: center; padding: 40px 20px; gap: 20px; justify-content: center;">
               
        <h3 style="color: #155724; margin: 0; font-size: 1.4rem;">Candidatura Recebida!</h3>
        
        <div style="font-size: 1rem; color: #155724; line-height: 1.6;">
            <p style="margin-bottom: 15px;">Olá, <strong>${
              nomeCandidato || "Candidato(a)"
            }</strong>.</p>
            <p style="margin-bottom: 10px;">Confirmamos o recebimento dos seus dados e currículo.</p>
            <p>Nossa equipe de Talentos fará a análise do seu perfil. Caso suas qualificações estejam alinhadas aos requisitos da vaga, entraremos em contato para os próximos passos.</p>
        </div>
        
        <p style="margin-top: 15px; font-weight: 600; font-size: 0.95rem; color: #155724;">
            Atenciosamente,<br>Equipe EuPsico
        </p>
    </div>
    `;
}

// ====================================================================
// FUNÇÃO: Exibir Feedback (Simplificada)
// ====================================================================
function exibirFeedback(classe, mensagem, reHabilitar) {
  // NOTA: 'classe' agora espera 'alert alert-error'
  msgFeedback.innerHTML = `<div class="${classe}">${mensagem}</div>`;
  if (reHabilitar) {
    btnSubmit.disabled = false;
  } else if (!classe) {
    // Limpa mensagens que não sejam de erro ou re-habilitação
    msgFeedback.innerHTML = "";
  }
}

// ====================================================================
// EVENT LISTENERS
// ====================================================================
cepCandidato.addEventListener("blur", buscarCEP);
document.addEventListener("DOMContentLoaded", carregarVagasAtivas);
formCandidatura.addEventListener("submit", handleCandidatura);
