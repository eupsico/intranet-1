// modulos/rh/js/tabs/tabSolicitacaoEmail.js
import { getGlobalState } from "../admissao.js"; // Importa do novo módulo
import {
  db,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Solicitação de E-mail.
 */
export async function renderizarSolicitacaoEmail(state) {
  const {
    conteudoAdmissao,
    candidatosCollection,
    statusAdmissaoTabs,
    currentUserData,
  } = state;

  conteudoAdmissao.innerHTML = `
  <div class="loading-spinner">
   <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Admissão...
  </div>
 `;

  try {
    // Query Firestore - Busca candidatos prontos para admissão
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_ADMISSAO")
    );

    const snapshot = await getDocs(q);

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="solicitacao-email"]'
    );
    if (tab) {
      // Atualiza o contador da aba
      tab.innerHTML = `<i class="fas fa-envelope-open-text me-2"></i> 1. Solicitação de E-mail (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML = `
    <div class="alert alert-info">
     <p><i class="fas fa-check-circle"></i> Nenhum candidato aguardando o início do processo de admissão.</p>
    </div>
   `;
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Os candidatos abaixo foram aprovados no Recrutamento. O primeiro passo é solicitar a criação do e-mail corporativo.</p>
  	</div>
   <div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada"; // Usamos o estilo CSS da 'entrevista com gestor'

      const statusClass = "status-warning"; // Sempre pendente nesta etapa // Dados encoded para modal

      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo,
        email_pessoal: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_titulo: vagaTitulo,
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidaturaId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${cand.nome_completo || "Candidato Sem Nome"}
       <span class="status-badge ${statusClass}">
        <i class="fas fa-tag"></i> ${statusAtual}
       </span>
      </h4>
      <p class="small-info">
       <i class="fas fa-briefcase"></i> Vaga Aprovada: ${vagaTitulo}
      </p>
     </div>

     <div class="info-contato">
      ${
        cand.email_candidato
          ? `<p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>`
          : ""
      }
      ${
        cand.telefone_contato
          ? `<p><i class="fas fa-phone"></i> ${cand.telefone_contato}</p>`
          : ""
      }
     </div>

     <div class="acoes-candidato">
            <button class="action-button primary btn-solicitar-email" 
          data-id="${candidaturaId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
       <i class="fas fa-envelope-open-text"></i> Solicitar E-mail
      </button>
      
            <button class="action-button secondary btn-ver-detalhes-admissao" 
          data-id="${candidaturaId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
       <i class="fas fa-eye"></i> Detalhes
      </button>
      
            <button class="action-button danger btn-reprovar-admissao" 
          data-id="${candidaturaId}"
          style="padding: 10px 16px; background: var(--cor-erro); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
       <i class="fas fa-times-circle"></i> Reprovar Admissão
      </button>
     </div>
    </div>
   `;
    });

    listaHtml += `
   </div>
  `;

    conteudoAdmissao.innerHTML = listaHtml; // === EVENT LISTENERS ===

    console.log("🔗 Admissão(Email): Anexando event listeners...");

    const botoesSolicitar = document.querySelectorAll(".btn-solicitar-email");
    const botoesDetalhes = document.querySelectorAll(
      ".btn-ver-detalhes-admissao"
    );
    const botoesReprovar = document.querySelectorAll(".btn-reprovar-admissao"); // Botão Solicitar E-mail

    botoesSolicitar.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🎯 Clique no botão Solicitar E-mail");
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        abrirModalSolicitarEmail(candidatoId, dadosCodificados, state);
      });
    }); // Botão Detalhes

    botoesDetalhes.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("👁️ Clique no botão Detalhes");
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
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
    }); // Botão Reprovar Admissão

    botoesReprovar.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const candidatoId = btn.getAttribute("data-id");
        if (typeof window.reprovarCandidatoAdmissao === "function") {
          window.reprovarCandidatoAdmissao(
            candidatoId,
            "Solicitação de E-mail"
          );
        } else {
          alert("Erro: Função de reprovação não encontrada.");
        }
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Email): Erro ao carregar:", error);
    conteudoAdmissao.innerHTML = `
   <div class="alert alert-danger">
    <p><i class="fas fa-exclamation-circle"></i> Erro: ${error.message}</p>
   </div>
  `;
  }
}

/**
 * Abre o modal para solicitar a criação de e-mail
 */
