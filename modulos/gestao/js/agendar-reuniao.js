// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 5.2 (Correção de Erro + Lista Completa de Tipos)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

let gestores = [];
let agendamentosExistentes = [];
let editandoId = null;

export async function init() {
  console.log("[AGENDAR] Iniciando módulo...");

  // Verificação de segurança para o erro "null"
  const container = document.getElementById("agendar-reuniao-container");
  if (!container) {
    console.error(
      "[ERRO CRÍTICO] Elemento <div id='agendar-reuniao-container'> não encontrado no HTML."
    );
    return;
  }

  await carregarGestores();
  renderizarFormularioAgendamento();
  configurarListenersGlobais();
}

function configurarListenersGlobais() {
  // Evita adicionar listeners duplicados se o init for chamado mais de uma vez
  if (window.agendarListenersAtivos) return;
  window.agendarListenersAtivos = true;

  document.addEventListener("click", async (e) => {
    // Gerenciar/Listar
    if (e.target.id === "btn-gerenciar-agendamentos") {
      await renderizarGerenciarAgendamentos();
    }

    // Voltar para Criar/Lista
    if (
      e.target.id === "btn-voltar-criar" ||
      e.target.id === "btn-cancelar-edicao"
    ) {
      editandoId = null;
      renderizarFormularioAgendamento();
    }

    // Editar
    if (e.target.closest(".btn-editar-agendamento")) {
      const btn = e.target.closest(".btn-editar-agendamento");
      const id = btn.dataset.agendamentoId;
      await renderizarEditarAgendamento(id);
    }

    // Copiar Link
    if (e.target.closest(".btn-copiar-link")) {
      const btn = e.target.closest(".btn-copiar-link");
      const link = btn.dataset.link;
      navigator.clipboard.writeText(link);
      alert("Link copiado!");
    }

    // Exportar Excel
    if (e.target.closest(".btn-exportar-excel")) {
      const btn = e.target.closest(".btn-exportar-excel");
      const id = btn.dataset.agendamentoId;
      exportarParaExcel(id);
    }

    // Adicionar Slot (Edição)
    if (e.target.id === "btn-adicionar-slot-edit") {
      const container = document.getElementById("novos-slots-container");
      const novoSlot = document.createElement("div");
      novoSlot.innerHTML = criarSlotHTML();
      container.appendChild(novoSlot.firstElementChild);
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
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar gestores:", error);
    gestores = [];
  }
}

async function carregarAgendamentosExistentes() {
  try {
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );
    const snapshot = await getDocs(q);

    agendamentosExistentes = snapshot.docs.map((doc) => {
      const data = doc.data();
      const primeiraData =
        data.slots && data.slots.length > 0
          ? data.slots[0].data
          : data.criadoEm?.toDate().toISOString().split("T")[0];
      return { id: doc.id, ...data, dataOrdenacao: primeiraData };
    });

    agendamentosExistentes.sort(
      (a, b) => new Date(b.dataOrdenacao) - new Date(a.dataOrdenacao)
    );
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar agendamentos:", error);
    agendamentosExistentes = [];
  }
}

// =================================================================================
// TELA 1: FORMULÁRIO DE CRIAÇÃO
// =================================================================================

function renderizarFormularioAgendamento() {
  const container = document.getElementById("agendar-reuniao-container");
  if (!container) return; // Segurança extra

  container.innerHTML = `
        <div class="button-bar" style="margin-bottom: 1.5rem;">
            <button type="button" id="btn-gerenciar-agendamentos" class="action-button" style="background: #6c757d;">
                📋 Gerenciar Agendamentos Existentes
            </button>
        </div>

        <form id="form-agendamento">
            <h3 id="titulo-form">Agendar Nova Reunião</h3>
            
            <div class="form-group">
                <label for="tipo-reuniao">Tipo de Reunião</label>
                <select id="tipo-reuniao" class="form-control" required>
                    <option value="" disabled selected>Selecione...</option>
                    <option value="Reunião Técnica">Reunião Técnica</option>
                    <option value="Reunião Conselho administrativo">Reunião Conselho Administrativo</option>
                    <option value="Alinhamento">Alinhamento</option>
                    <option value="Reunião com Gestor">Reunião com Gestor</option>
                    <option value="Reunião com Voluntário">Reunião com Voluntário</option>
                    <option value="Treinamento">Treinamento / Workshop</option>
                </select>
            </div>

            <div id="container-capacidade" class="form-group" style="display: none; background: #e3f2fd; padding: 15px; border-radius: 8px; border: 1px solid #bbdefb; margin-bottom: 20px;">
                <label for="capacidade-maxima" style="color: #0d47a1; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">group</span>
                    Limite de Inscrições (Vagas)
                </label>
                <input type="number" id="capacidade-maxima" class="form-control" placeholder="Ex: 20" min="1">
                <small style="color: #555; display: block; margin-top: 5px;">
                    Defina quantas pessoas podem se inscrever no total. Deixe em branco para ilimitado.
                </small>
            </div>
            
            <div class="form-group">
                <label for="descricao-custom">Texto da Página de Inscrição</label>
                <textarea id="descricao-custom" class="form-control" rows="4" placeholder="Texto que aparecerá na página pública. Se vazio, usará o padrão."></textarea>
            </div>

            <div class="form-group" id="container-exibir-gestor" style="background: #f8f9fa; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6;">
                <label style="cursor: pointer; display: flex; align-items: center; margin: 0;">
                    <input type="checkbox" id="exibir-gestor" checked style="width: 18px; height: 18px; margin-right: 10px;" />
                    <span>Exibir nome do gestor na página de inscrição</span>
                </label>
            </div>

            <div class="form-group">
                <label>Datas e Horários Disponíveis *</label>
                <small style="display: block; color: #666; margin-bottom: 0.5rem;" id="hint-slots">
                    Adicione os horários disponíveis.
                </small>
                <div id="slots-container" style="margin-bottom: 1rem;">
                    ${criarSlotHTML()}
                </div>
                <button type="button" id="btn-adicionar-slot" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
            </div>

            <div class="button-bar">
                <button type="submit" id="btn-submit-agendamento" class="action-button save-btn">Criar Agendamento</button>
            </div>
            <div id="agendamento-feedback" class="status-message" style="margin-top: 15px;"></div>
        </form>
  `;

  document
    .getElementById("btn-adicionar-slot")
    .addEventListener("click", adicionarSlot);
  document
    .getElementById("form-agendamento")
    .addEventListener("submit", salvarAgendamento);

  // Controle visual dinâmico (Tipo de Reunião)
  document.getElementById("tipo-reuniao").addEventListener("change", (e) => {
    const tipo = e.target.value;
    const hintSlots = document.getElementById("hint-slots");
    const txtArea = document.getElementById("descricao-custom");
    const containerCapacidade = document.getElementById("container-capacidade");
    const inputCapacidade = document.getElementById("capacidade-maxima");

    // Texto Padrão
    txtArea.value = getDescricaoPadrao(tipo);

    // Lógica Treinamento
    if (tipo === "Treinamento") {
      containerCapacidade.style.display = "block";
      inputCapacidade.focus();
      hintSlots.textContent =
        "Defina os dias/horários do treinamento. O limite de vagas será aplicado ao evento.";
    } else {
      containerCapacidade.style.display = "none";
      inputCapacidade.value = "";
    }

    // Lógica Voluntário/Alinhamento
    if (tipo === "Reunião com Voluntário" || tipo === "Alinhamento") {
      hintSlots.textContent =
        "Para reuniões individuais (Alinhamento/Voluntário), cada slot aceitará apenas 1 inscrição.";
    } else if (tipo !== "Treinamento") {
      hintSlots.textContent =
        "Múltiplas pessoas podem se inscrever no mesmo horário (Vagas Ilimitadas).";
    }
  });
}

function criarSlotHTML() {
  const gestoresOptions = gestores
    .map((g) => `<option value="${g.id}">${g.nome}</option>`)
    .join("");
  return `
    <div class="slot-item" style="display: grid; grid-template-columns: 1fr 1fr auto 1fr 2fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6;">
      <div><small>Data</small><input type="date" class="slot-data form-control" required /></div>
      <div><small>Início</small><input type="time" class="slot-hora-inicio form-control" required /></div>
      <div style="padding-top: 18px;">até</div>
      <div><small>Fim</small><input type="time" class="slot-hora-fim form-control" required /></div>
      <div>
        <small>Responsável</small>
        <select class="slot-gestor form-control" required>
            <option value="">Selecione...</option>${gestoresOptions}
        </select>
      </div>
      <div style="padding-top: 18px;">
        <button type="button" class="btn-remove-slot" style="background: #dc3545; color: white; border: none; padding: 0.5rem; border-radius: 4px;" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    </div>`;
}

function adicionarSlot() {
  const slotsContainer = document.getElementById("slots-container");
  const novoSlot = document.createElement("div");
  novoSlot.innerHTML = criarSlotHTML();
  slotsContainer.appendChild(novoSlot.firstElementChild);
}

// =================================================================================
// TELA 2: LISTA DE AGENDAMENTOS
// =================================================================================

async function renderizarGerenciarAgendamentos() {
  await carregarAgendamentosExistentes();
  const container = document.getElementById("agendar-reuniao-container");

  if (agendamentosExistentes.length === 0) {
    container.innerHTML = `
      <div class="button-bar" style="margin-bottom: 1.5rem;">
        <button type="button" id="btn-voltar-criar" class="action-button" style="background: #6c757d;">← Voltar</button>
      </div>
      <div class="empty-state"><p>Nenhum agendamento encontrado.</p></div>`;
    return;
  }

  const agendamentosHTML = agendamentosExistentes
    .map((agendamento) => {
      const linkAgendamento = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${agendamento.id}`;

      // Cores
      let borderLeftColor = "#0d6efd"; // Azul
      if (
        agendamento.tipo === "Reunião com Voluntário" ||
        agendamento.tipo === "Alinhamento"
      )
        borderLeftColor = "#17a2b8"; // Ciano
      else if (
        agendamento.tipo === "Reunião Técnica" ||
        agendamento.tipo === "Reunião Conselho administrativo"
      )
        borderLeftColor = "#6610f2"; // Roxo
      else if (agendamento.tipo === "Treinamento") borderLeftColor = "#ffc107"; // Amarelo

      const slotsOrdenados = [...(agendamento.slots || [])].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
      let totalInscritos = 0;
      slotsOrdenados.forEach((s) => (totalInscritos += s.vagas?.length || 0));

      const slotsListaHTML = slotsOrdenados
        .map((slot) => {
          const inscritosCount = slot.vagas?.length || 0;
          let statusTexto = "";
          if (
            (agendamento.tipo === "Reunião com Voluntário" ||
              agendamento.tipo === "Alinhamento") &&
            agendamento.vagasLimitadas
          ) {
            statusTexto =
              inscritosCount >= 1
                ? `<span style="color: #dc3545;">Ocupado</span>`
                : `<span style="color: #198754;">Disponível</span>`;
          } else {
            statusTexto = `<span style="color: #0d6efd; font-weight: bold;">${inscritosCount} inscritos</span>`;
          }
          return `<tr>
              <td>${slot.gestorNome || "N/A"}</td>
              <td>${formatarDataCompleta(slot.data)}</td>
              <td>${slot.horaInicio} - ${slot.horaFim}</td>
              <td>${statusTexto}</td>
            </tr>`;
        })
        .join("");

      let infoCapacidade = "";
      if (agendamento.capacidadeMaxima) {
        const pct = Math.round(
          (totalInscritos / agendamento.capacidadeMaxima) * 100
        );
        infoCapacidade = `<div style="margin-top: 10px; background: #fff3cd; color: #856404; padding: 5px 10px; border-radius: 4px; display: inline-block;"><strong>Capacidade:</strong> ${totalInscritos} / ${agendamento.capacidadeMaxima} (${pct}%)</div>`;
      }

      return `
        <div class="agendamento-card" style="border: 1px solid #ddd; border-left: 5px solid ${borderLeftColor}; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h4 style="margin: 0;">${agendamento.tipo}</h4>
                <small class="text-muted">Criado em: ${formatarDataCriacao(
                  agendamento.criadoEm
                )}</small>
                ${infoCapacidade}
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-exportar-excel action-button" data-agendamento-id="${
                  agendamento.id
                }" style="background: #28a745; padding: 0.5rem 1rem;">📊 Excel</button>
                <button class="btn-copiar-link action-button" data-link="${linkAgendamento}" style="background: #17a2b8; padding: 0.5rem 1rem;">📋 Link</button>
                <button class="btn-editar-agendamento action-button" data-agendamento-id="${
                  agendamento.id
                }" style="background: #ffc107; padding: 0.5rem 1rem;">✏️ Editar</button>
              </div>
            </div>
            <div style="margin-bottom: 1rem; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                <em style="color: #666; font-size: 0.9em;">"${(
                  agendamento.descricao || ""
                ).substring(0, 150)}..."</em>
            </div>
            <div style="max-height: 250px; overflow-y: auto;">
                <table class="table" style="width: 100%; font-size: 0.9em;">
                  <thead><tr style="background: #f8f9fa; text-align: left;"><th>Responsável</th><th>Data</th><th>Horário</th><th>Status</th></tr></thead>
                  <tbody>${slotsListaHTML}</tbody>
                </table>
            </div>
        </div>`;
    })
    .join("");

  container.innerHTML = `<div class="button-bar" style="margin-bottom: 1.5rem;"><button type="button" id="btn-voltar-criar" class="action-button" style="background: #6c757d;">← Voltar</button></div><h3>Agendamentos Ativos</h3>${agendamentosHTML}`;
}

// =================================================================================
// TELA 3: EDIÇÃO
// =================================================================================

async function renderizarEditarAgendamento(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );
  if (!agendamento) return alert("Não encontrado.");

  const container = document.getElementById("agendar-reuniao-container");

  const slotsExistentesHTML = (agendamento.slots || [])
    .map((slot) => {
      const inscritos = slot.vagas?.length || 0;
      return `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; padding: 8px; border-bottom: 1px solid #eee;">
        <span>${formatarDataCompleta(slot.data)}</span><span>${
        slot.horaInicio
      } - ${slot.horaFim}</span><span>${
        slot.gestorNome
      }</span><span style="font-weight: bold;">${inscritos} inscritos</span>
      </div>`;
    })
    .join("");

  let capacidadeHTML = "";
  if (agendamento.tipo === "Treinamento") {
    capacidadeHTML = `<div class="form-group" style="margin-top: 15px;"><label style="font-weight: bold;">Capacidade Máxima (Vagas)</label><input type="number" id="edit-capacidade" class="form-control" value="${
      agendamento.capacidadeMaxima || ""
    }" placeholder="Ilimitado"></div>`;
  }

  container.innerHTML = `
    <div class="button-bar" style="margin-bottom: 1.5rem;">
      <button type="button" id="btn-gerenciar-agendamentos" class="action-button" style="background: #6c757d;">← Voltar</button>
    </div>
    <h3>Editar: ${agendamento.tipo}</h3>
    <form id="form-editar-completo">
        <div class="form-group" style="margin-bottom: 2rem; background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top:0;">Configurações</h4>
            <div class="form-group"><label><input type="checkbox" id="edit-exibir-gestor" ${
              agendamento.exibirGestor ? "checked" : ""
            } /> Exibir gestor na página</label></div>
            ${capacidadeHTML}
            <label style="font-weight: bold; margin-top:15px; display:block;">Texto da Página</label>
            <textarea id="edit-descricao" class="form-control" rows="5">${
              agendamento.descricao || ""
            }</textarea>
            <div style="margin-top: 15px;"><button type="button" id="btn-salvar-configs" class="action-button" style="background: #17a2b8;">Salvar Configurações</button></div>
        </div>
        <hr style="margin: 2rem 0;">
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
            <strong>📌 Horários Já Cadastrados (Leitura):</strong><div style="margin-top: 1rem; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd;">${slotsExistentesHTML}</div>
        </div>
        <div class="form-group">
            <label style="font-weight: bold;">Adicionar Novos Horários</label>
            <div id="novos-slots-container" style="margin-bottom: 1rem;">${criarSlotHTML()}</div>
            <button type="button" id="btn-adicionar-slot-edit" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
        </div>
        <div class="button-bar" style="margin-top: 1.5rem;"><button type="submit" class="action-button save-btn">Salvar Novos Horários</button></div>
        <div id="edit-feedback" class="status-message" style="margin-top: 15px;"></div>
    </form>`;

  document
    .getElementById("btn-salvar-configs")
    .addEventListener("click", async () => {
      const novaDescricao = document.getElementById("edit-descricao").value;
      const novoExibirGestor =
        document.getElementById("edit-exibir-gestor").checked;
      let novaCapacidade = null;
      if (agendamento.tipo === "Treinamento") {
        const capInput = document.getElementById("edit-capacidade");
        if (capInput && capInput.value)
          novaCapacidade = parseInt(capInput.value);
      }
      const btn = document.getElementById("btn-salvar-configs");
      btn.textContent = "Salvando...";
      btn.disabled = true;
      try {
        const updateData = {
          descricao: novaDescricao,
          exibirGestor: novoExibirGestor,
        };
        if (novaCapacidade !== null)
          updateData.capacidadeMaxima = novaCapacidade;
        await updateDoc(doc(firestoreDb, "eventos", agendamentoId), updateData);
        alert("Configurações salvas!");
      } catch (err) {
        alert("Erro: " + err.message);
      } finally {
        btn.textContent = "Salvar Configurações";
        btn.disabled = false;
      }
    });

  document
    .getElementById("form-editar-completo")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await salvarNovosSlots(agendamentoId, agendamento);
    });
}

