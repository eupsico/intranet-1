/**
 * Arquivo: modulos/rh/js/recrutamento.js
 * Versão: 3.0.0 (Revisão Completa - Organização e Otimização)
 * Data: 04/11/2025
 * Descrição: Controlador principal do módulo de Recrutamento e Seleção
 */

import {
  db,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
  arrayUnion,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

// Importação dos módulos de abas (tabs)
import { renderizarCronograma } from "./tabs/tabCronograma.js";
import { renderizarTriagem } from "./tabs/tabTriagem.js";
import { renderizarEntrevistas } from "./tabs/tabEntrevistas.js";
import { renderizarEntrevistaGestor } from "./tabs/tabGestor.js";
import { renderizarFinalizados } from "./tabs/tabFinalizados.js";

// ============================================
// CONSTANTES E COLEÇÕES DO FIRESTORE
// ============================================
const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATOS_COLLECTION_NAME = "candidaturas";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);

// ============================================
// ELEMENTOS DO DOM (CACHE)
// ============================================
const filtroVaga = document.getElementById("filtro-vaga");
const statusCandidaturaTabs = document.getElementById(
  "status-candidatura-tabs"
);
const conteudoRecrutamento = document.getElementById("conteudo-recrutamento");
const btnGerenciarConteudo = document.getElementById("btn-gestao-conteudo");

const modalCandidato = document.getElementById("modal-candidato");
const modalCandidatoBody = document.getElementById("candidato-modal-body");
const modalCandidatoFooter = document.getElementById("candidato-modal-footer");

// ============================================
// VARIÁVEIS DE ESTADO GLOBAL
// ============================================
let vagaSelecionadaId = null;
let currentUserData = {};
let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Formata um Timestamp do Firestore para data legível
 * @param {Object|Date} timestamp - Timestamp do Firestore ou objeto Date
 * @returns {string} Data formatada em pt-BR
 */
