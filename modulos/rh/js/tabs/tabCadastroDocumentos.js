/**
 * Arquivo: modulos/rh/js/tabs/tabCadastroDocumentos.js
 * Versão: 1.5.0 (Correção: Botão só habilita após link gerado + Correção de parâmetros)
 * Descrição: Gerencia a etapa de envio do formulário de cadastro/documentos ao candidato.
 */

import { getGlobalState } from "../admissao.js";
import {
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";
import {
  httpsCallable,
  functions,
} from "../../../../assets/js/firebase-init.js";

let dadosCandidatoAtual = null;

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarCadastroDocumentos(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos aguardando cadastro...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_CADASTRO")
    );
    const snapshot = await getDocs(q);

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
        nome_candidato: cand.nome_candidato || "Candidato",
        email_pessoal: cand.email_candidato,
        email_novo: cand.admissaoinfo?.email_solicitado || "Não solicitado",
        senha_temporaria: cand.admissaoinfo?.senha_temporaria || "N/A",
        telefone_contato: cand.telefone_contato,
        vaga_titulo: vagaTitulo,
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${cand.nome_candidato || "Candidato Sem Nome"} 
       <span class="status-badge ${statusClass}">
        <i class="fas fa-tag"></i> ${statusAtual}
       </span>
      </h4>
      <p class="small-info">
       <i class="fas fa-briefcase"></i> Vaga: ${vagaTitulo}
      </p>
      <p class="small-info" style="color: var(--cor-primaria);">
       <i class="fas fa-envelope"></i> Novo E-mail: ${
         cand.admissaoinfo?.email_solicitado || "Aguardando..."
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
    conteudoAdmissao.innerHTML = listaHtml;

    document.querySelectorAll(".btn-enviar-formulario").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarFormulario(candidatoId, dados);
      });
    });

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
          alert("Erro ao carregar detalhes. Função não encontrada.");
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba de Cadastro:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

window.fecharModalEnviarFormulario = function () {
  const modal = document.getElementById("modal-enviar-formulario");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};

window.copiarLinkFormulario = function () {
  const input = document.getElementById("link-formulario-token");
  if (input) {
    input.select();
    document.execCommand("copy");
    window.showToast?.("Link copiado!", "success");
  }
};

/**
 * Abre o modal, gera o token e SÓ DEPOIS habilita o botão de envio
 */
