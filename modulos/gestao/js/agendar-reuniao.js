// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 3.1 - Com ordenação por gestor e exportação para Excel

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

let gestores = [];
let agendamentosExistentes = [];

export async function init() {
  console.log("[AGENDAR] Módulo Agendar Reunião iniciado.");
  await carregarGestores();
  renderizarFormularioAgendamento();

  // Event listeners globais
  document.addEventListener("click", async (e) => {
    if (e.target.id === "btn-gerenciar-agendamentos") {
      await renderizarGerenciarAgendamentos();
    }
    if (e.target.id === "btn-voltar-criar") {
      renderizarFormularioAgendamento();
    }
    if (e.target.classList.contains("btn-editar-agendamento")) {
      const agendamentoId = e.target.dataset.agendamentoId;
      await renderizarEditarAgendamento(agendamentoId);
    }
    if (e.target.classList.contains("btn-copiar-link")) {
      const link = e.target.dataset.link;
      navigator.clipboard.writeText(link);
      alert("Link copiado para a área de transferência!");
    }
    if (e.target.classList.contains("btn-exportar-excel")) {
      const agendamentoId = e.target.dataset.agendamentoId;
      exportarParaExcel(agendamentoId);
    }
  });
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

async function carregarAgendamentosExistentes() {
  try {
    const q = query(
      collection(firestoreDb, "agendamentos_voluntarios"),
      orderBy("criadoEm", "desc")
    );
    const snapshot = await getDocs(q);

    agendamentosExistentes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("[AGENDAR] Agendamentos carregados:", agendamentosExistentes);
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar agendamentos:", error);
    agendamentosExistentes = [];
  }
}

function renderizarFormularioAgendamento() {
  const container = document.getElementById("agendar-reuniao-container");
  container.innerHTML = `
        <!-- Botão para gerenciar agendamentos -->
        <div class="button-bar" style="margin-bottom: 1.5rem;">
            <button type="button" id="btn-gerenciar-agendamentos" class="action-button" style="background: #6c757d;">
                📋 Gerenciar Agendamentos Existentes
            </button>
        </div>

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

async function renderizarGerenciarAgendamentos() {
  await carregarAgendamentosExistentes();

  const container = document.getElementById("agendar-reuniao-container");

  if (agendamentosExistentes.length === 0) {
    container.innerHTML = `
      <div class="button-bar" style="margin-bottom: 1.5rem;">
        <button type="button" id="btn-voltar-criar" class="action-button" style="background: #6c757d;">
          ← Voltar para Criar Novo
        </button>
      </div>
      <div class="empty-state">
        <p>Nenhum agendamento de reunião com voluntário foi criado ainda.</p>
      </div>
    `;
    return;
  }

  const agendamentosHTML = agendamentosExistentes
    .map((agendamento) => {
      // ✅ Ordena slots por nome do gestor, depois por data e hora
      const slotsOrdenados = [...agendamento.slots].sort((a, b) => {
        // Primeiro ordena por nome do gestor (alfabética)
        const nomeA = (a.gestorNome || "").toLowerCase();
        const nomeB = (b.gestorNome || "").toLowerCase();
        if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);

        // Se os gestores forem iguais, ordena por data
        if (a.data !== b.data) return a.data.localeCompare(b.data);

        // Se as datas forem iguais, ordena por horário
        return a.horaInicio.localeCompare(b.horaInicio);
      });

      const linkAgendamento = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${agendamento.id}`;

      const slotsListaHTML = slotsOrdenados
        .map((slot) => {
          const vagasPreenchidas = slot.vagas?.length || 0;
          const statusVaga =
            vagasPreenchidas > 0
              ? `<span style="color: #28a745;">✓ Preenchido</span>`
              : `<span style="color: #6c757d;">Disponível</span>`;

          return `
        <tr>
          <td>${slot.gestorNome || "Não especificado"}</td>
          <td>${formatarDataCompleta(slot.data)}</td>
          <td>${slot.horaInicio}</td>
          <td>${slot.horaFim}</td>
          <td>${statusVaga}</td>
        </tr>
      `;
        })
        .join("");

      return `
      <div class="agendamento-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
          <div>
            <h4 style="margin: 0 0 0.5rem 0;">Reunião com Voluntário</h4>
            <small style="color: #666;">Criado em: ${formatarDataCriacao(
              agendamento.criadoEm
            )}</small>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-exportar-excel action-button" data-agendamento-id="${
              agendamento.id
            }" style="background: #28a745; padding: 0.5rem 1rem;">
              📊 Exportar Excel
            </button>
            <button class="btn-copiar-link action-button" data-link="${linkAgendamento}" style="background: #17a2b8; padding: 0.5rem 1rem;">
              📋 Copiar Link
            </button>
            <button class="btn-editar-agendamento action-button" data-agendamento-id="${
              agendamento.id
            }" style="background: #ffc107; padding: 0.5rem 1rem;">
              ✏️ Editar
            </button>
          </div>
        </div>
        
        <table class="table" style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
          <thead>
            <tr style="background: #f8f9fa; text-align: left;">
              <th style="padding: 0.75rem; border: 1px solid #ddd;">Gestor</th>
              <th style="padding: 0.75rem; border: 1px solid #ddd;">Data</th>
              <th style="padding: 0.75rem; border: 1px solid #ddd;">Início</th>
              <th style="padding: 0.75rem; border: 1px solid #ddd;">Fim</th>
              <th style="padding: 0.75rem; border: 1px solid #ddd;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${slotsListaHTML}
          </tbody>
        </table>
        
        <div style="margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 4px;">
          <strong>Link de Agendamento:</strong>
          <input type="text" value="${linkAgendamento}" readonly onclick="this.select()" style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" />
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="button-bar" style="margin-bottom: 1.5rem;">
      <button type="button" id="btn-voltar-criar" class="action-button" style="background: #6c757d;">
        ← Voltar para Criar Novo
      </button>
    </div>
    
    <h3 style="margin-bottom: 1.5rem;">Agendamentos Existentes</h3>
    
    ${agendamentosHTML}
  `;
}

async function renderizarEditarAgendamento(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );

  if (!agendamento) {
    alert("Agendamento não encontrado.");
    return;
  }

  const container = document.getElementById("agendar-reuniao-container");

  const gestoresOptions = gestores
    .map((g) => `<option value="${g.id}">${g.nome}</option>`)
    .join("");

  // Slots existentes ordenados
  const slotsOrdenados = [...agendamento.slots].sort((a, b) => {
    const nomeA = (a.gestorNome || "").toLowerCase();
    const nomeB = (b.gestorNome || "").toLowerCase();
    if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  const slotsExistentesHTML = slotsOrdenados
    .map((slot, index) => {
      const vagasInfo =
        slot.vagas && slot.vagas.length > 0
          ? `<small style="color: #28a745;">(${slot.vagas.length} inscrito(s))</small>`
          : "";

      return `
      <div class="slot-existente" style="display: grid; grid-template-columns: 1fr 1fr auto 1fr 2fr; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; padding: 0.75rem; background: #f8f9fa; border-radius: 4px;">
        <input type="date" value="${slot.data}" readonly class="form-control" style="background: #e9ecef;" />
        <input type="time" value="${slot.horaInicio}" readonly class="form-control" style="background: #e9ecef;" />
        <span>até</span>
        <input type="time" value="${slot.horaFim}" readonly class="form-control" style="background: #e9ecef;" />
        <div>
          <strong>${slot.gestorNome}</strong> ${vagasInfo}
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="button-bar" style="margin-bottom: 1.5rem;">
      <button type="button" id="btn-gerenciar-agendamentos" class="action-button" style="background: #6c757d;">
        ← Voltar para Lista
      </button>
    </div>
    
    <h3>Editar Agendamento</h3>
    
    <div style="background: #fff3cd; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; border-left: 4px solid #ffc107;">
      <strong>📌 Horários existentes:</strong>
      <div style="margin-top: 1rem;">
        ${slotsExistentesHTML}
      </div>
    </div>
    
    <form id="form-editar-agendamento">
      <h4>Adicionar Novos Horários</h4>
      
      <div class="form-group">
        <label>Datas, Horários e Gestores Disponíveis</label>
        <small style="display: block; color: #666; margin-bottom: 0.5rem;">
          O horário será dividido automaticamente em slots de 30 minutos.
        </small>
        <div id="novos-slots-container" style="margin-bottom: 1rem;">
          ${criarSlotHTML()}
        </div>
        <button type="button" id="btn-adicionar-slot" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
      </div>
      
      <div class="button-bar" style="margin-top: 1.5rem;">
        <button type="submit" class="action-button save-btn">Salvar Novos Horários</button>
      </div>
      <div id="edit-feedback" class="status-message" style="margin-top: 15px;"></div>
    </form>
  `;

  document
    .getElementById("btn-adicionar-slot")
    .addEventListener("click", () => {
      const container = document.getElementById("novos-slots-container");
      const novoSlot = document.createElement("div");
      novoSlot.innerHTML = criarSlotHTML();
      container.appendChild(novoSlot.firstElementChild);
    });

  document
    .getElementById("form-editar-agendamento")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await salvarNovosSlots(agendamentoId, agendamento);
    });
}

async function salvarNovosSlots(agendamentoId, agendamento) {
  const feedbackEl = document.getElementById("edit-feedback");
  const saveButton = document.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";
  feedbackEl.textContent = "";
  feedbackEl.className = "status-message";

  let novosSlots = [];

  document
    .querySelectorAll("#novos-slots-container .slot-item")
    .forEach((slotItem) => {
      const dataSlot = slotItem.querySelector(".slot-data").value;
      const horaInicioSlot = slotItem.querySelector(".slot-hora-inicio").value;
      const horaFimSlot = slotItem.querySelector(".slot-hora-fim").value;
      const gestorIdSlot = slotItem.querySelector(".slot-gestor").value;

      if (dataSlot && horaInicioSlot && horaFimSlot && gestorIdSlot) {
        const gestor = gestores.find((g) => g.id === gestorIdSlot);

        const slotsGerados = gerarSlotsAutomaticos(
          dataSlot,
          horaInicioSlot,
          horaFimSlot,
          gestorIdSlot,
          gestor?.nome || ""
        );

        novosSlots = novosSlots.concat(slotsGerados);
      }
    });

  if (novosSlots.length === 0) {
    feedbackEl.textContent = "Adicione pelo menos um novo horário.";
    feedbackEl.classList.add("alert", "alert-danger");
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Novos Horários";
    return;
  }

  try {
    // Combina slots antigos com novos
    const slotsAtualizados = [...agendamento.slots, ...novosSlots];

    await updateDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
      {
        slots: slotsAtualizados,
      }
    );

    feedbackEl.innerHTML = `
      <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 4px;">
        <strong>✓ ${novosSlots.length} novos horários adicionados com sucesso!</strong>
      </div>
    `;

    setTimeout(() => {
      renderizarGerenciarAgendamentos();
    }, 2000);
  } catch (error) {
    console.error("[AGENDAR] Erro ao atualizar agendamento:", error);
    feedbackEl.textContent = "Erro ao salvar. Tente novamente.";
    feedbackEl.classList.add("alert", "alert-danger");
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Novos Horários";
  }
}

// ✅ NOVA FUNÇÃO: Exportar para Excel
function exportarParaExcel(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );

  if (!agendamento) {
    alert("Agendamento não encontrado.");
    return;
  }

  // Ordena slots por gestor, data e hora
  const slotsOrdenados = [...agendamento.slots].sort((a, b) => {
    const nomeA = (a.gestorNome || "").toLowerCase();
    const nomeB = (b.gestorNome || "").toLowerCase();
    if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  // Cria os dados da planilha
  let csv = "Gestor,Data,Dia da Semana,Hora Início,Hora Fim,Status\n";

  slotsOrdenados.forEach((slot) => {
    const vagasPreenchidas = slot.vagas?.length || 0;
    const status = vagasPreenchidas > 0 ? "Preenchido" : "Disponível";
    const dataFormatada = formatarDataCompleta(slot.data);

    csv += `"${slot.gestorNome || "Não especificado"}","${
      slot.data
    }","${dataFormatada}","${slot.horaInicio}","${slot.horaFim}","${status}"\n`;
  });

  // Cria o arquivo para download
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const dataAtual = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `agendamento_voluntarios_${dataAtual}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderizarCamposDinamicos() {
  const tipo = document.getElementById("tipo-reuniao").value;
  const container = document.getElementById("campos-dinamicos");
  const dataHoraContainer = document.getElementById("data-hora-container");

  const dataInput = document.getElementById("data-reuniao");
  const horaInicioInput = document.getElementById("hora-inicio");
  const horaFimInput = document.getElementById("hora-fim");

  if (tipo === "Reunião Técnica") {
    dataHoraContainer.style.display = "flex";
    dataInput.required = true;
    horaInicioInput.required = true;
    horaFimInput.required = true;

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
    dataInput.required = true;
    horaInicioInput.required = true;
    horaFimInput.required = true;

    container.innerHTML = `
            <div class="form-group">
                <label for="pauta-reuniao">Pauta da Reunião</label>
                <textarea id="pauta-reuniao" class="form-control" rows="4" required></textarea>
            </div>
        `;
  } else if (tipo === "Reunião com Voluntário") {
    dataHoraContainer.style.display = "none";
    dataInput.required = false;
    horaInicioInput.required = false;
    horaFimInput.required = false;

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
                <small style="display: block; color: #666; margin-bottom: 0.5rem;">
                    O horário será dividido automaticamente em slots de 30 minutos.
                </small>
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
    dataInput.required = true;
    horaInicioInput.required = true;
    horaFimInput.required = true;
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

function gerarSlotsAutomaticos(
  data,
  horaInicioStr,
  horaFimStr,
  gestorId,
  gestorNome
) {
  const slots = [];
  const INTERVALO_MINUTOS = 30;

  const [horaIni, minIni] = horaInicioStr.split(":").map(Number);
  const [hrFim, minFim] = horaFimStr.split(":").map(Number);

  let minutoAtual = horaIni * 60 + minIni;
  const minutoFinal = hrFim * 60 + minFim;

  while (minutoAtual < minutoFinal) {
    const minutoProximo = Math.min(
      minutoAtual + INTERVALO_MINUTOS,
      minutoFinal
    );

    const horaInicioSlot = `${String(Math.floor(minutoAtual / 60)).padStart(
      2,
      "0"
    )}:${String(minutoAtual % 60).padStart(2, "0")}`;
    const horaFimSlot = `${String(Math.floor(minutoProximo / 60)).padStart(
      2,
      "0"
    )}:${String(minutoProximo % 60).padStart(2, "0")}`;

    slots.push({
      data,
      horaInicio: horaInicioSlot,
      horaFim: horaFimSlot,
      gestorId,
      gestorNome,
      vagas: [],
    });

    minutoAtual = minutoProximo;
  }

  return slots;
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

  const descricaoPadrao = `
<p><strong>✨ Gestão EuPsico: Alinhando Processos, Otimizando a Prática Profissional</strong></p>
<p>Em nome de toda a equipe da <strong>EuPsico</strong>, expressamos nossa sincera gratidão pela sua dedicação e pelo impacto valioso do seu trabalho. Você é parte essencial da nossa missão, e é com profundo respeito que convidamos você para um momento exclusivo de escuta e diálogo, pensado especialmente para você.</p>
<p><strong>🤝 Nosso Propósito: Ouvir, Valorizar e Evoluir Juntos</strong></p>
Mais do que uma conversa sobre os próximos passos da EuPsico, este encontro é uma oportunidade para fortalecer nossa parceria, alinhando expectativas, ideias e caminhos de crescimento mútuo. Criamos esse espaço para:
<ul>
  <li><strong>Valorizar sua voz</strong>: Conhecer suas vivências, desafios e ideias que podem transformar nosso ambiente de voluntariado.</li>
  <li><strong>Construir em conjunto</strong>: Compartilhar perspectivas sobre as próximas etapas e como elas se conectam ao seu desenvolvimento pessoal e profissional.</li>
  <li><strong>Fortalecer seu caminho</strong>: Identificar formas de apoio mais eficazes da gestão para sua jornada conosco.</li>
</ul>
<p><strong>🗓️ Agende o Melhor Momento para Você</strong></p>
<p>Sua visão é única e indispensável para a evolução da nossa comunidade.</p>
<p>Para que esse encontro seja leve e conveniente, pedimos que selecione abaixo o horário que melhor se encaixa na sua rotina.<p> <strong><em>Observação: O link exclusivo para nossa reunião online será enviado via WhatsApp no dia agendado, pelo Gestor Responsável.</em></strong>
<p>Será um prazer conduzir esta conversa construtiva com você.</p>
<p><strong>Com apreço,<br>Gestão EuPsico</strong></p>
`;

  let slots = [];

  document
    .querySelectorAll("#slots-container .slot-item")
    .forEach((slotItem) => {
      const dataSlot = slotItem.querySelector(".slot-data").value;
      const horaInicioSlot = slotItem.querySelector(".slot-hora-inicio").value;
      const horaFimSlot = slotItem.querySelector(".slot-hora-fim").value;
      const gestorIdSlot = slotItem.querySelector(".slot-gestor").value;

      if (dataSlot && horaInicioSlot && horaFimSlot && gestorIdSlot) {
        const gestor = gestores.find((g) => g.id === gestorIdSlot);

        const slotsGerados = gerarSlotsAutomaticos(
          dataSlot,
          horaInicioSlot,
          horaFimSlot,
          gestorIdSlot,
          gestor?.nome || ""
        );

        slots = slots.concat(slotsGerados);
      }
    });

  if (slots.length === 0) {
    feedbackEl.textContent = "Adicione pelo menos uma data, horário e gestor.";
    feedbackEl.classList.add("alert", "alert-danger");
    saveButton.disabled = false;
    saveButton.textContent = "Agendar Reunião";
    return;
  }

  const dataAgendamento = {
    tipo: "Reunião com Voluntário",
    exibirGestor,
    descricao: descricaoCustom || descricaoPadrao,
    slots,
    criadoEm: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(
      collection(firestoreDb, "agendamentos_voluntarios"),
      dataAgendamento
    );

    const linkAgendamento = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${docRef.id}`;

    feedbackEl.innerHTML = `
      <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 4px; margin-top: 1rem;">
        <strong>✓ Reunião com Voluntário criada com sucesso!</strong>
        <p style="margin: 0.5rem 0;">Foram criados <strong>${slots.length} horários</strong> disponíveis de 30 minutos cada.</p>
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

// Funções auxiliares de formatação

function formatarDataCompleta(dataISO) {
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  const data = new Date(ano, mes - 1, dia);
  const diasSemana = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  return `${diasSemana[data.getDay()]}, ${dia}/${mes}/${ano}`;
}

function formatarDataCriacao(timestamp) {
  if (!timestamp) return "Data não informada";
  if (timestamp.toDate) {
    const data = timestamp.toDate();
    return data.toLocaleString("pt-BR");
  }
  return "Data não informada";
}