// =================================================================================
// SALVAR NOVO AGENDAMENTO
// =================================================================================

async function salvarAgendamento(e) {
  e.preventDefault();
  const feedbackEl = document.getElementById("agendamento-feedback");
  const saveButton = document.getElementById("btn-submit-agendamento");
  saveButton.disabled = true;
  saveButton.textContent = "Criando...";
  feedbackEl.textContent = "";

  const tipo = document.getElementById("tipo-reuniao").value;
  const descricao = document.getElementById("descricao-custom").value;
  const exibirGestor = document.getElementById("exibir-gestor").checked;

  let capacidadeMaxima = null;
  if (tipo === "Treinamento") {
    const capVal = document.getElementById("capacidade-maxima").value;
    if (capVal) capacidadeMaxima = parseInt(capVal);
  }

  const vagasLimitadas =
    tipo === "Reunião com Voluntário" || tipo === "Alinhamento";

  let slots = [];
  document
    .querySelectorAll("#slots-container .slot-item")
    .forEach((slotItem) => {
      const data = slotItem.querySelector(".slot-data").value;
      const horaInicio = slotItem.querySelector(".slot-hora-inicio").value;
      const horaFim = slotItem.querySelector(".slot-hora-fim").value;
      const gestorId = slotItem.querySelector(".slot-gestor").value;

      if (data && horaInicio && horaFim && gestorId) {
        const gestor = gestores.find((g) => g.id === gestorId);
        if (vagasLimitadas) {
          slots = slots.concat(
            gerarSlotsAutomaticos(
              data,
              horaInicio,
              horaFim,
              gestorId,
              gestor?.nome || ""
            )
          );
        } else {
          slots.push({
            data,
            horaInicio,
            horaFim,
            gestorId,
            gestorNome: gestor?.nome || "",
            vagas: [],
          });
        }
      }
    });

  if (slots.length === 0) {
    alert("Adicione pelo menos um horário.");
    saveButton.disabled = false;
    saveButton.textContent = "Criar Agendamento";
    return;
  }

  try {
    const dados = {
      tipo,
      descricao: descricao || getDescricaoPadrao(tipo),
      exibirGestor,
      slots,
      criadoEm: serverTimestamp(),
      vagasLimitadas,
      capacidadeMaxima,
      status: "Agendada",
      origem: "painel_gestao",
    };
    const docRef = await addDoc(collection(firestoreDb, "eventos"), dados);
    const link = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${docRef.id}`;
    feedbackEl.innerHTML = `<div class="alert alert-success"><h4>Criado!</h4><p>Link: <input type="text" value="${link}" style="width:100%" readonly></p></div>`;
    document.getElementById("form-agendamento").reset();
    document.getElementById("slots-container").innerHTML = criarSlotHTML();
    document.getElementById("container-capacidade").style.display = "none";
  } catch (err) {
    console.error(err);
    feedbackEl.innerHTML = `<div class="alert alert-danger">Erro: ${err.message}</div>`;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Criar Agendamento";
  }
}

async function salvarNovosSlots(agendamentoId, agendamento) {
  const saveButton = document.querySelector(
    '#form-editar-completo button[type="submit"]'
  );
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";
  let novosSlots = [];
  const vagasLimitadas = agendamento.vagasLimitadas;

  document
    .querySelectorAll("#novos-slots-container .slot-item")
    .forEach((slotItem) => {
      const data = slotItem.querySelector(".slot-data").value;
      const horaInicio = slotItem.querySelector(".slot-hora-inicio").value;
      const horaFim = slotItem.querySelector(".slot-hora-fim").value;
      const gestorId = slotItem.querySelector(".slot-gestor").value;
      if (data && horaInicio && horaFim && gestorId) {
        const gestor = gestores.find((g) => g.id === gestorId);
        if (vagasLimitadas) {
          novosSlots = novosSlots.concat(
            gerarSlotsAutomaticos(
              data,
              horaInicio,
              horaFim,
              gestorId,
              gestor?.nome || ""
            )
          );
        } else {
          novosSlots.push({
            data,
            horaInicio,
            horaFim,
            gestorId,
            gestorNome: gestor?.nome || "",
            vagas: [],
          });
        }
      }
    });

  if (novosSlots.length === 0) {
    alert("Nenhum slot preenchido.");
    saveButton.disabled = false;
    saveButton.textContent = "Salvar";
    return;
  }

  try {
    await updateDoc(doc(firestoreDb, "eventos", agendamentoId), {
      slots: [...agendamento.slots, ...novosSlots],
    });
    document.getElementById(
      "edit-feedback"
    ).innerHTML = `<div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 4px;"><strong>✓ ${novosSlots.length} horários adicionados!</strong></div>`;
    setTimeout(() => renderizarGerenciarAgendamentos(), 1500);
  } catch (err) {
    alert("Erro ao salvar.");
    saveButton.disabled = false;
    saveButton.textContent = "Salvar";
  }
}

