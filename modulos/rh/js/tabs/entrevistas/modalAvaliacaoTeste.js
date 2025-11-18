/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoTeste.js
 * Versão: 1.7.0 - DEBUG PROFUNDO - Logs detalhados em todas etapas
 * Descrição: Gerencia o modal de avaliação de teste com gestor.
 */

import {
  db,
  collection,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  getDocs,
  query,
  where,
} from "../../../../../assets/js/firebase-init.js";

import { getCurrentUserName, formatarDataEnvio } from "./helpers.js";

let dadosCandidatoAtual = null;

/* ==================== FUNÇÕES DE UTILIDADE ==================== */

/**
 * Fecha o modal de avaliação de teste
 */
function fecharModalAvaliacaoTeste() {
  console.log("🚪 [MODAL] Iniciando fechamento do modal");
  const modalOverlay = document.getElementById("modal-avaliacao-teste");

  if (modalOverlay) {
    console.log(
      "✅ [MODAL] Elemento modal encontrado, removendo classe is-visible"
    );
    modalOverlay.classList.remove("is-visible");
    console.log("✅ [MODAL] Modal fechado com sucesso");
  } else {
    console.error(
      "❌ [MODAL] Elemento modal-avaliacao-teste NÃO encontrado no DOM!"
    );
  }

  // Reseta o formulário ao fechar para evitar estados inconsistentes na reabertura
  const form = document.getElementById("form-avaliacao-teste");
  if (form) {
    console.log("🔄 [MODAL] Resetando formulário");
    form.reset();
  }
}

/**
 * Gerencia a exibição do seletor de gestor e obrigatoriedade da reprovação
 */
function toggleCamposAvaliacaoTeste() {
  console.log("🔄 [FORM] Toggle campos de avaliação");
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  // Verifica qual radio está checado
  const resultadoSelecionado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;

  console.log("📋 [FORM] Resultado selecionado:", resultadoSelecionado);

  const containerGestor = document.getElementById(
    "avaliacao-teste-gestor-container"
  );
  const labelObservacoes = form.querySelector(
    'label[for="avaliacao-teste-observacoes"]'
  );
  const textareaObservacoes = document.getElementById(
    "avaliacao-teste-observacoes"
  );

  // 1. Lógica APROVADO
  if (resultadoSelecionado === "Aprovado") {
    console.log("✅ [FORM] Modo: APROVADO - Mostrando seletor de gestor");
    if (containerGestor) containerGestor.classList.remove("hidden");
    // Observações voltam a ser opcionais
    if (textareaObservacoes) textareaObservacoes.required = false;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-comment-alt me-2"></i>Observações (opcional)';
  }
  // 2. Lógica REPROVADO
  else if (resultadoSelecionado === "Reprovado") {
    console.log(
      "❌ [FORM] Modo: REPROVADO - Ocultando gestor, tornando observações obrigatórias"
    );
    if (containerGestor) containerGestor.classList.add("hidden");
    // Observações viram "Motivo de Reprovação (Obrigatório)"
    if (textareaObservacoes) textareaObservacoes.required = true;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-exclamation-triangle me-2"></i><strong>Motivo da Reprovação (Obrigatório)</strong>';
  }
  // 3. Nenhum selecionado (Estado inicial)
  else {
    console.log("⚪ [FORM] Modo: NENHUM selecionado");
    if (containerGestor) containerGestor.classList.add("hidden");
    if (textareaObservacoes) textareaObservacoes.required = false;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-comment-alt me-2"></i>Observações (opcional)';
  }
}

/**
 * Carrega lista de gestores da coleção 'usuarios'
 */
async function carregarGestores() {
  console.log("👥 [GESTORES] Iniciando carregamento de gestores...");
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("funcoes", "array-contains", "gestor"));

    console.log("🔍 [GESTORES] Executando query no Firestore...");
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn(
        "⚠️ [GESTORES] Nenhum gestor encontrado na coleção usuarios"
      );
      return [];
    }

    const gestores = [];
    snapshot.forEach((docSnap) => {
      const gestor = docSnap.data();
      gestores.push({
        id: docSnap.id,
        nome: gestor.nome || `${gestor.email} (Gestor)`,
        email: gestor.email,
        telefone: gestor.telefone || gestor.celular,
        ...gestor,
      });
    });

    console.log(
      `✅ [GESTORES] ${gestores.length} gestores carregados:`,
      gestores.map((g) => g.nome)
    );
    return gestores;
  } catch (error) {
    console.error("❌ [GESTORES] Erro ao carregar gestores:", error);
    return [];
  }
}

