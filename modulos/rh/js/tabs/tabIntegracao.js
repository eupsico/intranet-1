/**
 * Arquivo: modulos/rh/js/tabs/tabIntegracao.js
 * Versão: 1.0.0 (Baseado em tabEntrevistas.js)
 * Descrição: Gerencia agendamento de integração e envio de treinamentos.
 */

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================
let dadosCandidatoAtual = null; // Para modais

// ============================================
// CLOUD FUNCTIONS (Reutilizadas)
// ============================================
const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_GERAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/gerarTokenTeste`; // Reutilizada para treinamentos

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarIntegracao(state) {
  console.log("🔹 Admissão(Integração): Iniciando renderização");

  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos para integração...</div>';

  try {
    // Busca candidatos prontos para integração
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_INTEGRACAO")
    );

    const snapshot = await getDocs(q);

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="integracao-treinamentos"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-chalkboard-teacher me-2"></i> 4. Integração e Treinamentos (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum candidato aguardando integração ou treinamentos.</p>';
      console.log("ℹ️ Admissão(Integração): Nenhum candidato encontrado");
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Agende a reunião de integração (Onboarding) e envie os links dos treinamentos iniciais para os novos colaboradores.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";
      const statusClass = "status-warning";

      // ==========================================================
      // ✅ CORREÇÃO DO OBJETO DE DADOS
      // ==========================================================
      const dadosCandidato = {
        id: candidatoId,
        // Usa 'nome_completo' para o modal genérico (admissao.js)
        nome_completo: cand.nome_candidato || cand.nome_completo || "Candidato",
        // Mantém 'nome_candidato' para compatibilidade interna desta aba
        nome_candidato:
          cand.nome_candidato || cand.nome_completo || "Candidato",

        email_pessoal: cand.email_candidato || cand.email_pessoal,
        email_novo: cand.admissaoinfo?.email_solicitado || "Não solicitado", // Corrigido: admissaoinfo (sem underscore)
        telefone_contato: cand.telefone_contato,
        vaga_titulo: cand.titulo_vaga_original || "Vaga não informada",
        status_recrutamento: statusAtual, // Garante que o status vá para o modal
      };

      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${dadosCandidato.nome_completo}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> ${statusAtual}
      	</span>
      </h4>
     	<p class="small-info" style="color: var(--cor-primaria);">
       <i class="fas fa-envelope"></i> Novo E-mail: ${dadosCandidato.email_novo}
      </p>
     </div>
     
     <div class="acoes-candidato">
     	<button 
      	class="action-button primary btn-agendar-integracao" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-primaria);">
      	<i class="fas fa-calendar-alt me-1"></i> Agendar Integração
     	</button>
     	<button 
      	class="action-button success btn-enviar-treinamento" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-sucesso);">
      	<i class="fas fa-video me-1"></i> Enviar Treinamentos
     	</button>
     	<button 
      	class="action-button secondary btn-ver-detalhes-admissao" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}">
      	<i class="fas fa-eye me-1"></i> Detalhes
     	</button>
     </div>
    </div>
   `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // --- REANEXAR LISTENERS ---

    // Agendar Integração
    document.querySelectorAll(".btn-agendar-integracao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAgendarIntegracao(
          candidatoId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // Enviar Treinamento
    document.querySelectorAll(".btn-enviar-treinamento").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarTreinamento(
          candidatoId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // Detalhes (com a função global correta)
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          // Passa "detalhes" como modo e o objeto completo
          window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
        }
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Integração): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista: ${error.message}</p>`;
  }
}
// ============================================
// LÓGICA DE AGENDAMENTO DE INTEGRAÇÃO
// ============================================

/**
 * Abre o modal de agendamento da Integração (Onboarding)
 * (Adaptação de abrirModalAgendamentoRH)
 */
function abrirModalAgendarIntegracao(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Admissão: Abrindo modal de agendamento de integração para ${candidatoId}`
  ); // IDs esperados no admissao.html (copie o modal-agendamento-rh e renomeie)
  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const form = document.getElementById("form-agendamento-integracao");

  if (!modalAgendamento || !form) {
    window.showToast?.(
      "Erro: Modal de Agendamento de Integração não encontrado no HTML.",
      "error"
    );
    console.error(
      "❌ Admissão: Elemento #modal-agendamento-integracao não encontrado"
    );
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamento.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A"; // IDs dos campos dentro do novo modal

  const nomeEl = document.getElementById("agendamento-int-nome-candidato");
  const statusEl = document.getElementById("agendamento-int-status-atual");
  const dataEl = document.getElementById("data-integracao-agendada");
  const horaEl = document.getElementById("hora-integracao-agendada"); // Preenche dados
  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual; // Busca agendamento salvo

  const agendamentoSalvo = dadosCandidato.integracao?.agendamento;
  if (dataEl) dataEl.value = agendamentoSalvo?.data || "";
  if (horaEl) horaEl.value = agendamentoSalvo?.hora || "";

  form.removeEventListener("submit", submeterAgendamentoIntegracao);
  form.addEventListener("submit", submeterAgendamentoIntegracao);

  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-integracao']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendarIntegracao);
      btn.addEventListener("click", fecharModalAgendarIntegracao);
    });

  modalAgendamento.classList.add("is-visible");
  console.log("✅ Admissão: Modal de agendamento de integração aberto");
}

