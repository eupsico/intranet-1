// /modulos/gestao/js/feedback.js
// VERSÃO 4.0 (Janela de Tempo + Eventos Unificados)

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

    // Variáveis para controle de tempo
    let dataEvento, horaInicioStr, horaFimStr;

    if (slotIndex !== -1) {
      // SLOT
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
        descricao: dataRaiz.descricao || "",
      };
      feedbacksArray = slot.feedbacks || [];
    } else {
      // RAIZ (Eventos simples)
      // Assumindo duração padrão de 1h se não tiver horaFim definida
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
        descricao: dataRaiz.descricao || "",
      };
      feedbacksArray = dataRaiz.feedbacks || [];
    }

    // --- LÓGICA DE VALIDAÇÃO DE TEMPO (ATUALIZADA) ---
    const agora = new Date();

    // Cria datas completas para inicio e fim
    const dataInicio = new Date(`${dataEvento}T${horaInicioStr}:00`);
    const dataFim = new Date(`${dataEvento}T${horaFimStr}:00`);

    // Regra: Liberar 30 min APÓS inicio
    const janelaAbertura = new Date(dataInicio.getTime() + 30 * 60000); // +30 min

    // Regra: Fechar 90 min APÓS termino
    const janelaFechamento = new Date(dataFim.getTime() + 90 * 60000); // +90 min

    // VERIFICAÇÃO DE ESPERA (ANTES DO TEMPO)
    if (agora < janelaAbertura) {
      const diffMin = Math.ceil((janelaAbertura - agora) / 60000);

      // AQUI ESTÁ A MUDANÇA: Chamamos a função visual em vez de jogar erro
      renderWaitScreen(dadosReuniao.pauta, diffMin, horaInicioStr);
      return; // Para a execução aqui
    }

    // VERIFICAÇÃO DE EXPIRAÇÃO (DEPOIS DO TEMPO)
    if (agora > janelaFechamento) {
      throw new Error(
        "O prazo para envio do feedback (90 min após o término) encerrou."
      );
    }
    // -------------------------------------

    const jaRespondeu = feedbacksArray.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      feedbackContainer.innerHTML = `
        <div class="info-header">
            <h2>Feedback Já Enviado</h2>
            <p><strong>Tema:</strong> ${dadosReuniao.pauta}</p>
        </div>
        <div class="message-box alert alert-info" style="text-align:center; padding: 30px;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #0dcaf0;">check_circle</span>
            <p>Sua presença já foi computada.</p>
        </div>`;
      feedbackContainer.classList.remove("loading");
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
/**
 * Renderiza a tela de espera estilizada (Amarela)
 */
function renderWaitScreen(nomeReuniao, minutosRestantes, horaInicio) {
  const feedbackContainer = document.getElementById("feedback-container");

  // Converte minutos muito grandes em horas para ficar mais bonito
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
                        O formulário de presença e feedback estará disponível 
                        30 minutos após o início da reunião (${horaInicio}).
                    </p>
                    <div class="wait-badge">
                        Faltam aproximadamente ${tempoTexto}
                    </div>
                </div>
                <button onclick="location.reload()" class="action-button secondary-button" style="margin-top: 25px; background: transparent; color: #666; border: 1px solid #ccc;">
                    <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 18px;">refresh</span> Atualizar Página
                </button>
            </div>
        </div>
    `;

  feedbackContainer.innerHTML = html;
  feedbackContainer.classList.remove("loading");
}
function renderFeedbackForm(
  data,
  docId,
  slotIndex,
  perguntasModelo,
  loggedInUser
) {
  let formHtml = `
        <div class="info-header">
            <h2>Feedback e Presença</h2>
            <p><strong>Reunião:</strong> ${data.pauta}</p>
        </div>
        
        <form id="feedback-form">
            <div class="form-group">
                <label>Profissional</label>
                <input type="text" class="form-control" value="${loggedInUser.nome}" disabled style="background:#e9ecef;">
            </div>`;

  perguntasModelo.forEach((p) => {
    formHtml += `<div class="form-group"><label>${p.texto}</label>`;
    if (p.tipo === "select") {
      formHtml += `<select id="${
        p.id
      }" class="form-control" required><option value="">Selecione...</option>${p.opcoes
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("")}</select>`;
    } else {
      formHtml += `<textarea id="${p.id}" class="form-control" rows="3"></textarea>`;
    }
    formHtml += "</div>";
  });

  formHtml += `<button type="submit" class="action-button save-btn" style="width:100%; margin-top:20px;">Confirmar Presença</button></form>`;

  feedbackContainer.innerHTML = formHtml;
  feedbackContainer.classList.remove("loading");

  document
    .getElementById("feedback-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
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
          if (!val && p.tipo === "select")
            throw new Error("Preencha todos os campos.");
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

        feedbackContainer.innerHTML = `<div class="alert alert-success text-center"><h2>Sucesso!</h2><p>Presença confirmada.</p></div>`;
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = "Confirmar Presença";
      }
    });
}

function renderError(msg, isCritical = false) {
  const btn = isCritical
    ? '<br><a href="../../../index.html" class="btn btn-secondary mt-3">Ir para Login</a>'
    : "";
  feedbackContainer.innerHTML = `<div class="alert alert-danger text-center"><h3>Aviso</h3><p>${msg}</p>${btn}</div>`;
  feedbackContainer.classList.remove("loading");
}

initializePage();