/**
 * Envia mensagem de WhatsApp para o gestor selecionado
 */
window.enviarWhatsAppGestor = function () {
  console.log("📱 [WHATSAPP] Iniciando envio de WhatsApp para gestor");
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const option = selectGestor?.selectedOptions[0];

  if (!option || !option.value) {
    console.warn("⚠️ [WHATSAPP] Nenhum gestor selecionado");
    window.showToast?.("Selecione um gestor primeiro", "error");
    return;
  }

  const nomeGestor = option.getAttribute("data-nome");
  const telefoneGestor = option.getAttribute("data-telefone");

  console.log("📋 [WHATSAPP] Gestor selecionado:", {
    nomeGestor,
    telefoneGestor,
  });

  if (!telefoneGestor) {
    console.warn("⚠️ [WHATSAPP] Gestor não possui telefone");
    window.showToast?.("Gestor não possui telefone cadastrado", "error");
    return;
  }

  const nomeCandidato = dadosCandidatoAtual.nomecandidato || "Candidato(a)";
  const telefoneCandidato =
    dadosCandidatoAtual.telefonecontato || "Não informado";
  const emailCandidato = dadosCandidatoAtual.emailcandidato || "Não informado";
  const statusCandidato =
    dadosCandidatoAtual.statusrecrutamento || "Em avaliação";
  const vagaInfo =
    dadosCandidatoAtual.titulo_vaga_original || "Vaga não especificada";

  const mensagem = `Olá ${nomeGestor}!

Você foi designado(a) para avaliar um candidato que passou na fase de testes.

📋 *Candidato:* ${nomeCandidato}
📞 *Telefone:* ${telefoneCandidato}
✉️ *E-mail:* ${emailCandidato}
💼 *Vaga:* ${vagaInfo}
📊 *Status Atual:* ${statusCandidato}

O candidato foi aprovado nos testes e aguarda sua avaliação para prosseguir no processo seletivo.

*Próximos Passos:*
1. Acesse o sistema de recrutamento
2. Revise o perfil e desempenho do candidato
3. Agende uma entrevista se necessário
4. Registre sua decisão final

🔗 *Acesse o sistema:* https://intranet.eupsico.org.br

Se tiver dúvidas, entre em contato com o RH.

Equipe de Recrutamento - EuPsico`.trim();

  const telefoneLimpo = telefoneGestor.replace(/\D/g, "");
  const mensagemCodificada = encodeURIComponent(mensagem);
  const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

  console.log("✅ [WHATSAPP] Abrindo WhatsApp com link gerado");
  window.open(linkWhatsApp, "_blank");
  window.showToast?.("WhatsApp aberto para notificar gestor", "success");
};

/**
 * Carrega as respostas de um teste específico para o modal de avaliação
 */