/**
 * Fecha o modal de agendamento de integração
 */
function fecharModalAgendarIntegracao() {
  console.log("🔹 Admissão: Fechando modal de agendamento de integração");
  const modalOverlay = document.getElementById("modal-agendamento-integracao");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

/**
 * Submete o agendamento da Integração
 */
async function submeterAgendamentoIntegracao(e) {
  e.preventDefault();
  console.log("🔹 Admissão: Submetendo agendamento de integração");

  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const btnRegistrar = modalAgendamento.querySelector('button[type="submit"]');
  const candidaturaId = modalAgendamento?.dataset.candidaturaId;

  const { candidatosCollection, currentUserData } = getGlobalState();

  if (!candidaturaId || !btnRegistrar) return;

  const dataIntegracao = document.getElementById(
    "data-integracao-agendada"
  ).value;
  const horaIntegracao = document.getElementById(
    "hora-integracao-agendada"
  ).value;

  if (!dataIntegracao || !horaIntegracao) {
    window.showToast?.(
      "Por favor, preencha a data e hora da integração.",
      "error"
    );
    return;
  }

  btnRegistrar.disabled = true;
  btnRegistrar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...'; // Próxima etapa do fluxo

  const novoStatusCandidato = "AGUARDANDO_AVALIACAO_3MESES";

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      "integracao.agendamento": {
        data: dataIntegracao,
        hora: horaIntegracao,
        agendado_por_uid: currentUserData.id || "rh_system_user",
        data_agendamento: new Date(),
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Integração (Onboarding) agendada para ${dataIntegracao} às ${horaIntegracao}.`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast?.(`Integração agendada com sucesso!`, "success");
    console.log("✅ Admissão: Agendamento de integração salvo no Firestore"); // Envia WhatsApp

    if (dadosCandidatoAtual.telefone_contato) {
      setTimeout(() => {
        enviarMensagemWhatsAppIntegracao(
          dadosCandidatoAtual,
          dataIntegracao,
          horaIntegracao
        );
      }, 500);
    }

    fecharModalAgendarIntegracao();
    renderizarIntegracao(getGlobalState()); // Recarrega a aba
  } catch (error) {
    console.error(
      "❌ Admissão: Erro ao salvar agendamento de integração:",
      error
    );
    window.showToast?.(
      `Erro ao registrar o agendamento: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrar.disabled = false;
    btnRegistrar.innerHTML =
      '<i class="fas fa-calendar-alt me-2"></i> Agendar Integração';
  }
}

/**
 * Formata mensagem de WhatsApp para Integração
 */
function formatarMensagemWhatsAppIntegracao(
  candidato,
  dataIntegracao,
  horaIntegracao
) {
  const [ano, mes, dia] = dataIntegracao.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = horaIntegracao.split(":");
  const horaFormatada = `${horas}h${minutos}`;
  const nomeCandidato = candidato.nome_completo || "Colaborador(a)";

  const mensagem = `
🎉 *Bem-vindo(a) à EuPsico, ${nomeCandidato}!* 🎉

Estamos muito felizes em ter você conosco!

Seu *Onboarding (Reunião de Integração)* está agendado:

📅 *Data:* ${dataFormatada}
⏰ *Horário:* ${horaFormatada}

📍 *O que esperar:*
✅ Apresentação da equipe
✅ Alinhamento de cultura e valores
✅ Próximos passos e treinamentos

O link para a reunião (Google Meet/Zoom) será enviado para o seu novo e-mail corporativo.

Qualquer dúvida, fale conosco.

*Abraços,*
*Equipe de Recursos Humanos - EuPsico* 💙
 `.trim();

  return mensagem;
}

/**
 * Envia mensagem de WhatsApp com agendamento de integração
 */
function enviarMensagemWhatsAppIntegracao(
  candidato,
  dataIntegracao,
  horaIntegracao
) {
  if (!candidato.telefone_contato) {
    console.warn("⚠️ Admissão: Telefone não disponível para envio de WhatsApp");
    return;
  }
  try {
    const mensagem = formatarMensagemWhatsAppIntegracao(
      candidato,
      dataIntegracao,
      horaIntegracao
    );
    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;
    window.open(linkWhatsApp, "_blank");
    console.log("✅ Admissão: Link WhatsApp de Integração gerado");
  } catch (error) {
    console.error("❌ Admissão: Erro ao gerar mensagem WhatsApp:", error);
    window.showToast?.("Erro ao gerar link de WhatsApp.", "error");
  }
}

// ============================================
// LÓGICA DE ENVIO DE TREINAMENTOS
// ============================================

/**
 * Abre o modal para enviar treinamento
 * (Adaptação de abrirModalEnviarTeste)
 */
async function abrirModalEnviarTreinamento(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Admissão: Abrindo modal para enviar treinamento: ${candidatoId}`
  ); // IDs esperados no admissao.html (copie o modal-enviar-teste e renomeie)
  const modalEnviarTreinamento = document.getElementById(
    "modal-enviar-treinamento"
  );
  if (!modalEnviarTreinamento) {
    window.showToast?.(
      "Erro: Modal de Envio de Treinamento não encontrado no HTML.",
      "error"
    );
    console.error(
      "❌ Admissão: Elemento #modal-enviar-treinamento não encontrado"
    );
    return;
  }

  try {
    dadosCandidatoAtual = dadosCandidato;
    modalEnviarTreinamento.dataset.candidaturaId = candidatoId; // Preenche informações (IDs esperados no novo modal)

    const nomeEl = document.getElementById("treinamento-nome-candidato");
    const emailEl = document.getElementById("treinamento-email-candidato"); // E-mail novo
    const whatsappEl = document.getElementById(
      "treinamento-whatsapp-candidato"
    );

    if (nomeEl) nomeEl.textContent = dadosCandidato.nome_completo || "N/A";
    if (emailEl) emailEl.textContent = dadosCandidato.email_novo || "N/A";
    if (whatsappEl)
      whatsappEl.textContent = dadosCandidato.telefone_contato || "N/A"; // Carrega treinamentos disponíveis

    await carregarTreinamentosDisponiveis(); // Listeners de fechar

    document
      .querySelectorAll(`[data-modal-id='modal-enviar-treinamento']`)
      .forEach((btn) => {
        btn.removeEventListener("click", fecharModalEnviarTreinamento);
        btn.addEventListener("click", fecharModalEnviarTreinamento);
      });

    modalEnviarTreinamento.classList.add("is-visible");
    console.log("✅ Admissão: Modal de envio de treinamento aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de treinamento:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Fecha o modal de envio de treinamento
 */
function fecharModalEnviarTreinamento() {
  console.log("🔹 Admissão: Fechando modal de envio de treinamento");
  const modal = document.getElementById("modal-enviar-treinamento");
  if (modal) {
    modal.classList.remove("is-visible");
  }
}

/**
 * Carrega treinamentos disponíveis da coleção 'treinamentos'
 * (Baseado em carregarTestesDisponiveis)
 */
async function carregarTreinamentosDisponiveis() {
  // ID esperado no novo modal
  const selectTreinamento = document.getElementById("treinamento-selecionado");
  if (!selectTreinamento) {
    console.error("❌ Select de treinamentos não encontrado");
    return;
  }

  selectTreinamento.innerHTML =
    '<option value="">Carregando treinamentos...</option>';

  try {
    // Baseado em modulos/admin/js/gerenciar-treinamentos.js
    const treinamentosRef = collection(db, "treinamentos");
    const q = query(treinamentosRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      selectTreinamento.innerHTML =
        '<option value="">Nenhum treinamento disponível</option>';
      console.log("ℹ️ Nenhum treinamento disponível");
      return;
    }

    let htmlOptions = '<option value="">Selecione um treinamento...</option>';
    snapshot.forEach((docSnap) => {
      const treino = docSnap.data(); // Assumindo que a coleção 'treinamentos' tem 'titulo' e 'link'
      const prazoDias = treino.prazo_dias || "14";
      htmlOptions += `<option value="${docSnap.id}" 
    data-link="${treino.link || ""}" 
    data-tipo="${treino.tipo || "Geral"}"
    data-prazo="${prazoDias}"
  	  data-titulo="${treino.titulo}">
    ${treino.titulo} (${treino.tipo || "Geral"}) - Prazo: ${prazoDias}d
   </option>`;
    });

    selectTreinamento.innerHTML = htmlOptions;
    console.log(`✅ ${snapshot.size} treinamento(s) carregado(s)`);
  } catch (error) {
    console.error("❌ Erro ao carregar treinamentos:", error);
    selectTreinamento.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

/**
 * Envia o treinamento via WhatsApp
 */
async function enviarTreinamentoWhatsApp() {
  console.log("🔹 Admissão: Enviando treinamento via WhatsApp");
  const modal = document.getElementById("modal-enviar-treinamento");
  const candidatoId = modal?.dataset.candidaturaId;
  const selectTreinamento = document.getElementById("treinamento-selecionado");
  const option = selectTreinamento?.selectedOptions[0];
  const treinamentoId = option?.value;
  const treinamentoTitulo = option?.dataset.titulo;
  const prazoDias = option?.dataset.prazo || "14";
  const telefone = dadosCandidatoAtual?.telefone_contato;
  const mensagemPersonalizada = document.getElementById(
    "treinamento-mensagem"
  )?.value;
  const btnEnviar = document.getElementById("btn-enviar-treinamento-whatsapp"); // ID esperado

  if (!treinamentoId || !telefone) {
    window.showToast?.(
      "Selecione um treinamento e verifique o telefone.",
      "error"
    );
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando link...';

  try {
    // Chama a Cloud Function para gerar um token seguro
    const responseGerarToken = await fetch(CF_GERAR_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatoId: candidatoId,
        testeId: treinamentoId, // A CF usa 'testeId' genericamente
        tipo: "treinamento",
        prazoDias: parseInt(prazoDias),
      }),
    });

    const dataToken = await responseGerarToken.json();
    if (!dataToken.sucesso) {
      throw new Error(dataToken.erro || "Erro ao gerar token de treinamento");
    }

    const linkComToken = dataToken.urlTeste; // A CF retorna a URL pública

    const mensagemPadrao = `
📚 *Olá ${dadosCandidatoAtual.nome_completo}!*

Como parte da sua integração, aqui está o seu primeiro treinamento:

*Treinamento:* ${treinamentoTitulo}

🔗 *Acesse pelo link exclusivo abaixo:*
${linkComToken}

⏰ *Prazo para conclusão:* ${prazoDias} dias.

Acesse com seu novo e-mail corporativo.
Qualquer dúvida, fale com o RH.

*Bons estudos!*
*Equipe EuPsico* 💙
  `.trim();

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemFinal);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    window.open(linkWhatsApp, "_blank"); // Salva o envio (NÃO muda o status principal)

    await salvarEnvioTreinamento(
      candidatoId,
      treinamentoId,
      treinamentoTitulo,
      linkComToken,
      dataToken.tokenId
    );

    window.showToast?.("✅ Treinamento enviado! WhatsApp aberto", "success");
    fecharModalEnviarTreinamento(); // Não precisa recarregar a aba, pois o candidato continua nela
  } catch (error) {
    console.error("❌ Erro ao enviar treinamento:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
  }
}

/**
 * Salva o envio do treinamento no Firestore (histórico)
 * (Adaptação de salvarEnvioTeste)
 */
async function salvarEnvioTreinamento(
  candidatoId,
  treinamentoId,
  treinamentoTitulo,
  link,
  tokenId
) {
  console.log(`🔹 Salvando envio de treinamento: ${candidatoId}`);
  const { candidatosCollection, currentUserData } = getGlobalState();

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId); // Note: Não mudamos o status_recrutamento aqui.
    await updateDoc(candidatoRef, {
      treinamentos_enviados: arrayUnion({
        id: treinamentoId,
        titulo: treinamentoTitulo,
        tokenId: tokenId,
        link: link,
        data_envio: new Date(),
        enviado_por_uid: currentUserData.id || "rh_system_user",
        status: "enviado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Treinamento '${treinamentoTitulo}' enviado. Token: ${tokenId.substring(
          0,
          8
        )}...`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });
    console.log("✅ Envio de treinamento salvo no Firestore");
  } catch (error) {
    console.error("❌ Erro ao salvar envio de treinamento:", error);
    throw error;
  }
}

// ============================================
// LISTENERS GLOBAIS (para os novos modais)
// ============================================

// Listeners dos botões de Enviar Treinamento
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-enviar-treinamento-whatsapp") {
    enviarTreinamentoWhatsApp();
  } // Adicione 'salvar apenas' se necessário
});

// Listener para fechar modal de Treinamento
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-modal-id='modal-enviar-treinamento']")) {
    fecharModalEnviarTreinamento();
  }
});

// Listener para fechar modal de Agendamento
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-modal-id='modal-agendamento-integracao']")) {
    fecharModalAgendarIntegracao();
  }
});
