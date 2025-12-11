/**
 * Arquivo: modulos/rh/js/tabs/tabCronograma.js
 * Versão: 3.1.0 (Correção de Auth - Nome do Usuário Real)
 * Data: 04/11/2025
 * Descrição: Gerencia a aba de Cronograma e Orçamento do Recrutamento
 */

import { getGlobalState } from "../recrutamento.js";
import {
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// ✅ Importação da função auxiliar para pegar o NOME do usuário
import { getCurrentUserName } from "./entrevistas/helpers.js";

// ============================================
// FUNÇÕES DE UTILIDADE - FORMATAÇÃO
// ============================================

/**
 * Formata valor monetário para exibição
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado (ex: R$ 1.500,00)
 */
function formatarMoeda(valor) {
  if (!valor || isNaN(valor)) return "R$ 0,00";
  return `R$ ${parseFloat(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formata data para exibição brasileira
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {string} Data formatada (ex: 15/11/2025)
 */
function formatarDataExibicao(data) {
  if (!data || data === "N/A") return "Não definida";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ============================================
// MODAL - ABERTURA E FECHAMENTO
// ============================================

/**
 * Abre o modal de edição de cronograma e orçamento
 * @param {string} vagaId - ID da vaga
 * @param {Object} dadosCronograma - Dados do cronograma existente
 */
function abrirModalCronograma(vagaId, dadosCronograma) {
  console.log(`🔹 Cronograma: Abrindo modal para vaga ${vagaId}`);

  const modal = document.getElementById("modal-edicao-cronograma");
  const form = document.getElementById("form-edicao-cronograma");

  if (!modal || !form) {
    console.error("❌ Cronograma: Modal ou formulário não encontrado");
    window.showToast?.("Erro: Modal de cronograma não encontrado.", "error");
    return;
  }

  // Armazena o ID da vaga no dataset do modal
  modal.dataset.vagaId = vagaId;

  // Preenche os campos do formulário com dados existentes
  const campos = {
    "modal-data-inicio-recrutamento":
      dadosCronograma.data_inicio_recrutamento !== "N/A"
        ? dadosCronograma.data_inicio_recrutamento
        : "",
    "modal-data-fechamento-recrutamento":
      dadosCronograma.data_fechamento_recrutamento !== "N/A"
        ? dadosCronograma.data_fechamento_recrutamento
        : "",
    "modal-data-contratacao-prevista":
      dadosCronograma.data_contratacao_prevista !== "N/A"
        ? dadosCronograma.data_contratacao_prevista
        : "",
    "modal-orcamento-previsto": dadosCronograma.orcamento_previsto || "",
    "modal-fonte-orcamento": dadosCronograma.fonte_orcamento || "",
    "modal-detalhes-cronograma": dadosCronograma.detalhes_cronograma || "",
  };

  Object.keys(campos).forEach((id) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.value = campos[id];
    }
  });

  // Remove listeners antigos e adiciona novos
  form.removeEventListener("submit", submeterCronograma);
  form.addEventListener("submit", submeterCronograma);

  // Anexa listeners aos botões de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-edicao-cronograma']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalCronograma);
      btn.addEventListener("click", fecharModalCronograma);
    });

  // Exibe o modal
  modal.classList.add("is-visible");
  console.log("✅ Cronograma: Modal aberto");
}

/**
 * Fecha o modal de cronograma
 */
function fecharModalCronograma() {
  console.log("🔹 Cronograma: Fechando modal");
  const modal = document.getElementById("modal-edicao-cronograma");
  if (modal) {
    modal.classList.remove("is-visible");
  }
}

// Expõe as funções globalmente
window.abrirModalCronograma = abrirModalCronograma;
window.fecharModalCronograma = fecharModalCronograma;

// ============================================
// SUBMISSÃO DO FORMULÁRIO
// ============================================

/**
 * Submete o formulário de edição de cronograma
 * @param {Event} e - Evento de submit
 */
async function submeterCronograma(e) {
  e.preventDefault();

  console.log("🔹 Cronograma: Submetendo formulário");

  const modal = document.getElementById("modal-edicao-cronograma");
  const btnSalvar = document.getElementById("btn-salvar-modal-cronograma");

  if (!modal || !btnSalvar) {
    console.error("❌ Cronograma: Elementos não encontrados");
    return;
  }

  const vagaId = modal.dataset.vagaId;

  if (!vagaId) {
    window.showToast?.(
      "Erro: ID da vaga não encontrado. Reabra o modal.",
      "error"
    );
    return;
  }

  const state = getGlobalState();
  const { vagasCollection } = state;

  // Coleta os dados do formulário
  const form = document.getElementById("form-edicao-cronograma");
  const dadosAtualizados = {
    data_inicio_recrutamento: form.querySelector(
      "#modal-data-inicio-recrutamento"
    ).value,
    data_fechamento_recrutamento: form.querySelector(
      "#modal-data-fechamento-recrutamento"
    ).value,
    data_contratacao_prevista: form.querySelector(
      "#modal-data-contratacao-prevista"
    ).value,
    orcamento_previsto:
      parseFloat(form.querySelector("#modal-orcamento-previsto").value) || 0,
    fonte_orcamento: form.querySelector("#modal-fonte-orcamento").value || "",
    detalhes_cronograma:
      form.querySelector("#modal-detalhes-cronograma").value || "",
  };

  // Validação básica
  if (
    !dadosAtualizados.data_inicio_recrutamento ||
    !dadosAtualizados.data_fechamento_recrutamento ||
    !dadosAtualizados.data_contratacao_prevista
  ) {
    window.showToast?.(
      "Por favor, preencha todas as datas obrigatórias.",
      "error"
    );
    return;
  }

  // Desabilita o botão durante o processamento
  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  try {
    // ✅ CORREÇÃO: Pega o nome do usuário assincronamente (resolvendo problema de rh_system_user)
    const usuarioNome = await getCurrentUserName();

    const vagaRef = doc(vagasCollection, vagaId);

    // Atualiza o documento da vaga
    await updateDoc(vagaRef, {
      ...dadosAtualizados,
      historico: arrayUnion({
        data: new Date(),
        acao: `Cronograma e Orçamento atualizado. Início: ${dadosAtualizados.data_inicio_recrutamento}, Término: ${dadosAtualizados.data_fechamento_recrutamento}`,
        usuario: usuarioNome, // ✅ Usa o nome correto
      }),
    });

    window.showToast?.(
      "Cronograma e orçamento atualizados com sucesso!",
      "success"
    );
    console.log("✅ Cronograma: Dados salvos no Firestore");

    // Fecha o modal
    fecharModalCronograma();

    // Recarrega a visualização do cronograma
    renderizarCronograma(state);
  } catch (error) {
    console.error("❌ Cronograma: Erro ao salvar:", error);
    window.showToast?.(`Erro ao salvar cronograma: ${error.message}`, "error");
  } finally {
    // Restaura o botão
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Ajustes';
  }
}

// ============================================
// RENDERIZAÇÃO DA ABA
// ============================================

/**
 * Renderiza a visualização do cronograma e orçamento
 * @param {Object} state - Estado global do módulo
 */
export async function renderizarCronograma(state) {
  console.log("🔹 Cronograma: Iniciando renderização");

  const { vagaSelecionadaId, conteudoRecrutamento, vagasCollection } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Selecione uma vaga para iniciar a gestão do cronograma.</p>';
    console.log("ℹ️ Cronograma: Nenhuma vaga selecionada");
    return;
  }

  conteudoRecrutamento.innerHTML = '<div class="loading-spinner"></div>';

  // Obtém o nome da vaga do filtro
  const filtroVaga = document.getElementById("filtro-vaga");
  let vagaNome = "Vaga Selecionada";
  if (filtroVaga && filtroVaga.selectedIndex >= 0) {
    vagaNome = filtroVaga.options[filtroVaga.selectedIndex].text;
  }

  // Dados padrão do cronograma
  let dadosCronograma = {
    data_inicio_recrutamento: "N/A",
    data_fechamento_recrutamento: "N/A",
    data_contratacao_prevista: "N/A",
    orcamento_previsto: 0,
    detalhes_cronograma: "Não informado.",
    fonte_orcamento: "Não informado.",
  };

  try {
    // Carrega os dados da vaga do Firestore
    const vagaDoc = await getDoc(doc(vagasCollection, vagaSelecionadaId));

    if (vagaDoc.exists()) {
      const vagaData = vagaDoc.data();
      dadosCronograma = {
        data_inicio_recrutamento: vagaData.data_inicio_recrutamento || "N/A",
        data_fechamento_recrutamento:
          vagaData.data_fechamento_recrutamento || "N/A",
        data_contratacao_prevista: vagaData.data_contratacao_prevista || "N/A",
        orcamento_previsto: vagaData.orcamento_previsto || 0,
        fonte_orcamento: vagaData.fonte_orcamento || "Não informado.",
        detalhes_cronograma: vagaData.detalhes_cronograma || "Não informado.",
      };
      console.log("✅ Cronograma: Dados carregados do Firestore");
    } else {
      console.warn("⚠️ Cronograma: Vaga não encontrada no Firestore");
    }
  } catch (error) {
    console.error("❌ Cronograma: Erro ao carregar dados:", error);
    window.showToast?.("Erro ao carregar cronograma da vaga.", "error");
  }

  // Serializa os dados para passar ao onclick (escapa aspas duplas)
  const dadosCronogramaJson = JSON.stringify(dadosCronograma).replace(
    /"/g,
    "&quot;"
  );

  // Renderiza o HTML
  conteudoRecrutamento.innerHTML = `
    <div class="dashboard-section">
      <div class="section-header">
        <h2><i class="fas fa-calendar-alt me-2"></i>Cronograma e Orçamento</h2>
        <p class="text-muted">${vagaNome}</p>
      </div>

      <div class="row">
        <div class="col-lg-6">
          <fieldset>
            <legend><i class="fas fa-calendar-check me-2"></i>Datas Previstas</legend>
            <div class="details-grid">
              <p class="card-text">
                <strong>Início do Recrutamento:</strong><br>
                <span class="value">${formatarDataExibicao(
                  dadosCronograma.data_inicio_recrutamento
                )}</span>
              </p>
              <p class="card-text">
                <strong>Término do Recrutamento:</strong><br>
                <span class="value">${formatarDataExibicao(
                  dadosCronograma.data_fechamento_recrutamento
                )}</span>
              </p>
              <p class="card-text">
                <strong>Contratação Prevista:</strong><br>
                <span class="value">${formatarDataExibicao(
                  dadosCronograma.data_contratacao_prevista
                )}</span>
              </p>
            </div>
          </fieldset>
        </div>

        <div class="col-lg-6">
          <fieldset>
            <legend><i class="fas fa-dollar-sign me-2"></i>Recursos e Orçamento</legend>
            <div class="details-grid">
              <p class="card-text">
                <strong>Orçamento Previsto:</strong><br>
                <span class="value" style="color: var(--cor-primaria); font-size: 1.3rem; font-weight: 600;">
                  ${formatarMoeda(dadosCronograma.orcamento_previsto)}
                </span>
              </p>
              <p class="card-text">
                <strong>Fonte do Orçamento:</strong><br>
                <span class="value">${
                  dadosCronograma.fonte_orcamento || "Não informado"
                }</span>
              </p>
            </div>
          </fieldset>
        </div>
      </div>

      <fieldset>
        <legend><i class="fas fa-sticky-note me-2"></i>Observações e Detalhes</legend>
        <p class="card-text pre-wrap">${
          dadosCronograma.detalhes_cronograma ||
          "Nenhuma observação registrada."
        }</p>
      </fieldset>

      <div class="button-bar" style="margin-top: 30px;">
        <button type="button" class="action-button primary" 
                onclick='window.abrirModalCronograma("${vagaSelecionadaId}", ${dadosCronogramaJson})'>
          <i class="fas fa-edit me-2"></i> Editar Cronograma e Orçamento
        </button>
      </div>
    </div>
  `;

  console.log("✅ Cronograma: Renderização concluída");
}

// ============================================
// INICIALIZAÇÃO DO MÓDULO
// ============================================

/**
 * Configura listeners para o modal de cronograma
 * Executado quando o módulo é carregado
 */
(function inicializarModalCronograma() {
  // Aguarda o DOM estar pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", configurarListeners);
  } else {
    configurarListeners();
  }

  function configurarListeners() {
    const modalCronograma = document.getElementById("modal-edicao-cronograma");

    if (modalCronograma) {
      console.log("🔹 Cronograma: Configurando listeners do modal");

      // Listener para fechar ao clicar no X ou no Cancelar
      modalCronograma.addEventListener("click", (e) => {
        const isCloseBtn = e.target.closest(".close-modal-btn");
        const isCancelBtn = e.target.closest(
          '[data-modal-id="modal-edicao-cronograma"]'
        );

        if (isCloseBtn || isCancelBtn) {
          fecharModalCronograma();
        }
      });

      // Listener para fechar ao clicar fora do modal-content
      modalCronograma.addEventListener("click", (e) => {
        if (e.target === modalCronograma) {
          fecharModalCronograma();
        }
      });

      console.log("✅ Cronograma: Listeners configurados");
    } else {
      console.warn("⚠️ Cronograma: Modal não encontrado no DOM");
    }
  }
})();