function formatarTimestamp(timestamp) {
  if (!timestamp) return "N/A";

  try {
    const date = timestamp.toDate
      ? timestamp.toDate()
      : typeof timestamp.seconds === "number"
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (error) {
    console.error("Erro ao formatar timestamp:", error);
    return "Data inválida";
  }
}

/**
 * Retorna o estado global para uso em módulos filhos
 * @returns {Object} Estado global compartilhado
 */
export const getGlobalState = () => ({
  vagaSelecionadaId,
  currentUserData,
  candidatosCollection,
  vagasCollection,
  formatarTimestamp,
  conteudoRecrutamento,
  statusCandidaturaTabs,
  handleTabClick,
});

// ============================================
// CARREGAMENTO DE VAGAS
// ============================================

/**
 * Carrega lista de vagas ativas no filtro
 */
async function carregarVagasAtivas() {
  if (!filtroVaga) {
    console.warn("⚠️ Recrutamento: Elemento filtro-vaga não encontrado");
    return;
  }

  console.log("🔹 Recrutamento: Carregando vagas ativas...");

  try {
    // Query para vagas em processo de recrutamento
    const statusValidos = [
      "em-divulgacao",
      "Em Divulgação",
      "Cronograma Pendente",
      "Cronograma Definido (Triagem Pendente)",
      "Entrevista RH Pendente",
      "Testes Pendente",
      "Entrevista Gestor Pendente",
      "Contratado",
      "Encerrada",
    ];

    // Tenta primeiro com campo "status"
    let q = query(vagasCollection, where("status", "in", statusValidos));
    let snapshot = await getDocs(q);

    // Se não encontrar, tenta com campo "status_vaga"
    if (snapshot.empty) {
      q = query(vagasCollection, where("status_vaga", "in", statusValidos));
      snapshot = await getDocs(q);
    }

    // Monta as opções do select
    let htmlOptions = '<option value="">Selecione uma Vaga...</option>';

    if (snapshot.empty) {
      htmlOptions =
        '<option value="">Nenhuma vaga em processo de recrutamento.</option>';
      console.log("ℹ️ Recrutamento: Nenhuma vaga ativa encontrada");
    } else {
      snapshot.docs.forEach((docSnap) => {
        const vaga = docSnap.data();
        const titulo =
          vaga.titulo_vaga || vaga.nome || vaga.titulo || "Vaga sem título";
        const status = vaga.status_vaga || vaga.status || "Status desconhecido";

        htmlOptions += `<option value="${docSnap.id}">${titulo} - (${status})</option>`;
      });
      console.log(`✅ Recrutamento: ${snapshot.size} vagas carregadas`);
    }

    filtroVaga.innerHTML = htmlOptions;

    // Verifica se há vaga na URL (ex: ?vaga=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const vagaFromUrl = urlParams.get("vaga");

    if (vagaFromUrl && snapshot.docs.some((d) => d.id === vagaFromUrl)) {
      vagaSelecionadaId = vagaFromUrl;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    } else if (snapshot.size > 0 && filtroVaga.options.length > 1) {
      // Seleciona a primeira vaga automaticamente
      vagaSelecionadaId = snapshot.docs[0].id;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    }

    // Verifica se há etapa na URL (ex: ?etapa=triagem)
    const etapaFromUrl = urlParams.get("etapa");
    if (etapaFromUrl) {
      const targetTab = statusCandidaturaTabs.querySelector(
        `[data-status="${etapaFromUrl}"]`
      );
      if (targetTab) {
        handleTabClick({ currentTarget: targetTab });
      }
    }
  } catch (error) {
    console.error("❌ Recrutamento: Erro ao carregar vagas:", error);
    window.showToast?.("Erro ao carregar lista de vagas.", "error");

    filtroVaga.innerHTML =
      '<option value="">Erro ao carregar vagas. Tente novamente.</option>';
  }
}

// ============================================
// MODAL DE DETALHES DO CANDIDATO
// ============================================

/**
 * Abre modal com detalhes completos do candidato
 * @param {string} candidatoId - ID do documento do candidato
 * @param {string} modo - Modo de visualização (detalhes, editar, etc.)
 * @param {Object} candidato - Dados do candidato (opcional)
 */
export async function abrirModalCandidato(candidatoId, modo, candidato) {
  if (!modalCandidato || !modalCandidatoBody) {
    console.error("❌ Recrutamento: Modal de candidato não encontrado");
    return;
  }

  console.log(`🔹 Recrutamento: Abrindo modal para candidato ${candidatoId}`);

  // Se os dados não foram passados, busca no Firestore
  if (!candidato) {
    modalCandidatoBody.innerHTML = '<div class="loading-spinner"></div>';
    modalCandidato.classList.add("is-visible");

    try {
      const candSnap = await getDoc(doc(candidatosCollection, candidatoId));
      if (!candSnap.exists()) {
        modalCandidatoBody.innerHTML =
          '<p class="alert alert-error">Candidatura não encontrada.</p>';
        return;
      }
      candidato = candSnap.data();
    } catch (error) {
      console.error("❌ Erro ao carregar candidato:", error);
      modalCandidatoBody.innerHTML =
        '<p class="alert alert-error">Erro ao carregar os detalhes da candidatura.</p>';
      return;
    }
  }

  dadosCandidatoAtual = candidato;

  // Atualiza título do modal
  document.getElementById("candidato-nome-titulo").textContent = `Detalhes: ${
    candidato.nome_completo || "Candidato(a)"
  }`;

  // Monta o conteúdo com fieldsets
  const contentHtml = `
    <div class="row">
      <!-- Coluna 1: Informações Pessoais -->
      <div class="col-lg-6">
        <fieldset>
          <legend><i class="fas fa-user me-2"></i>Informações Pessoais</legend>
          <div class="details-grid">
            <p class="card-text">
              <strong>Nome Completo:</strong><br>
              <span style="color: var(--cor-primaria); font-weight: 600;">${
                candidato.nome_completo || "N/A"
              }</span>
            </p>
            <p class="card-text">
              <strong>Email:</strong><br>
              <span>${candidato.email_candidato || "N/A"}</span>
            </p>
            <p class="card-text">
              <strong>Telefone (WhatsApp):</strong><br>
              <span>${candidato.telefone_contato || "N/A"}</span>
            </p>
            <p class="card-text">
              <strong>Localidade:</strong><br>
              <span>${candidato.cidade || "N/A"} / ${
    candidato.estado || "N/A"
  }</span>
            </p>
            <p class="card-text">
              <strong>Como Conheceu a EuPsico:</strong><br>
              <span>${candidato.como_conheceu || "N/A"}</span>
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend><i class="fas fa-briefcase me-2"></i>Experiência Profissional</legend>
          <div class="details-grid">
            <p class="card-text">
              <strong>Resumo da Experiência:</strong><br>
              <span class="text-muted">${
                candidato.resumo_experiencia || "Não informado"
              }</span>
            </p>
            <p class="card-text">
              <strong>Habilidades/Competências:</strong><br>
              <span class="text-muted">${
                candidato.habilidades_competencias || "Não informadas"
              }</span>
            </p>
          </div>
        </fieldset>
      </div>

      <!-- Coluna 2: Status e Avaliações -->
      <div class="col-lg-6">
        <fieldset>
          <legend><i class="fas fa-clipboard-check me-2"></i>Status Atual</legend>
          <div class="details-grid">
            <p class="card-text">
              <strong>Vaga Aplicada:</strong><br>
              <span>${candidato.titulo_vaga_original || "N/A"}</span>
            </p>
            <p class="card-text">
              <strong>Status do Recrutamento:</strong><br>
              <span class="status-badge ${getStatusBadgeClass(
                candidato.status_recrutamento
              )}">${candidato.status_recrutamento || "N/A"}</span>
            </p>
            <p class="card-text">
              <strong>Data da Candidatura:</strong><br>
              <span>${formatarTimestamp(candidato.data_candidatura)}</span>
            </p>
          </div>
        </fieldset>

        ${
          candidato.triagem_rh
            ? `
        <fieldset>
          <legend><i class="fas fa-search me-2"></i>Triagem de Currículo</legend>
          <div class="details-grid">
            <p class="card-text">
              <strong>Resultado:</strong><br>
              <span class="status-badge ${
                candidato.triagem_rh.apto_entrevista === "Sim"
                  ? "status-concluída"
                  : "status-rejeitada"
              }">${candidato.triagem_rh.apto_entrevista || "N/A"}</span>
            </p>
            <p class="card-text">
              <strong>Data da Avaliação:</strong><br>
              <span>${formatarTimestamp(
                candidato.triagem_rh.data_avaliacao
              )}</span>
            </p>
            <p class="card-text">
              <strong>Pré-requisitos Atendidos:</strong><br>
              <span class="text-muted">${
                candidato.triagem_rh.prerequisitos_atendidos || "N/A"
              }</span>
            </p>
            ${
              candidato.triagem_rh.motivo_rejeicao
                ? `
            <p class="card-text">
              <strong>Motivo da Reprovação:</strong><br>
              <span class="text-muted">${candidato.triagem_rh.motivo_rejeicao}</span>
            </p>
            `
                : ""
            }
            ${
              candidato.triagem_rh.info_aprovacao
                ? `
            <p class="card-text">
              <strong>Informações da Aprovação:</strong><br>
              <span class="text-muted">${candidato.triagem_rh.info_aprovacao}</span>
            </p>
            `
                : ""
            }
          </div>
        </fieldset>
        `
            : '<p class="alert alert-info">Triagem ainda não realizada.</p>'
        }

        ${
          candidato.entrevista_rh
            ? `
        <fieldset>
          <legend><i class="fas fa-comments me-2"></i>Entrevista com RH</legend>
          <div class="details-grid">
            ${
              candidato.entrevista_rh.agendamento
                ? `
            <p class="card-text">
              <strong>Agendamento:</strong><br>
              <span>${candidato.entrevista_rh.agendamento.data} às ${candidato.entrevista_rh.agendamento.hora}</span>
            </p>
            `
                : ""
            }
            ${
              candidato.entrevista_rh.resultado
                ? `
            <p class="card-text">
              <strong>Resultado:</strong><br>
              <span class="status-badge ${
                candidato.entrevista_rh.resultado === "Aprovado"
                  ? "status-concluída"
                  : "status-rejeitada"
              }">${candidato.entrevista_rh.resultado}</span>
            </p>
            `
                : ""
            }
            ${
              candidato.entrevista_rh.notas
                ? `
            <p class="card-text">
              <strong>Notas da Entrevista:</strong><br>
              Motivação: <strong>${
                candidato.entrevista_rh.notas.motivacao || "N/A"
              }</strong> | 
              Aderência: <strong>${
                candidato.entrevista_rh.notas.aderencia || "N/A"
              }</strong> | 
              Comunicação: <strong>${
                candidato.entrevista_rh.notas.comunicacao || "N/A"
              }</strong>
            </p>
            `
                : ""
            }
            ${
              candidato.entrevista_rh.pontos_fortes
                ? `
            <p class="card-text">
              <strong>Pontos Fortes:</strong><br>
              <span class="text-muted">${candidato.entrevista_rh.pontos_fortes}</span>
            </p>
            `
                : ""
            }
            ${
              candidato.entrevista_rh.pontos_atencao
                ? `
            <p class="card-text">
              <strong>Pontos de Atenção:</strong><br>
              <span class="text-muted">${candidato.entrevista_rh.pontos_atencao}</span>
            </p>
            `
                : ""
            }
          </div>
        </fieldset>
        `
            : ""
        }

        ${
          candidato.rejeicao?.etapa
            ? `
        <fieldset style="border-color: var(--cor-erro);">
          <legend style="color: var(--cor-erro);"><i class="fas fa-times-circle me-2"></i>Rejeição Registrada</legend>
          <div class="details-grid">
            <p class="card-text">
              <strong>Etapa:</strong><br>
              <span>${candidato.rejeicao.etapa}</span>
            </p>
            <p class="card-text">
              <strong>Data:</strong><br>
              <span>${formatarTimestamp(candidato.rejeicao.data)}</span>
            </p>
            <p class="card-text">
              <strong>Justificativa:</strong><br>
              <span class="text-muted">${
                candidato.rejeicao.justificativa || "N/A"
              }</span>
            </p>
          </div>
        </fieldset>
        `
            : ""
        }
      </div>
    </div>
  `;

  modalCandidatoBody.innerHTML = contentHtml;

  // Atualiza o footer com botão de currículo e fechar
  const linkCurriculo = candidato.link_curriculo_drive || "#";
  modalCandidatoFooter.innerHTML = `
    <a href="${linkCurriculo}" target="_blank" 
       class="action-button info me-auto" 
       ${!candidato.link_curriculo_drive ? "disabled" : ""}>
      <i class="fas fa-file-pdf me-2"></i> Ver Currículo
    </a>
    <button type="button" class="action-button secondary fechar-modal-candidato">
      <i class="fas fa-times me-2"></i> Fechar
    </button>
  `;

  // Anexa listener ao botão de fechar
  const btnFechar = modalCandidatoFooter.querySelector(
    ".fechar-modal-candidato"
  );
  if (btnFechar) {
    btnFechar.addEventListener("click", () => {
      modalCandidato.classList.remove("is-visible");
    });
  }

  // Exibe o modal
  modalCandidato.classList.add("is-visible");
  console.log("✅ Recrutamento: Modal de detalhes aberto");
}

