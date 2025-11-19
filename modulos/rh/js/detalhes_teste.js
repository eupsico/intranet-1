/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.3.1 - Corrigido: Usando Timestamp.now() em vez de serverTimestamp.
 * Data: 18/11/2025
 * Descrição: View de comparação detalhada das respostas de um teste com o gabarito.
 * Agora utiliza a Cloud Function 'getDetalhesTeste' para consolidar os dados.
 */

import {
  db,
  functions,
  httpsCallable,
  doc,
  updateDoc,
  Timestamp,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// Definição da função Cloud Function (deve ser a que você implementou no index.js)
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

  // O roteador (rh-painel.js) usa window.location.hash
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.split("?")[1]);

  // Parâmetros passados pelo modal AvaliacaoTeste.js
  const tokenId = urlParams.get("token");
  const candidatoId = urlParams.get("candidato");

  // Armazena globalmente para usar no salvamento
  tokenIdGlobal = tokenId;
  candidatoIdGlobal = candidatoId;

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

    // 4. Carregar avaliações já existentes (se houver)
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
  // Ou podem ser objetos: [{texto: "...", valor: "..."}, ...]
  // O número pode ser 0-based ou 1-based, vamos tentar ambos
  const indexZeroBased = num;
  const indexOneBased = num - 1;

  let textoAlternativa = null;
  let indexUsado = -1;

  // Tenta index baseado em 0 (0, 1, 2, 3...)
  if (indexZeroBased >= 0 && indexZeroBased < alternativas.length) {
    textoAlternativa = alternativas[indexZeroBased];
    indexUsado = indexZeroBased;
  }
  // Tenta index baseado em 1 (1, 2, 3, 4...)
  else if (indexOneBased >= 0 && indexOneBased < alternativas.length) {
    textoAlternativa = alternativas[indexOneBased];
    indexUsado = indexOneBased;
  }

  if (textoAlternativa) {
    // Se for um objeto, extrair o texto
    if (typeof textoAlternativa === "object" && textoAlternativa !== null) {
      // Tenta diferentes chaves possíveis para o texto
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

    // Retorna formatado: "Alternativa B: Texto da alternativa"
    const letra = String.fromCharCode(65 + indexUsado); // A, B, C, D...
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

  // Resetar validações (serão recarregadas se existirem)
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

      // Restaurar avaliações
      Object.keys(avaliacoesExistentes).forEach((key) => {
        const index = parseInt(key.replace("questao-", ""), 10);
        if (!isNaN(index)) {
          validacoesAvaliador[index] = avaliacoesExistentes[key];

          // Atualizar visual
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

      // Recalcular estatísticas
      calcularEstatisticas();

      console.log("✅ Avaliações anteriores carregadas com sucesso");
    }
  } catch (error) {
    console.error("⚠️ Erro ao carregar avaliações existentes:", error);
    // Não bloqueia a execução, apenas não carrega as avaliações anteriores
  }
}

/**
 * 5. Função para salvar avaliação no Firebase
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

    // Atualizar documento no Firebase
    await updateDoc(testeRef, {
      avaliacaoAvaliador: avaliacaoParaSalvar,
      estatisticasAvaliacao: {
        totalQuestoes: totalPerguntas,
        totalAvaliadas: totalAvaliadas,
        acertos: acertos,
        erros: erros,
        taxaAcerto: parseFloat(taxa.toFixed(2)),
      },
      ultimaAtualizacaoAvaliacao: Timestamp.now(),
    });

    console.log("✅ Avaliação salva no Firebase com sucesso!");

    // Mostrar feedback visual
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

  // Salvar automaticamente no Firebase
  salvarAvaliacaoNoFirebase();
};

/**
 * 7. Função para calcular e atualizar as estatísticas
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

  // Remove após 3 segundos
  setTimeout(() => {
    notificacao.style.transition = "opacity 0.3s";
    notificacao.style.opacity = "0";
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}

// Expõe a função de inicialização
export { initdetalhesTeste as init };
