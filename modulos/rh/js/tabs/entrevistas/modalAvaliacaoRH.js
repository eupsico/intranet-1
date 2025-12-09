/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoRH.js
 * Versão: 1.0.0 (Módulo Refatorado)
 * Data: 05/11/2025
 * Descrição: Gerencia o modal de avaliação da entrevista com RH.
 */

import {
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../../assets/js/firebase-init.js";
import { getCurrentUserName } from "./helpers.js";

let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DO MODAL (Abrir/Fechar/Submeter)
// ============================================

/**
 * Fecha o modal de avaliação
 */
function fecharModalAvaliacao() {
  console.log("🔹 Entrevistas: Fechando modal de avaliação");
  const modalOverlay = document.getElementById("modal-avaliacao-rh");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

/**
 * Gerencia a exibição dos campos "Pontos Fortes" e "Pontos de Atenção"
 * (Refatorado para usar .classList)
 */
function toggleCamposAvaliacaoRH() {
  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const radioAprovado = form.querySelector(
    'input[name="resultado_entrevista"][value="Aprovado"]'
  );
  const radioReprovado = form.querySelector(
    'input[name="resultado_entrevista"][value="Reprovado"]'
  );

  const containerPontosFortes = document
    .getElementById("pontos-fortes")
    ?.closest(".form-group");
  const containerPontosAtencao = document
    .getElementById("pontos-atencao")
    ?.closest(".form-group");

  const textareaPontosFortes = document.getElementById("pontos-fortes");
  const textareaPontosAtencao = document.getElementById("pontos-atencao");

  if (
    !containerPontosFortes ||
    !containerPontosAtencao ||
    !textareaPontosAtencao ||
    !textareaPontosFortes
  ) {
    console.warn(
      "toggleCamposAvaliacaoRH: Não foi possível encontrar os containers ou textareas."
    );
    return;
  }

  if (radioAprovado && radioAprovado.checked) {
    containerPontosFortes.classList.remove("hidden"); // Usa classe
    textareaPontosFortes.required = true;
    containerPontosAtencao.classList.add("hidden"); // Usa classe
    textareaPontosAtencao.required = false;
  } else if (radioReprovado && radioReprovado.checked) {
    containerPontosFortes.classList.add("hidden"); // Usa classe
    textareaPontosFortes.required = false;
    containerPontosAtencao.classList.remove("hidden"); // Usa classe
    textareaPontosAtencao.required = true;
  } else {
    // Estado inicial (nenhum selecionado)
    containerPontosFortes.classList.add("hidden"); // Usa classe
    containerPontosAtencao.classList.add("hidden"); // Usa classe
    textareaPontosFortes.required = false;
    textareaPontosAtencao.required = false;
  }
}

/**
 * Abre o modal de avaliação da Entrevista RH
 */
export function abrirModalAvaliacaoRH(candidatoId, dadosCandidato) {
  console.log(`🔹 Entrevistas: Abrindo modal de avaliação para ${candidatoId}`);

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const form = document.getElementById("form-avaliacao-entrevista-rh");

  if (!modalAvaliacaoRH || !form) {
    window.showToast?.("Erro: Modal de Avaliação não encontrado.", "error");
    console.error("❌ Entrevistas: Elemento modal-avaliacao-rh não encontrado");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_candidato || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.prerequisitos_atendidos ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const linkCurriculo = dadosCandidato.link_curriculo_drive || "#";

  const nomeEl = document.getElementById("entrevista-rh-nome-candidato");
  const statusEl = document.getElementById("entrevista-rh-status-atual");
  const resumoEl = document.getElementById("entrevista-rh-resumo-triagem");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  // Configura o botão "Ver Currículo"
  const btnVerCurriculo = document.getElementById(
    "entrevista-rh-ver-curriculo"
  );
  const modalFooter = modalAvaliacaoRH.querySelector(".modal-footer");

  if (btnVerCurriculo && modalFooter) {
    btnVerCurriculo.href = linkCurriculo;

    // Limpa classes e estilos antigos
    btnVerCurriculo.className = "";
    btnVerCurriculo.style = ""; // Limpa qualquer CSS inline

    // Adiciona classes do Design System
    btnVerCurriculo.classList.add("action-button", "warning", "ms-auto");
    btnVerCurriculo.target = "_blank";
    btnVerCurriculo.innerHTML =
      '<i class="fas fa-file-alt me-2"></i> Ver Currículo';

    if (!linkCurriculo || linkCurriculo === "#") {
      btnVerCurriculo.classList.add("hidden");
    } else {
      btnVerCurriculo.classList.remove("hidden");
    }

    // Garante que ele seja o primeiro item no footer
    if (modalFooter.firstChild !== btnVerCurriculo) {
      modalFooter.prepend(btnVerCurriculo);
    }
  }

  if (form) form.reset();

  // Preenche dados da avaliação existente
  const avaliacaoExistente = dadosCandidato.entrevista_rh;
  if (avaliacaoExistente) {
    if (form) {
      form.querySelector("#nota-motivacao").value =
        avaliacaoExistente.notas?.motivacao || "";
      form.querySelector("#nota-aderencia").value =
        avaliacaoExistente.notas?.aderencia || "";
      form.querySelector("#nota-comunicacao").value =
        avaliacaoExistente.notas?.comunicacao || "";
      form.querySelector("#pontos-fortes").value =
        avaliacaoExistente.pontos_fortes || "";
      form.querySelector("#pontos-atencao").value =
        avaliacaoExistente.pontos_atencao || "";

      if (avaliacaoExistente.resultado) {
        const radio = form.querySelector(
          `input[name="resultado_entrevista"][value="${avaliacaoExistente.resultado}"]`
        );
        if (radio) radio.checked = true;
      }
    }
  }

  // Adicionar listeners para os radio buttons
  const radiosResultado = form.querySelectorAll(
    'input[name="resultado_entrevista"]'
  );
  radiosResultado.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoRH);
    radio.addEventListener("change", toggleCamposAvaliacaoRH);
  });

  // Chamar a função uma vez para setar o estado inicial
  toggleCamposAvaliacaoRH();

  // Adiciona listener de submit
  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);

  // Adiciona listeners de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  modalAvaliacaoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de avaliação aberto");
}

