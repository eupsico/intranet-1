/**
 * Arquivo: modulos/rh/js/tabs/tabCadastroDocumentos.js
 * Versão: 1.3.0 (Botão envia WhatsApp e E-mail automático via Cloud Function)
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

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

/**
 * Renderiza a listagem de candidatos para envio do formulário de cadastro
 */
export async function renderizarCadastroDocumentos(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos aguardando cadastro...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_CADASTRO")
    );
    const snapshot = await getDocs(q); // Atualiza contagem na aba

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="cadastro-documentos"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-id-card me-2"></i> 2. Cadastro e Documentos (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum candidato aguardando o envio do formulário de cadastro.</p>';
      return;
    }

    let listaHtml = `
    <div class="description-box" style="margin-top: 15px;">
    <p>Envie o link do formulário de cadastro para os candidatos abaixo.</p>
    </div>
   <div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      const statusClass = "status-warning";

      const dadosCandidato = {
        id: candidatoId,
        nome_completo: cand.nome_completo,
        email_pessoal: cand.email_candidato, // E-mail pessoal
        email_novo: cand.admissao_info?.email_solicitado || "Não solicitado", // E-mail novo
        senha_temporaria: cand.admissao_info?.senha_temporaria || "N/A", // <<< SENHA BUSCADA AQUI
        telefone_contato: cand.telefone_contato,
        vaga_titulo: vagaTitulo,
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${cand.nome_completo || "Candidato Sem Nome"}
       <span class="status-badge ${statusClass}">
        <i class="fas fa-tag"></i> ${statusAtual}
       </span>
      </h4>
      <p class="small-info">
       <i class="fas fa-briefcase"></i> Vaga: ${vagaTitulo}
      </p>
      <p class="small-info" style="color: var(--cor-primaria);">
       <i class="fas fa-envelope"></i> Novo E-mail: ${
         cand.admissao_info?.email_solicitado || "Aguardando..."
       }
      </p>
     </div>
     
     <div class="acoes-candidato">
      <button 
       class="btn btn-sm btn-primary btn-enviar-formulario" 
       data-id="${candidatoId}"
       data-dados="${dadosCodificados}"
        style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
       <i class="fas fa-paper-plane me-1"></i> Enviar Formulário
      </button>
      <button 
       class="btn btn-sm btn-secondary btn-ver-detalhes-admissao" 
        data-id="${candidatoId}"
        data-dados="${dadosCodificados}"
        style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
        <i class="fas fa-eye me-1"></i> Detalhes
      </button>
     </div>
    </div>
   `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml; // Listeners dinâmicos para "Enviar Formulário"

    document.querySelectorAll(".btn-enviar-formulario").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarFormulario(candidatoId, dados);
      });
    }); // Listeners dinâmicos para "Detalhes"

    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          try {
            const dadosCandidato = JSON.parse(
              decodeURIComponent(dadosCodificados)
            );
            window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
          } catch (error) {
            console.error("❌ Erro ao abrir modal de detalhes:", error);
          }
        } else {
          console.warn("⚠️ Função window.abrirModalCandidato não encontrada");
          alert("Erro ao carregar detalhes. Função não encontrada.");
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba de Cadastro:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

/**
 * Abre o modal para Enviar o Link do Formulário de Cadastro
 * VERSÃO ATUALIZADA (1.3.0)
 */
function abrirModalEnviarFormulario(candidatoId, dadosCodificados) {
  console.log("🎯 Abrindo modal de envio de formulário (WhatsApp + E-mail)");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato; // Salva no estado local

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
   <style>
    #modal-enviar-formulario {
     all: initial !important; display: block !important; position: fixed !important;
     top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
     z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important;
      font-family: inherit !important;
    }
    #modal-enviar-formulario .modal-container {
     position: fixed !important; top: 50% !important; left: 50% !important;
     transform: translate(-50%, -50%) !important; max-width: 700px !important;
     background: #ffffff !important; border-radius: 12px !important;
     box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
     overflow: hidden !important; animation: modalPopupOpen 0.3s ease-out !important;
    }
    @keyframes modalPopupOpen {
     from { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
     to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    #modal-enviar-formulario .modal-header {
     background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
      color: white !important; padding: 20px !important; display: flex !important;
      justify-content: space-between !important; align-items: center !important;
    }
    #modal-enviar-formulario .modal-title {
      display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
    }
    #modal-enviar-formulario .modal-title i { font-size: 24px !important; }
    #modal-enviar-formulario .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
    #modal-enviar-formulario .modal-close {
      background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
      width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      font-size: 18px !important; transition: all 0.2s !important;
    }
    #modal-enviar-formulario .modal-body {
      padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
      background: #f8f9fa !important; font-family: inherit !important;
    }
    #modal-enviar-formulario .info-card {
      background: white !important; padding: 15px !important; border-radius: 8px !important;
      margin-bottom: 20px !important; border-left: 4px solid #17a2b8 !important;
    }
    #modal-enviar-formulario .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
    #modal-enviar-formulario .info-card strong { color: #333; }
    #modal-enviar-formulario .form-group { margin-bottom: 20px !important; }
    #modal-enviar-formulario .form-label {
      font-weight: 600 !important; margin-bottom: 8px !important; display: block !important;
      color: #333 !important; font-size: 14px !important;
    }
    #modal-enviar-formulario .form-input {
      width: 100% !important; padding: 12px !important; border: 1px solid #ddd !important;
      border-radius: 6px !important; box-sizing: border-box !important; font-size: 14px !important;
      background: #e9ecef !important;
    }
    #modal-enviar-formulario .modal-footer {
      padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important;
      display: flex !important; justify-content: space-between !important; gap: 12px !important;
    }
    #modal-enviar-formulario .btn {
      padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important;
      font-weight: 500 !important; border: none !important; display: inline-flex; gap: 8px; align-items: center;
    }
    #modal-enviar-formulario .btn-cancelar { background: #6c757d !important; color: white !important; }
    #modal-enviar-formulario .btn-copiar { background: #007bff !important; color: white !important; }
    #modal-enviar-formulario .btn-salvar { background: #28a745 !important; color: white !important; }
    #modal-enviar-formulario .btn-salvar:disabled { background: #ccc !important; }

    /* Estilos para a mensagem de boas-vindas */
    #modal-enviar-formulario .welcome-message-box {
        background: #fdfdfd !important; 
        border: 1px solid #ddd !important; 
        padding: 15px !important; 
        border-radius: 6px !important; 
        font-size: 14px !important; 
        line-height: 1.7 !important; 
        color: #333 !important;
    }
    #modal-enviar-formulario .welcome-message-box strong {
        color: #000 !important;
    }
    #modal-enviar-formulario .welcome-message-box a {
        color: #007bff !important;
        text-decoration: underline !important;
    }
   </style>
   
   <div class="modal-container">
    <div class="modal-header">
     <div class="modal-title">
      <i class="fas fa-paper-plane"></i>
      <h3>Enviar Formulário de Cadastro</h3>
     </div>
     <button class="modal-close" onclick="fecharModalEnviarFormulario()">
      <i class="fas fa-times"></i>
     </button>
    </div>
    
    <div class="modal-body">
     <div class="info-card">
      <p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
      <p><strong>E-mail Pessoal:</strong> ${dadosCandidato.email_pessoal}</p>
      <p><strong>Novo E-mail (Solicitado):</strong> ${dadosCandidato.email_novo}</p>
      <p><strong>Senha:</strong> ${dadosCandidato.senha_temporaria} (Necessária para E-mail)</p>
     </div>
     
      <div class="form-group">
           <label class="form-label" style="font-size: 16px; color: #28a745; display:flex; align-items: center; gap: 8px;">
               <i class="fas fa-envelope"></i> Conteúdo (Será enviado por E-mail)
           </label>
           <div class="welcome-message-box">
               Olá, ${dadosCandidato.nome_completo},<br><br>
               Seja bem-vindo(a) à equipe!<br><br>
               Seu novo e-mail de acesso é: <strong>${dadosCandidato.email_novo}</strong><br>
               Sua senha temporária é: <strong>${dadosCandidato.senha_temporaria}</strong><br><br>
               Acesse sua conta em: <a href="https://mail.google.com/" target="_blank">https://mail.google.com/</a><br><br>
               <strong>IMPORTANTE:</strong> Por favor, troque sua senha no primeiro acesso. Esta senha temporária expirará em 24 horas.
           </div>
       </div>

      <div class="form-group">
      <label class="form-label" for="link-formulario-cadastro" style="display:flex; align-items: center; gap: 8px;">
       <i class="fab fa-whatsapp" style="color: #25D366;"></i> Link do Formulário (Será enviado por WhatsApp):
      </label>
      <input type="text" id="link-formulario-cadastro" class="form-input" 
       value="Carregando link..." readonly>
     </div>
     <p style="font-size: 12px; color: #6c757d;">
       Ao clicar em "Enviar", o WhatsApp será aberto com o link do formulário
       e um e-mail de boas-vindas será disparado automaticamente.
     </p>
    </div>
    
    <div class="modal-footer">
     <div>
      <button type="button" class="btn btn-copiar" id="btn-copiar-link-form" onclick="copiarLinkFormulario()" disabled>
       <i class="fas fa-copy"></i> Copiar Link Formulário
      </button>
     </div>
     <div>
      <button type="button" class="btn btn-cancelar" onclick="fecharModalEnviarFormulario()">
       <i class="fas fa-times"></i> Cancelar
      </button>
      <button type="button" class="btn btn-salvar" id="btn-enviar-mensagem-boas-vindas" 
       onclick="salvarEEnviarMensagens('${candidatoId}')" disabled>
       <i class="fas fa-paper-plane"></i> Enviar WhatsApp e E-mail
      </button>
     </div>
    </div>
    </div>
  `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // --- LÓGICA DE LINK SEM TOKEN (ATUALIZADO) ---
    const linkInput = document.getElementById("link-formulario-cadastro");
    const btnCopiar = document.getElementById("btn-copiar-link-form");

    // --- ⚠️ ATUALIZAÇÃO AQUI ---
    // Habilita o novo botão
    const btnEnviar = document.getElementById(
      "btn-enviar-mensagem-boas-vindas"
    );
    // --- ⚠️ FIM DA ATUALIZAÇÃO ---

    try {
      // Define o link do formulário (sem token)
      linkInput.value = linkFormularioBase;

      // Habilita os botões
      btnCopiar.disabled = false;
      // --- ⚠️ ATUALIZAÇÃO AQUI ---
      btnEnviar.disabled = false;
      // --- ⚠️ FIM DA ATUALIZAÇÃO ---
    } catch (error) {
      console.error("Erro ao definir link:", error);
      linkInput.value = "Erro ao gerar link. Tente novamente.";
      window.showToast?.("Erro ao gerar link.", "error");
    }
    // --- FIM DA LÓGICA DO LINK ---
  } catch (error) {
    console.error("❌ Erro ao criar modal de envio de formulário:", error);
    alert("Erro ao abrir modal.");
  }
}

/**
 * Fecha o modal de envio de formulário
 */
window.fecharModalEnviarFormulario = function () {
  console.log("❌ Fechando modal de envio de formulário");
  const modal = document.getElementById("modal-enviar-formulario");
  if (modal) {
    modal.remove();
  }
  document.body.style.overflow = "";
};

/**
 * Copia o link do formulário
 */
window.copiarLinkFormulario = function () {
  const input = document.getElementById("link-formulario-cadastro");
  if (input) {
    input.select();
    document.execCommand("copy");
    window.showToast?.("Link copiado!", "success");
  }
};

/**
 * ⚠️ FUNÇÃO ATUALIZADA (v1.3.2)
 * Salva, abre WhatsApp (com instruções) e dispara E-mail (com novo CSS e link do formulário)
 */
window.salvarEEnviarMensagens = async function (candidatoId) {
  console.log("💾 Iniciando envio de boas-vindas (WhatsApp e E-mail)...");

  const modal = document.getElementById("modal-enviar-formulario");
  const btnEnviar = modal?.querySelector("#btn-enviar-mensagem-boas-vindas");
  const linkInput = modal?.querySelector("#link-formulario-cadastro");

  // 1. Validar se temos os dados do candidato (setados no abrirModal)
  if (!dadosCandidatoAtual || dadosCandidatoAtual.id !== candidatoId) {
    console.error(
      "❌ Erro: Dados do candidato atual não encontrados ou inconsistentes."
    );
    window.showToast?.("Erro: Dados do candidato não carregados.", "error");
    return;
  }

  // 2. Coletar todos os dados necessários
  const {
    nome_completo,
    email_pessoal, // Vem de email_candidato
    email_novo, // Vem de email_solicitado
    senha_temporaria,
    telefone_contato,
  } = dadosCandidatoAtual;

  const linkFormulario = linkInput ? linkInput.value : "";

  if (
    !nome_completo ||
    !email_pessoal ||
    !email_novo ||
    !senha_temporaria ||
    !telefone_contato ||
    !linkFormulario
  ) {
    window.showToast?.(
      "Erro: Dados do candidato incompletos (Verifique E-mail, Senha e Telefone).",
      "error"
    );
    console.error("❌ Dados incompletos:", dadosCandidatoAtual);
    return;
  }

  if (senha_temporaria === "N/A") {
    window.showToast?.(
      "Erro: Senha temporária não encontrada. Verifique a Etapa 1.",
      "error"
    );
    return;
  }

  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    // === 3. AÇÃO 1: Abrir WhatsApp ===
    console.log("📱 Abrindo WhatsApp...");
    const telefoneLimpo = telefone_contato.replace(/\D/g, "");

    // --- ⚠️ MENSAGEM WHATSAPP ATUALIZADA ---
    const mensagemWhatsApp = `🎉 Olá, ${nome_completo}! Seja bem-vindo(a) à EuPsico!
    
