/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalEnviarTeste.js
 * Versão: 2.0.0 (Status Simplificado + Código Completo)
 * Data: 09/12/2025
 * Descrição: Gerencia o modal de envio de testes (com Cloud Functions).
 */

import {
  db,
  collection,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  query,
  where,
} from "../../../../../assets/js/firebase-init.js";
import { getCurrentUserName, formatarDataEnvio } from "./helpers.js";

// ============================================
// CONSTANTES E VARIÁVEIS
// ============================================
const modalEnviarTeste = document.getElementById("modal-enviar-teste");
let dadosCandidatoAtual = null;

const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_GERAR_TOKEN = `${CLOUD_FUNCTIONS_BASE}/gerarTokenTeste`;

// ============================================
// FUNÇÕES DO MODAL (Abrir/Fechar)
// ============================================

/**
 * Fecha o modal de envio de teste
 */
function fecharModalEnvioTeste() {
  console.log("🔹 Entrevistas: Fechando modal de envio de teste");
  if (modalEnviarTeste) {
    modalEnviarTeste.classList.remove("is-visible");
    const formEnviarTeste = document.getElementById("form-enviar-teste");
    if (formEnviarTeste) {
      formEnviarTeste.reset();
    }
  }
}

/**
 * Abre o modal para enviar teste
 */
