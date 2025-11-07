// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 2.1 - Cada horário com gestor específico

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let gestores = [];

export async function init() {
  console.log("[AGENDAR] Módulo Agendar Reunião iniciado.");
  await carregarGestores();
  renderizarFormularioAgendamento();
}

async function carregarGestores() {
  try {
    const q = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
    const snapshot = await getDocs(q);

    gestores = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        nome: doc.data().nome,
        funcoes: doc.data().funcoes || [],
      }))
      .filter((u) => u.funcoes.includes("gestor"));

    console.log("[AGENDAR] Gestores carregados:", gestores);
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar gestores:", error);
    gestores = [];
  }
}

function renderizarFormularioAgendamento() {
  const container = document.getElementById("agendar-reuniao-container");
  container.innerHTML = `
        <form id="form-agendamento">
            <h3>Agendar Nova Reunião</h3>
            <div class="form-group">
                <label for="tipo-reuniao">Tipo de Reunião</label>
                <select id="tipo-reuniao" class="form-control" required>
                    <option value="" disabled selected>Selecione...</option>
                    <option value="Reunião Técnica">Reunião Técnica</option>
                    <option value="Reunião Conselho administrativo">Reunião Conselho Administrativo</option>
                    <option value="Reunião com Gestor">Reunião com Gestor</option>
                    <option value="Reunião com Voluntário">Reunião com Voluntário</option>
                </select>
            </div>

            <div class="form-row cols-3" id="data-hora-container">
                <div class="form-group">
                    <label for="data-reuniao">Data da Reunião</label>
                    <input type="date" id="data-reuniao" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="hora-inicio">Hora de Início</label>
                    <input type="time" id="hora-inicio" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="hora-fim">Hora de Fim</label>
                    <input type="time" id="hora-fim" class="form-control" required>
                </div>
            </div>

            <div id="campos-dinamicos"></div>

            <div class="button-bar">
                <button type="submit" class="action-button save-btn">Agendar Reunião</button>
            </div>
            <div id="agendamento-feedback" class="status-message" style="margin-top: 15px;"></div>
        </form>
    `;

  document
    .getElementById("tipo-reuniao")
    .addEventListener("change", renderizarCamposDinamicos);
  document
    .getElementById("form-agendamento")
    .addEventListener("submit", salvarAgendamento);
}

function renderizarCamposDinamicos() {
  const tipo = document.getElementById("tipo-reuniao").value;
  const container = document.getElementById("campos-dinamicos");
  const dataHoraContainer = document.getElementById("data-hora-container");

  if (tipo === "Reunião Técnica") {
    dataHoraContainer.style.display = "flex";
    container.innerHTML = `
            <div class="form-group">
                <label for="facilitador">Facilitador do Treinamento</label>
                <input type="text" id="facilitador" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="tema-reuniao">Tema da Reunião</label>
                <textarea id="tema-reuniao" class="form-control" rows="3" required></textarea>
            </div>
        `;
  } else if (
    tipo === "Reunião Conselho administrativo" ||
    tipo === "Reunião com Gestor"
  ) {
    dataHoraContainer.style.display = "flex";
    container.innerHTML = `
            <div class="form-group">
                <label for="pauta-reuniao">Pauta da Reunião</label>
                <textarea id="pauta-reuniao" class="form-control" rows="4" required></textarea>
            </div>
        `;
  } else if (tipo === "Reunião com Voluntário") {
    dataHoraContainer.style.display = "none";

    container.innerHTML = `
            <div class="form-group">
                <label>
                    <input type="checkbox" id="exibir-gestor" checked />
                    Exibir nome do gestor no link de agendamento
                </label>
            </div>

            <div class="form-group">
                <label for="descricao-voluntario">Descrição da Reunião (opcional)</label>
                <textarea id="descricao-voluntario" class="form-control" rows="4" placeholder="Deixe em branco para usar texto padrão"></textarea>
                <small style="color: #666; font-size: 0.9em;">Se deixar em branco, será usado um texto padrão convidativo.</small>
            </div>

            <div class="form-group">
                <label>Datas, Horários e Gestores Disponíveis *</label>
                <div id="slots-container" style="margin-bottom: 1rem;">
                    ${criarSlotHTML()}
                </div>
                <button type="button" id="btn-adicionar-slot" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
            </div>
        `;

    document
      .getElementById("btn-adicionar-slot")
      .addEventListener("click", adicionarSlot);
  } else {
    dataHoraContainer.style.display = "flex";
    container.innerHTML = "";
  }
}

function criarSlotHTML() {
  const gestoresOptions = gestores
    .map((g) => `<option value="${g.id}">${g.nome}</option>`)
    .join("");

  return `
    <div class="slot-item" style="display: grid; grid-template-columns: 1fr 1fr auto 1fr 2fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
      <input type="date" class="slot-data form-control" required />
      <input type="time" class="slot-hora-inicio form-control" required />
      <span>até</span>
      <input type="time" class="slot-hora-fim form-control" required />
      <select class="slot-gestor form-control" required>
        <option value="">Selecione o gestor...</option>
        ${gestoresOptions}
      </select>
      <button type="button" class="btn-remove-slot" style="background: #dc3545; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;" onclick="this.parentElement.remove()">✕</button>
    </div>
  `;
}

