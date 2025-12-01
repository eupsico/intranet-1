// /modulos/gestao/js/agendar-reuniao.js
// VERSÃO 4.0 - Unificação de Links, Slots para Todos e Vagas Ilimitadas para Técnicas

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
  console.log("[AGENDAR] Módulo Agendar Reunião iniciado (v4.0).");
  await carregarGestores();
  renderizarFormularioAgendamento();

  // Event listeners globais
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

    // Botão: Editar (no card da lista)
    if (e.target.closest(".btn-editar-agendamento")) {
      const btn = e.target.closest(".btn-editar-agendamento");
      const id = btn.dataset.agendamentoId;
      await renderizarEditarAgendamento(id);
    }

    // Botão: Copiar Link
    if (e.target.closest(".btn-copiar-link")) {
      const btn = e.target.closest(".btn-copiar-link");
      const link = btn.dataset.link;
      navigator.clipboard.writeText(link);
      alert("Link copiado para a área de transferência!");
    }

    // Botão: Exportar Excel
    if (e.target.closest(".btn-exportar-excel")) {
      const btn = e.target.closest(".btn-exportar-excel");
      const id = btn.dataset.agendamentoId;
      exportarParaExcel(id);
    }

    // Botão: Adicionar Slot (na tela de edição)
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
    // Busca Agendamentos (agora tudo fica em 'agendamentos_voluntarios' para padronizar estrutura de slots)
    // Se você tiver dados antigos em 'gestao_atas', precisaremos migrar ou tratar separadamente.
    // Nesta versão 4.0, assumimos que TODOS os agendamentos com inscrição usam a coleção 'agendamentos_voluntarios'
    // para suportar a lógica de slots e links unificados.

    const q = query(collection(firestoreDb, "agendamentos_voluntarios"));
    const snapshot = await getDocs(q);

    agendamentosExistentes = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Pega a primeira data disponível nos slots ou a data de criação
      const primeiraData =
        data.slots && data.slots.length > 0
          ? data.slots[0].data
          : data.criadoEm?.toDate().toISOString().split("T")[0];
      return {
        id: doc.id,
        ...data,
        dataOrdenacao: primeiraData,
      };
    });

    // Ordena pela DATA DO EVENTO (Mais recente/futuro primeiro)
    agendamentosExistentes.sort((a, b) => {
      const dataA = new Date(a.dataOrdenacao);
      const dataB = new Date(b.dataOrdenacao);
      return dataB - dataA;
    });

    console.log("[AGENDAR] Total carregado:", agendamentosExistentes.length);
  } catch (error) {
    console.error("[AGENDAR] Erro ao carregar agendamentos:", error);
    agendamentosExistentes = [];
  }
}

// --- RENDERIZAÇÃO DO FORMULÁRIO DE CRIAÇÃO ---

