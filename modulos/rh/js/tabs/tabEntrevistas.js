/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 3.0.0 (Revisão Completa com Mensagem WhatsApp Humanizada)
 * Data: 04/11/2025
 * Descrição: Gerencia a aba de Entrevistas e Avaliações RH
 */

import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================
let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Formata uma mensagem humanizada de agendamento para WhatsApp
 * @param {Object} candidato - Dados do candidato
 * @param {string} dataEntrevista - Data formatada (YYYY-MM-DD)
 * @param {string} horaEntrevista - Hora formatada (HH:mm)
 * @returns {string} Mensagem formatada para WhatsApp
 */
function formatarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  // Converte data YYYY-MM-DD para formato legível DD/MM/YYYY
  const [ano, mes, dia] = dataEntrevista.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;

  // Converte hora HH:mm para formato com descrição
  const [horas, minutos] = horaEntrevista.split(":");
  const horaFormatada = `${horas}h${minutos}`;

  const nomeCandidato = candidato.nome_completo || "Candidato(a)";

  // Mensagem humanizada e atrativa
  const mensagem = `
🎉 *Parabéns ${nomeCandidato}!* 🎉

Sua candidatura foi *aprovada na Triagem* e você foi *selecionado(a) para a próxima etapa!*

📅 *Data da Entrevista com RH:*
${dataFormatada}

⏰ *Horário:*
${horaFormatada}

📍 *Próximos Passos:*
✅ Confirme sua presença nesta data
✅ Prepare-se para conversar sobre seu perfil
✅ Tenha seus documentos à mão

Estamos ansiosos para conhecê-lo(a) melhor! 

🌐 *Siga a EuPsico nas redes sociais:*
📱 Instagram: @eupsico
👔 LinkedIn: /company/eupsico
🌐 Site: www.eupsico.com.br

Se tiver dúvidas, entre em contato conosco!

*Abraços,*
*Equipe de Recrutamento - EuPsico* 💙
  `.trim();

  return mensagem;
}

/**
 * Envia mensagem de WhatsApp com agendamento
 * @param {Object} candidato - Dados do candidato
 * @param {string} dataEntrevista - Data da entrevista
 * @param {string} horaEntrevista - Hora da entrevista
 */
function enviarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  if (!candidato.telefone_contato) {
    console.warn(
      "⚠️ Entrevistas: Telefone não disponível para envio de WhatsApp"
    );
    return;
  }

  try {
    // Formata a mensagem
    const mensagem = formatarMensagemWhatsApp(
      candidato,
      dataEntrevista,
      horaEntrevista
    );

    // Codifica a mensagem para URL
    const mensagemCodificada = encodeURIComponent(mensagem);

    // Limpa o telefone (remove tudo que não é número)
    const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");

    // Cria o link do WhatsApp
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    // Abre em nova aba
    window.open(linkWhatsApp, "_blank");

    console.log("✅ Entrevistas: Link WhatsApp gerado com sucesso");
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao gerar mensagem WhatsApp:", error);
    window.showToast?.(
      "Erro ao gerar link de WhatsApp. Tente novamente.",
      "error"
    );
  }
}

/**
 * Fecha o modal de agendamento
 */
