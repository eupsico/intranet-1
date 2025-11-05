/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 4.1.0 (Completo com Enviar Teste Funcional)
 * Data: 04/11/2025
 * Descrição: Gerencia a aba de Entrevistas, Avaliações e Envio de Testes
 */

import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================
let dadosCandidatoAtual = null;

// ============================================
// ELEMENTOS DO DOM
// ============================================
const modalEnviarTeste = document.getElementById("modal-enviar-teste");
const formEnviarTeste = document.getElementById("form-enviar-teste");

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Formata uma mensagem humanizada de agendamento para WhatsApp
 */
function formatarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  const [ano, mes, dia] = dataEntrevista.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = horaEntrevista.split(":");
  const horaFormatada = `${horas}h${minutos}`;
  const nomeCandidato = candidato.nome_completo || "Candidato(a)";

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
🌐 Site: [www.eupsico.com.br](https://www.eupsico.com.br)

Se tiver dúvidas, entre em contato conosco!

*Abraços,*
*Equipe de Recrutamento - EuPsico* 💙
  `.trim();

  return mensagem;
}

/**
 * Envia mensagem de WhatsApp com agendamento
 */
function enviarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  if (!candidato.telefone_contato) {
    console.warn(
      "⚠️ Entrevistas: Telefone não disponível para envio de WhatsApp"
    );
    return;
  }

  try {
    const mensagem = formatarMensagemWhatsApp(
      candidato,
      dataEntrevista,
      horaEntrevista
    );
    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

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

/**
 * Fecha o modal de envio de teste
 */
function fecharModalEnvioTeste() {
  console.log("🔹 Entrevistas: Fechando modal de envio de teste");
  if (modalEnviarTeste) {
    modalEnviarTeste.classList.remove("is-visible");
    // Limpa o formulário
    if (formEnviarTeste) {
      formEnviarTeste.reset();
    }
  }
}

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações
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
        "Testes Pendente (Enviado)",
      ])
    );

    const snapshot = await getDocs(q);

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

    let listaHtml = '<div class="candidatos-container">';

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
        /_/g,
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

      // ✅ LÓGICA DE EXIBIÇÃO DOS BOTÕES
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
              class="action-button primary btn-enviar-teste" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-vial me-1"></i> Enviar Teste
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

    // ✅ Listeners de Enviar Teste
    document.querySelectorAll(".btn-enviar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalEnviarTeste(candidatoId, dados);
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

  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);

  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  modalAgendamentoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de agendamento aberto");
};

/**
 * Submete o agendamento da Entrevista RH
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
// MODAIS - ENVIAR TESTE
// ============================================

/**
 * Abre o modal para enviar teste
 */
window.abrirModalEnviarTeste = async function (candidatoId, dadosCandidato) {
  console.log(
    `🔹 Entrevistas: Abrindo modal para enviar teste: ${candidatoId}`
  );

  try {
    dadosCandidatoAtual = dadosCandidato;

    if (modalEnviarTeste) {
      modalEnviarTeste.dataset.candidaturaId = candidatoId;
    }

    // Preenche informações do candidato
    const nomeEl = document.getElementById("teste-nome-candidato");
    const emailEl = document.getElementById("teste-email-candidato");
    const whatsappEl = document.getElementById("teste-whatsapp-candidato");

    if (nomeEl) nomeEl.textContent = dadosCandidato.nome_completo || "N/A";
    if (emailEl) emailEl.textContent = dadosCandidato.email_candidato || "N/A";
    if (whatsappEl)
      whatsappEl.textContent = dadosCandidato.telefone_contato || "N/A";

    // Define data/hora atual
    const agora = new Date();
    const dataFormatada = agora.toISOString().slice(0, 16);
    const dataInput = document.getElementById("teste-data-envio");
    if (dataInput) dataInput.value = dataFormatada;

    // Carrega testes disponíveis
    await carregarTestesDisponiveis();

    // Abre o modal
    if (modalEnviarTeste) {
      modalEnviarTeste.classList.add("is-visible");
    }
    console.log("✅ Entrevistas: Modal de envio de teste aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
};

/**
 * Carrega testes disponíveis da coleção estudos_de_caso
 */
async function carregarTestesDisponiveis() {
  const selectTeste = document.getElementById("teste-selecionado");
  if (!selectTeste) {
    console.error("❌ Select de testes não encontrado");
    return;
  }

  selectTeste.innerHTML = '<option value="">Carregando testes...</option>';

  try {
    const estudosRef = collection(db, "estudos_de_caso");
    const q = query(estudosRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      selectTeste.innerHTML =
        '<option value="">Nenhum teste disponível</option>';
      console.log("ℹ️ Nenhum teste disponível");
      return;
    }

    let htmlOptions = '<option value="">Selecione um teste...</option>';

    snapshot.forEach((docSnap) => {
      const teste = docSnap.data();
      htmlOptions += `<option value="${docSnap.id}" data-link="${
        teste.link_teste || ""
      }" data-tipo="${teste.tipo}">
      ${teste.titulo} (${teste.tipo.replace(/-/g, " ")})
    </option>`;
    });

    selectTeste.innerHTML = htmlOptions;
    console.log(`✅ ${snapshot.size} teste(s) carregado(s)`);
  } catch (error) {
    console.error("❌ Erro ao carregar testes:", error);
    selectTeste.innerHTML = '<option value="">Erro ao carregar testes</option>';
  }
}

/**
 * Atualiza o link quando muda a seleção de teste
 */
document.addEventListener("change", (e) => {
  if (e.target.id === "teste-selecionado") {
    const option = e.target.selectedOptions[0];
    const linkInput = document.getElementById("teste-link");
    const linkTeste = option.getAttribute("data-link");

    if (linkInput) {
      if (linkTeste) {
        linkInput.value = linkTeste;
      } else {
        linkInput.value = `https://intranet.eupsico.org.br/public/avaliacao-publica.html?id=${option.value}`;
      }
      console.log(`✅ Link atualizado: ${linkInput.value}`);
    }
  }
});

