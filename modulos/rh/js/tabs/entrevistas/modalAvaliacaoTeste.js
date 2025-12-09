/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAvaliacaoTeste.js
 * Versão: 2.2.0 (Restaurado Completo + Status Simplificado + Utils)
 * Descrição: Gerencia o modal de avaliação de teste com gestor, carregamento de respostas detalhadas e estatísticas.
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

// ✅ Importação do Utilitário de Status
import { formatarStatusLegivel } from "../../utils/status_utils.js";

let dadosCandidatoAtual = null;

/* ==================== FUNÇÕES DE UTILIDADE ==================== */

/**
 * Fecha o modal de avaliação de teste
 */
function fecharModalAvaliacaoTeste() {
  console.log("🚪 [MODAL] Iniciando fechamento do modal");
  const modalOverlay = document.getElementById("modal-avaliacao-teste");

  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }

  // Reseta o formulário ao fechar
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

  // 1. Aprovado
  if (resultadoSelecionado === "Aprovado") {
    if (containerGestor) containerGestor.classList.remove("hidden");
    if (textareaObservacoes) textareaObservacoes.required = false;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-comment-alt me-2"></i>Observações (opcional)';
  }
  // 2. Reprovado
  else if (resultadoSelecionado === "Reprovado") {
    if (containerGestor) containerGestor.classList.add("hidden");
    if (textareaObservacoes) textareaObservacoes.required = true;
    if (labelObservacoes)
      labelObservacoes.innerHTML =
        '<i class="fas fa-exclamation-triangle me-2"></i><strong>Motivo da Reprovação (Obrigatório)</strong>';
  }
  // 3. Nenhum
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
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("funcoes", "array-contains", "gestor"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

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
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const option = selectGestor?.selectedOptions[0];

  if (!option || !option.value) {
    window.showToast?.("Selecione um gestor primeiro", "error");
    return;
  }

  const telefoneGestor = option.getAttribute("data-telefone");

  if (!telefoneGestor) {
    window.showToast?.("Gestor não possui telefone cadastrado", "error");
    return;
  }

  const nomeGestor = option.getAttribute("data-nome") || "Gestor";
  const nomeCandidato = dadosCandidatoAtual.nome_candidato || "Candidato(a)";
  const telefoneCandidato =
    dadosCandidatoAtual.telefone_contato || "Não informado";
  const emailCandidato = dadosCandidatoAtual.email_candidato || "Não informado";
  const statusCandidato =
    dadosCandidatoAtual.status_recrutamento || "Em avaliação";
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
  const linkWhatsApp = `https://wa.me/${telefoneLimpo}?text=${mensagemCodificada}`;

  window.open(linkWhatsApp, "_blank");
  window.showToast?.("WhatsApp aberto para notificar gestor", "success");
};

/**
 * Carrega e popula gestores no select
 */
async function carregarEPopularGestores() {
  try {
    const selectGestor = document.getElementById("avaliacao-teste-gestor");
    if (!selectGestor) return;

    selectGestor.innerHTML = '<option value="">Selecione um gestor...</option>';

    const gestores = await carregarGestores();

    if (gestores.length === 0) {
      selectGestor.innerHTML +=
        '<option value="">Nenhum gestor disponível</option>';
      return;
    }

    gestores.forEach((gestor) => {
      const option = document.createElement("option");
      option.value = gestor.id;
      option.textContent = gestor.nome;
      option.setAttribute("data-nome", gestor.nome);
      option.setAttribute(
        "data-telefone",
        gestor.telefone || gestor.celular || ""
      );
      selectGestor.appendChild(option);
    });

    const btnNotificar = document.getElementById(
      "btn-whatsapp-gestor-avaliacao"
    );
    if (btnNotificar) {
      selectGestor.addEventListener("change", () => {
        btnNotificar.disabled = selectGestor.value === "";
      });
    }
  } catch (error) {
    console.error("Erro ao popular gestores:", error);
  }
}

/**
 * ✅ [RESTAURADO] Carrega as respostas de um teste específico para o modal de avaliação
 * Busca na coleção 'testesrespondidos' e cruza com 'estudos_de_caso' para gabarito.
 */
