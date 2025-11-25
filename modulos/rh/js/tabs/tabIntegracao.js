/**
 * Arquivo: modulos/rh/js/tabs/tabIntegracao.js
 * Versão: 2.6.0 (Correção Final: Status Visível, Modal Detalhes e Fluxo WhatsApp Original)
 * Descrição: Gerencia agendamento, avaliação de integração e envio de treinamentos.
 */

import { getGlobalState } from "../admissao.js";
import {
  db,
  auth, // ✅ Auth para pegar o usuário logado
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
let dadosUsuarioAtual = null;

// ============================================
// CLOUD FUNCTIONS
// ============================================
const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_GERAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/gerarTokenTeste`;

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================
export async function renderizarIntegracao(state) {
  console.log(
    "🔹 Admissão(Integração): Iniciando renderização (Fluxo Usuários)"
  );

  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando colaboradores...
    </div>
  `;

  try {
    const usuariosRef = collection(db, "usuarios");
    const statusIntegracao = [
      "AGUARDANDO_INTEGRACAO",
      "INTEGRACAO_AGENDADA",
      "INTEGRACAO_REALIZADA",
    ];

    const q = query(
      usuariosRef,
      where("status_admissao", "in", statusIntegracao)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clipboard-check"></i>
          <p>Nenhum colaborador aguardando integração.</p>
        </div>
      `;
      return;
    }

    let listaHtml = `
      <div class="tab-integracao-header">
        <h3>📋 Integração e Onboarding</h3>
        <p>Gerencie o processo de Onboarding. Agende a integração, envie os links dos treinamentos e avalie a conclusão.</p>
      </div>
      <div class="usuarios-integracao-list">
    `;

    snapshot.forEach((docSnap) => {
      const dadosUsuario = docSnap.data();
      const userId = docSnap.id;

      const statusBadge = obterBadgeStatusIntegracao(
        dadosUsuario.status_admissao
      );
      const dataAgendada =
        dadosUsuario.integracao?.agendamento?.data || "Não definida";
      const horaAgendada =
        dadosUsuario.integracao?.agendamento?.hora || "Não definida";

      listaHtml += `
        <div class="usuario-integracao-card">
          <div class="usuario-integracao-info">
            <h4>${dadosUsuario.nome_completo}</h4>
            <p><strong>E-mail:</strong> ${dadosUsuario.email_novo}</p>
            <p><strong>Status:</strong> ${statusBadge}</p>
            ${
              dadosUsuario.status_admissao === "INTEGRACAO_AGENDADA"
                ? `<p><strong>Agendamento:</strong> ${dataAgendada} às ${horaAgendada}</p>`
                : ""
            }
          </div>
          <div class="usuario-integracao-acoes">
            ${gerarBotoesIntegracao(userId, dadosUsuario)}
          </div>
        </div>
      `;
    });

    listaHtml += `</div>`;
    conteudoAdmissao.innerHTML = listaHtml;

    // Adiciona event listeners para os botões
    document.querySelectorAll(".btn-agendar-integracao").forEach((btn) => {
      btn.onclick = () => {
        const userId = btn.dataset.userId;
        const dadosUsuario = JSON.parse(btn.dataset.usuario);
        abrirModalAgendarIntegracao(userId, dadosUsuario);
      };
    });

    document.querySelectorAll(".btn-avaliar-integracao").forEach((btn) => {
      btn.onclick = () => {
        const userId = btn.dataset.userId;
        const dadosUsuario = JSON.parse(btn.dataset.usuario);
        abrirModalAvaliarIntegracao(userId, dadosUsuario);
      };
    });

    document.querySelectorAll(".btn-enviar-treinamento").forEach((btn) => {
      btn.onclick = () => {
        const userId = btn.dataset.userId;
        const dadosUsuario = JSON.parse(btn.dataset.usuario);
        abrirModalEnviarTreinamento(userId, dadosUsuario);
      };
    });

    // ✅ MANTÉM O BOTÃO DE DETALHES ORIGINAL
    document.querySelectorAll(".btn-detalhes-integracao").forEach((btn) => {
      btn.onclick = () => {
        const userId = btn.dataset.userId;
        const dadosUsuario = JSON.parse(btn.dataset.usuario);
        abrirModalDetalhesIntegracao(userId, dadosUsuario);
      };
    });
  } catch (error) {
    console.error("❌ Erro ao renderizar integração:", error);
    conteudoAdmissao.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar a lista: ${error.message}</p>
      </div>
    `;
  }
}

function obterBadgeStatusIntegracao(status) {
  const badges = {
    AGUARDANDO_INTEGRACAO:
      '<span class="badge badge-warning">Aguardando</span>',
    INTEGRACAO_AGENDADA: '<span class="badge badge-info">Agendada</span>',
    INTEGRACAO_REALIZADA: '<span class="badge badge-success">Realizada</span>',
  };
  return badges[status] || '<span class="badge badge-secondary">-</span>';
}

function gerarBotoesIntegracao(userId, dadosUsuario) {
  const status = dadosUsuario.status_admissao;
  const dadosJson = JSON.stringify(dadosUsuario).replace(/"/g, "&quot;");

  let botoes = "";

  if (status === "AGUARDANDO_INTEGRACAO" || status === "INTEGRACAO_AGENDADA") {
    botoes += `
      <button class="btn btn-primary btn-sm btn-agendar-integracao" 
              data-user-id="${userId}" 
              data-usuario='${dadosJson}'>
        <i class="fas fa-calendar-check"></i> ${
          status === "INTEGRACAO_AGENDADA" ? "Reagendar" : "Agendar"
        }
      </button>
    `;
  }

  if (status === "INTEGRACAO_AGENDADA") {
    botoes += `
      <button class="btn btn-success btn-sm btn-avaliar-integracao" 
              data-user-id="${userId}" 
              data-usuario='${dadosJson}'>
        <i class="fas fa-check-circle"></i> Concluir
      </button>
    `;
  }

  botoes += `
    <button class="btn btn-secondary btn-sm btn-enviar-treinamento" 
            data-user-id="${userId}" 
            data-usuario='${dadosJson}'>
      <i class="fas fa-graduation-cap"></i> Treinamento
    </button>
  `;

  // ✅ MANTÉM O BOTÃO DE DETALHES ORIGINAL
  botoes += `
    <button class="btn btn-info btn-sm btn-detalhes-integracao" 
            data-user-id="${userId}" 
            data-usuario='${dadosJson}'>
      <i class="fas fa-info-circle"></i> Detalhes
    </button>
  `;

  return botoes;
}

// ✅ MANTÉM A FUNÇÃO ORIGINAL DE DETALHES
function abrirModalDetalhesIntegracao(userId, dadosUsuario) {
  const modal = document.getElementById("modal-detalhes-integracao");
  if (!modal) {
    console.warn("Modal de detalhes não encontrado no HTML");
    return;
  }

  // Preenche informações do colaborador
  document.getElementById("detalhes-int-nome").textContent =
    dadosUsuario.nome_completo || "N/A";
  document.getElementById("detalhes-int-email").textContent =
    dadosUsuario.email_novo || "N/A";
  document.getElementById("detalhes-int-telefone").textContent =
    dadosUsuario.telefone_contato || "N/A";
  document.getElementById("detalhes-int-cargo").textContent =
    dadosUsuario.cargo || "N/A";
  document.getElementById("detalhes-int-status").textContent =
    dadosUsuario.status_admissao || "N/A";

  // Informações de agendamento
  const agendamento = dadosUsuario.integracao?.agendamento;
  if (agendamento) {
    document.getElementById("detalhes-int-data-agendada").textContent =
      agendamento.data || "N/A";
    document.getElementById("detalhes-int-hora-agendada").textContent =
      agendamento.hora || "N/A";
  } else {
    document.getElementById("detalhes-int-data-agendada").textContent =
      "Não agendado";
    document.getElementById("detalhes-int-hora-agendada").textContent = "-";
  }

  // Informações de conclusão
  const conclusao = dadosUsuario.integracao?.conclusao;
  if (conclusao && conclusao.realizada) {
    document.getElementById("detalhes-int-concluida").textContent = "Sim";
    document.getElementById("detalhes-int-observacoes").textContent =
      conclusao.observacoes || "Nenhuma observação";
  } else {
    document.getElementById("detalhes-int-concluida").textContent = "Não";
    document.getElementById("detalhes-int-observacoes").textContent = "-";
  }

  // Botão de fechar
  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => modal.classList.remove("is-visible");
  });

  modal.classList.add("is-visible");
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

  dadosUsuarioAtual = dadosUsuario; // Armazena na variável global do módulo
  modalAgendamento.dataset.usuarioId = userId;

  const nomeEl = document.getElementById("agendamento-int-nome-candidato");
  const statusEl = document.getElementById("agendamento-int-status-atual");

  if (nomeEl) nomeEl.textContent = dadosUsuario.nome_completo;

  // ✅ CORREÇÃO VISUAL: Força cor preta (#000) para o status ficar visível
  if (statusEl) {
    statusEl.textContent =
      dadosUsuario.status_admissao || dadosUsuario.status_recrutamento;
    statusEl.style.color = "#000000"; // Preto
    statusEl.style.fontWeight = "bold";
  }

  document.getElementById("data-integracao-agendada").value = "";
  document.getElementById("hora-integracao-agendada").value = "";

  // Reset do botão e listener limpo
  const btnRegistrar = modalAgendamento.querySelector('button[type="submit"]');
  if (btnRegistrar) {
    const novoBtn = btnRegistrar.cloneNode(true);
    btnRegistrar.parentNode.replaceChild(novoBtn, btnRegistrar);

    novoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submeterAgendamentoIntegracao(e, novoBtn);
    });
  }

  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-integracao']`)
    .forEach((btn) => {
      btn.onclick = () => modalAgendamento.classList.remove("is-visible");
    });

  modalAgendamento.classList.add("is-visible");
}