function fecharModalAgendamento() {
  console.log("🔹 Entrevistas: Fechando modal de agendamento");
  const modalOverlay = document.getElementById("modal-agendamento-rh");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

/**
 * Fecha o modal de avaliação
 */
function fecharModalAvaliacao() {
  console.log("🔹 Entrevistas: Fechando modal de avaliação");
  const modalOverlay = document.getElementById("modal-avaliacao-rh");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações
 * @param {Object} state - Estado global do módulo
 */
export async function renderizarEntrevistas(state) {
  console.log("🔹 Entrevistas: Iniciando renderização");

  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    console.log("ℹ️ Entrevistas: Vaga não selecionada");
    return;
  }

  conteudoRecrutamento.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Triagem Aprovada (Entrevista Pendente)",
        "Entrevista RH Aprovada (Testes Pendente)",
        "Testes Pendente",
      ])
    );

    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="entrevistas"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-comments me-2"></i> 3. Entrevistas e Avaliações (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhum candidato na fase de Entrevistas/Avaliações.</p>';
      console.log("ℹ️ Entrevistas: Nenhum candidato encontrado");
      return;
    }

    let listaHtml = `
    
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "info";
      if (statusAtual.includes("Aprovada")) {
        corStatus = "success";
      } else if (statusAtual.includes("Testes")) {
        corStatus = "warning";
      }

      const telefone = cand.telefone_contato
        ? cand.telefone_contato.replace(/\D/g, "")
        : "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}`
        : "#";

      listaHtml += `
        <div class="card card-candidato-triagem" data-id="${candidatoId}">
          <div class="info-primaria">
            <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
            <p>Status: <span class="status-badge status-${corStatus}">${statusAtual.replace(
        "_",
        " "
      )}</span></p>
          </div>
          
          <div class="info-contato">
            <a href="${linkWhatsApp}" target="_blank" class="whatsapp" ${
        !telefone ? "disabled" : ""
      }>
              <i class="fab fa-whatsapp me-1"></i> ${
                cand.telefone_contato || "N/A (Sem WhatsApp)"
              }
            </a>
          </div>
          
          <div class="acoes-candidato">
            <button 
              class="action-button info btn-detalhes-entrevista" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-info-circle me-1"></i> Detalhes
            </button>
      `;

      // Lógica de exibição dos botões separados
      if (statusAtual.includes("Entrevista Pendente")) {
        listaHtml += `
            <button 
              class="action-button secondary btn-agendar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-calendar-alt me-1"></i> Agendar RH
            </button>
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-edit me-1"></i> Avaliar RH
            </button>
        `;
      } else if (statusAtual.includes("Testes Pendente")) {
        listaHtml += `
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-vial me-1"></i> Avaliar Testes
            </button>
        `;
      } else {
        listaHtml += `
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-eye me-1"></i> Ver Avaliação
            </button>
        `;
      }

      listaHtml += `
          </div>
        </div>
      `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // Anexar listeners
    console.log("🔹 Entrevistas: Anexando listeners aos botões");

    // Listeners de Detalhes
    document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(candidatoId, "detalhes", dados);
      });
    });

    // Listeners de Agendar
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAgendamentoRH(candidatoId, dados);
      });
    });

    // Listeners de Avaliar
    document.querySelectorAll(".btn-avaliar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoRH(candidatoId, dados);
      });
    });

    console.log("✅ Entrevistas: Renderização concluída");
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao renderizar:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-error">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

// ============================================
// MODAIS - AGENDAMENTO
// ============================================

/**
 * Abre o modal de agendamento da Entrevista RH
 * @param {string} candidatoId - ID do candidato
 * @param {Object} dadosCandidato - Dados do candidato
 */
window.abrirModalAgendamentoRH = function (candidatoId, dadosCandidato) {
  console.log(
    `🔹 Entrevistas: Abrindo modal de agendamento para ${candidatoId}`
  );

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");

  if (!modalAgendamentoRH || !form) {
    window.showToast?.("Erro: Modal de Agendamento não encontrado.", "error");
    console.error(
      "❌ Entrevistas: Elemento modal-agendamento-rh não encontrado"
    );
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.prerequisitos_atendidos ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const dataAgendada = dadosCandidato.entrevista_rh?.agendamento?.data || "";
  const horaAgendada = dadosCandidato.entrevista_rh?.agendamento?.hora || "";

  // Preenche os campos
  const nomeEl = document.getElementById("agendamento-rh-nome-candidato");
  const statusEl = document.getElementById("agendamento-rh-status-atual");
  const resumoEl = document.getElementById("agendamento-rh-resumo-triagem");
  const dataEl = document.getElementById("data-entrevista-agendada");
  const horaEl = document.getElementById("hora-entrevista-agendada");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;
  if (dataEl) dataEl.value = dataAgendada;
  if (horaEl) horaEl.value = horaAgendada;

  // Anexa listener de submit
  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);

  // Anexa listeners de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  // Exibe o modal
  modalAgendamentoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de agendamento aberto");
};

/**
 * Submete o agendamento da Entrevista RH
 * @param {Event} e - Evento de submit
 */
