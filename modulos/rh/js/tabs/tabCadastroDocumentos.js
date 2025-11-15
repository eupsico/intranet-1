/**
 * Arquivo: modulos/rh/js/tabs/tabCadastroDocumentos.js
 * Versão: 2.0 - Incluindo credenciais na mensagem do WhatsApp
 * Descrição: Gerencia a etapa de envio do formulário de cadastro/documentos ao candidato.
 */

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";

import {
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

// Importa a referência à Cloud Function
import {
  httpsCallable,
  functions,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// CONSTANTES
// ============================================

let dadosCandidatoAtual = null;

// Reutiliza a mesma Cloud Function de "gerarTokenTeste"
const CF_GERAR_TOKEN =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/gerarTokenTeste";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

/**
 * Renderiza a listagem de candidatos para envio do formulário de cadastro
 */
export async function renderizarCadastroDocumentos(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading">Carregando candidatos...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_CADASTRO")
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      conteudoAdmissao.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Nenhum candidato aguardando o envio do formulário de cadastro.</p>
        </div>
      `;
      return;
    }

    let listaHtml = `
      <div class="info-box">
        <i class="fas fa-file-alt"></i>
        Envie o link do formulário de cadastro para os candidatos abaixo.
      </div>
      <div class="candidatos-list">
    `;

    querySnapshot.forEach((docSnap) => {
      const cand = docSnap.data();
      const vagaTitulo =
        typeof cand.vaga === "string" ? cand.vaga : cand.vaga?.titulo || "N/A";

      listaHtml += `
        <div class="candidato-card">
          <div class="candidato-info">
            <h4>${cand.nome_completo}</h4>
            <p><strong>Vaga:</strong> ${vagaTitulo}</p>
            <p><strong>Novo E-mail:</strong> ${
              cand.admissao_info?.email_solicitado || "Aguardando..."
            }</p>
          </div>
          <div class="candidato-actions">
            <button 
              class="btn btn-primary btn-enviar-formulario"
              data-candidato-id="${docSnap.id}"
              data-candidato-dados='${encodeURIComponent(
                JSON.stringify({
                  nome_completo: cand.nome_completo,
                  email_pessoal: cand.email_pessoal || "",
                  telefone: cand.telefone || "",
                  email_novo: cand.admissao_info?.email_solicitado || "",
                })
              )}'
            >
              <i class="fas fa-paper-plane"></i> Enviar Formulário
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += `</div>`;
    conteudoAdmissao.innerHTML = listaHtml;

    // Event listeners
    document.querySelectorAll(".btn-enviar-formulario").forEach((btn) => {
      btn.addEventListener("click", () => {
        const candidatoId = btn.dataset.candidatoId;
        const dadosCodificados = btn.dataset.candidatoDados;
        abrirModalEnviarFormulario(candidatoId, dadosCodificados);
      });
    });
  } catch (error) {
    console.error("❌ Erro ao carregar candidatos:", error);
    conteudoAdmissao.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        Erro ao carregar: ${error.message}
      </div>
    `;
  }
}

// ============================================
// MODAL: ENVIAR FORMULÁRIO
// ============================================

/**
 * Abre o modal para Enviar o Link do Formulário de Cadastro
 * VERSÃO ATUALIZADA COM TOKEN SEGURO
 */
async function abrirModalEnviarFormulario(candidatoId, dadosCodificados) {
  console.log("🎯 Abrindo modal de envio de formulário (com token)");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato;

    const modalExistente = document.getElementById("modal-enviar-formulario");
    if (modalExistente) {
      modalExistente.remove();
    }

    const urlBase = window.location.origin;
    const linkFormularioBase = `${urlBase}/public/fichas-de-cadastro.html`;

    const modal = document.createElement("div");
    modal.id = "modal-enviar-formulario";
    modal.dataset.candidaturaId = candidatoId;

    modal.innerHTML = `
      <div class="modal-overlay is-visible">
        <div class="modal-content modal-wide">
          <button class="btn-fechar-modal" onclick="fecharModalEnviarFormulario()">×</button>
          <h3>📧 Enviar Formulário de Cadastro</h3>

          <div class="info-candidato">
            <p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
            <p><strong>E-mail Pessoal:</strong> ${dadosCandidato.email_pessoal}</p>
            <p><strong>Novo E-mail (Solicitado):</strong> ${dadosCandidato.email_novo}</p>
          </div>

          <div class="form-group">
            <label>🔗 Link do Formulário (será gerado automaticamente):</label>
            <input 
              type="text" 
              id="linkFormularioGerado" 
              readonly 
              placeholder="Gerando link..." 
              style="background:#f0f0f0;"
            />
            <button class="btn btn-secondary btn-copiar-link" style="margin-top:10px;" disabled>
              <i class="fas fa-copy"></i> Copiar Link
            </button>
          </div>

          <div class="alert info">
            <strong>ℹ️ Como funciona:</strong>
            <ul style="margin:10px 0 0 20px;">
              <li>Um token único e seguro será gerado para este candidato</li>
              <li>O link será enviado pelo WhatsApp com as credenciais de acesso</li>
              <li>O formulário só poderá ser acessado com este link</li>
            </ul>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="fecharModalEnviarFormulario()">Cancelar</button>
            <button class="btn btn-primary btn-confirmar-envio" disabled>
              <i class="fas fa-paper-plane"></i> Confirmar Envio
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Gerar o token
    await gerarTokenFormulario(candidatoId, linkFormularioBase);

    // Event listeners
    document
      .querySelector(".btn-copiar-link")
      .addEventListener("click", copiarLinkFormulario);
    document
      .querySelector(".btn-confirmar-envio")
      .addEventListener("click", confirmarEnvioFormulario);
  } catch (error) {
    console.error("❌ Erro ao abrir modal:", error);
    alert("Erro ao preparar o envio. Tente novamente.");
  }
}

