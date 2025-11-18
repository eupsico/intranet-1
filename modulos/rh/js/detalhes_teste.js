/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.2.0 - ADICIONADO: Avaliação manual + Melhorias CSS
 * Data: 18/11/2025
 * Descrição: View de comparação detalhada das respostas de um teste com o gabarito.
 * Agora utiliza a Cloud Function 'getDetalhesTeste' para consolidar os dados.
 */

import {
  db,
  functions,
  httpsCallable,
} from "../../../assets/js/firebase-init.js";

// Definição da função Cloud Function (deve ser a que você implementou no index.js)
const getDetalhesTeste = httpsCallable(functions, "getDetalhesTeste");

// ✅ ADICIONADO: Estado global para controle de avaliações manuais
const avaliacoesManual = new Map();

/**
 * 1. Função principal de inicialização da view
 */
export async function initdetalhesTeste() {
  console.log("🔹 Detalhes Teste: Inicializando view...");

  // O roteador (rh-painel.js) usa window.location.hash
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.split("?")[1]);

  // Parâmetros passados pelo modal AvaliacaoTeste.js
  const tokenId = urlParams.get("token");
  const candidatoId = urlParams.get("candidato");

  if (!tokenId || !candidatoId) {
    document.getElementById("comparacao-respostas-container").innerHTML =
      '<div class="alert alert-danger">Erro: Token ou ID do Candidato ausente na URL.</div>';
    return;
  }

  // Limpa a tela antes de carregar
  document.getElementById("comparacao-respostas-container").innerHTML =
    '<div class="loading-spinner"></div><p class="text-muted text-center mt-3">Carregando dados da avaliação...</p>';

  try {
    // 1.1 Chamar Cloud Function para obter todos os dados consolidados
    const result = await getDetalhesTeste({ tokenId, candidatoId });
    const {
      nomeCandidato,
      statusCandidato,
      respostasCandidato,
      gabarito,
      nomeTeste,
      tempoGasto,
    } = result.data;

    if (!result.data.success) {
      throw new Error(
        result.data.message || "Falha ao obter detalhes do teste."
      );
    }

    // 2. Preencher o cabeçalho
    document.getElementById("cand-nome").textContent = nomeCandidato;
    document.getElementById("teste-nome").textContent = nomeTeste;
    document.getElementById("teste-status").textContent = statusCandidato;

    // ✅ ADICIONADO: Limpar avaliações anteriores
    avaliacoesManual.clear();

    // 3. Renderizar comparação e calcular estatísticas
    renderizarComparacaoDetalhada(
      respostasCandidato,
      gabarito,
      nomeTeste,
      tempoGasto
    );
  } catch (error) {
    console.error("❌ Erro ao carregar detalhes do teste:", error);
    document.getElementById(
      "comparacao-respostas-container"
    ).innerHTML = `<div class="alert alert-danger">Não foi possível carregar os detalhes do teste. Detalhes: ${error.message}</div>`;
  }
}

/**
 * 2. Função de renderização e cálculo
 */
