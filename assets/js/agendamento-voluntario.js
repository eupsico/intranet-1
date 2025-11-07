// assets/js/agendamento-voluntario.js
// Página pública para profissionais se inscreverem em reuniões com voluntário

import { db as firestoreDb, auth } from "./firebase-init.js";
import { doc, getDoc, updateDoc, onAuthStateChanged } from "./firebase-init.js";

let agendamentoId = null;
let agendamentoData = null;
let usuarioLogado = null;

// Aguardar autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioLogado = user;
    await carregarDadosUsuario();
    await inicializar();
  } else {
    mostrarErro("Você precisa estar logado para agendar uma reunião.");
  }
});

async function carregarDadosUsuario() {
  try {
    const userDoc = await getDoc(
      doc(firestoreDb, "usuarios", usuarioLogado.uid)
    );
    if (userDoc.exists()) {
      usuarioLogado.dadosCompletos = userDoc.data();
    }
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar dados do usuário:", error);
  }
}

async function inicializar() {
  // Pegar ID do agendamento da URL
  const urlParams = new URLSearchParams(window.location.search);
  agendamentoId = urlParams.get("agendamentoId");

  if (!agendamentoId) {
    mostrarErro("Link inválido. Nenhum agendamento foi especificado.");
    return;
  }

  await carregarAgendamento();
}

async function carregarAgendamento() {
  try {
    const agendamentoDoc = await getDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId)
    );

    if (!agendamentoDoc.exists()) {
      mostrarErro("Agendamento não encontrado.");
      return;
    }

    agendamentoData = agendamentoDoc.data();
    renderizarFormulario();
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar agendamento:", error);
    mostrarErro("Erro ao carregar informações da reunião.");
  }
}

function renderizarFormulario() {
  const container = document.getElementById("main-container");

  const gestorInfo = agendamentoData.exibirGestor
    ? `
      <div class="gestor-info">
        <strong>Reunião com: ${agendamentoData.gestorNome}</strong>
      </div>
    `
    : "";

  const slotsDisponiveis = agendamentoData.slots.filter(
    (slot) => !slot.vagas || slot.vagas.length === 0
  );

  if (slotsDisponiveis.length === 0) {
    container.innerHTML = `
      <div class="header">
        <h1>Reunião com Voluntário</h1>
      </div>
      <div class="error-message">
        Desculpe, todos os horários já foram preenchidos.
      </div>
    `;
    return;
  }

  const slotsHTML = slotsDisponiveis
    .map(
      (slot, index) => `
      <label class="slot-option">
        <input 
          type="radio" 
          name="slot" 
          value="${index}" 
          data-data="${slot.data}"
          data-hora-inicio="${slot.horaInicio}"
          data-hora-fim="${slot.horaFim}"
        />
        <div class="slot-info">
          <span class="slot-date">${formatarData(slot.data)}</span>
          <span class="slot-time">${slot.horaInicio} - ${slot.horaFim}</span>
        </div>
      </label>
    `
    )
    .join("");

  container.innerHTML = `
    <div class="header">
      <h1>Reunião com Voluntário</h1>
    </div>

    ${gestorInfo}

    <div class="descricao">
      ${agendamentoData.descricao}
    </div>

    <form id="form-agendamento">
      <div class="slots-section">
        <h3>Escolha o melhor horário para você:</h3>
        ${slotsHTML}
      </div>

      <button type="submit" class="btn-confirmar">Confirmar Agendamento</button>
    </form>
  `;

  // Event listeners
  document
    .querySelectorAll('.slot-option input[type="radio"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        document.querySelectorAll(".slot-option").forEach((opt) => {
          opt.classList.remove("selected");
        });
        radio.closest(".slot-option").classList.add("selected");
      });
    });

  document
    .getElementById("form-agendamento")
    .addEventListener("submit", confirmarAgendamento);
}

async function confirmarAgendamento(e) {
  e.preventDefault();

  const slotSelecionado = document.querySelector('input[name="slot"]:checked');

  if (!slotSelecionado) {
    alert("Por favor, selecione um horário.");
    return;
  }

  const slotIndex = parseInt(slotSelecionado.value);
  const data = slotSelecionado.dataset.data;
  const horaInicio = slotSelecionado.dataset.horaInicio;
  const horaFim = slotSelecionado.dataset.horaFim;

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Confirmando...";

  try {
    const slot = agendamentoData.slots.find(
      (s) =>
        s.data === data && s.horaInicio === horaInicio && s.horaFim === horaFim
    );

    if (!slot.vagas) {
      slot.vagas = [];
    }

    // Adicionar vaga
    slot.vagas.push({
      id: Date.now().toString(),
      profissionalId: usuarioLogado.uid,
      profissionalNome: usuarioLogado.dadosCompletos?.nome || "Sem nome",
      presente: false,
      inscritoEm: new Date().toISOString(),
    });

    // Atualizar no Firestore
    await updateDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
      {
        slots: agendamentoData.slots,
      }
    );

    mostrarSucesso(data, horaInicio, horaFim);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao confirmar agendamento:", error);
    alert("Erro ao confirmar agendamento. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Confirmar Agendamento";
  }
}

function mostrarSucesso(data, horaInicio, horaFim) {
  const container = document.getElementById("main-container");
  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Agendamento Confirmado!</h2>
      <p><strong>Data:</strong> ${formatarData(data)}</p>
      <p><strong>Horário:</strong> ${horaInicio} - ${horaFim}</p>
      <p style="margin-top: 1.5rem; color: var(--text-secondary);">
        Você receberá um lembrete próximo à data da reunião.
      </p>
    </div>
  `;
}

function mostrarErro(mensagem) {
  const container = document.getElementById("main-container");
  container.innerHTML = `
    <div class="error-message">
      ${mensagem}
    </div>
  `;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}
