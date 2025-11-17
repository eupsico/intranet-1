/**
 * Arquivo: modulos/rh/tabs/tabEntrevistas.js
 * Versão: 7.0.0 (Corrigido - Sem Abas que não funcionam)
 * Data: 17/11/2025
 * Descrição: Gerencia Entrevistas, Testes e Avaliações com Cloud Functions
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
} from "../../../assets/js/firebase-init.js";

// ============================================================
// VARIÁVEIS DE ESTADO
// ============================================================
let dadosCandidatoAtual = null;

// ============================================================
// CLOUD FUNCTIONS - URLs
// ============================================================
const CLOUDFUNCTIONSBASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CFGERARTOKEN = CLOUDFUNCTIONSBASE + "/gerarTokenTeste";
const CFVALIDARTOKEN = CLOUDFUNCTIONSBASE + "/validarTokenTeste";
const CFSALVARRESPOSTAS = CLOUDFUNCTIONSBASE + "/salvarRespostasTeste";

// ============================================================
// ELEMENTOS DO DOM
// ============================================================
const modalEnviarTeste = document.getElementById("modal-enviar-teste");
const formEnviarTeste = document.getElementById("form-enviar-teste");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Busca o nome do usuário logado na coleção usuarios
 */
async function getCurrentUserName() {
  try {
    const user = auth.currentUser;
    if (!user) return "rhsystemuser";

    const userDocRef = doc(db, "usuarios", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return userData.nome || userData.email || user.uid;
    } else {
      return user.email || user.uid;
    }
  } catch (error) {
    console.error("Erro ao buscar nome do usuário:", error);
    return "rhsystemuser";
  }
}

/**
 * Formata uma mensagem humanizada de agendamento para WhatsApp
 */
function formatarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  const [ano, mes, dia] = dataEntrevista.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = horaEntrevista.split(":");
  const horaFormatada = `${horas}:${minutos}`;
  const nomeCandidato = candidato.nomecompleto || "Candidato(a)";

  const mensagem = `
Parabéns ${nomeCandidato}! 

Sua candidatura foi aprovada na Triagem e você foi selecionado(a) para a próxima etapa!

📅 Data da Entrevista com RH: ${dataFormatada}
🕐 Horário: ${horaFormatada}

**Próximos Passos:**
1. Confirme sua presença nesta data
2. Prepare-se para conversar sobre seu perfil
3. Tenha seus documentos em mãos

Estamos ansiosos para conhecê-lo(a) melhor! 

Siga a EuPsico nas redes sociais:
📱 Instagram: @eupsico
💼 LinkedIn: @company/eupsico
🌐 Site: www.eupsico.com.br

Se tiver dúvidas, entre em contato conosco!

Abraços,
Equipe de Recrutamento - EuPsico
  `.trim();

  return mensagem;
}

/**
 * Envia mensagem de WhatsApp com agendamento
 */
function enviarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  if (!candidato.telefonecontato) {
    console.warn("Entrevistas: Telefone não disponível para envio de WhatsApp");
    return;
  }

  try {
    const mensagem = formatarMensagemWhatsApp(
      candidato,
      dataEntrevista,
      horaEntrevista
    );
    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = candidato.telefonecontato.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    window.open(linkWhatsApp, "blank");
    console.log("Entrevistas: Link WhatsApp gerado com sucesso");
  } catch (error) {
    console.error("Entrevistas: Erro ao gerar mensagem WhatsApp:", error);
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
  console.log("Entrevistas: Fechando modal de agendamento");
  const modalOverlay = document.getElementById("modal-agendamento-rh");
  if (modalOverlay) modalOverlay.classList.remove("is-visible");
}

/**
 * Fecha o modal de avaliação RH
 */
function fecharModalAvaliacao() {
  console.log("Entrevistas: Fechando modal de avaliação");
  const modalOverlay = document.getElementById("modal-avaliacao-rh");
  if (modalOverlay) modalOverlay.classList.remove("is-visible");
}

/**
 * Fecha o modal de envio de teste
 */
