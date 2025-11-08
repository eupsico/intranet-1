// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 2.1 - Corrigido: Gestor por slot individual

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];
let todosOsProfissionais = [];
let todosOsAgendamentos = [];

const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

export async function init() {
  console.log("[RELATÓRIO] Módulo de Relatórios iniciado.");
  setupEventListeners();
  await carregarRelatorios();
}

async function carregarRelatorios() {
  try {
    const [atasSnapshot, profissionaisSnapshot, agendamentosSnapshot] =
      await Promise.all([
        getDocs(
          query(
            collection(firestoreDb, "gestao_atas"),
            where("tipo", "==", "Reunião Técnica")
          )
        ),
        getDocs(query(collection(firestoreDb, "usuarios"), orderBy("nome"))),
        getDocs(
          query(
            collection(firestoreDb, "agendamentos_voluntarios"),
            orderBy("criadoEm", "desc")
          )
        ),
      ]);

    todasAsAtas = atasSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    todosOsProfissionais = profissionaisSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    todosOsAgendamentos = agendamentosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("[RELATÓRIO] Dados carregados:");
    console.log("Atas:", todasAsAtas.length);
    console.log("Profissionais:", todosOsProfissionais.length);
    console.log("Agendamentos:", todosOsAgendamentos);

    renderizarRelatorios();
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao carregar dados:", error);
  }
}

function setupEventListeners() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tab-button")) {
      const tabName = e.target.dataset.tab;
      trocarAba(tabName);
    }

    if (e.target.classList.contains("accordion-header")) {
      e.target.parentElement.classList.toggle("active");
    }

    if (e.target.classList.contains("checkbox-presenca")) {
      marcarPresenca(e.target);
    }
  });
}

function trocarAba(tabName) {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.toggle("active", content.id === `tab-${tabName}`);
  });

  if (tabName === "feedbacks") {
    renderizarFeedbacks();
  } else if (tabName === "agendados") {
    renderizarAgendados();
  }
}

function renderizarRelatorios() {
  const container = document.getElementById("relatorio-feedback-container");

  container.innerHTML = `
    <div class="relatorios-header">
      <h2>Relatórios</h2>
      <div class="tabs">
        <button class="tab-button active" data-tab="feedbacks">Feedbacks de Reuniões</button>
        <button class="tab-button" data-tab="agendados">Agendados</button>
      </div>
    </div>

    <div id="tab-feedbacks" class="tab-content active">
      <div id="feedbacks-list"></div>
    </div>

    <div id="tab-agendados" class="tab-content">
      <div id="agendados-list"></div>
    </div>
  `;

  renderizarFeedbacks();
}

