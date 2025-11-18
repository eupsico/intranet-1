/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.1.1 - CORRIGIDO: Mapeamento de campos do Gabarito (Cross-Collection).
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

    // ======================================================================
    // ✅ CORREÇÃO APLICADA: Busca as chaves prováveis do seu Firestore
    // ======================================================================
    const enunciado =
      pergunta.enunciado || pergunta.pergunta || "Enunciado não encontrado";
    const gabaritoTexto =
      pergunta.respostaCorreta || pergunta.gabarito || "Gabarito não fornecido"; // respostaCorreta (com C maiúsculo) é comum em schemas Firebase
    const comentarios = pergunta.comentarios || pergunta.nota || "N/A";
    // ======================================================================

    let status = "info";
    let feedback = "Avaliação Manual";

    if (gabaritoTexto !== "Gabarito não fornecido") {
      // Lógica de comparação para pontuação automática (string match)
      // Normalização: Remove espaços e converte para minúsculas para comparação robusta
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
        feedback = '<i class="fas fa-check-circle me-1"></i> Resposta Correta!';
      } else {
        status = "danger";
        feedback =
          '<i class="fas fa-times-circle me-1"></i> Resposta Incorreta!';
      }
    } else {
      feedback =
        '<i class="fas fa-exclamation-triangle me-1"></i> Avaliação manual necessária.';
    }

    const cardClass = `border-${status} bg-white`;

    html += `
            <div class="comparacao-card card mb-4 ${cardClass}" style="border-left: 5px solid var(--cor-${status});">
                <div class="card-header bg-light">
                    <h6 class="mb-0">Questão ${index + 1}: ${enunciado}</h6>
                    <small class="text-muted">${feedback}</small>
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
                </div>
            </div>
        `;
  });

  // Atualiza estatísticas no topo
  totalPerguntas = gabaritoPerguntas.length;
  const erros = totalPerguntas - acertos;
  const taxa =
    totalPerguntas > 0
      ? ((acertos / totalPerguntas) * 100).toFixed(2) + "%"
      : "N/A";

  document.getElementById("stats-total").textContent = totalPerguntas;
  document.getElementById("stats-acertos").textContent = acertos;
  document.getElementById("stats-erros").textContent = erros;
  document.getElementById("stats-taxa").textContent = taxa;

  // Atualiza título da página com o nome do teste e tempo gasto
  const tempoGastoDisplay = tempoGasto
    ? `${Math.floor(tempoGasto / 60)}m ${tempoGasto % 60}s`
    : "N/A";
  document.getElementById(
    "detalhes-teste-titulo"
  ).innerHTML = `<i class="fas fa-eye me-2"></i> Avaliação: ${nomeTeste} <small class="text-muted" style="font-size: 0.6em;"> (Tempo Gasto: ${tempoGastoDisplay})</small>`;

  container.innerHTML = html;
}

// Expõe a função de inicialização
export { initdetalhesTeste as init };