async function carregarRespostasDoTeste(
  identificador,
  tipoId,
  testeIdFallback,
  candidatoId
) {
  console.log("\n🔍 ========== CARREGANDO RESPOSTAS DO TESTE ==========");
  console.log("📋 [RESPOSTAS] Parâmetros recebidos:", {
    identificador,
    tipoId,
    testeIdFallback,
    candidatoId,
  });

  const container = document.getElementById(
    `respostas-container-${identificador}`
  );

  if (!container) {
    console.error(
      "❌ [RESPOSTAS] Container não encontrado:",
      `respostas-container-${identificador}`
    );
    return;
  }

  console.log("✅ [RESPOSTAS] Container encontrado");

  try {
    const respostasRef = collection(db, "testesrespondidos");
    let q;

    if (tipoId === "tokenId") {
      console.log("🔑 [RESPOSTAS] Buscando por tokenId:", identificador);
      q = query(respostasRef, where("tokenId", "==", identificador));
    } else {
      console.log("🔑 [RESPOSTAS] Buscando por testeId + candidatoId");
      console.log("   - testeId:", testeIdFallback);
      console.log("   - candidatoId:", candidatoId);

      q = query(
        respostasRef,
        where("testeId", "==", testeIdFallback),
        where("candidatoId", "==", candidatoId)
      );
    }

    console.log("⏳ [RESPOSTAS] Executando query no Firestore...");
    let snapshot = await getDocs(q);
    console.log(
      "📊 [RESPOSTAS] Resultados da query:",
      snapshot.docs.length,
      "documentos"
    );

    // Se não encontrar com testeId + candidatoId, tenta apenas por candidatoId
    if (snapshot.empty && tipoId !== "tokenId") {
      console.log(
        "⚠️ [RESPOSTAS] Nenhum resultado. Tentando apenas por candidatoId..."
      );
      q = query(respostasRef, where("candidatoId", "==", candidatoId));
      snapshot = await getDocs(q);
      console.log(
        "📊 [RESPOSTAS] Resultados da segunda tentativa:",
        snapshot.docs.length,
        "documentos"
      );

      // Se encontrou múltiplos, filtra pelo testeId
      if (!snapshot.empty && snapshot.docs.length > 1) {
        console.log(
          "🔍 [RESPOSTAS] Múltiplos resultados, filtrando por testeId..."
        );
        const docs = snapshot.docs.filter(
          (doc) => doc.data().testeId === testeIdFallback
        );
        console.log("📊 [RESPOSTAS] Após filtro:", docs.length, "documentos");
        if (docs.length > 0) {
          snapshot = { docs, empty: false };
        }
      }
    }

    if (snapshot.empty) {
      console.warn("❌ [RESPOSTAS] Nenhuma resposta encontrada");
      container.innerHTML = `<div class="alert alert-warning">
        <i class="fas fa-info-circle me-2"></i>
        Respostas não encontradas para este teste.
      </div>`;
      return;
    }

    console.log("✅ [RESPOSTAS] Respostas encontradas! Processando dados...");
    const data = snapshot.docs[0].data();
    console.log("📋 [RESPOSTAS] Dados do teste:", {
      nomeTeste: data.nomeTeste,
      dataResposta: data.dataResposta,
      tempoGasto: data.tempoGasto,
      quantidadeRespostas: data.respostas?.length || 0,
    });

    let respostasHtml = `<div class="respostas-teste">`;

    // Informações gerais do teste
    respostasHtml += `<div class="info-teste mb-3">
      <p><strong>Nome do Teste:</strong> ${data.nomeTeste || "N/A"}</p>
      <p><strong>Data de Resposta:</strong> ${
        data.dataResposta
          ? new Date(data.dataResposta.seconds * 1000).toLocaleString("pt-BR")
          : "N/A"
      }</p>
      ${
        data.tempoGasto
          ? `<p><strong>Tempo Gasto:</strong> ${Math.floor(
              data.tempoGasto / 60
            )}m ${data.tempoGasto % 60}s</p>`
          : ""
      }
    </div>`;

    // Renderiza as respostas
    if (data.respostas && Array.isArray(data.respostas)) {
      console.log(
        "📝 [RESPOSTAS] Renderizando",
        data.respostas.length,
        "respostas"
      );
      respostasHtml += `<h6 class="mb-3">Respostas do Candidato:</h6>`;
      data.respostas.forEach((resp, idx) => {
        respostasHtml += `<div class="resposta-item mb-3 p-3 border rounded">
          <p><strong>Questão ${idx + 1}:</strong> ${resp.pergunta || "N/A"}</p>
          <p><strong>Resposta:</strong> ${resp.resposta || "Não respondida"}</p>
        </div>`;
      });
    } else {
      console.warn(
        "⚠️ [RESPOSTAS] Nenhuma resposta detalhada disponível no documento"
      );
      respostasHtml += `<p class="text-muted">Nenhuma resposta detalhada disponível.</p>`;
    }

    respostasHtml += `</div>`;
    container.innerHTML = respostasHtml;
    console.log("✅ [RESPOSTAS] Renderização concluída com sucesso");
  } catch (error) {
    console.error("❌ [RESPOSTAS] Erro ao carregar respostas:", error);
    console.error("Stack trace:", error.stack);
    container.innerHTML = `<div class="alert alert-error">
      <i class="fas fa-exclamation-circle me-2"></i>
      Erro ao carregar respostas. Detalhes: ${error.message}
    </div>`;
  }

  console.log("========== FIM CARREGANDO RESPOSTAS ==========\n");
}

