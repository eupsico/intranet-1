// NOVO ARQUIVO: modulos/voluntario/js/alterar-grade.js
// VERSÃO 3: Corrigindo DE VERDADE os caminhos de importação e fetch.

// Importa as funções necessárias do Firebase
// --- LINHA CORRIGIDA ---
import {
  db,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

// Constantes para renderizar a grade
const DIAS_SEMANA = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];
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

let currentUser;
let currentUserData;
let totalHorariosAtual = 0; // Armazena o total de horários do usuário
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
  console.log("[Alterar Grade] Módulo iniciado.");
  currentUser = user;
  currentUserData = userData;

  // Carrega o HTML da página
  const viewContainer = document.querySelector("#alterar-grade");
  if (!viewContainer) {
    console.error("[Alterar Grade] Container #alterar-grade não encontrado.");
    return;
  }

  try {
    // --- LINHA CORRIGIDA ---
    // O fetch é relativo à página 'portal-voluntario.html' (raiz do módulo), não ao 'alterar-grade.js'
    const response = await fetch("alterar-grade.html");
    if (!response.ok) {
      throw new Error(`Falha ao carregar o HTML: ${response.statusText}`);
    }
    viewContainer.innerHTML = await response.text();

    // Agora que o HTML foi carregado, inicializa os elementos
    setupDOMElements();
    populateInitialData();
    await loadAndRenderGrades();
    setupEventListeners();
  } catch (error) {
    console.error("[Alterar Grade] Erro ao carregar ou inicializar:", error);
    viewContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar o módulo de alteração de grade. Tente recarregar a página.</p>`;
  }
}

/**
 * Mapeia os elementos do DOM para as variáveis do módulo
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
  if (currentUserData && currentUserData.nomeCompleto) {
    nomeInput.value = currentUserData.nomeCompleto;
  } else {
    nomeInput.value = "Nome não encontrado";
  }
}

/**
 * Carrega os dados da grade do usuário e chama as funções de renderização
 */
async function loadAndRenderGrades() {
  totalHorariosAtual = 0; // Reseta a contagem
  gradesContainer.innerHTML = ""; // Limpa o spinner

  // Busca os dados de horário do profissional (que já vêm no userData)
  const horariosOnline = currentUserData.horarios?.online || {};
  const horariosPresencial = currentUserData.horarios?.presencial || {};

  // Renderiza as grades
  const onlineHtml = renderGrade(horariosOnline, "online");
  const presencialHtml = renderGrade(horariosPresencial, "presencial");

  if (totalHorariosAtual === 0) {
    gradesContainer.innerHTML = `<p class="alert">Você não possui horários cadastrados na grade.</p>`;
    motivoTextarea.disabled = true;
    avisoMinimo.style.display = "none";
  } else {
    gradesContainer.innerHTML = onlineHtml + presencialHtml;
  }

  totalInput.value = totalHorariosAtual;

  // Validação inicial
  validateForm();
}

/**
 * Renderiza uma grade (Online ou Presencial) e retorna o HTML
 * @param {object} horarios - O objeto de horários (online ou presencial)
 * @param {string} tipoGrade - "online" ou "presencial"
 * @returns {string} O HTML da grade
 */
function renderGrade(horarios, tipoGrade) {
  let html = `<div class="grade-section">
                    <h3>Grade ${
                      tipoGrade.charAt(0).toUpperCase() + tipoGrade.slice(1)
                    }</h3>
                    <div class="grade-checkbox-list">`;
  let countGrade = 0;

  DIAS_SEMANA.forEach((dia) => {
    if (horarios[dia]) {
      HORAS.forEach((hora) => {
        const horaKey = hora.replace(":", "-");
        if (horarios[dia][horaKey]) {
          // Itera sobre as colunas (col1, col2, etc.)
          Object.keys(horarios[dia][horaKey]).forEach((col) => {
            const slot = horarios[dia][horaKey][col];

            // Verifica se o slot pertence ao usuário logado
            if (slot && slot.uid === currentUser.uid) {
              const diaFormatado = dia.charAt(0).toUpperCase() + dia.slice(1);
              const label = `${diaFormatado}, ${hora}`;
              const path = `${tipoGrade}.${dia}.${horaKey}.${col}`;

              html += `
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="horario_excluir" value="${path}" id="chk_${path}" data-label="${label}">
                                    <label class="form-check-label" for="chk_${path}">
                                        ${label}
                                    </label>
                                </div>
                            `;
              totalHorariosAtual++;
              countGrade++;
            }
          });
        }
      });
    }
  });

  if (countGrade === 0) {
    html += `<p>Nenhum horário cadastrado nesta grade.</p>`;
  }

  html += `</div></div>`;
  return html;
}

/**
 * Adiciona os listeners de evento ao formulário
 */
function setupEventListeners() {
  if (!form) return;
  // Listener para qualquer mudança no formulário (checkboxes)
  form.addEventListener("change", validateForm);

  // Listener para digitação no motivo
  motivoTextarea.addEventListener("input", validateForm);

  // Listener para o envio do formulário
  form.addEventListener("submit", handleFormSubmit);
}

/**
 * Valida o formulário e atualiza o estado do botão e avisos
 */
function validateForm() {
  if (!form) return; // Se o form não foi inicializado

  const selectedCheckboxes = form.querySelectorAll(
    'input[name="horario_excluir"]:checked'
  );
  const motivo = motivoTextarea.value.trim();

  const horariosRestantes = totalHorariosAtual - selectedCheckboxes.length;

  let isMotivoOk = motivo.length > 0;
  let isHorarioOk = selectedCheckboxes.length > 0;
  let isMinimoOk = horariosRestantes >= 5;

  // Atualiza feedback visual do motivo (se for obrigatório)
  motivoTextarea.classList.toggle(
    "is-invalid",
    !isMotivoOk && motivo.length > 0
  ); // Mostra inválido se começou a digitar e apagou

  // Atualiza aviso de mínimo de horários
  if (totalHorariosAtual > 5) {
    avisoMinimo.classList.toggle("alert-warning", isMinimoOk);
    avisoMinimo.classList.toggle("alert-error", !isMinimoOk);
    avisoMinimo.innerHTML = `<i class="fas fa-exclamation-triangle"></i>
            Você deve manter no mínimo 5 horários. 
            (Atual: ${totalHorariosAtual} | Selecionados: ${selectedCheckboxes.length} | Restantes: ${horariosRestantes})`;
  } else {
    avisoMinimo.innerHTML = `<i class="fas fa-info-circle"></i> Você possui ${totalHorariosAtual} horários. Lembre-se que o mínimo recomendado é 5.`;
    isMinimoOk = true; // Permite excluir mesmo se já tiver menos de 5
  }

  // Habilita o botão
  const isValid = isMotivoOk && isHorarioOk && isMinimoOk;
  submitButton.disabled = !isValid;
}

/**
 * Manipula o envio do formulário de exclusão
 * @param {Event} e - O evento de submit
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
      path: cb.value, // ex: "online.segunda.09-00.col1"
      label: cb.dataset.label, // ex: "Segunda, 09:00"
    });
  });

  const motivo = motivoTextarea.value.trim();

  // Monta o objeto da solicitação
  const solicitacaoData = {
    solicitanteId: currentUser.uid,
    solicitanteNome: currentUserData.nomeCompleto || "Nome não encontrado",
    horariosParaExcluir: horariosParaExcluir,
    totalHorariosAtual: totalHorariosAtual,
    motivo: motivo,
    status: "Pendente", // Status inicial
    dataSolicitacao: serverTimestamp(),
  };

  try {
    // Salva a solicitação na nova coleção
    const docRef = await addDoc(
      collection(db, "solicitacoesExclusaoGrade"),
      solicitacaoData
    );

    console.log("[Alterar Grade] Solicitação enviada com ID:", docRef.id);

    // Sucesso
    feedbackMessage.className = "alert alert-success";
    feedbackMessage.innerHTML =
      "Sua solicitação foi enviada com sucesso e será analisada pela administração.";
    feedbackMessage.style.display = "block";

    // Limpa o formulário e recarrega a grade
    form.reset();
    await loadAndRenderGrades(); // Recarrega a grade
    submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Solicitação`;
    // O botão ficará desabilitado por validateForm(), o que é o correto
  } catch (error) {
    console.error("[Alterar Grade] Erro ao salvar solicitação:", error);
    feedbackMessage.className = "alert alert-error";
    feedbackMessage.innerHTML =
      "Erro ao enviar sua solicitação. Tente novamente.";
    feedbackMessage.style.display = "block";

    submitButton.disabled = false; // Reabilita para nova tentativa
    submitButton.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Solicitação`;
  }
}
