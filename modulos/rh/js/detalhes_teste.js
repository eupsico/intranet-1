/**
 * Arquivo: modulos/rh/js/detalhes_teste.js
 * Versão: 1.2.1 - CORRIGIDO: Nome da função de inicialização
 * Data: 18/11/2025
 * Descrição: View de comparação detalhada das respostas de um teste com o gabarito.
 * Agora permite ao avaliador marcar cada resposta como correta/incorreta antes de computar.
 */

import {
  db,
  functions,
  httpsCallable,
} from "../../../assets/js/firebase-init.js";

// Definição da função Cloud Function
const getDetalhesTeste = httpsCallable(functions, "getDetalhesTeste");

// Estado global para controle de avaliações
const avaliacoes = new Map(); // Map<questaoId, boolean> (true = correta, false = incorreta)

/**
 * 1. Função principal de inicialização da view
 * IMPORTANTE: O nome deve ser initdetalhes_teste (sem hífen, com underscore)
 */
export async function initdetalhes_teste() {
  console.log("🔹 Detalhes Teste: Inicializando view...");

  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.split("?")[1]);

  const tokenId = urlParams.get("token");
  const candidatoId = urlParams.get("candidato");

  if (!tokenId || !candidatoId) {
    console.error("❌ Parâmetros 'token' ou 'candidato' ausentes no hash.");
    document.getElementById("comparacao-respostas-container").innerHTML = `
      <div class="alert alert-danger">
        <strong>Erro:</strong> Parâmetros inválidos para exibir os detalhes.
      </div>
    `;
    return;
  }

  // Exibe informações do candidato e teste
  await exibirInfoHeader(tokenId, candidatoId);

  // Chama a Cloud Function para obter dados consolidados
  await carregarDetalhesTeste(tokenId, candidatoId);
}

/**
 * 2. Exibe informações do cabeçalho (Candidato, Teste, Status)
 */
async function exibirInfoHeader(tokenId, candidatoId) {
  try {
    const tokenSnap = await db.collection("TestesTokens").doc(tokenId).get();
    if (!tokenSnap.exists) {
      document.getElementById("cand-nome").textContent = "Token não encontrado";
      return;
    }

    const tokenData = tokenSnap.data();
    const testeId = tokenData.testeId;
    const respostaId = tokenData.respostaId;

    // Buscar nome do candidato
    const candSnap = await db.collection("Candidatos").doc(candidatoId).get();
    const candidatoNome = candSnap.exists
      ? candSnap.data().nome
      : "Desconhecido";

    // Buscar nome do teste
    const testeSnap = await db.collection("Testes").doc(testeId).get();
    const testeNome = testeSnap.exists ? testeSnap.data().nome : "Desconhecido";

    // Buscar status da resposta
    let statusTexto = "Não iniciado";
    let statusClass = "status-badge status-pendente";

    if (respostaId) {
      const respostaSnap = await db
        .collection("TestesRespostas")
        .doc(respostaId)
        .get();
      if (respostaSnap.exists) {
        const status = respostaSnap.data().status || "iniciado";
        if (status === "finalizado") {
          statusTexto = "Finalizado";
          statusClass = "status-badge status-sucesso";
        } else if (status === "iniciado") {
          statusTexto = "Em andamento";
          statusClass = "status-badge status-alerta";
        }
      }
    }

    document.getElementById("cand-nome").textContent = candidatoNome;
    document.getElementById("teste-nome").textContent = testeNome;
    const statusEl = document.getElementById("teste-status");
    statusEl.textContent = statusTexto;
    statusEl.className = statusClass;
  } catch (error) {
    console.error("❌ Erro ao exibir info do header:", error);
  }
}

/**
 * 3. Chama a Cloud Function e monta a comparação
 */