/* ==================== FUNÇÃO PRINCIPAL (Exportada) ==================== */

/**
 * Abre o modal de avaliação do teste
 * VERSÃO DEBUG v1.7.0 - Logs profundos em todas etapas
 */
export async function abrirModalAvaliacaoTeste(candidatoId, dadosCandidato) {
  console.log("\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║       🚀 ABRINDO MODAL AVALIAÇÃO TESTE (MÓDULO)              ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝"
  );
  console.log("📋 [MAIN] candidatoId:", candidatoId);
  console.log("📋 [MAIN] dadosCandidato:", dadosCandidato);
  console.log("");

  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const form = document.getElementById("form-avaliacao-teste");

  console.log("🔍 [MAIN] Verificando elementos do DOM...");
  console.log("   - modal-avaliacao-teste:", !!modalAvaliacaoTeste);
  console.log("   - form-avaliacao-teste:", !!form);

  if (!modalAvaliacaoTeste || !form) {
    console.error(
      "❌ [MAIN] ERRO CRÍTICO: Elementos principais do modal não encontrados!"
    );
    console.error(
      "   - Verifique se o HTML contém os elementos com os IDs corretos"
    );
    return;
  }

  console.log("✅ [MAIN] Elementos principais encontrados");

  dadosCandidatoAtual = dadosCandidato || { id: candidatoId };
  modalAvaliacaoTeste.dataset.candidaturaId = candidatoId;

  console.log(
    "💾 [MAIN] Dados armazenados em dadosCandidatoAtual e dataset.candidaturaId"
  );

  // ========== BOTÕES DE FECHAR ==========
  console.log("\n🔘 ========== CONFIGURANDO BOTÕES DE FECHAR ==========");

  // Log da estrutura HTML do modal
  console.log("🔍 [BOTÕES] Estrutura HTML do modal:");
  console.log(modalAvaliacaoTeste.innerHTML.substring(0, 500) + "...");

  // Tenta múltiplos seletores para o botão X
  console.log("\n🔍 [BOTÕES] Procurando botão X...");
  const btnCloseX1 = modalAvaliacaoTeste.querySelector(".close-modal-btn");
  const btnCloseX2 = modalAvaliacaoTeste.querySelector(".modal-close");
  const btnCloseX3 = modalAvaliacaoTeste.querySelector("[data-action='close']");
  const btnCloseX4 = modalAvaliacaoTeste.querySelector("button.close");
  const btnCloseX5 = modalAvaliacaoTeste.querySelector(".btn-close");

  console.log("   - .close-modal-btn:", !!btnCloseX1);
  console.log("   - .modal-close:", !!btnCloseX2);
  console.log("   - [data-action='close']:", !!btnCloseX3);
  console.log("   - button.close:", !!btnCloseX4);
  console.log("   - .btn-close:", !!btnCloseX5);

  const btnCloseX =
    btnCloseX1 || btnCloseX2 || btnCloseX3 || btnCloseX4 || btnCloseX5;

  // Tenta múltiplos seletores para o botão Cancelar
  console.log("\n🔍 [BOTÕES] Procurando botão Cancelar...");
  const btnCancelar1 = modalAvaliacaoTeste.querySelector(
    ".modal-footer .action-button.secondary"
  );
  const btnCancelar2 = modalAvaliacaoTeste.querySelector(
    "button[type='button'].secondary"
  );
  const btnCancelar3 = modalAvaliacaoTeste.querySelector(".btn-cancelar");
  const btnCancelar4 = modalAvaliacaoTeste.querySelector(
    "button[data-action='cancel']"
  );
  const btnCancelar5 = modalAvaliacaoTeste.querySelector(
    ".modal-footer button:not([type='submit'])"
  );

  console.log("   - .modal-footer .action-button.secondary:", !!btnCancelar1);
  console.log("   - button[type='button'].secondary:", !!btnCancelar2);
  console.log("   - .btn-cancelar:", !!btnCancelar3);
  console.log("   - button[data-action='cancel']:", !!btnCancelar4);
  console.log(
    "   - .modal-footer button:not([type='submit']):",
    !!btnCancelar5
  );

  const btnCancelar =
    btnCancelar1 ||
    btnCancelar2 ||
    btnCancelar3 ||
    btnCancelar4 ||
    btnCancelar5;

  console.log("\n📊 [BOTÕES] RESULTADO:");
  console.log("   - btnCloseX encontrado:", !!btnCloseX);
  console.log("   - btnCancelar encontrado:", !!btnCancelar);

  if (btnCloseX) {
    console.log("✅ [BOTÕES] Configurando evento no botão X");
    console.log("   - Classe CSS:", btnCloseX.className);
    console.log("   - HTML:", btnCloseX.outerHTML.substring(0, 200));

    // Remove listener antigo clonando
    const newBtnCloseX = btnCloseX.cloneNode(true);
    btnCloseX.parentNode.replaceChild(newBtnCloseX, btnCloseX);

    newBtnCloseX.addEventListener("click", (e) => {
      console.log("🖱️ [BOTÕES] ✅ BOTÃO X CLICADO!");
      e.preventDefault();
      e.stopPropagation();
      fecharModalAvaliacaoTeste();
    });

    console.log("✅ [BOTÕES] Event listener anexado ao botão X");
  } else {
    console.error("❌ [BOTÕES] BOTÃO X NÃO ENCONTRADO!");
    console.error("   - Verifique o HTML do modal e as classes CSS");
  }

  if (btnCancelar) {
    console.log("✅ [BOTÕES] Configurando evento no botão Cancelar");
    console.log("   - Classe CSS:", btnCancelar.className);
    console.log("   - HTML:", btnCancelar.outerHTML.substring(0, 200));

    // Remove listener antigo clonando
    const newBtnCancelar = btnCancelar.cloneNode(true);
    btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

    newBtnCancelar.addEventListener("click", (e) => {
      console.log("🖱️ [BOTÕES] ✅ BOTÃO CANCELAR CLICADO!");
      e.preventDefault();
      e.stopPropagation();
      fecharModalAvaliacaoTeste();
    });

    console.log("✅ [BOTÕES] Event listener anexado ao botão Cancelar");
  } else {
    console.error("❌ [BOTÕES] BOTÃO CANCELAR NÃO ENCONTRADO!");
    console.error("   - Verifique o HTML do modal e as classes CSS");
  }

  console.log("========== FIM CONFIGURAÇÃO BOTÕES ==========\n");

  // ========== POPULA INFORMAÇÕES DO CANDIDATO ==========
  console.log("👤 ========== POPULANDO INFORMAÇÕES DO CANDIDATO ==========");

  const nomeEl = document.getElementById("avaliacao-teste-nome-candidato");
  const statusEl = document.getElementById("avaliacao-teste-status-atual");

  console.log("🔍 [CANDIDATO] Elementos encontrados:");
  console.log("   - avaliacao-teste-nome-candidato:", !!nomeEl);
  console.log("   - avaliacao-teste-status-atual:", !!statusEl);

  if (nomeEl) {
    const nome = dadosCandidato.nomecandidato || "Candidato(a)";
    nomeEl.textContent = nome;
    console.log("✅ [CANDIDATO] Nome definido:", nome);
  }

  if (statusEl) {
    const status = dadosCandidato.statusrecrutamento || "N/A";
    statusEl.textContent = status;
    console.log("✅ [CANDIDATO] Status definido:", status);
  }

  console.log("========== FIM INFORMAÇÕES CANDIDATO ==========\n");

  // ========== BUSCA E RENDERIZA TESTES ==========
  console.log("🧪 ========== BUSCANDO E RENDERIZANDO TESTES ==========");

  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");
  console.log(
    "🔍 [TESTES] Elemento avaliacao-teste-info-testes encontrado:",
    !!infoTestesEl
  );

  let listaDeTestes = dadosCandidato.testesenviados || [];
  console.log(
    "📋 [TESTES] Array testesenviados do candidato:",
    listaDeTestes.length,
    "testes"
  );

  if (listaDeTestes.length > 0) {
    console.log("📝 [TESTES] Detalhes dos testes no array:");
    listaDeTestes.forEach((teste, idx) => {
      console.log(
        `   ${idx + 1}. ${teste.nomeTeste || "Sem nome"} - Status: ${
          teste.status || "N/A"
        }`
      );
    });
  }

  // FALLBACK: Se o array do candidato estiver vazio, busca na coleção testesrespondidos
  if (listaDeTestes.length === 0) {
    console.log(
      "⚠️ [TESTES] Array vazio. Iniciando busca fallback em testesrespondidos..."
    );

    if (infoTestesEl) {
      infoTestesEl.innerHTML = '<div class="loading-spinner"></div>';
      console.log("⏳ [TESTES] Spinner de loading exibido");
    }

    try {
      const respostasRef = collection(db, "testesrespondidos");

      console.log("🔍 [TESTES] Criando query:");
      console.log("   - Coleção: testesrespondidos");
      console.log("   - Campo: candidatoId");
      console.log("   - Valor:", candidatoId);

      const qRespostas = query(
        respostasRef,
        where("candidatoId", "==", candidatoId)
      );

      console.log("⏳ [TESTES] Executando query no Firestore...");
      const snapshotRespostas = await getDocs(qRespostas);

      console.log(
        "📊 [TESTES] Query executada. Resultados:",
        snapshotRespostas.docs.length,
        "documentos"
      );

      if (!snapshotRespostas.empty) {
        console.log("✅ [TESTES] Testes encontrados! Processando dados...");

        // Reconstrói a lista baseada no que achou na coleção
        listaDeTestes = snapshotRespostas.docs.map((doc, idx) => {
          const data = doc.data();
          console.log(`   📄 Documento ${idx + 1}:`, {
            id: doc.id,
            testeId: data.testeId,
            nomeTeste: data.nomeTeste,
            status: "respondido",
            tempoGasto: data.tempoGasto,
          });

          return {
            id: data.testeId,
            nomeTeste: data.nomeTeste,
            dataenvio: data.dataenvio,
            status: "respondido",
            tokenId: doc.id,
            tempoGasto: data.tempoGasto,
            respostasCompletas: data,
          };
        });

        dadosCandidatoAtual.testesenviados = listaDeTestes;
        console.log(
          "✅ [TESTES] Lista reconstruída com",
          listaDeTestes.length,
          "testes"
        );
      } else {
        console.error(
          "❌ [TESTES] Nenhum teste encontrado com candidatoId:",
          candidatoId
        );
        console.log("🔍 [TESTES] Possíveis causas:");
        console.log("   1. O candidato realmente não respondeu testes");
        console.log(
          "   2. O campo 'candidatoId' está com valor diferente no Firestore"
        );
        console.log("   3. Os documentos estão em outra coleção");
      }
    } catch (err) {
      console.error("❌ [TESTES] ERRO ao buscar fallback:", err);
      console.error("Stack trace:", err.stack);
    }
  }

  // ========== RENDERIZA A LISTA ==========
  console.log("\n🎨 ========== RENDERIZANDO LISTA DE TESTES ==========");

  if (infoTestesEl) {
    if (listaDeTestes.length === 0) {
      console.warn(
        "⚠️ [RENDER] Nenhum teste para exibir. Mostrando mensagem de aviso."
      );
      infoTestesEl.innerHTML = `<div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Nenhum teste foi enviado para este candidato ainda.
      </div>`;
    } else {
      console.log("✅ [RENDER] Renderizando", listaDeTestes.length, "testes");

      let testesHtml = '<div class="testes-list">';

      listaDeTestes.forEach((teste, idx) => {
        console.log(`   🎨 Renderizando teste ${idx + 1}:`, teste.nomeTeste);

        const dataEnvio = teste.dataenvio
          ? formatarDataEnvio(teste.dataenvio)
          : "N/A";

        const statusBadge =
          teste.status === "respondido"
            ? '<span class="status-badge status-concluda">Respondido</span>'
            : '<span class="status-badge status-pendente">Aguardando resposta</span>';

        testesHtml += `<div class="teste-card mb-3 p-3 border rounded">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h6 class="mb-2">${idx + 1}. ${teste.nomeTeste || "Teste"}</h6>
              <p class="mb-1 text-muted small">
                <i class="fas fa-calendar me-1"></i><strong>Data Envio:</strong> ${dataEnvio}
              </p>
              ${
                teste.tempoGasto
                  ? `<p class="mb-1 text-muted small">
                    <i class="fas fa-hourglass-end me-1"></i><strong>Tempo Gasto:</strong> ${Math.floor(
                      teste.tempoGasto / 60
                    )}m ${teste.tempoGasto % 60}s
                  </p>`
                  : ""
              }
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>`;

        // Botão para expandir/visualizar respostas
        if (teste.status === "respondido") {
          testesHtml += `
          <button 
            type="button" 
            class="btn-ver-respostas mt-2 action-button info" 
            data-teste-id="${teste.id || teste.tokenId}"
            data-tipo="${teste.tokenId ? "tokenId" : "testeId"}"
            data-candidato-id="${candidatoId}">
            <i class="fas fa-eye me-1"></i>Ver Respostas
          </button>
          <div id="respostas-container-${
            teste.id || teste.tokenId
          }" class="mt-3"></div>`;
        }

        testesHtml += `</div>`;
      });

      testesHtml += "</div>";
      infoTestesEl.innerHTML = testesHtml;
      console.log("✅ [RENDER] HTML inserido no DOM");

      // Anexa eventos aos botões de "Ver Respostas"
      console.log(
        "🔘 [RENDER] Anexando event listeners aos botões 'Ver Respostas'..."
      );
      const botoesVerRespostas =
        document.querySelectorAll(".btn-ver-respostas");
      console.log("   - Botões encontrados:", botoesVerRespostas.length);

      botoesVerRespostas.forEach((btn, idx) => {
        console.log(`   ✅ Anexando listener ao botão ${idx + 1}`);
        btn.addEventListener("click", function () {
          console.log("🖱️ [RENDER] Botão 'Ver Respostas' clicado");

          const testeId = this.getAttribute("data-teste-id");
          const tipoId = this.getAttribute("data-tipo");
          const candId = this.getAttribute("data-candidato-id");

          console.log("📋 [RENDER] Dados do botão:", {
            testeId,
            tipoId,
            candId,
          });

          // Encontra o teste correspondente
          const testeEncontrado = listaDeTestes.find(
            (t) => t.id === testeId || t.tokenId === testeId
          );

          console.log("🔍 [RENDER] Teste encontrado:", !!testeEncontrado);

          carregarRespostasDoTeste(
            testeId,
            tipoId,
            testeEncontrado?.id,
            candId
          );
        });
      });

      console.log("✅ [RENDER] Event listeners anexados");
    }
  } else {
    console.error(
      "❌ [RENDER] Elemento avaliacao-teste-info-testes NÃO encontrado!"
    );
  }

  console.log("========== FIM RENDERIZAÇÃO TESTES ==========\n");

  // ========== CARREGA GESTORES ==========
  console.log("👥 ========== CARREGANDO GESTORES ==========");
  const gestores = await carregarGestores();
  const selectGestor = document.getElementById("avaliacao-teste-gestor");

  console.log("🔍 [GESTORES] Select encontrado:", !!selectGestor);
  console.log("📊 [GESTORES] Total de gestores:", gestores.length);

  if (selectGestor && gestores.length > 0) {
    let optionsHtml = '<option value="">-- Selecione um Gestor --</option>';
    gestores.forEach((g) => {
      optionsHtml += `<option value="${g.id}" data-nome="${
        g.nome
      }" data-telefone="${g.telefone || ""}">${g.nome}</option>`;
    });
    selectGestor.innerHTML = optionsHtml;
    console.log("✅ [GESTORES] Options HTML inserido no select");
  } else {
    console.warn(
      "⚠️ [GESTORES] Select não encontrado ou nenhum gestor disponível"
    );
  }

  console.log("========== FIM CARREGAMENTO GESTORES ==========\n");

  // ========== CONFIGURA LISTENERS DO FORMULÁRIO ==========
  console.log("📝 ========== CONFIGURANDO LISTENERS DO FORMULÁRIO ==========");

  // Listener para mudança nos radios de aprovação/reprovação
  const radios = form.querySelectorAll('input[name="resultadoteste"]');
  console.log("🔘 [FORM] Radios encontrados:", radios.length);

  radios.forEach((radio, idx) => {
    console.log(`   ✅ Anexando listener ao radio ${idx + 1}:`, radio.value);
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });

  // Listener para submit do formulário
  console.log("📤 [FORM] Configurando listener de submit");
  form.removeEventListener("submit", handleSubmitAvaliacaoTeste);
  form.addEventListener("submit", handleSubmitAvaliacaoTeste);
  console.log("✅ [FORM] Listener de submit configurado");

  console.log("========== FIM CONFIGURAÇÃO FORMULÁRIO ==========\n");

  // ========== EXIBE O MODAL ==========
  console.log("🎬 ========== EXIBINDO MODAL ==========");
  modalAvaliacaoTeste.classList.add("is-visible");
  console.log("✅ [MODAL] Classe 'is-visible' adicionada");
  console.log("✅ [MODAL] Modal de avaliação de teste ABERTO COM SUCESSO");

  console.log(
    "╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║       ✅ MODAL ABERTO - FUNÇÃO CONCLUÍDA                      ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n"
  );
}

