// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 2.0 - Adicionada Reunião com Voluntário

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
        cargo: doc.data().cargo,
      }))
      .filter((u) => u.cargo && u.cargo.toLowerCase().includes("gestor"));
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar gestores:", error);
    gestores = [];
  }
}

function renderizarFormularioAgendamento() {
  const container = document.getElementById("agendar-reuniao-container");
  container.innerHTML = `
    <div class="form-container">
      <h2>Agendar Nova Reunião</h2>
      <form id="form-agendamento">
        <div class="form-group">
          <label for="tipo-reuniao">Tipo de Reunião *</label>
          <select id="tipo-reuniao" required>
            <option value="">Selecione...</option>
            <option value="Reunião Técnica">Reunião Técnica</option>
            <option value="Reunião com Voluntário">Reunião com Voluntário</option>
          </select>
        </div>

        <div id="campos-dinamicos"></div>

        <button type="submit" class="btn-primary">Criar Agendamento</button>
      </form>
    </div>
    <div id="link-gerado-container"></div>
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
        <label for="data-reuniao">Data da Reunião *</label>
        <input type="date" id="data-reuniao" required />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="hora-inicio">Hora de Início *</label>
          <input type="time" id="hora-inicio" required />
        </div>
        <div class="form-group">
          <label for="hora-fim">Hora de Fim *</label>
          <input type="time" id="hora-fim" required />
        </div>
      </div>

      <div class="form-group">
        <label for="tema">Tema *</label>
        <input type="text" id="tema" placeholder="Digite o tema da reunião" required />
      </div>

      <div class="form-group">
        <label for="descricao">Descrição</label>
        <textarea id="descricao" rows="4" placeholder="Detalhes adicionais (opcional)"></textarea>
      </div>
    `;
  } else if (tipo === "Reunião com Voluntário") {
    const gestoresOptions = gestores
      .map((g) => `<option value="${g.id}">${g.nome}</option>`)
      .join("");

    container.innerHTML = `
      <div class="form-group">
        <label for="gestor-responsavel">Gestor Responsável *</label>
        <select id="gestor-responsavel" required>
          <option value="">Selecione o gestor...</option>
          ${gestoresOptions}
        </select>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="exibir-gestor" checked />
          Exibir nome do gestor no link de agendamento
        </label>
      </div>

      <div class="form-group">
        <label for="descricao-voluntario">Descrição da Reunião (opcional)</label>
        <textarea id="descricao-voluntario" rows="4" placeholder="Deixe em branco para usar texto padrão"></textarea>
      </div>

      <div class="form-group">
        <label>Datas e Horários Disponíveis *</label>
        <div id="slots-container">
          <div class="slot-item">
            <input type="date" class="slot-data" required />
            <input type="time" class="slot-hora-inicio" required />
            <span class="slot-separator">até</span>
            <input type="time" class="slot-hora-fim" required />
            <button type="button" class="btn-remove-slot" onclick="this.parentElement.remove()">✕</button>
          </div>
        </div>
        <button type="button" id="btn-adicionar-slot" class="btn-secondary">+ Adicionar Horário</button>
      </div>
    `;

    document
      .getElementById("btn-adicionar-slot")
      .addEventListener("click", adicionarSlot);
  } else {
    container.innerHTML = "";
  }
}

function adicionarSlot() {
  const slotsContainer = document.getElementById("slots-container");
  const novoSlot = document.createElement("div");
  novoSlot.className = "slot-item";
  novoSlot.innerHTML = `
    <input type="date" class="slot-data" required />
    <input type="time" class="slot-hora-inicio" required />
    <span class="slot-separator">até</span>
    <input type="time" class="slot-hora-fim" required />
    <button type="button" class="btn-remove-slot" onclick="this.parentElement.remove()">✕</button>
  `;
  slotsContainer.appendChild(novoSlot);
}

