/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoRH.js
 * Versão: 2.2.0 (Correção Layout Ficha e Status Igual ao Card)
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
    return;
  }

  if (radioAprovado && radioAprovado.checked) {
    containerPontosFortes.classList.remove("hidden");
    textareaPontosFortes.required = true;
    containerPontosAtencao.classList.add("hidden");
    textareaPontosAtencao.required = false;
  } else if (radioReprovado && radioReprovado.checked) {
    containerPontosFortes.classList.add("hidden");
    textareaPontosFortes.required = false;
    containerPontosAtencao.classList.remove("hidden");
    textareaPontosAtencao.required = true;
  } else {
    containerPontosFortes.classList.add("hidden");
    containerPontosAtencao.classList.add("hidden");
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
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_candidato || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_curriculo?.prerequisitos_atendidos ||
    dadosCandidato.triagem_curriculo?.comentarios_gerais ||
    "N/A";

  // Pega o status cru do banco
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const linkCurriculo = dadosCandidato.link_curriculo_drive || "#";

  // Elementos do DOM
  const nomeEl = document.getElementById("entrevista-rh-nome-candidato");
  const statusEl = document.getElementById("entrevista-rh-status-atual");
  const resumoEl = document.getElementById("entrevista-rh-resumo-triagem");

  if (nomeEl) nomeEl.textContent = nomeCompleto;

  // ✅ ALTERADO: Lógica de Status igual ao Card
  if (statusEl) {
    // 1. Substitui underscores por espaços para ficar legível
    statusEl.textContent = statusAtual.replace(/_/g, " ");

    // 2. Define a classe base
    statusEl.className = "status-badge";

    // 3. Aplica a cor correta (Azul para pendente, Verde para agendada/aprovada)
    if (
      statusAtual.includes("AGENDADA") ||
      statusAtual.includes("APROVADO") ||
      statusAtual.includes("CONTRATADO")
    ) {
      statusEl.classList.add("status-success");
    } else if (statusAtual.includes("REPROVADO")) {
      statusEl.classList.add("status-rejeitada");
    } else {
      // Para "ENTREVISTA_RH_PENDENTE" ou outros, usa Azul (info) igual ao card
      statusEl.classList.add("status-info");
    }
  }

  if (resumoEl) resumoEl.textContent = resumoTriagem;

  // Configura o botão "Ver Currículo"
  const btnVerCurriculo = document.getElementById(
    "entrevista-rh-ver-curriculo"
  );

  if (btnVerCurriculo) {
    btnVerCurriculo.href = linkCurriculo;
    if (!linkCurriculo || linkCurriculo === "#") {
      btnVerCurriculo.classList.add("hidden");
    } else {
      btnVerCurriculo.classList.remove("hidden");
    }
  }

  if (form) form.reset();

  // Preenche dados da avaliação existente se houver
  const avaliacaoExistente = dadosCandidato.entrevista_rh;
  if (avaliacaoExistente && form) {
    // Notas - Critérios Antigos
    form.querySelector("#nota-motivacao").value =
      avaliacaoExistente.notas?.motivacao || "";
    form.querySelector("#nota-aderencia").value =
      avaliacaoExistente.notas?.aderencia || "";
    form.querySelector("#nota-comunicacao").value =
      avaliacaoExistente.notas?.comunicacao || "";

    // Notas - Novos Critérios
    form.querySelector("#nota-tecnica").value =
      avaliacaoExistente.notas?.tecnica || "";
    form.querySelector("#nota-experiencia").value =
      avaliacaoExistente.notas?.experiencia || "";
    form.querySelector("#nota-postura").value =
      avaliacaoExistente.notas?.postura || "";
    form.querySelector("#nota-adaptacao").value =
      avaliacaoExistente.notas?.adaptacao || "";
    form.querySelector("#nota-resolucao").value =
      avaliacaoExistente.notas?.resolucao || "";

    // Campos de Texto
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

  const radiosResultado = form.querySelectorAll(
    'input[name="resultado_entrevista"]'
  );
  radiosResultado.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoRH);
    radio.addEventListener("change", toggleCamposAvaliacaoRH);
  });

  toggleCamposAvaliacaoRH();

  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);

  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  modalAvaliacaoRH.classList.add("is-visible");
}

/**
 * Submete a avaliação da Entrevista RH
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

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

  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;

  // Coleta das Notas
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const notaTecnica = form.querySelector("#nota-tecnica").value;
  const notaExperiencia = form.querySelector("#nota-experiencia").value;
  const notaPostura = form.querySelector("#nota-postura").value;
  const notaAdaptacao = form.querySelector("#nota-adaptacao").value;
  const notaResolucao = form.querySelector("#nota-resolucao").value;

  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;

  if (!resultado) {
    window.showToast?.("Por favor, selecione o Resultado.", "error");
    return;
  }

  if (
    resultado === "Aprovado" &&
    (!pontosFortes || pontosFortes.trim().length === 0)
  ) {
    window.showToast?.("Para aprovar, preencha os Pontos Fortes.", "error");
    return;
  }

  if (
    resultado === "Reprovado" &&
    (!pontosAtencao || pontosAtencao.trim().length === 0)
  ) {
    window.showToast?.(
      "Para reprovar, preencha os Motivos da Reprovação.",
      "error"
    );
    return;
  }

  btnRegistrarAvaliacao.disabled = true;
  btnRegistrarAvaliacao.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado ? "TESTE_PENDENTE" : "REPROVADO";
  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacao = {
    resultado: resultado,
    data_avaliacao: new Date(),
    avaliador_nome: avaliadorNome,
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
      tecnica: notaTecnica,
      experiencia: notaExperiencia,
      postura: notaPostura,
      adaptacao: notaAdaptacao,
      resolucao: notaResolucao,
    },
    pontos_fortes: isAprovado ? pontosFortes : "",
    pontos_atencao: !isAprovado ? pontosAtencao : "",
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    const updatePayload = {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: {
        ...(dadosCandidatoAtual.entrevista_rh || {}),
        ...dadosAvaliacao,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Entrevista RH: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }.`,
        usuario: avaliadorNome,
      }),
    };

    if (!isAprovado) {
      updatePayload.rejeicao = {
        etapa: "Entrevista RH",
        justificativa: pontosAtencao,
        data: new Date(),
      };
    }

    await updateDoc(candidaturaRef, updatePayload);

    window.showToast?.("Avaliação registrada com sucesso!", "success");
    fecharModalAvaliacao();

    // Recarrega a aba
    const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro ao salvar avaliação:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
  }
}
