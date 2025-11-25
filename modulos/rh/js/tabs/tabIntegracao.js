/**
 * Arquivo: modulos/rh/js/tabs/tabIntegracao.js
 * Versão: 1.2.0 (Completo: Agendamento + Mensagem WhatsApp + Avaliação)
 * Descrição: Gerencia agendamento, avaliação de integração e envio de treinamentos.
 */

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
let dadosUsuarioAtual = null; // Para modais

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
  console.log(
    "🔹 Admissão(Integração): Iniciando renderização (Fluxo Usuários)"
  );

  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores para integração...</div>';

  try {
    const usuariosCollection = collection(db, "usuarios");
    // Busca candidatos que precisam agendar OU que já agendaram e precisam ser avaliados
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "AGUARDANDO_INTEGRACAO",
        "INTEGRACAO_AGENDADA",
      ])
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
        '<p class="alert alert-info">Nenhum colaborador aguardando integração.</p>';
      console.log("ℹ️ Admissão(Integração): Nenhum candidato encontrado");
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Agende a reunião de integração (Onboarding), envie os links dos treinamentos e avalie a conclusão da integração.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.uid; // Este é o UID do usuário
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-warning";
      let actionButtonHtml = "";

      // --- LÓGICA DO BOTÃO PRINCIPAL ---
      if (statusAtual === "INTEGRACAO_AGENDADA") {
        statusClass = "status-info"; // Azul para indicar agendado
        // Botão de AVALIAR (Concluir)
        actionButtonHtml = `
        <button 
          class="action-button primary btn-avaliar-integracao" 
          data-id="${userId}"
          data-dados="${encodeURIComponent(
            JSON.stringify({
              id: userId,
              nome: user.nome,
              status_admissao: statusAtual,
            })
          )}"
          style="background: #6f42c1; border-color: #6f42c1;">
          <i class="fas fa-check-double me-1"></i> Avaliar Integração
        </button>`;
      } else {
        // Botão de AGENDAR
        // Passamos telefone_contato no JSON para usar no envio do WhatsApp
        actionButtonHtml = `
        <button 
          class="action-button primary btn-agendar-integracao" 
          data-id="${userId}"
          data-dados="${encodeURIComponent(
            JSON.stringify({
              id: userId,
              nome: user.nome,
              status_admissao: statusAtual,
              telefone: user.contato,
            })
          )}"
          style="background: var(--cor-primaria);">
          <i class="fas fa-calendar-alt me-1"></i> Agendar Integração
        </button>`;
      }

      const dadosUsuario = {
        id: userId,
        nome_completo: user.nome || "Usuário Sem Nome",
        email_novo: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        vaga_titulo: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual, // Mantém nome da prop para compatibilidade com modal de detalhes
        // Outros campos úteis para o modal de detalhes
        cpf: user.cpf || "",
        rg: user.rg || "",
        endereco: user.endereco || "",
      };

      const dadosCodificados = encodeURIComponent(JSON.stringify(dadosUsuario));

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${userId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${dadosUsuario.nome_completo}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> ${statusAtual.replace(/_/g, " ")}
      	</span>
      </h4>
     	<p class="small-info" style="color: var(--cor-primaria);">
       <i class="fas fa-envelope"></i> E-mail: ${dadosUsuario.email_novo}
      </p>
     </div>
     
     <div class="acoes-candidato">
     	${actionButtonHtml}
     	
     	<button 
      	class="action-button success btn-enviar-treinamento" 
      	data-id="${userId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-sucesso);">
      	<i class="fas fa-video me-1"></i> Enviar Treinamentos
     	</button>
     	
     	<button 
      	class="action-button secondary btn-ver-detalhes-admissao" 
      	data-id="${userId}"
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

    // 1. Agendar Integração
    document.querySelectorAll(".btn-agendar-integracao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAgendarIntegracao(
          userId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // 2. Avaliar Integração (Novo)
    document.querySelectorAll(".btn-avaliar-integracao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAvaliarIntegracao(
          userId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // 3. Enviar Treinamento
    document.querySelectorAll(".btn-enviar-treinamento").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarTreinamento(
          userId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // 4. Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosUsuario = JSON.parse(decodeURIComponent(dadosCodificados));
          window.abrirModalCandidato(userId, "detalhes", dadosUsuario);
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

function abrirModalAgendarIntegracao(userId, dadosUsuario) {
  console.log(`🔹 Admissão: Abrindo modal de agendamento para ${userId}`);

  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const form = document.getElementById("form-agendamento-integracao");

  if (!modalAgendamento || !form) {
    alert("Erro: Modal de agendamento não encontrado no HTML.");
    return;
  }

  dadosUsuarioAtual = dadosUsuario;
  modalAgendamento.dataset.usuarioId = userId;

  const nomeEl = document.getElementById("agendamento-int-nome-candidato");
  const statusEl = document.getElementById("agendamento-int-status-atual");

  if (nomeEl) nomeEl.textContent = dadosUsuario.nome_completo;
  if (statusEl) statusEl.textContent = dadosUsuario.status_recrutamento;

  // Limpa campos
  const dataEl = document.getElementById("data-integracao-agendada");
  const horaEl = document.getElementById("hora-integracao-agendada");
  if (dataEl) dataEl.value = "";
  if (horaEl) horaEl.value = "";

  form.removeEventListener("submit", submeterAgendamentoIntegracao);
  form.addEventListener("submit", submeterAgendamentoIntegracao);

  // Listeners de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-integracao']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendarIntegracao);
      btn.addEventListener("click", fecharModalAgendarIntegracao);
    });

  modalAgendamento.classList.add("is-visible");
}

function fecharModalAgendarIntegracao() {
  const modalOverlay = document.getElementById("modal-agendamento-integracao");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

async function submeterAgendamentoIntegracao(e) {
  e.preventDefault();
  console.log("🔹 Admissão: Submetendo agendamento");

  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const btnRegistrar = modalAgendamento.querySelector('button[type="submit"]');
  const usuarioId = modalAgendamento?.dataset.usuarioId;
  const { currentUserData } = getGlobalState();

  const dataIntegracao = document.getElementById(
    "data-integracao-agendada"
  ).value;
  const horaIntegracao = document.getElementById(
    "hora-integracao-agendada"
  ).value;

  if (!dataIntegracao || !horaIntegracao) {
    window.showToast?.("Preencha a data e hora.", "error");
    return;
  }

  btnRegistrar.disabled = true;
  btnRegistrar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  // ✅ Status intermediário: INTEGRACAO_AGENDADA (para mudar o botão)
  const novoStatus = "INTEGRACAO_AGENDADA";

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    await updateDoc(usuarioRef, {
      status_admissao: novoStatus,
      "integracao.agendamento": {
        data: dataIntegracao,
        hora: horaIntegracao,
        agendado_por_uid: currentUserData.uid || "rh_system_user",
        data_agendamento: new Date(),
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Integração agendada para ${dataIntegracao} às ${horaIntegracao}. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast?.(`Agendado com sucesso!`, "success");

    // Envia WhatsApp se houver telefone
    if (dadosUsuarioAtual.telefone_contato) {
      setTimeout(() => {
        enviarMensagemWhatsAppIntegracao(
          dadosUsuarioAtual,
          dataIntegracao,
          horaIntegracao
        );
      }, 500);
    }

    fecharModalAgendarIntegracao();
    renderizarIntegracao(getGlobalState());
  } catch (error) {
    console.error("❌ Erro ao agendar:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
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
    console.warn("⚠️ Sem telefone para WhatsApp");
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
  } catch (error) {
    console.error("❌ Erro ao gerar WhatsApp:", error);
  }
}

// ============================================
// ✅ NOVA LÓGICA: AVALIAÇÃO DA INTEGRAÇÃO
// ============================================

function abrirModalAvaliarIntegracao(usuarioId, dadosCandidato) {
  const modal = document.getElementById("modal-avaliacao-integracao");
  const form = document.getElementById("form-avaliacao-integracao");

  if (!modal || !form) {
    alert("Erro: Modal de avaliação não encontrado no HTML (admissao.html).");
    return;
  }

  dadosUsuarioAtual = dadosCandidato;
  modal.dataset.usuarioId = userId;

  const nomeEl = document.getElementById("avaliacao-int-nome-candidato");
  const statusEl = document.getElementById("avaliacao-int-status-atual");

  if (nomeEl) nomeEl.textContent = dadosCandidato.nome_completo || "Candidato";
  if (statusEl) statusEl.textContent = dadosCandidato.status_recrutamento;

  form.reset();
  form.removeEventListener("submit", submeterAvaliacaoIntegracao);
  form.addEventListener("submit", submeterAvaliacaoIntegracao);

  // Listeners de fechar (importante)
  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => modal.classList.remove("is-visible");
  });

  modal.classList.add("is-visible");
}

async function submeterAvaliacaoIntegracao(e) {
  e.preventDefault();
  const modal = document.getElementById("modal-avaliacao-integracao");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const candidaturaId = modal.dataset.candidaturaId;
  const { candidatosCollection, currentUserData } = getGlobalState();

  const realizou = document.getElementById("integracao-realizada").value;
  const observacoes = document.getElementById("integracao-observacoes").value;

  if (realizou !== "sim") {
    alert("Para concluir, a integração deve ter sido realizada.");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = "Salvando...";

  // ✅ AQUI SIM: Muda o status para mover para a próxima aba
  const novoStatus = "AGUARDANDO_AVALIACAO_3MESES";

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatus,
      "integracao.conclusao": {
        realizada: true,
        observacoes: observacoes,
        concluido_em: new Date(),
        responsavel_uid: currentUserData.id || "rh_user",
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Integração concluída e avaliada. Movido para Avaliação 3 Meses.`,
        usuario: currentUserData.id || "rh_user",
      }),
    });

    window.showToast?.("Integração concluída com sucesso!", "success");

    modal.classList.remove("is-visible");
    renderizarIntegracao(getGlobalState());
  } catch (error) {
    console.error("Erro ao avaliar:", error);
    alert("Erro ao salvar avaliação.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Concluir Integração';
  }
}

// ============================================
// LÓGICA DE ENVIO DE TREINAMENTOS (Mantida)
// ============================================

async function abrirModalEnviarTreinamento(usuarioId, dadosCandidato) {
  const modalEnviarTreinamento = document.getElementById(
    "modal-enviar-treinamento"
  );
  if (!modalEnviarTreinamento) return;

  try {
    dadosUsuarioAtual = dadosCandidato;
    modalEnviarTreinamento.dataset.candidaturaId = usuarioId;

    const nomeEl = document.getElementById("treinamento-nome-candidato");
    const emailEl = document.getElementById("treinamento-email-candidato");
    const whatsappEl = document.getElementById(
      "treinamento-whatsapp-candidato"
    );

    if (nomeEl) nomeEl.textContent = dadosCandidato.nome_completo || "N/A";
    if (emailEl) emailEl.textContent = dadosCandidato.email_novo || "N/A";
    if (whatsappEl)
      whatsappEl.textContent = dadosCandidato.telefone_contato || "N/A";

    await carregarTreinamentosDisponiveis();

    document
      .querySelectorAll(`[data-modal-id='modal-enviar-treinamento']`)
      .forEach((btn) => {
        btn.removeEventListener("click", fecharModalEnviarTreinamento);
        btn.addEventListener("click", fecharModalEnviarTreinamento);
      });

    modalEnviarTreinamento.classList.add("is-visible");
  } catch (error) {
    console.error("Erro modal treinamento:", error);
  }
}

function fecharModalEnviarTreinamento() {
  const modal = document.getElementById("modal-enviar-treinamento");
  if (modal) modal.classList.remove("is-visible");
}

async function carregarTreinamentosDisponiveis() {
  const selectTreinamento = document.getElementById("treinamento-selecionado");
  if (!selectTreinamento) return;
  selectTreinamento.innerHTML = '<option value="">Carregando...</option>';

  try {
    const treinamentosRef = collection(db, "treinamentos");
    const q = query(treinamentosRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      selectTreinamento.innerHTML =
        '<option value="">Nenhum disponível</option>';
      return;
    }

    let htmlOptions = '<option value="">Selecione...</option>';
    snapshot.forEach((docSnap) => {
      const treino = docSnap.data();
      const prazoDias = treino.prazo_dias || "14";
      htmlOptions += `<option value="${docSnap.id}" 
        data-link="${treino.link || ""}" 
        data-tipo="${treino.tipo || "Geral"}"
        data-prazo="${prazoDias}"
        data-titulo="${treino.titulo}">
        ${treino.titulo} - Prazo: ${prazoDias}d
       </option>`;
    });

    selectTreinamento.innerHTML = htmlOptions;
  } catch (error) {
    selectTreinamento.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function enviarTreinamentoWhatsApp() {
  const modal = document.getElementById("modal-enviar-treinamento");
  const usuarioId = modal?.dataset.candidaturaId;
  const selectTreinamento = document.getElementById("treinamento-selecionado");
  const option = selectTreinamento?.selectedOptions[0];
  const treinamentoId = option?.value;
  const treinamentoTitulo = option?.dataset.titulo;
  const prazoDias = option?.dataset.prazo || "14";
  const telefone = dadosUsuarioAtual?.telefone_contato;
  const mensagemPersonalizada = document.getElementById(
    "treinamento-mensagem"
  )?.value;
  const btnEnviar = document.getElementById("btn-enviar-treinamento-whatsapp");

  if (!treinamentoId || !telefone) {
    window.showToast?.("Selecione um treinamento.", "error");
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando...';

  try {
    const responseGerarToken = await fetch(CF_GERAR_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId: usuarioId,
        testeId: treinamentoId,
        tipo: "treinamento",
        prazoDias: parseInt(prazoDias),
      }),
    });

    const dataToken = await responseGerarToken.json();
    if (!dataToken.sucesso) throw new Error(dataToken.erro);

    const linkComToken = dataToken.urlTeste;

    const mensagemPadrao = `
📚 *Olá ${dadosUsuarioAtual.nome_completo}!*

Como parte da sua integração, aqui está o seu treinamento:

*Treinamento:* ${treinamentoTitulo}

🔗 *Acesse pelo link exclusivo abaixo:*
${linkComToken}

⏰ *Prazo para conclusão:* ${prazoDias} dias.

Bons estudos!
*Equipe EuPsico* 💙`.trim();

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${encodeURIComponent(
      mensagemFinal
    )}`;

    window.open(linkWhatsApp, "_blank");

    await salvarEnvioTreinamento(
      usuarioId,
      treinamentoId,
      treinamentoTitulo,
      linkComToken,
      dataToken.tokenId
    );

    window.showToast?.("Treinamento enviado!", "success");
    fecharModalEnviarTreinamento();
  } catch (error) {
    console.error("Erro:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
  }
}

async function salvarEnvioTreinamento(
  usuarioId,
  treinamentoId,
  titulo,
  link,
  tokenId
) {
  const { candidatosCollection, currentUserData } = getGlobalState();
  const candidatoRef = doc(candidatosCollection, usuarioId);
  await updateDoc(candidatoRef, {
    treinamentos_enviados: arrayUnion({
      id: treinamentoId,
      titulo: titulo,
      tokenId: tokenId,
      link: link,
      data_envio: new Date(),
      enviado_por_uid: currentUserData.id || "rh_system_user",
      status: "enviado",
    }),
    historico: arrayUnion({
      data: new Date(),
      acao: `Treinamento '${titulo}' enviado.`,
      usuario: currentUserData.id || "rh_system_user",
    }),
  });
}

// Listeners Globais
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-enviar-treinamento-whatsapp")
    enviarTreinamentoWhatsApp();
  if (e.target.matches("[data-modal-id='modal-enviar-treinamento']"))
    fecharModalEnviarTreinamento();
});
