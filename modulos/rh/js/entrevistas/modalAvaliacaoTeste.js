/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoTeste.js
 * Versão: 1.0.0 (Módulo Refatorado)
 * Data: 05/11/2025
 * Descrição: Gerencia o modal de avaliação de teste (com gestor).
 */

import { getGlobalState } from "../recrutamento.js";
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

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Fecha o modal de avaliação de teste
 */
function fecharModalAvaliacaoTeste() {
  console.log("🔹 Entrevistas: Fechando modal de avaliação de teste");
  const modalOverlay = document.getElementById("modal-avaliacao-teste");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

/**
 * Gerencia a exibição do seletor de gestor no modal "Avaliar Teste"
 * (Refatorado para usar .classList)
 */
function toggleCamposAvaliacaoTeste() {
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  const radioAprovado = form.querySelector(
    'input[name="resultadoteste"][value="Aprovado"]'
  );

  const containerGestor = document.getElementById(
    "avaliacao-teste-gestor-container"
  );

  if (!containerGestor) {
    console.warn(
      "toggleCamposAvaliacaoTeste: Container #avaliacao-teste-gestor-container não encontrado."
    );
    return;
  }

  if (radioAprovado && radioAprovado.checked) {
    containerGestor.classList.remove("hidden");
  } else {
    containerGestor.classList.add("hidden");
  }
}

/**
 * Carrega lista de gestores da coleção 'usuarios'
 */
async function carregarGestores() {
  console.log("🔹 Carregando gestores do Firestore...");
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("funcoes", "array-contains", "gestor"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log("ℹ️ Nenhum gestor encontrado");
      return [];
    }

    const gestores = [];
    snapshot.forEach((docSnap) => {
      const gestor = docSnap.data();
      gestores.push({
        id: docSnap.id,
        nome: gestor.nome || gestor.email || "Gestor",
        email: gestor.email || "",
        telefone: gestor.telefone || gestor.celular || "",
        ...gestor,
      });
    });

    console.log(`✅ ${gestores.length} gestor(es) carregado(s)`);
    return gestores;
  } catch (error) {
    console.error("❌ Erro ao carregar gestores:", error);
    return [];
  }
}

/**
 * Envia mensagem de WhatsApp para o gestor selecionado
 */
window.enviarWhatsAppGestor = function () {
  console.log("🔹 Enviando WhatsApp para gestor");

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

  const nomeCandidato = dadosCandidatoAtual.nome_candidato || "Candidato(a)";
  const telefoneCandidato =
    dadosCandidatoAtual.telefone_contato || "Não informado";
  const emailCandidato = dadosCandidatoAtual.email_candidato || "Não informado";
  const statusCandidato =
    dadosCandidatoAtual.status_recrutamento || "Em avaliação";
  const vagaInfo =
    dadosCandidatoAtual.titulo_vaga_original || "Vaga não especificada";

  const mensagem = `
🎯 *Olá ${nomeGestor}!*

Você foi designado(a) para avaliar um candidato que passou na fase de testes.

👤 *Candidato:* ${nomeCandidato}
📱 *Telefone:* ${telefoneCandidato}
📧 *E-mail:* ${emailCandidato}

💼 *Vaga:* ${vagaInfo}
📊 *Status Atual:* ${statusCandidato}

✅ *O candidato foi aprovado nos testes* e aguarda sua avaliação para prosseguir no processo seletivo.

📋 *Próximos Passos:*
1. Acesse o sistema de recrutamento
2. Revise o perfil e desempenho do candidato
3. Agende uma entrevista se necessário
4. Registre sua decisão final

🌐 *Acesse o sistema:*
https://intranet.eupsico.org.br

Se tiver dúvidas, entre em contato com o RH.

*Equipe de Recrutamento - EuPsico* 💙
  `.trim();

  const telefoneLimpo = telefoneGestor.replace(/\D/g, "");
  const mensagemCodificada = encodeURIComponent(mensagem);
  const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

  window.open(linkWhatsApp, "_blank");
  window.showToast?.("WhatsApp aberto para notificar gestor", "success");
};