/**
 * Retorna a classe CSS apropriada para o badge de status
 * @param {string} status - Status do candidato
 * @returns {string} Classe CSS
 */
function getStatusBadgeClass(status) {
  if (!status) return "status-pendente";

  const statusLower = status.toLowerCase();

  if (statusLower.includes("aprovad") || statusLower.includes("contratad")) {
    return "status-concluída";
  } else if (statusLower.includes("rejeit") || statusLower.includes("reprov")) {
    return "status-rejeitada";
  } else {
    return "status-pendente";
  }
}

// Expõe a função globalmente
window.abrirModalCandidato = abrirModalCandidato;

/**
 * Alterna visibilidade dos campos de avaliação de teste (ex: gestor) baseado no resultado
 */
window.toggleCamposAvaliacaoTeste = function () {
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  const resultadoSelecionado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const gestorContainer = document.getElementById(
    "avaliacao-teste-gestor-container"
  );

  if (!gestorContainer) return;

  if (resultadoSelecionado === "Aprovado") {
    gestorContainer.style.display = "block";
  } else {
    gestorContainer.style.display = "none";
  }
};

/**
 * Carrega histórico de tokens/testes enviados para um candidato (Aba Histórico)
 * @param {string} candidatoId - ID do candidato
 */
async function carregarHistoricoTokens(candidatoId) {
  const container = document.getElementById("avaliacao-teste-historico-tokens");
  if (!container) return;

  try {
    container.innerHTML =
      '<p class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Carregando histórico...</p>';

    const candidaturaRef = doc(candidatosCollection, candidatoId);
    const candidaturaSnap = await getDoc(candidaturaRef);

    if (!candidaturaSnap.exists()) {
      container.innerHTML =
        '<p class="text-danger">Candidatura não encontrada.</p>';
      return;
    }

    const dados = candidaturaSnap.data();
    const tokensAccesso = dados.testesenviados || [];

    if (tokensAccesso.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          Nenhum token de acesso foi enviado para este candidato ainda.
        </div>
      `;
      return;
    }

    let historicoHtml = '<div class="tokens-historico">';
    historicoHtml += `<h6 class="mb-3"><i class="fas fa-history me-2"></i>Total de Testes: ${tokensAccesso.length}</h6>`;

    tokensAccesso.forEach((token, index) => {
      const status = token.status || "enviado";
      let badgeClass = "bg-warning";
      let statusTexto = "Pendente";

      if (status === "respondido") {
        badgeClass = "bg-success";
        statusTexto = "Respondido";
      } else if (status === "avaliado") {
        badgeClass = "bg-info";
        statusTexto = "Avaliado";
      }

      const dataEnvio = token.dataenvio?.toDate
        ? token.dataenvio.toDate().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "N/A";

      historicoHtml += `
        <div class="card mb-2">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="card-title">${index + 1}. ${
        token.nomeTeste || "Teste"
      }</h6>
                <p class="card-text text-muted small mb-1">
                  <i class="fas fa-calendar me-1"></i><strong>Enviado:</strong> ${dataEnvio}
                </p>
                <p class="card-text text-muted small mb-1">
                  <i class="fas fa-user me-1"></i><strong>Por:</strong> ${
                    token.enviadopor || "N/A"
                  }
                </p>
                ${
                  token.tempoGasto !== undefined
                    ? `
                  <p class="card-text text-muted small mb-1">
                    <i class="fas fa-hourglass-end me-1"></i><strong>Tempo Gasto:</strong> ${Math.floor(
                      token.tempoGasto / 60
                    )}m ${token.tempoGasto % 60}s
                  </p>
                `
                    : ""
                }
              </div>
              <span class="badge ${badgeClass}">${statusTexto}</span>
            </div>
          </div>
        </div>
      `;
    });

    historicoHtml += "</div>";
    container.innerHTML = historicoHtml;
  } catch (error) {
    console.error("Erro ao carregar histórico de tokens:", error);
    container.innerHTML = `
      <p class="text-danger small">
        <i class="fas fa-exclamation-circle me-2"></i>
        Erro ao carregar histórico: ${error.message}
      </p>
    `;
  }
}

/**
 * Carrega dashboard com estatísticas de testes do candidato (Aba Dashboard)
 * @param {string} candidatoId - ID do candidato
 */
async function carregarDashboardTeste(candidatoId) {
  const container = document.getElementById("avaliacao-teste-dashboard");
  if (!container) return;

  try {
    container.innerHTML =
      '<p class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Carregando dados...</p>';

    const candidaturaRef = doc(candidatosCollection, candidatoId);
    const candidaturaSnap = await getDoc(candidaturaRef);

    if (!candidaturaSnap.exists()) {
      container.innerHTML =
        '<p class="text-danger">Candidatura não encontrada.</p>';
      return;
    }

    const dados = candidaturaSnap.data();
    const tokensAccesso = dados.testesenviados || [];

    let dashboardHtml = '<div class="dashboard-testes">';

    // Contadores
    const totalTestes = tokensAccesso.length;
    const testsRespondidos = tokensAccesso.filter(
      (t) => t.status === "respondido" || t.status === "avaliado"
    ).length;
    const testsPendentes = totalTestes - testsRespondidos;
    const taxaRespostaPct =
      totalTestes > 0 ? Math.round((testsRespondidos / totalTestes) * 100) : 0;

    // Tempo médio
    let tempoTotal = 0;
    let testComTempo = 0;
    tokensAccesso.forEach((t) => {
      if (t.tempoGasto) {
        tempoTotal += t.tempoGasto;
        testComTempo++;
      }
    });
    const tempoMedio =
      testComTempo > 0 ? Math.round(tempoTotal / testComTempo) : 0;

    // Cards de estatísticas
    dashboardHtml += `
      <div class="row mb-3">
        <div class="col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background-color: #0078d4;">
              <i class="fas fa-file-alt"></i>
            </div>
            <div class="stat-content">
              <p class="stat-label">Total de Testes</p>
              <p class="stat-value">${totalTestes}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background-color: #28a745;">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-content">
              <p class="stat-label">Respondidos</p>
              <p class="stat-value">${testsRespondidos}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background-color: #ffc107;">
              <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
              <p class="stat-label">Pendentes</p>
              <p class="stat-value">${testsPendentes}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="stat-icon" style="background-color: #6f42c1;">
              <i class="fas fa-percentage"></i>
            </div>
            <div class="stat-content">
              <p class="stat-label">Taxa de Resposta</p>
              <p class="stat-value">${taxaRespostaPct}%</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Barra de progresso
    dashboardHtml += `
      <div class="progress-section mb-3">
        <p class="mb-2"><strong>Progresso Geral</strong></p>
        <div class="progress" style="height: 30px;">
          <div class="progress-bar bg-success" role="progressbar" style="width: ${taxaRespostaPct}%" aria-valuenow="${taxaRespostaPct}" aria-valuemin="0" aria-valuemax="100">
            ${taxaRespostaPct}%
          </div>
        </div>
      </div>
    `;

    // Tempo médio
    if (tempoMedio > 0) {
      dashboardHtml += `
        <div class="alert alert-info">
          <i class="fas fa-hourglass-half me-2"></i>
          <strong>Tempo Médio de Resposta:</strong> ${Math.floor(
            tempoMedio / 60
          )}m ${tempoMedio % 60}s
        </div>
      `;
    }

    // Tabela detalhada
    dashboardHtml += `
      <h6 class="mt-4 mb-3"><i class="fas fa-table me-2"></i>Detalhamento por Teste</h6>
      <div class="table-responsive">
        <table class="table table-striped table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Teste</th>
              <th>Data de Envio</th>
              <th>Status</th>
              <th>Tempo Gasto</th>
            </tr>
          </thead>
          <tbody>
    `;

    tokensAccesso.forEach((token, index) => {
      const dataEnvio = token.dataenvio?.toDate
        ? token.dataenvio.toDate().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "N/A";

      const status = token.status || "enviado";
      let badgeClass = "bg-warning text-dark";
      let statusTexto = "Pendente";

      if (status === "respondido") {
        badgeClass = "bg-success";
        statusTexto = "Respondido";
      } else if (status === "avaliado") {
        badgeClass = "bg-info";
        statusTexto = "Avaliado";
      }

      const tempoExibir = token.tempoGasto
        ? `${Math.floor(token.tempoGasto / 60)}m ${token.tempoGasto % 60}s`
        : "N/A";

      dashboardHtml += `
        <tr>
          <td>${index + 1}</td>
          <td>${token.nomeTeste || "Teste"}</td>
          <td>${dataEnvio}</td>
          <td><span class="badge ${badgeClass}">${statusTexto}</span></td>
          <td>${tempoExibir}</td>
        </tr>
      `;
    });

    dashboardHtml += `
          </tbody>
        </table>
      </div>
    `;

    dashboardHtml += "</div>";
    container.innerHTML = dashboardHtml;
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    container.innerHTML = `
      <p class="text-danger small">
        <i class="fas fa-exclamation-circle me-2"></i>
        Erro ao carregar dashboard: ${error.message}
      </p>
    `;
  }
}
/**
 * Carrega monitor de tempo real de respostas (Aba Tempo Real)
 * @param {string} candidatoId - ID do candidato
 */
async function carregarMonitorTempoReal(candidatoId) {
  const container = document.getElementById("avaliacao-teste-tempo-real");
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-spinner fa-spin me-2"></i>
        <strong>Monitorando...</strong> Sincronizando dados em tempo real...
      </div>
    `;

    const candidaturaRef = doc(candidatosCollection, candidatoId);

    // Configura listener em tempo real
    const unsubscribe = onSnapshot(candidaturaRef, (snapshot) => {
      if (!snapshot.exists()) {
        container.innerHTML =
          '<p class="text-danger">Candidatura não encontrada.</p>';
        return;
      }

      const dados = snapshot.data();
      const tokensAccesso = dados.testesenviados || [];

      let monitorHtml = '<div class="monitor-tempo-real">';
      monitorHtml += `<h6 class="mb-3"><i class="fas fa-video me-2"></i>Monitoramento em Tempo Real (Auto-atualiza)</h6>`;

      if (tokensAccesso.length === 0) {
        monitorHtml += '<p class="text-muted">Nenhum teste enviado ainda.</p>';
      } else {
        tokensAccesso.forEach((token, index) => {
          const status = token.status || "enviado";
          let statusHtml = "";

          if (status === "respondido") {
            const dataResposta = token.dataResposta?.toDate
              ? token.dataResposta.toDate().toLocaleTimeString("pt-BR")
              : "N/A";
            statusHtml = `
              <span class="badge bg-success me-2">Respondido</span>
              <small class="text-muted">em ${dataResposta}</small>
            `;
          } else if (status === "avaliado") {
            statusHtml = '<span class="badge bg-info">Avaliado</span>';
          } else {
            const agora = new Date();
            const dataEnvio = token.dataenvio?.toDate
              ? token.dataenvio.toDate()
              : new Date();
            const horasDecorridas = Math.floor(
              (agora - dataEnvio) / (1000 * 60 * 60)
            );
            statusHtml = `
              <span class="badge bg-warning text-dark">Pendente</span>
              <small class="text-muted">(${horasDecorridas}h desde envio)</small>
            `;
          }

          monitorHtml += `
            <div class="monitor-item" style="padding: 10px; border-left: 4px solid #0078d4; margin-bottom: 8px; background: #f8f9fa; border-radius: 4px;">
              <p class="mb-1"><strong>${index + 1}. ${
            token.nomeTeste || "Teste"
          }</strong></p>
              <p class="mb-0">${statusHtml}</p>
            </div>
          `;
        });
      }

      monitorHtml += "</div>";
      container.innerHTML = monitorHtml;
    });

    // Armazena o unsubscribe para limpeza posterior
    window._abaMonitorUnsubscribe = unsubscribe;
  } catch (error) {
    console.error("Erro ao carregar monitor em tempo real:", error);
    container.innerHTML = `
      <p class="text-danger small">
        <i class="fas fa-exclamation-circle me-2"></i>
        Erro ao conectar ao monitoramento: ${error.message}
      </p>
    `;
  }
}
/**
 * Envia resumo das respostas do teste por email usando Cloud Function genérica (Aba Email)
 */
window.enviarResumoEmailTeste = async function () {
  const emailDestino = document.getElementById("email-destino-resumo")?.value;
  const assunto = document.getElementById("assunto-email-resumo")?.value;
  const incluirGraficos = document.getElementById(
    "incluir-graficos-email"
  )?.checked;
  const btnEnviar = document.getElementById("btn-enviar-email-resumo");

  if (!emailDestino) {
    window.showToast?.("Por favor, informe um email de destino.", "error");
    return;
  }

  if (!btnEnviar) return;

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';

  try {
    const modalAvaliacaoTeste = document.getElementById(
      "modal-avaliacao-teste"
    );
    const candidatoId = modalAvaliacaoTeste?.dataset.candidaturaId;

    if (!candidatoId) {
      throw new Error("ID do candidato não encontrado");
    }

    const candidaturaRef = doc(candidatosCollection, candidatoId);
    const candidaturaSnap = await getDoc(candidaturaRef);

    if (!candidaturaSnap.exists()) {
      throw new Error("Candidatura não encontrada");
    }

    const dados = candidaturaSnap.data();
    const nomeCandidato = dados.nomecompleto || "Candidato";
    const emailCandidato = dados.emailcandidato || "não informado";
    const vagaAplicada =
      dados.titulovagaoriginal || dados.titulo_vaga_original || "Não informada";
    const tokensAccesso = dados.testesenviados || [];

    // ✅ MONTA O CORPO DO EMAIL EM HTML
    let htmlEmail = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0078d4 0%, #003d7a 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0078d4; border-radius: 4px; }
          .stat-box { display: inline-block; background: white; padding: 15px; margin: 10px; border-left: 4px solid #28a745; border-radius: 4px; width: 45%; }
          .stat-number { font-size: 28px; font-weight: bold; color: #0078d4; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .table th { background: #0078d4; color: white; padding: 10px; text-align: left; }
          .table td { border-bottom: 1px solid #ddd; padding: 10px; }
          .table tr:hover { background: #f5f5f5; }
          .badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          .badge-info { background: #d1ecf1; color: #0c5460; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #ddd; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Resumo de Testes - ${nomeCandidato}</h2>
          </div>
          <div class="content">
            <div class="info-box">
              <h3 style="margin-top: 0; color: #0078d4;">👤 Informações do Candidato</h3>
              <p><strong>Nome:</strong> ${nomeCandidato}</p>
              <p><strong>Email:</strong> ${emailCandidato}</p>
              <p><strong>Vaga Aplicada:</strong> ${vagaAplicada}</p>
              <p><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}</p>
            </div>
    `;

    // ✅ ADICIONA ESTATÍSTICAS SE MARCADO
    if (incluirGraficos) {
      const totalTestes = tokensAccesso.length;
      const testsRespondidos = tokensAccesso.filter(
        (t) => t.status === "respondido" || t.status === "avaliado"
      ).length;
      const testsPendentes = totalTestes - testsRespondidos;
      const taxaRespostaPct =
        totalTestes > 0
          ? Math.round((testsRespondidos / totalTestes) * 100)
          : 0;

      let tempoTotal = 0;
      let testComTempo = 0;
      tokensAccesso.forEach((t) => {
        if (t.tempoGasto) {
          tempoTotal += t.tempoGasto;
          testComTempo++;
        }
      });
      const tempoMedio =
        testComTempo > 0 ? Math.round(tempoTotal / testComTempo) : 0;

      htmlEmail += `
        <div class="info-box">
          <h3 style="margin-top: 0; color: #0078d4;">📈 Estatísticas Gerais</h3>
          <div style="text-align: center;">
            <div class="stat-box">
              <div class="stat-number">${totalTestes}</div>
              <div class="stat-label">Total de Testes</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${testsRespondidos}</div>
              <div class="stat-label">Respondidos</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${testsPendentes}</div>
              <div class="stat-label">Pendentes</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${taxaRespostaPct}%</div>
              <div class="stat-label">Taxa de Resposta</div>
            </div>
          </div>
        </div>
      `;

      // Barra de progresso
      htmlEmail += `
        <div class="info-box">
          <h4 style="margin-top: 0;">Progresso Geral</h4>
          <div style="width: 100%; height: 30px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${taxaRespostaPct}%; height: 100%; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
              ${taxaRespostaPct}%
            </div>
          </div>
        </div>
      `;

      if (tempoMedio > 0) {
        htmlEmail += `
          <div class="info-box" style="border-left-color: #6f42c1;">
            <strong>⏱️ Tempo Médio de Resposta:</strong> ${Math.floor(
              tempoMedio / 60
            )}m ${tempoMedio % 60}s
          </div>
        `;
      }
    }

    // ✅ TABELA COM DETALHAMENTO DOS TESTES
    htmlEmail += `
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0078d4;">📋 Detalhamento dos Testes</h3>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Teste</th>
              <th>Data de Envio</th>
              <th>Status</th>
              <th>Tempo</th>
            </tr>
          </thead>
          <tbody>
    `;

    tokensAccesso.forEach((token, index) => {
      const dataEnvio = token.dataenvio?.toDate
        ? token.dataenvio.toDate().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "N/A";

      const status = token.status || "enviado";
      let statusBadge = '<span class="badge badge-warning">Pendente</span>';

      if (status === "respondido") {
        statusBadge = '<span class="badge badge-success">Respondido</span>';
      } else if (status === "avaliado") {
        statusBadge = '<span class="badge badge-info">Avaliado</span>';
      }

      const tempoExibir = token.tempoGasto
        ? `${Math.floor(token.tempoGasto / 60)}m ${token.tempoGasto % 60}s`
        : "N/A";

      htmlEmail += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${token.nomeTeste || "Teste"}</strong></td>
          <td>${dataEnvio}</td>
          <td>${statusBadge}</td>
          <td>${tempoExibir}</td>
        </tr>
      `;
    });

    htmlEmail += `
          </tbody>
        </table>
      </div>
    `;

    // ✅ RODAPÉ
    htmlEmail += `
      <div class="footer">
        <p><strong>EuPsico - Sistema de Recrutamento e Seleção</strong></p>
        <p>Este é um e-mail automático. Não responda diretamente.</p>
      </div>
    </div>
    </body>
    </html>
    `;

    // ✅ CHAMA CLOUD FUNCTION GENÉRICA EXISTENTE
    const enviarEmail = httpsCallable(functions, "enviarEmail");

    const resultado = await enviarEmail({
      destinatario: emailDestino,
      assunto: assunto || `Resumo de Testes - ${nomeCandidato}`,
      html: htmlEmail,
      remetente: "EuPsico Recrutamento <atendimento@eupsico.org.br>",
    });

    if (resultado.data?.success) {
      window.showToast?.("Email enviado com sucesso!", "success");
      document.getElementById("email-destino-resumo").value = "";
      document.getElementById("assunto-email-resumo").value = "";
    } else {
      throw new Error(resultado.data?.message || "Erro desconhecido ao enviar");
    }
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    window.showToast?.(`Erro ao enviar email: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fas fa-paper-plane me-2"></i>Enviar Resumo por Email';
  }
};

// ============================================
// REPROVAÇÃO DE CANDIDATOS
// ============================================

/**
 * Reprova uma candidatura em qualquer etapa do processo
 * @param {string} candidatoId - ID do candidato
 * @param {string} etapa - Etapa em que foi reprovado
 * @param {string} justificativaFicha - Justificativa (opcional)
 */
window.reprovarCandidatura = async function (
  candidatoId,
  etapa,
  justificativaFicha = null
) {
  console.log(
    `🔹 Recrutamento: Iniciando reprovação do candidato ${candidatoId}`
  );

  let justificativa =
    justificativaFicha ||
    prompt(
      `Confirme a reprovação do candidato nesta etapa (${etapa}). Informe a justificativa:`
    );

  if (!justificativa || justificativa.trim() === "") {
    window.showToast?.(
      "A justificativa de reprovação é obrigatória.",
      "warning"
    );
    return;
  }

  if (!confirm(`Confirmar reprovação na etapa ${etapa}?`)) {
    return;
  }

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);

    await updateDoc(candidatoRef, {
      status_recrutamento: "Rejeitado (Comunicação Pendente)",
      "rejeicao.etapa": etapa,
      "rejeicao.data": new Date(), // Corrigido: usar new Date() em vez de serverTimestamp
      "rejeicao.justificativa": justificativa,
      historico: arrayUnion({
        data: new Date(), // Corrigido: usar new Date() em vez de serverTimestamp
        acao: `Candidatura REJEITADA na etapa de ${etapa}. Motivo: ${justificativa}`,
        usuario: currentUserData.uid || "sistema",
      }),
    });

    window.showToast?.(`Candidatura rejeitada na etapa ${etapa}.`, "success");
    console.log("✅ Recrutamento: Candidato reprovado com sucesso");

    // Fecha o modal se estiver aberto
    if (modalCandidato) {
      modalCandidato.classList.remove("is-visible");
    }

    // Recarrega a listagem atual
    const activeStatus = statusCandidaturaTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");

    if (activeStatus === "triagem") renderizarTriagem(getGlobalState());
    else if (activeStatus === "entrevistas")
      renderizarEntrevistas(getGlobalState());
    else if (activeStatus === "gestor")
      renderizarEntrevistaGestor(getGlobalState());
  } catch (error) {
    console.error("❌ Recrutamento: Erro ao reprovar candidato:", error);
    window.showToast?.("Erro ao reprovar candidato.", "error");
  }
};

