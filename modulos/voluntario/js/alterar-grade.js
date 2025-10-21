// Arquivo: modulos/voluntario/js/alterar-grade.js
// VERSÃO 8: Restaura a lógica de busca correta (V5) e as constantes (V7).

import {
  db,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

// --- Constantes Globais ---
let dadosDasGrades = {};

// Mapa para traduzir os dias (usado pela nova lógica)
const DIAS_SEMANA_NOMES = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
};

// --- INFORMAÇÕES IMPORTANTES REINSERIDAS (do V7) ---
const DIAS_SEMANA = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const HORAS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];
// --- FIM DAS INFORMAÇÕES REINSERIDAS ---

let currentUser;
let currentUserData;
let totalHorariosAtual = 0;
let form,
  nomeInput,
  totalInput,
  gradesContainer,
  motivoTextarea,
  submitButton,
  feedbackMessage,
  avisoMinimo;

/**
 * Função principal de inicialização do módulo
 */
export async function init(user, userData) {
  console.log(
    "[Alterar Grade] Módulo iniciado (V8 - Lógica de busca corrigida)."
  );
  currentUser = user;
  currentUserData = userData;

  const viewContainer = document.querySelector("#alterar-grade");
  if (!viewContainer) {
    console.error("[Alterar Grade] Container #alterar-grade não encontrado.");
    return;
  }

  // Se o HTML ainda não foi carregado
  if (!viewContainer.querySelector("form")) {
    try {
      const response = await fetch("../page/alterar-grade.html");
      if (!response.ok) {
        throw new Error(`Falha ao carregar o HTML: ${response.statusText}`);
      }
      viewContainer.innerHTML = await response.text();
    } catch (error) {
      console.error("[Alterar Grade] Erro ao carregar HTML:", error);
      viewContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar o módulo. Tente recarregar a página.</p>`;
      return;
    }
  }

  // Sempre reconfigura os elementos DOM e recarrega os dados
  try {
    setupDOMElements();
    populateInitialData();
    await loadAndRenderGrades(); // Lógica V8 (correta)
    setupEventListeners();
  } catch (error) {
    console.error("[Alterar Grade] Erro ao inicializar dados:", error);
    viewContainer.innerHTML = `<p class="alert alert-error">Erro ao inicializar os dados. Tente recarregar a página.</p>`;
  }
}

/**
 * Mapeia os elementos do DOM
 */
function setupDOMElements() {
  form = document.getElementById("form-exclusao-grade");
  nomeInput = document.getElementById("nome-profissional");
  totalInput = document.getElementById("total-horarios-atual");
  gradesContainer = document.getElementById("grades-para-exclusao");
  motivoTextarea = document.getElementById("motivo-exclusao");
  submitButton = document.getElementById("btn-enviar-solicitacao");
  feedbackMessage = document.getElementById("solicitacao-feedback");
  avisoMinimo = document.getElementById("aviso-minimo-horarios");
}

/**
 * Preenche os dados iniciais do formulário (nome)
 */
function populateInitialData() {
  // O campo correto é 'nome'
  if (currentUserData && currentUserData.nome) {
    nomeInput.value = currentUserData.nome;
  } else {
    nomeInput.value = "Nome não encontrado";
  }
}

/**
 * Busca os dados da grade central do 'administrativo/grades'
 */
async function loadGradeDataFromAdmin() {
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDasGrades = gradeSnap.data();
    } else {
      console.warn(
        "[Alterar Grade] Documento 'administrativo/grades' não encontrado."
      );
      dadosDasGrades = {};
    }
  } catch (error) {
    console.error("[Alterar Grade] Erro ao carregar dados da grade:", error);
    gradesContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar os dados da grade. Tente novamente.</p>`;
  }
}

/**
 * Carrega e renderiza os checkboxes da grade do usuário (Lógica V8 / V5)
 */
async function loadAndRenderGrades() {
  gradesContainer.innerHTML = `<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>`;
  await loadGradeDataFromAdmin(); // Carrega os dados da grade central
  totalHorariosAtual = 0;
  gradesContainer.innerHTML = ""; // Limpa o spinner

  if (
    !currentUserData ||
    (!currentUserData.username && !currentUserData.nome)
  ) {
    console.error(
      "[Alterar Grade] Não foi possível identificar o 'username' ou 'nome' do usuário."
    );
    return;
  }

  // --- INÍCIO DA CORREÇÃO V8 (LÓGICA DO V5 / DASHBOARD) ---
  // A grade usa tanto o username quanto o nome completo.
  const userUsername = currentUserData.username;
  const userFullName = currentUserData.nome;
  // --- FIM DA CORREÇÃO V8 ---

  const horariosOnline = [];
  const horariosPresencial = [];

  // Itera pela grade central
  for (const path in dadosDasGrades) {
    const nomeNaGrade = dadosDasGrades[path];

    // --- INÍCIO DA CORREÇÃO V8 (LÓGICA DO V5 / DASHBOARD) ---
    // Compara pelo username OU pelo nome completo
    if (nomeNaGrade === userUsername || nomeNaGrade === userFullName) {
      // --- FIM DA CORREÇÃO V8 ---
      const parts = path.split(".");
      if (parts.length === 4) {
        const [tipo, diaKey, horaRaw, colKey] = parts;
        const horaFormatada = horaRaw.replace("-", ":");
        const diaNome = DIAS_SEMANA_NOMES[diaKey] || diaKey;
        const label = `${diaNome}, ${horaFormatada}`;

        // Cria o HTML do checkbox
        const checkboxHtml = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="horario_excluir" value="${path}" id="chk_${path}" data-label="${label}">
                        <label class="form-check-label" for="chk_${path}">
                            ${label}
                        </label>
                    </div>
                `;

        if (tipo === "online") {
          horariosOnline.push(checkboxHtml);
        } else if (tipo === "presencial") {
          horariosPresencial.push(checkboxHtml);
        }
        totalHorariosAtual++;
      }
    }
  }

  let finalHtml = "";
  if (horariosOnline.length > 0) {
    finalHtml += `<div class="grade-section">
                        <h3>Grade Online</h3>
                        <div class="grade-checkbox-list">${horariosOnline.join(
                          ""
                        )}</div>
                      </div>`;
  }
  if (horariosPresencial.length > 0) {
    finalHtml += `<div class="grade-section">
                        <h3>Grade Presencial</h3>
                        <div class="grade-checkbox-list">${horariosPresencial.join(
                          ""
                        )}</div>
                      </div>`;
  }

  if (totalHorariosAtual === 0) {
    gradesContainer.innerHTML = `<p class="alert">Você não possui horários cadastrados na grade.</p>`;
    motivoTextarea.disabled = true;
    submitButton.disabled = true;
    avisoMinimo.style.display = "none";
  } else {
    gradesContainer.innerHTML = finalHtml;
    motivoTextarea.disabled = false;
  }

  totalInput.value = totalHorariosAtual;
  validateForm(); // Valida o formulário após renderizar
}

/**
 * Adiciona os listeners de evento ao formulário
 */
function setupEventListeners() {
  if (!form) return;

  // Remove listeners antigos para evitar duplicação
  form.removeEventListener("change", validateForm);
  motivoTextarea.removeEventListener("input", validateForm);
  form.removeEventListener("submit", handleFormSubmit);

  // Adiciona novos listeners
  form.addEventListener("change", validateForm);
  motivoTextarea.addEventListener("input", validateForm);
  form.addEventListener("submit", handleFormSubmit);
}

/**
 * Valida o formulário e atualiza o estado do botão e avisos
 */
function validateForm() {
  if (!form) return;

  const selectedCheckboxes = form.querySelectorAll(
    'input[name="horario_excluir"]:checked'
  );
  const motivo = motivoTextarea.value.trim();
  const horariosRestantes = totalHorariosAtual - selectedCheckboxes.length;

  let isMotivoOk = motivo.length > 0;
  let isHorarioOk = selectedCheckboxes.length > 0;
  let isMinimoOk = true;

  if (totalHorariosAtual > 5) {
    isMinimoOk = horariosRestantes >= 5;
    avisoMinimo.style.display = "block";
    avisoMinimo.classList.toggle("alert-warning", isMinimoOk);
    avisoMinimo.classList.toggle("alert-error", !isMinimoOk);
    avisoMinimo.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
            Você deve manter no mínimo 5 horários. 
            (Atual: ${totalHorariosAtual} | Selecionados: ${selectedCheckboxes.length} | Restantes: ${horariosRestantes})`;
  } else {
    avisoMinimo.style.display = "block";
    avisoMinimo.className = "alert alert-info";
    avisoMinimo.innerHTML = `<i class="fas fa-info-circle"></i> Você possui ${totalHorariosAtual} horários. Lembre-se que o mínimo recomendado é 5.`;
    isMinimoOk = true;
  }

  // Feedback visual para o motivo
  if (motivo.length > 0 && !isMotivoOk) {
    motivoTextarea.classList.add("is-invalid");
  } else {
    motivoTextarea.classList.remove("is-invalid");
  }

  const isValid = isMotivoOk && isHorarioOk && isMinimoOk;
  submitButton.disabled = !isValid;
}

/**
 * Manipula o envio do formulário de exclusão (Cria a solicitação)
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  if (submitButton.disabled) return;

  submitButton.disabled = true;
  submitButton.innerHTML = `<span class="loading-spinner-small"></span> Enviando...`;
  feedbackMessage.style.display = "none";

  const selectedCheckboxes = form.querySelectorAll(
    'input[name="horario_excluir"]:checked'
  );
  const horariosParaExcluir = [];
  selectedCheckboxes.forEach((cb) => {
    horariosParaExcluir.push({
      path: cb.value,
      label: cb.dataset.label,
    });
  });

  const motivo = motivoTextarea.value.trim();

  // O campo correto é 'nome'
  const solicitacaoData = {
    solicitanteId: currentUser.uid,
    solicitanteNome: currentUserData.nome || "Nome não encontrado",
    horariosParaExcluir: horariosParaExcluir,
    totalHorariosAtual: totalHorariosAtual,
    motivo: motivo,
    status: "Pendente",
    dataSolicitacao: serverTimestamp(),
  };

  try {
    // ESTA É A FUNÇÃO QUE ABRE O CHAMADO (não altera a grade)
    const docRef = await addDoc(
      collection(db, "solicitacoesExclusaoGrade"),
      solicitacaoData
    );

    console.log("[Alterar Grade] Solicitação enviada com ID:", docRef.id);

    feedbackMessage.className = "alert alert-success";
    feedbackMessage.innerHTML =
      "Sua solicitação foi enviada com sucesso e será analisada pela administração.";
    feedbackMessage.style.display = "block";

    form.reset();
    await loadAndRenderGrades(); // Recarrega a grade
    submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Solicitação`;
  } catch (error) {
    console.error("[Alterar Grade] Erro ao salvar solicitação:", error);
    feedbackMessage.className = "alert alert-error";
    feedbackMessage.innerHTML =
      "Erro ao enviar sua solicitação. Tente novamente.";
    feedbackMessage.style.display = "block";

    submitButton.disabled = false;
    submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Solicitação`;
  }
}
