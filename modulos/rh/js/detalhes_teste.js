/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.2.0 - ADICIONADO: Avaliação manual antes do cálculo de pontuação
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

// Estado global para controle de avaliações manuais
const avaliacoes = new Map(); // Map<questaoIndex, boolean> (true = correta, false = incorreta)

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

    // 3. Limpar avaliações anteriores
    avaliacoes.clear();

    // 4. Renderizar comparação com controles de avaliação manual
    renderizarComparacaoDetalhada(
      respostasCandidato,
      gabarito,
      nomeTeste,
      tempoGasto
    );

    // 5. Exibir alerta de avaliação pendente
    exibirAlertaAvaliacao();
  } catch (error) {
    console.error("❌ Erro ao carregar detalhes do teste:", error);
    document.getElementById(
      "comparacao-respostas-container"
    ).innerHTML = `<div class="alert alert-danger">Não foi possível carregar os detalhes do teste. Detalhes: ${error.message}</div>`;
  }
}

/**
 * 2. Exibir alerta de avaliação pendente
 */
function exibirAlertaAvaliacao() {
  const statsContainer = document.querySelector(".stats-container");
  if (statsContainer) {
    const alertaHtml = `
      <div class="alert alert-alerta mb-3" id="alerta-avaliacao" style="display: flex; align-items: center; gap: 10px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <strong>Avaliação Manual Necessária:</strong> Para questões sem comparação automática, 
          marque cada resposta como correta ou incorreta. O resumo será recalculado automaticamente.
        </div>
      </div>
    `;
    statsContainer.insertAdjacentHTML("beforebegin", alertaHtml);
  }
}

/**
 * 3. Função de renderização e cálculo
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
  let acertosAutomaticos = 0;
  let necessitaAvaliacaoManual = false;

  // Mapeia as respostas do candidato para um formato de fácil acesso (chave é o index 0, 1, 2...)
  const respostasMap = {};
  Object.keys(respostas).forEach((key) => {
    // A chave no Firestore é "resposta-0", "resposta-1", etc.
    const index = parseInt(key.replace("resposta-", ""), 10);
    if (!isNaN(index)) {
      respostasMap[index] = respostas[key];
    }
  });

  gabaritoPerguntas.forEach((pergunta, index) => {
    // A chave no gabarito é o índice do array de perguntas
    const respostaCandidato = respostasMap[index] || "Não respondida";

    // Busca as chaves prováveis do seu Firestore
    const enunciado =
      pergunta.enunciado || pergunta.pergunta || "Enunciado não encontrado";
    const gabaritoTexto =
      pergunta.respostaCorreta || pergunta.gabarito || "Gabarito não fornecido";
    const comentarios = pergunta.comentarios || pergunta.nota || "N/A";

    let status = "info";
    let feedback = "Avaliação Manual";
    let avaliacaoAutomatica = false;
    let mostrarControles = false;

    if (gabaritoTexto !== "Gabarito não fornecido") {
      // Lógica de comparação para pontuação automática (string match)
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
        acertosAutomaticos++;
        avaliacaoAutomatica = true;
        feedback = '<i class="fas fa-check-circle me-1"></i> Resposta Correta!';
      } else if (candNorm.length > 0) {
        status = "danger";
        avaliacaoAutomatica = true;
        feedback =
          '<i class="fas fa-times-circle me-1"></i> Resposta Incorreta!';
      } else {
        mostrarControles = true;
        necessitaAvaliacaoManual = true;
        feedback =
          '<i class="fas fa-exclamation-triangle me-1"></i> Aguardando Avaliação Manual';
      }
    } else {
      mostrarControles = true;
      necessitaAvaliacaoManual = true;
      feedback =
        '<i class="fas fa-exclamation-triangle me-1"></i> Aguardando Avaliação Manual';
    }

    // Verificar se já foi avaliada manualmente
    if (avaliacoes.has(index)) {
      const avaliacaoManual = avaliacoes.get(index);
      status = avaliacaoManual ? "success" : "danger";
      feedback = avaliacaoManual
        ? '<i class="fas fa-check-circle me-1"></i> Marcada como Correta (Manual)'
        : '<i class="fas fa-times-circle me-1"></i> Marcada como Incorreta (Manual)';
      mostrarControles = false; // Esconder controles após avaliação
    }

    const cardClass = `border-${status} bg-white`;
    const statusBadge = avaliacoes.has(index)
      ? `<span class="status-badge status-${
          avaliacoes.get(index) ? "sucesso" : "erro"
        }">${avaliacoes.get(index) ? "Correta" : "Incorreta"}</span>`
      : avaliacaoAutomatica
      ? `<span class="status-badge status-${
          status === "success" ? "sucesso" : "erro"
        }">${status === "success" ? "Correta" : "Incorreta"}</span>`
      : `<span class="status-badge status-pendente">Pendente</span>`;

    const controlesHtml = mostrarControles
      ? `
      <div class="mt-3 pt-3" style="border-top: 1px solid var(--cor-borda); display: flex; gap: 10px; align-items: center;">
        <label style="font-weight: 500; color: var(--cor-texto-principal); margin-right: 10px;">Avaliação Manual:</label>
        <button class="btn btn-sm btn-sucesso" onclick="window.avaliarResposta(${index}, true)">
          ✓ Correta
        </button>
        <button class="btn btn-sm btn-erro" onclick="window.avaliarResposta(${index}, false)">
          ✗ Incorreta
        </button>
      </div>
    `
      : "";

    html += `
      <div class="comparacao-card card mb-4 ${cardClass}" style="border-left: 5px solid var(--cor-${status});">
        <div class="card-header bg-light" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h6 class="mb-0">Questão ${index + 1}: ${enunciado}</h6>
            <small class="text-muted">${feedback}</small>
          </div>
          ${statusBadge}
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
          ${controlesHtml}
        </div>
      </div>
    `;
  });

  // Atualiza estatísticas no topo (inicialmente só com acertos automáticos)
  atualizarEstatisticas(
    totalPerguntas,
    acertosAutomaticos,
    gabaritoPerguntas.length
  );

  // Atualiza título da página com o nome do teste e tempo gasto
  const tempoGastoDisplay = tempoGasto
    ? `${Math.floor(tempoGasto / 60)}m ${tempoGasto % 60}s`
    : "N/A";
  document.getElementById(
    "detalhes-teste-titulo"
  ).innerHTML = `<i class="fas fa-eye me-2"></i> Avaliação: ${nomeTeste} <small class="text-muted" style="font-size: 0.6em;"> (Tempo Gasto: ${tempoGastoDisplay})</small>`;

  container.innerHTML = html;
}

/**
 * 4. Função global para avaliar uma resposta manualmente
 */