/**
 * Envia teste via WhatsApp
 */
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-enviar-teste-whatsapp") {
    enviarTesteWhatsApp();
  }
});

async function enviarTesteWhatsApp() {
  console.log("🔹 Entrevistas: Enviando teste via WhatsApp");

  const candidatoId = modalEnviarTeste?.dataset.candidaturaId;
  const testeId = document.getElementById("teste-selecionado")?.value;
  const linkTeste = document.getElementById("teste-link")?.value;
  const telefone = dadosCandidatoAtual?.telefone_contato;
  const mensagemPersonalizada =
    document.getElementById("teste-mensagem")?.value;

  if (!testeId || !linkTeste || !telefone) {
    window.showToast?.("Preencha todos os campos obrigatórios", "error");
    return;
  }

  try {
    const nomeCandidato = dadosCandidatoAtual.nome_completo || "Candidato(a)";
    const nomeTesteElement = document.querySelector(
      `#teste-selecionado option[value="${testeId}"]`
    );
    const nomeTeste = nomeTesteElement?.textContent || "Teste";

    const mensagemPadrao = `
🎯 *Olá ${nomeCandidato}!* 🎯

Chegou a hora de você realizar o próximo teste da sua avaliação! 

📋 *Teste:* ${nomeTeste}

🔗 *Clique no link abaixo para realizar o teste:*
${linkTeste}

⏱️ *Tempo estimado:* 30-45 minutos

📌 *Instruções:*
✅ Acesse o link acima
✅ Leia as instruções com atenção
✅ Responda com sinceridade
✅ Nós avaliaremos suas respostas

Se tiver dúvidas, não hesite em nos contactar!

*Boa sorte!* 🍀
*Equipe de Recrutamento - EuPsico* 💙
    `.trim();

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemFinal);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    // Salva no Firestore
    await salvarEnvioTeste(candidatoId, testeId, linkTeste);

    // Abre WhatsApp
    window.open(linkWhatsApp, "_blank");

    window.showToast?.("Teste enviado com sucesso! WhatsApp aberto", "success");
    console.log("✅ Teste enviado via WhatsApp");
  } catch (error) {
    console.error("❌ Erro ao enviar teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Salva o envio do teste no Firestore
 */
async function salvarEnvioTeste(candidatoId, testeId, linkTeste) {
  console.log(`🔹 Salvando envio de teste: ${candidatoId}`);

  const state = getGlobalState();
  const { candidatosCollection, currentUserData } = state;

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);

    await updateDoc(candidatoRef, {
      status_recrutamento: "Testes Pendente (Enviado)",
      testes_enviados: arrayUnion({
        id: testeId,
        link: linkTeste,
        data_envio: new Date(),
        enviado_por: currentUserData.id || "rh_system_user",
        status: "enviado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Teste enviado via WhatsApp. Link: ${linkTeste}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    console.log("✅ Envio de teste salvo no Firestore");
  } catch (error) {
    console.error("❌ Erro ao salvar envio:", error);
    throw error;
  }
}

/**
 * Listener para botão "Salvar Apenas"
 */
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-salvar-teste-apenas") {
    salvarTesteApenas();
  }
});

async function salvarTesteApenas() {
  console.log("🔹 Entrevistas: Salvando teste (sem WhatsApp)");

  const candidatoId = modalEnviarTeste?.dataset.candidaturaId;
  const testeId = document.getElementById("teste-selecionado")?.value;
  const linkTeste = document.getElementById("teste-link")?.value;

  if (!testeId || !linkTeste) {
    window.showToast?.("Selecione um teste", "error");
    return;
  }

  try {
    await salvarEnvioTeste(candidatoId, testeId, linkTeste);
    window.showToast?.("Teste salvo com sucesso!", "success");

    fecharModalEnvioTeste();
    const state = getGlobalState();
    const { handleTabClick, statusCandidaturaTabs } = state;
    const activeTab = statusCandidaturaTabs?.querySelector(".tab-link.active");
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Listeners para fechar modal
 */
document.addEventListener("click", (e) => {
  if (
    e.target.classList.contains("fechar-modal-teste") ||
    e.target.parentElement?.classList.contains("fechar-modal-teste")
  ) {
    fecharModalEnvioTeste();
  }
});

// Fechar ao clicar no overlay
if (modalEnviarTeste) {
  modalEnviarTeste.addEventListener("click", (e) => {
    if (e.target === modalEnviarTeste) {
      fecharModalEnvioTeste();
    }
  });
}

// ============================================
// MODAIS - AVALIAÇÃO
// ============================================

/**
 * Abre o modal de avaliação da Entrevista RH
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

  if (form) form.reset();

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

  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);

  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  modalAvaliacaoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de avaliação aberto");
};

/**
 * Submete a avaliação da Entrevista RH
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

  const dadosAvaliacao = {
    resultado: resultado,
    data_avaliacao: new Date(),
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