// ============================================
// HANDLERS DE UI E NAVEGAÇÃO
// ============================================

/**
 * Handler para mudança na seleção de vaga
 */
function handleFiltroVagaChange() {
  vagaSelecionadaId = filtroVaga.value;
  console.log(
    `🔹 Recrutamento: Vaga selecionada: ${vagaSelecionadaId || "Nenhuma"}`
  );

  const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");

  if (vagaSelecionadaId) {
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    } else {
      // Se nenhuma aba está ativa, carrega o cronograma por padrão
      renderizarCronograma(getGlobalState());
    }
  } else {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Selecione uma vaga no filtro acima para iniciar a visualização do processo seletivo.</p>';
  }
}

/**
 * Handler para clique nas abas de status
 * @param {Event} e - Evento de clique
 */
function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");
  console.log(`🔹 Recrutamento: Mudando para aba: ${status}`);

  // Remove classe ativa de todas as abas
  document
    .querySelectorAll("#status-candidatura-tabs .tab-link")
    .forEach((btn) => btn.classList.remove("active"));

  // Adiciona classe ativa na aba clicada
  e.currentTarget.classList.add("active");

  // Valida se há vaga selecionada (exceto para gestão de conteúdo)
  if (!vagaSelecionadaId && status !== "gestao-conteudo") {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Por favor, selecione uma vaga para visualizar esta etapa.</p>';
    return;
  }

  const globalState = getGlobalState();

  // Roteamento para cada aba
  switch (status) {
    case "cronograma":
      renderizarCronograma(globalState);
      break;
    case "triagem":
      renderizarTriagem(globalState);
      break;
    case "entrevistas":
      renderizarEntrevistas(globalState);
      break;
    case "gestor":
      renderizarEntrevistaGestor(globalState);
      break;
    case "finalizados":
      renderizarFinalizados(globalState);
      break;
    case "gestao-conteudo":
      // Redirecionamento para módulo de gestão de estudos
      window.location.hash = "#rh/gestao_estudos_de_caso";
      break;
    default:
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Selecione uma etapa do processo.</p>';
  }
}
/**
 * Carrega estatísticas rápidas dos testes
 */
