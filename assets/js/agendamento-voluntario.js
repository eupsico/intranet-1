// assets/js/agendamento-voluntario.js
// VERSÃO 2.2 - Nome do gestor por slot + Redirecionamento após login

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
    salvarUrlERedirecionarParaLogin();
  }
});

function salvarUrlERedirecionarParaLogin() {
  const urlAtual = window.location.href;
  sessionStorage.setItem("redirectAfterLogin", urlAtual);

  const container = document.getElementById("main-container");
  container.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <h3 style="color: #003d7a; margin-bottom: 1rem;">Acesso Restrito</h3>
      <p style="margin-bottom: 1.5rem;">Você precisa estar logado para agendar uma reunião.</p>
      <button onclick="window.location.href='/index.html'" style="padding: 0.75rem 1.5rem; background: #003d7a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        Fazer Login
      </button>
    </div>
  `;
}
function obterDiaSemana(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  const data = new Date(ano, mes - 1, dia);
  const diasSemana = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  return diasSemana[data.getDay()];
}

async function carregarDadosUsuario() {
  try {
    const userDoc = await getDoc(
      doc(firestoreDb, "usuarios", usuarioLogado.uid)
    );
    if (userDoc.exists()) {
      usuarioLogado.dadosCompletos = userDoc.data();
      console.log(
        "[AGENDAMENTO] Usuário logado:",
        usuarioLogado.dadosCompletos.nome
      );
    }
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar dados do usuário:", error);
  }
}

async function inicializar() {
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
    console.log("[AGENDAMENTO] Dados carregados:", agendamentoData);

    renderizarFormulario();
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar agendamento:", error);
    mostrarErro("Erro ao carregar informações da reunião.");
  }
}

function renderizarFormulario() {
  const container = document.getElementById("main-container");

  // Info do voluntário logado
  const voluntarioInfo = `
    <div class="voluntario-info">
      <strong>Olá, ${
        usuarioLogado.dadosCompletos?.nome || "Voluntário"
      }!</strong>
    </div>
  `;

  // Info do gestor - se exibirGestor = true e há apenas 1 gestor único
  let gestorInfo = "";
  if (
    agendamentoData.exibirGestor &&
    agendamentoData.slots &&
    agendamentoData.slots.length > 0
  ) {
    const gestoresUnicos = [
      ...new Set(
        agendamentoData.slots.map((s) => s.gestorNome).filter(Boolean)
      ),
    ];

    if (gestoresUnicos.length === 1) {
      gestorInfo = `
        <div class="gestor-info">
          <strong>Reunião com: ${gestoresUnicos[0]}</strong>
        </div>
      `;
    }
  }

  // ✅ NOVO: Ordenar slots por data e hora ANTES de filtrar
  agendamentoData.slots.sort((a, b) => {
    // Primeiro compara as datas
    if (a.data !== b.data) {
      return a.data.localeCompare(b.data);
    }
    // Se as datas forem iguais, compara os horários
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  // Filtrar slots disponíveis
  const slotsDisponiveis = agendamentoData.slots.filter(
    (slot) => !slot.vagas || slot.vagas.length === 0
  );
  if (slotsDisponiveis.length === 0) {
    container.innerHTML = `
      <div class="header">
        <h1>Reunião com Voluntário</h1>
      </div>
      ${voluntarioInfo}
      <div class="error-message">
        Desculpe, todos os horários já foram preenchidos.
      </div>
    `;
    return;
  }

  const slotsHTML = slotsDisponiveis
    .map((slot, index) => {
      const gestorTexto =
        agendamentoData.exibirGestor && slot.gestorNome
          ? `<span class="slot-gestor">com ${slot.gestorNome}</span>`
          : "";

      return `
        <label class="slot-option">
          <input 
            type="radio" 
            name="slot" 
            value="${index}" 
            data-data="${slot.data}"
            data-hora-inicio="${slot.horaInicio}"
            data-hora-fim="${slot.horaFim}"
            data-gestor-id="${slot.gestorId || ""}"
            data-gestor-nome="${slot.gestorNome || ""}"
          />
          <div class="slot-info">
            <span class="slot-date">${formatarData(slot.data)}</span>
            <span class="slot-time">${slot.horaInicio} - ${slot.horaFim}</span>
            ${gestorTexto}
          </div>
        </label>
      `;
    })
    .join("");

  container.innerHTML = `
  <div class="header">
    <h1>Reunião com Voluntário</h1>
  </div>

  ${voluntarioInfo}
  ${gestorInfo}

  <div class="descricao">
    ${agendamentoData.descricao}
  </div>

  <div class="slots-section">
    <h3>Escolha o melhor horário para você:</h3>
    <div class="slots-grid">
      ${slotsHTML}
    </div>
  </div>

  <form id="form-agendamento">
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

  const data = slotSelecionado.dataset.data;
  const horaInicioSelecionada = slotSelecionado.dataset.horaInicio;
  const horaFimSelecionada = slotSelecionado.dataset.horaFim;
  const gestorNome = slotSelecionado.dataset.gestorNome;

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Confirmando...";

  try {
    // Encontrar o slot correto no array
    const slotIndex = agendamentoData.slots.findIndex(
      (s) =>
        s.data === data &&
        s.horaInicio === horaInicioSelecionada &&
        s.horaFim === horaFimSelecionada
    );

    if (slotIndex === -1) {
      throw new Error("Slot não encontrado.");
    }

    const slot = agendamentoData.slots[slotIndex];

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

    mostrarSucesso(data, horaInicioSelecionada, horaFimSelecionada, gestorNome);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao confirmar agendamento:", error);
    alert("Erro ao confirmar agendamento. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Confirmar Agendamento";
  }
}

function mostrarSucesso(data, horaInicio, horaFim, gestorNome) {
  const container = document.getElementById("main-container");

  const gestorTexto = gestorNome
    ? `<p><strong>Gestor:</strong> ${gestorNome}</p>`
    : "";

  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Agendamento Confirmado!</h2>
      <p><strong>Voluntário:</strong> ${
        usuarioLogado.dadosCompletos?.nome || "Sem nome"
      }</p>
      <p><strong>Data:</strong> ${formatarData(data)}</p>
      <p><strong>Horário:</strong> ${horaInicio} - ${horaFim}</p>
      ${gestorTexto}
      <p style="margin-top: 1.5rem; color: #666;">
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
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  const diaSemana = obterDiaSemana(dataISO);
  return `${diaSemana}, ${dia}/${mes}/${ano}`;
}
