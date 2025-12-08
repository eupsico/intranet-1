// /modulos/gestao/js/feedback.js
// VERSÃO 4.1 (Estilo Card UI + Validação Obrigatória)

import { db as firestoreDb, auth } from "../../../assets/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

const feedbackContainer = document.getElementById("feedback-container");

function initializePage() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(firestoreDb, "usuarios", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          await findMeetingAndRender(userData);
        } else {
          throw new Error("Perfil de usuário não encontrado.");
        }
      } catch (error) {
        renderError(error.message);
      }
    } else {
      renderError("Acesso Negado. Faça login para acessar.", true);
    }
  });
}

async function findMeetingAndRender(userData) {
  try {
    const hash = window.location.hash.substring(1);
    if (!hash) throw new Error("Link inválido.");

    const partes = hash.split("_");
    const docId = partes[0];
    const slotIndex = partes.length > 1 ? parseInt(partes[1]) : -1;

    // Busca modelo de perguntas
    const perguntasDoc = await getDoc(
      doc(firestoreDb, "configuracoesSistema", "modelo_feedback")
    );

    // Fallback se não existir no banco
    const perguntasModelo = perguntasDoc.exists()
      ? perguntasDoc.data().perguntas
      : [
          {
            id: "clareza",
            texto: "O tema foi claro?",
            tipo: "select",
            opcoes: ["Sim", "Não", "Parcialmente"],
          },
          {
            id: "objetivos",
            texto: "Objetivos alcançados?",
            tipo: "select",
            opcoes: ["Sim", "Não"],
          },
          {
            id: "sugestaoTema",
            texto: "Sugestões/Comentários:",
            tipo: "textarea",
          },
        ];

    const docRef = doc(firestoreDb, "eventos", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Reunião não encontrada.");

    const dataRaiz = docSnap.data();
    let dadosReuniao = null;
    let feedbacksArray = [];
    let dataEvento, horaInicioStr, horaFimStr;

    if (slotIndex !== -1) {
      // Lógica de Slot
      if (!dataRaiz.slots || !dataRaiz.slots[slotIndex])
        throw new Error("Horário não encontrado.");
      const slot = dataRaiz.slots[slotIndex];

      dataEvento = slot.data;
      horaInicioStr = slot.horaInicio;
      horaFimStr = slot.horaFim;

      const dataFormatada = new Date(
        slot.data + "T00:00:00"
      ).toLocaleDateString("pt-BR");
      dadosReuniao = {
        pauta: `${dataRaiz.tipo} - ${dataFormatada} às ${slot.horaInicio}`,
        responsavelTecnica: slot.gestorNome || "Gestor Responsável",
      };
      feedbacksArray = slot.feedbacks || [];
    } else {
      // Lógica Raiz
      dataEvento =
        dataRaiz.dataReuniao ||
        dataRaiz.criadoEm?.toDate().toISOString().split("T")[0];
      horaInicioStr = dataRaiz.horaInicio || "08:00";
      horaFimStr = dataRaiz.horaFim || "09:00";

      const dataFormatada = new Date(
        dataEvento + "T00:00:00"
      ).toLocaleDateString("pt-BR");
      dadosReuniao = {
        pauta:
          dataRaiz.pauta ||
          dataRaiz.tipo + (dataFormatada ? ` - ${dataFormatada}` : ""),
        responsavelTecnica: dataRaiz.responsavel || "Não especificado",
      };
      feedbacksArray = dataRaiz.feedbacks || [];
    }

    // --- Validação de Tempo ---
    const agora = new Date();
    const dataInicio = new Date(`${dataEvento}T${horaInicioStr}:00`);
    const dataFim = new Date(`${dataEvento}T${horaFimStr}:00`);

    const janelaAbertura = new Date(dataInicio.getTime() + 30 * 60000);
    const janelaFechamento = new Date(dataFim.getTime() + 90 * 60000);

    if (agora < janelaAbertura) {
      const diffMin = Math.ceil((janelaAbertura - agora) / 60000);
      renderWaitScreen(dadosReuniao.pauta, diffMin, horaInicioStr);
      return;
    }

    if (agora > janelaFechamento) {
      throw new Error("O prazo para envio do feedback encerrou.");
    }
    // --------------------------

    const jaRespondeu = feedbacksArray.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      feedbackContainer.innerHTML = `
        <div class="info-header">
            <h2>Feedback Enviado</h2>
            <p><strong>Tema:</strong> ${dadosReuniao.pauta}</p>
        </div>
        <div class="message-box">
            <span class="material-symbols-outlined" style="font-size: 64px; color: var(--cor-primaria);">check_circle</span>
            <p style="font-size: 1.2rem; margin-top: 15px;">Sua presença já foi confirmada com sucesso!</p>
        </div>`;
    } else {
      renderFeedbackForm(
        dadosReuniao,
        docId,
        slotIndex,
        perguntasModelo,
        userData
      );
    }
  } catch (err) {
    renderError(err.message);
  }
}