async function carregarEstatisticasTestes(candidatoId) {
  try {
    const candidaturaRef = doc(candidatosCollection, candidatoId);
    const candidaturaSnap = await getDoc(candidaturaRef);

    if (!candidaturaSnap.exists()) return;

    const dados = candidaturaSnap.data();
    const tokensAccesso = dados.testesenviados || [];

    if (tokensAccesso.length === 0) {
      document.getElementById("avaliacao-teste-stats").innerHTML = `
        <p class="text-muted">Nenhum teste enviado ainda.</p>
      `;
      return;
    }

    const totalTestes = tokensAccesso.length;
    const testsRespondidos = tokensAccesso.filter(
      (t) => t.status === "respondido" || t.status === "avaliado"
    ).length;
    const testsPendentes = totalTestes - testsRespondidos;

    let tempoTotal = 0;
    let testComTempo = 0;
    tokensAccesso.forEach((t) => {
      if (t.tempoGasto) {
        tempoTotal += t.tempoGasto;
        testComTempo++;
      }
    });
    const tempoMedio =
      testComTempo > 0 ? Math.round(tempoTotal / testComTempo) : 0;

    const statsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #0078d4;">
          <strong style="font-size: 18px; color: #0078d4;">${totalTestes}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Total de Testes</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #28a745;">
          <strong style="font-size: 18px; color: #28a745;">${testsRespondidos}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Respondidos</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #ffc107;">
          <strong style="font-size: 18px; color: #ffc107;">${testsPendentes}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Pendentes</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #6f42c1;">
          <strong style="font-size: 18px; color: #6f42c1;">${
            tempoMedio > 0 ? Math.floor(tempoMedio / 60) + "m" : "N/A"
          }</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Tempo Médio</p>
        </div>
      </div>
    `;

    document.getElementById("avaliacao-teste-stats").innerHTML = statsHtml;
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
  }
}

// ============================================
// INICIALIZAÇÃO DO MÓDULO
// ============================================

/**
 * Função principal de inicialização do módulo
 * @param {Object} user - Usuário autenticado
 * @param {Object} userData - Dados do usuário
 */
export async function initRecrutamento(user, userData) {
  console.log("🔹 Recrutamento: Iniciando módulo...");

  currentUserData = userData || {};

  // 1. Carrega lista de vagas ativas
  await carregarVagasAtivas();

  // 2. Configura evento de filtro de vaga
  if (filtroVaga) {
    filtroVaga.addEventListener("change", handleFiltroVagaChange);
  } else {
    console.warn("⚠️ Recrutamento: Filtro de vaga não encontrado");
  }

  // 3. Configura eventos das abas de status
  if (statusCandidaturaTabs) {
    statusCandidaturaTabs.querySelectorAll(".tab-link").forEach((btn) => {
      btn.addEventListener("click", handleTabClick);
    });
  } else {
    console.warn("⚠️ Recrutamento: Container de abas não encontrado");
  }

  // 4. Configura listener para fechar modal de detalhes
  const closeBtnDetalhes = modalCandidato?.querySelector(
    ".close-modal-btn.fechar-modal-candidato"
  );
  if (closeBtnDetalhes) {
    closeBtnDetalhes.addEventListener("click", () => {
      modalCandidato.classList.remove("is-visible");
    });
  }

  console.log("✅ Recrutamento: Módulo inicializado com sucesso");
}

// Compatibilidade com o roteador (permite usar tanto initRecrutamento quanto init)
export { initRecrutamento as init };