function fecharModalEnvioTeste() {
  console.log("Entrevistas: Fechando modal de envio de teste");
  if (modalEnviarTeste) modalEnviarTeste.classList.remove("is-visible");
  if (formEnviarTeste) formEnviarTeste.reset();
}

/**
 * Função auxiliar para formatar data
 */
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

/**
 * Carrega respostas do teste respondido
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

    // Tempo gasto
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

// ============================================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================================

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações
 */
export async function renderizarEntrevistas(state) {
  console.log("Entrevistas: Iniciando renderização");

  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `<p class="alert alert-info">Nenhuma vaga selecionada.</p>`;
    console.log("Entrevistas: Vaga não selecionada");
    return;
  }

  conteudoRecrutamento.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const q = query(
      candidatosCollection,
      where("vagaid", "==", vagaSelecionadaId),
      where("statusrecrutamento", "in", [
        "Triagem Aprovada",
        "Entrevista Pendente",
        "Entrevista RH Aprovada",
        "Testes Pendente",
        "Testes Pendente Enviado",
      ])
    );

    const snapshot = await getDocs(q);
    const tab = statusCandidaturaTabs.querySelector(
      '[data-status="entrevistas"]'
    );

    if (tab) {
      tab.innerHTML = `<i class="fas fa-comments me-2"></i> 3. Entrevistas e Avaliações (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `<p class="alert alert-warning">Nenhum candidato na fase de Entrevistas/Avaliações.</p>`;
      console.log("Entrevistas: Nenhum candidato encontrado");
      return;
    }

    let listaHtml = `<div class="candidatos-container candidatos-grid">`;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.statusrecrutamento || "N/A";
      let corStatus = "info";

      if (statusAtual.includes("Aprovada")) corStatus = "success";
      else if (statusAtual.includes("Testes")) corStatus = "warning";

      const telefone = cand.telefonecontato
        ? cand.telefonecontato.replace(/\D/g, "")
        : null;
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}`
        : null;

      listaHtml += `
        <div class="card card-candidato-triagem" data-id="${candidatoId}">
          <div class="info-primaria">
            <h4>${cand.nomecompleto || "Candidato Sem Nome"}</h4>
            <p>Status: <span class="status-badge status-${corStatus}">${statusAtual.replace(
        / /g,
        "-"
      )}</span></p>
          </div>
          <div class="info-contato">
            <a href="${linkWhatsApp || "#"}" target="blank" class="whatsapp ${
        !telefone ? "disabled" : ""
      }">
              <i class="fab fa-whatsapp me-1"></i>
              ${cand.telefonecontato || "N/A - Sem WhatsApp"}
            </a>
          </div>
          <div class="acoes-candidato">
            <button class="action-button info btn-detalhes-entrevista" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
        cand
      ).replace(/'/g, "&#39;")}'>
              <i class="fas fa-info-circle me-1"></i> Detalhes
            </button>
      `;

      // Botões conforme status
      if (statusAtual.includes("Entrevista Pendente")) {
        listaHtml += `
          <button class="action-button secondary btn-agendar-rh" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
          cand
        ).replace(/'/g, "&#39;")}'>
            <i class="fas fa-calendar-alt me-1"></i> Agendar RH
          </button>
          <button class="action-button primary btn-avaliar-rh" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
          cand
        ).replace(/'/g, "&#39;")}'>
            <i class="fas fa-edit me-1"></i> Avaliar RH
          </button>
        `;
      } else if (
        statusAtual === "Entrevista RH Aprovada" ||
        statusAtual === "Testes Pendente" ||
        statusAtual === "Testes Pendente Enviado"
      ) {
        listaHtml += `
          <button class="action-button primary btn-enviar-teste" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
          cand
        ).replace(/'/g, "&#39;")}'>
            <i class="fas fa-vial me-1"></i> Enviar Teste
          </button>
          <button class="action-button success btn-avaliar-teste" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
          cand
        ).replace(/'/g, "&#39;")}'>
            <i class="fas fa-clipboard-check me-1"></i> Avaliar Teste
          </button>
        `;
      } else {
        listaHtml += `
          <button class="action-button primary btn-avaliar-rh" data-id="${candidatoId}" data-candidato-data='${JSON.stringify(
          cand
        ).replace(/'/g, "&#39;")}'>
            <i class="fas fa-eye me-1"></i> Ver Avaliação
          </button>
        `;
      }

      listaHtml += `</div></div>`;
    });

    listaHtml += `</div>`;
    conteudoRecrutamento.innerHTML = listaHtml;

    console.log("Entrevistas: Anexando listeners aos botões");

    // Listeners
    document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato?.(candidatoId, "detalhes", dados);
      });
    });

    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAgendamentoRH?.(candidatoId, dados);
      });
    });

    document.querySelectorAll(".btn-enviar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        dados.id = candidatoId;
        window.abrirModalEnviarTeste?.(candidatoId, dados);
      });
    });

    document.querySelectorAll(".btn-avaliar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        dados.id = candidatoId;
        window.abrirModalAvaliacaoTeste?.(candidatoId, dados);
      });
    });

    document.querySelectorAll(".btn-avaliar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoRH?.(candidatoId, dados);
      });
    });

    console.log("Entrevistas: Renderização concluída");
  } catch (error) {
    console.error("Entrevistas: Erro ao renderizar:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-error">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

// ============================================================
// MODAL: AGENDAMENTO RH
// ============================================================

/**
 * Abre o modal de agendamento da Entrevista RH
 */
window.abrirModalAgendamentoRH = function (candidatoId, dadosCandidato) {
  console.log("Entrevistas: Abrindo modal de agendamento para", candidatoId);

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");

  if (!modalAgendamentoRH || !form) {
    window.showToast?.("Erro: Modal de Agendamento não encontrado.", "error");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nomecompleto || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagemrh?.prerequisitosatendidos ||
    dadosCandidato.triagemrh?.comentariosgerais ||
    "N/A";
  const statusAtual = dadosCandidato.statusrecrutamento || "N/A";

  const nomeEl = document.getElementById("agendamento-rh-nome-candidato");
  const statusEl = document.getElementById("agendamento-rh-status-atual");
  const resumoEl = document.getElementById("agendamento-rh-resumo-triagem");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  form.reset();

  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);

  document
    .querySelectorAll('[data-modal-id="modal-agendamento-rh"]')
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  modalAgendamentoRH.classList.add("is-visible");
};

/**
 * Submete o agendamento da Entrevista RH
 */
async function submeterAgendamentoRH(e) {
  e.preventDefault();

  console.log("Entrevistas: Submetendo agendamento");

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const btnRegistrarAgendamento = document.getElementById(
    "btn-registrar-agendamento-rh"
  );
  const state = getGlobalState();
  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;

  const candidaturaId = modalAgendamentoRH?.dataset.candidaturaId;
  if (!candidaturaId || !btnRegistrarAgendamento) return;

  const form = document.getElementById("form-agendamento-entrevista-rh");
  if (!form) return;

  const dataEntrevista = form.querySelector("#data-entrevista-agendada")?.value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada")?.value;

  if (!dataEntrevista || !horaEntrevista) {
    window.showToast?.(
      "Por favor, preencha a data e hora da entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAgendamento.disabled = true;
  btnRegistrarAgendamento.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Processando...';

  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    ?.getAttribute("data-status");
  const usuarioNome = await getCurrentUserName();

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      statusrecrutamento: "Entrevista Pendente",
      "entrevistarh.agendamento": {
        data: dataEntrevista,
        hora: horaEntrevista,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}.`,
        usuario: usuarioNome,
      }),
    });

    window.showToast?.(
      `Entrevista RH agendada com sucesso para ${dataEntrevista} às ${horaEntrevista}.`,
      "success"
    );

    if (dadosCandidatoAtual.telefonecontato) {
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
    console.error("Entrevistas: Erro ao salvar agendamento:", error);
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

// ============================================================
// MODAL: ENVIAR TESTE
// ============================================================

/**
 * Abre o modal para enviar teste
 */
window.abrirModalEnviarTeste = async function (candidatoId, dadosCandidato) {
  console.log("Entrevistas: Abrindo modal para enviar teste", candidatoId);

  try {
    dadosCandidatoAtual = dadosCandidato;

    if (modalEnviarTeste) {
      modalEnviarTeste.dataset.candidaturaId = candidatoId;

      const nomeEl = document.getElementById("teste-nome-candidato");
      const emailEl = document.getElementById("teste-email-candidato");
      const whatsappEl = document.getElementById("teste-whatsapp-candidato");

      if (nomeEl) nomeEl.textContent = dadosCandidato.nomecompleto || "N/A";
      if (emailEl) emailEl.textContent = dadosCandidato.emailcandidato || "N/A";
      if (whatsappEl)
        whatsappEl.textContent = dadosCandidato.telefonecontato || "N/A";

      await carregarTestesDisponiveis();
      modalEnviarTeste.classList.add("is-visible");
    }
  } catch (error) {
    console.error("Erro ao abrir modal de teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
};

/**
 * Carrega testes disponíveis
 */
async function carregarTestesDisponiveis() {
  const selectTeste = document.getElementById("teste-selecionado");
  if (!selectTeste) return;

  selectTeste.innerHTML = '<option value="">Carregando testes...</option>';

  try {
    const estudosRef = collection(db, "estudosdecaso");
    const q = query(estudosRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      selectTeste.innerHTML =
        '<option value="">Nenhum teste disponível</option>';
      return;
    }

    let htmlOptions = '<option value="">Selecione um teste...</option>';
    snapshot.forEach((docSnap) => {
      const teste = docSnap.data();
      const prazoDias = teste.prazovalidadedias || 7;
      htmlOptions += `
        <option value="${docSnap.id}" data-link="${
        teste.link || ""
      }" data-prazo="${prazoDias}">
          ${teste.titulo} (${
        teste.tipo?.replace(/-/g, " ") || "Tipo"
      } - Prazo ${prazoDias}d)
        </option>
      `;
    });

    selectTeste.innerHTML = htmlOptions;
  } catch (error) {
    console.error("Erro ao carregar testes:", error);
    selectTeste.innerHTML = '<option value="">Erro ao carregar testes</option>';
  }
}

/**
 * Evento para atualizar link quando muda seleção de teste
 */
document.addEventListener("change", (e) => {
  if (e.target.id === "teste-selecionado") {
    const option = e.target.selectedOptions[0];
    const linkInput = document.getElementById("teste-link");
    const linkTeste = option?.getAttribute("data-link");

    if (linkInput) {
      if (linkTeste) {
        linkInput.value = linkTeste;
      } else {
        linkInput.value =
          "https://intranet.eupsico.org.br/publico/avaliacao-publica.html?id=" +
          option.value;
      }
    }
  }
});

/**
 * Envia teste via WhatsApp
 */
async function enviarTesteWhatsApp() {
  console.log("Entrevistas: Enviando teste via WhatsApp com Cloud Function");

  const candidatoId = modalEnviarTeste?.dataset.candidaturaId;
  const testeId = document.getElementById("teste-selecionado")?.value;
  const telefone = dadosCandidatoAtual?.telefonecontato;
  const btnEnviar = document.getElementById("btn-enviar-teste-whatsapp");

  if (!testeId || !telefone) {
    window.showToast?.("Preencha todos os campos obrigatórios", "error");
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando link...';

  try {
    // Chama Cloud Function gerarTokenTeste
    const responseGerarToken = await fetch(CFGERARTOKEN, {
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

    const linkComToken = dataToken.urlTeste;
    const nomeTeste =
      document.querySelector(`#teste-selecionado option[value="${testeId}"]`)
        ?.textContent || "Teste";
    const prazoDias = dataToken.prazoDias || 7;

    const mensagem = `Olá ${dadosCandidatoAtual.nomecompleto || "Candidato"}!

Chegou a hora de você realizar o próximo teste da sua avaliação!

**Teste:** ${nomeTeste}
**Link:** ${linkComToken}

⏱️ Tempo estimado: 30-45 minutos
📅 Prazo: ${prazoDias} dias a partir do recebimento

Boa sorte! 🚀
Equipe de Recrutamento - EuPsico`;

    const telefoneLimpo = telefone.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagem);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    window.open(linkWhatsApp, "blank");

    await salvarEnvioTeste(
      candidatoId,
      testeId,
      linkComToken,
      dataToken.tokenId
    );

    window.showToast?.("Teste enviado! WhatsApp aberto", "success");

    fecharModalEnvioTeste();

    const state = getGlobalState();
    const { handleTabClick, statusCandidaturaTabs } = state;
    const activeTab = statusCandidaturaTabs?.querySelector(".tab-link.active");
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("Erro ao enviar teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
  }
}

/**
 * Salva envio de teste
 */
async function salvarEnvioTeste(candidatoId, testeId, linkTeste, tokenId) {
  const usuarioNome = await getCurrentUserName();

  try {
    const candidatoRef = doc(db, "candidaturas", candidatoId);

    await updateDoc(candidatoRef, {
      statusrecrutamento: "Testes Pendente Enviado",
      testesenviados: arrayUnion({
        id: testeId,
        tokenId: tokenId,
        link: linkTeste,
        dataenvio: new Date(),
        enviadopor: usuarioNome,
        status: "enviado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Teste enviado. Token: ${tokenId?.substring(0, 8) || "N/A"}...`,
        usuario: usuarioNome,
      }),
    });

    console.log("Envio de teste salvo no Firestore");
  } catch (error) {
    console.error("Erro ao salvar envio:", error);
    throw error;
  }
}

/**
 * Listener para botão Salvar Apenas
 */
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-salvar-teste-apenas") {
    salvarTesteApenas();
  }
});

