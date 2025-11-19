/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.2.1 - Adicionado exibição de texto das alternativas em múltipla escolha.
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

// Estado global para armazenar validações do avaliador
let validacoesAvaliador = {};
let totalPerguntas = 0;

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

    // 3. Renderizar comparação e calcular estatísticas
    // Passamos as respostas do candidato, o gabarito do teste original e o tempo gasto
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
 * 2. Função auxiliar para obter o texto de uma alternativa
 */
function obterTextoAlternativa(pergunta, numeroResposta) {
  // Se não for um número, retorna o valor original
  const num = parseInt(numeroResposta, 10);
  if (isNaN(num)) {
    return numeroResposta;
  }

  // Verifica se a pergunta tem alternativas (múltipla escolha)
  const alternativas =
    pergunta.alternativas || pergunta.opcoes || pergunta.alternativa;

  if (
    !alternativas ||
    !Array.isArray(alternativas) ||
    alternativas.length === 0
  ) {
    return numeroResposta; // Retorna o número se não houver alternativas
  }

  // As alternativas geralmente são um array: ["Texto A", "Texto B", "Texto C", "Texto D"]
  // O número pode ser 0-based ou 1-based, vamos tentar ambos
  const indexZeroBased = num;
  const indexOneBased = num - 1;

  let textoAlternativa = null;

  // Tenta index baseado em 0 (0, 1, 2, 3...)
  if (indexZeroBased >= 0 && indexZeroBased < alternativas.length) {
    textoAlternativa = alternativas[indexZeroBased];
  }
  // Tenta index baseado em 1 (1, 2, 3, 4...)
  else if (indexOneBased >= 0 && indexOneBased < alternativas.length) {
    textoAlternativa = alternativas[indexOneBased];
  }

  if (textoAlternativa) {
    // Retorna formatado: "Alternativa B: Texto da alternativa"
    const letra = String.fromCharCode(
      65 + (indexOneBased >= 0 ? indexOneBased : indexZeroBased)
    ); // A, B, C, D...
    return `<strong>Alternativa ${letra}:</strong> ${textoAlternativa}`;
  }

  // Se não encontrou, retorna o número original
  return numeroResposta;
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
  totalPerguntas = gabaritoPerguntas.length;

  // Resetar validações
  validacoesAvaliador = {};

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
    const respostaCandidatoRaw = respostasMap[index] || "Não respondida";

    const enunciado =
      pergunta.enunciado || pergunta.pergunta || "Enunciado não encontrado";
    const gabaritoTextoRaw =
      pergunta.respostaCorreta || pergunta.gabarito || "Gabarito não fornecido";
    const comentarios = pergunta.comentarios || pergunta.nota || "N/A";

    // Converter respostas numéricas para texto das alternativas
    const respostaCandidato = obterTextoAlternativa(
      pergunta,
      respostaCandidatoRaw
    );
    const gabaritoTexto = obterTextoAlternativa(pergunta, gabaritoTextoRaw);

    // Botões de validação manual
    const botoesValidacao = `
      <div class="mt-3 d-flex gap-2 align-items-center">
        <span class="me-2"><strong>Avaliação do Avaliador:</strong></span>
        <button class="btn btn-success btn-sm" onclick="window.marcarResposta(${index}, true)">
          <i class="fas fa-check me-1"></i> Correta
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.marcarResposta(${index}, false)">
          <i class="fas fa-times me-1"></i> Incorreta
        </button>
        <span class="badge bg-secondary ms-2" id="status-questao-${index}">Não avaliada</span>
      </div>
    `;

    html += `
      <div class="card mb-4" id="card-questao-${index}">
        <div class="card-header bg-light">
          <h6 class="mb-0">Questão ${index + 1}: ${enunciado}</h6>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="d-block mb-2"><strong>Resposta do Candidato:</strong></label>
              <div class="p-3 border rounded bg-light">${respostaCandidato}</div>
            </div>
            <div class="col-md-6 mb-3">
              <label class="d-block mb-2"><strong>Resposta Correta / Gabarito:</strong></label>
              <div class="p-3 border rounded border-primary bg-light">${gabaritoTexto}</div>
            </div>
          </div>
          
          <small class="text-muted d-block mt-2"><strong>Comentários (do Gabarito):</strong> ${comentarios}</small>
          
          ${botoesValidacao}
        </div>
      </div>
    `;
  });

  // Atualiza título da página com o nome do teste e tempo gasto
  const tempoGastoDisplay = tempoGasto
    ? `${Math.floor(tempoGasto / 60)}m ${tempoGasto % 60}s`
    : "N/A";
  document.getElementById(
    "detalhes-teste-titulo"
  ).innerHTML = `<i class="fas fa-eye me-2"></i> Avaliação: ${nomeTeste} <small class="text-muted" style="font-size: 0.6em;"> (Tempo Gasto: ${tempoGastoDisplay})</small>`;

  container.innerHTML = html;

  // Inicializar estatísticas como "aguardando avaliação"
  document.getElementById("stats-total").textContent = totalPerguntas;
  document.getElementById("stats-acertos").textContent = "Aguardando";
  document.getElementById("stats-erros").textContent = "Aguardando";
  document.getElementById("stats-taxa").textContent = "Aguardando";
}