async function carregarRespostasDoTeste(
  identificador,
  tipoId,
  testeIdFallback,
  candidatoId
) {
  console.log("\n🔍 ========== CARREGANDO RESPOSTAS DO TESTE ==========");
  console.log("📋 [RESPOSTAS] Parâmetros:", {
    identificador,
    tipoId,
    testeIdFallback,
    candidatoId,
  });

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

    let snapshot = await getDocs(q);

    if (snapshot.empty && tipoId !== "tokenId") {
      // Tentativa de fallback apenas por candidato
      q = query(respostasRef, where("candidatoId", "==", candidatoId));
      snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docs = snapshot.docs.filter(
          (doc) => doc.data().testeId === testeIdFallback
        );
        if (docs.length > 0) snapshot = { docs, empty: false };
      }
    }

    if (snapshot.empty) {
      container.innerHTML = `<div class="alert alert-warning"><i class="fas fa-info-circle me-2"></i> Respostas não encontradas.</div>`;
      return;
    }

    const data = snapshot.docs[0].data();
    const testeId = data.testeId;
    let gabaritoPerguntas = [];

    // Busca Gabarito
    try {
      const gabaritoSnap = await getDoc(doc(db, "estudos_de_caso", testeId));
      if (gabaritoSnap.exists()) {
        gabaritoPerguntas = gabaritoSnap.data().perguntas || [];
      }
    } catch (e) {
      console.error("❌ Erro ao buscar gabarito:", e);
    }

    let respostasHtml = `<div class="respostas-teste">`;

    // Informações gerais
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

    // Renderiza as respostas (Map ou Array)
    if (
      data.respostas &&
      typeof data.respostas === "object" &&
      !Array.isArray(data.respostas)
    ) {
      const chaves = Object.keys(data.respostas);
      chaves.sort((a, b) => {
        const numA = parseInt(a.replace("resposta-", ""), 10);
        const numB = parseInt(b.replace("resposta-", ""), 10);
        return numA - numB;
      });

      respostasHtml += `<h6 class="mb-3">Respostas do Candidato:</h6>`;

      chaves.forEach((chave) => {
        const respostaTexto = data.respostas[chave];
        const indexQuestao = parseInt(chave.replace("resposta-", ""), 10);
        const perguntaData = gabaritoPerguntas[indexQuestao] || {};

        const enunciado =
          perguntaData.enunciado ||
          perguntaData.pergunta ||
          `Questão ${indexQuestao + 1}`;

        const gabaritoTexto =
          perguntaData.respostaCorreta ||
          perguntaData.gabarito ||
          "Gabarito não fornecido";

        const comentarios = perguntaData.comentarios || "N/A";

        respostasHtml += `<div class="resposta-item mb-3 p-3 border rounded">
          <p><strong>Questão ${indexQuestao + 1}:</strong> ${enunciado}</p>
          <p class="text-danger"><strong>Gabarito:</strong> ${gabaritoTexto}</p>
          <p><strong>Resposta do Candidato:</strong> ${
            respostaTexto || "Não respondida"
          }</p>
           <small class="text-muted d-block mt-2"><strong>Comentários:</strong> ${comentarios}</small>
        </div>`;
      });
    } else if (data.respostas && Array.isArray(data.respostas)) {
      data.respostas.forEach((resp, idx) => {
        respostasHtml += `<div class="resposta-item mb-3 p-3 border rounded">
          <p><strong>Questão ${idx + 1}:</strong> ${resp.pergunta || "N/A"}</p>
          <p><strong>Resposta:</strong> ${resp.resposta || "Não respondida"}</p>
        </div>`;
      });
    }

    respostasHtml += `</div>`;
    container.innerHTML = respostasHtml;
  } catch (error) {
    console.error("❌ Erro ao carregar respostas:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar respostas.</div>`;
  }
}

/**
 * ✅ [RESTAURADO] Carrega estatísticas (Híbrido + Auto-Correção de ID)
 */