function adicionarSlot() {
  const slotsContainer = document.getElementById("slots-container");
  const novoSlot = document.createElement("div");
  novoSlot.innerHTML = criarSlotHTML();
  slotsContainer.appendChild(novoSlot.firstElementChild);
}

async function salvarAgendamento(e) {
  e.preventDefault();

  const tipo = document.getElementById("tipo-reuniao").value;

  if (tipo === "Reunião com Voluntário") {
    await salvarReuniaoVoluntario(e);
  } else {
    await salvarReuniaoTradicional(e);
  }
}

async function salvarReuniaoTradicional(e) {
  const feedbackEl = document.getElementById("agendamento-feedback");
  const saveButton = e.target.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "A agendar...";
  feedbackEl.textContent = "";
  feedbackEl.className = "status-message";

  const tipo = document.getElementById("tipo-reuniao").value;

  const dadosAgendamento = {
    tipo: tipo,
    dataReuniao: document.getElementById("data-reuniao").value,
    horaInicio: document.getElementById("hora-inicio").value,
    horaFim: document.getElementById("hora-fim").value,
    status: "Agendada",
    createdAt: serverTimestamp(),
    pontos: "",
    decisoes: "",
    participantes: "",
    planoDeAcao: [],
    encaminhamentos: [],
    feedbacks: [],
  };

  if (tipo === "Reunião Técnica") {
    dadosAgendamento.responsavelTecnica =
      document.getElementById("facilitador").value;
    dadosAgendamento.pauta = document.getElementById("tema-reuniao").value;
  } else {
    dadosAgendamento.pauta = document.getElementById("pauta-reuniao").value;
  }

  try {
    await addDoc(collection(firestoreDb, "gestao_atas"), dadosAgendamento);
    feedbackEl.textContent = "Reunião agendada com sucesso!";
    feedbackEl.classList.add("alert", "alert-success");
    e.target.reset();
    document.getElementById("campos-dinamicos").innerHTML = "";
  } catch (error) {
    console.error("Erro ao agendar reunião:", error);
    feedbackEl.textContent = "Erro ao agendar a reunião. Tente novamente.";
    feedbackEl.classList.add("alert", "alert-danger");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Agendar Reunião";
    setTimeout(() => (feedbackEl.textContent = ""), 4000);
  }
}

async function salvarReuniaoVoluntario(e) {
  const feedbackEl = document.getElementById("agendamento-feedback");
  const saveButton = e.target.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "A criar agendamento...";
  feedbackEl.textContent = "";
  feedbackEl.className = "status-message";

  const exibirGestor = document.getElementById("exibir-gestor").checked;
  const descricaoCustom = document.getElementById("descricao-voluntario").value;

  const descricaoPadrao = `Olá! Esta é uma reunião de alinhamento com nossa equipe, um momento especial para que possamos dialogar sobre mudanças, compartilhar perspectivas de futuro e, principalmente, ouvir você.

Sua voz é fundamental para construirmos juntos um ambiente melhor. Queremos conhecer suas ideias, ouvir suas sugestões e entender como podemos apoiá-lo(a) ainda mais nessa jornada.

Escolha abaixo o melhor horário para você e vamos conversar!`;

  const slots = [];
  document.querySelectorAll(".slot-item").forEach((slot) => {
    const data = slot.querySelector(".slot-data").value;
    const horaInicio = slot.querySelector(".slot-hora-inicio").value;
    const horaFim = slot.querySelector(".slot-hora-fim").value;
    const gestorId = slot.querySelector(".slot-gestor").value;

    if (data && horaInicio && horaFim && gestorId) {
      const gestor = gestores.find((g) => g.id === gestorId);
      slots.push({
        data,
        horaInicio,
        horaFim,
        gestorId,
        gestorNome: gestor?.nome || "",
        vagas: [],
      });
    }
  });

  if (slots.length === 0) {
    feedbackEl.textContent = "Adicione pelo menos uma data, horário e gestor.";
    feedbackEl.classList.add("alert", "alert-danger");
    saveButton.disabled = false;
    saveButton.textContent = "Agendar Reunião";
    return;
  }

  const data = {
    tipo: "Reunião com Voluntário",
    exibirGestor,
    descricao: descricaoCustom || descricaoPadrao,
    slots,
    criadoEm: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(
      collection(firestoreDb, "agendamentos_voluntarios"),
      data
    );

    const linkAgendamento = `${window.location.origin}/agendamento-voluntario.html?agendamentoId=${docRef.id}`;

    feedbackEl.innerHTML = `
      <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 4px; margin-top: 1rem;">
        <strong>✓ Reunião com Voluntário criada com sucesso!</strong>
        <p style="margin: 0.5rem 0;"><strong>Link de Inscrição:</strong></p>
        <input type="text" value="${linkAgendamento}" readonly onclick="this.select()" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;" />
        <button onclick="navigator.clipboard.writeText('${linkAgendamento}'); alert('Link copiado!')" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
          Copiar Link
        </button>
      </div>
    `;

    e.target.reset();
    document.getElementById("campos-dinamicos").innerHTML = "";
  } catch (error) {
    console.error("[AGENDAR] Erro ao criar reunião com voluntário:", error);
    feedbackEl.textContent = "Erro ao criar agendamento. Tente novamente.";
    feedbackEl.classList.add("alert", "alert-danger");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Agendar Reunião";
  }
}
