// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 1.2 (CORRIGIDO - Reintroduz a Reunião Técnica no agendamento)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

export function init() {
  console.log("[AGENDAR] Módulo Agendar Reunião iniciado.");
  renderizarFormularioAgendamento();
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
                </select>
            </div>

            <div class="form-row cols-3">
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

  if (tipo === "Reunião Técnica") {
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
    container.innerHTML = `
            <div class="form-group">
                <label for="pauta-reuniao">Pauta da Reunião</label>
                <textarea id="pauta-reuniao" class="form-control" rows="4" required></textarea>
            </div>
        `;
  } else {
    container.innerHTML = "";
  }
}

async function salvarAgendamento(e) {
  e.preventDefault();
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
    // Inicializa campos que serão preenchidos depois para consistência
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