async function carregarEstatisticasTestes(parametroId) {
  console.log("📊 [STATS] Iniciando cálculo. Parâmetro:", parametroId);

  const statsDiv = document.getElementById("avaliacao-teste-stats");
  if (!statsDiv) return;

  let candidatoId = parametroId;

  // Se o parâmetro for a lista de testes (objeto/array) ou inválido, tenta pegar ID do modal
  if (!candidatoId || typeof candidatoId !== "string") {
    const modal = document.getElementById("modal-avaliacao-teste");
    if (modal && modal.dataset.candidaturaId) {
      candidatoId = modal.dataset.candidaturaId;
    } else {
      statsDiv.innerHTML = `<p class="text-danger">Erro: ID do candidato não identificado.</p>`;
      return;
    }
  }

  try {
    const candidatoRef = doc(db, "candidaturas", candidatoId);
    const candidatoSnap = await getDoc(candidatoRef);

    if (!candidatoSnap.exists()) {
      statsDiv.innerHTML = "Candidato não encontrado.";
      return;
    }

    const dadosCandidato = candidatoSnap.data();
    const arrayTestes = dadosCandidato.testes_enviados || [];
    let totalTestes = arrayTestes.length;
    let totalAcertos = 0;
    let totalErros = 0;
    let totalQuestoesGeral = 0;

    if (totalTestes > 0) {
      // Itera para buscar notas salvas em 'testesRealizados' ou 'testesrespondidos'
      const promessasDeBusca = arrayTestes.map(async (testeItem) => {
        let tokenId = testeItem.id || testeItem.tokenId || testeItem.testeId;
        if (!tokenId) return null;

        try {
          // Tenta buscar no documento de resposta para pegar estatísticas calculadas
          const avaliacaoRef = doc(
            db,
            "testesRealizados",
            String(tokenId).trim(),
            "candidatos",
            String(candidatoId).trim()
          );
          const avaliacaoSnap = await getDoc(avaliacaoRef);

          if (avaliacaoSnap.exists()) {
            return avaliacaoSnap.data().estatisticasAvaliacao || null;
          }

          // Tenta na coleção 'testesrespondidos' (padrão novo)
          const respRef = doc(db, "testesrespondidos", String(tokenId).trim());
          const respSnap = await getDoc(respRef);
          if (respSnap.exists() && respSnap.data().estatisticas) {
            return respSnap.data().estatisticas;
          }
        } catch (err) {
          console.error(err);
        }
        return null;
      });

      const resultados = await Promise.all(promessasDeBusca);

      resultados.forEach((stats) => {
        if (stats) {
          const acertos = parseInt(stats.acertos) || 0;
          const erros = parseInt(stats.erros) || 0;
          const totalQ = parseInt(stats.totalQuestoes) || acertos + erros || 0;
          totalAcertos += acertos;
          totalErros += erros;
          totalQuestoesGeral += totalQ;
        }
      });
    }

    const taxaMedia =
      totalQuestoesGeral > 0
        ? ((totalAcertos / totalQuestoesGeral) * 100).toFixed(1)
        : "0.0";

    statsDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
        <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
          <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${totalTestes}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Testes Enviados</div>
        </div>
        <div style="text-align: center; padding: 15px; background: #f0fff4; border-radius: 8px; border: 1px solid #c3e6cb;">
          <div style="font-size: 24px; font-weight: bold; color: #28a745;">${totalAcertos}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Acertos</div>
        </div>
        <div style="text-align: center; padding: 15px; background: #fff5f5; border-radius: 8px; border: 1px solid #f5c6cb;">
          <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${totalErros}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Erros</div>
        </div>
        <div style="text-align: center; padding: 15px; background: #e7f1ff; border-radius: 8px; border: 1px solid #b8daff;">
          <div style="font-size: 24px; font-weight: bold; color: #007bff;">${taxaMedia}%</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Aproveitamento</div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Erro stats:", error);
    statsDiv.innerHTML = "Erro ao carregar estatísticas.";
  }
}

/**
 * ABRIR MODAL
 */
