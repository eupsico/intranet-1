/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoTeste.js
 * Versão: 1.6.0 - Correção: Renderização completa de testes + Event listeners botões
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
  console.log("[Entrevistas] Fechando modal de avaliação de teste");
  const modalOverlay = document.getElementById("modal-avaliacao-teste");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }

  // Reseta o formulário ao fechar para evitar estados inconsistentes na reabertura
  const form = document.getElementById("form-avaliacao-teste");
  if (form) {
    form.reset();
  }
}

/**
 * Gerencia a exibição do seletor de gestor e obrigatoriedade da reprovação
 */
function toggleCamposAvaliacaoTeste() {
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  // Verifica qual radio está checado
  const resultadoSelecionado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;

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
    if (containerGestor) containerGestor.classList.remove("hidden");
    // Observações voltam a ser opcionais
    if (textareaObservacoes) textareaObservacoes.required = false;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-comment-alt me-2"></i>Observações (opcional)';
  }
  // 2. Lógica REPROVADO
  else if (resultadoSelecionado === "Reprovado") {
    if (containerGestor) containerGestor.classList.add("hidden");
    // Observações viram "Motivo de Reprovação (Obrigatório)"
    if (textareaObservacoes) textareaObservacoes.required = true;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-exclamation-triangle me-2"></i><strong>Motivo da Reprovação (Obrigatório)</strong>';
  }
  // 3. Nenhum selecionado (Estado inicial)
  else {
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
  console.log("Carregando gestores do Firestore...");
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("funcoes", "array-contains", "gestor"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log("Nenhum gestor encontrado");
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

    console.log(`${gestores.length} gestores carregados`);
    return gestores;
  } catch (error) {
    console.error("Erro ao carregar gestores:", error);
    return [];
  }
}

/**
 * Envia mensagem de WhatsApp para o gestor selecionado
 */
window.enviarWhatsAppGestor = function () {
  console.log("Enviando WhatsApp para gestor");
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const option = selectGestor?.selectedOptions[0];

  if (!option || !option.value) {
    window.showToast?.("Selecione um gestor primeiro", "error");
    return;
  }

  const nomeGestor = option.getAttribute("data-nome");
  const telefoneGestor = option.getAttribute("data-telefone");

  if (!telefoneGestor) {
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

  window.open(linkWhatsApp, "_blank");
  window.showToast?.("WhatsApp aberto para notificar gestor", "success");
};

/**
 * Carrega as respostas de um teste específico para o modal de avaliação
 * CORREÇÃO v1.5.0: Busca DIRETAMENTE por candidatoId (campo confirmado)
 */
async function carregarRespostasDoTeste(
  identificador,
  tipoId,
  testeIdFallback,
  candidatoId
) {
  const container = document.getElementById(
    `respostas-container-${identificador}`
  );
  if (!container) return;

  console.log("🔍 Buscando respostas para:", {
    identificador,
    tipoId,
    testeIdFallback,
    candidatoId,
  });

  try {
    const respostasRef = collection(db, "testesrespondidos");
    let q;

    if (tipoId === "tokenId") {
      q = query(respostasRef, where("tokenId", "==", identificador));
      console.log("Query por tokenId:", identificador);
    } else {
      // ✅ CORREÇÃO: Busca DIRETAMENTE por candidatoId (campo confirmado)
      console.log("Buscando por candidatoId (campo confirmado):", candidatoId);
      q = query(
        respostasRef,
        where("testeId", "==", testeIdFallback),
        where("candidatoId", "==", candidatoId)
      );
    }

    let snapshot = await getDocs(q);

    // Se não encontrar com testeId + candidatoId, tenta apenas por candidatoId
    if (snapshot.empty && tipoId !== "tokenId") {
      console.log(
        "Nenhum resultado com testeId + candidatoId. Tentando apenas candidatoId..."
      );
      q = query(respostasRef, where("candidatoId", "==", candidatoId));
      snapshot = await getDocs(q);

      // Se encontrou múltiplos, filtra pelo testeId
      if (!snapshot.empty && snapshot.docs.length > 1) {
        const docs = snapshot.docs.filter(
          (doc) => doc.data().testeId === testeIdFallback
        );
        if (docs.length > 0) {
          snapshot = { docs, empty: false };
        }
      }
    }

    if (snapshot.empty) {
      console.warn("❌ Respostas não encontradas");
      container.innerHTML = `<div class="alert alert-warning">
        <i class="fas fa-info-circle me-2"></i>
        Respostas não encontradas para este teste.
      </div>`;
      return;
    }

    console.log("✅ Respostas encontradas:", snapshot.docs.length);
    const data = snapshot.docs[0].data();

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
      respostasHtml += `<h6 class="mb-3">Respostas do Candidato:</h6>`;
      data.respostas.forEach((resp, idx) => {
        respostasHtml += `<div class="resposta-item mb-3 p-3 border rounded">
          <p><strong>Questão ${idx + 1}:</strong> ${resp.pergunta || "N/A"}</p>
          <p><strong>Resposta:</strong> ${resp.resposta || "Não respondida"}</p>
        </div>`;
      });
    } else {
      respostasHtml += `<p class="text-muted">Nenhuma resposta detalhada disponível.</p>`;
    }

    respostasHtml += `</div>`;
    container.innerHTML = respostasHtml;
  } catch (error) {
    console.error("Erro ao carregar respostas:", error);
    container.innerHTML = `<div class="alert alert-error">
      <i class="fas fa-exclamation-circle me-2"></i>
      Erro ao carregar respostas. Detalhes: ${error.message}
    </div>`;
  }
}

