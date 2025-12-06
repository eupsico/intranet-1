// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 3.1 (Correção: Sincronização de renderização com dados carregados)
import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// ==========================================
// ESTADO GLOBAL DO MÓDULO
// ==========================================
let dadosCache = {
  atas: [],
  profissionais: [],
  agendamentos: [],
  carregado: false,
};

let estadoCarregamento = {
  carregando: false,
  promiseCarregamento: null,
};

const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
export async function init() {
  console.log("[RELATÓRIO] Init v3.1 - Sincronização corrigida.");

  // 1. Limpa estado anterior (Reset forçado para SPA)
  dadosCache = {
    atas: [],
    profissionais: [],
    agendamentos: [],
    carregado: false,
  };

  estadoCarregamento = {
    carregando: false,
    promiseCarregamento: null,
  };

  // 2. Configura os cliques das abas imediatamente
  setupEventListeners();

  // 3. Mostra loading na aba ativa atual
  exibirLoadingNaAbaAtiva();

  // 4. Busca dados (armazena a promessa)
  estadoCarregamento.promiseCarregamento = carregarDadosDoBanco();
  await estadoCarregamento.promiseCarregamento;
}

// ==========================================
// LÓGICA DE DADOS (Busca Única)
// ==========================================
async function carregarDadosDoBanco() {
  try {
    estadoCarregamento.carregando = true;

    const [atasSnap, profSnap, agendSnap] = await Promise.all([
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

    dadosCache.atas = atasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dadosCache.profissionais = profSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    dadosCache.agendamentos = agendSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    dadosCache.carregado = true;
    estadoCarregamento.carregando = false;

    console.log(
      `[RELATÓRIO] Dados carregados: ${dadosCache.atas.length} atas.`
    );

    // Após carregar, renderiza IMEDIATAMENTE a aba que está aberta visualmente
    renderizarAbaAtiva();
  } catch (error) {
    estadoCarregamento.carregando = false;
    console.error("[RELATÓRIO] Falha fatal:", error);
    mostrarErroGeral(
      "Não foi possível carregar os relatórios. Verifique sua conexão."
    );
  }
}

// ==========================================
// LÓGICA DE NAVEGAÇÃO E RENDERIZAÇÃO
// ==========================================
function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) return;

  // Usa delegação de eventos para garantir que funcione sempre
  viewContainer.addEventListener("click", (e) => {
    // CLIQUE NA ABA
    const tabLink = e.target.closest(".tab-link");
    if (tabLink) {
      e.preventDefault();
      const idAba = tabLink.dataset.tab;
      ativarAbaComEspera(idAba);
      return;
    }

    // CLIQUE NO ACCORDION (Expandir/Recolher)
    const accordionHeader = e.target.closest(".accordion-header");
    if (accordionHeader) {
      e.preventDefault();
      toggleAccordion(accordionHeader);
    }
  });

  // Evento de Checkbox (Presença)
  viewContainer.addEventListener("change", (e) => {
    if (e.target.matches(".checkbox-presenca")) {
      marcarPresenca(e.target);
    }
  });
}

// NOVA FUNÇÃO: Ativa aba mas espera os dados estarem prontos
async function ativarAbaComEspera(tabId) {
  // 1. Se dados ainda estão carregando, aguarda
  if (estadoCarregamento.carregando && estadoCarregamento.promiseCarregamento) {
    console.log(
      `[RELATÓRIO] Dados ainda carregando, aguardando para aba: ${tabId}`
    );
    await estadoCarregamento.promiseCarregamento;
  }

  // 2. Só então ativa a aba
  ativarAba(tabId);
}

function ativarAba(tabId) {
  // 1. Manipula Classes CSS (Visual)
  document
    .querySelectorAll(".tab-link")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  const btn = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
  const content = document.getElementById(tabId);

  if (btn) btn.classList.add("active");
  if (content) content.classList.add("active");

  // 2. CHAMA A RENDERIZAÇÃO
  renderizarAbaAtiva();
}