function abrirModalSolicitarEmail(candidatoId, dadosCodificados, state) {
  console.log("🎯 Abrindo modal de solicitação de e-mail");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    const modalExistente = document.getElementById("modal-solicitar-email");
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-solicitar-email"; // Gera sugestão de e-mail
    const nomeLimpo = dadosCandidato.nome_completo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z\s]/g, "") // remove caracteres não-alfabéticos
      .split(" ");
    const primeiroNome = nomeLimpo[0] || "nome";
    const ultimoNome =
      nomeLimpo.length > 1 ? nomeLimpo[nomeLimpo.length - 1] : "sobrenome";
    const sugestaoEmail = `${primeiroNome}.${ultimoNome}@eupsico.com.br`;

    modal.innerHTML = `
   <style>
    #modal-solicitar-email {
     all: initial !important;
     display: block !important;
     position: fixed !important;
     top: 0 !important; left: 0 !important;
     width: 100vw !important; height: 100vh !important;
     z-index: 999999 !important;
     background: rgba(0, 0, 0, 0.7) !important;
    }
    #modal-solicitar-email .modal-container {
     position: fixed !important;
     top: 50% !important; left: 50% !important;
     transform: translate(-50%, -50%) !important;
     max-width: 600px !important;
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
    #modal-solicitar-email .modal-header {
     background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
     color: white !important; padding: 20px !important; display: flex !important;
     justify-content: space-between !important; align-items: center !important;
    }
    #modal-solicitar-email .modal-title {
    	display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
    }
    #modal-solicitar-email .modal-title i { font-size: 24px !important; }
    #modal-solicitar-email .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
    #modal-solicitar-email .modal-close {
     background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
     width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
     display: flex !important; align-items: center !important; justify-content: center !important;
     font-size: 18px !important; transition: all 0.2s !important;
    }
    #modal-solicitar-email .modal-body {
     padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
     background: #f8f9fa !important; font-family: inherit !important;
    }
    #modal-solicitar-email .form-group { margin-bottom: 20px !important; }
    #modal-solicitar-email .form-label {
    	font-weight: 600 !important; margin-bottom: 8px !important; display: block !important;
    	color: #333 !important; font-size: 14px !important;
    }
    #modal-solicitar-email .form-input, #modal-solicitar-email .form-select {
    	width: 100% !important; padding: 12px !important; border: 1px solid #ddd !important;
    	border-radius: 6px !important; box-sizing: border-box !important; font-size: 14px !important;
    }
   	#modal-solicitar-email .form-input[readonly] { background: #e9ecef !important; }
    #modal-solicitar-email .modal-footer {
    	padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important;
    	display: flex !important; justify-content: flex-end !important; gap: 12px !important;
   	}
   	#modal-solicitar-email .btn-cancelar, #modal-solicitar-email .btn-salvar {
   		padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important;
   		font-weight: 500 !important; border: none !important;
   	}
   	#modal-solicitar-email .btn-cancelar { background: #6c757d !important; color: white !important; }
   	#modal-solicitar-email .btn-salvar { background: #007bff !important; color: white !important; }
   	#modal-solicitar-email .btn-salvar:disabled { background: #ccc !important; }
   </style>
   
   <div class="modal-container">
    <div class="modal-header">
     <div class="modal-title">
      <i class="fas fa-envelope-open-text"></i>
      <h3>Solicitar E-mail Corporativo</h3>
     </div>
     <button class="modal-close" onclick="fecharModalSolicitarEmail()">
      <i class="fas fa-times"></i>
     </button>
    </div>
    
    <div class="modal-body">
     <form id="form-solicitar-email-${candidatoId}">
      <div class="form-group">
       <label class="form-label" for="solicitar-nome">Nome Completo</label>
       <input type="text" id="solicitar-nome" class="form-input" 
       	value="${dadosCandidato.nome_completo}" readonly>
      </div>
      <div class="form-group">
      	<label class="form-label" for="solicitar-cargo">Cargo / Função</label>
      	<input type="text" id="solicitar-cargo" class="form-input" 
      		value="${dadosCandidato.vaga_titulo}" required>
      </div>
      <div class="form-group">
      	<label class="form-label" for="solicitar-departamento">Departamento</label>
      	<select id="solicitar-departamento" class="form-select" required>
      		<option value="">Selecione...</option>
      		<option value="administrativo">Administrativo</option>
      		<option value="financeiro">Financeiro</option>
      		<option value="rh">Recursos Humanos</option>
      		<option value="servico-social">Serviço Social</option>
      		<option value="psicologo">Psicólogo(a)</option>
      		<option value="gestao">Gestão</option>
      		<option value="ti">TI</option>
      		<option value="outro">Outro</option>
      	</select>
      </div>
      <div class="form-group">
      	<label class="form-label" for="solicitar-email-sugerido">E-mail Sugerido</label>
      	<input type="email" id="solicitar-email-sugerido" class="form-input" 
      		value="${sugestaoEmail}" required>
     	</div>
     	<p style="font-size: 12px; color: #6c757d;">
     		Ao salvar, uma solicitação será enviada ao TI e o candidato avançará para "Cadastro e Documentos".
     	</p>
     </form>
    </div>
    
    <div class="modal-footer">
     <button type="button" class="btn-cancelar" onclick="fecharModalSolicitarEmail()">
      <i class="fas fa-times"></i> Cancelar
     </button>
     <button type="button" class="btn-salvar" 
     	onclick="salvarSolicitacaoEmail('${candidatoId}', '${
      dadosCandidato.nome_completo
    }', '${currentUserData.id || "rh_admin"}', '${
      currentUserData.nome || "Usuário RH"
    }')">
      <i class="fas fa-paper-plane"></i> Salvar e Solicitar
     </button>
    </div>
   </div>
  `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
    modal.querySelector("input, select, textarea")?.focus();
  } catch (error) {
    console.error("❌ Erro ao criar modal de solicitação:", error);
    alert("Erro ao abrir modal de solicitação.");
  }
}