function renderizarFeedbacks() {
  const feedbacksList = document.getElementById("feedbacks-list");

  if (todasAsAtas.length === 0) {
    feedbacksList.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma reunião técnica com feedback encontrada.</p>
      </div>
    `;
    return;
  }

  const atasComFeedback = todasAsAtas.filter(
    (ata) => ata.feedbacks && ata.feedbacks.length > 0
  );

  if (atasComFeedback.length === 0) {
    feedbacksList.innerHTML = `
      <div class="empty-state">
        <p>Nenhum feedback recebido ainda.</p>
      </div>
    `;
    return;
  }

  const accordionHTML = atasComFeedback
    .map(
      (ata) => `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-title">
            <strong>${ata.pauta || ata.tema || "Sem tema"}</strong>
            <span class="badge">${ata.feedbacks.length} feedback(s)</span>
          </div>
          <div class="accordion-meta">
            ${formatarData(ata.dataReuniao)} às ${ata.horaInicio || ""}
          </div>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${renderizarFeedbacksAta(ata)}
        </div>
      </div>
    `
    )
    .join("");

  feedbacksList.innerHTML = accordionHTML;
}

function renderizarFeedbacksAta(ata) {
  if (!ata.feedbacks || ata.feedbacks.length === 0) {
    return "<p>Nenhum feedback registrado.</p>";
  }

  return ata.feedbacks
    .map((feedback) => {
      const profissional = todosOsProfissionais.find(
        (p) => p.id === feedback.profissionalId
      );
      const nomeProfissional = profissional
        ? profissional.nome
        : "Profissional desconhecido";

      return `
        <div class="feedback-card">
          <h4>${nomeProfissional}</h4>
          <div class="feedback-respostas">
            <p><strong>${perguntasTexto.clareza}</strong><br/>
            ${formatarResposta(feedback.clareza)}</p>

            <p><strong>${perguntasTexto.objetivos}</strong><br/>
            ${formatarResposta(feedback.objetivos)}</p>

            <p><strong>${perguntasTexto.duracao}</strong><br/>
            ${formatarResposta(feedback.duracao)}</p>

            ${
              feedback.sugestaoTema
                ? `<p><strong>${perguntasTexto.sugestaoTema}</strong><br/>
              ${feedback.sugestaoTema}</p>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderizarAgendados() {
  const agendadosList = document.getElementById("agendados-list");

  if (todosOsAgendamentos.length === 0) {
    agendadosList.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma reunião com voluntário agendada.</p>
      </div>
    `;
    return;
  }

  const accordionHTML = todosOsAgendamentos
    .map(
      (agendamento) => `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-title">
            <strong>Reunião com Voluntário</strong>
            <span class="badge">${contarInscritos(
              agendamento
            )} inscrito(s)</span>
          </div>
          <div class="accordion-meta">
            ${formatarDataCriacao(agendamento.criadoEm)}
          </div>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${renderizarTabelaAgendados(agendamento)}
        </div>
      </div>
    `
    )
    .join("");

  agendadosList.innerHTML = accordionHTML;
}

function renderizarTabelaAgendados(agendamento) {
  const inscritos = [];

  // ✅ CORRIGIDO: Pega o gestorNome de cada slot individual
  agendamento.slots?.forEach((slot) => {
    slot.vagas?.forEach((vaga) => {
      if (vaga.profissionalId) {
        const profissional = todosOsProfissionais.find(
          (p) => p.id === vaga.profissionalId
        );
        inscritos.push({
          nome: profissional?.nome || vaga.profissionalNome || "Desconhecido",
          data: slot.data,
          horario: `${slot.horaInicio} - ${slot.horaFim}`,
          gestor: slot.gestorNome || "Não especificado", // ✅ Agora pega do slot
          presente: vaga.presente || false,
          vagaId: vaga.id,
          slotData: slot.data,
          slotHoraInicio: slot.horaInicio,
          agendamentoId: agendamento.id,
        });
      }
    });
  });

  if (inscritos.length === 0) {
    return "<p>Nenhum profissional inscrito ainda.</p>";
  }

  const linhasTabela = inscritos
    .map(
      (inscrito) => `
      <tr>
        <td>${inscrito.nome}</td>
        <td>${formatarData(inscrito.data)}</td>
        <td>${inscrito.horario}</td>
        <td>${inscrito.gestor}</td>
        <td class="text-center">
          <input 
            type="checkbox" 
            class="checkbox-presenca" 
            ${inscrito.presente ? "checked" : ""}
            data-agendamento-id="${inscrito.agendamentoId}"
            data-slot-data="${inscrito.slotData}"
            data-slot-hora-inicio="${inscrito.slotHoraInicio}"
            data-vaga-id="${inscrito.vagaId}"
          />
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <table class="tabela-agendados">
      <thead>
        <tr>
          <th>Nome do Profissional</th>
          <th>Data da Reunião</th>
          <th>Horário</th>
          <th>Gestor Responsável</th>
          <th class="text-center">Presença</th>
        </tr>
      </thead>
      <tbody>
        ${linhasTabela}
      </tbody>
    </table>
  `;
}

async function marcarPresenca(checkbox) {
  const agendamentoId = checkbox.dataset.agendamentoId;
  const slotData = checkbox.dataset.slotData;
  const slotHoraInicio = checkbox.dataset.slotHoraInicio;
  const vagaId = checkbox.dataset.vagaId;
  const presente = checkbox.checked;

  try {
    const agendamento = todosOsAgendamentos.find((a) => a.id === agendamentoId);

    // ✅ Busca slot por data E hora de início para garantir o slot correto
    const slot = agendamento.slots.find(
      (s) => s.data === slotData && s.horaInicio === slotHoraInicio
    );

    if (!slot) {
      throw new Error("Slot não encontrado");
    }

    const vaga = slot.vagas.find((v) => v.id === vagaId);

    if (vaga) {
      vaga.presente = presente;

      await updateDoc(
        doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
        {
          slots: agendamento.slots,
        }
      );

      console.log("[RELATÓRIO] Presença atualizada com sucesso!");
    }
  } catch (error) {
    console.error("[RELATÓRIO] Erro ao marcar presença:", error);
    checkbox.checked = !presente;
    alert("Erro ao atualizar presença. Tente novamente.");
  }
}

function contarInscritos(agendamento) {
  let total = 0;
  agendamento.slots?.forEach((slot) => {
    total += slot.vagas?.filter((v) => v.profissionalId).length || 0;
  });
  return total;
}

function formatarResposta(valor) {
  const respostas = {
    5: "⭐⭐⭐⭐⭐ Excelente",
    4: "⭐⭐⭐⭐ Bom",
    3: "⭐⭐⭐ Regular",
    2: "⭐⭐ Insuficiente",
    1: "⭐ Inadequado",
  };
  return respostas[valor] || valor;
}

function formatarData(dataISO) {
  if (!dataISO) return "Data não informada";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataCriacao(timestamp) {
  if (!timestamp) return "Data não informada";

  // Se for um timestamp do Firestore
  if (timestamp && timestamp.toDate) {
    const data = timestamp.toDate();
    return `Criado em ${data.toLocaleDateString("pt-BR")}`;
  }

  return "Data não informada";
}
