/**
 * Arquivo: modulos/rh/js/tabs/tabIntegracao.js
 * Versão: 3.0.0 (Refatorado: Sem Tokens, CSS Padronizado e WhatsApp Direto)
 * Descrição: Gerencia agendamento, avaliação de integração e envio de treinamentos.
 */

import { getGlobalState } from "../admissao.js";
import {
  db,
  auth,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================
let dadosUsuarioAtual = null;
const URL_INTRANET = "https://intranet.eupsico.org.br";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarIntegracao(state) {
  console.log("🔹 Admissão(Integração): Iniciando renderização");

  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores para integração...</div>';

  try {
    // Busca na coleção de usuários (Fluxo Pós-Admissão)
    const usuariosCollection = collection(db, "usuarios");
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
      return;
    }

    let listaHtml = `
      <div class="description-box" style="margin-top: 15px;">
        <p>Gerencie o processo de Onboarding. Agende a integração, envie os links dos treinamentos e avalie a conclusão.</p>
      </div>
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-warning";
      let actionButtonHtml = "";

      // Dados para os modais e botões
      const dadosUsuario = {
        id: userId,
        nome_completo: user.nome || "Usuário Sem Nome",
        email_novo: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        vaga_titulo: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual,
      };

      const dadosCodificados = encodeURIComponent(JSON.stringify(dadosUsuario));

      // --- LÓGICA DO BOTÃO PRINCIPAL (Estilo tabAssinaturaDocs) ---
      if (statusAtual === "INTEGRACAO_AGENDADA") {
        statusClass = "status-info";
        // Botão Roxo para Avaliar
        actionButtonHtml = `
        <button 
          class="btn btn-sm btn-avaliar-integracao" 
          data-id="${userId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
          <i class="fas fa-check-double me-1"></i> Avaliar Integração
        </button>`;
      } else {
        // Botão Azul Primário para Agendar
        actionButtonHtml = `
        <button 
          class="btn btn-sm btn-primary btn-agendar-integracao" 
          data-id="${userId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
          <i class="fas fa-calendar-alt me-1"></i> Agendar Integração
        </button>`;
      }

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${userId}">
         <div class="info-primaria">
          <h4 class="nome-candidato">
           ${dadosUsuario.nome_completo}
            <span class="status-badge ${statusClass}">
              ${statusAtual.replace(/_/g, " ")}
            </span>
          </h4>
          <p class="small-info" style="color: var(--cor-primaria);">
           <i class="fas fa-envelope"></i> E-mail: ${dadosUsuario.email_novo}
          </p>
         </div>
         
         <div class="acoes-candidato">
            ${actionButtonHtml}
            
            <button 
              class="btn btn-sm btn-success btn-enviar-treinamento" 
              data-id="${userId}"
              data-dados="${dadosCodificados}"
              style="padding: 10px 16px; background: var(--cor-sucesso); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-video me-1"></i> Treinamentos
            </button>

            <button 
              class="btn btn-sm btn-secondary btn-ver-detalhes-admissao" 
              data-id="${userId}"
              data-dados="${dadosCodificados}"
              style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
              <i class="fas fa-eye me-1"></i> Detalhes
            </button>
          </div>
        </div>
       `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // --- REANEXAR LISTENERS ---

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

    // Listener Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalCandidato(userId, "detalhes", dadosCandidato);
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
  if (!modalAgendamento) {
    alert("Erro: Modal de agendamento não encontrado.");
    return;
  }

  dadosUsuarioAtual = dadosUsuario;
  modalAgendamento.dataset.usuarioId = userId;

  const nomeEl = document.getElementById("agendamento-int-nome-candidato");
  const statusEl = document.getElementById("agendamento-int-status-atual");

  if (nomeEl) nomeEl.textContent = dadosUsuario.nome_completo;
  if (statusEl) {
    statusEl.textContent = dadosUsuario.status_recrutamento;
    statusEl.style.color = "#000"; // Garante visibilidade
  }

  // Limpa campos
  document.getElementById("data-integracao-agendada").value = "";
  document.getElementById("hora-integracao-agendada").value = "";

  // Reset do botão
  const btnRegistrar = modalAgendamento.querySelector('button[type="submit"]');
  if (btnRegistrar) {
    const novoBtn = btnRegistrar.cloneNode(true);
    btnRegistrar.parentNode.replaceChild(novoBtn, btnRegistrar);
    novoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submeterAgendamentoIntegracao(e, novoBtn);
    });
  }

  // Listeners de fechar
  modalAgendamento.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => modalAgendamento.classList.remove("is-visible");
  });

  modalAgendamento.classList.add("is-visible");
}

