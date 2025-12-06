// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 4.1 (Com debounce para evitar re-renderizações múltiplas)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
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

let unsubscribeAtas = null;
let unsubscribeProf = null;
let unsubscribeAgend = null;

// ✅ NOVO: Debounce para renderização
let renderTimeout = null;

const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
export function init() {
  console.log(
    "%c[RELATÓRIO] Init v4.1 - Com debounce.",
    "color:#00ff00; font-weight: bold;"
  );

  dadosCache = {
    atas: [],
    profissionais: [],
    agendamentos: [],
    carregado: false,
  };

  cleanup();
  setupEventListeners();
  exibirLoadingNaAbaAtiva();
  carregarDadosComListener();
}

// ==========================================
// LÓGICA DE DADOS (Listeners em tempo real)
// ==========================================
function carregarDadosComListener() {
  console.log("[RELATÓRIO] Configurando listeners em tempo real...");

  // Listener 1: Atas Técnicas
  const qAtas = query(
    collection(firestoreDb, "gestao_atas"),
    where("tipo", "==", "Reunião Técnica")
  );

  unsubscribeAtas = onSnapshot(
    qAtas,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT ATAS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );

      dadosCache.atas = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      marcarComoCarregado();
      renderizarComDebounce(); // ✅ MUDANÇA AQUI
    },
    (error) => {
      console.error("%c[RELATÓRIO] ❌ ERRO atas:", "color:#ff0000;", error);
      mostrarErroGeral("Erro ao carregar atas. Verifique sua conexão.");
    }
  );

  // Listener 2: Profissionais
  const qProf = query(collection(firestoreDb, "usuarios"), orderBy("nome"));

  unsubscribeProf = onSnapshot(
    qProf,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT PROFISSIONAIS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );

      dadosCache.profissionais = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      marcarComoCarregado();
      renderizarComDebounce(); // ✅ MUDANÇA AQUI
    },
    (error) => {
      console.error(
        "%c[RELATÓRIO] ❌ ERRO profissionais:",
        "color:#ff0000;",
        error
      );
    }
  );

  // Listener 3: Agendamentos
  const qAgend = query(
    collection(firestoreDb, "agendamentos_voluntarios"),
    orderBy("criadoEm", "desc")
  );

  unsubscribeAgend = onSnapshot(
    qAgend,
    (snapshot) => {
      console.log(
        `%c[RELATÓRIO] 🔥 SNAPSHOT AGENDAMENTOS: ${snapshot.docs.length} docs`,
        "color:#ff00ff; font-weight: bold;"
      );

      dadosCache.agendamentos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      marcarComoCarregado();
      renderizarComDebounce(); // ✅ MUDANÇA AQUI
    },
    (error) => {
      console.error(
        "%c[RELATÓRIO] ❌ ERRO agendamentos:",
        "color:#ff0000;",
        error
      );
    }
  );
}

// ✅ NOVA FUNÇÃO: Debounce para evitar múltiplas renderizações
function renderizarComDebounce() {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  renderTimeout = setTimeout(() => {
    console.log(
      "%c[RELATÓRIO] ⏱️ Debounce concluído - Renderizando...",
      "color:#ffaa00; font-weight: bold;"
    );
    renderizarAbaAtiva();
  }, 100); // Aguarda 100ms sem atualizações antes de renderizar
}

function marcarComoCarregado() {
  if (dadosCache.profissionais.length > 0) {
    const antes = dadosCache.carregado;
    dadosCache.carregado = true;

    if (!antes) {
      console.log(
        "%c[RELATÓRIO] ✅ DADOS CARREGADOS!",
        "color:#00ff00; font-weight: bold; font-size: 14px;"
      );
      console.log("[RELATÓRIO] Cache:", {
        atas: dadosCache.atas.length,
        profissionais: dadosCache.profissionais.length,
        agendamentos: dadosCache.agendamentos.length,
      });
    }
  }
}