export async function abrirModalAvaliacaoTeste(candidatoId, dadosCandidato) {
  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const form = document.getElementById("form-avaliacao-teste");

  if (!modalAvaliacaoTeste || !form) {
    console.error(
      "❌ Elementos do modal de avaliação de teste não encontrados"
    );
    return;
  }

  // Carrega gestores
  await carregarEPopularGestores();

  // Dados do candidato
  dadosCandidatoAtual = dadosCandidato || { id: candidatoId };
  modalAvaliacaoTeste.dataset.candidaturaId = candidatoId;

  // Popula interface
  const nomeEl = document.getElementById("avaliacao-teste-nome-candidato");
  const statusEl = document.getElementById("avaliacao-teste-status-atual");

  if (nomeEl)
    nomeEl.textContent =
      dadosCandidato.nome_candidato ||
      dadosCandidato.nome_completo ||
      "Candidato";

  if (statusEl) {
    // ✅ CORREÇÃO: Usando formatador de status importado
    statusEl.textContent = formatarStatusLegivel(
      dadosCandidato.status_recrutamento
    );
  }

  // Lista de testes (Visualização + Botão Expandir)
  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");
  const listaTestes = dadosCandidato.testes_enviados || [];

  if (infoTestesEl) {
    if (listaTestes.length === 0) {
      infoTestesEl.innerHTML =
        '<p class="text-muted">Nenhum teste enviado.</p>';
    } else {
      let html = '<div class="testes-list">';
      listaTestes.forEach((t, idx) => {
        let badgeClass =
          t.status === "respondido" ? "bg-success" : "bg-warning";
        let statusTexto = t.status === "respondido" ? "Respondido" : "Pendente";

        // Tenta pegar a data de envio de data_envio ou criadoEm
        const dataEnvio = t.data_envio || t.criadoEm;
        const dataFormatada = dataEnvio
          ? new Date(dataEnvio.seconds * 1000).toLocaleDateString("pt-BR")
          : "N/A";

        html += `
                <div class="teste-card mb-3 p-3 border rounded">
                   <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${idx + 1}. ${
          t.nomeTeste || "Teste"
        }</strong>
                            <br><small class="text-muted">Enviado: ${dataFormatada}</small>
                        </div>
                        <span class="badge ${badgeClass}">${statusTexto}</span>
                   </div>
                   ${
                     t.status === "respondido"
                       ? `
                       <button type="button" class="btn-ver-respostas mt-2 action-button info small" 
                               data-teste-id="${t.tokenId}" data-tipo="tokenId" data-candidato-id="${candidatoId}">
                           <i class="fas fa-eye me-1"></i> Ver Respostas
                       </button>
                       <div id="respostas-container-${t.tokenId}" class="mt-3"></div>
                   `
                       : ""
                   }
                </div>
              `;
      });
      html += "</div>";
      infoTestesEl.innerHTML = html;

      // ✅ Listener para o botão de Ver Respostas (Chama a função restaurada)
      infoTestesEl.querySelectorAll(".btn-ver-respostas").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tid = e.currentTarget.dataset.testeId;
          const type = e.currentTarget.dataset.tipo;
          const cid = e.currentTarget.dataset.candidatoId;
          carregarRespostasDoTeste(tid, type, null, cid);
        });
      });
    }
  }

  // Carrega estatísticas (passando o ID corretamente)
  await carregarEstatisticasTestes(candidatoId);

  // Configura Botões de Fechar
  modalAvaliacaoTeste
    .querySelectorAll(
      ".close-modal-btn, .btn-secondary, [data-modal-id='modal-avaliacao-teste']"
    )
    .forEach((btn) => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener("click", (e) => {
        e.preventDefault();
        fecharModalAvaliacaoTeste();
      });
    });

  // Configura Radios
  const radios = form.querySelectorAll('input[name="resultadoteste"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });
  toggleCamposAvaliacaoTeste(); // Estado inicial

  // Configura Submit
  form.removeEventListener("submit", handleSubmitAvaliacaoTeste);
  form.addEventListener("submit", handleSubmitAvaliacaoTeste);

  modalAvaliacaoTeste.classList.add("is-visible");
}

/**
 * Handler para submit do formulário de avaliação
 */
async function handleSubmitAvaliacaoTeste(e) {
  e.preventDefault();

  const form = e.target;
  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const candidatoId = modalAvaliacaoTeste.dataset.candidaturaId;

  if (!candidatoId) return;

  const resultado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const observacoes =
    document.getElementById("avaliacao-teste-observacoes")?.value || "";
  const gestorId =
    document.getElementById("avaliacao-teste-gestor")?.value || null;

  if (!resultado) {
    window.showToast?.("Selecione um resultado.", "error");
    return;
  }
  if (resultado === "Reprovado" && !observacoes.trim()) {
    window.showToast?.("Informe o motivo da reprovação.", "error");
    return;
  }
  if (resultado === "Aprovado" && !gestorId) {
    window.showToast?.("Selecione um gestor.", "error");
    return;
  }

  const btnSubmit = document.getElementById("btn-registrar-avaliacao-teste");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  }

  try {
    const candidatoRef = doc(collection(db, "candidaturas"), candidatoId);
    const userName = await getCurrentUserName();

    const updateData = {
      avaliacaoTeste: {
        resultado: resultado,
        observacoes: observacoes,
        dataAvaliacao: new Date(),
        avaliadoPor: userName,
      },
    };

    // ✅ STATUS PADRONIZADO
    if (resultado === "Aprovado" && gestorId) {
      updateData.avaliacaoTeste.gestorDesignado = gestorId;
      updateData.status_recrutamento = "ENTREVISTA_GESTOR_PENDENTE"; // Avança
    } else if (resultado === "Reprovado") {
      updateData.status_recrutamento = "REPROVADO"; // Encerra

      updateData.rejeicao = {
        etapa: "Avaliação de Testes",
        justificativa: observacoes,
        data: new Date(),
      };
    }

    updateData.historico = arrayUnion({
      data: new Date(),
      acao: `Avaliação de Teste: ${resultado.toUpperCase()}. Obs: ${observacoes}`,
      usuario: userName,
    });

    await updateDoc(candidatoRef, updateData);

    window.showToast?.("Avaliação registrada!", "success");
    fecharModalAvaliacaoTeste();

    const state = window.getGlobalRecrutamentoState();
    if (state && state.handleTabClick) {
      const activeTab = document.querySelector(
        "#status-candidatura-tabs .tab-link.active"
      );
      if (activeTab) state.handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    window.showToast?.("Erro ao salvar: " + error.message, "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML =
        '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
    }
  }
}
