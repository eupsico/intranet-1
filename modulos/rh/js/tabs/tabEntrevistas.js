/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 6.7.0 (Corrigido 'rh_system_user' buscando nome do Firestore e 'statusTeste' ReferenceError)
 * Data: 05/11/2025
 * Descrição: Gerencia Entrevistas usando Cloud Functions para Token e Respostas
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
  addDoc,
  getDoc,
  auth,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================
let dadosCandidatoAtual = null;

// ============================================
// CLOUD FUNCTIONS URLS
// ============================================
const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_GERAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/gerarTokenTeste`;
const CF_VALIDAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/validarTokenTeste`;
const CF_SALVAR_RESPOSTAS = `${CLOUD_FUNCTIONS_BASE}/salvarRespostasTeste`;

// ============================================
// ELEMENTOS DO DOM
// ============================================
const modalEnviarTeste = document.getElementById("modal-enviar-teste");
const formEnviarTeste = document.getElementById("form-enviar-teste");

// ============================================
// ✅ INÍCIO DA ATUALIZAÇÃO (REQ 2)
// ============================================
/**
 * Helper function para buscar o NOME do usuário logado na coleção 'usuarios'.
 * Isso corrige o problema do 'rh_system_user'.
 */
async function getCurrentUserName() {
  try {
    const user = auth.currentUser;
    if (!user) {
      return "rh_system_user (Não autenticado)";
    }

    // Use o user.uid para buscar o documento na coleção 'usuarios'
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      // Retorna o campo 'nome' (como visto na image_0da3a4.jpg)
      return userData.nome || userData.email || user.uid;
    } else {
      // Fallback caso o documento do usuário não exista
      return user.email || user.uid;
    }
  } catch (error) {
    console.error("Erro ao buscar nome do usuário:", error);
    return "rh_system_user (Erro)";
  }
}
// ============================================
// ✅ FIM DA ATUALIZAÇÃO
// ============================================

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

    let listaHtml = '<div class="candidatos-container candidatos-grid">';

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
            <h4>Nome: ${cand.nome_completo || "Candidato Sem Nome"}</h4>
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

      // LÓGICA: EXIBIÇÃO DOS BOTÕES
      if (statusAtual.includes("Entrevista Pendente")) {
        // Candidato aguardando agendamento ou realização da entrevista RH
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
      } else if (
        statusAtual === "Entrevista RH Aprovada (Testes Pendente)" ||
        statusAtual === "Testes Pendente" ||
        statusAtual === "Testes Pendente (Enviado)"
      ) {
        // AMBOS OS BOTÕES APARECEM JUNTOS
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
            <button 
              class="action-button success btn-avaliar-teste" 
              data-id="${candidatoId}"
              data-candidato-data='${JSON.stringify(cand).replace(
                /'/g,
                "&#39;"
              )}'>
              <i class="fas fa-clipboard-check me-1"></i> Avaliar Teste
            </button>
        `;
      } else {
        // Outros status - apenas ver avaliação
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

    // Listeners de Enviar Teste
    document.querySelectorAll(".btn-enviar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        dados.id = candidatoId;
        window.abrirModalEnviarTeste(candidatoId, dados);
      });
    });

    // Listeners de Avaliar Teste
    document.querySelectorAll(".btn-avaliar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        dados.id = candidatoId;
        window.abrirModalAvaliacaoTeste(candidatoId, dados);
      });
    });

    // Listeners de Avaliar RH
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

// ============================================
// FUNÇÃO (Avaliar Teste): Carregar Respostas do Teste
// ============================================
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
      container.innerHTML = `
        <p class="text-danger small">
          <i class="fas fa-exclamation-circle me-2"></i>
          As respostas deste teste não foram encontradas no banco de dados.
        </p>
      `;
      return;
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    // ✅ ADICIONADO: Obter título do teste
    let respostasHtml = "";
    respostasHtml += `
      <div class="teste-header">
        <h5 class="teste-titulo">
          <i class="fas fa-file-alt me-2"></i>
          ${data.nomeTeste || "Teste"}
        </h5>
        <small class="text-muted d-block mb-3">
          <i class="fas fa-calendar me-1"></i>
          <strong>Data de Envio:</strong> ${formatarDataEnvio(data.data_envio)}
        </small>
      </div>
    `;

    respostasHtml += `<h6 class="mt-3">Respostas do Candidato</h6>`;
    respostasHtml += `<ul class="list-group list-group-flush">`;

    if (data.respostas && Array.isArray(data.respostas)) {
      data.respostas.forEach((r, i) => {
        respostasHtml += `
          <li class="list-group-item">
            <strong>P${i + 1}: ${
          r.pergunta || "Pergunta não registrada"
        }</strong>
            <p style="white-space: pre-wrap; background: #f8f9fa; padding: 5px; border-radius: 4px; margin-top: 5px;">
              ${r.resposta || "Sem resposta"}
            </p>
          </li>
        `;
      });
    } else if (data.respostas && typeof data.respostas === "object") {
      Object.keys(data.respostas).forEach((key, i) => {
        respostasHtml += `
          <li class="list-group-item">
            <strong>P${i + 1} (ID: ${key})</strong>
            <p style="white-space: pre-wrap; background: #f8f9fa; padding: 5px; border-radius: 4px; margin-top: 5px;">
              ${data.respostas[key] || "Sem resposta"}
            </p>
          </li>
        `;
      });
    } else {
      respostasHtml += `<li class="list-group-item">Formato de respostas não reconhecido.</li>`;
    }

    respostasHtml += `</ul>`;

    // ✅ ADICIONADO: Exibir tempo gasto
    if (data.tempoGasto !== undefined && data.tempoGasto !== null) {
      const minutos = Math.floor(data.tempoGasto / 60);
      const segundos = data.tempoGasto % 60;
      respostasHtml += `
        <div class="alert alert-info mt-3 small">
          <i class="fas fa-hourglass-end me-2"></i>
          <strong>Tempo Gasto:</strong> ${minutos}m ${segundos}s
        </div>
      `;
    }

    // ✅ ADICIONADO: Estatísticas se disponível
    if (data.avaliacao) {
      const acertos = data.avaliacao.acertos || 0;
      const total = data.avaliacao.total || data.respostas?.length || 0;
      const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;

      respostasHtml += `
        <div class="alert alert-info mt-2">
          <strong>Avaliação Automática</strong><br>
          Acertos: ${acertos} de ${total} (${percentual}%)
        </div>
      `;
    }

    container.innerHTML = respostasHtml;
  } catch (error) {
    console.error("Erro ao carregar respostas:", error);
    container.innerHTML = `
      <p class="text-danger small">
        <i class="fas fa-exclamation-circle me-2"></i>
        Erro ao carregar respostas: ${error.message}
      </p>
    `;
  }
}

// ✅ ADICIONADO: Helper function para formatar data
function formatarDataEnvio(timestamp) {
  if (!timestamp) return "N/A";

  let date;

  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp * 1000);
  } else {
    return "N/A";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// FUNÇÃO (Avaliar Teste): Gerenciador de UI
// ============================================
/**
 * Gerencia a exibição do seletor de gestor no modal "Avaliar Teste"
 */
function toggleCamposAvaliacaoTeste() {
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  const radioAprovado = form.querySelector(
    'input[name="resultado_teste"][value="Aprovado"]'
  );

  // Assumindo que o select E o botão de WhatsApp estão dentro de um container
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
    containerGestor.style.display = "block";
  } else {
    containerGestor.style.display = "none";
  }
}

// ============================================
// MODAIS - AVALIAÇÃO DE TESTE
// ============================================

/**
 * Abre o modal de avaliação do teste (ATUALIZADO v6.7.0)
 */
window.abrirModalAvaliacaoTeste = async function (candidatoId, dadosCandidato) {
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
    console.error("Entrevistas: Elemento modal-avaliacao-teste não encontrado");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  dadosCandidato.id = candidatoId;
  modalAvaliacaoTeste.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nomecompleto || "Candidato(a)";
  const statusAtual = dadosCandidato.statusrecrutamento || "N/A";

  // Preenche informações do candidato
  const nomeEl = document.getElementById("avaliacao-teste-nome-candidato");
  const statusEl = document.getElementById("avaliacao-teste-status-atual");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;

  // Exibe todos os testes enviados
  const testesEnviados = dadosCandidato.testesenviados || [];
  const infoTestesEl = document.getElementById("avaliacao-teste-info-testes");

  if (infoTestesEl) {
    if (testesEnviados.length === 0) {
      infoTestesEl.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Nenhum teste foi enviado para este candidato ainda.
        </div>
      `;
    } else {
      let testesHtml = '<div class="testes-enviados-lista">';

      testesEnviados.forEach((teste, index) => {
        // ✅ Formata data de envio
        const dataEnvio = teste.dataenvio?.toDate
          ? teste.dataenvio.toDate().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A";

        const statusTeste = teste.status || "enviado";
        let badgeClass = "bg-warning";
        let statusTexto = "Pendente";
        let linkHtml = "";

        const tokenId = teste.tokenId || `manual-index-${index}`;

        if (statusTeste === "respondido") {
          badgeClass = "bg-success";
          statusTexto = "Respondido";
          if (teste.linkrespostas) {
            linkHtml = `
              <p>
                <strong>Resultado</strong>
                <a href="${teste.linkrespostas}" target="_blank">
                  Acessar Respostas e Avaliação
                </a>
              </p>
            `;
          }
        } else if (statusTeste === "avaliado") {
          badgeClass = "bg-info";
          statusTexto = "Avaliado";
          if (teste.linkrespostas) {
            linkHtml = `
              <p>
                <strong>Resultado</strong>
                <a href="${teste.linkrespostas}" target="_blank">
                  Ver Avaliação
                </a>
              </p>
            `;
          }
        } else {
          linkHtml = `
            <p>
              <strong>Link do Teste</strong>
              Aguardando resposta do candidato
            </p>
          `;
        }

        testesHtml += `
          <div class="teste-item">
            <div class="teste-header">
              <h5 class="teste-titulo">
                <i class="fas fa-file-alt me-2"></i>
                ${teste.nomeTeste || teste.id?.substring(0, 5) || "Teste"}
              </h5>
              <span class="badge ${badgeClass}">${statusTexto}</span>
            </div>
            <div class="teste-info">
              <p>
                <strong>Data de Envio:</strong> ${dataEnvio}
              </p>
              <p>
                <strong>Enviado por:</strong> ${teste.enviadopor || "N/A"}
              </p>
              ${
                teste.tempoGasto !== undefined
                  ? `
                <p>
                  <strong>Tempo Gasto:</strong> ${Math.floor(
                    teste.tempoGasto / 60
                  )}m ${teste.tempoGasto % 60}s
                </p>
              `
                  : ""
              }
              ${linkHtml}
            </div>
            <div class="respostas-container" id="respostas-container-${tokenId}" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
              <span class="text-muted small">Carregando respostas...</span>
            </div>
          </div>
        `;
      });

      testesHtml += "</div>";
      infoTestesEl.innerHTML = testesHtml;

      // ✅ DISPARAR CARREGAMENTO DAS RESPOSTAS
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
          if (container) {
            container.innerHTML = `
              <span class="text-muted small">
                <i class="fas fa-hourglass-half me-2"></i>
                Teste ainda não respondido.
              </span>
            `;
          }
        }
      });
    }
  }

  // CARREGAR GESTORES NO SELECT
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
          <option 
            value="${gestor.id}" 
            data-nome="${gestor.nome}" 
            data-telefone="${gestor.telefone || ""}" 
            data-email="${gestor.email || ""}"
          >
            ${gestor.nome}${gestor.email ? ` (${gestor.email})` : ""}
          </option>
        `;
      });

      selectGestor.innerHTML = optionsHtml;
      console.log(`${gestores.length} gestores carregados no select`);
    }
  }

  // HABILITA/DESABILITA BOTÃO WHATSAPP
  if (selectGestor && btnWhatsAppGestor) {
    selectGestor.addEventListener("change", (e) => {
      const option = e.target.selectedOptions[0];
      const telefone = option?.getAttribute("data-telefone");
      btnWhatsAppGestor.disabled = !telefone || telefone.trim() === "";
    });

    // Estado inicial
    btnWhatsAppGestor.disabled = true;
  }

  // Reseta o formulário
  if (form) form.reset();

  // ✅ Lógica de exibição do Gestor
  const radiosResultadoTeste = form.querySelectorAll(
    'input[name="resultadoteste"]'
  );
  radiosResultadoTeste.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoTeste);
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });

  // Define o estado inicial oculto
  toggleCamposAvaliacaoTeste();

  // Configura listener do formulário
  form.removeEventListener("submit", submeterAvaliacaoTeste);
  form.addEventListener("submit", submeterAvaliacaoTeste);

  // Configura listener de fechar
  document
    .querySelectorAll('[data-modal-id="modal-avaliacao-teste"]')
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacaoTeste);
      btn.addEventListener("click", fecharModalAvaliacaoTeste);
    });

  modalAvaliacaoTeste.classList.add("is-visible");
  console.log("Entrevistas: Modal de avaliação de teste aberto");
};

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
// ============================================
// CARREGAR GESTORES DO FIRESTORE (✅ ÚNICA)
// ============================================

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

  const nomeCandidato = dadosCandidatoAtual.nome_completo || "Candidato(a)";
  const telefoneCandidato =
    dadosCandidatoAtual.telefone_contato || "Não informado";
  const emailCandidato = dadosCandidatoAtual.email_candidato || "Não informado";
  const statusCandidato =
    dadosCandidatoAtual.status_recrutamento || "Em avaliação";
  const vagaInfo = dadosCandidatoAtual.vaga_titulo || "Vaga não especificada";

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
  console.log("✅ WhatsApp enviado para gestor");
};

/**
 * Submete a avaliação do teste (ATUALIZADO v6.7.0)
 */
async function submeterAvaliacaoTeste(e) {
  e.preventDefault();

  console.log("Entrevistas: Submetendo avaliação de teste");

  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-avaliacao-teste"
  );
  const state = getGlobalState();
  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;

  const candidaturaId = modalAvaliacaoTeste?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  const resultado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const observacoes =
    form.querySelector("#avaliacao-teste-observacoes")?.value || "";

  // ✅ CAPTURA O GESTOR SELECIONADO
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const gestorSelecionadoId = selectGestor?.value || null;
  const gestorOption = selectGestor?.selectedOptions[0];
  const gestorNome = gestorOption?.getAttribute("data-nome") || null;

  if (!resultado) {
    window.showToast?.("Por favor, selecione o Resultado do Teste.", "error");
    return;
  }

  // Se aprovado, gestor é obrigatório
  if (resultado === "Aprovado" && !gestorSelecionadoId) {
    window.showToast?.(
      "Por favor, selecione um gestor para aprovar o candidato.",
      "error"
    );
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

  // ✅ CORRIGIDO: Busca o nome do usuário ATUAL
  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacaoTeste = {
    resultado: resultado,
    dataavaliacao: new Date(),
    avaliadornome: avaliadorNome,
    observacoes: observacoes || null,
  };

  // ✅ SALVA O GESTOR DESIGNADO
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
        acao: `Avaliação do Teste ${isAprovado ? "APROVADO" : "REPROVADO"}. ${
          isAprovado
            ? `Gestor designado: ${gestorNome}`
            : "Processo finalizado."
        }. Novo Status: ${novoStatusCandidato}`,
        usuario: avaliadorNome,
      }),
    });

    window.showToast?.(
      `Teste ${
        isAprovado ? "aprovado" : "reprovado"
      }! Status atualizado: ${novoStatusCandidato}`,
      "success"
    );

    console.log("Entrevistas: Avaliação de teste salva no Firestore");

    fecharModalAvaliacaoTeste();

    // Recarrega a aba ativa
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("Entrevistas: Erro ao salvar avaliação de teste:", error);
    window.showToast?.(
      `Erro ao registrar a avaliação: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i>Registrar Avaliação';
  }
}

