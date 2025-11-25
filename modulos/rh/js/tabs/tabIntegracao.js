/**
 * Arquivo: modulos/rh/js/tabs/tabIntegracao.js
 * Versão: 2.4.0 (Migração: status_admissao + auth.currentUser + Fix Popup)
 * Descrição: Gerencia agendamento, avaliação de integração e envio de treinamentos.
 */

import { getGlobalState } from "../admissao.js";
import {
  db,
  auth, // ✅ ADICIONADO: Importação direta do Auth
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

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores para integração...</div>';

  try {
    // ✅ MUDANÇA: Busca na coleção 'usuarios' pelo 'status_admissao'
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
      // ✅ ALTERADO: Usa status_admissao
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-warning";
      let actionButtonHtml = "";

      // ✅ LÓGICA DO BOTÃO PRINCIPAL (Baseada em status_admissao)
      if (statusAtual === "INTEGRACAO_AGENDADA") {
        statusClass = "status-info";
        // Botão de AVALIAR (Concluir)
        actionButtonHtml = `
        <button 
          class="action-button primary btn-avaliar-integracao" 
          data-id="${userId}"
          data-dados="${encodeURIComponent(
            JSON.stringify({
              id: userId,
              nome: user.nome, // Padrao usuarios
              status_admissao: statusAtual,
            })
          )}"
          style="background: #6f42c1; border-color: #6f42c1;">
          <i class="fas fa-check-double me-1"></i> Avaliar Integração
        </button>`;
      } else {
        // Botão de AGENDAR
        actionButtonHtml = `
        <button 
          class="action-button primary btn-agendar-integracao" 
          data-id="${userId}"
          data-dados="${encodeURIComponent(
            JSON.stringify({
              id: userId,
              nome: user.nome,
              status_admissao: statusAtual,
              telefone: user.contato || user.telefone, // Garante telefone
            })
          )}"
          style="background: var(--cor-primaria);">
          <i class="fas fa-calendar-alt me-1"></i> Agendar Integração
        </button>`;
      }

      // Mapeamento de dados do Usuário
      const dadosUsuario = {
        id: userId,
        nome_completo: user.nome || "Usuário Sem Nome",
        email_novo: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        vaga_titulo: user.profissao || "Cargo não informado",
        status_admissao: statusAtual,
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
      	<i class="fas fa-video me-1"></i> Treinamentos
     	</button>

        <button 
      	class="action-button secondary btn-ver-detalhes" 
      	data-id="${userId}"
      	data-dados="${dadosCodificados}"
     		style="background: #6c757d;">
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

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          decodeURIComponent(e.currentTarget.getAttribute("data-dados"))
        );
        if (typeof window.abrirModalDetalhesCandidato === "function") {
          window.abrirModalDetalhesCandidato(dados);
        } else {
          console.log("Detalhes:", dados);
          alert("Visualização de detalhes não configurada globalmente.");
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
  if (statusEl) statusEl.textContent = dadosUsuario.status_admissao;

  document.getElementById("data-integracao-agendada").value = "";
  document.getElementById("hora-integracao-agendada").value = "";

  // Correção de evento: substitui listener para garantir clique limpo
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
  console.log("🔹 Admissão: Submetendo agendamento (Usuário)");

  const modalAgendamento = document.getElementById(
    "modal-agendamento-integracao"
  );
  const usuarioId = modalAgendamento?.dataset.usuarioId;
  const { currentUserData } = getGlobalState();

  // ✅ AUTH: Prioriza auth.currentUser
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

  // Lógica de Janela WhatsApp (Tentativa Automática)
  let janelaWhatsApp = null;
  let linkWhatsApp = null;

  if (dadosUsuarioAtual.telefone_contato) {
    linkWhatsApp = gerarLinkWhatsApp(
      dadosUsuarioAtual,
      dataIntegracao,
      horaIntegracao
    );
    try {
      janelaWhatsApp = window.open("", "_blank");
    } catch (err) {
      console.warn("Popup bloqueado inicialmente:", err);
    }
  }

  btnRegistrar.disabled = true;
  btnRegistrar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  // ✅ UPDATE: Campo status_admissao
  const novoStatus = "INTEGRACAO_AGENDADA";

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    await updateDoc(usuarioRef, {
      status_admissao: novoStatus,
      integracao: {
        agendamento: {
          data: dataIntegracao,
          hora: horaIntegracao,
          agendado_por_uid: uidResponsavel,
          data_agendamento: new Date(),
        },
      },
      // Histórico opcional
      historico: arrayUnion({
        data: new Date(),
        acao: `Integração agendada para ${dataIntegracao}.`,
        usuario: uidResponsavel,
      }),
    });

    window.showToast?.(`Agendado com sucesso!`, "success");

    // Lógica WhatsApp (Redirecionamento ou Fallback Manual)
    if (linkWhatsApp) {
      if (janelaWhatsApp && !janelaWhatsApp.closed) {
        janelaWhatsApp.location.href = linkWhatsApp;
        modalAgendamento.classList.remove("is-visible");
        renderizarIntegracao(getGlobalState());
      } else {
        // Se bloqueado: Botão verde manual
        btnRegistrar.disabled = false;
        btnRegistrar.className = "action-button success";
        btnRegistrar.style.background = "#25D366";
        btnRegistrar.style.borderColor = "#25D366";
        btnRegistrar.innerHTML =
          '<i class="fab fa-whatsapp me-2"></i> Abrir WhatsApp Agora';

        btnRegistrar.onclick = () => {
          window.open(linkWhatsApp, "_blank");
          modalAgendamento.classList.remove("is-visible");
          renderizarIntegracao(getGlobalState());
        };

        window.showToast?.(
          "Clique no botão verde para abrir o WhatsApp.",
          "warning"
        );
        return;
      }
    } else {
      modalAgendamento.classList.remove("is-visible");
      renderizarIntegracao(getGlobalState());
    }
  } catch (error) {
    console.error("❌ Erro ao agendar:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
    if (janelaWhatsApp) janelaWhatsApp.close();

    btnRegistrar.disabled = false;
    btnRegistrar.innerHTML =
      '<i class="fas fa-calendar-alt me-2"></i> Agendar Integração';
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

  // ✅ AUTH: Prioriza auth.currentUser
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

  // ✅ UPDATE: Campo status_admissao
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
      '<i class="fas fa-check-circle me-2"></i> Concluir Integração';
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
        '<option value="">Nenhum disponível</option>';
      return;
    }

    let htmlOptions = '<option value="">Selecione...</option>';
    snapshot.forEach((docSnap) => {
      const treino = docSnap.data();
      const prazoDias = treino.prazo_dias || "14";
      htmlOptions += `<option value="${docSnap.id}" 
        data-link="${treino.link || ""}" 
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
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
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

  // ✅ AUTH: Prioriza auth.currentUser
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