function renderWaitScreen(nomeReuniao, minutosRestantes, horaInicio) {
  let tempoTexto = `${minutosRestantes} minutos`;
  if (minutosRestantes > 60) {
    const horas = Math.floor(minutosRestantes / 60);
    const mins = minutosRestantes % 60;
    tempoTexto = `${horas}h e ${mins}min`;
  }

  const html = `
        <div class="wait-card">
            <div class="wait-header">
                <span class="wait-label">Reunião Agendada</span>
                <h2 class="wait-meeting-title">${nomeReuniao}</h2>
            </div>
            <div class="wait-body">
                <span class="material-symbols-outlined wait-icon">hourglass_top</span>
                <div class="wait-message">
                    <h3>Aguardando Liberação</h3>
                    <p>
                        O formulário estará disponível 30 minutos após o início (${horaInicio}).
                    </p>
                    <div class="wait-badge">
                        Faltam aprox. ${tempoTexto}
                    </div>
                </div>
                <button onclick="location.reload()" class="btn-confirmar" style="background: transparent; color: #666; border: 1px solid #ccc; margin-top: 20px;">
                    Atualizar Página
                </button>
            </div>
        </div>
    `;
  feedbackContainer.innerHTML = html;
}

function renderFeedbackForm(
  data,
  docId,
  slotIndex,
  perguntasModelo,
  loggedInUser
) {
  // 1. Cabeçalho
  let formHtml = `
        <div class="info-header">
            <h2>Feedback e Presença</h2>
            <p><strong>Reunião:</strong> ${data.pauta}</p>
        </div>
        
        <div class="form-body">
            <form id="feedback-form" novalidate>
                <div class="form-group">
                    <label>Profissional</label>
                    <input type="text" value="${loggedInUser.nome}" disabled>
                </div>`;

  // 2. Loop de Perguntas Dinâmicas (FORÇANDO REQUIRED)
  perguntasModelo.forEach((p) => {
    // Adiciona o asterisco visual e a obrigatoriedade
    formHtml += `
        <div class="form-group">
            <label>${p.texto} <span class="required-asterisk">*</span></label>`;

    if (p.tipo === "select") {
      formHtml += `
            <select id="${p.id}" required>
                <option value="">Selecione...</option>
                ${p.opcoes
                  .map((o) => `<option value="${o}">${o}</option>`)
                  .join("")}
            </select>`;
    } else {
      // Textarea também recebe required
      formHtml += `<textarea id="${p.id}" rows="3" required></textarea>`;
    }
    formHtml += "</div>";
  });

  // 3. Botão Final
  formHtml += `
            <button type="submit" class="btn-confirmar">Confirmar Presença</button>
        </form>
    </div>`; // Fecha .form-body

  feedbackContainer.innerHTML = formHtml;

  // --- LÓGICA DE SUBMISSÃO COM VALIDAÇÃO VISUAL ---
  document
    .getElementById("feedback-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector("button");

      // Validação JS Manual para Efeitos Visuais
      let formValido = true;
      const inputsObrigatorios = form.querySelectorAll("[required]");

      inputsObrigatorios.forEach((input) => {
        if (!input.value.trim()) {
          formValido = false;
          input.classList.add("input-error");

          // Remove erro ao digitar
          input.addEventListener(
            "input",
            function () {
              this.classList.remove("input-error");
            },
            { once: true }
          );
        }
      });

      if (!formValido) {
        // Rola até o primeiro erro
        const primeiroErro = form.querySelector(".input-error");
        if (primeiroErro) {
          primeiroErro.scrollIntoView({ behavior: "smooth", block: "center" });
          primeiroErro.focus();
        }
        return; // Para aqui se inválido
      }

      // Se válido, prossegue com envio
      btn.disabled = true;
      btn.textContent = "Enviando...";

      try {
        const feedbackData = {
          timestamp: new Date().toISOString(),
          nome: loggedInUser.nome,
          uid: loggedInUser.uid || null,
          email: loggedInUser.email || null,
        };

        perguntasModelo.forEach((p) => {
          const val = document.getElementById(p.id).value;
          feedbackData[p.id] = val;
        });

        const docRef = doc(firestoreDb, "eventos", docId);
        if (slotIndex === -1) {
          await updateDoc(docRef, { feedbacks: arrayUnion(feedbackData) });
        } else {
          const snap = await getDoc(docRef);
          const slots = snap.data().slots;
          if (!slots[slotIndex].feedbacks) slots[slotIndex].feedbacks = [];
          slots[slotIndex].feedbacks.push(feedbackData);
          await updateDoc(docRef, { slots: slots });
        }

        feedbackContainer.innerHTML = `
            <div class="info-header"><h2>Sucesso!</h2></div>
            <div class="message-box">
                <span class="material-symbols-outlined" style="font-size: 64px; color: #28a745;">check_circle</span>
                <p>Presença confirmada e feedback enviado.</p>
            </div>`;
      } catch (err) {
        alert("Erro ao salvar: " + err.message);
        btn.disabled = false;
        btn.textContent = "Confirmar Presença";
      }
    });
}

function renderError(msg, isCritical = false) {
  const btn = isCritical
    ? '<br><a href="../../../index.html" class="btn-confirmar" style="display:inline-block; text-decoration:none; margin-top:20px;">Ir para Login</a>'
    : "";

  feedbackContainer.innerHTML = `
    <div class="alert alert-danger" style="text-align:center; margin: 20px;">
        <h3>Aviso</h3>
        <p>${msg}</p>
        ${btn}
    </div>`;
}

initializePage();