function renderizarAbaAtiva() {
  if (!dadosCache.carregado) {
    console.log("[RELATÓRIO] Dados ainda não carregados, renderização adiada.");
    return;
  }

  // Descobre qual aba está ativa no HTML
  const abaAtiva = document.querySelector(".tab-content.active");
  if (!abaAtiva) return;

  const id = abaAtiva.id; // 'resumo', 'participacao', 'feedbacks', 'agendados'

  console.log(`[RELATÓRIO] Renderizando aba: ${id}`);

  // Verifica se o container existe dentro da aba
  const container = document.getElementById(`${id}-container`);
  if (!container) return;

  // Roteador de Renderização
  switch (id) {
    case "resumo":
      renderizarResumo(container);
      break;
    case "participacao":
      renderizarParticipacao(container);
      break;
    case "feedbacks":
      renderizarFeedbacks(container);
      break;
    case "agendados":
      renderizarAgendados(container);
      break;
  }
}

function exibirLoadingNaAbaAtiva() {
  const abaAtiva = document.querySelector(".tab-content.active");
  if (abaAtiva) {
    const container = abaAtiva.querySelector(".card");
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner"></div>
        <p style="text-align: center; color: var(--text-secondary, #666);">Carregando dados...</p>
      `;
    }
  }
}

// ==========================================
// FUNÇÕES DE RENDERIZAÇÃO (mantidas iguais)
// ==========================================

function renderizarResumo(container) {
  if (dadosCache.atas.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary, #666);">Nenhuma reunião registrada.</p>';
    return;
  }

  const totalReunioesUnicas = dadosCache.atas.length;
  const totalProfissionais = dadosCache.profissionais.length;

  const mediaSatisfacao =
    dadosCache.atas.reduce((acc, ata) => {
      const mediaAta =
        (Number(ata.clareza || 0) +
          Number(ata.objetivos || 0) +
          Number(ata.duracao || 0)) /
        3;
      return acc + mediaAta;
    }, 0) / totalReunioesUnicas || 0;

  const html = `
    <div class="card-header">
      <h3><span class="material-symbols-outlined">assessment</span> Resumo Geral</h3>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="material-symbols-outlined">groups</span>
        <h4>${totalReunioesUnicas}</h4>
        <p>Total de Reuniões</p>
      </div>
      <div class="stat-card">
        <span class="material-symbols-outlined">people</span>
        <h4>${totalProfissionais}</h4>
        <p>Profissionais</p>
      </div>
      <div class="stat-card success">
        <span class="material-symbols-outlined">mood</span>
        <h4>${mediaSatisfacao.toFixed(1)}</h4>
        <p>Satisfação Média</p>
      </div>
    </div>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Reunião</th>
            <th>Data</th>
            <th>Participantes</th>
          </tr>
        </thead>
        <tbody>
          ${dadosCache.atas
            .map(
              (ata) => `
            <tr>
              <td>${ata.titulo || "Reunião Técnica"}</td>
              <td>${formatarData(ata.dataReuniao)}</td>
              <td>${contarParticipantes(ata.participantes)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function renderizarParticipacao(container) {
  const profComStats = dadosCache.profissionais.map((p) => {
    const presencas = dadosCache.atas.filter((ata) =>
      ata.participantes?.some((par) => par.id === p.id && par.presente)
    ).length;

    const ausencias = dadosCache.atas.filter((ata) =>
      ata.participantes?.some((par) => par.id === p.id && !par.presente)
    ).length;

    const total = presencas + ausencias;
    const taxa = total > 0 ? (presencas / total) * 100 : 0;

    return { ...p, presencas, ausencias, taxa };
  });

  const totalPresencas = profComStats.reduce((acc, p) => acc + p.presencas, 0);
  const totalAusencias = profComStats.reduce((acc, p) => acc + p.ausencias, 0);
  const taxaMediaGlobal =
    totalPresencas + totalAusencias > 0
      ? (totalPresencas / (totalPresencas + totalAusencias)) * 100
      : 0;

  const html = `
    <div class="card-header">
      <h3><span class="material-symbols-outlined">check_circle</span> Resumo de Participação</h3>
    </div>
    <div class="stats-grid">
      <div class="stat-card success">
        <span class="material-symbols-outlined">done_all</span>
        <h4>${totalPresencas}</h4>
        <p>Total Presenças</p>
      </div>
      <div class="stat-card warning">
        <span class="material-symbols-outlined">cancel</span>
        <h4>${totalAusencias}</h4>
        <p>Total Ausências</p>
      </div>
      <div class="stat-card success">
        <span class="material-symbols-outlined">trending_up</span>
        <h4>${taxaMediaGlobal.toFixed(1)}%</h4>
        <p>Taxa Média Global</p>
      </div>
    </div>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Profissional</th>
            <th>Presenças</th>
            <th>Ausências</th>
            <th>Taxa</th>
          </tr>
        </thead>
        <tbody>
          ${profComStats
            .map(
              (p) => `
            <tr>
              <td>${p.nome}</td>
              <td>${p.presencas}</td>
              <td>${p.ausencias}</td>
              <td>${p.taxa.toFixed(1)}%</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function renderizarFeedbacks(container) {
  if (dadosCache.atas.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary, #666);">Nenhum feedback registrado.</p>';
    return;
  }

  const feedbacksHTML = dadosCache.atas
    .map(
      (ata) => `
    <div class="accordion-item">
      <button class="accordion-header">
        <span class="material-symbols-outlined">comment</span>
        <strong>${ata.titulo || "Reunião Técnica"}</strong>
        <span class="accordion-icon">›</span>
      </button>
      <div class="accordion-content">
        <div class="feedback-card">
          <div class="feedback-respostas">
            ${gerarRespostasFeedback(ata)}
          </div>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  const html = `
    <div class="card-header">
      <h3><span class="material-symbols-outlined">feedback</span> Feedbacks por Reunião</h3>
    </div>
    <div class="accordion">
      ${feedbacksHTML}
    </div>
  `;

  container.innerHTML = html;
}

function renderizarAgendados(container) {
  if (dadosCache.agendamentos.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary, #666);">Nenhum agendamento registrado.</p>';
    return;
  }

  const agendadosHTML = dadosCache.agendamentos
    .map((agend) => {
      const totalItens = agend.items?.length || 0;
      return `
    <div class="accordion-item">
      <button class="accordion-header">
        <span class="material-symbols-outlined">calendar_today</span>
        <strong>${agend.nome || "Agendamento"}</strong>
        <span class="badge">${totalItens} itens</span>
        <span class="accordion-icon">›</span>
      </button>
      <div class="accordion-content">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data/Hora</th>
                <th>Gestor</th>
                <th>Presença</th>
              </tr>
            </thead>
            <tbody>
              ${(agend.items || [])
                .map(
                  (item) => `
                <tr>
                  <td>${item.nome || "-"}</td>
                  <td>${formatarData(item.dataHora)}</td>
                  <td>${item.gestor || "-"}</td>
                  <td style="text-align: center;">
                    <input type="checkbox" class="checkbox-presenca" data-agendamento-id="${
                      agend.id
                    }" data-item-id="${item.id}" ${
                    item.presente ? "checked" : ""
                  }>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
    })
    .join("");

  const html = `
    <div class="card-header">
      <h3><span class="material-symbols-outlined">schedule</span> Agendados</h3>
    </div>
    <div class="accordion">
      ${agendadosHTML}
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function gerarRespostasFeedback(ata) {
  let html = "";

  for (const [key, label] of Object.entries(perguntasTexto)) {
    if (key === "sugestaoTema") {
      html += `<p><strong>${label}</strong><br><em>"${
        ata[key] || "-"
      }"</em></p>`;
    } else {
      html += `<p><strong>${label}</strong><br>${ata[key] || "N/A"}</p>`;
    }
  }

  return html;
}

function contarParticipantes(participantes) {
  return participantes ? participantes.length : 0;
}

function formatarData(data) {
  if (!data) return "-";

  try {
    if (typeof data === "object" && data.toDate) {
      return data.toDate().toLocaleDateString("pt-BR");
    }
    return new Date(data).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function toggleAccordion(header) {
  const item = header.closest(".accordion-item");
  if (item) {
    item.classList.toggle("active");
  }
}

function marcarPresenca(checkbox) {
  console.log("[RELATÓRIO] Presença marcada:", checkbox.checked);
  // Implementar salvamento em Firebase conforme necessário
}

function mostrarErroGeral(mensagem) {
  const abaAtiva = document.querySelector(".tab-content.active");
  if (abaAtiva) {
    const container = abaAtiva.querySelector(".card");
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
    }
  }
}
