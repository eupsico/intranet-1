// Arquivo: modulos/voluntario/js/alterar-grade.js
// VERSÃO 12: Bloqueia checkboxes para não permitir menos de 5 horários.

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

// Mapa para traduzir os dias
const DIAS_SEMANA_NOMES = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
};
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
  console.log("[Alterar Grade] Módulo iniciado (V12 - Trava de 5 horários).");
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

  try {
    setupDOMElements();
    populateInitialData();
    await loadAndRenderGrades();
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
 * Carrega e renderiza os checkboxes da grade do usuário
 */
async function loadAndRenderGrades() {
  gradesContainer.innerHTML = `<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>`;
  await loadGradeDataFromAdmin();
  totalHorariosAtual = 0;
  gradesContainer.innerHTML = "";

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

  const horariosOnline = [];
  const horariosPresencial = [];

  for (const path in dadosDasGrades) {
    const nomeNaGrade = dadosDasGrades[path];

    if (nomeNaGrade === userUsername || nomeNaGrade === userFullName) {
      const parts = path.split(".");
      if (parts.length === 4) {
        const [tipo, diaKey, horaRaw, colKey] = parts;
        const horaFormatada = horaRaw.replace("-", ":");
        const diaNome = DIAS_SEMANA_NOMES[diaKey] || diaKey;
        const label = `${diaNome}, ${horaFormatada}`;

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
          totalHorariosAtual++;
        } else if (tipo === "presencial") {
          horariosPresencial.push(checkboxHtml);
          totalHorariosAtual++;
        }
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
  validateForm();
}

/**
 * Adiciona os listeners de evento ao formulário
 */
function setupEventListeners() {
  if (!form) return;

  // Limpa listeners antigos (essencial se o init for chamado várias vezes)
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  form = newForm;

  // Remapeia elementos internos do formulário clonado
  motivoTextarea = document.getElementById("motivo-exclusao");
  submitButton = document.getElementById("btn-enviar-solicitacao");
  avisoMinimo = document.getElementById("aviso-minimo-horarios");
  gradesContainer = document.getElementById("grades-para-exclusao");

  // Adiciona novos listeners
  form.addEventListener("change", validateForm); // 'change' pega cliques nos checkboxes
  motivoTextarea.addEventListener("input", validateForm);
  form.addEventListener("submit", handleFormSubmit);
}

/**
 * Valida o formulário, atualiza o botão E BLOQUEIA os checkboxes (Lógica V12)
 */
function validateForm() {
  if (!form) return;

  // 1. Obter todos os elementos necessários
  const allCheckboxes = form.querySelectorAll('input[name="horario_excluir"]');
  const selectedCheckboxes = form.querySelectorAll(
    'input[name="horario_excluir"]:checked'
  );
  const motivo = motivoTextarea.value.trim();

  const selecionadosCount = selectedCheckboxes.length;
  const horariosRestantes = totalHorariosAtual - selecionadosCount;

  // 2. Lógica de Validação para o Botão SUBMIT
  let isMotivoOk = motivo.length > 0;
  let isHorarioOk = selecionadosCount > 0;
  let isMinimoOk = true; // Assume que é válido por padrão

  const LIMITE_MINIMO = 5;

  if (totalHorariosAtual > LIMITE_MINIMO) {
    // Se o total é > 5 (ex: 6), o restante DEVE ser >= 5
    isMinimoOk = horariosRestantes >= LIMITE_MINIMO;

    avisoMinimo.style.display = "block";
    avisoMinimo.classList.toggle("alert-warning", isMinimoOk && isHorarioOk); // Amarelo se ok
    avisoMinimo.classList.toggle("alert-error", !isMinimoOk); // Vermelho se inválido
    avisoMinimo.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
            Você deve manter no mínimo ${LIMITE_MINIMO} horários. 
            (Atual: ${totalHorariosAtual} | Selecionados: ${selecionadosCount} | Restantes: ${horariosRestantes})`;
  } else {
    // Se o total é <= 5 (ex: 4), a regra de "mínimo 5" não se aplica para *validar o botão*.
    isMinimoOk = true;
    avisoMinimo.style.display = "block";
    avisoMinimo.className = "alert alert-info";
    avisoMinimo.innerHTML = `<i class="fas fa-info-circle"></i> Você possui ${totalHorariosAtual} horários. Lembre-se que o mínimo recomendado é ${LIMITE_MINIMO}.`;
  }

  // Feedback visual para o motivo
  if (motivo.length === 0 && isHorarioOk) {
    motivoTextarea.classList.add("is-invalid");
  } else {
    motivoTextarea.classList.remove("is-invalid");
  }

  // Validação final do Botão
  const isValid = isMotivoOk && isHorarioOk && isMinimoOk;
  submitButton.disabled = !isValid;

  // 3. Lógica de BLOQUEIO de Checkboxes (V12)
  // Esta lógica é separada da validação do botão submit.

  if (totalHorariosAtual > LIMITE_MINIMO) {
    // Só pode selecionar (total - 5)
    const maxSelecionaveis = totalHorariosAtual - LIMITE_MINIMO; // Ex: 6 - 5 = 1

    if (selecionadosCount >= maxSelecionaveis) {
      // Atingiu o limite (Ex: 1 selecionado)
      // Desabilita todos os NÃO marcados.
      allCheckboxes.forEach((cb) => {
        if (!cb.checked) {
          cb.disabled = true;
          cb.parentElement.classList.add("disabled-check"); // Adiciona classe para feedback visual
        }
      });
    } else {
      // Não atingiu o limite (Ex: 0 selecionados)
      // Habilita TODOS (para o caso de ter desmarcado 1)
      allCheckboxes.forEach((cb) => {
        cb.disabled = false;
        cb.parentElement.classList.remove("disabled-check");
      });
    }
  } else {
    // Se o total é <= 5, a regra de bloqueio não se aplica.
    // Garante que todos estejam habilitados.
    allCheckboxes.forEach((cb) => {
      cb.disabled = false;
      cb.parentElement.classList.remove("disabled-check");
    });
  }
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