async function salvarTesteApenas() {
  console.log("Entrevistas: Salvando teste sem WhatsApp");

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
  } catch (error) {
    console.error("Erro:", error);
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

  if (modalEnviarTeste && e.target === modalEnviarTeste) {
    fecharModalEnvioTeste();
  }
});

// ============================================================
// MODAL: AVALIAR TESTE
// ============================================================

/**
 * Alterna visibilidade dos campos de avaliação de teste
 */
function toggleCamposAvaliacaoTeste() {
  const form = document.getElementById("form-avaliacao-teste");
  if (!form) return;

  const resultadoSelecionado = form.querySelector(
    'input[name="resultadoteste"]:checked'
  )?.value;
  const gestorContainer = document.getElementById(
    "avaliacao-teste-gestor-container"
  );

  if (!gestorContainer) return;

  if (resultadoSelecionado === "Aprovado") {
    gestorContainer.style.display = "block";
  } else {
    gestorContainer.style.display = "none";
  }
}

/**
 * Abre o modal de avaliação de testes
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

  const nomeEl = document.getElementById("avaliacao-teste-nome-candidato");
  const statusEl = document.getElementById("avaliacao-teste-status-atual");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;

  // Carregar dados dos testes
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

        const tokenId = teste.tokenId || `manual-index-${index}`;

        if (statusTeste === "respondido") {
          badgeClass = "bg-success";
          statusTexto = "Respondido";
        } else if (statusTeste === "avaliado") {
          badgeClass = "bg-info";
          statusTexto = "Avaliado";
        }

        testesHtml += `
          <div class="teste-item">
            <div class="teste-header">
              <h5 class="teste-titulo">
                <i class="fas fa-file-alt me-2"></i>
                ${teste.nomeTeste || "Teste"}
              </h5>
              <span class="badge ${badgeClass}">${statusTexto}</span>
            </div>
            <div class="teste-info">
              <p>
                <i class="fas fa-calendar me-1"></i>
                <strong>Data de Envio:</strong> ${dataEnvio}
              </p>
              <p>
                <i class="fas fa-user me-1"></i>
                <strong>Enviado por:</strong> ${teste.enviadopor || "N/A"}
              </p>
              ${
                teste.tempoGasto !== undefined
                  ? `
                <p>
                  <i class="fas fa-hourglass-end me-1"></i>
                  <strong>Tempo Gasto:</strong> ${Math.floor(
                    teste.tempoGasto / 60
                  )}m ${teste.tempoGasto % 60}s
                </p>
              `
                  : ""
              }
            </div>
          </div>
        `;
      });

      testesHtml += "</div>";
      infoTestesEl.innerHTML = testesHtml;

      // Carregar respostas
      testesEnviados.forEach((teste, index) => {
        const tokenId = teste.tokenId || `manual-index-${index}`;
        const tipoId = teste.tokenId ? "tokenId" : "testeId";
        const statusTeste = teste.status || "enviado";

        if (statusTeste === "respondido" || statusTeste === "avaliado") {
          carregarRespostasDoTeste(tokenId, tipoId, teste.id, candidatoId);
        }
      });
    }
  }

  // Carregar estatísticas
  const statsEl = document.getElementById("avaliacao-teste-stats");
  if (statsEl) {
    const totalTestes = testesEnviados.length;
    const testsRespondidos = testesEnviados.filter(
      (t) => t.status === "respondido" || t.status === "avaliado"
    ).length;
    const testsPendentes = totalTestes - testsRespondidos;

    let tempoTotal = 0;
    let testComTempo = 0;
    testesEnviados.forEach((t) => {
      if (t.tempoGasto) {
        tempoTotal += t.tempoGasto;
        testComTempo++;
      }
    });
    const tempoMedio =
      testComTempo > 0 ? Math.round(tempoTotal / testComTempo) : 0;

    const statsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #0078d4;">
          <strong style="font-size: 18px; color: #0078d4;">${totalTestes}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Total de Testes</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #28a745;">
          <strong style="font-size: 18px; color: #28a745;">${testsRespondidos}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Respondidos</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #ffc107;">
          <strong style="font-size: 18px; color: #ffc107;">${testsPendentes}</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Pendentes</p>
        </div>
        <div style="background: white; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #6f42c1;">
          <strong style="font-size: 18px; color: #6f42c1;">${
            tempoMedio > 0 ? Math.floor(tempoMedio / 60) + "m" : "N/A"
          }</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Tempo Médio</p>
        </div>
      </div>
    `;

    statsEl.innerHTML = statsHtml;
  }

  // Carregar gestores
  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const btnWhatsAppGestor = document.getElementById(
    "btn-whatsapp-gestor-avaliacao"
  );

  if (selectGestor) {
    selectGestor.innerHTML = '<option value="">Carregando gestores...</option>';

    try {
      const usuariosRef = collection(db, "usuarios");
      const q = query(usuariosRef, where("role", "==", "gestor"));
      const snapshot = await getDocs(q);

      const gestores = [];
      snapshot.forEach((doc) => {
        const dados = doc.data();
        gestores.push({
          id: doc.id,
          nome: dados.nome || dados.nomecompleto || "Gestor",
          email: dados.email || "",
          telefone: dados.telefone || dados.telefonemov || "",
        });
      });

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
      }
    } catch (error) {
      console.error("Erro ao carregar gestores:", error);
      selectGestor.innerHTML =
        '<option value="">Erro ao carregar gestores</option>';
    }
  }

  // Habilita/desabilita botão WhatsApp
  if (selectGestor && btnWhatsAppGestor) {
    selectGestor.addEventListener("change", (e) => {
      const option = e.target.selectedOptions[0];
      const telefone = option?.getAttribute("data-telefone");
      btnWhatsAppGestor.disabled = !telefone || telefone.trim() === "";
    });

    btnWhatsAppGestor.disabled = true;
  }

  form.reset();

  const radiosResultadoTeste = form.querySelectorAll(
    'input[name="resultadoteste"]'
  );
  radiosResultadoTeste.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoTeste);
    radio.addEventListener("change", toggleCamposAvaliacaoTeste);
  });

  toggleCamposAvaliacaoTeste();

  form.removeEventListener("submit", submeterAvaliacaoTeste);
  form.addEventListener("submit", submeterAvaliacaoTeste);

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
  const modalAvaliacaoTeste = document.getElementById("modal-avaliacao-teste");
  if (modalAvaliacaoTeste) {
    modalAvaliacaoTeste.classList.remove("is-visible");
  }
}

/**
 * Submete a avaliação do teste
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

  const selectGestor = document.getElementById("avaliacao-teste-gestor");
  const gestorSelecionadoId = selectGestor?.value || null;
  const gestorOption = selectGestor?.selectedOptions[0];
  const gestorNome = gestorOption?.getAttribute("data-nome") || null;

  if (!resultado) {
    window.showToast?.("Por favor, selecione o Resultado do Teste.", "error");
    return;
  }

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
    ?.getAttribute("data-status");
  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacaoTeste = {
    resultado: resultado,
    dataavaliacao: new Date(),
    avaliadornome: avaliadorNome,
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
      statusrecrutamento: novoStatusCandidato,
      avaliacaoteste: dadosAvaliacaoTeste,
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação do Teste ${isAprovado ? "APROVADO" : "REPROVADO"}. ${
          isAprovado
            ? `Gestor designado: ${gestorNome}`
            : "Processo finalizado."
        } Novo Status: ${novoStatusCandidato}`,
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
      '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
  }
}

/**
 * Envia WhatsApp para gestor
 */