export async function abrirModalEnviarTeste(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Entrevistas: Abrindo modal para enviar teste: ${candidatoId}`
  );

  try {
    dadosCandidatoAtual = dadosCandidato;

    if (modalEnviarTeste) {
      modalEnviarTeste.dataset.candidaturaId = candidatoId;
    }

    // Preenche informações do candidato
    document.getElementById("teste-nome-candidato").textContent =
      dadosCandidato.nome_candidato || "N/A";
    document.getElementById("teste-email-candidato").textContent =
      dadosCandidato.email_candidato || "N/A";
    document.getElementById("teste-whatsapp-candidato").textContent =
      dadosCandidato.telefone_contato || "N/A";

    // Listar testes já enviados
    const containerTestesEnviados = document.getElementById(
      "testes-ja-enviados-container"
    );
    if (containerTestesEnviados) {
      const testesEnviados = dadosCandidato.testes_enviados || [];
      if (testesEnviados.length === 0) {
        containerTestesEnviados.innerHTML =
          '<p class="text-muted small" style="margin-bottom: 15px;">Nenhum teste foi enviado para este candidato ainda.</p>';
      } else {
        let testesHtml =
          '<h4 style="margin-bottom: 10px;">Testes Enviados:</h4><ul class="list-group mb-3">';
        testesEnviados.forEach((teste) => {
          const dataEnvio = formatarDataEnvio(teste.data_envio);
          const status = teste.status || "enviado";
          const testeJson = JSON.stringify(teste).replace(/'/g, "&#39;");

          testesHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong style="font-size: 0.9rem;">${
                teste.nomeTeste ||
                `Teste (ID: ${teste.id?.substring(0, 5) || "N/A"})`
              }</strong><br/>
              <small class="text-muted">Enviado em: ${dataEnvio} por ${
            teste.enviado_por || "N/A"
          }</small>
              <small class="text-muted d-block mt-1"><strong>Link:</strong> <a href="${
                teste.link || "#"
              }" target="_blank">${
            teste.link ? "Acessar Link" : "N/A"
          }</a></small>
            </div>
            <div>
              <span class="badge ${
                status === "respondido"
                  ? "bg-success"
                  : status === "enviado"
                  ? "bg-warning"
                  : "bg-info"
              }">${status}</span>
              
              <button 
                type="button" 
                class="action-button error small btn-excluir-teste-enviado" 
                style="padding: 4px 8px; margin-left: 10px;"
                data-candidato-id="${candidatoId}" 
                data-teste-obj='${testeJson}'
                title="Excluir este envio de teste">
                <i class="fas fa-trash" style="margin-right: 0;"></i>
              </button>
            </div>
          </li>`;
        });
        testesHtml += "</ul><hr/>";
        containerTestesEnviados.innerHTML = testesHtml;

        // Adiciona listeners aos novos botões de exclusão
        containerTestesEnviados
          .querySelectorAll(".btn-excluir-teste-enviado")
          .forEach((btn) => {
            btn.removeEventListener("click", handleExcluirTesteEnviado);
            btn.addEventListener("click", handleExcluirTesteEnviado);
          });
      }
    }

    // Carrega testes disponíveis
    await carregarTestesDisponiveis();

    // Abre o modal
    if (modalEnviarTeste) {
      modalEnviarTeste.classList.add("is-visible");
    }
  } catch (error) {
    console.error("❌ Erro ao abrir modal de teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

// ============================================
// LÓGICA DE EXCLUSÃO
// ============================================

/**
 * Lida com a exclusão de um teste já enviado.
 */
async function handleExcluirTesteEnviado(e) {
  const btn = e.currentTarget;
  const candidatoId = btn.dataset.candidatoId;
  const testeObjString = btn.dataset.testeObj.replace(/&#39;/g, "'");
  const testeParaExcluir = JSON.parse(testeObjString);

  const idParaExcluir = testeParaExcluir.id || testeParaExcluir.tokenId;

  if (!candidatoId || !idParaExcluir) {
    window.showToast?.(
      "Erro: ID do teste ou do candidato não encontrado.",
      "error"
    );
    return;
  }

  if (
    !confirm(
      `Tem certeza que deseja excluir o envio do teste "${
        testeParaExcluir.nomeTeste || "este teste"
      }"?\n\nEsta ação não pode ser desfeita.`
    )
  ) {
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const { candidatosCollection } = window.getGlobalRecrutamentoState();
    const candidaturaRef = doc(candidatosCollection, candidatoId);

    // 1. Obter o documento ATUAL
    const docSnap = await getDoc(candidaturaRef);
    if (!docSnap.exists()) {
      throw new Error("Documento do candidato não encontrado.");
    }

    const dadosAtuais = docSnap.data();
    const testesEnviadosAtuais = dadosAtuais.testes_enviados || [];

    // 2. Filtrar o array, removendo o teste
    const testesAtualizados = testesEnviadosAtuais.filter((teste) => {
      const testeId = teste.id || teste.tokenId;
      return testeId !== idParaExcluir;
    });

    // 3. Obter o nome do usuário para o histórico
    const usuarioNome = await getCurrentUserName();

    // 4. Atualizar o documento do candidato com o NOVO array
    await updateDoc(candidaturaRef, {
      testes_enviados: testesAtualizados, // Salva o array filtrado
      historico: arrayUnion({
        data: new Date(),
        acao: `Envio de teste EXCLUÍDO: ${
          testeParaExcluir.nomeTeste || idParaExcluir
        }.`,
        usuario: usuarioNome,
      }),
    });

    window.showToast?.("Envio de teste excluído com sucesso!", "success");

    // 5. Atualizar a UI
    btn.closest(".list-group-item").remove();

    // Atualizar o estado global local
    dadosCandidatoAtual.testes_enviados = testesAtualizados;

    const container = document.getElementById("testes-ja-enviados-container");
    if (
      container &&
      container.querySelectorAll(".list-group-item").length === 0
    ) {
      container.innerHTML =
        '<p class="text-muted small mb-3">Nenhum teste foi enviado para este candidato ainda.</p>';
    }
  } catch (error) {
    console.error("Erro ao excluir teste:", error);
    window.showToast?.(`Erro ao excluir: ${error.message}`, "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash"></i>';
  }
}

// ============================================
// LÓGICA DE ENVIO (CLOUD FUNCTION)
// ============================================

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
  } catch (error) {
    console.error("❌ Erro ao carregar testes:", error);
    selectTeste.innerHTML = '<option value="">Erro ao carregar testes</option>';
  }
}

/**
 * Chama a Cloud Function para gerar um link de teste com token.
 */
async function gerarLinkDeTesteComToken(candidatoId, testeId) {
  console.log(`🔹 Chamando Cloud Function: gerarTokenTeste`);

  const testeOption = document.querySelector(
    `#teste-selecionado option[value="${testeId}"]`
  );
  const prazoDias = parseInt(
    testeOption?.getAttribute("data-prazo") || "7",
    10
  );

  const responseGerarToken = await fetch(CF_GERAR_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidatoId, testeId, prazoDias }),
  });

  if (!responseGerarToken.ok) {
    throw new Error(
      `Erro ${responseGerarToken.status} ao chamar a Cloud Function. Verifique se a URL ${CF_GERAR_TOKEN} está correta e implantada.`
    );
  }

  const dataToken = await responseGerarToken.json();

  if (!dataToken.sucesso) {
    throw new Error(dataToken.erro || "Erro desconhecido ao gerar token");
  }

  console.log("✅ Token gerado pela Cloud Function:", dataToken.token);
  return dataToken;
}

