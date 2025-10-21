// Arquivo: modulos/voluntario/js/alterar-grade.js
// VERSÃO 10: Corrige a lógica de renderização dos checkboxes (o HTML não estava sendo salvo)

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

// Constantes originais mantidas
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
// --- FIM DAS CONSTANTES ---

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
    "[Alterar Grade] Módulo iniciado (V10 - Correção Render Checkbox)."
  );
  currentUser = user;
  currentUserData = userData;

  // --- INÍCIO DA CORREÇÃO: O seletor deve ser o ID da aba de conteúdo ---
  // O arquivo recursos.js já carrega o HTML dentro da aba correta.
  // O container da view é a própria aba.
  const viewContainer = document.querySelector("#alterar-grade");
  // --- FIM DA CORREÇÃO ---

  if (!viewContainer) {
    console.error("[Alterar Grade] Container #alterar-grade não encontrado.");
    return;
  }

  // O HTML já foi carregado pelo 'recursos.js', então não precisamos fazer fetch
  // Apenas mapeamos os elementos
  try {
    setupDOMElements();
    populateInitialData();
    await loadAndRenderGrades(); // Lógica V10 (correta)
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
 * Carrega e renderiza os checkboxes da grade do usuário (Lógica V10)
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

  const userUsername = currentUserData.username;
  const userFullName = currentUserData.nome;

  // --- INÍCIO DA CORREÇÃO V10 ---
  // As listas devem ser declaradas AQUI, antes do loop
  const horariosOnline = [];
  const horariosPresencial = [];
  // --- FIM DA CORREÇÃO V10 ---

  // Itera pela grade central
  for (const path in dadosDasGrades) {
    const nomeNaGrade = dadosDasGrades[path];

    // Compara pelo username OU pelo nome completo
    if (nomeNaGrade === userUsername || nomeNaGrade === userFullName) {
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

        // --- INÍCIO DA CORREÇÃO V10 ---
        // Adiciona o HTML à lista correta e incrementa o contador
        if (tipo === "online") {
          horariosOnline.push(checkboxHtml);
          totalHorariosAtual++;
        } else if (tipo === "presencial") {
          horariosPresencial.push(checkboxHtml);
          totalHorariosAtual++;
        }
        // --- FIM DA CORREÇÃO V10 ---
      }
    }
  }

  // A lógica de renderização final (fora do loop) agora funciona
  // porque as variáveis horariosOnline e horariosPresencial contêm o HTML.
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
  // (Necessário se o init for chamado múltiplas vezes sem recarregar a página)
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  form = newForm; // Atualiza a referência global do formulário

  // Atualiza referências dos elementos internos do formulário
  motivoTextarea = document.getElementById("motivo-exclusao");
  submitButton = document.getElementById("btn-enviar-solicitacao");

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
    avisoMinimo.classList.toggle("alert-warning", isMinimoOk); // Amarelo se OK
    avisoMinimo.classList.toggle("alert-error", !isMinimoOk); // Vermelho se Erro
    avisoMinimo.innerHTML = `Você deve manter no mínimo 5 horários. 
            (Atual: ${totalHorariosAtual} | Selecionados: ${selectedCheckboxes.length} | Restantes: ${horariosRestantes})`;
  } else {
    avisoMinimo.style.display = "block";
    avisoMinimo.className = "alert alert-info"; // Azul (informativo)
    avisoMinimo.innerHTML = `Você possui ${totalHorariosAtual} horários. Lembre-se que o mínimo recomendado é 5.`;
    isMinimoOk = true;
  }

  // Feedback visual para o motivo
  if (motivo.length === 0 && selectedCheckboxes.length > 0) {
    motivoTextarea.classList.add("is-invalid"); // (Adicione CSS para .is-invalid se necessário)
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
    submitButton.innerHTML = `Enviar Solicitação`;
  } catch (error) {
    console.error("[Alterar Grade] Erro ao salvar solicitação:", error);
    feedbackMessage.className = "alert alert-error";
    feedbackMessage.innerHTML =
      "Erro ao enviar sua solicitação. Tente novamente.";
    feedbackMessage.style.display = "block";

    submitButton.disabled = false;
    submitButton.innerHTML = `Enviar Solicitação`;
  }
}