/**
 * Submete o agendamento da Entrevista RH (ATUALIZADO v6.7.0)
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

  // ✅ (REQ 2): Correção do nome do usuário
  const usuarioNome = await getCurrentUserName();

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
        usuario: usuarioNome, // ✅ REQ 2
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
// MODAIS - ENVIAR TESTE (COM CLOUD FUNCTIONS)
// ============================================

/**
 * Abre o modal para enviar teste (ATUALIZADO v6.6.0)
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

    // (REQ 2): Listar testes já enviados
    const containerTestesEnviados = document.getElementById(
      "testes-ja-enviados-container"
    ); // Assumindo que este ID exista no HTML
    if (containerTestesEnviados) {
      const testesEnviados = dadosCandidato.testes_enviados || [];
      if (testesEnviados.length === 0) {
        containerTestesEnviados.innerHTML =
          '<p class="text-muted small" style="margin-bottom: 15px;">Nenhum teste foi enviado para este candidato ainda.</p>';
      } else {
        let testesHtml =
          '<h6 style="margin-bottom: 10px;">Testes Já Enviados:</h6><ul class="list-group mb-3">';
        testesEnviados.forEach((teste) => {
          const dataEnvio = teste.data_envio?.toDate
            ? teste.data_envio.toDate().toLocaleDateString("pt-BR")
            : "Data N/A";
          const status = teste.status || "enviado";
          testesHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong style="font-size: 0.9rem;">Teste (ID: ${
                  teste.id?.substring(0, 5) || "N/A"
                })</strong><br/>
                <small class="text-muted">Enviado em: ${dataEnvio} por ${
            teste.enviado_por || "N/A"
          }</small>
              </div>
              <span class="badge ${
                status === "respondido"
                  ? "bg-success"
                  : status === "enviado"
                  ? "bg-warning"
                  : "bg-info"
              }">${status}</span>
           </li>`;
        });
        testesHtml += "</ul><hr/>";
        containerTestesEnviados.innerHTML = testesHtml;
      }
    } else {
      console.warn(
        "Container #testes-ja-enviados-container não encontrado no HTML do modal."
      );
    }

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
      const prazoDias = teste.prazo_validade_dias || "7";
      htmlOptions += `<option value="${docSnap.id}" 
        data-link="${teste.link_teste || ""}" 
        data-tipo="${teste.tipo}"
        data-prazo="${prazoDias}">
        ${teste.titulo} (${teste.tipo.replace(
        /-/g,
        " "
      )}) - Prazo: ${prazoDias}d
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
 * Atualiza o link quando muda a seleção de teste (ATUALIZADO v6.5.2)
 */