window.enviarWhatsAppGestor = function () {
  console.log("Enviando WhatsApp para gestor");

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

  const nomeCandidato = dadosCandidatoAtual.nomecompleto || "Candidato(a)";
  const telefoneCandidato =
    dadosCandidatoAtual.telefonecontato || "Não informado";
  const emailCandidato = dadosCandidatoAtual.emailcandidato || "Não informado";
  const statusCandidato =
    dadosCandidatoAtual.statusrecrutamento || "Em avaliação";
  const vagaInfo = dadosCandidatoAtual.vagatitulo || "Vaga não especificada";

  const mensagem = `Olá ${nomeGestor}! 

Você foi designado(a) para avaliar um candidato que passou na fase de testes.

**👤 Candidato:** ${nomeCandidato}
**📱 Telefone:** ${telefoneCandidato}
**📧 E-mail:** ${emailCandidato}
**💼 Vaga:** ${vagaInfo}
**📊 Status Atual:** ${statusCandidato}

O candidato foi aprovado nos testes e aguarda sua avaliação para prosseguir no processo seletivo.

**Próximos Passos:**
1. Acesse o sistema de recrutamento
2. Revise o perfil e desempenho do candidato
3. Agende uma entrevista se necessário
4. Registre sua decisão final

🔗 Acesse: https://intranet.eupsico.org.br

Se tiver dúvidas, entre em contato com o RH.

Equipe de Recrutamento - EuPsico`;

  const telefoneLimpo = telefoneGestor.replace(/\D/g, "");
  const mensagemCodificada = encodeURIComponent(mensagem);
  const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

  window.open(linkWhatsApp, "blank");
  window.showToast?.("WhatsApp aberto para notificar gestor", "success");
};

