/**
 * Arquivo: modulos/rh/js/admissao.js
 * Versão: 1.0.0 (Baseado em recrutamento.js)
 * Data: 05/11/2025
 * Descrição: Controlador principal do módulo de Admissão (Onboarding)
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

// Importação dos módulos de abas (tabs) - NOVAS FUNÇÕES
// (Estes arquivos .js serão criados na Parte 4)
import { renderizarSolicitacaoEmail } from "./tabs/tabSolicitacaoEmail.js";
import { renderizarCadastroDocumentos } from "./tabs/tabCadastroDocumentos.js";
import { renderizarAssinaturaDocs } from "./tabs/tabAssinaturaDocs.js";
import { renderizarIntegracao } from "./tabs/tabIntegracao.js";
import { renderizarAvaliacao3Meses } from "./tabs/tabAvaliacao3Meses.js";
import { renderizarDocsPos3Meses } from "./tabs/tabDocsPos3Meses.js";
import { renderizarReprovadosAdmissao } from "./tabs/tabReprovadosAdmissao.js";

// ============================================
// CONSTANTES E COLEÇÕES DO FIRESTORE
// ============================================
const CANDIDATOS_COLLECTION_NAME = "candidaturas";
const USUARIOS_COLLECTION_NAME = "usuarios"; // Coleção de destino

const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);
const usuariosCollection = collection(db, USUARIOS_COLLECTION_NAME);

// ============================================
// ELEMENTOS DO DOM (CACHE)
// ============================================
// Elementos ATUALIZADOS
const statusAdmissaoTabs = document.getElementById("status-admissao-tabs");
const conteudoAdmissao = document.getElementById("conteudo-admissao");

// Modais de Recrutamento removidos. Serão adicionados modais de admissão.

// ============================================
// VARIÁVEIS DE ESTADO GLOBAL
// ============================================
// vagaSelecionadaId REMOVIDO
let currentUserData = {};
let dadosCandidatoAtual = null; // Mantido, será útil

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
// Estado ATUALIZADO (sem vagaId)
export const getGlobalState = () => ({
  currentUserData,
  candidatosCollection,
  usuariosCollection, // Adicionada coleção de usuários
  formatarTimestamp,
  conteudoAdmissao,
  statusAdmissaoTabs,
  handleTabClick,
});

// ============================================
// CARREGAMENTO DE VAGAS (REMOVIDO)
// ============================================
// Função 'carregarVagasAtivas' removida. A lógica de carregamento
// será feita por cada aba, buscando candidatos com status de admissão.

// ============================================
// MODAL DE DETALHES DO CANDIDATO (REMOVIDO)
// ============================================
// Funções 'abrirModalCandidato' e 'getStatusBadgeClass' removidas.
// Cada aba de admissão terá seus próprios modais e helpers.

/**
 * Retorna a classe CSS apropriada para o badge de status
 * (Mantida por ser útil)
 * @param {string} status - Status do candidato
 * @returns {string} Classe CSS
 */
export function getStatusBadgeClass(status) {
  if (!status) return "status-pendente";

  const statusLower = status.toLowerCase();

  if (
    statusLower.includes("aprovad") ||
    statusLower.includes("contratad") ||
    statusLower.includes("finalizad") ||
    statusLower.includes("concluíd")
  ) {
    return "status-concluída";
  } else if (statusLower.includes("rejeit") || statusLower.includes("reprov")) {
    return "status-rejeitada";
  } else {
    return "status-pendente";
  }
}

// ============================================
// REPROVAÇÃO DE CANDIDATOS (ADAPTADA)
// ============================================

/**
 * Reprova uma candidatura durante o processo de ADMISSÃO
 * @param {string} candidatoId - ID do candidato
 * @param {string} etapa - Etapa em que foi reprovado
 * @param {string} justificativaFicha - Justificativa (opcional)
 */