async function submeterAgendamentoIntegracao(e, btnRegistrar) {
  console.log("🔹 Admissão: Submetendo agendamento");

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

  // ✅ CORREÇÃO 1: VALIDAÇÃO MELHORADA
  if (!dataIntegracao || !horaIntegracao) {
    window.showToast?.(
      "⚠️ Por favor, preencha a Data e o Horário da Integração.",
      "error"
    );
    return;
  }

  // ✅ CORREÇÃO 2: PRÉ-ABERTURA DA JANELA WHATSAPP (síncrono, antes do await)
  let janelaWhatsApp = null;
  if (dadosUsuarioAtual && dadosUsuarioAtual.telefone_contato) {
    try {
      // Abre janela em branco IMEDIATAMENTE (antes de qualquer await)
      janelaWhatsApp = window.open("", "_blank");
      console.log("✅ Janela WhatsApp pré-aberta");
    } catch (err) {
      console.warn("⚠️ Erro ao pré-abrir janela:", err);
    }
  }

  btnRegistrar.disabled = true;
  btnRegistrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    // 1. Salva no banco primeiro (Fluxo normal)
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

    // ✅ CORREÇÃO 3: USA A JANELA PRÉ-ABERTA PARA NAVEGAR AO WHATSAPP
    if (janelaWhatsApp && dadosUsuarioAtual.telefone_contato) {
      const linkWhatsApp = gerarLinkWhatsApp(
        dadosUsuarioAtual,
        dataIntegracao,
        horaIntegracao
      );
      janelaWhatsApp.location.href = linkWhatsApp;
      console.log("✅ WhatsApp navegado com sucesso");
    } else if (janelaWhatsApp) {
      // Fecha se não tem telefone
      janelaWhatsApp.close();
    }

    modalAgendamento.classList.remove("is-visible");
    renderizarIntegracao(getGlobalState());
  } catch (error) {
    console.error("❌ Erro ao agendar:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");

    // Fecha a janela se deu erro
    if (janelaWhatsApp) {
      janelaWhatsApp.close();
    }
  } finally {
    btnRegistrar.disabled = false;
    btnRegistrar.innerHTML =
      '<i class="fas fa-calendar-check"></i> Agendar Integração';
  }
}

