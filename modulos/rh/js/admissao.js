/**
 * Arquivo: modulos/rh/js/admissao.js
 * Versão: 1.0.3 (Corrigindo erro getStatusBadgeClass e modal de Detalhes)
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

// --- Imports das Abas ---
import { renderizarSolicitacaoEmail } from "./tabs/tabSolicitacaoEmail.js";
import { renderizarCadastroDocumentos } from "./tabs/tabCadastroDocumentos.js";
import { renderizarAssinaturaDocs } from "./tabs/tabAssinaturaDocs.js";
import { renderizarIntegracao } from "./tabs/tabIntegracao.js";
import { renderizarAvaliacao3Meses } from "./tabs/tabAvaliacao3Meses.js";
import { renderizarDocsPos3Meses } from "./tabs/tabDocsPos3Meses.js";
import { renderizarReprovadosAdmissao } from "./tabs/tabReprovadosAdmissao.js";
// --- FIM DOS IMPORTS ---

// ============================================
// CONSTANTES E COLEÇÕES DO FIRESTORE
// ============================================
const CANDIDATOS_COLLECTION_NAME = "candidaturas";
const USUARIOS_COLLECTION_NAME = "usuarios";

const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);
const usuariosCollection = collection(db, USUARIOS_COLLECTION_NAME);

// ============================================
// ELEMENTOS DO DOM (CACHE)
// ============================================
const statusAdmissaoTabs = document.getElementById("status-admissao-tabs");
const conteudoAdmissao = document.getElementById("conteudo-admissao");

// ============================================
// VARIÁVEIS DE ESTADO GLOBAL
// ============================================
let currentUserData = {};
let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

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

// --- ⚠️ CORREÇÃO APLICADA AQUI ---
// A função 'getStatusBadgeClass' foi adicionada ao objeto retornado.
export const getGlobalState = () => ({
  currentUserData,
  candidatosCollection,
  usuariosCollection,
  formatarTimestamp,
  conteudoAdmissao,
  statusAdmissaoTabs,
  handleTabClick,
  getStatusBadgeClass, // <-- FUNÇÃO ADICIONADA
});
// --- FIM DA CORREÇÃO ---

// ============================================
// MODAL DE DETALHES (CORRIGIDO)
// ============================================

/**
 * Abre modal com detalhes completos do candidato
 * @param {string} candidatoId - ID do documento do candidato
 * @param {string} modo - Modo de visualização (detalhes, etc.)
 * @param {Object} candidato - Dados do candidato (passados pelo botão)
 */