/**
 * 4. Função para marcar uma resposta como correta ou incorreta
 */
window.marcarResposta = function (index, isCorreta) {
  validacoesAvaliador[index] = isCorreta;

  // Atualizar visual da questão
  const card = document.getElementById(`card-questao-${index}`);
  const statusBadge = document.getElementById(`status-questao-${index}`);

  card.classList.remove("border-success", "border-danger");

  if (isCorreta) {
    card.classList.add("border-success");
    card.style.borderLeft = "5px solid var(--color-success)";
    statusBadge.className = "badge bg-success ms-2";
    statusBadge.innerHTML = '<i class="fas fa-check me-1"></i> Correta';
  } else {
    card.classList.add("border-danger");
    card.style.borderLeft = "5px solid var(--color-error)";
    statusBadge.className = "badge bg-danger ms-2";
    statusBadge.innerHTML = '<i class="fas fa-times me-1"></i> Incorreta';
  }

  // Recalcular estatísticas
  calcularEstatisticas();
};

/**
 * 5. Função para calcular e atualizar as estatísticas
 */
function calcularEstatisticas() {
  const totalAvaliadas = Object.keys(validacoesAvaliador).length;

  if (totalAvaliadas === 0) {
    // Nenhuma avaliação ainda
    document.getElementById("stats-acertos").textContent = "Aguardando";
    document.getElementById("stats-erros").textContent = "Aguardando";
    document.getElementById("stats-taxa").textContent = "Aguardando";
    document.getElementById("aviso-avaliacao").style.display = "block";
    return;
  }

  let acertos = 0;
  Object.values(validacoesAvaliador).forEach((isCorreta) => {
    if (isCorreta) acertos++;
  });

  const erros = totalAvaliadas - acertos;
  const taxa =
    totalAvaliadas > 0
      ? ((acertos / totalPerguntas) * 100).toFixed(2) + "%"
      : "N/A";

  document.getElementById("stats-acertos").textContent = acertos;
  document.getElementById("stats-erros").textContent = erros;
  document.getElementById("stats-taxa").textContent = taxa;

  // Se todas as questões foram avaliadas, esconder o aviso
  if (totalAvaliadas === totalPerguntas) {
    document.getElementById("aviso-avaliacao").style.display = "none";
  } else {
    document.getElementById("aviso-avaliacao").innerHTML = `
      <i class="fas fa-info-circle me-2"></i>
      <strong>Progresso:</strong> ${totalAvaliadas} de ${totalPerguntas} questões avaliadas. Continue avaliando as respostas restantes.
    `;
  }
}

// Expõe a função de inicialização
export { initdetalhesTeste as init };
