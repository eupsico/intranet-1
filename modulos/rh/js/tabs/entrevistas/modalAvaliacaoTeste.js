/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoTeste.js
 * Versão: 1.5.0 - Correção: Busca direta por candidatoId + Event listeners botões
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
        'Observações <span class="text-muted">(opcional)</span>';
  }
  // 2. Lógica REPROVADO
  else if (resultadoSelecionado === "Reprovado") {
    if (containerGestor) containerGestor.classList.add("hidden");
    // Observações viram "Motivo de Reprovação (Obrigatório)"
    if (textareaObservacoes) textareaObservacoes.required = true;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<strong class="text-danger">Motivo da Reprovação (Obrigatório)</strong>';
  }
  // 3. Nenhum selecionado (Estado inicial)
  else {
    if (containerGestor) containerGestor.classList.add("hidden");
    if (textareaObservacoes) textareaObservacoes.required = false;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        'Observações <span class="text-muted">(opcional)</span>';
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
      container.innerHTML = `<p class="text-danger"><small>Respostas não encontradas para este teste.</small></p>`;
      return;
    }

    console.log("✅ Respostas encontradas:", snapshot.docs.length);
    const data = snapshot.docs[0].data();

    let respostasHtml = `
      <div class="info-card" style="background-color: var(--cor-fundo); padding: 10px;">
        <h6 style="margin-top:0; color: var(--cor-primaria);">
          <i class="fas fa-check-circle me-2"></i> Respostas Recebidas
        </h6>
        <small class="text-muted d-block"><strong>Data:</strong> ${formatarDataEnvio(
          data.dataenvio
        )}</small>
      </div>
      <ul class="simple-list mt-2">
    `;

    if (data.respostas && Array.isArray(data.respostas)) {
      data.respostas.forEach((r, i) => {
        respostasHtml += `
          <li class="simple-list-item">
            <div class="simple-list-item-content">
              <strong>P${i + 1}:</strong> ${r.pergunta || "Pergunta"}
              <div class="description-box pre-wrap mt-1 mb-0" style="padding: 8px; background: white;">
                ${r.resposta || "Sem resposta"}
              </div>
            </div>
          </li>
        `;
      });
    } else if (data.respostas && typeof data.respostas === "object") {
      Object.keys(data.respostas).forEach((key, i) => {
        respostasHtml += `
          <li class="simple-list-item">
            <div class="simple-list-item-content">
              <strong>Resposta ${i + 1}:</strong>
              <div class="description-box pre-wrap mt-1 mb-0" style="padding: 8px; background: white;">
                ${data.respostas[key]}
              </div>
            </div>
          </li>
        `;
      });
    }

    respostasHtml += `</ul>`;

    if (data.tempoGasto !== undefined) {
      const minutos = Math.floor(data.tempoGasto / 60);
      const segundos = data.tempoGasto % 60;
      respostasHtml += `
        <div class="alert alert-info mt-2 small p-2">
          <i class="fas fa-clock me-2"></i><strong>Tempo Gasto:</strong> ${minutos}m ${segundos}s
        </div>
      `;
    }

    container.innerHTML = respostasHtml;
  } catch (error) {
    console.error("Erro ao carregar respostas:", error);
    container.innerHTML = `<p class="text-danger"><small>Erro ao carregar respostas. Detalhes: ${error.message}</small></p>`;
  }
}

/* ==================== FUNÇÃO PRINCIPAL (Exportada) ==================== */