async function submeterAgendamentoRH(e) {
  e.preventDefault();

  console.log("🔹 Entrevistas: Submetendo agendamento");

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const btnRegistrarAgendamento = document.getElementById(
    "btn-registrar-agendamento-rh"
  );

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAgendamentoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAgendamento) return;

  const form = document.getElementById("form-agendamento-entrevista-rh");
  if (!form) return;

  const dataEntrevista = form.querySelector("#data-entrevista-agendada").value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada").value;

  if (!dataEntrevista || !horaEntrevista) {
    window.showToast?.(
      "Por favor, preencha a data e hora da entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAgendamento.disabled = true;
  btnRegistrarAgendamento.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const statusAtual =
    dadosCandidatoAtual.status_recrutamento ||
    "Triagem Aprovada (Entrevista Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    const updateData = {
      "entrevista_rh.agendamento": {
        data: dataEntrevista,
        hora: horaEntrevista,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}. Status: ${statusAtual}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    };

    await updateDoc(candidaturaRef, updateData);

    window.showToast?.(
      `Entrevista RH agendada com sucesso para ${dataEntrevista} às ${horaEntrevista}.`,
      "success"
    );
    console.log("✅ Entrevistas: Agendamento salvo no Firestore");

    // Envia mensagem de WhatsApp humanizada
    if (dadosCandidatoAtual.telefone_contato) {
      setTimeout(() => {
        enviarMensagemWhatsApp(
          dadosCandidatoAtual,
          dataEntrevista,
          horaEntrevista
        );
      }, 500);
    }

    fecharModalAgendamento();
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao salvar agendamento:", error);
    window.showToast?.(
      `Erro ao registrar o agendamento: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAgendamento.disabled = false;
    btnRegistrarAgendamento.innerHTML =
      '<i class="fas fa-calendar-alt me-2"></i> Agendar Entrevista';
  }
}

// ============================================
// MODAIS - AVALIAÇÃO
// ============================================

/**
 * Abre o modal de avaliação da Entrevista RH
 * @param {string} candidatoId - ID do candidato
 * @param {Object} dadosCandidato - Dados do candidato
 */
window.abrirModalAvaliacaoRH = function (candidatoId, dadosCandidato) {
  console.log(`🔹 Entrevistas: Abrindo modal de avaliação para ${candidatoId}`);

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const form = document.getElementById("form-avaliacao-entrevista-rh");

  if (!modalAvaliacaoRH || !form) {
    window.showToast?.("Erro: Modal de Avaliação não encontrado.", "error");
    console.error("❌ Entrevistas: Elemento modal-avaliacao-rh não encontrado");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.prerequisitos_atendidos ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const linkCurriculo = dadosCandidato.link_curriculo_drive || "#";

  // Preenche informações do candidato
  const nomeEl = document.getElementById("entrevista-rh-nome-candidato");
  const statusEl = document.getElementById("entrevista-rh-status-atual");
  const resumoEl = document.getElementById("entrevista-rh-resumo-triagem");
  const btnVerCurriculo = document.getElementById(
    "entrevista-rh-ver-curriculo"
  );

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  if (btnVerCurriculo) {
    btnVerCurriculo.href = linkCurriculo;
    btnVerCurriculo.disabled = !linkCurriculo || linkCurriculo === "#";
  }

  // Reseta o formulário
  if (form) form.reset();

  // Preenche com dados existentes se houver
  const avaliacaoExistente = dadosCandidato.entrevista_rh;
  if (avaliacaoExistente) {
    if (form) {
      form.querySelector("#nota-motivacao").value =
        avaliacaoExistente.notas?.motivacao || "";
      form.querySelector("#nota-aderencia").value =
        avaliacaoExistente.notas?.aderencia || "";
      form.querySelector("#nota-comunicacao").value =
        avaliacaoExistente.notas?.comunicacao || "";
      form.querySelector("#pontos-fortes").value =
        avaliacaoExistente.pontos_fortes || "";
      form.querySelector("#pontos-atencao").value =
        avaliacaoExistente.pontos_atencao || "";

      if (avaliacaoExistente.resultado) {
        const radio = form.querySelector(
          `input[name="resultado_entrevista"][value="${avaliacaoExistente.resultado}"]`
        );
        if (radio) radio.checked = true;
      }
    }
  }

  // Anexa listener de submit
  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);

  // Anexa listeners de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  // Exibe o modal
  modalAvaliacaoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de avaliação aberto");
};

/**
 * Submete a avaliação da Entrevista RH
 * @param {Event} e - Evento de submit
 */
/**
 * Submete a avaliação da Entrevista RH
 * @param {Event} e - Evento de submit
 */
/**
 * Submete a avaliação da Entrevista RH
 * @param {Event} e - Evento de submit
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

  console.log("🔹 Entrevistas: Submetendo avaliação");

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-entrevista-rh"
  );

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAvaliacaoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione o Resultado da Entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAvaliacao.disabled = true;
  btnRegistrarAvaliacao.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado
    ? "Entrevista RH Aprovada (Testes Pendente)"
    : "Rejeitado (Comunicação Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  // ✅ CORRIGIDO: Separar campos aninhados do root
  const dadosAvaliacao = {
    resultado: resultado,
    data_avaliacao: new Date(), // ✅ Usa new Date() em vez de serverTimestamp()
    avaliador_uid: currentUserData.id || "rh_system_user",
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontos_fortes: pontosFortes,
    pontos_atencao: pontosAtencao,
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    // ✅ CORRIGIDO: Estrutura correta para updateDoc
    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: {
        ...(dadosCandidatoAtual.entrevista_rh || {}),
        ...dadosAvaliacao,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Entrevista RH: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast?.(
      `Avaliação de Entrevista RH registrada. Status: ${novoStatusCandidato}`,
      "success"
    );
    console.log("✅ Entrevistas: Avaliação salva no Firestore");

    fecharModalAvaliacao();
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao salvar avaliação:", error);
    window.showToast?.(
      `Erro ao registrar a decisão: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
  }
}