// ==========================================
// LÓGICA DE NAVEGAÇÃO E RENDERIZAÇÃO
// ==========================================
function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  if (!viewContainer) {
    console.error("[RELATÓRIO] ❌ view-container não encontrado!");
    return;
  }

  viewContainer.addEventListener("click", (e) => {
    const tabLink = e.target.closest(".tab-link");
    if (tabLink) {
      e.preventDefault();
      const idAba = tabLink.dataset.tab;
      console.log(
        `%c[RELATÓRIO] 👆 Clique na aba: ${idAba}`,
        "color:#00aaff; font-weight: bold;"
      );
      ativarAba(idAba);
      return;
    }

    const accordionHeader = e.target.closest(".accordion-header");
    if (accordionHeader) {
      e.preventDefault();
      toggleAccordion(accordionHeader);
    }
  });

  viewContainer.addEventListener("change", (e) => {
    if (e.target.matches(".checkbox-presenca")) {
      marcarPresenca(e.target);
    }
  });
}

function ativarAba(tabId) {
  console.log(`[RELATÓRIO] >> ativarAba(${tabId})`);

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

  renderizarAbaAtiva();
}

function renderizarAbaAtiva() {
  const abaAtiva = document.querySelector(".tab-content.active");

  if (!abaAtiva) {
    console.warn("[RELATÓRIO] ⚠️ Nenhuma aba ativa encontrada!");
    return;
  }

  const id = abaAtiva.id;
  console.log(
    `%c[RELATÓRIO] 🎨 Renderizando aba: ${id}`,
    "color:#00ff00; font-weight: bold;"
  );

  if (!dadosCache.carregado) {
    console.log(
      `[RELATÓRIO] ⏳ Dados ainda não carregados. Mostrando loading...`
    );
    exibirLoadingNaAbaAtiva();
    return;
  }

  const container = abaAtiva.querySelector(".card");

  if (!container) {
    console.error(
      `%c[RELATÓRIO] ❌ Container .card não encontrado!`,
      "color:#ff0000; font-weight: bold;"
    );
    return;
  }

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

  console.log(
    "%c[RELATÓRIO] ✅ Renderização concluída!",
    "color:#00ff00; font-weight: bold;"
  );
}