/**
 * Abre o modal de avaliação do teste
 * CORREÇÃO v1.5.0: Event listeners corrigidos + busca direta por candidatoId
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

  // ========== ✅ CORREÇÃO: Botões de Fechar ==========
  const btnCloseX = modalAvaliacaoTeste.querySelector(".close-modal-btn");
  const btnCancelar = modalAvaliacaoTeste.querySelector(
    ".modal-footer .action-button.secondary"
  );

  console.log("Botões encontrados:", {
    btnCloseX: !!btnCloseX,
    btnCancelar: !!btnCancelar,
  });

  // Anexa eventos de fechar
  if (btnCloseX) {
    // Remove listener antigo (se existir)
    const newBtnCloseX = btnCloseX.cloneNode(true);
    btnCloseX.parentNode.replaceChild(newBtnCloseX, btnCloseX);

    newBtnCloseX.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("✅ Botão X clicado - Fechando modal");
      fecharModalAvaliacaoTeste();
    });
  }

  if (btnCancelar) {
    // Remove listener antigo (se existir)
    const newBtnCancelar = btnCancelar.cloneNode(true);
    btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);

    newBtnCancelar.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("✅ Botão Cancelar clicado - Fechando modal");
      fecharModalAvaliacaoTeste();
    });
  }

  // Popula informações do candidato
  document.getElementById("avaliacao-teste-nome-candidato").textContent =
    dadosCandidato.nomecandidato || "Candidato(a)";
  document.getElementById("avaliacao-teste-status-atual").textContent =
    dadosCandidato.statusrecrutamento || "N/A";

  // ========== 3. Lógica de Dados dos Testes ==========
  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");
  let listaDeTestes = dadosCandidato.testesenviados || [];

  // FALLBACK: Se o array do candidato estiver vazio, busca na coleção testesrespondidos
  if (listaDeTestes.length === 0) {
    console.log(
      "⚠️  Array de testes na candidatura vazio. Tentando buscar em testesrespondidos..."
    );
    infoTestesEl.innerHTML = '<div class="loading-spinner"></div>';

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

  // ========== 4. Renderiza a Lista ==========
  if (infoTestesEl) {
    if (listaDeTestes.length === 0) {
      infoTestesEl.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Nenhum teste foi enviado ou encontrado para este candidato ainda.
        </div>
      `;
    } else {
      let testesHtml = "<div>";
      listaDeTestes.forEach((teste, index) => {
        const dataEnvio = formatarDataEnvio(teste.dataenvio) || teste.dataenvio;
        const statusTeste = teste.status || "enviado";

        let statusClass = "status-pendente";
        let statusTexto = "Pendente...";
        let linkHtml = "";

        const tokenId = teste.tokenId || `manual-${index}-${Date.now()}`;

        if (statusTeste === "respondido" || statusTeste === "avaliado") {
          statusClass = "status-concluída";
          statusTexto = "Respondido";
          if (teste.linkrespostas) {
            linkHtml = `<a href="${teste.linkrespostas}" target="_blank" class="action-button small info mt-2"><i class="fas fa-eye me-1"></i> Acessar Respostas</a>`;
          }
        } else {
          linkHtml = `<p class="text-muted small mt-2">Aguardando resposta do candidato</p>`;
        }

        testesHtml += `
          <div class="info-card mb-3">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <h5 style="margin: 0; color: var(--cor-primaria);">
                <i class="fas fa-file-alt me-2"></i>${
                  teste.nomeTeste || "Teste"
                }
              </h5>
              <span class="status-badge ${statusClass}">${statusTexto}</span>
            </div>
            <div class="mt-2">
              <p class="small text-muted mb-1"><strong>Data Envio:</strong> ${dataEnvio}</p>
              ${
                teste.tempoGasto
                  ? `<p class="small text-muted mb-1"><strong>Tempo Gasto:</strong> ${Math.floor(
                      teste.tempoGasto / 60
                    )}m ${teste.tempoGasto % 60}s</p>`
                  : ""
              }
              ${
                teste.link
                  ? `<p class="small text-muted mb-1"><strong>Link:</strong> <a href="${teste.link}" target="_blank">Acessar Link</a></p>`
                  : ""
              }
              ${linkHtml}
            </div>
            <div class="respostas-container mt-3 pt-3" id="respostas-container-${tokenId}" style="border-top: 1px solid var(--cor-borda);">
              <span class="text-muted small">Carregando respostas...</span>
            </div>
          </div>
        `;
      });
      testesHtml += "</div>";
      infoTestesEl.innerHTML = testesHtml;

      // Carrega as respostas de cada teste
      listaDeTestes.forEach((teste, index) => {
        const tokenId = teste.tokenId || `manual-${index}-${Date.now()}`;
        const tipoId = teste.tokenId ? "tokenId" : "testeId";
        const statusTeste = teste.status || "enviado";

        if (statusTeste === "respondido" || statusTeste === "avaliado") {
          carregarRespostasDoTeste(
            tokenId,
            tipoId,
            teste.id || teste.testeId,
            candidatoId
          );
        } else {
          const container = document.getElementById(
            `respostas-container-${tokenId}`
          );
          if (container) {
            container.innerHTML = `<span class="text-muted small"><i class="fas fa-hourglass-half me-2"></i> Teste ainda não respondido.</span>`;
          }
        }
      });
    }
  }

  // ========== Carrega gestores ==========
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const btnWhatsAppGestor = document.getElementById(
    "btn-whatsapp-gestor-avaliacao"
  );

  if (selectGestor) {
    selectGestor.innerHTML = '<option value="">Carregando gestores...</option>';
    const gestores = await carregarGestores();

    if (gestores.length === 0) {
      selectGestor.innerHTML =
        '<option value="">Nenhum gestor disponível</option>';
      if (btnWhatsAppGestor) btnWhatsAppGestor.disabled = true;
    } else {
      let optionsHtml = '<option value="">Selecione um gestor...</option>';
      gestores.forEach((gestor) => {
        optionsHtml += `
          <option value="${gestor.id}" 
                  data-nome="${gestor.nome}" 
                  data-telefone="${gestor.telefone || ""}"
                  data-email="${gestor.email}">
            ${gestor.nome}${gestor.email ? ` (${gestor.email})` : ""}
          </option>
        `;
      });
      selectGestor.innerHTML = optionsHtml;
    }

    // Listeners do select de gestor
    if (selectGestor && btnWhatsAppGestor) {
      selectGestor.removeEventListener("change", toggleGestorWhatsApp);
      selectGestor.addEventListener("change", toggleGestorWhatsApp);
      btnWhatsAppGestor.disabled = true;

      function toggleGestorWhatsApp(e) {
        const option = e.target.selectedOptions[0];
        const telefone = option?.getAttribute("data-telefone");
        btnWhatsAppGestor.disabled = !telefone || !telefone.trim();
      }
    }
  }

  // Reseta formulário
  if (form) {
    form.reset();
  }

  // Listeners dos Rádios (Aprovado/Reprovado)
  const radiosResultadoTeste = form.querySelectorAll(
    'input[name="resultadoteste"]'
  );
  radiosResultadoTeste.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoTeste);
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });

  // Listener do Formulário
  form.removeEventListener("submit", submeterAvaliacaoTeste);
  form.addEventListener("submit", submeterAvaliacaoTeste);

  // Inicializa o estado correto (esconde gestor, observações opcionais)
  toggleCamposAvaliacaoTeste();

  // Exibe o modal
  modalAvaliacaoTeste.classList.add("is-visible");
}

/**
 * Submete a avaliação final do teste
 */