document.addEventListener("change", (e) => {
  if (e.target.id === "teste-selecionado") {
    const option = e.target.selectedOptions[0];
    const linkInput = document.getElementById("teste-link");
    const prazoDisplay = document.getElementById("teste-prazo");
    const linkTeste = option.getAttribute("data-link");
    const prazoDias = option.getAttribute("data-prazo") || "7";

    if (linkInput) {
      // (CORREÇÃO v6.5.2)
      if (linkTeste) {
        linkInput.value = linkTeste;
      } else {
        // CORRIGIDO: Usa o domínio correto
        linkInput.value = `https://intranet.eupsico.org.br/public/avaliacao-publica.html?id=${option.value}`;
      }
      console.log(`✅ Link atualizado: ${linkInput.value}`);
    }

    // EXIBE O PRAZO
    if (prazoDisplay) {
      prazoDisplay.textContent = `Prazo: ${prazoDias} dias`;
      prazoDisplay.style.display = "block";
    }
  }
});

/**
 * ✅ CLOUD FUNCTION: Envia teste via WhatsApp
 * Chama a Cloud Function "gerarTokenTeste" para criar um token seguro
 */
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-enviar-teste-whatsapp") {
    enviarTesteWhatsApp();
  }
});

async function enviarTesteWhatsApp() {
  console.log(
    "🔹 Entrevistas: Enviando teste via WhatsApp (com Cloud Function)"
  );

  const candidatoId = modalEnviarTeste?.dataset.candidaturaId;
  const testeId = document.getElementById("teste-selecionado")?.value;
  const telefone = dadosCandidatoAtual?.telefone_contato;
  const mensagemPersonalizada =
    document.getElementById("teste-mensagem")?.value;
  const btnEnviar = document.getElementById("btn-enviar-teste-whatsapp");

  if (!testeId || !telefone) {
    window.showToast?.("Preencha todos os campos obrigatórios", "error");
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando link...';

  try {
    // CHAMA CLOUD FUNCTION: gerarTokenTeste
    console.log(`🔹 Chamando Cloud Function: gerarTokenTeste`);

    const responseGerarToken = await fetch(CF_GERAR_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatoId: candidatoId,
        testeId: testeId,
        prazoDias: 7,
      }),
    });

    const dataToken = await responseGerarToken.json();

    if (!dataToken.sucesso) {
      throw new Error(dataToken.erro || "Erro ao gerar token");
    }

    console.log("✅ Token gerado pela Cloud Function:", dataToken.token);

    // USA O LINK RETORNADO PELA CLOUD FUNCTION
    const linkComToken = dataToken.urlTeste;
    const nomeTesteElement = document.querySelector(
      `#teste-selecionado option[value="${testeId}"]`
    );
    const nomeTeste = nomeTesteElement?.textContent || "Teste";
    const prazoDias = dataToken.prazoDias || 7;

    // MONTA MENSAGEM COM PRAZO
    const mensagemPadrao = `
🎯 *Olá ${dadosCandidatoAtual.nome_completo || "Candidato"}!* 🎯

Chegou a hora de você realizar o próximo teste da sua avaliação!

📋 *Teste:* ${nomeTeste}

🔗 *Clique no link abaixo para realizar o teste:*
${linkComToken}

⏱️ *Tempo estimado para responder:* 30-45 minutos

⏰ *Prazo para responder:* ${prazoDias} dias a partir do recebimento deste link

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

    // ABRE WHATSAPP
    window.open(linkWhatsApp, "_blank");

    // SALVA O ENVIO DO TESTE NO FIRESTORE
    await salvarEnvioTeste(
      candidatoId,
      testeId,
      linkComToken,
      dataToken.tokenId
    );

    window.showToast?.("✅ Teste enviado! WhatsApp aberto", "success");
    console.log("✅ Teste enviado via WhatsApp com TOKEN da Cloud Function");

    // Fecha modal após 2 segundos
    setTimeout(() => {
      fecharModalEnvioTeste();
      const state = getGlobalState();
      const { handleTabClick, statusCandidaturaTabs } = state;
      const activeTab =
        statusCandidaturaTabs?.querySelector(".tab-link.active");
      if (activeTab) handleTabClick({ currentTarget: activeTab });
    }, 2000);
  } catch (error) {
    console.error("❌ Erro ao enviar teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
  }
}

/**
 * ✅ Salva o envio do teste no Firestore (histórico) (ATUALIZADO v6.7.0)
 */
async function salvarEnvioTeste(candidatoId, testeId, linkTeste, tokenId) {
  console.log(`🔹 Salvando envio de teste: ${candidatoId}`);

  // ============================================
  // ✅ INÍCIO DA ATUALIZAÇÃO (REQ 2)
  // ============================================
  const usuarioNome = await getCurrentUserName();
  // ============================================
  // ✅ FIM DA ATUALIZAÇÃO
  // ============================================

  try {
    const candidatoRef = doc(db, "candidaturas", candidatoId);

    await updateDoc(candidatoRef, {
      status_recrutamento: "Testes Pendente (Enviado)",
      testes_enviados: arrayUnion({
        id: testeId,
        tokenId: tokenId,
        link: linkTeste,
        data_envio: new Date(),
        enviado_por: usuarioNome, // ✅ REQ 2
        status: "enviado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Teste enviado via Cloud Function. Token: ${
          tokenId?.substring(0, 8) || "N/A"
        }...`,
        usuario: usuarioNome, // ✅ REQ 2
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
  const btnSalvar = document.getElementById("btn-salvar-teste-apenas");

  if (!testeId || !linkTeste) {
    window.showToast?.("Selecione um teste", "error");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  try {
    await salvarEnvioTeste(candidatoId, testeId, linkTeste, "manual-save");
    window.showToast?.("Teste salvo com sucesso!", "success");

    fecharModalEnvioTeste();
    const state = getGlobalState();
    const { handleTabClick, statusCandidaturaTabs } = state;
    const activeTab = statusCandidaturaTabs?.querySelector(".tab-link.active");
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Apenas';
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
 * ✅ ATUALIZADO (v6.4.0)
 * Gerencia a exibição dos campos "Pontos Fortes" e "Pontos de Atenção"
 * com base na seleção do resultado (Aprovado/Reprovado).
 */
function toggleCamposAvaliacaoRH() {
  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const radioAprovado = form.querySelector(
    'input[name="resultado_entrevista"][value="Aprovado"]'
  );
  const radioReprovado = form.querySelector(
    'input[name="resultado_entrevista"][value="Reprovado"]'
  );

  // Encontra os 'form-group' (elementos pais) dos textareas
  const containerPontosFortes = document
    .getElementById("pontos-fortes")
    ?.closest(".form-group");
  const containerPontosAtencao = document
    .getElementById("pontos-atencao")
    ?.closest(".form-group");

  const textareaPontosFortes = document.getElementById("pontos-fortes");
  const textareaPontosAtencao = document.getElementById("pontos-atencao");

  if (
    !containerPontosFortes ||
    !containerPontosAtencao ||
    !textareaPontosAtencao ||
    !textareaPontosFortes
  ) {
    console.warn(
      "toggleCamposAvaliacaoRH: Não foi possível encontrar os containers ou textareas."
    );
    return;
  }

  if (radioAprovado && radioAprovado.checked) {
    containerPontosFortes.style.display = "block";
    textareaPontosFortes.required = true;
    containerPontosAtencao.style.display = "none";
    textareaPontosAtencao.required = false;
  } else if (radioReprovado && radioReprovado.checked) {
    containerPontosFortes.style.display = "none";
    textareaPontosFortes.required = false;
    containerPontosAtencao.style.display = "block";
    textareaPontosAtencao.required = true;
  } else {
    // Estado inicial (nenhum selecionado)
    containerPontosFortes.style.display = "none";
    containerPontosAtencao.style.display = "none";
    textareaPontosFortes.required = false;
    textareaPontosAtencao.required = false;
  }
}

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

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  // Botão Ver Currículo (Movido para o Footer)
  const btnVerCurriculo = document.getElementById(
    "entrevista-rh-ver-curriculo"
  );
  const modalFooter = modalAvaliacaoRH.querySelector(".modal-footer");

  if (btnVerCurriculo && modalFooter) {
    btnVerCurriculo.href = linkCurriculo;

    if (!linkCurriculo || linkCurriculo === "#") {
      btnVerCurriculo.style.display = "none";
    } else {
      btnVerCurriculo.style.display = "inline-flex";
    }

    btnVerCurriculo.classList.add("action-button");
    btnVerCurriculo.style.marginRight = "auto";
    btnVerCurriculo.target = "_blank";
    btnVerCurriculo.innerHTML =
      '<i class="fas fa-file-alt me-2"></i> Ver Currículo';
    btnVerCurriculo.style.backgroundColor = "#ff9800";
    btnVerCurriculo.style.borderColor = "#ff9800";
    btnVerCurriculo.style.color = "white";

    modalFooter.prepend(btnVerCurriculo);
  }

  if (form) form.reset();

  // Preenche dados da avaliação existente
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

  // Adicionar listeners para os radio buttons
  const radiosResultado = form.querySelectorAll(
    'input[name="resultado_entrevista"]'
  );
  radiosResultado.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoRH);
    radio.addEventListener("change", toggleCamposAvaliacaoRH);
  });

  // Chamar a função uma vez para setar o estado inicial
  toggleCamposAvaliacaoRH();

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
 * Submete a avaliação da Entrevista RH (ATUALIZADO v6.7.0)
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

  console.log("🔹 Entrevistas: Submetendo avaliação");

  // (CORREÇÃO v6.3.0)
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

  if (!candidaturaId || !btnRegistrarAvaliacao) {
    console.error(
      "❌ Erro crítico: ID da candidatura ou botão de registro não encontrado."
    );
    return;
  }

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

  // (VALIDAÇÃO v6.4.0)
  if (
    resultado === "Aprovado" &&
    (!pontosFortes || pontosFortes.trim().length === 0)
  ) {
    window.showToast?.(
      "Para aprovar, é obrigatório preencher os Pontos Fortes.",
      "error"
    );
    return;
  }

  if (
    resultado === "Reprovado" &&
    (!pontosAtencao || pontosAtencao.trim().length === 0)
  ) {
    window.showToast?.(
      "Para reprovar, é obrigatório preencher os Motivos da Reprovação (Pontos de Atenção).",
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

  // ============================================
  // ✅ INÍCIO DA ATUALIZAÇÃO (REQ 2)
  // ============================================
  const avaliadorNome = await getCurrentUserName();
  // ============================================
  // ✅ FIM DA ATUALIZAÇÃO
  // ============================================

  const dadosAvaliacao = {
    resultado: resultado,
    data_avaliacao: new Date(),
    avaliador_nome: avaliadorNome, // REQ 2
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontos_fortes: isAprovado ? pontosFortes : "", // Salva pontos fortes só se aprovado
    pontos_atencao: !isAprovado ? pontosAtencao : "", // Salva pontos de atenção só se reprovado
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
        usuario: avaliadorNome, // REQ 2
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