function gerarLinkWhatsApp(candidato, dataIntegracao, horaIntegracao) {
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

O link para a reunião (Google Meet/Zoom) será enviado para o seu e-mail corporativo.

Qualquer dúvida, fale conosco.

*Abraços,*
*Equipe de Recursos Humanos - EuPsico* 💙
  `.trim();

  const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");
  return `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${encodeURIComponent(
    mensagem
  )}`;
}

// ============================================
// ✅ AVALIAÇÃO DA INTEGRAÇÃO
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
    dadosUsuario.status_admissao;

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

  const novoStatus = "AGUARDANDO_AVALIACAO_3MESES";

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    await updateDoc(usuarioRef, {
      status_admissao: novoStatus,
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
      '<i class="fas fa-check-circle"></i> Concluir Integração';
  }
}

// ============================================
// ENVIO DE TREINAMENTOS
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
        '<option value="">Nenhum treinamento disponível</option>';
      return;
    }

    let htmlOptions = '<option value="">Selecione um treinamento</option>';
    snapshot.forEach((docSnap) => {
      const treino = docSnap.data();
      const prazoDias = treino.prazo_dias || "14";
      htmlOptions += `<option value="${docSnap.id}" data-titulo="${treino.titulo}" data-prazo="${prazoDias}">${treino.titulo}</option>`;
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
  btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

  try {
    const responseGerarToken = await fetch(CF_GERAR_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatoId: usuarioId,
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
      '<i class="fas fa-paper-plane"></i> Enviar via WhatsApp';
  }
}

async function salvarEnvioTreinamento(
  userId,
  treinamentoId,
  titulo,
  link,
  tokenId
) {
  const { currentUserData } = getGlobalState();
  const uidResponsavel =
    auth.currentUser?.uid || currentUserData?.uid || "rh_system_user";

  const usuarioRef = doc(db, "usuarios", userId);

  await updateDoc(usuarioRef, {
    treinamentos_enviados: arrayUnion({
      id: treinamentoId,
      titulo: titulo,
      tokenId: tokenId,
      link: link,
      data_envio: new Date(),
      enviado_por_uid: uidResponsavel,
      status: "enviado",
    }),
    historico: arrayUnion({
      data: new Date(),
      acao: `Treinamento '${titulo}' enviado.`,
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