function renderizarComparacaoDetalhada(
  respostas,
  gabaritoPerguntas,
  nomeTeste,
  tempoGasto
) {
  if (!respostas || !gabaritoPerguntas || gabaritoPerguntas.length === 0) {
    document.getElementById("comparacao-respostas-container").innerHTML =
      '<div class="alert alert-warning">Não foi possível calcular a pontuação. Gabarito ou respostas ausentes.</div>';
    return;
  }

  const container = document.getElementById("comparacao-respostas-container");
  let html = "";
  let totalPerguntas = gabaritoPerguntas.length;
  let acertos = 0;
  let questoesComAvaliacaoManual = 0;

  // Mapeia as respostas do candidato para um formato de fácil acesso (chave é o index 0, 1, 2...)
  const respostasMap = {};
  Object.keys(respostas).forEach((key) => {
    const index = parseInt(key.replace("resposta-", ""), 10);
    if (!isNaN(index)) {
      respostasMap[index] = respostas[key];
    }
  });

  gabaritoPerguntas.forEach((pergunta, index) => {
    const respostaCandidato = respostasMap[index] || "Não respondida";

    const enunciado =
      pergunta.enunciado || pergunta.pergunta || "Enunciado não encontrado";
    const gabaritoTexto =
      pergunta.respostaCorreta || pergunta.gabarito || "Gabarito não fornecido";
    const comentarios = pergunta.comentarios || pergunta.nota || "N/A";

    let status = "info";
    let feedback = "Avaliação Manual";
    let necessitaAvaliacaoManual = false;
    let acertoAutomatico = false;

    if (gabaritoTexto !== "Gabarito não fornecido") {
      const candNorm = String(respostaCandidato)
        .replace(/\s/g, "")
        .toLowerCase()
        .trim();
      const corrNorm = String(gabaritoTexto)
        .replace(/\s/g, "")
        .toLowerCase()
        .trim();

      if (candNorm === corrNorm && candNorm.length > 0) {
        status = "success";
        acertos++;
        acertoAutomatico = true;
        feedback = '<i class="fas fa-check-circle me-1"></i> Resposta Correta!';
      } else if (candNorm.length > 0) {
        status = "danger";
        feedback =
          '<i class="fas fa-times-circle me-1"></i> Resposta Incorreta!';
      } else {
        necessitaAvaliacaoManual = true;
        questoesComAvaliacaoManual++;
        feedback =
          '<i class="fas fa-exclamation-triangle me-1"></i> Aguardando Avaliação Manual';
      }
    } else {
      necessitaAvaliacaoManual = true;
      questoesComAvaliacaoManual++;
      feedback =
        '<i class="fas fa-exclamation-triangle me-1"></i> Aguardando Avaliação Manual';
    }

    // ✅ ADICIONADO: Verificar se já foi avaliada manualmente
    if (avaliacoesManual.has(index)) {
      const avaliacaoManual = avaliacoesManual.get(index);
      status = avaliacaoManual ? "success" : "danger";
      feedback = avaliacaoManual
        ? '<i class="fas fa-check-circle me-1"></i> Marcada como Correta (Manual)'
        : '<i class="fas fa-times-circle me-1"></i> Marcada como Incorreta (Manual)';
      necessitaAvaliacaoManual = false;
    }

    const cardClass = `border-${status} bg-white`;
    const statusBadgeClass =
      status === "success"
        ? "status-sucesso"
        : status === "danger"
        ? "status-erro"
        : "status-pendente";
    const statusBadgeText =
      status === "success"
        ? "Correta"
        : status === "danger"
        ? "Incorreta"
        : "Pendente";

    // ✅ ADICIONADO: Controles de avaliação manual
    const controlesAvaliacao = necessitaAvaliacaoManual
      ? `
      <div class="mt-3 pt-3" style="border-top: 1px solid var(--cor-borda); display: flex; gap: 10px; align-items: center;">
        <label style="font-weight: 500; color: var(--cor-texto-principal); margin-right: 10px;">Avaliação Manual:</label>
        <button class="btn btn-sm btn-sucesso" onclick="window.avaliarQuestaoManual(${index}, true)">
          ✓ Correta
        </button>
        <button class="btn btn-sm btn-erro" onclick="window.avaliarQuestaoManual(${index}, false)">
          ✗ Incorreta
        </button>
      </div>
    `
      : "";

    html += `
      <div class="comparacao-card card mb-4 ${cardClass}" style="border-left: 5px solid var(--cor-${status});" data-questao-index="${index}">
        <div class="card-header bg-light" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h6 class="mb-0">Questão ${index + 1}: ${enunciado}</h6>
            <small class="text-muted">${feedback}</small>
          </div>
          <span class="status-badge ${statusBadgeClass}">${statusBadgeText}</span>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="d-block mb-1"><strong>Resposta do Candidato:</strong></label>
              <div class="p-3 border rounded text-dark">${respostaCandidato}</div>
            </div>
            <div class="col-md-6 mb-3">
              <label class="d-block mb-1 text-${status}"><strong>Resposta Correta / Gabarito:</strong></label>
              <div class="p-3 border rounded border-2 text-${status}">${gabaritoTexto}</div>
            </div>
          </div>
          
          <small class="text-muted d-block mt-2"><strong>Comentários (do Gabarito):</strong> ${comentarios}</small>
          ${controlesAvaliacao}
        </div>
      </div>
    `;
  });

  // Atualiza estatísticas no topo
  atualizarEstatisticas(totalPerguntas, acertos);

  // Atualiza título da página com o nome do teste e tempo gasto
  const tempoGastoDisplay = tempoGasto
    ? `${Math.floor(tempoGasto / 60)}m ${tempoGasto % 60}s`
    : "N/A";
  document.getElementById(
    "detalhes-teste-titulo"
  ).innerHTML = `<i class="fas fa-eye me-2"></i> Avaliação: ${nomeTeste} <small class="text-muted" style="font-size: 0.6em;"> (Tempo Gasto: ${tempoGastoDisplay})</small>`;

  container.innerHTML = html;

  // ✅ ADICIONADO: Exibir alerta se houver questões pendentes
  if (questoesComAvaliacaoManual > 0) {
    exibirAlertaAvaliacaoPendente(questoesComAvaliacaoManual);
  }
}