async function carregarDetalhesTeste(tokenId, candidatoId) {
  const container = document.getElementById("comparacao-respostas-container");

  container.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div class="loading-spinner"></div>
      <p>Carregando detalhes do teste...</p>
    </div>
  `;

  try {
    const result = await getDetalhesTeste({ tokenId, candidatoId });
    const dados = result.data;

    console.log("✅ Dados consolidados recebidos:", dados);

    if (!dados || !dados.questoes || dados.questoes.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <strong>Info:</strong> Nenhuma questão encontrada para este teste.
        </div>
      `;
      return;
    }

    // Limpar avaliações anteriores
    avaliacoes.clear();

    // Renderizar questões para avaliação
    renderizarQuestoes(dados.questoes, container);

    // Renderizar alerta de avaliação pendente
    renderizarAlertaAvaliacao();
  } catch (error) {
    console.error("❌ Erro ao chamar Cloud Function:", error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <strong>Erro:</strong> ${
          error.message || "Falha ao carregar dados do teste"
        }
      </div>
    `;
  }
}

/**
 * 4. Renderiza o alerta de avaliação pendente
 */
function renderizarAlertaAvaliacao() {
  const resumoContainer = document.getElementById("resumo-pontuacao-container");
  resumoContainer.innerHTML = `
    <div class="dashboard-section">
      <div class="alert alert-alerta" style="display: flex; align-items: center; gap: 10px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <strong>Avaliação Pendente:</strong> Analise cada resposta e marque como correta ou incorreta. 
          O resumo de pontuação será calculado automaticamente após todas as avaliações.
        </div>
      </div>
    </div>
  `;
}

/**
 * 5. Renderiza as questões com controles de avaliação
 */
function renderizarQuestoes(questoes, container) {
  let html = `
    <div class="dashboard-section">
      <div class="section-header">
        <h3>Comparação de Respostas</h3>
      </div>
  `;

  questoes.forEach((q, index) => {
    const questaoId = q.questaoId || index;
    const statusClass = avaliacoes.has(questaoId)
      ? avaliacoes.get(questaoId)
        ? "status-sucesso"
        : "status-erro"
      : "status-pendente";

    const statusTexto = avaliacoes.has(questaoId)
      ? avaliacoes.get(questaoId)
        ? "Correta"
        : "Incorreta"
      : "Aguardando Avaliação";

    html += `
      <div class="card-detalhes" style="margin-bottom: 20px;">
        <div class="flex-between" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid var(--cor-borda);">
          <strong style="color: var(--cor-primaria); font-size: 1.1rem;">Questão ${
            index + 1
          }</strong>
          <span class="status-badge ${statusClass}" id="status-${questaoId}">${statusTexto}</span>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="font-size: 1rem; line-height: 1.6; color: var(--cor-texto-principal);">
            <strong>Pergunta:</strong> ${q.pergunta || "Sem texto disponível"}
          </p>
        </div>

        <div style="display: grid; gap: 15px; margin-bottom: 15px;">
          <div style="padding: 15px; background-color: rgba(29, 112, 183, 0.1); border-left: 4px solid var(--cor-secundaria); border-radius: var(--borda-radius-pequeno);">
            <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--cor-texto-secundario);">Resposta do Candidato:</strong>
            <p style="margin: 0; font-size: 1rem;">${
              q.respostaCandidato || "Não respondida"
            }</p>
          </div>
          
          <div style="padding: 15px; background-color: rgba(40, 167, 69, 0.1); border-left: 4px solid var(--cor-sucesso); border-radius: var(--borda-radius-pequeno);">
            <strong style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--cor-texto-secundario);">Resposta Correta (Gabarito):</strong>
            <p style="margin: 0; font-size: 1rem;">${
              q.respostaGabarito || "Gabarito não definido"
            }</p>
          </div>
        </div>

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--cor-borda); display: flex; gap: 10px; align-items: center;">
          <label style="font-weight: 500; color: var(--cor-texto-principal); margin-right: 10px;">Avaliação:</label>
          <button class="btn btn-sm btn-sucesso" onclick="window.avaliarResposta('${questaoId}', true)">
            ✓ Correta
          </button>
          <button class="btn btn-sm btn-erro" onclick="window.avaliarResposta('${questaoId}', false)">
            ✗ Incorreta
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * 6. Função global para avaliar uma resposta
 */
window.avaliarResposta = function (questaoId, isCorreta) {
  avaliacoes.set(questaoId, isCorreta);

  // Atualizar badge de status
  const statusEl = document.getElementById(`status-${questaoId}`);
  if (statusEl) {
    statusEl.className = `status-badge ${
      isCorreta ? "status-sucesso" : "status-erro"
    }`;
    statusEl.textContent = isCorreta ? "Correta" : "Incorreta";
  }

  console.log(
    `✅ Questão ${questaoId} avaliada como: ${
      isCorreta ? "Correta" : "Incorreta"
    }`
  );

  // Verificar se todas as questões foram avaliadas
  verificarAvaliacaoCompleta();
};

/**
 * 7. Verifica se todas as questões foram avaliadas e calcula pontuação
 */
function verificarAvaliacaoCompleta() {
  const totalQuestoes = document.querySelectorAll(".card-detalhes").length;

  if (avaliacoes.size === totalQuestoes) {
    console.log("✅ Todas as questões avaliadas. Calculando pontuação...");
    calcularEExibirResumo(totalQuestoes);
  }
}

/**
 * 8. Calcula e exibe o resumo de pontuação
 */
function calcularEExibirResumo(totalQuestoes) {
  let acertos = 0;
  let erros = 0;

  avaliacoes.forEach((isCorreta) => {
    if (isCorreta) {
      acertos++;
    } else {
      erros++;
    }
  });

  const taxaAcerto =
    totalQuestoes > 0 ? ((acertos / totalQuestoes) * 100).toFixed(1) : 0;

  const resumoContainer = document.getElementById("resumo-pontuacao-container");
  resumoContainer.innerHTML = `
    <div class="dashboard-section">
      <div class="section-header">
        <h3>Resumo de Pontuação</h3>
      </div>
      
      <div class="details-grid cols-4">
        <div class="stat-card">
          <div class="stat-label">Total de Questões</div>
          <div class="stat-value" style="color: var(--cor-primaria);">${totalQuestoes}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Acertos</div>
          <div class="stat-value" style="color: var(--cor-sucesso);">${acertos}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Erros</div>
          <div class="stat-value" style="color: var(--cor-erro);">${erros}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Taxa de Acerto</div>
          <div class="stat-value" style="color: var(--cor-info);">${taxaAcerto}%</div>
        </div>
      </div>
    </div>
  `;

  console.log(
    `📊 Resumo calculado - Total: ${totalQuestoes}, Acertos: ${acertos}, Erros: ${erros}, Taxa: ${taxaAcerto}%`
  );
}