// ============================================================
// MODAL: AVALIAR RH
// ============================================================

/**
 * Alterna visibilidade dos campos de avaliação RH
 */
function toggleCamposAvaliacaoRH() {
  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const radioAprovado = form.querySelector(
    'input[name="resultadoentrevista"][value="Aprovado"]'
  );
  const radioReprovado = form.querySelector(
    'input[name="resultadoentrevista"][value="Reprovado"]'
  );

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
  console.log("Entrevistas: Abrindo modal de avaliação para", candidatoId);

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const form = document.getElementById("form-avaliacao-entrevista-rh");

  if (!modalAvaliacaoRH || !form) {
    window.showToast?.("Erro: Modal de Avaliação não encontrado.", "error");
    console.error("Entrevistas: Elemento modal-avaliacao-rh não encontrado");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nomecompleto || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagemrh?.prerequisitosatendidos ||
    dadosCandidato.triagemrh?.comentariosgerais ||
    "N/A";
  const statusAtual = dadosCandidato.statusrecrutamento || "N/A";
  const linkCurriculo = dadosCandidato.linkcurriculodrive;

  const nomeEl = document.getElementById("entrevista-rh-nome-candidato");
  const statusEl = document.getElementById("entrevista-rh-status-atual");
  const resumoEl = document.getElementById("entrevista-rh-resumo-triagem");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  form.reset();

  const avaliacaoExistente = dadosCandidato.entrevistarh;
  if (avaliacaoExistente) {
    if (form.querySelector("#nota-motivacao"))
      form.querySelector("#nota-motivacao").value =
        avaliacaoExistente.notas?.motivacao || "";
    if (form.querySelector("#nota-aderencia"))
      form.querySelector("#nota-aderencia").value =
        avaliacaoExistente.notas?.aderencia || "";
    if (form.querySelector("#nota-comunicacao"))
      form.querySelector("#nota-comunicacao").value =
        avaliacaoExistente.notas?.comunicacao || "";
    if (form.querySelector("#pontos-fortes"))
      form.querySelector("#pontos-fortes").value =
        avaliacaoExistente.pontosfortes || "";
    if (form.querySelector("#pontos-atencao"))
      form.querySelector("#pontos-atencao").value =
        avaliacaoExistente.pontosatencao || "";

    if (avaliacaoExistente.resultado) {
      const radio = form.querySelector(
        `input[name="resultadoentrevista"][value="${avaliacaoExistente.resultado}"]`
      );
      if (radio) radio.checked = true;
    }
  }

  const radiosResultado = form.querySelectorAll(
    'input[name="resultadoentrevista"]'
  );
  radiosResultado.forEach((radio) => {
    radio.removeEventListener("change", toggleCamposAvaliacaoRH);
    radio.addEventListener("change", toggleCamposAvaliacaoRH);
  });

  toggleCamposAvaliacaoRH();

  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);

  document
    .querySelectorAll('[data-modal-id="modal-avaliacao-rh"]')
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  modalAvaliacaoRH.classList.add("is-visible");
  console.log("Entrevistas: Modal de avaliação aberto");
};