function renderizarFormularioAgendamento() {
  const container = document.getElementById("agendar-reuniao-container");

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
                    <option value="Reunião com Gestor">Reunião com Gestor</option>
                    <option value="Reunião com Voluntário">Reunião com Voluntário</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="descricao-custom">Texto da Página de Inscrição</label>
                <textarea id="descricao-custom" class="form-control" rows="4" placeholder="Texto que aparecerá para quem for se inscrever. Deixe em branco para usar o padrão."></textarea>
                <small class="text-muted">Personalize o convite que aparece na página pública.</small>
            </div>

            <div class="form-group">
                <label>Datas e Horários Disponíveis *</label>
                <small style="display: block; color: #666; margin-bottom: 0.5rem;">
                    Configure as datas e horários. Para reuniões técnicas, o horário permitirá múltiplas inscrições.
                </small>
                <div id="slots-container" style="margin-bottom: 1rem;">
                    ${criarSlotHTML()}
                </div>
                <button type="button" id="btn-adicionar-slot" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
            </div>

            <div class="form-group" id="container-exibir-gestor" style="display:none;">
                <label>
                    <input type="checkbox" id="exibir-gestor" checked />
                    Exibir nome do gestor no slot (Para reuniões 1:1)
                </label>
            </div>

            <div class="button-bar">
                <button type="submit" id="btn-submit-agendamento" class="action-button save-btn">Criar Agendamento</button>
            </div>
            <div id="agendamento-feedback" class="status-message" style="margin-top: 15px;"></div>
        </form>
  `;

  // Listeners
  document
    .getElementById("btn-adicionar-slot")
    .addEventListener("click", adicionarSlot);
  document
    .getElementById("form-agendamento")
    .addEventListener("submit", salvarAgendamento);

  // Controle de exibição específico por tipo
  document.getElementById("tipo-reuniao").addEventListener("change", (e) => {
    const tipo = e.target.value;
    const checkGestor = document.getElementById("container-exibir-gestor");

    // Se for voluntário, geralmente queremos mostrar quem é o gestor específico do horário
    if (tipo === "Reunião com Voluntário") {
      checkGestor.style.display = "block";
    } else {
      checkGestor.style.display = "none";
    }
  });
}

function criarSlotHTML() {
  const gestoresOptions = gestores
    .map((g) => `<option value="${g.id}">${g.nome}</option>`)
    .join("");

  return `
    <div class="slot-item" style="display: grid; grid-template-columns: 1fr 1fr auto 1fr 2fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6;">
      <div>
        <small>Data</small>
        <input type="date" class="slot-data form-control" required />
      </div>
      <div>
        <small>Início</small>
        <input type="time" class="slot-hora-inicio form-control" required />
      </div>
      <div style="padding-top: 18px;">até</div>
      <div>
        <small>Fim</small>
        <input type="time" class="slot-hora-fim form-control" required />
      </div>
      <div>
        <small>Responsável/Gestor</small>
        <select class="slot-gestor form-control" required>
            <option value="">Selecione...</option>
            ${gestoresOptions}
        </select>
      </div>
      <div style="padding-top: 18px;">
        <button type="button" class="btn-remove-slot" style="background: #dc3545; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    </div>
  `;
}

function adicionarSlot() {
  const slotsContainer = document.getElementById("slots-container");
  const novoSlot = document.createElement("div");
  novoSlot.innerHTML = criarSlotHTML();
  slotsContainer.appendChild(novoSlot.firstElementChild);
}

// --- RENDERIZAÇÃO DA LISTA ---

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
        <p>Nenhum agendamento encontrado.</p>
      </div>
    `;
    return;
  }

  const agendamentosHTML = agendamentosExistentes
    .map((agendamento) => {
      // LINK UNIFICADO: Sempre usa agendamento-voluntario.html
      const linkAgendamento = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${agendamento.id}`;

      // Configuração visual baseada no tipo
      let borderLeftColor = "#0d6efd"; // Azul padrão
      if (agendamento.tipo === "Reunião com Voluntário")
        borderLeftColor = "#17a2b8"; // Ciano
      else if (agendamento.tipo === "Reunião Técnica")
        borderLeftColor = "#6610f2"; // Roxo

      // Detalhes dos Slots
      const slotsOrdenados = [...(agendamento.slots || [])].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
      const slotsListaHTML = slotsOrdenados
        .map((slot) => {
          const inscritosCount = slot.vagas?.length || 0;
          // Lógica de Status:
          // Voluntário: 1 inscrito = Cheio
          // Técnica: Ilimitado = Sempre Disponível (mostra quantos inscritos tem)

          let statusTexto = "";
          let statusCor = "";

          if (agendamento.tipo === "Reunião com Voluntário") {
            if (inscritosCount >= 1) {
              statusTexto = "Ocupado";
              statusCor = "color: #dc3545;";
            } else {
              statusTexto = "Disponível";
              statusCor = "color: #198754;";
            }
          } else {
            // Reunião Técnica (Ilimitada)
            statusTexto = `${inscritosCount} inscritos`;
            statusCor = "color: #0d6efd; font-weight: bold;";
          }

          return `
            <tr>
              <td>${slot.gestorNome || "N/A"}</td>
              <td>${formatarDataCompleta(slot.data)}</td>
              <td>${slot.horaInicio} - ${slot.horaFim}</td>
              <td style="${statusCor}">${statusTexto}</td>
            </tr>`;
        })
        .join("");

      return `
        <div class="agendamento-card" style="border: 1px solid #ddd; border-left: 5px solid ${borderLeftColor}; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h4 style="margin: 0 0 0.25rem 0;">${agendamento.tipo}</h4>
                <small class="text-muted">Criado em: ${formatarDataCriacao(
                  agendamento.criadoEm
                )}</small>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-exportar-excel action-button" data-agendamento-id="${
                  agendamento.id
                }" style="background: #28a745; padding: 0.5rem 1rem;" title="Exportar Lista de Inscritos">
                  📊 Excel
                </button>
                <button class="btn-copiar-link action-button" data-link="${linkAgendamento}" style="background: #17a2b8; padding: 0.5rem 1rem;" title="Copiar Link de Inscrição">
                  📋 Link
                </button>
                <button class="btn-editar-agendamento action-button" data-agendamento-id="${
                  agendamento.id
                }" style="background: #ffc107; padding: 0.5rem 1rem;" title="Editar">
                  ✏️ Editar
                </button>
              </div>
            </div>
            
            <div style="margin-bottom: 1rem; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                <strong>Texto da Página:</strong><br>
                <em style="color: #666; font-size: 0.9em;">"${(
                  agendamento.descricao || ""
                ).substring(0, 100)}..."</em>
            </div>

            <table class="table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9em;">
              <thead>
                <tr style="background: #f8f9fa; text-align: left;">
                  <th style="padding: 0.5rem; border: 1px solid #ddd;">Responsável</th>
                  <th style="padding: 0.5rem; border: 1px solid #ddd;">Data</th>
                  <th style="padding: 0.5rem; border: 1px solid #ddd;">Horário</th>
                  <th style="padding: 0.5rem; border: 1px solid #ddd;">Status</th>
                </tr>
              </thead>
              <tbody>${slotsListaHTML}</tbody>
            </table>
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="button-bar" style="margin-bottom: 1.5rem;">
      <button type="button" id="btn-voltar-criar" class="action-button" style="background: #6c757d;">
        ← Voltar para Criar Novo
      </button>
    </div>
    <h3 style="margin-bottom: 1.5rem;">Agendamentos Ativos</h3>
    ${agendamentosHTML}
  `;
}

// --- EDIÇÃO DE AGENDAMENTO (UNIFICADA) ---

async function renderizarEditarAgendamento(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );

  if (!agendamento) {
    alert("Agendamento não encontrado.");
    return;
  }

  const container = document.getElementById("agendar-reuniao-container");

  // Slots existentes (somente leitura visual, edição adiciona novos)
  const slotsExistentesHTML = (agendamento.slots || [])
    .map((slot) => {
      const inscritos = slot.vagas?.length || 0;
      return `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; padding: 8px; border-bottom: 1px solid #eee;">
        <span>${formatarDataCompleta(slot.data)}</span>
        <span>${slot.horaInicio} - ${slot.horaFim}</span>
        <span>${slot.gestorNome}</span>
        <span style="font-weight: bold;">${inscritos} inscritos</span>
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="button-bar" style="margin-bottom: 1.5rem;">
      <button type="button" id="btn-gerenciar-agendamentos" class="action-button" style="background: #6c757d;">
        ← Voltar para Lista
      </button>
    </div>
    
    <h3>Editar: ${agendamento.tipo}</h3>
    
    <form id="form-editar-completo">
        <div class="form-group" style="margin-bottom: 2rem;">
            <label for="edit-descricao" style="font-weight: bold; display: block; margin-bottom: 0.5rem;">Texto da Página de Inscrição</label>
            <textarea id="edit-descricao" class="form-control" rows="5" style="width: 100%; padding: 0.5rem;">${
              agendamento.descricao || ""
            }</textarea>
            <div style="margin-top: 5px;">
                <button type="button" id="btn-salvar-descricao" class="action-button" style="background: #17a2b8; font-size: 0.9em;">Salvar Apenas Texto</button>
            </div>
        </div>

        <hr style="margin: 2rem 0;">

        <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
            <strong>📌 Horários Atuais:</strong>
            <div style="margin-top: 1rem; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd;">
                ${slotsExistentesHTML}
            </div>
        </div>
        
        <div class="form-group">
            <label style="font-weight: bold;">Adicionar Novos Horários</label>
            <small style="display: block; color: #666; margin-bottom: 0.5rem;">
                Adicione novos slots abaixo. A regra de vagas (ilimitada ou 1:1) será mantida baseada no tipo da reunião.
            </small>
            <div id="novos-slots-container" style="margin-bottom: 1rem;">
                ${criarSlotHTML()}
            </div>
            <button type="button" id="btn-adicionar-slot-edit" class="action-button" style="background: #6c757d;">+ Adicionar Horário</button>
        </div>
        
        <div class="button-bar" style="margin-top: 1.5rem;">
            <button type="submit" class="action-button save-btn">Salvar Novos Horários</button>
        </div>
        <div id="edit-feedback" class="status-message" style="margin-top: 15px;"></div>
    </form>
  `;

  // Listener para salvar apenas descrição
  document
    .getElementById("btn-salvar-descricao")
    .addEventListener("click", async () => {
      const novaDescricao = document.getElementById("edit-descricao").value;
      const btn = document.getElementById("btn-salvar-descricao");
      btn.textContent = "Salvando...";
      btn.disabled = true;

      try {
        await updateDoc(
          doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
          {
            descricao: novaDescricao,
          }
        );
        alert("Descrição atualizada com sucesso!");
      } catch (err) {
        alert("Erro ao atualizar descrição.");
        console.error(err);
      } finally {
        btn.textContent = "Salvar Apenas Texto";
        btn.disabled = false;
      }
    });

  // Listener para salvar novos slots
  document
    .getElementById("form-editar-completo")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await salvarNovosSlots(agendamentoId, agendamento);
    });
}

// --- LÓGICA DE SALVAMENTO ---

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

  // Coleta Slots
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
        // Gera slots (divide o tempo se necessário, ou cria um único se o intervalo for igual)
        // Por simplicidade neste editor unificado, se for Reunião Técnica, podemos não querer dividir em 30 min,
        // mas a função gerarSlotsAutomaticos divide. Vamos manter a divisão padrão de 30min para consistência
        // ou criar apenas 1 slot se o usuário definir início e fim.
        // **Decisão:** Manter divisão de 30min para Voluntários. Para Técnica, geralmente é um bloco só.

        if (tipo === "Reunião com Voluntário") {
          const slotsGerados = gerarSlotsAutomaticos(
            data,
            horaInicio,
            horaFim,
            gestorId,
            gestor?.nome || ""
          );
          slots = slots.concat(slotsGerados);
        } else {
          // Para técnica, cria um slot único com o horário cheio (ex: 14:00 as 16:00)
          // E define capacidade ilimitada (que é tratado na hora da inscrição, não aqui no banco,
          // mas a estrutura de 'vagas' array permite infinitos pushes)
          slots.push({
            data,
            horaInicio,
            horaFim,
            gestorId,
            gestorNome: gestor?.nome || "",
            vagas: [], // Array vazio para receber inscritos
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

  // Define descrição padrão se vazio
  const descFinal = descricao || getDescricaoPadrao(tipo);

  const dados = {
    tipo,
    descricao: descFinal,
    exibirGestor, // Usado pelo front público para esconder/mostrar nome
    slots,
    criadoEm: serverTimestamp(),
    // Flag para o front público saber se limita vagas
    vagasLimitadas: tipo === "Reunião com Voluntário",
  };

  try {
    const docRef = await addDoc(
      collection(firestoreDb, "agendamentos_voluntarios"),
      dados
    );
    const link = `${window.location.origin}/public/agendamento-voluntario.html?agendamentoId=${docRef.id}`;

    feedbackEl.innerHTML = `
        <div class="alert alert-success">
            <h4>Agendamento Criado!</h4>
            <p>Link para inscrição:</p>
            <input type="text" value="${link}" style="width:100%" readonly>
        </div>`;

    // Limpa formulário
    document.getElementById("form-agendamento").reset();
    document.getElementById("slots-container").innerHTML = criarSlotHTML(); // Reseta para 1 slot vazio
  } catch (err) {
    console.error(err);
    feedbackEl.innerHTML = `<div class="alert alert-danger">Erro ao criar agendamento.</div>`;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Criar Agendamento";
  }
}

async function salvarNovosSlots(agendamentoId, agendamento) {
  const feedbackEl = document.getElementById("edit-feedback");
  const saveButton = document.querySelector(
    '#form-editar-completo button[type="submit"]'
  );
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  let novosSlots = [];

  document
    .querySelectorAll("#novos-slots-container .slot-item")
    .forEach((slotItem) => {
      const data = slotItem.querySelector(".slot-data").value;
      const horaInicio = slotItem.querySelector(".slot-hora-inicio").value;
      const horaFim = slotItem.querySelector(".slot-hora-fim").value;
      const gestorId = slotItem.querySelector(".slot-gestor").value;

      if (data && horaInicio && horaFim && gestorId) {
        const gestor = gestores.find((g) => g.id === gestorId);

        if (agendamento.tipo === "Reunião com Voluntário") {
          const slotsGerados = gerarSlotsAutomaticos(
            data,
            horaInicio,
            horaFim,
            gestorId,
            gestor?.nome || ""
          );
          novosSlots = novosSlots.concat(slotsGerados);
        } else {
          // Slot único para reuniões gerais
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
    alert("Nenhum slot novo preenchido.");
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Novos Horários";
    return;
  }

  try {
    const slotsAtualizados = [...agendamento.slots, ...novosSlots];

    // Atualiza também a descrição, caso tenha mudado no textarea mas o usuário clicou direto em "Salvar Novos Horários"
    const novaDescricao = document.getElementById("edit-descricao").value;

    await updateDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
      {
        slots: slotsAtualizados,
        descricao: novaDescricao,
      }
    );

    feedbackEl.innerHTML = `<div class="alert alert-success">Atualizado com sucesso!</div>`;
    setTimeout(() => renderizarGerenciarAgendamentos(), 1500);
  } catch (err) {
    console.error(err);
    feedbackEl.innerHTML = `<div class="alert alert-danger">Erro ao salvar.</div>`;
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Novos Horários";
  }
}

// --- EXPORTAR EXCEL ---
function exportarParaExcel(agendamentoId) {
  const agendamento = agendamentosExistentes.find(
    (a) => a.id === agendamentoId
  );
  if (!agendamento) return alert("Erro ao encontrar dados.");

  let csv = "Data,Horario,Responsavel,Inscrito,Status\n";

  if (agendamento.slots) {
    // Ordena por data
    const slots = [...agendamento.slots].sort((a, b) =>
      a.data.localeCompare(b.data)
    );

    slots.forEach((slot) => {
      const dataF = formatarDataCompleta(slot.data);
      const horaF = `${slot.horaInicio} - ${slot.horaFim}`;

      if (slot.vagas && slot.vagas.length > 0) {
        slot.vagas.forEach((vaga) => {
          // Se tiver nome do inscrito, usa. Se não, "Ocupado"
          const nomeInscrito = vaga.profissionalNome || "Inscrito"; // Adapte conforme seu objeto de vaga no front público
          csv += `"${dataF}","${horaF}","${slot.gestorNome}","${nomeInscrito}","Confirmado"\n`;
        });
      } else {
        csv += `"${dataF}","${horaF}","${slot.gestorNome}","","Disponível"\n`;
      }
    });
  }

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `lista_presenca_${agendamento.tipo.replace(/\s/g, "_")}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- HELPERS ---

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

function formatarDataCompleta(dataISO) {
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatarDataCriacao(timestamp) {
  if (!timestamp) return "";
  return timestamp.toDate ? timestamp.toDate().toLocaleDateString("pt-BR") : "";
}

function getDescricaoPadrao(tipo) {
  if (tipo === "Reunião com Voluntário") {
    return "Olá! Selecione um horário abaixo para nossa conversa individual de alinhamento. O link da reunião será enviado pelo WhatsApp.";
  }
  if (tipo === "Reunião Técnica") {
    return "Participe da nossa Reunião Técnica. Inscreva-se em um dos horários disponíveis abaixo para garantir sua presença.";
  }
  return "Selecione um horário para participar desta reunião.";
}