// ✅ ADICIONADO: Função para exibir alerta de avaliação pendente
function exibirAlertaAvaliacaoPendente(quantidade) {
  const container = document.getElementById("comparacao-respostas-container");
  const alertaHtml = `
    <div class="alert alert-alerta mb-3" id="alerta-avaliacao-pendente" style="display: flex; align-items: center; gap: 10px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <div>
        <strong>Avaliação Manual Necessária:</strong> ${quantidade} ${
    quantidade === 1 ? "questão necessita" : "questões necessitam"
  } de avaliação manual. 
        Marque cada resposta como correta ou incorreta. As estatísticas serão recalculadas automaticamente.
      </div>
    </div>
  `;
  container.insertAdjacentHTML("afterbegin", alertaHtml);
}

// ✅ ADICIONADO: Função global para avaliar questão manualmente
window.avaliarQuestaoManual = function (index, isCorreta) {
  avaliacoesManual.set(index, isCorreta);

  console.log(
    `✅ Questão ${index} avaliada manualmente como: ${
      isCorreta ? "Correta" : "Incorreta"
    }`
  );

  // Atualizar card visualmente
  const card = document.querySelector(
    `.comparacao-card[data-questao-index="${index}"]`
  );
  if (card) {
    const status = isCorreta ? "success" : "danger";
    const statusBadgeClass = isCorreta ? "status-sucesso" : "status-erro";
    const statusBadgeText = isCorreta ? "Correta" : "Incorreta";

    card.className = `comparacao-card card mb-4 border-${status} bg-white`;
    card.style.borderLeftColor = `var(--cor-${status})`;

    const badge = card.querySelector(".status-badge");
    if (badge) {
      badge.className = `status-badge ${statusBadgeClass}`;
      badge.textContent = statusBadgeText;
    }

    const feedback = card.querySelector(".card-header small");
    if (feedback) {
      feedback.innerHTML = `<i class="fas fa-${
        isCorreta ? "check" : "times"
      }-circle me-1"></i> Marcada como ${statusBadgeText} (Manual)`;
    }

    // Remover controles
    const controles = card.querySelector(".mt-3.pt-3");
    if (controles) {
      controles.remove();
    }
  }

  // Recalcular estatísticas
  recalcularEstatisticas();

  // Verificar se ainda há questões pendentes
  const pendentes = document.querySelectorAll(
    ".status-badge.status-pendente"
  ).length;
  if (pendentes === 0) {
    const alerta = document.getElementById("alerta-avaliacao-pendente");
    if (alerta) {
      alerta.remove();
    }
  }
};

// ✅ ADICIONADO: Recalcular estatísticas
function recalcularEstatisticas() {
  const cards = document.querySelectorAll(".comparacao-card");
  let acertos = 0;

  cards.forEach((card) => {
    if (card.classList.contains("border-success")) {
      acertos++;
    }
  });

  atualizarEstatisticas(cards.length, acertos);
}

// ✅ ADICIONADO: Atualizar estatísticas no DOM
function atualizarEstatisticas(total, acertos) {
  const erros = total - acertos;
  const taxa = total > 0 ? ((acertos / total) * 100).toFixed(2) + "%" : "N/A";

  document.getElementById("stats-total").textContent = total;
  document.getElementById("stats-acertos").textContent = acertos;
  document.getElementById("stats-erros").textContent = erros;
  document.getElementById("stats-taxa").textContent = taxa;
}

// Expõe a função de inicialização
export { initdetalhesTeste as init };