/**
 * Handler para submit do formulário de avaliação
 */
async function handleSubmitAvaliacaoTeste(e) {
  console.log("\n📤 ========== SUBMIT FORMULÁRIO AVALIAÇÃO ==========");
  e.preventDefault();

  const form = e.target;
  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const candidatoId = modalAvaliacaoTeste.dataset.candidaturaId;

  console.log("📋 [SUBMIT] candidatoId:", candidatoId);

  if (!candidatoId) {
    console.error("❌ [SUBMIT] ID do candidato não encontrado no dataset");
    window.showToast?.("Erro: ID do candidato não encontrado", "error");
    return;
  }

  // Coleta os dados do formulário
  const resultado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const observacoes =
    document.getElementById("avaliacao-teste-observacoes")?.value || "";
  const gestorId =
    document.getElementById("avaliacao-teste-gestor")?.value || null;

  console.log("📋 [SUBMIT] Dados coletados:", {
    resultado,
    observacoes: observacoes.substring(0, 50) + "...",
    gestorId,
  });

  // Validações
  if (!resultado) {
    console.warn("⚠️ [SUBMIT] Resultado não selecionado");
    window.showToast?.(
      "Por favor, selecione um resultado (Aprovado/Reprovado)",
      "error"
    );
    return;
  }

  if (resultado === "Reprovado" && !observacoes.trim()) {
    console.warn("⚠️ [SUBMIT] Reprovado sem motivo");
    window.showToast?.("Por favor, informe o motivo da reprovação", "error");
    return;
  }

  if (resultado === "Aprovado" && !gestorId) {
    console.warn("⚠️ [SUBMIT] Aprovado sem gestor");
    window.showToast?.("Por favor, selecione um gestor", "error");
    return;
  }

  console.log("✅ [SUBMIT] Validações passaram. Salvando no Firestore...");

  try {
    const candidatoRef = doc(collection(db, "candidaturas"), candidatoId);

    const userName = await getCurrentUserName();
    console.log("👤 [SUBMIT] Usuário atual:", userName);

    const updateData = {
      avaliacaoTeste: {
        resultado: resultado,
        observacoes: observacoes,
        dataAvaliacao: new Date(),
        avaliadoPor: userName,
      },
    };

    if (resultado === "Aprovado" && gestorId) {
      updateData.avaliacaoTeste.gestorDesignado = gestorId;
      updateData.statusrecrutamento = "Testes Respondido";
      console.log("✅ [SUBMIT] Aprovado - Gestor designado:", gestorId);
    } else if (resultado === "Reprovado") {
      updateData.statusrecrutamento = "Rejeitado - Teste";
      console.log("❌ [SUBMIT] Reprovado - Status atualizado");
    }

    updateData.historico = arrayUnion({
      data: new Date(),
      acao: `Teste ${resultado.toLowerCase()} pelo RH`,
      usuario: userName,
      observacoes: observacoes,
    });

    console.log("💾 [SUBMIT] Atualizando documento no Firestore...");
    await updateDoc(candidatoRef, updateData);
    console.log("✅ [SUBMIT] Documento atualizado com sucesso!");

    window.showToast?.(`Avaliação registrada com sucesso!`, "success");

    fecharModalAvaliacaoTeste();

    // Recarrega a listagem
    if (window.renderizarEntrevistas) {
      console.log("🔄 [SUBMIT] Recarregando listagem de entrevistas...");
      window.renderizarEntrevistas(window.getGlobalRecrutamentoState?.());
    }
  } catch (error) {
    console.error("❌ [SUBMIT] Erro ao salvar avaliação:", error);
    console.error("Stack trace:", error.stack);
    window.showToast?.("Erro ao salvar avaliação: " + error.message, "error");
  }

  console.log("========== FIM SUBMIT FORMULÁRIO ==========\n");
}