window.avaliarResposta = function (questaoIndex, isCorreta) {
  avaliacoes.set(questaoIndex, isCorreta);

  console.log(
    `✅ Questão ${questaoIndex} avaliada manualmente como: ${
      isCorreta ? "Correta" : "Incorreta"
    }`
  );

  // Recarregar a view para atualizar os badges e estatísticas
  const totalPerguntas = document.querySelectorAll(".comparacao-card").length;
  recalcularEstatisticas(totalPerguntas);

  // Atualizar visualmente o card específico
  atualizarCardAvaliado(questaoIndex, isCorreta);
};

/**
 * 5. Atualizar card após avaliação
 */
function atualizarCardAvaliado(questaoIndex, isCorreta) {
  const cards = document.querySelectorAll(".comparacao-card");
  const card = cards[questaoIndex];

  if (card) {
    const status = isCorreta ? "success" : "danger";
    const statusText = isCorreta ? "Correta" : "Incorreta";
    const statusClass = isCorreta ? "status-sucesso" : "status-erro";

    // Atualizar borda do card
    card.style.borderLeftColor = `var(--cor-${status})`;
    card.className = `comparacao-card card mb-4 border-${status} bg-white`;

    // Atualizar badge
    const badge = card.querySelector(".status-badge");
    if (badge) {
      badge.className = `status-badge ${statusClass}`;
      badge.textContent = statusText;
    }

    // Atualizar feedback
    const feedback = card.querySelector(".card-header small");
    if (feedback) {
      feedback.innerHTML = `<i class="fas fa-${
        isCorreta ? "check" : "times"
      }-circle me-1"></i> Marcada como ${statusText} (Manual)`;
    }

    // Remover controles de avaliação
    const controles = card.querySelector(".mt-3.pt-3");
    if (controles) {
      controles.remove();
    }
  }
}

/**
 * 6. Recalcular estatísticas após avaliações manuais
 */
function recalcularEstatisticas(totalPerguntas) {
  const cards = document.querySelectorAll(".comparacao-card");
  let acertos = 0;

  cards.forEach((card, index) => {
    // Verificar avaliação manual
    if (avaliacoes.has(index)) {
      if (avaliacoes.get(index)) {
        acertos++;
      }
    } else {
      // Contar acertos automáticos
      if (card.classList.contains("border-success")) {
        acertos++;
      }
    }
  });

  atualizarEstatisticas(totalPerguntas, acertos, totalPerguntas);

  // Remover alerta se todas foram avaliadas
  const pendentes = document.querySelectorAll(
    ".status-badge.status-pendente"
  ).length;
  if (pendentes === 0) {
    const alerta = document.getElementById("alerta-avaliacao");
    if (alerta) {
      alerta.remove();
    }
  }
}

/**
 * 7. Atualizar estatísticas no DOM
 */
function atualizarEstatisticas(total, acertos, totalPerguntas) {
  const erros = total - acertos;
  const taxa = total > 0 ? ((acertos / total) * 100).toFixed(2) + "%" : "N/A";

  document.getElementById("stats-total").textContent = total;
  document.getElementById("stats-acertos").textContent = acertos;
  document.getElementById("stats-erros").textContent = erros;
  document.getElementById("stats-taxa").textContent = taxa;
}

// Expõe a função de inicialização
export { initdetalhesTeste as init };