// === FUNÇÕES GLOBAIS DO MODAL ===
window.fecharModalSolicitarEmail = function () {
  console.log("❌ Fechando modal de solicitação de e-mail");
  const modal = document.getElementById("modal-solicitar-email");
  if (modal) {
    modal.remove();
  }
  document.body.style.overflow = "";
};

window.salvarSolicitacaoEmail = async function (
  candidatoId,
  nomeCandidato,
  rhUserId,
  rhUserName
) {
  console.log("💾 Salvando solicitação de e-mail");

  const formId = `form-solicitar-email-${candidatoId}`;
  const form = document.getElementById(formId);
  const btnSalvar = form
    .closest(".modal-container")
    .querySelector(".btn-salvar");

  const cargo = form.querySelector("#solicitar-cargo").value;
  const departamento = form.querySelector("#solicitar-departamento").value;
  const emailSugerido = form.querySelector("#solicitar-email-sugerido").value;

  if (!cargo || !departamento || !emailSugerido) {
    alert(
      "Por favor, preencha todos os campos: Cargo, Departamento e E-mail Sugerido."
    );
    return;
  }
  if (!emailSugerido.includes("@eupsico.com.br")) {
    alert("O e-mail sugerido deve ser um domínio @eupsico.com.br");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solicitando...';

  try {
    // 1. Salva a solicitação para o TI
    const solicitacoesTiRef = collection(db, "solicitacoes_ti");
    await addDoc(solicitacoesTiRef, {
      tipo: "criacao_email_novo_colaborador",
      nome_colaborador: nomeCandidato,
      cargo: cargo,
      departamento: departamento,
      email_sugerido: emailSugerido,
      status: "pendente",
      data_solicitacao: new Date(),
      solicitante_id: rhUserId,
      solicitante_nome: rhUserName,
      candidatura_id: candidatoId, // Link para a candidatura
    }); // 2. Atualiza o status do candidato para a próxima etapa

    const candidatoRef = doc(db, "candidaturas", candidatoId);
    const novoStatus = "AGUARDANDO_CADASTRO"; // Próxima etapa
    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatus,
      historico: arrayUnion({
        data: new Date(),
        acao: `Solicitação de e-mail (${emailSugerido}) enviada ao TI.`,
        usuario: rhUserId,
      }), // Salva os dados da admissão no próprio candidato
      admissao_info: {
        cargo_final: cargo,
        departamento: departamento,
        email_solicitado: emailSugerido,
      },
    });

    console.log(
      `✅ Solicitação salva e status do candidato atualizado para ${novoStatus}`
    );
    window.showToast?.("Solicitação de e-mail enviada com sucesso!", "success");
    window.fecharModalSolicitarEmail(); // Recarrega a aba

    const state = getGlobalState();
    renderizarSolicitacaoEmail(state);
  } catch (error) {
    console.error("❌ Erro ao salvar solicitação de e-mail:", error);
    alert(`Erro ao salvar: ${error.message}`);
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-paper-plane"></i> Salvar e Solicitar';
  }
};
