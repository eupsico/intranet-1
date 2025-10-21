// Arquivo: modulos/voluntario/js/alterar-grade.js
// VERSÃO 13: Adiciona modal de sucesso com redirecionamento.

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

// --- INÍCIO DA ALTERAÇÃO V13: Função de Modal ---

/**
 * Exibe um modal de notificação local.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'error'} type - O tipo de modal.
 * @param {function} [onCloseCallback] - Função a ser executada ao fechar.
 */
function showLocalModal(message, type = "success", onCloseCallback) {
  // Remove qualquer modal existente para evitar duplicação
  const existingModal = document.getElementById("local-notification-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "local-notification-modal";
  modalOverlay.className = "modal-overlay is-visible"; // Usa classes do design-system
  modalOverlay.style.display = "flex"; // Garante a visibilidade

  const modalBox = document.createElement("div");
  modalBox.className = "modal-content"; // Usa classes do design-system
  modalBox.style.maxWidth = "450px"; // Define um tamanho razoável

  // Adiciona um ícone baseado no tipo
  const iconHtml =
    type === "success"
      ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
      : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

  const modalBody = document.createElement("div");
  modalBody.className = "modal-body";
  modalBody.style.textAlign = "center";
  modalBody.innerHTML = `
        ${iconHtml}
        <h3 style="margin-top: 0; color: var(--cor-primaria);">${
          type === "success" ? "Sucesso!" : "Erro!"
        }</h3>
        <p style="font-size: 1em; line-height: 1.5;">${message}</p>
    `;

  const modalFooter = document.createElement("div");
  modalFooter.className = "modal-footer";
  modalFooter.style.justifyContent = "center";

  const okButton = document.createElement("button");
  okButton.type = "button";
  okButton.className = "action-button";
  okButton.textContent = "OK";

  modalFooter.appendChild(okButton);
  modalBox.appendChild(modalBody);
  modalBox.appendChild(modalFooter);
  modalOverlay.appendChild(modalBox);

  document.body.appendChild(modalOverlay);

  const closeModal = () => {
    modalOverlay.remove();
    if (typeof onCloseCallback === "function") {
      onCloseCallback();
    }
  };

  okButton.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}
// --- FIM DA ALTERAÇÃO V13 ---

/**
 * Função principal de inicialização do módulo
 */
export async function init(user, userData) {
  console.log("[Alterar Grade] Módulo iniciado (V13 - Modal de Sucesso).");
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
      const response = await fetch("../page/alterar-grade.html"); //
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
  feedbackMessage = document.getElementById("solicitacao-feedback"); //
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
    if (gradesContainer) {
      gradesContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar os dados da grade. Tente novamente.</p>`;
    }
  }
}

/**
 * Carrega e renderiza os checkboxes da grade do usuário
 */
async function loadAndRenderGrades() {
  if (gradesContainer) {
    //
    gradesContainer.innerHTML = `<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>`;
  }
  await loadGradeDataFromAdmin();
  totalHorariosAtual = 0;
  if (gradesContainer) {
    gradesContainer.innerHTML = "";
  }

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
    if (gradesContainer) {
      gradesContainer.innerHTML = `<p class="alert">Você não possui horários cadastrados na grade.</p>`;
    }
    if (motivoTextarea) motivoTextarea.disabled = true;
    if (submitButton) submitButton.disabled = true;
    if (avisoMinimo) avisoMinimo.style.display = "none";
  } else {
    if (gradesContainer) gradesContainer.innerHTML = finalHtml;
    if (motivoTextarea) motivoTextarea.disabled = false;
  }

  if (totalInput) totalInput.value = totalHorariosAtual;
  validateForm();
}

/**
 * Adiciona os listeners de evento ao formulário
 */
function setupEventListeners() {
  if (!form) return;

  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  form = newForm;

  motivoTextarea = document.getElementById("motivo-exclusao");
  submitButton = document.getElementById("btn-enviar-solicitacao");
  avisoMinimo = document.getElementById("aviso-minimo-horarios");
  gradesContainer = document.getElementById("grades-para-exclusao");
  feedbackMessage = document.getElementById("solicitacao-feedback");

  form.addEventListener("change", validateForm);
  if (motivoTextarea) motivoTextarea.addEventListener("input", validateForm);
  form.addEventListener("submit", handleFormSubmit);
}

/**
 * Valida o formulário, atualiza o botão E BLOQUEIA os checkboxes
 */
function validateForm() {
  if (!form || !avisoMinimo || !motivoTextarea) return;

  const allCheckboxes = form.querySelectorAll('input[name="horario_excluir"]');
  const selectedCheckboxes = form.querySelectorAll(
    'input[name="horario_excluir"]:checked'
  );
  const motivo = motivoTextarea.value.trim();

  const selecionadosCount = selectedCheckboxes.length;
  const horariosRestantes = totalHorariosAtual - selecionadosCount;

  let isMotivoOk = motivo.length > 0;
  let isHorarioOk = selecionadosCount > 0;
  let isMinimoOk = true;

  const LIMITE_MINIMO = 5;

  if (totalHorariosAtual > LIMITE_MINIMO) {
    isMinimoOk = horariosRestantes >= LIMITE_MINIMO;
    avisoMinimo.style.display = "block";
    avisoMinimo.classList.toggle("alert-warning", isMinimoOk && isHorarioOk);
    avisoMinimo.classList.toggle("alert-error", !isMinimoOk);
    avisoMinimo.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
            Você deve manter no mínimo ${LIMITE_MINIMO} horários. 
            (Atual: ${totalHorariosAtual} | Selecionados: ${selecionadosCount} | Restantes: ${horariosRestantes})`;
  } else {
    isMinimoOk = true;
    avisoMinimo.style.display = "block";
    avisoMinimo.className = "alert alert-info";
    avisoMinimo.innerHTML = `<i class="fas fa-info-circle"></i> Você possui ${totalHorariosAtual} horários. Lembre-se que o mínimo recomendado é ${LIMITE_MINIMO}.`;
  }

  if (motivo.length === 0 && isHorarioOk) {
    motivoTextarea.classList.add("is-invalid");
  } else {
    motivoTextarea.classList.remove("is-invalid");
  }

  const isValid = isMotivoOk && isHorarioOk && isMinimoOk;
  if (submitButton) submitButton.disabled = !isValid;

  if (totalHorariosAtual > LIMITE_MINIMO) {
    const maxSelecionaveis = totalHorariosAtual - LIMITE_MINIMO;
    if (selecionadosCount >= maxSelecionaveis) {
      allCheckboxes.forEach((cb) => {
        if (!cb.checked) {
          cb.disabled = true;
          cb.parentElement.classList.add("disabled-check");
        }
      });
    } else {
      allCheckboxes.forEach((cb) => {
        cb.disabled = false;
        cb.parentElement.classList.remove("disabled-check");
      });
    }
  } else {
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
  console.log("[Alterar Grade] Tentativa de envio do formulário.");

  if (!submitButton || submitButton.disabled) {
    console.warn("[Alterar Grade] Envio bloqueado. Botão desabilitado.");
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = `<span class="loading-spinner-small"></span> Enviando...`;

  if (!feedbackMessage) {
    feedbackMessage = document.getElementById("solicitacao-feedback");
  }

  if (feedbackMessage) {
    feedbackMessage.style.display = "none";
  }

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

  console.log("[Alterar Grade] Dados da solicitação:", solicitacaoData);

  try {
    const docRef = await addDoc(
      collection(db, "solicitacoesExclusaoGrade"),
      solicitacaoData
    );

    console.log("[Alterar Grade] Solicitação enviada com ID:", docRef.id);

    // --- INÍCIO DA ALTERAÇÃO V13 ---
    // Em vez de mostrar a mensagem na tela, chama o modal.
    // Ao fechar o modal (clicar em "OK"), redireciona para o dashboard.
    showLocalModal(
      "Sua solicitação foi enviada com sucesso e será analisada pela administração.",
      "success",
      () => {
        // Callback executado após o usuário clicar em "OK"
        window.location.hash = "#dashboard";
      }
    );
    // --- FIM DA ALTERAÇÃO V13 ---
  } catch (error) {
    console.error("[Alterar Grade] Erro ao salvar solicitação:", error);

    // --- INÍCIO DA ALTERAÇÃO V13 ---
    // Chama o modal de erro
    showLocalModal(
      "Erro ao enviar sua solicitação. Por favor, tente novamente.",
      "error"
    );
    // --- FIM DA ALTERAÇÃO V13 ---

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Solicitação`; //
    }
  }
}
