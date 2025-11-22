/**
 * Arquivo: modulos/rh/js/tabs/tabCadastroDocumentos.js
 * Versão: 1.3.0
 * Botão envia WhatsApp e E-mail automático via Cloud Function
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
} from "../../../assets/js/firebase-init.js";

// Importa a referência à Cloud Function
import { httpsCallable, functions } from "../../../assets/js/firebase-init.js";

// CONSTANTES
let dadosCandidatoAtual = null;

/**
 * RENDERIZAÇÃO DA LISTAGEM
 * Renderiza a listagem de candidatos para envio do formulário de cadastro
 */
export async function renderizarCadastroDocumentos(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML = `<div class="loading-spinner">Carregando candidatos aguardando cadastro...</div>`;

  try {
    const q = query(
      candidatosCollection,
      where("statusrecrutamento", "==", "AGUARDANDO_CADASTRO")
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusAdmissaoTabs.querySelector(
      `.tab-link[data-status="cadastro-documentos"]`
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-id-card me-2"></i> 2. Cadastro e Documentos (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML = `<p class="alert alert-info">Nenhum candidato aguardando o envio do formulário de cadastro.</p>`;
      return;
    }

    let listaHtml = `
        <div class="description-box" style="margin-top: 15px;">
            <p>Envie o link do formulário de cadastro para os candidatos abaixo.</p>
        </div>
        <div class="candidatos-container candidatos-grid">`;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulovagaoriginal || "Vaga não informada";
      const statusAtual = cand.statusrecrutamento || "N/A";
      const statusClass = "status-warning";

      const dadosCandidato = {
        id: candidatoId,
        nomecompleto: cand.nomecompleto,
        emailpessoal: cand.emailcandidato, // E-mail pessoal
        emailnovo: cand.admissaoinfo?.email_solicitado || "Não solicitado", // ← CORRIGIDO
        senhatemporaria: cand.admissaoinfo?.senha_temporaria || "N/A", // ← CORRIGIDO - SENHA BUSCADA AQUI
        telefonecontato: cand.telefonecontato,
        vagatitulo: vagaTitulo,
      };

      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
            <div class="card card-candidato-gestor" data-id="${candidatoId}">
                <div class="info-primaria">
                    <h4 class="nome-candidato">
                        ${cand.nomecompleto || "Candidato Sem Nome"}
                        <span class="status-badge ${statusClass}">
                            <i class="fas fa-tag"></i> ${statusAtual}
                        </span>
                    </h4>
                    <p class="small-info"><i class="fas fa-briefcase"></i> Vaga: ${vagaTitulo}</p>
                    <p class="small-info" style="color: var(--cor-primaria)">
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
            </div>`;
    });

    listaHtml += `</div>`;
    conteudoAdmissao.innerHTML = listaHtml;

    // Listeners dinâmicos para "Enviar Formulário"
    document.querySelectorAll(".btn-enviar-formulario").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarFormulario(candidatoId, dados);
      });
    });

    // Listeners dinâmicos para "Detalhes"
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
            console.error("Erro ao abrir modal de detalhes:", error);
          }
        } else {
          console.warn("Função window.abrirModalCandidato não encontrada");
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
 * Fecha o modal de envio de formulário
 */
window.fecharModalEnviarFormulario = function () {
  console.log("Fechando modal de envio de formulário");
  const modal = document.getElementById("modal-enviar-formulario");
  if (modal) modal.remove();
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
 * Abre o modal para Enviar o Link do Formulário de Cadastro
 * VERSÃO ATUALIZADA 1.3.1 - Corrigido listener de clique
 */
function abrirModalEnviarFormulario(candidatoId, dadosCodificados) {
  console.log("Abrindo modal de envio de formulário (WhatsApp + E-mail)");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato; // Salva no estado local

    const modalExistente = document.getElementById("modal-enviar-formulario");
    if (modalExistente) modalExistente.remove();

    const urlBase = window.location.origin;
    const linkFormularioBase = `${urlBase}/public/fichas-de-cadastro.html`;

    const modal = document.createElement("div");
    modal.id = "modal-enviar-formulario";
    modal.dataset.candidaturaId = candidatoId;

    modal.innerHTML = `
        <style>
            #modal-enviar-formulario {
                all: initial !important;
                display: block !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 999999 !important;
                background: rgba(0, 0, 0, 0.7) !important;
                font-family: inherit !important;
            }
            #modal-enviar-formulario .modal-container {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                max-width: 700px !important;
                background: #ffffff !important;
                border-radius: 12px !important;
                box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
                overflow: hidden !important;
                animation: modalPopupOpen 0.3s ease-out !important;
            }
            @keyframes modalPopupOpen {
                from { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            #modal-enviar-formulario .modal-header {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
                color: white !important;
                padding: 20px !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
            }
            #modal-enviar-formulario .modal-title {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                margin: 0 !important;
            }
            #modal-enviar-formulario .modal-title i { font-size: 24px !important; }
            #modal-enviar-formulario .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
            #modal-enviar-formulario .modal-close {
                background: rgba(255,255,255,0.2) !important;
                border: none !important;
                color: white !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 18px !important;
                transition: all 0.2s !important;
            }
            #modal-enviar-formulario .modal-body {
                padding: 25px !important;
                max-height: 500px !important;
                overflow-y: auto !important;
                background: #f8f9fa !important;
                font-family: inherit !important;
            }
            #modal-enviar-formulario .info-card {
                background: white !important;
                padding: 15px !important;
                border-radius: 8px !important;
                margin-bottom: 20px !important;
                border-left: 4px solid #17a2b8 !important;
            }
            #modal-enviar-formulario .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
            #modal-enviar-formulario .info-card strong { color: #333; }
            #modal-enviar-formulario .form-group { margin-bottom: 20px !important; }
            #modal-enviar-formulario .form-label {
                font-weight: 600 !important;
                margin-bottom: 8px !important;
                display: block !important;
                color: #333 !important;
                font-size: 14px !important;
            }
            #modal-enviar-formulario .form-input {
                width: 100% !important;
                padding: 12px !important;
                border: 1px solid #ddd !important;
                border-radius: 6px !important;
                box-sizing: border-box !important;
                font-size: 14px !important;
                background: #e9ecef !important;
            }
            #modal-enviar-formulario .modal-footer {
                padding: 20px 25px !important;
                background: white !important;
                border-top: 1px solid #e9ecef !important;
                display: flex !important;
                justify-content: space-between !important;
                gap: 12px !important;
            }
            #modal-enviar-formulario .btn {
                padding: 12px 24px !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-weight: 500 !important;
                border: none !important;
                display: inline-flex; gap: 8px; align-items: center;
            }
            #modal-enviar-formulario .btn-cancelar { background: #6c757d !important; color: white !important; }
            #modal-enviar-formulario .btn-copiar { background: #007bff !important; color: white !important; }
            #modal-enviar-formulario .btn-salvar { background: #28a745 !important; color: white !important; }
            #modal-enviar-formulario .btn-salvar:disabled { background: #ccc !important; }
            #modal-enviar-formulario .welcome-message-box {
                background: #fdfdfd !important;
                border: 1px solid #ddd !important;
                padding: 15px !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                line-height: 1.7 !important;
                color: #333 !important;
            }
            #modal-enviar-formulario .welcome-message-box strong { color: #000 !important; }
            #modal-enviar-formulario .welcome-message-box a { color: #007bff !important; text-decoration: underline !important; }
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
                    <p><strong>Candidato:</strong> ${dadosCandidato.nomecompleto}</p>
                    <p><strong>E-mail Pessoal:</strong> ${dadosCandidato.emailpessoal}</p>
                    <p><strong>Novo E-mail (Solicitado):</strong> ${dadosCandidato.emailnovo}</p>
                    <p><strong>Senha:</strong> ${dadosCandidato.senhatemporaria} (Necessária para E-mail)</p>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-size: 16px; color: #28a745; display:flex; align-items: center; gap: 8px;">
                        <i class="fas fa-envelope"></i> Conteúdo (Será enviado por E-mail)
                    </label>
                    <div class="welcome-message-box">
                        Olá, <strong>${dadosCandidato.nomecompleto}</strong>,<br><br>
                        Seja bem-vindo(a) à equipe!<br><br>
                        Seu novo e-mail de acesso é: <strong>${dadosCandidato.emailnovo}</strong><br>
                        Sua senha temporária é: <strong>${dadosCandidato.senhatemporaria}</strong><br><br>
                        Acesse sua conta em: <a href="https://mail.google.com/" target="_blank">https://mail.google.com/</a><br><br>
                        <strong>IMPORTANTE:</strong> Por favor, troque sua senha no primeiro acesso. Esta senha temporária expirará em 24 horas.
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="link-formulario-cadastro" style="display:flex; align-items: center; gap: 8px;">
                        <i class="fab fa-whatsapp" style="color: #25D366;"></i> Link do Formulário (Será enviado por WhatsApp)
                    </label>
                    <input type="text" id="link-formulario-cadastro" class="form-input" value="Carregando link..." readonly />
                </div>

                <p style="font-size: 12px; color: #6c757d;">
                    Ao clicar em "Enviar", o WhatsApp será aberto com o link do formulário e um e-mail de boas-vindas será disparado automaticamente.
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
                    <button type="button" class="btn btn-salvar" id="btn-enviar-mensagem-boas-vindas" disabled>
                        <i class="fas fa-paper-plane"></i> Enviar WhatsApp e E-mail
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // --- LÓGICA DE LINK E EVENT LISTENER ---
    const linkInput = document.getElementById("link-formulario-cadastro");
    const btnCopiar = document.getElementById("btn-copiar-link-form");
    const btnEnviar = document.getElementById(
      "btn-enviar-mensagem-boas-vindas"
    );

    // --- CORREÇÃO AQUI: ADICIONANDO O LISTENER ---
    // Adicionamos o listener de clique aqui, usando o candidatoId que está no escopo desta função.
    btnEnviar.addEventListener("click", () =>
      salvarEEnviarMensagens(candidatoId)
    );
    // --- FIM DA CORREÇÃO ---

    try {
      linkInput.value = linkFormularioBase;
      btnCopiar.disabled = false;
      btnEnviar.disabled = false; // Habilita o botão
    } catch (error) {
      console.error("Erro ao definir link:", error);
      linkInput.value = "Erro ao gerar link. Tente novamente.";
      window.showToast?.("Erro ao gerar link.", "error");
    }
  } catch (error) {
    console.error("Erro ao criar modal de envio de formulário:", error);
    alert("Erro ao abrir modal.");
  }
}