async function abrirModalEnviarFormulario(candidatoId, dadosCodificados) {
  console.log("🎯 Abrindo modal e gerando token...");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato;

    const modalExistente = document.getElementById("modal-enviar-formulario");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-enviar-formulario";
    modal.dataset.candidaturaId = candidatoId;

    modal.innerHTML = `
      <style>
        #modal-enviar-formulario { all: initial !important; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important; font-family: inherit !important; }
        #modal-enviar-formulario .modal-container { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; max-width: 650px !important; background: #ffffff !important; border-radius: 12px !important; box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important; overflow: hidden !important; }
        #modal-enviar-formulario .modal-header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important; color: white !important; padding: 20px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
        #modal-enviar-formulario .modal-body { padding: 25px !important; background: #f8f9fa !important; }
        #modal-enviar-formulario .form-input { width: 100% !important; padding: 12px !important; border: 1px solid #ddd !important; border-radius: 6px !important; background: #e9ecef !important; margin-bottom: 15px !important; }
        #modal-enviar-formulario .btn { padding: 10px 20px !important; border-radius: 6px !important; border: none !important; cursor: pointer !important; color: white !important; font-weight: bold !important; margin-left: 10px !important; }
        .btn-cancelar { background: #6c757d !important; }
        .btn-enviar { background: #28a745 !important; }
        .btn-enviar:disabled { background: #a5d6a7 !important; cursor: not-allowed !important; } 
        .loading-area { text-align: center; padding: 20px; }
      </style>
   
      <div class="modal-container">
        <div class="modal-header">
           <h3><i class="fas fa-id-card me-2"></i> Enviar Ficha de Admissão</h3>
           <button onclick="fecharModalEnviarFormulario()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">&times;</button>
        </div>
        
        <div class="modal-body">
           <div id="loading-token" class="loading-area">
              <i class="fas fa-spinner fa-spin fa-2x"></i>
              <p style="margin-top:10px;">Gerando link seguro...</p>
           </div>

           <div id="content-token" style="display:none;">
              <p><strong>Candidato:</strong> ${dadosCandidato.nome_candidato}</p>
              <p><strong>E-mail Corporativo:</strong> ${dadosCandidato.email_novo}</p>
              
              <label style="display:block; font-weight:bold; margin-top:15px;">Link Gerado (Token Único):</label>
              <div style="display:flex; gap:10px;">
                  <input type="text" id="link-formulario-token" class="form-input" style="margin-bottom:0;" readonly>
                  <button class="btn btn-cancelar" onclick="copiarLinkFormulario()" style="background:#007bff;"><i class="fas fa-copy"></i></button>
              </div>
              
              <div style="background: #e7f3ff; padding: 10px; border-radius: 4px; font-size: 13px; color: #0056b3; margin-top: 10px;">
                <i class="fas fa-info-circle"></i> O candidato deverá acessar este link e logar com o e-mail corporativo.
              </div>
           </div>
        </div>
        
        <div class="modal-footer" style="padding: 20px; text-align: right; border-top: 1px solid #eee;">
           <button class="btn btn-cancelar" onclick="fecharModalEnviarFormulario()">Cancelar</button>
           
           <button class="btn btn-enviar" id="btn-enviar-mensagem-boas-vindas" disabled>
             <i class="fab fa-whatsapp"></i> Enviar WhatsApp e E-mail
           </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Chama a Cloud Function
    try {
      const gerarTokenFunc = httpsCallable(functions, "gerarTokenAdmissao");
      const result = await gerarTokenFunc({
        candidatoId: candidatoId,
        prazoDias: 5,
      });

      const { url } = result.data;

      // Atualiza a UI
      document.getElementById("loading-token").style.display = "none";
      document.getElementById("content-token").style.display = "block";

      const inputLink = document.getElementById("link-formulario-token");
      inputLink.value = url;

      const btnEnviar = document.getElementById(
        "btn-enviar-mensagem-boas-vindas"
      );

      // ✅ AGORA HABILITA O BOTÃO
      btnEnviar.disabled = false;

      // ✅ CORREÇÃO: Passa 'candidatoId' (string) e não 'dadosCandidato' (objeto)
      btnEnviar.onclick = () => salvarEEnviarMensagens(candidatoId, url);
    } catch (error) {
      console.error("Erro ao gerar token:", error);
      document.getElementById(
        "loading-token"
      ).innerHTML = `<p class="text-danger" style="color:red;">Erro ao gerar link: ${error.message}</p>`;
    }
  } catch (error) {
    console.error("Erro modal:", error);
    alert("Erro ao abrir modal.");
  }
}

/**
 * Salva e Envia as Mensagens
 */
async function salvarEEnviarMensagens(candidatoId, urlFormularioLink) {
  console.log("💾 Iniciando envio de boas-vindas...");

  const modal = document.getElementById("modal-enviar-formulario");
  const btnEnviar = modal?.querySelector("#btn-enviar-mensagem-boas-vindas");

  // Garante que temos o link
  const linkInput = modal?.querySelector("#link-formulario-token");
  const linkFormulario =
    urlFormularioLink || (linkInput ? linkInput.value : "");

  if (!dadosCandidatoAtual || dadosCandidatoAtual.id !== candidatoId) {
    console.error("❌ Dados do candidato não conferem com o ID");
    return;
  }

  const {
    nome_candidato,
    email_pessoal,
    email_novo,
    senha_temporaria,
    telefone_contato,
  } = dadosCandidatoAtual;

  // Validação de Senha
  if (
    !senha_temporaria ||
    senha_temporaria === "N/A" ||
    senha_temporaria === ""
  ) {
    window.fecharModalEnviarFormulario();
    if (typeof abrirModalResetSenha === "function") {
      abrirModalResetSenha(candidatoId, email_novo, nome_candidato);
    } else {
      alert("Senha temporária não encontrada e função de reset indisponível.");
    }
    return;
  }

  // Validação de Campos
  if (
    !nome_candidato ||
    !email_pessoal ||
    !email_novo ||
    !telefone_contato ||
    !linkFormulario
  ) {
    window.showToast?.("Erro: Dados do candidato incompletos.", "error");
    console.error("❌ Dados incompletos:", {
      nome_candidato,
      email_pessoal,
      email_novo,
      telefone_contato,
      linkFormulario,
    });
    return;
  }

  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    // 1. Criar no Firebase Auth
    console.log("🔄 Criando usuário no Firebase Auth...");
    const criarProfissional = httpsCallable(functions, "criarNovoProfissional");

    try {
      const resultado = await criarProfissional({
        nome: nome_candidato,
        email: email_novo,
        contato: telefone_contato,
        profissao: "",
        funcoes: ["todos"],
      });
      if (resultado.data && resultado.data.sucesso) {
        console.log("✅ Usuário criado no Auth:", resultado.data.uid);
      }
    } catch (authError) {
      console.warn(
        "⚠️ Erro ao criar usuário (provavelmente já existe):",
        authError
      );
    }

    const primeiroNome = nome_candidato.split(" ")[0];

    // 2. Enviar WhatsApp
    const mensagemWhatsApp = `Olá, ${primeiroNome}! 👋

Seja bem-vindo(a) à equipe EuPsico! Estamos muito felizes em tê-lo(a) conosco.

*📧 Suas Credenciais de Acesso*

*E-mail Corporativo:* ${email_novo}
*Senha Temporária:* ${senha_temporaria}

*⚠️ ATENÇÃO - Primeiros Passos Obrigatórios:*

*1.* Acesse seu e-mail corporativo:
🔗 https://mail.google.com

*2.* Faça login com as credenciais acima

*3.* *Troque sua senha* (o sistema solicitará automaticamente no primeiro acesso)

*4.* Após trocar a senha, acesse o formulário de cadastro:
🔗 ${linkFormulario}

*📝 Importante saber:*
• O acesso ao formulário só é liberado pelo e-mail corporativo @eupsico.org.br
• A senha temporária expira em 24 horas
• Após trocar a senha, você terá acesso completo aos sistemas

Qualquer dúvida, estamos à disposição pelo RH.

Equipe EuPsico 💙`;

    console.log("📱 Abrindo WhatsApp...");
    const telefoneLimpo = telefone_contato.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemWhatsApp);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;
    window.open(linkWhatsApp, "_blank");

    // 3. Enviar E-mail
    console.log("📨 Enviando e-mails...");
    const enviarEmailFunc = httpsCallable(functions, "enviarEmail");
    const assuntoEmail = `Boas-vindas à EuPsico - Seus dados de acesso`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h2 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; background: #f8f9fa; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .credentials-box { background: #ffffff; padding: 20px; margin: 25px 0; border-left: 4px solid #007bff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .credentials-box h3 { margin: 0 0 15px 0; color: #007bff; font-size: 18px; }
    .credentials-box p { margin: 8px 0; font-size: 15px; }
    .credential-value { background: #f0f4f8; padding: 8px 12px; border-radius: 4px; display: inline-block; font-family: 'Courier New', monospace; font-size: 14px; }
    .btn-primary { display: inline-block; background: #007bff; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; text-align: center; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 18px; margin: 25px 0; border-radius: 6px; }
    .warning-box h3 { margin: 0 0 12px 0; color: #856404; font-size: 16px; }
    .steps-box { background: #ffffff; padding: 20px; margin: 25px 0; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .steps-box h3 { margin: 0 0 15px 0; color: #28a745; font-size: 18px; }
    .steps-box ol { margin: 10px 0 0 20px; padding: 0; }
    .steps-box li { margin: 10px 0; line-height: 1.8; }
    .footer { text-align: center; padding: 25px; color: #6c757d; font-size: 13px; background: #ffffff; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🎉 Boas-vindas à EuPsico!</h2>
    </div>
    
    <div class="content">
      <div class="greeting">
        <p>Olá, <strong>${nome_candidato}</strong>!</p>
        <p>É com grande alegria que recebemos você na equipe EuPsico. Estamos ansiosos para contar com sua contribuição e talento.</p>
      </div>
      
      <div class="credentials-box">
        <h3>🔐 Suas Credenciais de Acesso</h3>
        <p><strong>E-mail Corporativo:</strong><br><span class="credential-value">${email_novo}</span></p>
        <p><strong>Senha Temporária:</strong><br><span class="credential-value">${senha_temporaria}</span></p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="https://mail.google.com" class="btn-primary" target="_blank">
            Acessar Meu E-mail
          </a>
        </div>
      </div>
      
      <div class="warning-box">
        <h3>⚠️ Ação Obrigatória nas Próximas 24 Horas</h3>
        <p>Por questões de segurança, você deve <strong>alterar sua senha</strong> no primeiro acesso. O sistema solicitará automaticamente essa alteração.</p>
        <p><strong>Importante:</strong> Após 24 horas sem alteração, a senha temporária será bloqueada.</p>
      </div>
      
      <div class="steps-box">
        <h3>📋 Próximos Passos</h3>
        <ol>
          <li>Acesse <strong>mail.google.com</strong> e faça login com suas credenciais</li>
          <li>Troque sua senha temporária quando solicitado</li>
          <li>Acesse o formulário de cadastro pelo link abaixo</li>
        </ol>
        <p style="margin-top: 15px; background: #e7f3ff; padding: 12px; border-radius: 4px;">
          <strong>📝 Importante:</strong> O formulário de cadastro só pode ser acessado usando seu e-mail corporativo @eupsico.org.br. Certifique-se de fazer login antes de clicar no link.
        </p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${linkFormulario}" class="btn-primary" style="background: #28a745;" target="_blank">
            Acessar Formulário de Cadastro
          </a>
        </div>
      </div>
      
      <p style="margin-top: 25px; font-size: 14px; color: #666;">
        Se tiver qualquer dúvida, entre em contato com o RH: <a href="mailto:rh@eupsico.org.br" style="color: #007bff;">rh@eupsico.org.br</a>
      </p>
      
      <p style="margin-top: 20px;">
        Estamos muito felizes em tê-lo(a) conosco! 🚀<br>
        <strong>Equipe EuPsico</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>Este é um e-mail automático. Por favor, não responda diretamente.</p>
      <p>© ${new Date().getFullYear()} EuPsico</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await enviarEmailFunc({
        destinatario: email_pessoal,
        assunto: assuntoEmail,
        html: emailHtml,
      });
      await enviarEmailFunc({
        destinatario: email_novo,
        assunto: assuntoEmail,
        html: emailHtml,
      });
      console.log("✅ E-mails enviados");
    } catch (emailError) {
      console.error("❌ Falha ao enviar e-mail:", emailError);
    }

    // 4. Atualizar Firestore
    const { candidatosCollection, currentUserData } = getGlobalState();
    const candidatoRef = doc(candidatosCollection, candidatoId);

    await updateDoc(candidatoRef, {
      status_recrutamento: "FORM_ENVIADO",
      "admissaoinfo.link_formulario": linkFormulario,
      "admissaoinfo.data_envio_formulario": new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `✅ Boas-vindas enviadas (WhatsApp + E-mail) e usuário criado no Firebase Auth. Credenciais: ${email_novo}`,
        usuario: currentUserData?.uid || "rh_admin",
      }),
    });

    console.log("✅ Status atualizado");
    window.showToast?.("✅ Mensagens enviadas com sucesso!", "success");

    window.fecharModalEnviarFormulario();
    renderizarCadastroDocumentos(getGlobalState());
  } catch (error) {
    console.error("❌ Erro:", error);
    alert(`Erro: ${error.message}`);
    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML =
        '<i class="fab fa-whatsapp"></i> Enviar WhatsApp e E-mail';
    }
  }
}

function abrirModalResetSenha(candidatoId, emailCorporativo, nomeCandidato) {
  console.log("🔑 Abrindo modal de reset de senha");
  const modalExistente = document.getElementById("modal-reset-senha");
  if (modalExistente) modalExistente.remove();

  const modal = document.createElement("div");
  modal.id = "modal-reset-senha";
  modal.innerHTML = `
    <style>
      #modal-reset-senha { all: initial !important; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important; font-family: inherit !important; }
      #modal-reset-senha .modal-container { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; max-width: 700px !important; background: #ffffff !important; border-radius: 12px !important; box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important; overflow: hidden !important; }
      #modal-reset-senha .modal-header { background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%) !important; color: #212529 !important; padding: 20px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
      #modal-reset-senha .modal-body { padding: 25px !important; background: #f8f9fa !important; }
      #modal-reset-senha .btn-primary { background: #ffc107 !important; color: #212529 !important; font-weight: 600 !important; padding: 12px 24px; border-radius: 6px; cursor: pointer; border: none; }
      #modal-reset-senha .btn-cancelar { background: #6c757d !important; color: white !important; padding: 12px 24px; border-radius: 6px; cursor: pointer; border: none; margin-right: 10px; }
    </style>
    <div class="modal-container">
      <div class="modal-header"><h3>Resetar Senha</h3><button onclick="fecharModalResetSenha()" style="background:none;border:none;font-size:20px;">&times;</button></div>
      <div class="modal-body">
          <p>Senha não encontrada. Gerar nova senha para <strong>${emailCorporativo}</strong>?</p>
      </div>
      <div class="modal-footer" style="padding:20px;text-align:right;">
         <button class="btn-cancelar" onclick="fecharModalResetSenha()">Cancelar</button>
         <button id="btn-confirmar-reset-senha" class="btn-primary" data-candidato-id="${candidatoId}" data-email="${emailCorporativo}">Gerar Nova Senha</button>
      </div>
    </div>
 `;
  document.body.appendChild(modal);

  document
    .getElementById("btn-confirmar-reset-senha")
    .addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      await executarResetSenha(btn.dataset.candidatoId, btn.dataset.email);
    });
}

async function executarResetSenha(candidatoId, email) {
  const btn = document.getElementById("btn-confirmar-reset-senha");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Resetando...";
  }

  try {
    const resetarSenha = httpsCallable(
      functions,
      "resetarSenhaGoogleWorkspace"
    );
    const resultado = await resetarSenha({ email: email });

    if (resultado.data && resultado.data.sucesso) {
      const { candidatosCollection, currentUserData } = getGlobalState();
      const candidatoRef = doc(candidatosCollection, candidatoId);

      await updateDoc(candidatoRef, {
        "admissaoinfo.senha_temporaria": resultado.data.novaSenha,
        "admissaoinfo.data_reset_senha": new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: `🔑 Senha resetada. Nova: ${resultado.data.novaSenha}`,
          usuario: currentUserData?.uid || "rh_admin",
        }),
      });

      fecharModalResetSenha();
      alert(`Nova senha gerada: ${resultado.data.novaSenha}`);
      renderizarCadastroDocumentos(getGlobalState());
    } else {
      throw new Error(resultado.data?.mensagem || "Erro desconhecido");
    }
  } catch (error) {
    alert(`Erro ao resetar: ${error.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Gerar Nova Senha";
    }
  }
}

function fecharModalResetSenha() {
  const modal = document.getElementById("modal-reset-senha");
  if (modal) modal.remove();
  document.body.style.overflow = "auto";
}

window.fecharModalResetSenha = fecharModalResetSenha;
