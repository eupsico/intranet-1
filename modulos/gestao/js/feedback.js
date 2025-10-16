// /modulos/gestao/js/feedback.js
// VERSÃO 2.0 (CORRIGIDO - Utiliza o utilizador logado)

import { db as firestoreDb, auth } from "../../../assets/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const feedbackContainer = document.getElementById("feedback-container");

/**
 * Função principal que inicia a verificação de autenticação.
 */
function initializePage() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Se o utilizador estiver logado, busca os seus dados no Firestore
      try {
        const userDocRef = doc(firestoreDb, "usuarios", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Com os dados do utilizador, procura a reunião e renderiza o formulário
          await findMeetingAndRender(userData);
        } else {
          throw new Error(
            "Perfil de utilizador não encontrado na base de dados."
          );
        }
      } catch (error) {
        feedbackContainer.innerHTML = `<div class="message-box alert alert-danger"><strong>Erro:</strong> ${error.message}</div>`;
      }
    } else {
      // Se o utilizador não estiver logado, exibe uma mensagem de erro.
      feedbackContainer.innerHTML = `<div class="message-box alert alert-danger"><strong>Acesso Negado.</strong><p>É preciso estar autenticado para enviar feedback. Por favor, feche esta página e aceda através do botão na intranet.</p></div>`;
    }
  });
}

/**
 * Encontra a reunião pelo ID na URL e prepara para renderizar o formulário.
 * @param {object} userData - Os dados do utilizador logado.
 */
async function findMeetingAndRender(userData) {
  try {
    const ataId = window.location.hash.substring(1);
    if (!ataId) {
      throw new Error("ID da reunião não fornecido na URL.");
    }

    const [ataDoc, perguntasDoc] = await Promise.all([
      getDoc(doc(firestoreDb, "gestao_atas", ataId)),
      getDoc(doc(firestoreDb, "configuracoesSistema", "modelo_feedback")),
    ]);

    if (!ataDoc.exists()) throw new Error("Ata da reunião não encontrada.");
    if (!perguntasDoc.exists())
      throw new Error(
        "Modelo de perguntas de feedback não foi configurado no painel de administração."
      );

    const ata = ataDoc.data();
    const perguntasModelo = perguntasDoc.data().perguntas;

    // Verifica se o utilizador já respondeu
    const jaRespondeu = ata.feedbacks?.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      const headerHtml = `
                <div class="info-header">
                    <h2>Feedback da Reunião Técnica</h2>
                    <p><strong>Tema:</strong> ${ata.pauta || "N/A"}</p>
                </div>`;
      feedbackContainer.innerHTML =
        headerHtml +
        `<div class="message-box alert alert-info"><h2>Feedback já enviado</h2><p>Você já enviou o feedback para esta reunião. Obrigado!</p></div>`;
      feedbackContainer.classList.remove("loading");
    } else {
      renderFeedbackForm(ata, ataId, perguntasModelo, userData);
    }
  } catch (err) {
    feedbackContainer.innerHTML = `<div class="message-box alert alert-danger"><strong>Erro:</strong> ${err.message}</div>`;
  }
}

/**
 * Renderiza o formulário de feedback na página.
 * @param {object} ata - Os dados da ata da reunião.
 * @param {string} ataId - O ID do documento da ata.
 * @param {Array} perguntasModelo - O array com as perguntas a serem feitas.
 * @param {object} loggedInUser - Os dados do utilizador logado.
 */
function renderFeedbackForm(ata, ataId, perguntasModelo, loggedInUser) {
  let formHtml = `
        <div class="info-header">
            <h2>Feedback da Reunião Técnica</h2>
            <p><strong>Tema:</strong> ${
              ata.pauta || "N/A"
            } | <strong>Responsável:</strong> ${
    ata.responsavelTecnica || "N/A"
  }</p>
        </div>
        <form id="feedback-form">
            <div class="form-group">
                <label for="participante-nome">Nome do participante</label>
                <input type="text" id="participante-nome" class="form-control" value="${
                  loggedInUser.nome
                }" disabled>
            </div>`;

  perguntasModelo.forEach((p) => {
    formHtml += `<div class="form-group"><label for="${p.id}">${p.texto}</label>`;
    if (p.tipo === "select") {
      formHtml += `<select id="${
        p.id
      }" class="form-control" required><option value="">Selecione...</option>${p.opcoes
        .map((opt) => `<option value="${opt}">${opt}</option>`)
        .join("")}</select>`;
    } else if (p.tipo === "textarea") {
      formHtml += `<textarea id="${p.id}" class="form-control" rows="3"></textarea>`;
    }
    formHtml += '<span class="error-message"></span></div>';
  });

  formHtml += `<div><button type="submit" class="action-button save-btn">Enviar Feedback</button></div></form>`;
  feedbackContainer.innerHTML = formHtml;
  feedbackContainer.classList.remove("loading");

  document
    .getElementById("feedback-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "A enviar...";

      try {
        const feedbackData = {
          timestamp: new Date().toISOString(),
          nome: loggedInUser.nome, // Usa o nome do utilizador logado
        };

        perguntasModelo.forEach((p) => {
          const element = document.getElementById(p.id);
          if (element.required && !element.value) {
            throw new Error(`O campo "${p.texto}" é obrigatório.`);
          }
          feedbackData[p.id] = element.value;
        });

        const ataRef = doc(firestoreDb, "gestao_atas", ataId);
        await updateDoc(ataRef, {
          feedbacks: arrayUnion(feedbackData),
        });

        feedbackContainer.innerHTML = `<div class="message-box alert alert-success"><h2>Obrigado!</h2><p>O seu feedback foi enviado com sucesso.</p></div>`;
      } catch (err) {
        alert(`Erro ao enviar feedback: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Feedback";
      }
    });
}

// Inicia o processo quando a página é carregada
initializePage();