/**
 * Submete a avaliação da Entrevista RH
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

  console.log("Entrevistas: Submetendo avaliação");

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-entrevista-rh"
  );
  const state = getGlobalState();
  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;

  const candidaturaId = modalAvaliacaoRH?.dataset.candidaturaId;
  if (!candidaturaId || !btnRegistrarAvaliacao) {
    console.error(
      "Erro crítico: ID da candidatura ou botão de registro não encontrado."
    );
    return;
  }

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const resultado = form.querySelector(
    'input[name="resultadoentrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao")?.value;
  const notaAderencia = form.querySelector("#nota-aderencia")?.value;
  const notaComunicacao = form.querySelector("#nota-comunicacao")?.value;
  const pontosFortes = form.querySelector("#pontos-fortes")?.value;
  const pontosAtencao = form.querySelector("#pontos-atencao")?.value;

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione o Resultado da Entrevista.",
      "error"
    );
    return;
  }

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
    ? "Entrevista RH Aprovada - Testes Pendente"
    : "Rejeitado (Comunicação Pendente)";

  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    ?.getAttribute("data-status");
  const avaliadorNome = await getCurrentUserName();

  const dadosAvaliacao = {
    resultado: resultado,
    dataavaliacao: new Date(),
    avaliadornome: avaliadorNome,
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontosfortes: isAprovado ? pontosFortes : null,
    pontosatencao: !isAprovado ? pontosAtencao : null,
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      statusrecrutamento: novoStatusCandidato,
      entrevistarh: {
        ...(dadosCandidatoAtual.entrevistarh || {}),
        ...dadosAvaliacao,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Entrevista RH ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatusCandidato}`,
        usuario: avaliadorNome,
      }),
    });

    window.showToast?.(
      `Avaliação de Entrevista RH registrada. Status: ${novoStatusCandidato}`,
      "success"
    );

    console.log("Entrevistas: Avaliação salva no Firestore");
    fecharModalAvaliacao();
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("Entrevistas: Erro ao salvar avaliação:", error);
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