/**
 * Carrega as respostas de um teste específico (para o modal de avaliação)
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

  try {
    const respostasRef = collection(db, "testesrespondidos");
    let q;
    if (tipoId === "tokenId") {
      q = query(respostasRef, where("tokenId", "==", identificador));
    } else {
      q = query(
        respostasRef,
        where("testeId", "==", testeIdFallback),
        where("candidatoId", "==", candidatoId)
      );
    }
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = `<p class="alert alert-error small">Respostas não encontradas.</p>`;
      return;
    }

    const data = snapshot.docs[0].data();
    let respostasHtml = "";

    // Não precisamos do <div class="info-card"> aqui pois ele já existe no modal

    respostasHtml += `<h6 class="mt-3">Respostas do Candidato</h6>`;
    respostasHtml += `<ul class="simple-list">`;

    if (data.respostas && Array.isArray(data.respostas)) {
      data.respostas.forEach((r, i) => {
        respostasHtml += `
          <li class="simple-list-item">
            <div class="simple-list-item-content">
              <strong>P${i + 1}: ${r.pergunta || "Pergunta"}</strong>
              <div class="description-box pre-wrap mt-2" style="margin-bottom: 0;">
                ${r.resposta || "Sem resposta"}
              </div>
            </div>
          </li>`;
      });
    }
    respostasHtml += `</ul>`;

    if (data.tempoGasto !== undefined) {
      const minutos = Math.floor(data.tempoGasto / 60);
      const segundos = data.tempoGasto % 60;
      respostasHtml += `
        <div class="alert alert-info mt-3 small">
          <i class="fas fa-hourglass-end me-2"></i>
          <strong>Tempo Gasto:</strong> ${minutos}m ${segundos}s
        </div>`;
    }
    container.innerHTML = respostasHtml;
  } catch (error) {
    console.error("Erro ao carregar respostas:", error);
    container.innerHTML = `<p class="alert alert-error small">Erro ao carregar respostas.</p>`;
  }
}

// ============================================
// FUNÇÃO PRINCIPAL (Exportada)
// ============================================

/**
 * Abre o modal de avaliação do teste
 */