async function submeterAgendamentoIntegracao(e, btnRegistrar) {
  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const usuarioId = modalAgendamento?.dataset.usuarioId;
  const { currentUserData } = getGlobalState();

  const uidResponsavel =
    auth.currentUser?.uid || currentUserData?.uid || "rh_system_user";
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

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    // Salva no banco
    await updateDoc(usuarioRef, {
      status_admissao: "INTEGRACAO_AGENDADA",
      integracao: {
        agendamento: {
          data: dataIntegracao,
          hora: horaIntegracao,
          agendado_por_uid: uidResponsavel,
          data_agendamento: new Date(),
        },
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Integração agendada para ${dataIntegracao}.`,
        usuario: uidResponsavel,
      }),
    });

    window.showToast?.(`Agendado com sucesso!`, "success");

    // Envia WhatsApp usando a lógica simplificada
    if (dadosUsuarioAtual && dadosUsuarioAtual.telefone_contato) {
      setTimeout(() => {
        enviarWhatsAppAgendamento(
          dadosUsuarioAtual,
          dataIntegracao,
          horaIntegracao
        );
      }, 500);
    }

    modalAgendamento.classList.remove("is-visible");
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
 * Lógica de WhatsApp idêntica à tabAssinaturaDocs (Direta)
 */
function enviarWhatsAppAgendamento(candidato, data, hora) {
  const [ano, mes, dia] = data.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = hora.split(":");
  const horaFormatada = `${horas}h${minutos}`;
  const nome = candidato.nome_completo
    ? candidato.nome_completo.split(" ")[0]
    : "Colaborador";
  const telefone = candidato.telefone_contato.replace(/\D/g, "");

  const msg = `Olá ${nome}, tudo bem? 👋\n\nSua *Reunião de Integração* na EuPsico foi agendada!\n\n📅 Data: ${dataFormatada}\n⏰ Horário: ${horaFormatada}\n\nO link da reunião será enviado para seu e-mail corporativo. Contamos com sua presença!`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
    msg
  )}`;
  window.open(link, "_blank");
}

// ============================================
// AVALIAÇÃO DA INTEGRAÇÃO
// ============================================

function abrirModalAvaliarIntegracao(userId, dadosUsuario) {
  const modal = document.getElementById("modal-avaliacao-integracao");
  const form = document.getElementById("form-avaliacao-integracao");

  if (!modal || !form) {
    alert("Erro: Modal de avaliação não encontrado.");
    return;
  }

  dadosUsuarioAtual = dadosUsuario;
  modal.dataset.usuarioId = userId;

  document.getElementById("avaliacao-int-nome-candidato").textContent =
    dadosUsuario.nome_completo;
  document.getElementById("avaliacao-int-status-atual").textContent =
    dadosUsuario.status_recrutamento;

  form.reset();
  form.removeEventListener("submit", submeterAvaliacaoIntegracao);
  form.addEventListener("submit", submeterAvaliacaoIntegracao);

  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => modal.classList.remove("is-visible");
  });

  modal.classList.add("is-visible");
}

async function submeterAvaliacaoIntegracao(e) {
  e.preventDefault();
  const modal = document.getElementById("modal-avaliacao-integracao");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const usuarioId = modal.dataset.usuarioId;
  const { currentUserData } = getGlobalState();
  const uidResponsavel =
    auth.currentUser?.uid || currentUserData?.uid || "rh_user";

  const realizou = document.getElementById("integracao-realizada").value;
  const observacoes = document.getElementById("integracao-observacoes").value;

  if (realizou !== "sim") {
    alert("Para concluir, a integração deve ter sido realizada.");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = "Salvando...";

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    await updateDoc(usuarioRef, {
      status_admissao: "AGUARDANDO_AVALIACAO_3MESES",
      "integracao.conclusao": {
        realizada: true,
        observacoes: observacoes,
        concluido_em: new Date(),
        responsavel_uid: uidResponsavel,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: "Integração concluída.",
        usuario: uidResponsavel,
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
// ENVIO DE TREINAMENTOS (SEM CLOUD FUNCTION)
// ============================================

async function abrirModalEnviarTreinamento(userId, dadosUsuario) {
  const modalEnviarTreinamento = document.getElementById(
    "modal-enviar-treinamento"
  );
  if (!modalEnviarTreinamento) return;

  try {
    dadosUsuarioAtual = dadosUsuario;
    modalEnviarTreinamento.dataset.usuarioId = userId;

    document.getElementById("treinamento-nome-candidato").textContent =
      dadosUsuario.nome_completo;
    document.getElementById("treinamento-email-candidato").textContent =
      dadosUsuario.email_novo;
    document.getElementById("treinamento-whatsapp-candidato").textContent =
      dadosUsuario.telefone_contato;

    await carregarTreinamentosDisponiveis();

    document
      .querySelectorAll(`[data-modal-id='modal-enviar-treinamento']`)
      .forEach((btn) => {
        btn.onclick = () =>
          modalEnviarTreinamento.classList.remove("is-visible");
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
      // Armazenamos o link direto no data-link
      htmlOptions += `<option value="${docSnap.id}" 
        data-link="${treino.link || URL_INTRANET}" 
        data-titulo="${treino.titulo}" 
        data-prazo="${prazoDias}">
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
  const usuarioId = modal?.dataset.usuarioId;
  const selectTreinamento = document.getElementById("treinamento-selecionado");
  const option = selectTreinamento?.selectedOptions[0];

  const treinamentoId = option?.value;
  const treinamentoTitulo = option?.dataset.titulo;
  const linkTreinamento = option?.dataset.link;
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
    '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';

  try {
    // Lógica simplificada: Mensagem + Link direto
    const nome = dadosUsuarioAtual.nome_completo.split(" ")[0];
    const mensagemPadrao = `Olá ${nome}, aqui é do RH da EuPsico! 👋

Estamos enviando o link para o seu treinamento: *${treinamentoTitulo}*

🔗 Acesse aqui: ${linkTreinamento}

⏰ Prazo sugerido: ${prazoDias} dias.

Como você já possui login na Intranet, basta acessar o link acima. Bom estudo!`;

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");

    // Abre WhatsApp
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${encodeURIComponent(
      mensagemFinal
    )}`;
    window.open(linkWhatsApp, "_blank");

    // Salva no histórico (sem token)
    await salvarEnvioTreinamento(
      usuarioId,
      treinamentoId,
      treinamentoTitulo,
      linkTreinamento
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

async function salvarEnvioTreinamento(userId, treinamentoId, titulo, link) {
  const { currentUserData } = getGlobalState();
  const uidResponsavel =
    auth.currentUser?.uid || currentUserData?.uid || "rh_system_user";
  const usuarioRef = doc(db, "usuarios", userId);

  await updateDoc(usuarioRef, {
    treinamentos_enviados: arrayUnion({
      id: treinamentoId,
      titulo: titulo,
      link: link,
      data_envio: new Date(),
      enviado_por_uid: uidResponsavel,
      status: "enviado",
    }),
    historico: arrayUnion({
      data: new Date(),
      acao: `Treinamento '${titulo}' enviado (Link direto).`,
      usuario: uidResponsavel,
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