window.reprovarCandidatoAdmissao = async function (
  candidatoId,
  etapa,
  justificativaFicha = null
) {
  console.log(`🔹 Admissão: Iniciando reprovação do candidato ${candidatoId}`);

  let justificativa =
    justificativaFicha ||
    prompt(
      `Confirme a reprovação do candidato nesta etapa de ADMISSÃO (${etapa}). Informe a justificativa:`
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
    const candidatoRef = doc(candidatosCollection, candidatoId); // Atualiza o status para um status de reprovação de admissão

    await updateDoc(candidatoRef, {
      // ATENÇÃO: Verificar se 'status_recrutamento' ou 'status_admissao' é o campo correto
      status_recrutamento: "Reprovado (Admissão)",
      "rejeicao.etapa": `Admissão - ${etapa}`,
      "rejeicao.data": new Date(),
      "rejeicao.justificativa": justificativa,
      historico: arrayUnion({
        data: new Date(),
        acao: `Candidatura REJEITADA na ADMISSÃO (Etapa: ${etapa}). Motivo: ${justificativa}`,
        usuario: currentUserData.uid || "sistema",
      }),
    });

    window.showToast?.(`Candidatura rejeitada na etapa ${etapa}.`, "success");
    console.log("✅ Admissão: Candidato reprovado com sucesso"); // Recarrega a listagem atual

    const activeStatus = statusAdmissaoTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");

    // Recarrega a aba ativa para refletir a mudança
    if (activeStatus) {
      handleTabClick({
        currentTarget: document.querySelector(
          `[data-status="${activeStatus}"]`
        ),
      });
    }
  } catch (error) {
    console.error("❌ Admissão: Erro ao reprovar candidato:", error);
    window.showToast?.("Erro ao reprovar candidato.", "error");
  }
};

// ============================================
// HANDLERS DE UI E NAVEGAÇÃO
// ============================================

// 'handleFiltroVagaChange' REMOVIDO

/**
 * Handler para clique nas abas de status
 * @param {Event} e - Evento de clique
 */
function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");
  console.log(`🔹 Admissão: Mudando para aba: ${status}`); // Remove classe ativa de todas as abas

  document
    .querySelectorAll("#status-admissao-tabs .tab-link")
    .forEach((btn) => btn.classList.remove("active")); // Adiciona classe ativa na aba clicada

  e.currentTarget.classList.add("active"); // Validação de vaga REMOVIDA

  const globalState = getGlobalState(); // Roteamento ATUALIZADO para as novas abas

  switch (status) {
    case "solicitacao-email":
      renderizarSolicitacaoEmail(globalState);
      break;
    case "cadastro-documentos":
      renderizarCadastroDocumentos(globalState);
      break;
    case "assinatura-documentos":
      renderizarAssinaturaDocs(globalState);
      break;
    case "integracao-treinamentos":
      renderizarIntegracao(globalState);
      break;
    case "avaliacao-3-meses":
      renderizarAvaliacao3Meses(globalState);
      break;
    case "documentos-pos-3-meses":
      renderizarDocsPos3Meses(globalState);
      break;
    case "reprovados-admissao":
      renderizarReprovadosAdmissao(globalState);
      break;
    default:
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-warning">Selecione uma etapa do processo de admissão.</p>';
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
export async function initAdmissao(user, userData) {
  console.log("🔹 Admissão: Iniciando módulo...");

  currentUserData = userData || {}; // 1. Carregamento de Vagas REMOVIDO // 2. Evento de filtro de vaga REMOVIDO // 3. Configura eventos das abas de status

  if (statusAdmissaoTabs) {
    statusAdmissaoTabs.querySelectorAll(".tab-link").forEach((btn) => {
      btn.addEventListener("click", handleTabClick);
    });
  } else {
    console.warn("⚠️ Admissão: Container de abas não encontrado");
  } // 4. Listeners de modais REMOVIDOS (serão tratados em cada aba)

  // 5. Carrega a primeira aba por padrão
  const firstTab = statusAdmissaoTabs?.querySelector(
    '.tab-link[data-status="solicitacao-email"]'
  );
  if (firstTab) {
    console.log("🔹 Admissão: Carregando aba inicial 'solicitacao-email'");
    handleTabClick({ currentTarget: firstTab });
  } else {
    console.warn(
      "⚠️ Admissão: Aba inicial 'solicitacao-email' não encontrada."
    );
    conteudoAdmissao.innerHTML =
      '<p class="alert alert-danger">Erro ao inicializar abas.</p>';
  }

  console.log("✅ Admissão: Módulo inicializado com sucesso");
}

// Compatibilidade com o roteador (permite usar tanto initAdmissao quanto init)
export { initAdmissao as init };