/**
 * ENVIO DE MENSAGENS DE BOAS-VINDAS (WhatsApp + E-mail)
 */
async function salvarEEnviarMensagens(candidatoId) {
  console.log("Iniciando envio de boas-vindas...");

  const modal = document.getElementById("modal-enviar-formulario");
  const btnEnviar = modal?.querySelector(".btn-enviar-mensagem-boas-vindas");
  const linkInput = modal?.querySelector("#link-formulario-cadastro");

  // Validar dados do candidato
  if (!dadosCandidatoAtual || dadosCandidatoAtual.id !== candidatoId) {
    console.error("Dados do candidato não encontrados");
    window.showToast?.("Erro: Dados do candidato não carregados.", "error");
    return;
  }

  const {
    nomecompleto,
    emailpessoal,
    emailnovo,
    senhatemporaria,
    telefonecontato,
  } = dadosCandidatoAtual;
  const linkFormulario = linkInput ? linkInput.value : "";

  // VALIDAÇÃO: Se não houver senha, abrir modal de reset
  if (!senhatemporaria || senhatemporaria === "N/A" || senhatemporaria === "") {
    console.log(
      "Senha temporária não encontrada para o candidato:",
      candidatoId
    );
    window.fecharModalEnviarFormulario();
    abrirModalResetSenha(candidatoId, emailnovo, nomecompleto);
    return;
  }

  // Validação completa
  if (
    !nomecompleto ||
    !emailpessoal ||
    !emailnovo ||
    !telefonecontato ||
    !linkFormulario
  ) {
    window.showToast?.("Erro: Dados do candidato incompletos.", "error");
    console.error("Dados incompletos:", dadosCandidatoAtual);
    return;
  }

  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    // CRIAR USUÁRIO NO FIREBASE AUTH (igual gestao-profissionais.js)
    console.log("Criando usuário no Firebase Auth...");
    const criarProfissional = httpsCallable(functions, "criarNovoProfissional");

    try {
      const resultado = await criarProfissional({
        nome: nomecompleto,
        email: emailnovo,
        contato: telefonecontato,
        profissao: "", // Será preenchido no formulário
        funcoes: ["todos"], // Permissão básica
      });

      if (resultado.data && resultado.data.sucesso) {
        console.log("Usuário criado no Firebase Auth:", resultado.data.uid);
      }
    } catch (authError) {
      // Se já existir, apenas loga e continua
      console.warn("Erro ao criar usuário (pode já existir):", authError);
    }

    const primeiroNome = nomecompleto.split(" ")[0];

    // MENSAGEM WHATSAPP
    const mensagemWhatsApp = `Olá, ${primeiroNome}! 👋

Seja bem-vindo(a) à equipe EuPsico! 🎉 Estamos muito felizes em tê-lo(a) conosco.

*Suas Credenciais de Acesso:*
📧 E-mail Corporativo: ${emailnovo}
🔑 Senha Temporária: ${senhatemporaria}

*⚠️ ATENÇÃO - Primeiros Passos Obrigatórios:*
1. Acesse seu e-mail corporativo: https://mail.google.com
2. Faça login com as credenciais acima
3. Troque sua senha (o sistema solicitará automaticamente no primeiro acesso)
4. Após trocar a senha, acesse o formulário de cadastro: ${linkFormulario}

*Importante saber:*
✅ O acesso ao formulário só é liberado pelo e-mail corporativo (@eupsico.org.br)
⏱️ A senha temporária expira em 24 horas
🔐 Após trocar a senha, você terá acesso completo aos sistemas

Qualquer dúvida, estamos à disposição pelo RH. 

Equipe EuPsico 💚`;

    // Abrir WhatsApp
    console.log("Abrindo WhatsApp...");
    const telefoneLimpo = telefonecontato.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemWhatsApp);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;
    window.open(linkWhatsApp, "_blank");

    // E-MAIL
    console.log("Enviando e-mails de boas-vindas...");
    const enviarEmailFunc = httpsCallable(functions, "enviarEmail");
    const assuntoEmail = "Boas-vindas à EuPsico - Seus dados de acesso";
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
                        <p>Olá, <strong>${nomecompleto}</strong>!</p>
                        <p>É com grande alegria que recebemos você na equipe EuPsico. Estamos ansiosos para contar com sua contribuição e talento.</p>
                    </div>

                    <div class="credentials-box">
                        <h3>🔐 Suas Credenciais de Acesso</h3>
                        <p><strong>E-mail Corporativo:</strong><br><span class="credential-value">${emailnovo}</span></p>
                        <p><strong>Senha Temporária:</strong><br><span class="credential-value">${senhatemporaria}</span></p>
                    </div>

                    <div style="text-align: center; margin-top: 20px;">
                        <a href="https://mail.google.com" class="btn-primary" target="_blank">📧 Acessar Meu E-mail</a>
                    </div>

                    <div class="warning-box">
                        <h3>⚠️ Ação Obrigatória nas Próximas 24 Horas</h3>
                        <p>Por questões de segurança, você deve <strong>alterar sua senha</strong> no primeiro acesso. O sistema solicitará automaticamente essa alteração.</p>
                        <p><strong>Importante:</strong> Após 24 horas sem alteração, a senha temporária será bloqueada.</p>
                    </div>

                    <div class="steps-box">
                        <h3>📝 Próximos Passos</h3>
                        <ol>
                            <li>Acesse <strong>mail.google.com</strong> e faça login com suas credenciais</li>
                            <li>Troque sua senha temporária quando solicitado</li>
                            <li>Acesse o formulário de cadastro pelo link abaixo</li>
                        </ol>
                        <p style="margin-top: 15px; background: #e7f3ff; padding: 12px; border-radius: 4px;">
                            💡 <strong>Importante:</strong> O formulário de cadastro só pode ser acessado usando seu e-mail corporativo (@eupsico.org.br). 
                            Certifique-se de fazer login antes de clicar no link.
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${linkFormulario}" class="btn-primary" style="background: #28a745;" target="_blank">📋 Acessar Formulário de Cadastro</a>
                    </div>

                    <p style="margin-top: 25px; font-size: 14px; color: #666;">
                        Se tiver qualquer dúvida, entre em contato com o RH: <a href="mailto:rh@eupsico.org.br" style="color: #007bff;">rh@eupsico.org.br</a>
                    </p>

                    <p style="margin-top: 20px;">
                        Estamos muito felizes em tê-lo(a) conosco! 💚<br>
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
        destinatario: emailpessoal,
        assunto: assuntoEmail,
        html: emailHtml,
      });
      await enviarEmailFunc({
        destinatario: emailnovo,
        assunto: assuntoEmail,
        html: emailHtml,
      });
      console.log("E-mails enviados");
    } catch (emailError) {
      console.error("Falha ao enviar e-mail:", emailError);
    }

    // Atualizar Firestore
    const { candidatosCollection, currentUserData } = getGlobalState();
    const candidatoRef = doc(candidatosCollection, candidatoId);

    await updateDoc(candidatoRef, {
      statusrecrutamento: "FORM_ENVIADO",
      "admissaoinfo.linkformulario": linkFormulario,
      "admissaoinfo.dataenvioformulario": new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `Boas-vindas enviadas (WhatsApp + E-mail) e usuário criado no Firebase Auth. Credenciais: ${emailnovo}`,
        usuario: currentUserData?.uid || "rhadmin",
      }),
    });

    console.log("Status atualizado");
    window.showToast?.("✅ Mensagens enviadas com sucesso!", "success");
    window.fecharModalEnviarFormulario();
    renderizarCadastroDocumentos(getGlobalState());
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro: " + error.message);
  } finally {
    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML =
        '<i class="fas fa-paper-plane"></i> Enviar WhatsApp e E-mail';
    }
  }
}