function exibirLoadingNaAbaAtiva() {
  const abaAtiva = document.querySelector(".tab-content.active");
  if (abaAtiva) {
    const container = abaAtiva.querySelector(".card");
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner"></div>
            <p>Carregando dados...</p>
        </div>
      `;
    }
  }
}

// ==========================================
// FUNÇÕES DE DESENHO (VIEW)
// ==========================================

function renderizarResumo(container) {
  console.log("[RELATÓRIO] >>> renderizarResumo() <<<");
  const { atas, profissionais } = dadosCache;

  const atasOrdenadas = [...atas].sort(
    (a, b) =>
      new Date(formatarData(b.dataReuniao)) -
      new Date(formatarData(a.dataReuniao))
  );
  const reunioesRecentes = atasOrdenadas.slice(0, 5);

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">analytics</span> Resumo Geral</h3>
    </div>
    <div class="card-body">
        <div class="stats-grid">
            <div class="stat-card">
                <span class="material-symbols-outlined">event</span>
                <h4>${atas.length}</h4>
                <p>Total de Reuniões</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">group</span>
                <h4>${profissionais.length}</h4>
                <p>Profissionais</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">thumb_up</span>
                <h4>${calcularMediaFeedbacks(atas)}%</h4>
                <p>Satisfação Média</p>
            </div>
        </div>
        <div class="table-container mt-3">
            <h5 class="mb-3">Últimas Reuniões Realizadas</h5>
            <table class="table">
                <thead><tr><th>Reunião</th><th>Data</th><th>Participantes</th></tr></thead>
                <tbody>
                    ${reunioesRecentes
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
    </div>
  `;

  console.log(
    `[RELATÓRIO] HTML inserido (${container.innerHTML.length} caracteres)`
  );
}

function renderizarParticipacao(container) {
  console.log("[RELATÓRIO] >>> renderizarParticipacao() <<<");
  const { atas, profissionais } = dadosCache;

  const stats = calcularEstatisticasParticipacao(atas, profissionais);

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">group</span> Resumo de Participação</h3>
    </div>
    <div class="card-body">
        <div class="stats-grid">
            <div class="stat-card success">
                <span class="material-symbols-outlined">check_circle</span>
                <h4>${stats.totalPresencas}</h4>
                <p>Total Presenças</p>
            </div>
            <div class="stat-card warning">
                <span class="material-symbols-outlined">warning</span>
                <h4>${stats.totalAusencias}</h4>
                <p>Total Ausências</p>
            </div>
            <div class="stat-card">
                <span class="material-symbols-outlined">leaderboard</span>
                <h4>${stats.taxaMedia}%</h4>
                <p>Taxa Média Global</p>
            </div>
        </div>
        <div class="table-container mt-3">
             <div class="d-flex justify-content-between align-items-center mb-2">
                <h5>Ranking de Presença (Top 10)</h5>
                <button class="btn btn-primary btn-sm" onclick="exportarRelatorioParticipacao()">Exportar CSV</button>
            </div>
            <table class="table">
                <thead><tr><th>Profissional</th><th>Presenças</th><th>Ausências</th><th>Taxa</th></tr></thead>
                <tbody>
                    ${stats.ranking
                      .slice(0, 10)
                      .map(
                        (p) => `
                        <tr>
                            <td>${p.nome}</td>
                            <td>${p.presencas}</td>
                            <td>${p.ausencias}</td>
                            <td><strong>${p.taxa.toFixed(1)}%</strong></td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    </div>
  `;
}

function renderizarFeedbacks(container) {
  console.log("[RELATÓRIO] >>> renderizarFeedbacks() <<<");
  const { atas, profissionais } = dadosCache;

  const atasComFeedback = atas
    .filter((a) => a.feedbacks && a.feedbacks.length > 0)
    .sort(
      (a, b) =>
        new Date(formatarData(b.dataReuniao)) -
        new Date(formatarData(a.dataReuniao))
    );

  if (atasComFeedback.length === 0) {
    container.innerHTML =
      '<div class="card-body"><div class="alert alert-info">Nenhum feedback registrado até o momento.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">feedback</span> Feedbacks Detalhados</h3>
    </div>
    <div class="card-body">
        <div class="accordion">
            ${atasComFeedback
              .map(
                (ata) => `
                <div class="accordion-item">
                    <button class="accordion-header" type="button">
                        <span class="material-symbols-outlined">event</span>
                        ${ata.titulo || "Reunião"} - ${formatarData(
                  ata.dataReuniao
                )}
                        <span class="badge ms-2">${
                          ata.feedbacks.length
                        } feedbacks</span>
                        <span class="accordion-icon">+</span>
                    </button>
                    <div class="accordion-content">
                        <div class="feedback-list mt-3">
                            ${ata.feedbacks
                              .map((fb) =>
                                renderCardFeedback(fb, profissionais)
                              )
                              .join("")}
                        </div>
                    </div>
                </div>
            `
              )
              .join("")}
        </div>
    </div>
  `;
}

function renderCardFeedback(fb, profissionais) {
  let nome = fb.profissional || fb.nome || "Anônimo";
  if (fb.profissionalId) {
    const found = profissionais.find((p) => p.id === fb.profissionalId);
    if (found) nome = found.nome;
  }

  const respostasHtml = Object.entries(perguntasTexto)
    .map(
      ([key, label]) =>
        `<p class="mb-1"><small><strong>${label}</strong></small><br>${
          fb[key] || "N/A"
        }</p>`
    )
    .join("");

  return `
    <div class="feedback-card p-3 mb-3 border rounded bg-light">
        <h6 class="text-primary mb-2">${nome}</h6>
        ${respostasHtml}
        ${
          fb.sugestaoTema
            ? `<p class="mt-2 text-muted"><em>" ${fb.sugestaoTema} "</em></p>`
            : ""
        }
    </div>
  `;
}

function renderizarAgendados(container) {
  console.log("[RELATÓRIO] >>> renderizarAgendados() <<<");
  const { agendamentos, profissionais } = dadosCache;

  if (!agendamentos || agendamentos.length === 0) {
    container.innerHTML =
      '<div class="card-body"><div class="alert alert-info">Nenhum agendamento encontrado.</div></div>';
    return;
  }

  const listaAgendamentos = agendamentos.map((ag) => {
    const totalInscritos = (ag.slots || []).reduce(
      (acc, slot) => acc + (slot.vagas ? slot.vagas.length : 0),
      0
    );
    return { ...ag, totalInscritos };
  });

  container.innerHTML = `
    <div class="card-header">
        <h3><span class="material-symbols-outlined">event_available</span> Lista de Agendamentos</h3>
    </div>
    <div class="card-body">
        <div class="accordion">
            ${listaAgendamentos
              .map(
                (ag) => `
                <div class="accordion-item">
                    <button class="accordion-header" type="button">
                        <span class="material-symbols-outlined">schedule</span>
                        ${
                          ag.tipo || "Agendamento"
                        } <small class="text-muted ms-2">Criado em ${formatarData(
                  ag.criadoEm
                )}</small>
                        <span class="badge ms-auto">${
                          ag.totalInscritos
                        } inscritos</span>
                        <span class="accordion-icon ms-2">+</span>
                    </button>
                    <div class="accordion-content">
                        <div class="table-responsive mt-3">
                            <table class="table table-sm">
                                <thead><tr><th>Nome</th><th>Data/Hora</th><th>Gestor</th><th>Presença</th></tr></thead>
                                <tbody>
                                    ${renderLinhasInscritos(ag, profissionais)}
                                </tbody>
                            </table>
                        </div>
                        <button class="btn btn-outline-primary btn-sm mt-2" onclick="exportarAgendados('${
                          ag.id
                        }')">Download Lista (CSV)</button>
                    </div>
                </div>
            `
              )
              .join("")}
        </div>
    </div>
  `;
}

function renderLinhasInscritos(agendamento, profissionais) {
  let html = "";
  (agendamento.slots || []).forEach((slot) => {
    (slot.vagas || []).forEach((vaga) => {
      let nome = vaga.nome || "Desconhecido";
      if (vaga.profissionalId) {
        const p = profissionais.find((prof) => prof.id === vaga.profissionalId);
        if (p) nome = p.nome;
      }

      html += `
        <tr>
            <td>${nome}</td>
            <td>${formatarData(slot.data)} <small>(${
        slot.horaInicio
      })</small></td>
            <td>${slot.gestorNome || "-"}</td>
            <td class="text-center">
                <input type="checkbox" class="checkbox-presenca" 
                    ${vaga.presente ? "checked" : ""}
                    data-agendamento-id="${agendamento.id}"
                    data-slot-data="${slot.data}"
                    data-slot-hora-inicio="${slot.horaInicio}"
                    data-vaga-id="${vaga.id || ""}">
            </td>
        </tr>
      `;
    });
  });

  if (html === "")
    return '<tr><td colspan="4" class="text-center text-muted">Nenhum inscrito neste agendamento.</td></tr>';
  return html;
}

// ==========================================
// HELPERS E UTILITÁRIOS
// ==========================================

function formatarData(data) {
  if (!data) return "-";
  try {
    if (data.toDate) return data.toDate().toLocaleDateString("pt-BR");
    if (typeof data === "string" && data.includes("-")) {
      const [ano, mes, dia] = data.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    return new Date(data).toLocaleDateString("pt-BR");
  } catch (e) {
    return data;
  }
}

function contarParticipantes(participantes) {
  if (!participantes) return 0;
  if (Array.isArray(participantes)) return participantes.length;
  if (typeof participantes === "string") return participantes.split(",").length;
  return 0;
}

function toggleAccordion(header) {
  const item = header.closest(".accordion-item");
  const content = header.nextElementSibling;
  const icon = header.querySelector(".accordion-icon");

  const isOpen = item.classList.toggle("active");

  if (content) {
    content.style.maxHeight = isOpen
      ? content.scrollHeight + 100 + "px"
      : "0px";
  }
  if (icon) icon.textContent = isOpen ? "−" : "+";
}

function calcularMediaFeedbacks(atas) {
  let totalPts = 0,
    count = 0;
  atas.forEach((ata) => {
    (ata.feedbacks || []).forEach((fb) => {
      if (fb.clareza === "Sim") totalPts++;
      if (fb.objetivos === "Sim") totalPts++;
      if (fb.duracao === "Sim") totalPts++;
      count += 3;
    });
  });
  return count > 0 ? Math.round((totalPts / count) * 100) : 0;
}

function calcularEstatisticasParticipacao(atas, profissionais) {
  const stats = {};
  profissionais.forEach(
    (p) => (stats[p.nome] = { nome: p.nome, presencas: 0, ausencias: 0 })
  );

  atas.forEach((ata) => {
    let presentes = [];
    if (Array.isArray(ata.participantes)) presentes = ata.participantes;
    else if (typeof ata.participantes === "string")
      presentes = ata.participantes.split(",").map((s) => s.trim());

    profissionais.forEach((p) => {
      if (presentes.includes(p.nome)) stats[p.nome].presencas++;
      else stats[p.nome].ausencias++;
    });
  });

  const ranking = Object.values(stats)
    .map((s) => ({
      ...s,
      taxa:
        s.presencas + s.ausencias > 0
          ? (s.presencas / (s.presencas + s.ausencias)) * 100
          : 0,
    }))
    .sort((a, b) => b.taxa - a.taxa);

  const totalP = ranking.reduce((acc, curr) => acc + curr.presencas, 0);
  const totalA = ranking.reduce((acc, curr) => acc + curr.ausencias, 0);
  const totalGeral = totalP + totalA;

  return {
    ranking,
    totalPresencas: totalP,
    totalAusencias: totalA,
    taxaMedia: totalGeral > 0 ? ((totalP / totalGeral) * 100).toFixed(1) : 0,
  };
}

function mostrarErroGeral(msg) {
  const activeContainer = document.querySelector(".tab-content.active .card");
  if (activeContainer) {
    activeContainer.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
  }
}

// ==========================================
// AÇÕES DE DADOS (WRITE)
// ==========================================

async function marcarPresenca(checkbox) {
  const { agendamentoId, slotData, slotHoraInicio, vagaId } = checkbox.dataset;
  const presente = checkbox.checked;

  try {
    const agendamentoRef = doc(
      firestoreDb,
      "agendamentos_voluntarios",
      agendamentoId
    );
    const agendSnap = await getDoc(agendamentoRef);

    if (!agendSnap.exists()) throw new Error("Agendamento não existe mais");

    const dados = agendSnap.data();
    const slotIdx = dados.slots.findIndex(
      (s) => s.data === slotData && s.horaInicio === slotHoraInicio
    );

    if (slotIdx === -1) throw new Error("Slot não encontrado");

    let vagaFound = false;
    if (dados.slots[slotIdx].vagas) {
      const vagaIdx = dados.slots[slotIdx].vagas.findIndex(
        (v) => v.id === vagaId || (vagaId === "" && v.profissionalId)
      );

      if (vagaIdx !== -1) {
        dados.slots[slotIdx].vagas[vagaIdx].presente = presente;
        vagaFound = true;
      }
    }

    if (vagaFound) {
      await updateDoc(agendamentoRef, { slots: dados.slots });
      console.log("Presença salva!");

      const row = checkbox.closest("tr");
      row.style.backgroundColor = presente ? "#d1e7dd" : "";
      setTimeout(() => (row.style.backgroundColor = ""), 1000);
    }
  } catch (err) {
    console.error("Erro ao marcar presença:", err);
    checkbox.checked = !presente;
    alert("Erro ao salvar presença. Tente novamente.");
  }
}

// ==========================================
// EXPORTS GLOBAIS
// ==========================================
window.exportarRelatorioParticipacao = function () {
  if (!dadosCache.carregado) return;
  const stats = calcularEstatisticasParticipacao(
    dadosCache.atas,
    dadosCache.profissionais
  );
  let csv = "Nome,Presencas,Ausencias,Taxa(%)\n";
  stats.ranking.forEach((r) => {
    csv += `"${r.nome}",${r.presencas},${r.ausencias},${r.taxa.toFixed(1)}\n`;
  });
  downloadCSV(csv, "participacao_geral.csv");
};

window.exportarAgendados = function (id) {
  const ag = dadosCache.agendamentos.find((a) => a.id === id);
  if (!ag) return;

  let csv = "Participante,Data,Hora,Gestor,Presenca\n";
  (ag.slots || []).forEach((slot) => {
    (slot.vagas || []).forEach((v) => {
      let nome = v.nome || "Desconhecido";
      if (v.profissionalId) {
        const p = dadosCache.profissionais.find(
          (prof) => prof.id === v.profissionalId
        );
        if (p) nome = p.nome;
      }
      csv += `"${nome}","${formatarData(slot.data)}","${slot.horaInicio}","${
        slot.gestorNome
      }",${v.presente ? "Sim" : "Nao"}\n`;
    });
  });
  downloadCSV(csv, `agendamento_${id}.csv`);
};

function downloadCSV(content, fileName) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function cleanup() {
  console.log("[RELATÓRIO] Desinscrever listeners...");
  if (unsubscribeAtas) unsubscribeAtas();
  if (unsubscribeProf) unsubscribeProf();
  if (unsubscribeAgend) unsubscribeAgend();

  // ✅ Limpa timeout pendente
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }

  console.log("[RELATÓRIO] Listeners desinscritos.");
}
