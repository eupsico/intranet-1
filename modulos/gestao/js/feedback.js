// /modulos/gestao/js/feedback.js
// VERSÃO 3.0 (Unificado com Eventos e Suporte a Slots)

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
 * Suporta IDs compostos (DOCID_SLOTINDEX) para eventos com múltiplos horários.
 */
async function findMeetingAndRender(userData) {
  try {
    const hash = window.location.hash.substring(1); // Ex: "DOCID" ou "DOCID_2"
    if (!hash) {
      throw new Error("Link inválido: ID da reunião não encontrado.");
    }

    // Separa ID do Documento e Index do Slot (se houver)
    // Se não houver underline, o split retorna apenas o ID no index 0
    const partes = hash.split("_");
    const docId = partes[0];
    const slotIndex = partes.length > 1 ? parseInt(partes[1]) : -1;

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

    // Busca o evento na coleção unificada
    const docRef = doc(firestoreDb, "eventos", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Reunião não encontrada ou link expirado.");
    }

    const dataRaiz = docSnap.data();
    let dadosReuniao = null;
    let feedbacksArray = [];

    // Lógica para determinar de onde ler os dados (Slot ou Raiz)
    if (slotIndex !== -1) {
      // É um Slot específico
      if (!dataRaiz.slots || !dataRaiz.slots[slotIndex]) {
        throw new Error("Horário da reunião não encontrado.");
      }

      const slot = dataRaiz.slots[slotIndex];
      const dataFormatada = new Date(
        slot.data + "T00:00:00"
      ).toLocaleDateString("pt-BR");

      dadosReuniao = {
        pauta: `${dataRaiz.tipo} - ${dataFormatada} às ${slot.horaInicio}`,
        responsavelTecnica: slot.gestorNome || "Gestor Responsável",
        // Campo 'descricao' na raiz costuma ter o texto público
        descricao: dataRaiz.descricao || "Sem descrição",
      };

      feedbacksArray = slot.feedbacks || [];
    } else {
      // É um Evento Raiz (Simples ou Legado)
      const dataFormatada = dataRaiz.dataReuniao
        ? new Date(dataRaiz.dataReuniao + "T00:00:00").toLocaleDateString(
            "pt-BR"
          )
        : "";

      dadosReuniao = {
        pauta:
          dataRaiz.pauta ||
          dataRaiz.tipo + (dataFormatada ? ` - ${dataFormatada}` : ""),
        responsavelTecnica: dataRaiz.responsavel || "Não especificado",
        descricao: dataRaiz.descricao || dataRaiz.pauta || "",
      };

      feedbacksArray = dataRaiz.feedbacks || [];
    }

    // Verifica se o usuário já respondeu
    const jaRespondeu = feedbacksArray.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      feedbackContainer.innerHTML = `
        <div class="info-header">
            <h2>Feedback Já Enviado</h2>
            <p><strong>Tema:</strong> ${dadosReuniao.pauta}</p>
        </div>
        <div class="message-box alert alert-info" style="text-align:center; padding: 30px;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #0dcaf0;">check_circle</span>
            <p style="margin-top:15px;">Você já registrou sua presença e feedback para esta reunião.</p>
            <button onclick="window.close()" class="action-button secondary-button" style="margin-top:10px;">Fechar</button>
        </div>`;
      feedbackContainer.classList.remove("loading");
    } else {
      renderFeedbackForm(
        dadosReuniao,
        docId,
        slotIndex, // Passamos o index para saber onde salvar
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
  slotIndex,
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

        const docRef = doc(firestoreDb, "eventos", docId);

        // LÓGICA DE SALVAMENTO: RAIZ vs SLOT
        if (slotIndex === -1) {
          // Atualiza direto na raiz
          await updateDoc(docRef, {
            feedbacks: arrayUnion(feedbackData),
          });
        } else {
          // Atualiza dentro do array de slots
          // Precisamos ler o documento para garantir consistência do array
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const slots = snap.data().slots || [];

            if (slots[slotIndex]) {
              if (!slots[slotIndex].feedbacks) {
                slots[slotIndex].feedbacks = [];
              }
              slots[slotIndex].feedbacks.push(feedbackData);

              await updateDoc(docRef, { slots: slots });
            } else {
              throw new Error("Este horário não está mais disponível.");
            }
          }
        }

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