/**
 * Envia teste via WhatsApp
 */
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
    const dataToken = await gerarLinkDeTesteComToken(candidatoId, testeId);
    const linkComToken = dataToken.urlTeste;
    const nomeTeste =
      document.querySelector(`#teste-selecionado option[value="${testeId}"]`)
        ?.text || "Teste";
    const prazoDias = dataToken.prazoDias || 7;

    const mensagemPadrao = `
🎯 *Olá ${dadosCandidatoAtual.nome_candidato || "Candidato"}!* 🎯
Chegou a hora de você realizar o próximo teste da sua avaliação!
📋 *Teste:* ${nomeTeste}
🔗 *Clique no link abaixo para realizar o teste:*
${linkComToken}
⏱️ *Tempo estimado para responder:* 30-45 minutos
⏰ *Prazo para responder:* ${prazoDias} dias
📌 *Instruções:*
✅ Acesse o link acima
✅ Leia as instruções com atenção
✅ Responda com sinceridade
✅ Nós avaliaremos suas respostas
*Boa sorte!* 🍀
*Equipe de Recrutamento - EuPsico* 💙
    `.trim();

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemFinal);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    window.open(linkWhatsApp, "_blank");
    await salvarEnvioTeste(
      candidatoId,
      testeId,
      linkComToken,
      dataToken.tokenId,
      nomeTeste
    );
    window.showToast?.("✅ Teste enviado! WhatsApp aberto", "success");

    setTimeout(() => {
      fecharModalEnvioTeste();
      const state = window.getGlobalRecrutamentoState();
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
 * Salva o envio do teste no Firestore (histórico)
 */
async function salvarEnvioTeste(
  candidatoId,
  testeId,
  linkTeste,
  tokenId,
  nomeTeste
) {
  const usuarioNome = await getCurrentUserName();
  try {
    const candidatoRef = doc(db, "candidaturas", candidatoId);

    // ✅ STATUS ATUALIZADO PARA O NOVO PADRÃO
    await updateDoc(candidatoRef, {
      status_recrutamento: "TESTE_ENVIADO",
      testes_enviados: arrayUnion({
        id: tokenId,
        testeId: testeId,
        tokenId: tokenId,
        link: linkTeste,
        data_envio: new Date(),
        enviado_por: usuarioNome,
        status: "enviado",
        nomeTeste: nomeTeste || "Teste não nomeado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Teste enviado. Token: ${tokenId?.substring(0, 8) || "N/A"}...`,
        usuario: usuarioNome,
      }),
    });
    console.log("✅ Envio de teste salvo no Firestore");
  } catch (error) {
    console.error("❌ Erro ao salvar envio:", error);
    throw error;
  }
}

/**
 * Salva o envio do teste sem enviar WhatsApp (gera token)
 */
async function salvarTesteApenas() {
  const candidatoId = modalEnviarTeste?.dataset.candidaturaId;
  const testeId = document.getElementById("teste-selecionado")?.value;
  const btnSalvar = document.getElementById("btn-salvar-teste-apenas");
  const nomeTeste =
    document.getElementById("teste-selecionado").selectedOptions[0]?.text ||
    "Teste";

  if (!testeId) {
    window.showToast?.("Selecione um teste", "error");
    return;
  }
  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando token...';

  try {
    const dataToken = await gerarLinkDeTesteComToken(candidatoId, testeId);
    const linkComToken = dataToken.urlTeste;
    await salvarEnvioTeste(
      candidatoId,
      testeId,
      linkComToken,
      dataToken.tokenId,
      nomeTeste
    );
    window.showToast?.("Teste salvo com token de acesso!", "success");

    fecharModalEnvioTeste();
    const state = window.getGlobalRecrutamentoState();
    const { handleTabClick, statusCandidaturaTabs } = state;
    const activeTab = statusCandidaturaTabs?.querySelector(".tab-link.active");
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro ao salvar teste:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Apenas';
  }
}

// ============================================
// LISTENERS DE EVENTOS (NÍVEL DO MÓDULO)
// ============================================

// Listener para atualizar o link do teste quando o <select> muda
document.addEventListener("change", (e) => {
  if (e.target.id === "teste-selecionado") {
    const option = e.target.selectedOptions[0];
    const linkInput = document.getElementById("teste-link");
    const prazoDisplay = document.getElementById("teste-prazo");
    const prazoTexto = document.getElementById("teste-prazo-texto");
    const linkTeste = option.getAttribute("data-link");
    const prazoDias = option.getAttribute("data-prazo") || "7";

    if (linkInput) {
      if (linkTeste) {
        linkInput.value = linkTeste;
      } else {
        // Fallback para o link público (sem token)
        linkInput.value = `https://intranet.eupsico.org.br/public/avaliacao-publica.html?id=${option.value}`;
      }
    }
    // Exibe o prazo (que está em um .info-card no HTML)
    if (prazoDisplay && prazoTexto) {
      prazoTexto.textContent = `Prazo: ${prazoDias} dias`;
      prazoDisplay.classList.remove("hidden");
    }
  }
});

// Listeners de clique para os botões do modal
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-enviar-teste-whatsapp") enviarTesteWhatsApp();
  if (e.target.id === "btn-salvar-teste-apenas") salvarTesteApenas();
  if (
    e.target.classList.contains("fechar-modal-teste") ||
    e.target.parentElement?.classList.contains("fechar-modal-teste")
  ) {
    fecharModalEnvioTeste();
  }
});

// Listener para fechar o modal clicando no overlay
if (modalEnviarTeste) {
  modalEnviarTeste.addEventListener("click", (e) => {
    if (e.target === modalEnviarTeste) fecharModalEnvioTeste();
  });
}
