/**
 * Arquivo: assets/js/avaliacao-publica.js
 * Versão: 2.0.0 (Com Cloud Functions Integradas)
 * Data: 05/11/2025
 * Descrição: Valida tokens e carrega testes usando Cloud Functions
 */

// ============================================
// CLOUD FUNCTIONS URLS
// ============================================
const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_VALIDAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/validarTokenTeste`;
const CF_SALVAR_RESPOSTAS = `${CLOUD_FUNCTIONS_BASE}/salvarRespostasTeste`;

// ============================================
// INICIALIZAÇÃO FIREBASE
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyBXy_4yVPqyiuVJLv3kT-wXGaajgC3UJ10",
  authDomain: "eupsico-desenvolvimento.firebaseapp.com",
  projectId: "eupsico-desenvolvimento",
  storageBucket: "eupsico-desenvolvimento.appspot.com",
  messagingSenderId: "1065838851206",
  appId: "1:1065838851206:web:32b7a40d7f066d0d7c4c86",
};

// ✅ Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let tokenData = null;
let testeData = null;
let tokenAtual = null;
let tempoInicioResposta = null;

// ============================================
// LÓGICA PRINCIPAL
// ============================================

async function carregarTeste() {
  try {
    console.log("🔹 Iniciando carregamento do teste...");

    // ✅ 1️⃣ PEGA O TOKEN DA URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const testeIdAntigo = params.get("id"); // Para backward compatibility

    console.log(
      "🔹 Token na URL:",
      token ? token.substring(0, 10) + "..." : "não fornecido"
    );

    if (!token && !testeIdAntigo) {
      mostrarErro(
        "❌ Erro: Nenhum token ou ID foi fornecido na URL. Por favor, abra o link completo enviado por email."
      );
      return;
    }

    // ✅ 2️⃣ VALIDA O TOKEN USANDO CLOUD FUNCTION
    if (token) {
      console.log("🔹 Validando token via Cloud Function...");

      const responseValidar = await fetch(CF_VALIDAR_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token }),
      });

      const dataValidacao = await responseValidar.json();

      if (!dataValidacao.sucesso) {
        mostrarErro(`❌ ${dataValidacao.erro || "Erro ao validar token"}`);
        console.error("Erro na validação:", dataValidacao);
        return;
      }

      console.log("✅ Token validado com sucesso!");
      tokenData = dataValidacao;
      tokenAtual = token;
      testeData = dataValidacao.teste;
    } else {
      // FALLBACK: Se não houver token, tenta carregar direto pelo ID
      console.log("⚠️ Usando ID ao invés de TOKEN (modo compatibilidade)");

      const testeSnap = await db
        .collection("estudos_de_caso")
        .doc(testeIdAntigo)
        .get();

      if (!testeSnap.exists) {
        mostrarErro("❌ Teste não encontrado.");
        return;
      }

      testeData = {
        id: testeIdAntigo,
        ...testeSnap.data(),
      };
    }

    // ✅ 3️⃣ RENDERIZA O TESTE
    renderizarTeste(testeData);

    // ✅ 4️⃣ MARCA O TEMPO DE INÍCIO
    tempoInicioResposta = new Date();
    console.log("✅ Teste carregado e renderizado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao carregar teste:", error);
    mostrarErro(`❌ Erro ao carregar o teste: ${error.message}`);
  }
}

function renderizarTeste(teste) {
  console.log("🔹 Renderizando teste...", teste);

  // ✅ Preenche as informações do teste
  document.getElementById("titulo-teste").innerHTML = `
    <strong>${teste.titulo || "Teste"}</strong><br>
    <small>${teste.tipo ? teste.tipo.replace(/-/g, " ") : "Avaliação"}</small>
  `;
  document.getElementById("texto-teste").textContent =
    teste.conteudo || teste.conteudo_texto || "Leia as instruções abaixo.";

  // ✅ NOVO: Exibe informações do candidato (se houver token)
  if (tokenData && tokenData.candidato) {
    document.getElementById("info-candidato-nome").textContent =
      tokenData.candidato.nome || "Candidato(a)";

    const diasRestantes = tokenData.diasRestantes || 7;
    const expiraEm = tokenData.expiraEm
      ? new Date(tokenData.expiraEm).toLocaleDateString("pt-BR")
      : "-";

    document.getElementById(
      "info-candidato-prazo"
    ).textContent = `${diasRestantes} dias (vence em ${expiraEm})`;
  } else {
    document.getElementById("info-candidato-nome").textContent = "Candidato(a)";
    document.getElementById("info-candidato-prazo").textContent = "-";
  }

  // ✅ Renderiza as perguntas
  const perguntasContainer = document.getElementById("perguntas-container");
  perguntasContainer.innerHTML = "";

  const perguntas = teste.perguntas || [];

  if (perguntas.length === 0) {
    perguntasContainer.innerHTML =
      '<p class="alert alert-warning">Este teste não possui perguntas.</p>';
  } else {
    perguntas.forEach((pergunta, index) => {
      let perguntaHtml = "";

      // ✅ RENDERIZA DIFERENTES TIPOS DE PERGUNTAS
      if (pergunta.tipo === "multipla-escolha") {
        perguntaHtml = `
          <div class="pergunta-item">
            <label class="form-label">
              <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
              <span class="tipo-pergunta-badge">Múltipla Escolha</span>
            </label>
            <div class="mt-3">
        `;

        if (pergunta.opcoes && pergunta.opcoes.length > 0) {
          pergunta.opcoes.forEach((opcao, opcaoIdx) => {
            const opcaoTexto =
              typeof opcao === "string" ? opcao : opcao.texto || opcao;
            perguntaHtml += `
              <div class="form-check">
                <input class="form-check-input" type="radio" name="resposta-${index}" id="opcao-${index}-${opcaoIdx}" value="${opcaoTexto}" required>
                <label class="form-check-label" for="opcao-${index}-${opcaoIdx}">
                  ${opcaoTexto}
                </label>
              </div>
            `;
          });
        }

        perguntaHtml += `</div></div>`;
      } else if (pergunta.tipo === "verdadeiro-falso") {
        perguntaHtml = `
          <div class="pergunta-item">
            <label class="form-label">
              <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
              <span class="tipo-pergunta-badge">Verdadeiro/Falso</span>
            </label>
            <div class="mt-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" name="resposta-${index}" id="verdadeiro-${index}" value="Verdadeiro" required>
                <label class="form-check-label" for="verdadeiro-${index}">
                  ✅ Verdadeiro
                </label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="resposta-${index}" id="falso-${index}" value="Falso" required>
                <label class="form-check-label" for="falso-${index}">
                  ❌ Falso
                </label>
              </div>
            </div>
          </div>
        `;
      } else {
        // Dissertativa (padrão)
        perguntaHtml = `
          <div class="pergunta-item">
            <label class="form-label">
              <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
              <span class="tipo-pergunta-badge">Dissertativa</span>
            </label>
            <textarea 
              class="form-control mt-2" 
              name="resposta-${index}"
              placeholder="Digite sua resposta aqui..."
              required
            ></textarea>
          </div>
        `;
      }

      perguntasContainer.innerHTML += perguntaHtml;
    });
  }

  // Mostra o conteúdo
  document.getElementById("carregamento").style.display = "none";
  document.getElementById("conteudo-teste").style.display = "block";

  console.log("✅ Teste renderizado com sucesso");
}

function mostrarErro(mensagem) {
  document.getElementById("carregamento").style.display = "none";
  document.getElementById("erro-teste").innerHTML = mensagem;
  document.getElementById("erro-teste").style.display = "block";
}

function mostrarSucesso(mensagem) {
  document.getElementById("conteudo-teste").style.display = "none";
  document.getElementById("sucesso-teste").innerHTML = mensagem;
  document.getElementById("sucesso-teste").style.display = "block";
}

// ============================================
// LISTENER DO FORMULÁRIO
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  const formResposta = document.getElementById("form-resposta");

  if (formResposta) {
    formResposta.addEventListener("submit", async function (e) {
      e.preventDefault();

      console.log("🔹 Enviando respostas...");

      const formData = new FormData(e.target);
      const respostas = {};

      for (let [key, value] of formData.entries()) {
        respostas[key] = value;
      }

      console.log("✅ Respostas coletadas:", respostas);

      // ✅ CALCULA TEMPO GASTO
      const tempoFim = new Date();
      const tempoGastoSegundos = Math.floor(
        (tempoFim - tempoInicioResposta) / 1000
      );
      const tempoFormatado = `${Math.floor(tempoGastoSegundos / 60)}min ${
        tempoGastoSegundos % 60
      }s`;

      console.log(`⏱️ Tempo gasto: ${tempoFormatado}`);

      // ✅ ENVIA PARA CLOUD FUNCTION
      if (tokenAtual) {
        try {
          console.log("🔹 Chamando Cloud Function: salvarRespostasTeste");

          const responseSalvar = await fetch(CF_SALVAR_RESPOSTAS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: tokenAtual,
              respostas: respostas,
              tempoGasto: tempoGastoSegundos,
              navegador: navigator.userAgent,
              ipAddress: await obterIPAddress(),
            }),
          });

          const dataSalvar = await responseSalvar.json();

          if (!dataSalvar.sucesso) {
            mostrarErro(`❌ Erro ao salvar respostas: ${dataSalvar.erro}`);
            console.error("Erro ao salvar:", dataSalvar);
            return;
          }

          console.log("✅ Respostas salvas com sucesso!");

          mostrarSucesso(`
            <h4>✅ Respostas Enviadas com Sucesso!</h4>
            <p><strong>Tempo gasto:</strong> ${tempoFormatado}</p>
            <p>Obrigado por participar da avaliação. Entraremos em contato em breve com o resultado.</p>
            <p><small>Referência: ${dataSalvar.tokenId}</small></p>
          `);
        } catch (error) {
          console.error("❌ Erro ao enviar respostas:", error);
          mostrarErro(`❌ Erro ao enviar respostas: ${error.message}`);
        }
      } else {
        mostrarSucesso(`
          <h4>✅ Respostas Enviadas com Sucesso!</h4>
          <p><strong>Tempo gasto:</strong> ${tempoFormatado}</p>
          <p>Obrigado por participar da avaliação.</p>
        `);
      }
    });
  }

  // Carrega o teste ao abrir a página
  carregarTeste();
});

// ============================================
// HELPER: Obter IP Address (opcional)
// ============================================

async function obterIPAddress() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn("Não foi possível obter IP:", error);
    return "não disponível";
  }
}