async function salvarAgendamento(e) {
  e.preventDefault();

  const tipo = document.getElementById("tipo-reuniao").value;

  if (tipo === "Reunião Técnica") {
    await salvarReuniaoTecnica();
  } else if (tipo === "Reunião com Voluntário") {
    await salvarReuniaoVoluntario();
  }
}

async function salvarReuniaoTecnica() {
  const data = {
    tipo: "Reunião Técnica",
    dataReuniao: document.getElementById("data-reuniao").value,
    horaInicio: document.getElementById("hora-inicio").value,
    horaFim: document.getElementById("hora-fim").value,
    tema: document.getElementById("tema").value,
    descricao: document.getElementById("descricao").value || "",
    criadoEm: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(firestoreDb, "gestao_atas"), data);
    const linkFeedback = `${window.location.origin}/feedback.html?ataId=${docRef.id}`;

    document.getElementById("link-gerado-container").innerHTML = `
      <div class="success-message">
        <h3>✓ Reunião Técnica agendada com sucesso!</h3>
        <p><strong>Link para Feedback:</strong></p>
        <input type="text" value="${linkFeedback}" readonly onclick="this.select()" />
        <button onclick="navigator.clipboard.writeText('${linkFeedback}'); alert('Link copiado!')">
          Copiar Link
        </button>
      </div>
    `;

    document.getElementById("form-agendamento").reset();
    document.getElementById("campos-dinamicos").innerHTML = "";
  } catch (error) {
    console.error("[AGENDAR] Erro ao salvar reunião técnica:", error);
    alert("Erro ao agendar reunião. Tente novamente.");
  }
}

async function salvarReuniaoVoluntario() {
  const gestorId = document.getElementById("gestor-responsavel").value;
  const gestorNome = gestores.find((g) => g.id === gestorId)?.nome || "";
  const exibirGestor = document.getElementById("exibir-gestor").checked;
  const descricaoCustom = document.getElementById("descricao-voluntario").value;

  const descricaoPadrao = `
    Olá! Esta é uma reunião de alinhamento com nossa equipe, um momento especial para que possamos dialogar sobre mudanças, compartilhar perspectivas de futuro e, principalmente, ouvir você.
    
    Sua voz é fundamental para construirmos juntos um ambiente melhor. Queremos conhecer suas ideias, ouvir suas sugestões e entender como podemos apoiá-lo(a) ainda mais nessa jornada.
    
    Escolha abaixo o melhor horário para você e vamos conversar!
  `;

  const slots = [];
  document.querySelectorAll(".slot-item").forEach((slot) => {
    const data = slot.querySelector(".slot-data").value;
    const horaInicio = slot.querySelector(".slot-hora-inicio").value;
    const horaFim = slot.querySelector(".slot-hora-fim").value;

    if (data && horaInicio && horaFim) {
      slots.push({ data, horaInicio, horaFim, vagas: [] });
    }
  });

  if (slots.length === 0) {
    alert("Adicione pelo menos uma data e horário.");
    return;
  }

  const data = {
    tipo: "Reunião com Voluntário",
    gestorId,
    gestorNome,
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
    const linkAgendamento = `${window.location.origin}/agendar-voluntario.html?agendamentoId=${docRef.id}`;

    document.getElementById("link-gerado-container").innerHTML = `
      <div class="success-message">
        <h3>✓ Reunião com Voluntário criada com sucesso!</h3>
        <p><strong>Link de Inscrição:</strong></p>
        <input type="text" value="${linkAgendamento}" readonly onclick="this.select()" />
        <button onclick="navigator.clipboard.writeText('${linkAgendamento}'); alert('Link copiado!')">
          Copiar Link
        </button>
      </div>
    `;

    document.getElementById("form-agendamento").reset();
    document.getElementById("campos-dinamicos").innerHTML = "";
  } catch (error) {
    console.error("[AGENDAR] Erro ao salvar reunião com voluntário:", error);
    alert("Erro ao criar agendamento. Tente novamente.");
  }
}