function abrirModalAdmissaoCandidato(candidatoId, modo, candidato) {
  // Certifique-se que seu 'admissao.html' TEM um modal com id="modal-candidato"
  const modalCandidato = document.getElementById("modal-candidato");
  const modalCandidatoBody = document.getElementById("candidato-modal-body");
  const modalCandidatoFooter = document.getElementById(
    "candidato-modal-footer"
  );

  // Não precisamos do 'getGlobalState' aqui, podemos chamar as funções direto
  // pois estão no mesmo arquivo.

  if (!modalCandidato || !modalCandidatoBody || !modalCandidatoFooter) {
    console.error(
      "❌ Admissão: Modal de detalhes 'modal-candidato' (e seus filhos body/footer) não encontrado no admissao.html"
    );
    window.showToast?.("Erro: Modal de detalhes não encontrado.", "error");
    return;
  }

  console.log(`🔹 Admissão: Abrindo modal para candidato ${candidatoId}`);
  dadosCandidatoAtual = candidato; // Salva no estado global do módulo

  // Atualiza título do modal
  const tituloModalEl = document.getElementById("candidato-nome-titulo");
  if (tituloModalEl) {
    tituloModalEl.textContent = `Detalhes: ${
      candidato.nome_completo || "Candidato(a)"
    }`;
  }

  // Monta o conteúdo com fieldsets
  const contentHtml = `
  <div class="row">
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
       <strong>Email Pessoal:</strong><br>
       <span>${
         candidato.email_pessoal || candidato.email_candidato || "N/A"
       }</span>
      </p>
      <p class="card-text">
       <strong>Telefone (WhatsApp):</strong><br>
       <span>${candidato.telefone_contato || "N/A"}</span>
      </p>
     </div>
    </fieldset>
   </div>
   <div class="col-lg-6">
    <fieldset>
     <legend><i class="fas fa-briefcase me-2"></i>Informações da Vaga</legend>
     <div class="details-grid">
     	<p class="card-text">
      	<strong>Vaga Aprovada:</strong><br>
      	<span>${candidato.vaga_titulo || "N/A"}</span>
     	</p>
     	<p class="card-text">
      	<strong>Status Admissão:</strong><br>
      	<span class="status-badge ${getStatusBadgeClass(
          candidato.status_recrutamento
        )}">
      		${candidato.status_recrutamento || "N/A"}
      	</span>
     	</p>
     	<p class="card-text">
      	<strong>Novo E-mail (Solicitado):</strong><br>
      	<span>${candidato.email_novo || "Aguardando"}</span>
     	</p>
     </div>
    </fieldset>
   </div>
  </div>
 `;
  modalCandidatoBody.innerHTML = contentHtml;

  // Atualiza o footer
  modalCandidatoFooter.innerHTML = `
  <button type="button" class="action-button secondary fechar-modal-candidato">
   <i class="fas fa-times me-2"></i> Fechar
  </button>
 `;

  // Anexa listener ao botão de fechar no footer
  modalCandidatoFooter
    .querySelector(".fechar-modal-candidato")
    .addEventListener("click", () => {
      modalCandidato.classList.remove("is-visible");
    });

  // Anexa listener ao botão de fechar no header
  const closeBtnHeader = modalCandidato.querySelector(
    ".close-modal-btn.fechar-modal-candidato"
  );
  if (closeBtnHeader) {
    // Remove listener antigo se houver e adiciona o novo
    closeBtnHeader.onclick = () =>
      modalCandidato.classList.remove("is-visible");
  }

  modalCandidato.classList.add("is-visible");
  console.log("✅ Admissão: Modal de detalhes aberto");
}

// Exporta a função para a window, para que as abas possam chamá-la
window.abrirModalCandidato = abrirModalAdmissaoCandidato;

// ============================================
// REPROVAÇÃO DE CANDIDATOS (MODAL)
// ============================================

// Esta função é chamada pelo 'tabSolicitacaoEmail.js' (e outras abas)
window.reprovarCandidatoAdmissao = async function (
  candidatoId,
  etapa,
  justificativa
) {
  console.log(`🔹 Admissão: Submetendo reprovação do candidato ${candidatoId}`);

  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusAdmissaoTabs,
  } = getGlobalState();

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);
    await updateDoc(candidatoRef, {
      status_recrutamento: "Reprovado (Admissão)",
      "rejeicao.etapa": `Admissão - ${etapa}`,
      "rejeicao.data": new Date(),
      "rejeicao.justificativa": justificativa,
      historico: arrayUnion({
        data: new Date(),
        acao: `Candidatura REJEITADA na ADMISSÃO (Etapa: ${etapa}). Motivo: ${justificativa}`,
        usuario: currentUserData.uid || "sistema", // <-- USA .UID
      }),
    });
    window.showToast?.(`Candidatura rejeitada na etapa ${etapa}.`, "success");
    console.log("✅ Admissão: Candidato reprovado com sucesso");

    // Recarrega a aba ativa
    const activeStatus = statusAdmissaoTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");
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

function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");
  console.log(`🔹 Admissão: Mudando para aba: ${status}`);

  document
    .querySelectorAll("#status-admissao-tabs .tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  e.currentTarget.classList.add("active");

  const globalState = getGlobalState();

  // Roteamento
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
      conteudoAdmissao.innerHTML = `<p class="alert alert-warning">Etapa (${status}) não implementada.</p>`;
  }
}

// ============================================
// INICIALIZAÇÃO DO MÓDULO
// ============================================

export async function initAdmissao(user, userData) {
  console.log("🔹 Admissão: Iniciando módulo (v1.0.3)...");
  currentUserData = userData || {};

  if (statusAdmissaoTabs) {
    statusAdmissaoTabs.querySelectorAll(".tab-link").forEach((btn) => {
      btn.addEventListener("click", handleTabClick);
    });
  } else {
    console.warn("⚠️ Admissão: Container de abas não encontrado");
  }

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

  console.log("✅ Admissão: Módulo inicializado com sucesso (v1.0.3)");
}

export { initAdmissao as init };