/**
 * Gera o token via Cloud Function
 */
async function gerarTokenFormulario(candidatoId, linkBase) {
  try {
    console.log("🔑 Gerando token para candidato:", candidatoId);

    const response = await fetch(CF_GERAR_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidaturaId: candidatoId }),
    });

    const resultado = await response.json();

    if (!resultado.token) {
      throw new Error("Token não retornado pela Cloud Function");
    }

    const linkCompleto = `${linkBase}?token=${resultado.token}`;
    console.log("✅ Link gerado:", linkCompleto);

    const inputLink = document.getElementById("linkFormularioGerado");
    if (inputLink) {
      inputLink.value = linkCompleto;
      document.querySelector(".btn-copiar-link").disabled = false;
      document.querySelector(".btn-confirmar-envio").disabled = false;
    }
  } catch (error) {
    console.error("❌ Erro ao gerar token:", error);
    alert("Erro ao gerar o link. Tente novamente.");
  }
}

/**
 * Copia o link do formulário
 */
function copiarLinkFormulario() {
  const inputLink = document.getElementById("linkFormularioGerado");
  if (inputLink) {
    inputLink.select();
    document.execCommand("copy");
    alert("✅ Link copiado para a área de transferência!");
  }
}

/**
 * Confirma o envio do formulário de cadastro
 * VERSÃO 2.0 - Envia pelo WhatsApp com credenciais e instruções completas
 */
async function confirmarEnvioFormulario() {
  const modal = document.getElementById("modal-enviar-formulario");
  if (!modal) return;

  const candidaturaId = modal.dataset.candidaturaId;
  const linkGerado = document.getElementById("linkFormularioGerado")?.value;

  if (!candidaturaId || !linkGerado) {
    alert("❌ Dados incompletos. Recarregue a página e tente novamente.");
    return;
  }

  const btnConfirmar = modal.querySelector(".btn-confirmar-envio");
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    const state = getGlobalState();
    const { candidatosCollection, currentUserData } = state;

    // Buscar dados completos do candidato
    const candidatoRef = doc(candidatosCollection, candidaturaId);
    const candidatoSnap = await getDoc(candidatoRef);

    if (!candidatoSnap.exists()) {
      throw new Error("Candidato não encontrado");
    }

    const candidatoDados = candidatoSnap.data();
    const nomeCompleto = candidatoDados.nome_completo || "Colaborador";
    const telefone = candidatoDados.telefone || "";
    const emailCorporativo =
      candidatoDados.admissao_info?.email_solicitado || "";
    const senhaTemporaria =
      candidatoDados.admissao_info?.senha_temporaria || "";

    if (!telefone) {
      throw new Error("Telefone do candidato não encontrado");
    }

    if (!emailCorporativo || !senhaTemporaria) {
      throw new Error(
        "Credenciais de acesso não encontradas. Crie o e-mail corporativo primeiro."
      );
    }

    // Preparar mensagem do WhatsApp com credenciais
    const primeiroNome = nomeCompleto.split(" ")[0];

    const mensagemWhatsApp = `🎉 *Olá, ${primeiroNome}!*

Bem-vindo(a) à equipe EuPsico! 

📧 *Suas Credenciais de Acesso:*
• *E-mail:* ${emailCorporativo}
• *Senha temporária:* ${senhaTemporaria}

⚠️ *IMPORTANTE:* Você tem *24 horas* para alterar sua senha após o primeiro acesso! Após esse prazo, a senha expirará.

📋 *Próximos Passos:*

1️⃣ *Acesse seu e-mail corporativo:*
🔗 https://mail.google.com

2️⃣ *Altere sua senha* no primeiro acesso (o sistema solicitará automaticamente)

3️⃣ *Preencha o formulário de cadastro:*
🔗 ${linkGerado}

Se tiver dúvidas, entre em contato com o RH: rh@eupsico.org.br

Estamos felizes em tê-lo(a) conosco! 🚀

_EuPsico - Equipe de RH_`;

    // Abrir WhatsApp com a mensagem
    const telefoneFormatado = telefone.replace(/\D/g, "");
    const linkWhatsApp = `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(
      mensagemWhatsApp
    )}`;

    window.open(linkWhatsApp, "_blank");
    console.log("✅ WhatsApp aberto com a mensagem de boas-vindas");

    // Atualizar status no Firestore
    await updateDoc(candidatoRef, {
      status_recrutamento: "FORM_ENVIADO",
      "admissao_info.link_formulario": linkGerado,
      "admissao_info.data_envio_formulario": new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `✅ Formulário e credenciais enviados via WhatsApp. E-mail: ${emailCorporativo}`,
        usuario: currentUserData?.uid || "sistema",
      }),
    });

    console.log("✅ Status atualizado para FORM_ENVIADO");
    alert("✅ Mensagem enviada pelo WhatsApp com sucesso!");

    // Fechar modal e recarregar
    fecharModalEnviarFormulario();
    setTimeout(() => {
      renderizarCadastroDocumentos(state);
    }, 500);
  } catch (error) {
    console.error("❌ Erro ao enviar formulário:", error);
    alert(`❌ Erro ao enviar: ${error.message}`);

    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML =
        '<i class="fas fa-paper-plane"></i> Confirmar Envio';
    }
  }
}

/**
 * Fecha o modal de envio
 */
function fecharModalEnviarFormulario() {
  const modal = document.getElementById("modal-enviar-formulario");
  if (modal) {
    modal.remove();
    document.body.style.overflow = "auto";
  }
}

// Expor função globalmente
window.fecharModalEnviarFormulario = fecharModalEnviarFormulario;