// =================================================================================
// HELPERS
// =================================================================================

function exportarParaExcel(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );
  if (!agendamento) return;
  let csv = "Data,Horario,Responsavel,Inscrito,Status\n";
  if (agendamento.slots) {
    [...agendamento.slots]
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach((slot) => {
        const dataF = formatarDataCompleta(slot.data);
        const horaF = `${slot.horaInicio} - ${slot.horaFim}`;
        if (slot.vagas && slot.vagas.length > 0) {
          slot.vagas.forEach((vaga) => {
            csv += `"${dataF}","${horaF}","${slot.gestorNome}","${
              vaga.profissionalNome || vaga.nome || "Inscrito"
            }","Confirmado"\n`;
          });
        } else {
          csv += `"${dataF}","${horaF}","${slot.gestorNome}","","Disponível"\n`;
        }
      });
  }
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lista_${agendamento.tipo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function gerarSlotsAutomaticos(
  data,
  horaInicioStr,
  horaFimStr,
  gestorId,
  gestorNome
) {
  const slots = [];
  const [hI, mI] = horaInicioStr.split(":").map(Number);
  const [hF, mF] = horaFimStr.split(":").map(Number);
  let minAtual = hI * 60 + mI;
  const minFinal = hF * 60 + mF;
  while (minAtual < minFinal) {
    const minProx = Math.min(minAtual + 30, minFinal);
    const hS = `${String(Math.floor(minAtual / 60)).padStart(2, "0")}:${String(
      minAtual % 60
    ).padStart(2, "0")}`;
    const hE = `${String(Math.floor(minProx / 60)).padStart(2, "0")}:${String(
      minProx % 60
    ).padStart(2, "0")}`;
    slots.push({
      data,
      horaInicio: hS,
      horaFim: hE,
      gestorId,
      gestorNome,
      vagas: [],
    });
    minAtual = minProx;
  }
  return slots;
}

function formatarDataCompleta(dt) {
  if (!dt) return "";
  const [a, m, d] = dt.split("-");
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR");
}
function formatarDataCriacao(ts) {
  return ts && ts.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "";
}
function getDescricaoPadrao(tipo) {
  if (tipo === "Treinamento")
    return "Participe do nosso Treinamento! Vagas Limitadas.";
  if (tipo === "Reunião com Voluntário" || tipo === "Alinhamento")
    return "Selecione um horário para nossa conversa individual.";
  return "Inscreva-se abaixo para confirmar sua presença.";
}
