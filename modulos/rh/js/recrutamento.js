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
        usuario: currentUserData.id || "sistema",
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