/**
 * Submete a avaliação da Entrevista RH
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

  console.log("🔹 Entrevistas: Submetendo avaliação");
  const state = window.getGlobalRecrutamentoState();
  if (!state) {
    window.showToast?.("Erro: Estado global não iniciado.", "error");
    return;
  }
  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-entrevista-rh"
  );

  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;
  const candidaturaId = modalAvaliacaoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAvaliacao) {
    console.error(
      "❌ Erro crítico: ID da candidatura ou botão de registro não encontrado."
    );
    return;
  }

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione o Resultado da Entrevista.",
      "error"
    );
    return;
  }

  if (
    resultado === "Aprovado" &&
    (!pontosFortes || pontosFortes.trim().length === 0)
  ) {
    window.showToast?.(
      "Para aprovar, é obrigatório preencher os Pontos Fortes.",
      "error"
    );
    return;
  }

  if (
    resultado === "Reprovado" &&
    (!pontosAtencao || pontosAtencao.trim().length === 0)
  ) {
    window.showToast?.(
      "Para reprovar, é obrigatório preencher os Motivos da Reprovação (Pontos de Atenção).",
      "error"
    );
    return;
  }

  btnRegistrarAvaliacao.disabled = true;
  btnRegistrarAvaliacao.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado ? "TESTE_PENDENTE" : "REPROVADO";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacao = {
    resultado: resultado,
    data_avaliacao: new Date(),
    avaliador_nome: avaliadorNome,
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontos_fortes: isAprovado ? pontosFortes : "",
    pontos_atencao: !isAprovado ? pontosAtencao : "",
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: {
        ...(dadosCandidatoAtual.entrevista_rh || {}),
        ...dadosAvaliacao,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Entrevista RH: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatusCandidato}`,
        usuario: avaliadorNome,
      }),
    });

    window.showToast?.(
      `Avaliação de Entrevista RH registrada. Status: ${novoStatusCandidato}`,
      "success"
    );
    console.log("✅ Entrevistas: Avaliação salva no Firestore");

    fecharModalAvaliacao();
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro ao salvar avaliação:", error);
    window.showToast?.(
      `Erro ao registrar a decisão: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
  }
}
