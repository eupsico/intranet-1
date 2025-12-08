// /modulos/gestao/js/feedback.js
// VERSÃO 5.0 (Card UI + Validação de Palavras + Feedback Visual)

import { db as firestoreDb, auth } from "../../../assets/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

const feedbackContainer = document.getElementById("feedback-container");

// CONFIGURAÇÃO: Mínimo de palavras para respostas de texto (evita "ok", "pontinhos", etc)
const MINIMO_PALAVRAS_PADRAO = 5;

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

    // 1. Busca modelo de perguntas
    const perguntasDoc = await getDoc(
      doc(firestoreDb, "configuracoesSistema", "modelo_feedback")
    );

    // Fallback: Se não houver configuração no banco, usa este padrão
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
            id: "aprendizado",
            texto: "Qual foi o maior aprendizado?",
            tipo: "textarea",
            minPalavras: 5,
          },
          {
            id: "sugestaoTema",
            texto: "Sugestões/Comentários:",
            tipo: "textarea",
            minPalavras: 5,
          },
        ];

    // 2. Busca dados do evento
    const docRef = doc(firestoreDb, "eventos", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Reunião não encontrada.");

    const dataRaiz = docSnap.data();
    let dadosReuniao = null;
    let feedbacksArray = [];
    let dataEvento, horaInicioStr, horaFimStr;

    // Lógica para extrair dados (Slot vs Raiz)
    if (slotIndex !== -1) {
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

    // 3. Validação de Tempo (Janela de Abertura e Fechamento)
    const agora = new Date();
    const dataInicio = new Date(`${dataEvento}T${horaInicioStr}:00`);
    const dataFim = new Date(`${dataEvento}T${horaFimStr}:00`);

    const janelaAbertura = new Date(dataInicio.getTime() + 30 * 60000); // +30 min
    const janelaFechamento = new Date(dataFim.getTime() + 90 * 60000); // +90 min

    if (agora < janelaAbertura) {
      const diffMin = Math.ceil((janelaAbertura - agora) / 60000);
      renderWaitScreen(dadosReuniao.pauta, diffMin, horaInicioStr);
      return;
    }

    if (agora > janelaFechamento) {
      throw new Error(
        "O prazo para envio do feedback (90 min após o término) encerrou."
      );
    }

    // 4. Verifica se já respondeu
    const jaRespondeu = feedbacksArray.some((fb) => fb.nome === userData.nome);

    if (jaRespondeu) {
      feedbackContainer.innerHTML = `
        <div class="info-header">
            <h2>Feedback Enviado</h2>
            <p><strong>Tema:</strong> ${dadosReuniao.pauta}</p>
        </div>
        <div class="message-box">
            <span class="material-symbols-outlined" style="font-size: 64px; color: #28a745;">check_circle</span>
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

// Renderiza a tela amarela de espera
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

// Renderiza o formulário principal
function renderFeedbackForm(
  data,
  docId,
  slotIndex,
  perguntasModelo,
  loggedInUser
) {
  // Cabeçalho e campo fixo
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

  // Renderização Dinâmica das Perguntas
  perguntasModelo.forEach((p) => {
    // Definir obrigatoriedade e mínimo de palavras
    const isRequired = true; // Por padrão, tudo é obrigatório como solicitado
    const minWords =
      p.tipo !== "select" ? p.minPalavras || MINIMO_PALAVRAS_PADRAO : 0;

    formHtml += `
        <div class="form-group">
            <label>
                ${p.texto} 
                ${isRequired ? '<span class="required-asterisk">*</span>' : ""}
            </label>`;

    if (p.tipo === "select") {
      formHtml += `
            <select id="${p.id}" required>
                <option value="">Selecione...</option>
                ${p.opcoes
                  .map((o) => `<option value="${o}">${o}</option>`)
                  .join("")}
            </select>`;
    } else {
      // Textarea com contador de palavras
      formHtml += `
            <textarea 
                id="${p.id}" 
                rows="3" 
                required 
                data-min-words="${minWords}"
            ></textarea>
            <div class="word-counter" id="counter-${p.id}">
                0/${minWords} palavras mínimas
            </div>`;
    }
    formHtml += "</div>";
  });

  formHtml += `
            <button type="submit" class="btn-confirmar">Confirmar Presença</button>
        </form>
    </div>`; // Fim form-body

  feedbackContainer.innerHTML = formHtml;

  // --- LÓGICA DE EVENTOS DO FORMULÁRIO ---

  // 1. Contador em Tempo Real (Visual)
  const textareas = feedbackContainer.querySelectorAll("textarea");
  textareas.forEach((textarea) => {
    textarea.addEventListener("input", function () {
      const min = parseInt(this.getAttribute("data-min-words"));
      const counterDiv = document.getElementById(`counter-${this.id}`);
      const numPalavras = contarPalavras(this.value);

      counterDiv.textContent = `${numPalavras}/${min} palavras mínimas`;

      if (numPalavras >= min) {
        counterDiv.classList.add("valid"); // Fica verde (definir no CSS)
        this.classList.remove("input-error");
      } else {
        counterDiv.classList.remove("valid");
      }
    });
  });

  // 2. Validação e Envio
  document
    .getElementById("feedback-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector("button");

      let formValido = true;
      let erroMsg = "";

      // Validar Selects
      const selects = form.querySelectorAll("select[required]");
      selects.forEach((sel) => {
        if (!sel.value) {
          formValido = false;
          sel.classList.add("input-error");
          sel.addEventListener(
            "change",
            () => sel.classList.remove("input-error"),
            { once: true }
          );
        }
      });

      // Validar Textareas (Contagem de Palavras)
      const textareasValidacao = form.querySelectorAll(
        "textarea[data-min-words]"
      );
      textareasValidacao.forEach((txt) => {
        const min = parseInt(txt.getAttribute("data-min-words"));
        const numPalavras = contarPalavras(txt.value);

        if (numPalavras < min) {
          formValido = false;
          txt.classList.add("input-error");

          const counterDiv = document.getElementById(`counter-${txt.id}`);
          counterDiv.style.color = "var(--cor-erro)";
          counterDiv.style.fontWeight = "bold";

          if (!erroMsg)
            erroMsg = `Por favor, forneça respostas mais completas (mínimo de ${min} palavras).`;

          // Remove erro visualmente assim que atingir a meta
          txt.addEventListener("input", function () {
            if (contarPalavras(this.value) >= min) {
              this.classList.remove("input-error");
              document.getElementById(`counter-${this.id}`).style.color = "";
              document.getElementById(`counter-${this.id}`).style.fontWeight =
                "";
            }
          });
        }
      });

      // Se houver erro, para tudo e mostra
      if (!formValido) {
        alert(erroMsg || "Preencha todos os campos obrigatórios corretamente.");
        const primeiroErro = form.querySelector(".input-error");
        if (primeiroErro) {
          primeiroErro.scrollIntoView({ behavior: "smooth", block: "center" });
          primeiroErro.focus();
        }
        return;
      }

      // Se tudo OK, envia para Firebase
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
                <p>Presença confirmada e feedback registrado com sucesso!</p>
            </div>`;
      } catch (err) {
        alert("Erro ao salvar: " + err.message);
        btn.disabled = false;
        btn.textContent = "Confirmar Presença";
      }
    });
}

// Helper: Conta palavras reais
function contarPalavras(texto) {
  if (!texto) return 0;
  const limpo = texto.trim();
  if (limpo === "") return 0;
  return limpo.split(/\s+/).length;
}

// Renderiza erros gerais de carregamento
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
