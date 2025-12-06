// /modulos/gestao/js/feedback.js
// VERSÃO 2.2 (Compatível com Link de Agendamentos e Atas)

import { db as firestoreDb, auth } from "../../../assets/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

const feedbackContainer = document.getElementById("feedback-container");

/**
 * Inicializa a página verificando autenticação.
 */
function initializePage() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Busca dados do usuário logado para preencher o nome
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
      renderError(
        "Acesso Negado. É preciso estar logado para enviar feedback.",
        true
      );
    }
  });
}

/**
 * Busca a reunião pelo ID da URL (Hash).
 * Tenta primeiro em 'gestao_atas', depois em 'agendamentos_voluntarios'.
 */
async function findMeetingAndRender(userData) {
  try {
    // Remove o '#' do início para pegar o ID
    const meetingId = window.location.hash.substring(1);

    if (!meetingId) {
      throw new Error("Link inválido: ID da reunião não encontrado.");
    }

    // Busca modelo de perguntas
    const perguntasDoc = await getDoc(
      doc(firestoreDb, "configuracoesSistema", "modelo_feedback")
    );
    // Fallback de perguntas se não houver configuração
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
            id: "duracao",
            texto: "Duração adequada?",
            tipo: "select",
            opcoes: ["Sim", "Não"],
          },
          {
            id: "sugestaoTema",
            texto: "Sugestões/Comentários:",
            tipo: "textarea",
          },
        ];

    let data = null;
    let collectionName = "";

    // 1. Tenta buscar em 'gestao_atas' (Reuniões já finalizadas/registradas)
    let docRef = doc(firestoreDb, "gestao_atas", meetingId);
    let docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      collectionName = "gestao_atas";
      data = docSnap.data();
    } else {
      // 2. Se não achar, tenta buscar em 'agendamentos_voluntarios' (Reuniões agendadas/em andamento)
      docRef = doc(firestoreDb, "agendamentos_voluntarios", meetingId);
      docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        collectionName = "agendamentos_voluntarios";
        const rawData = docSnap.data();

        // Normaliza os dados para o formato de exibição
        data = {
          pauta: rawData.descricao || rawData.tipo || "Sem pauta definida",
          responsavelTecnica:
            rawData.slots?.[0]?.gestorNome || "Gestor Responsável",
          feedbacks: rawData.feedbacks || [],
        };
      }
    }

    if (!data) {
      throw new Error("Reunião não encontrada ou link expirado.");
    }

    // Verifica se o usuário já respondeu
    const jaRespondeu = data.feedbacks?.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      feedbackContainer.innerHTML = `
        <div class="info-header">
            <h2>Feedback Já Enviado</h2>
            <p><strong>Tema:</strong> ${data.pauta}</p>
        </div>
        <div class="message-box alert alert-info" style="text-align:center; padding: 30px;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #0dcaf0;">check_circle</span>
            <p style="margin-top:15px;">Você já registrou sua presença e feedback para esta reunião.</p>
            <button onclick="window.close()" class="action-button secondary-button" style="margin-top:10px;">Fechar</button>
        </div>`;
      feedbackContainer.classList.remove("loading");
    } else {
      renderFeedbackForm(
        data,
        meetingId,
        collectionName,
        perguntasModelo,
        userData
      );
    }
  } catch (err) {
    renderError(err.message);
  }
}

/**
 * Renderiza o formulário.
 */
function renderFeedbackForm(
  data,
  docId,
  collectionName,
  perguntasModelo,
  loggedInUser
) {
  let formHtml = `
        <div class="info-header">
            <h2>Feedback da Reunião</h2>
            <p><strong>Tema:</strong> ${data.pauta}</p>
            <p style="font-size: 0.9em; opacity: 0.8;"><strong>Responsável:</strong> ${data.responsavelTecnica}</p>
        </div>
        
        <form id="feedback-form">
            <div class="form-group">
                <label>Participante (Identificado)</label>
                <input type="text" class="form-control" value="${loggedInUser.nome}" disabled 
                       style="background-color: #e9ecef; cursor: not-allowed;">
            </div>`;

  perguntasModelo.forEach((p) => {
    formHtml += `<div class="form-group"><label for="${p.id}">${p.texto}</label>`;
    if (p.tipo === "select") {
      formHtml += `<select id="${p.id}" class="form-control" required>
        <option value="">Selecione...</option>
        ${p.opcoes
          .map((opt) => `<option value="${opt}">${opt}</option>`)
          .join("")}
      </select>`;
    } else if (p.tipo === "textarea") {
      formHtml += `<textarea id="${p.id}" class="form-control" rows="3"></textarea>`;
    }
    formHtml += "</div>";
  });

  formHtml += `
        <div style="margin-top: 25px;">
            <button type="submit" class="action-button save-btn" style="width: 100%; padding: 12px; font-size: 1.1em;">
                Confirmar Presença e Enviar Feedback
            </button>
        </div>
    </form>`;

  feedbackContainer.innerHTML = formHtml;
  feedbackContainer.classList.remove("loading");

  // Handler do Submit
  document
    .getElementById("feedback-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando...";

      try {
        const feedbackData = {
          timestamp: new Date().toISOString(),
          nome: loggedInUser.nome,
          uid: loggedInUser.uid || null, // Salva UID se disponível
        };

        // Coleta respostas
        perguntasModelo.forEach((p) => {
          const element = document.getElementById(p.id);
          if (element.required && !element.value)
            throw new Error(`Por favor, responda: "${p.texto}"`);
          feedbackData[p.id] = element.value;
        });

        // Atualiza no Firestore
        const docRef = doc(firestoreDb, collectionName, docId);
        await updateDoc(docRef, {
          feedbacks: arrayUnion(feedbackData),
        });

        feedbackContainer.innerHTML = `
            <div class="message-box alert alert-success" style="text-align: center; padding: 40px;">
                <span class="material-symbols-outlined" style="font-size: 60px; color: #198754; margin-bottom: 20px;">task_alt</span>
                <h2>Sucesso!</h2>
                <p>Sua presença foi confirmada e o feedback enviado.</p>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">Você pode fechar esta página.</p>
            </div>`;
      } catch (err) {
        alert(`Erro ao enviar: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
}

function renderError(msg, isCritical = false) {
  const action = isCritical
    ? '<br><a href="../../../index.html" class="action-button secondary-button" style="margin-top:15px; display:inline-block;">Ir para Login</a>'
    : "";
  feedbackContainer.innerHTML = `
        <div class="message-box alert alert-danger" style="text-align: center;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #dc3545;">error</span>
            <h3>Ocorreu um erro</h3>
            <p>${msg}</p>
            ${action}
        </div>`;
  feedbackContainer.classList.remove("loading");
}

// Inicia
initializePage();