/* ==================== FUNÇÃO PRINCIPAL (Exportada) ==================== */

/**
 * Abre o modal de avaliação do teste
 * CORREÇÃO v1.6.0: Renderização completa + Event listeners corrigidos
 */
export async function abrirModalAvaliacaoTeste(candidatoId, dadosCandidato) {
  console.log("\n========================================");
  console.log("Abrindo modal Avaliação Teste para ID:", candidatoId);
  console.log("========================================\n");

  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const form = document.getElementById("form-avaliacao-teste");

  if (!modalAvaliacaoTeste || !form) {
    console.error("Erro: Elementos principais do modal não encontrados.");
    return;
  }

  dadosCandidatoAtual = dadosCandidato || { id: candidatoId };
  modalAvaliacaoTeste.dataset.candidaturaId = candidatoId;

  // ========== ✅ CORREÇÃO: Botões de Fechar - Seletores Melhorados ==========

  // Tenta múltiplos seletores para garantir que encontre o botão X
  const btnCloseX =
    modalAvaliacaoTeste.querySelector(".close-modal-btn") ||
    modalAvaliacaoTeste.querySelector(".modal-close") ||
    modalAvaliacaoTeste.querySelector("[data-action='close']");

  // Tenta múltiplos seletores para o botão Cancelar
  const btnCancelar =
    modalAvaliacaoTeste.querySelector(
      ".modal-footer .action-button.secondary"
    ) ||
    modalAvaliacaoTeste.querySelector("button[type='button'].secondary") ||
    modalAvaliacaoTeste.querySelector(".btn-cancelar");

  console.log("Botões encontrados:", {
    btnCloseX: !!btnCloseX,
    btnCancelar: !!btnCancelar,
  });

  // Anexa eventos de fechar ao botão X
  if (btnCloseX) {
    // Remove listener antigo (se existir) clonando o elemento
    const newBtnCloseX = btnCloseX.cloneNode(true);
    btnCloseX.parentNode.replaceChild(newBtnCloseX, btnCloseX);

    newBtnCloseX.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("✅ Botão X clicado - Fechando modal");
      fecharModalAvaliacaoTeste();
    });
  } else {
    console.warn("⚠️ Botão X não encontrado no modal");
  }

  // Anexa eventos de fechar ao botão Cancelar
  if (btnCancelar) {
    // Remove listener antigo (se existir) clonando o elemento
    const newBtnCancelar = btnCancelar.cloneNode(true);
    btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

    newBtnCancelar.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("✅ Botão Cancelar clicado - Fechando modal");
      fecharModalAvaliacaoTeste();
    });
  } else {
    console.warn("⚠️ Botão Cancelar não encontrado no modal");
  }

  // ========== 2. Popula Informações do Candidato ==========
  const nomeEl = document.getElementById("avaliacao-teste-nome-candidato");
  const statusEl = document.getElementById("avaliacao-teste-status-atual");

  if (nomeEl) {
    nomeEl.textContent = dadosCandidato.nomecandidato || "Candidato(a)";
  }

  if (statusEl) {
    statusEl.textContent = dadosCandidato.statusrecrutamento || "N/A";
  }

  // ========== 3. Lógica de Dados dos Testes ==========
  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");
  let listaDeTestes = dadosCandidato.testesenviados || [];

  // FALLBACK: Se o array do candidato estiver vazio, busca na coleção testesrespondidos
  if (listaDeTestes.length === 0) {
    console.log(
      "⚠️ Array de testes na candidatura vazio. Tentando buscar em testesrespondidos..."
    );

    if (infoTestesEl) {
      infoTestesEl.innerHTML = '<div class="loading-spinner"></div>';
    }

    try {
      const respostasRef = collection(db, "testesrespondidos");

      // ✅ CORREÇÃO: Busca DIRETAMENTE por candidatoId (campo confirmado)
      console.log("🔍 Buscando testes por candidatoId:", candidatoId);
      const qRespostas = query(
        respostasRef,
        where("candidatoId", "==", candidatoId)
      );

      const snapshotRespostas = await getDocs(qRespostas);

      if (!snapshotRespostas.empty) {
        console.log(
          `✅ Sucesso! ${snapshotRespostas.docs.length} testes encontrados.`
        );

        // Reconstrói a lista baseada no que achou na coleção
        listaDeTestes = snapshotRespostas.docs.map((doc) => {
          const data = doc.data();
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

        // Atualiza o estado local para renderização
        dadosCandidatoAtual.testesenviados = listaDeTestes;
      } else {
        console.log("❌ Nenhum teste encontrado com candidatoId:", candidatoId);
      }
    } catch (err) {
      console.error("Erro ao buscar fallback:", err);
    }
  }

  // ========== 4. Renderiza a Lista de Testes ==========
  if (infoTestesEl) {
    if (listaDeTestes.length === 0) {
      infoTestesEl.innerHTML = `<div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Nenhum teste foi enviado para este candidato ainda.
      </div>`;
    } else {
      // ✅ CORREÇÃO: Renderização completa dos testes encontrados
      let testesHtml = '<div class="testes-list">';

      listaDeTestes.forEach((teste, idx) => {
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

      // Anexa eventos aos botões de "Ver Respostas"
      document.querySelectorAll(".btn-ver-respostas").forEach((btn) => {
        btn.addEventListener("click", function () {
          const testeId = this.getAttribute("data-teste-id");
          const tipoId = this.getAttribute("data-tipo");
          const candId = this.getAttribute("data-candidato-id");

          // Encontra o teste correspondente
          const testeEncontrado = listaDeTestes.find(
            (t) => t.id === testeId || t.tokenId === testeId
          );

          carregarRespostasDoTeste(
            testeId,
            tipoId,
            testeEncontrado?.id,
            candId
          );
        });
      });
    }
  }

  // ========== 5. Carrega Gestores ==========
  const gestores = await carregarGestores();
  const selectGestor = document.getElementById("avaliacao-teste-gestor");

  if (selectGestor && gestores.length > 0) {
    let optionsHtml = '<option value="">-- Selecione um Gestor --</option>';
    gestores.forEach((g) => {
      optionsHtml += `<option value="${g.id}" data-nome="${
        g.nome
      }" data-telefone="${g.telefone || ""}">${g.nome}</option>`;
    });
    selectGestor.innerHTML = optionsHtml;
  }

  // ========== 6. Configura Listeners do Formulário ==========

  // Listener para mudança nos radios de aprovação/reprovação
  form.querySelectorAll('input[name="resultadoteste"]').forEach((radio) => {
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });

  // Listener para submit do formulário
  form.removeEventListener("submit", handleSubmitAvaliacaoTeste);
  form.addEventListener("submit", handleSubmitAvaliacaoTeste);

  // ========== 7. Exibe o Modal ==========
  modalAvaliacaoTeste.classList.add("is-visible");
  console.log("✅ Modal de avaliação de teste aberto com sucesso");
}

/**
 * Handler para submit do formulário de avaliação
 */
async function handleSubmitAvaliacaoTeste(e) {
  e.preventDefault();

  const form = e.target;
  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const candidatoId = modalAvaliacaoTeste.dataset.candidaturaId;

  if (!candidatoId) {
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

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione um resultado (Aprovado/Reprovado)",
      "error"
    );
    return;
  }

  // Validação: Se reprovado, observações são obrigatórias
  if (resultado === "Reprovado" && !observacoes.trim()) {
    window.showToast?.("Por favor, informe o motivo da reprovação", "error");
    return;
  }

  // Validação: Se aprovado, gestor é obrigatório
  if (resultado === "Aprovado" && !gestorId) {
    window.showToast?.("Por favor, selecione um gestor", "error");
    return;
  }

  try {
    const candidatoRef = doc(collection(db, "candidaturas"), candidatoId);

    const updateData = {
      avaliacaoTeste: {
        resultado: resultado,
        observacoes: observacoes,
        dataAvaliacao: new Date(),
        avaliadoPor: await getCurrentUserName(),
      },
    };

    // Se aprovado, adiciona o gestor designado
    if (resultado === "Aprovado" && gestorId) {
      updateData.avaliacaoTeste.gestorDesignado = gestorId;
      updateData.statusrecrutamento = "Testes Respondido"; // ou o próximo status apropriado
    } else if (resultado === "Reprovado") {
      updateData.statusrecrutamento = "Rejeitado - Teste";
    }

    // Adiciona ao histórico
    updateData.historico = arrayUnion({
      data: new Date(),
      acao: `Teste ${resultado.toLowerCase()} pelo RH`,
      usuario: await getCurrentUserName(),
      observacoes: observacoes,
    });

    await updateDoc(candidatoRef, updateData);

    window.showToast?.(`Avaliação registrada com sucesso!`, "success");

    // Fecha o modal
    fecharModalAvaliacaoTeste();

    // Recarrega a listagem (se a função existir)
    if (window.renderizarEntrevistas) {
      window.renderizarEntrevistas(window.getGlobalRecrutamentoState?.());
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    window.showToast?.("Erro ao salvar avaliação: " + error.message, "error");
  }
}