/**
 * Abre modal para resetar senha quando não encontrada
 * NOVO - Versão 1.0 (Estilizado)
 */
function abrirModalResetSenha(candidatoId, emailCorporativo, nomeCandidato) {
  console.log("Abrindo modal de reset de senha");

  const modalExistente = document.getElementById("modal-reset-senha");
  if (modalExistente) modalExistente.remove();

  const modal = document.createElement("div");
  modal.id = "modal-reset-senha";
  // A classe "modal-overlay is-visible" é removida e controlada pelo CSS interno

  modal.innerHTML = `
    <style>
        /* Estilos do modal-enviar-formulario adaptados para modal-reset-senha */
        #modal-reset-senha {
            all: initial !important;
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            font-family: inherit !important;
        }
        #modal-reset-senha .modal-container {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            max-width: 700px !important;
            background: #ffffff !important;
            border-radius: 12px !important;
            box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
            overflow: hidden !important;
            animation: modalPopupOpen 0.3s ease-out !important;
        }
        @keyframes modalPopupOpen {
            from { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        /* Header de Aviso (Amarelo) */
        #modal-reset-senha .modal-header {
            background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%) !important;
            color: #212529 !important;
            padding: 20px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        #modal-reset-senha .modal-title {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            margin: 0 !important;
        }
        #modal-reset-senha .modal-title i { font-size: 24px !important; }
        #modal-reset-senha .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
        #modal-reset-senha .modal-close {
            background: rgba(0,0,0,0.1) !important;
            border: none !important;
            color: #212529 !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 18px !important;
            transition: all 0.2s !important;
        }
        #modal-reset-senha .modal-body {
            padding: 25px !important;
            max-height: 500px !important;
            overflow-y: auto !important;
            background: #f8f9fa !important;
            font-family: inherit !important;
        }
        /* Estilo .info-card (reutilizado) */
        #modal-reset-senha .info-card {
            background: white !important;
            padding: 15px !important;
            border-radius: 8px !important;
            margin-bottom: 20px !important;
            border-left: 4px solid #17a2b8 !important;
        }
        #modal-reset-senha .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
        #modal-reset-senha .info-card strong { color: #333; }
        /* Estilo para .alert-warning baseado no seu .alert.warning */
        #modal-reset-senha .alert-warning {
            background: #fff3cd !important;
            border: 1px solid #ffeeba !important;
            border-left: 5px solid #ffc107 !important;
            color: #856404 !important;
            padding: 15px !important;
            border-radius: 8px !important;
            margin-bottom: 20px !important;
            display: flex; gap: 12px; align-items: center;
        }
        #modal-reset-senha .alert-warning i { font-size: 20px; }
        #modal-reset-senha .alert-warning p { margin: 0 !important; }
        #modal-reset-senha .modal-footer {
            padding: 20px 25px !important;
            background: white !important;
            border-top: 1px solid #e9ecef !important;
            display: flex !important;
            justify-content: flex-end !important; /* Alinha botões à direita */
            gap: 12px !important;
        }
        #modal-reset-senha .btn {
            padding: 12px 24px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-weight: 500 !important;
            border: none !important;
            display: inline-flex; gap: 8px; align-items: center;
        }
        #modal-reset-senha .btn-cancelar { background: #6c757d !important; color: white !important; }
        /* Botão Primário (Amarelo) */
        #modal-reset-senha .btn-primary { background: #ffc107 !important; color: #212529 !important; font-weight: 600 !important; }
        #modal-reset-senha .btn-primary:disabled { background: #ccc !important; color: #666 !important; }
    </style>
    <div class="modal-container">
        <div class="modal-header">
            <div class="modal-title">
                <i class="fas fa-key"></i>
                <h3>Resetar Senha Temporária</h3>
            </div>
            <button class="modal-close" onclick="fecharModalResetSenha()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Senha não encontrada!</strong>
                    <p>Não foi possível localizar a senha temporária para este candidato.</p>
                </div>
            </div>

            <div class="info-card">
                <p><strong>Candidato:</strong> ${nomeCandidato}</p>
                <p><strong>E-mail Corporativo:</strong> ${emailCorporativo}</p>
            </div>

            <p>Clique no botão abaixo para gerar uma nova senha temporária no Google Workspace</p>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-cancelar" onclick="fecharModalResetSenha()">
                Cancelar
            </button>
            <button id="btn-confirmar-reset-senha" class="btn btn-primary" 
                data-candidato-id="${candidatoId}" 
                data-email="${emailCorporativo}">
                <i class="fas fa-key"></i> Gerar Nova Senha
            </button>
        </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Event listener para o botão de confirmar
  document
    .getElementById("btn-confirmar-reset-senha")
    .addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const candidatoId = btn.dataset.candidatoId;
      const email = btn.dataset.email;
      await executarResetSenha(candidatoId, email);
    });
}

/**
 * Executa o reset de senha via Cloud Function
 * VERSÃO 2.0 - Usando Cloud Function (evita CORS)
 */
async function executarResetSenha(candidatoId, email) {
  const btn = document.getElementById("btn-confirmar-reset-senha");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetando...';
  }

  try {
    console.log("Chamando Cloud Function para resetar senha:", email);

    // USAR CLOUD FUNCTION (igual criarEmailGoogleWorkspace)
    const resetarSenha = httpsCallable(
      functions,
      "resetarSenhaGoogleWorkspace"
    );
    const resultado = await resetarSenha({ email: email });

    if (resultado.data && resultado.data.sucesso === true) {
      console.log("Senha resetada com sucesso:", resultado.data.novaSenha);

      // Salvar a nova senha no Firestore
      const state = getGlobalState();
      const { candidatosCollection, currentUserData } = state;
      const candidatoRef = doc(candidatosCollection, candidatoId);

      await updateDoc(candidatoRef, {
        "admissaoinfo.senha_temporaria": resultado.data.novaSenha, // ← CORRIGIDO
        "admissaoinfo.dataresetsenha": new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: `Senha temporária resetada. Nova senha: ${resultado.data.novaSenha}`,
          usuario: currentUserData?.uid || "rhadmin",
        }),
      });

      console.log("Senha salva no Firestore");

      // Fechar modal de reset
      fecharModalResetSenha();

      // Mostrar sucesso e instruções
      window.showToast?.(
        "✅ Senha resetada com sucesso! Agora você pode enviar o formulário.",
        "success"
      );
      alert(
        `Senha resetada com sucesso!\n\nNova senha: ${resultado.data.novaSenha}\n\nAgora você pode enviar o formulário ao candidato.`
      );

      // Recarregar a listagem para pegar a nova senha
      renderizarCadastroDocumentos(state);
    } else {
      throw new Error(resultado.data?.mensagem || "Erro ao resetar senha");
    }
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
    window.showToast?.("❌ Erro ao resetar senha", "error");
    alert("Erro: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-key"></i> Gerar Nova Senha';
    }
  }
}

/**
 * Fecha o modal de reset de senha
 */
function fecharModalResetSenha() {
  const modal = document.getElementById("modal-reset-senha");
  if (modal) modal.remove();
  document.body.style.overflow = "auto";
}

// Expor funções globalmente
window.fecharModalResetSenha = fecharModalResetSenha;