export async function abrirModalAvaliacaoTeste(candidatoId, dadosCandidato) {
  console.log(
    "Entrevistas: Abrindo modal de avaliação de teste para",
    candidatoId
  );

  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const form = document.getElementById("form-avaliacao-teste");

  if (!modalAvaliacaoTeste || !form) {
    window.showToast?.(
      "Erro: Modal de Avaliação de Teste não encontrado.",
      "error"
    );
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  dadosCandidato.id = candidatoId;
  modalAvaliacaoTeste.dataset.candidaturaId = candidatoId;

  document.getElementById("avaliacao-teste-nome-candidato").textContent =
    dadosCandidato.nome_candidato || "Candidato(a)";
  document.getElementById("avaliacao-teste-status-atual").textContent =
    dadosCandidato.status_recrutamento || "N/A";

  // Exibe todos os testes enviados
  const testesEnviados = dadosCandidato.testes_enviados || [];
  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");

  if (infoTestesEl) {
    if (testesEnviados.length === 0) {
      infoTestesEl.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Nenhum teste foi enviado para este candidato ainda.
        </div>`;
    } else {
      let testesHtml = "<div>";
      testesEnviados.forEach((teste, index) => {
        const dataEnvio = formatarDataEnvio(teste.data_envio);
        const statusTeste = teste.status || "enviado";
        let statusClass = "status-pendente";
        let statusTexto = "Pendente";
        let linkHtml = "";
        const tokenId = teste.tokenId || `manual-index-${index}`;

        if (statusTeste === "respondido") {
          statusClass = "status-concluída";
          statusTexto = "Respondido";
          // Um link placeholder, já que as respostas são carregadas abaixo
          linkHtml = `<span class="text-muted small mt-2">Respostas prontas para avaliação.</span>`;
        } else if (statusTeste === "avaliado") {
          statusClass = "status-pendente";
          statusTexto = "Avaliado";
        } else {
          linkHtml = `<p class="text-muted small mt-2">Aguardando resposta do candidato</p>`;
        }

        testesHtml += `
          <div class="info-card mb-3">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <h5 style="margin: 0; color: var(--cor-primaria);">
                <i class="fas fa-file-alt me-2"></i>
                ${
                  teste.nomeTeste ||
                  "Teste (ID: " + tokenId.substring(0, 5) + ")"
                }
              </h5>
              <span class="status-badge ${statusClass}">${statusTexto}</span>
            </div>
            <div class="mt-2">
              <p class="small text-muted mb-1"><strong>Data de Envio:</strong> ${dataEnvio}</p>
              <p class="small text-muted mb-1"><strong>Enviado por:</strong> ${
                teste.enviado_por || "N/A"
              }</p>
              ${
                teste.tempoGasto
                  ? `<p class="small text-muted mb-1"><strong>Tempo Gasto:</strong> ${Math.floor(
                      teste.tempoGasto / 60
                    )}m ${teste.tempoGasto % 60}s</p>`
                  : ""
              }
              <p class="small text-muted mb-1"><strong>Link:</strong> <a href="${
                teste.link || "#"
              }" target="_blank">${teste.link ? "Acessar Link" : "N/A"}</a></p>
              ${linkHtml}
            </div>
            <div class="respostas-container mt-3 pt-3" id="respostas-container-${tokenId}" style="border-top: 1px solid var(--cor-borda);">
              <span class="text-muted small">Carregando respostas...</span>
            </div>
          </div>`;
      });
      testesHtml += "</div>";
      infoTestesEl.innerHTML = testesHtml;

      // Dispara o carregamento das respostas
      testesEnviados.forEach((teste, index) => {
        const tokenId = teste.tokenId || `manual-index-${index}`;
        const tipoId = teste.tokenId ? "tokenId" : "testeId";
        const statusTeste = teste.status || "enviado";
        if (statusTeste === "respondido" || statusTeste === "avaliado") {
          carregarRespostasDoTeste(tokenId, tipoId, teste.id, candidatoId);
        } else {
          const container = document.getElementById(
            `respostas-container-${tokenId}`
          );
          if (container)
            container.innerHTML = `<span class="text-muted small"><i class="fas fa-hourglass-half me-2"></i> Teste ainda não respondido.</span>`;
        }
      });
    }
  }

  // Carrega gestores no select
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
        optionsHtml += `<option value="${gestor.id}" data-nome="${
          gestor.nome
        }" data-telefone="${gestor.telefone || ""}" data-email="${
          gestor.email || ""
        }">${gestor.nome}${gestor.email ? ` (${gestor.email})` : ""}</option>`;
      });
      selectGestor.innerHTML = optionsHtml;
    }
  }

  // Habilita/Desabilita botão de WhatsApp
  if (selectGestor && btnWhatsAppGestor) {
    selectGestor.addEventListener("change", (e) => {
      const option = e.target.selectedOptions[0];
      const telefone = option?.getAttribute("data-telefone");
      btnWhatsAppGestor.disabled = !telefone || telefone.trim() === "";
    });
    btnWhatsAppGestor.disabled = true;
  }

  if (form) form.reset();

  // Listeners dos Rádios (Aprovado/Reprovado)
  const radiosResultadoTeste = form.querySelectorAll(
    'input[name="resultadoteste"]'
  );
  radiosResultadoTeste.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoTeste);
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });
  toggleCamposAvaliacaoTeste(); // Seta estado inicial

  // Listener do Formulário
  form.removeEventListener("submit", submeterAvaliacaoTeste);
  form.addEventListener("submit", submeterAvaliacaoTeste);

  // Listeners de Fechar
  document
    .querySelectorAll('[data-modal-id="modal-avaliacao-teste"]')
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacaoTeste);
      btn.addEventListener("click", fecharModalAvaliacaoTeste);
    });

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
  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } =
    getGlobalState();
  const candidaturaId = modalAvaliacaoTeste?.dataset.candidaturaId;
  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  const form = document.getElementById("form-avaliacao-teste");
  const resultado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const observacoes =
    form.querySelector("#avaliacao-teste-observacoes")?.value || "";
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const gestorSelecionadoId = selectGestor?.value || null;
  const gestorOption = selectGestor?.selectedOptions[0];
  const gestorNome = gestorOption?.getAttribute("data-nome") || null;

  if (!resultado) {
    window.showToast?.("Selecione o Resultado do Teste.", "error");
    return;
  }
  if (resultado === "Aprovado" && !gestorSelecionadoId) {
    window.showToast?.("Selecione um gestor para aprovar.", "error");
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
    .getAttribute("data-status");
  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacaoTeste = {
    resultado: resultado,
    dataavaliacao: new Date(),
    avaliador_nome: avaliadorNome,
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
      status_recrutamento: novoStatusCandidato,
      avaliacao_teste: dadosAvaliacaoTeste,
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Teste: ${isAprovado ? "APROVADO" : "REPROVADO"}. ${
          isAprovado ? `Gestor: ${gestorNome}` : ""
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
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("Erro ao salvar avaliação de teste:", error);
    window.showToast?.(`Erro ao registrar: ${error.message}`, "error");
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i>Registrar Avaliação';
  }
}