async function submeterAvaliacaoTeste(e) {
  e.preventDefault();

  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-avaliacao-teste"
  );

  const state = window.getGlobalRecrutamentoState();
  if (!state) {
    window.showToast?.("Erro: Estado global não iniciado.", "error");
    return;
  }

  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;
  const candidaturaId = modalAvaliacaoTeste?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  const form = document.getElementById("form-avaliacao-teste");
  const resultado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const observacoes = form.querySelector("#avaliacao-teste-observacoes")?.value;
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const gestorSelecionadoId = selectGestor?.value || null;
  const gestorOption = selectGestor?.selectedOptions[0];
  const gestorNome = gestorOption?.getAttribute("data-nome") || null;

  if (!resultado) {
    window.showToast?.("Selecione o Resultado do Teste.", "error");
    return;
  }

  // Validação Específica
  if (resultado === "Aprovado" && !gestorSelecionadoId) {
    window.showToast?.("Selecione um gestor para aprovar.", "error");
    return;
  }

  if (resultado === "Reprovado" && (!observacoes || !observacoes.trim())) {
    window.showToast?.("O motivo da reprovação é obrigatório.", "error");
    return;
  }

  btnRegistrarAvaliacao.disabled = true;
  btnRegistrarAvaliacao.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Processando...';

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado
    ? "Entrevista com Gestor"
    : "Finalizado - Reprovado no Teste";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    ?.getAttribute("data-status");

  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacaoTeste = {
    resultado: resultado,
    dataavaliacao: new Date(),
    avaliadornome: avaliadorNome,
    observacoes: observacoes || null,
  };

  if (isAprovado && gestorSelecionadoId) {
    dadosAvaliacaoTeste.gestordesignado = {
      id: gestorSelecionadoId,
      nome: gestorNome,
      datadesignacao: new Date(),
    };
  }

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);
    await updateDoc(candidaturaRef, {
      statusrecrutamento: novoStatusCandidato,
      avaliacaoteste: dadosAvaliacaoTeste,
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Teste: ${isAprovado ? "APROVADO" : "REPROVADO"}. ${
          isAprovado ? `Gestor: ${gestorNome}` : `Motivo: ${observacoes}`
        }`,
        usuario: avaliadorNome,
      }),
    });

    window.showToast?.(
      `Teste ${isAprovado ? "aprovado" : "reprovado"}!`,
      "success"
    );
    fecharModalAvaliacaoTeste();

    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação de teste:", error);
    window.showToast?.(`Erro ao registrar: ${error.message}`, "error");
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i>Registrar Avaliação';
  }
}

// Exporta as funções
export { abrirModalAvaliacaoTeste, fecharModalAvaliacaoTeste };