Sua conta de e-mail corporativa foi criada.
        
*Estes são seus dados de acesso:*
*E-mail:* ${email_novo}
*Senha Temporária:* ${senha_temporaria}
    
*Próximos Passos OBRIGATÓRIOS:*
1. Acesse: https://mail.google.com/
2. Faça login com seu novo e-mail e senha temporária.
3. *Você será solicitado(a) a trocar sua senha.* É muito importante que faça isso.
4. Após trocar a senha, *verifique a caixa de entrada do seu NOVO e-mail*. Lá você encontrará um e-mail de boas-vindas com o link para o formulário de cadastro.
    
Qualquer dúvida, fale com o RH.`;

    const mensagemCodificada = encodeURIComponent(mensagemWhatsApp);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;
    window.open(linkWhatsApp, "_blank");

    // === 4. AÇÃO 2: Enviar E-mail (Cloud Function) ===

    console.log("📨 Chamando Cloud Function 'enviarEmail' (duas vezes)...");
    const enviarEmailFunc = httpsCallable(functions, "enviarEmail");

    // --- ⚠️ E-MAIL HTML ATUALIZADO (COM CSS) ---
    const assuntoEmail = `🎉 Bem-vindo(a) à EuPsico! Seus próximos passos estão aqui.`;

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        /* Estilo do Header (Verde do Onboarding) */
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h2 { margin: 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        /* Estilo da Info-Box (Azul para Acesso) */
        .info-box { background: #ffffff; padding: 20px; margin: 20px 0; border-left: 5px solid #007bff; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .info-box p { margin: 10px 0; }
        .info-box strong { color: #003d7a; }
        /* Botão de Ação (Primário - Azul) */
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: bold; text-align: center; }
        /* Info-Box de Próximo Passo (Amarelo) */
        .next-step-box { background: #fff3cd; padding: 20px; margin: 25px 0; border-left: 5px solid #ffc107; border-radius: 5px; }
        .next-step-box h3 { margin-top: 0; color: #856404; }
        .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🎉 Bem-vindo(a), ${nome_completo}!</h2>
        </div>
        <div class="content">
          <p>Estamos muito felizes em ter você na equipe EuPsico!</p>
          <p>Criamos seu e-mail corporativo. Abaixo estão seus dados de acesso:</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #007bff;">Seus Dados de Acesso</h3>
            <p><strong>E-mail:</strong> ${email_novo}</p>
            <p><strong>Senha Temporária:</strong> ${senha_temporaria}</p>
            <p style="font-size: 0.9em; color: #dc3545;"><strong>IMPORTANTE:</strong> Você deve alterar esta senha no seu primeiro login.</p>
            <div style="text-align: center;">
              <a href="https://mail.google.com/" class="button" target="_blank">
                Acessar o E-mail (Gmail)
              </a>
            </div>
          </div>
          
          <div class="next-step-box">
            <h3>➡️ Seu Próximo Passo: O Formulário</h3>
            <p>Após fazer login e trocar sua senha, o próximo passo é preencher nosso formulário de cadastro e documentos.</p>
            <p><strong>Atenção:</strong> Você *só* conseguirá acessar o link abaixo se estiver logado(a) com a sua nova conta <strong>@eupsico.org.br</strong>.</p>
            <div style="text-align: center;">
              <a href="${linkFormulario}" class="button" style="background: #28a745;" target="_blank">
                Acessar Formulário de Cadastro
              </a>
            </div>
          </div>
          
        </div>
        <div class="footer">
          <p>Este é um e-mail automático. Por favor, não responda.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      // 1. Envia para o E-MAIL PESSOAL
      console.log(`Enviando e-mail para ${email_pessoal}...`);
      await enviarEmailFunc({
        destinatario: email_pessoal,
        assunto: assuntoEmail,
        html: emailHtml,
        // 'remetente' é opcional na CF, usará o padrão "EuPsico <atendimento@eupsico.org.br>"
      });

      // 2. Envia para o E-MAIL CORPORATIVO
      console.log(`Enviando e-mail para ${email_novo}...`);
      await enviarEmailFunc({
        destinatario: email_novo,
        assunto: assuntoEmail,
        html: emailHtml,
      });

      console.log("✅ E-mails de boas-vindas enviados com sucesso.");
    } catch (emailError) {
      // Se um dos e-mails falhar, o processo para e avisa o usuário.
      console.error("❌ Falha ao enviar um dos e-mails:", emailError);
      throw new Error(
        `Falha ao enviar e-mail: ${emailError.message}. O WhatsApp pode ter sido aberto, mas o e-mail falhou.`
      );
    }
    // --- ⚠️ FIM DA MUDANÇA ---

    // === 5. AÇÃO 3: Atualizar Firestore ===
    console.log("💾 Atualizando Firestore...");
    const { candidatosCollection, currentUserData } = getGlobalState();
    const candidatoRef = doc(candidatosCollection, candidatoId);
    const novoStatus = "AGUARDANDO_PREENCHIMENTO_FORM";

    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatus,
      historico: arrayUnion({
        data: new Date(),
        acao: `Boas-vindas (Email/WhatsApp) e link do formulário enviados. E-mail: ${email_novo}.`,
        usuario: currentUserData.id || "rh_admin",
      }),
    });

    console.log(`✅ Status do candidato atualizado para ${novoStatus}`);
    window.showToast?.("Mensagens enviadas e candidato movido!", "success");

    window.fecharModalEnviarFormulario();
    renderizarCadastroDocumentos(getGlobalState()); // Recarrega a aba
  } catch (error) {
    console.error("❌ Erro ao enviar mensagens ou salvar:", error);
    alert(`Erro: ${error.message}. Verifique o console.`);
    window.showToast?.(`Erro: ${error.message}`, "error");

    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML =
        '<i class="fas fa-paper-plane"></i> Enviar WhatsApp e E-mail';
    }
  }
};
