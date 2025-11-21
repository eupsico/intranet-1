/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.3.2 - Corrigido: Usando setDoc com merge em vez de updateDoc.
 * Data: 18/11/2025
 */

import {
  db,
  functions,
  httpsCallable,
  doc,
  setDoc, // ← Trocado de updateDoc para setDoc
  Timestamp,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// Definição da função Cloud Function
const getDetalhesTeste = httpsCallable(functions, "getDetalhesTeste");

// Estado global para armazenar validações do avaliador
let validacoesAvaliador = {};
let totalPerguntas = 0;
let tokenIdGlobal = null;
let candidatoIdGlobal = null;

/**
 * 1. Função principal de inicialização da view
 */
export async function initdetalhesTeste() {
  console.log("🔹 Detalhes Teste: Inicializando view...");

  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.split("?")[1]);

  const tokenId = urlParams.get("token");
  const candidatoId = urlParams.get("candidato");

  tokenIdGlobal = tokenId;
  candidatoIdGlobal = candidatoId;

  if (!tokenId || !candidatoId) {
    document.getElementById("comparacao-respostas-container").innerHTML =
      '<div class="alert alert-danger">Erro: Token ou ID do Candidato ausente na URL.</div>';
    return;
  }

  document.getElementById("comparacao-respostas-container").innerHTML =
    '<div class="loading-spinner"></div><p class="text-muted text-center mt-3">Carregando dados da avaliação...</p>';

  try {
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

    document.getElementById("cand-nome").textContent = nomeCandidato;
    document.getElementById("teste-nome").textContent = nomeTeste;
    document.getElementById("teste-status").textContent = statusCandidato;

    renderizarComparacaoDetalhada(
      respostasCandidato,
      gabarito,
      nomeTeste,
      tempoGasto
    );

    await carregarAvaliacoesExistentes();
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
  const num = parseInt(numeroResposta, 10);
  if (isNaN(num)) {
    return numeroResposta;
  }

  const alternativas =
    pergunta.alternativas || pergunta.opcoes || pergunta.alternativa;

  if (
    !alternativas ||
    !Array.isArray(alternativas) ||
    alternativas.length === 0
  ) {
    return numeroResposta;
  }

  const indexZeroBased = num;
  const indexOneBased = num - 1;

  let textoAlternativa = null;
  let indexUsado = -1;

  if (indexZeroBased >= 0 && indexZeroBased < alternativas.length) {
    textoAlternativa = alternativas[indexZeroBased];
    indexUsado = indexZeroBased;
  } else if (indexOneBased >= 0 && indexOneBased < alternativas.length) {
    textoAlternativa = alternativas[indexOneBased];
    indexUsado = indexOneBased;
  }

  if (textoAlternativa) {
    if (typeof textoAlternativa === "object" && textoAlternativa !== null) {
      const textoExtraido =
        textoAlternativa.texto ||
        textoAlternativa.resposta ||
        textoAlternativa.alternativa ||
        textoAlternativa.opcao ||
        textoAlternativa.label ||
        textoAlternativa.valor ||
        textoAlternativa.value ||
        JSON.stringify(textoAlternativa);

      textoAlternativa = textoExtraido;
    }

    const letra = String.fromCharCode(65 + indexUsado);
    return `<strong>Alternativa ${letra}:</strong> ${textoAlternativa}`;
  }

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

  validacoesAvaliador = {};

  const respostasMap = {};
  Object.keys(respostas).forEach((key) => {
    const index = parseInt(key.replace("resposta-", ""), 10);
    if (!isNaN(index)) {
      respostasMap[index] = respostas[key];
    }
  });

  gabaritoPerguntas.forEach((pergunta, index) => {
    const respostaCandidatoRaw = respostasMap[index] || "Não respondida";

    const enunciado =
      pergunta.enunciado || pergunta.pergunta || "Enunciado não encontrado";
    const gabaritoTextoRaw =
      pergunta.respostaCorreta || pergunta.gabarito || "Gabarito não fornecido";
    const comentarios = pergunta.comentarios || pergunta.nota || "N/A";

    const respostaCandidato = obterTextoAlternativa(
      pergunta,
      respostaCandidatoRaw
    );
    const gabaritoTexto = obterTextoAlternativa(pergunta, gabaritoTextoRaw);

    const botoesValidacao = `
      <div class="mt-3 d-flex gap-2 align-items-center">
        <span class="me-2"><strong>Avaliação do Avaliador:</strong></span>
        <button class="btn btn-success btn-sm" onclick="window.marcarResposta(${index}, true)">
          <i class="fas fa-check me-1"></i> Correta
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.marcarResposta(${index}, false)">
          <i class="fas fa-times me-1"></i> Incorreta
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
              <label class="d-block mb-2"><strong>Resposta Correta / Gabarito: </strong></button>
        <span class="badge bg-secondary ms-2" id="status-questao-${index}">Não avaliada</span></label>
              <div class="p-3 border rounded border-primary bg-light">${gabaritoTexto}</div>
            </div>
          </div>
          
          <small class="text-muted d-block mt-2"><strong>Comentários (do Gabarito):</strong> ${comentarios}</small>
          
          ${botoesValidacao}
        </div>
      </div>
    `;
  });

  const tempoGastoDisplay = tempoGasto
    ? `${Math.floor(tempoGasto / 60)}m ${tempoGasto % 60}s`
    : "N/A";
  document.getElementById(
    "detalhes-teste-titulo"
  ).innerHTML = `<i class="fas fa-eye me-2"></i> Avaliação: ${nomeTeste} <small class="text-muted" style="font-size: 0.6em;"> (Tempo Gasto: ${tempoGastoDisplay})</small>`;

  container.innerHTML = html;

  document.getElementById("stats-total").textContent = totalPerguntas;
  document.getElementById("stats-acertos").textContent = "Aguardando";
  document.getElementById("stats-erros").textContent = "Aguardando";
  document.getElementById("stats-taxa").textContent = "Aguardando";
}

/**
 * 4. Função para carregar avaliações já existentes
 */
async function carregarAvaliacoesExistentes() {
  try {
    const testeRef = doc(
      db,
      `testesRealizados/${tokenIdGlobal}/candidatos/${candidatoIdGlobal}`
    );

    const testeDoc = await getDoc(testeRef);

    if (testeDoc.exists()) {
      const dados = testeDoc.data();
      const avaliacoesExistentes = dados.avaliacaoAvaliador || {};

      Object.keys(avaliacoesExistentes).forEach((key) => {
        const index = parseInt(key.replace("questao-", ""), 10);
        if (!isNaN(index)) {
          validacoesAvaliador[index] = avaliacoesExistentes[key];

          const card = document.getElementById(`card-questao-${index}`);
          const statusBadge = document.getElementById(
            `status-questao-${index}`
          );

          if (card && statusBadge) {
            card.classList.remove("border-success", "border-danger");

            if (avaliacoesExistentes[key]) {
              card.classList.add("border-success");
              card.style.borderLeft = "5px solid var(--color-success)";
              statusBadge.className = "badge bg-success ms-2";
              statusBadge.innerHTML =
                '<i class="fas fa-check me-1"></i> Correta';
            } else {
              card.classList.add("border-danger");
              card.style.borderLeft = "5px solid var(--color-error)";
              statusBadge.className = "badge bg-danger ms-2";
              statusBadge.innerHTML =
                '<i class="fas fa-times me-1"></i> Incorreta';
            }
          }
        }
      });

      calcularEstatisticas();

      console.log("✅ Avaliações anteriores carregadas com sucesso");
    }
  } catch (error) {
    console.error("⚠️ Erro ao carregar avaliações existentes:", error);
  }
}

/**
 * 5. Função para salvar avaliação no Firebase - CORRIGIDA
 */
async function salvarAvaliacaoNoFirebase() {
  try {
    const testeRef = doc(
      db,
      `testesRealizados/${tokenIdGlobal}/candidatos/${candidatoIdGlobal}`
    );

    // Preparar dados para salvar
    const avaliacaoParaSalvar = {};
    Object.keys(validacoesAvaliador).forEach((index) => {
      avaliacaoParaSalvar[`questao-${index}`] = validacoesAvaliador[index];
    });

    // Calcular estatísticas finais
    const totalAvaliadas = Object.keys(validacoesAvaliador).length;
    let acertos = 0;
    Object.values(validacoesAvaliador).forEach((isCorreta) => {
      if (isCorreta) acertos++;
    });
    const erros = totalAvaliadas - acertos;
    const taxa = totalAvaliadas > 0 ? (acertos / totalPerguntas) * 100 : 0;

    // ✅ USAR setDoc com merge: true em vez de updateDoc
    // Isso cria o documento se não existir, ou atualiza se já existir
    await setDoc(
      testeRef,
      {
        avaliacaoAvaliador: avaliacaoParaSalvar,
        estatisticasAvaliacao: {
          totalQuestoes: totalPerguntas,
          totalAvaliadas: totalAvaliadas,
          acertos: acertos,
          erros: erros,
          taxaAcerto: parseFloat(taxa.toFixed(2)),
        },
        ultimaAtualizacaoAvaliacao: Timestamp.now(),
      },
      { merge: true }
    ); // ← merge: true é essencial

    console.log("✅ Avaliação salva no Firebase com sucesso!");

    mostrarNotificacao("Avaliação salva com sucesso!", "success");
  } catch (error) {
    console.error("❌ Erro ao salvar avaliação no Firebase:", error);
    mostrarNotificacao("Erro ao salvar avaliação. Tente novamente.", "error");
  }
}

/**
 * 6. Função para marcar uma resposta como correta ou incorreta
 */
window.marcarResposta = function (index, isCorreta) {
  validacoesAvaliador[index] = isCorreta;

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

  calcularEstatisticas();
  salvarAvaliacaoNoFirebase();
};

/**
 * 7. Função para calcular e atualizar as estatísticas
 */
function calcularEstatisticas() {
  const totalAvaliadas = Object.keys(validacoesAvaliador).length;

  if (totalAvaliadas === 0) {
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

  if (totalAvaliadas === totalPerguntas) {
    document.getElementById("aviso-avaliacao").style.display = "none";
  } else {
    document.getElementById("aviso-avaliacao").innerHTML = `
      <i class="fas fa-info-circle me-2"></i>
      <strong>Progresso:</strong> ${totalAvaliadas} de ${totalPerguntas} questões avaliadas. Continue avaliando as respostas restantes.
    `;
  }
}

/**
 * 8. Função para mostrar notificação visual
 */
function mostrarNotificacao(mensagem, tipo = "success") {
  const notificacao = document.createElement("div");
  notificacao.className = `alert alert-${
    tipo === "success" ? "success" : "danger"
  } position-fixed`;
  notificacao.style.cssText =
    "top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);";
  notificacao.innerHTML = `
    <i class="fas fa-${
      tipo === "success" ? "check-circle" : "exclamation-circle"
    } me-2"></i>
    ${mensagem}
  `;

  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.style.transition = "opacity 0.3s";
    notificacao.style.opacity = "0";
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}

export { initdetalhesTeste as init };
