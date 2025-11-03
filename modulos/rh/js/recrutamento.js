// modulos/rh/js/recrutamento.js

import {
 db,
 collection,
 getDocs,
 updateDoc,
 doc,
 query,
 where,
 getDoc,
 arrayUnion,
 serverTimestamp, 
} from "../../../assets/js/firebase-init.js";

// 🚀 IMPORTAÇÃO DOS NOVOS MÓDULOS DE ABAS
import { renderizarCronograma } from './tabs/tabCronograma.js';
import { renderizarTriagem } from './tabs/tabTriagem.js';
import { renderizarEntrevistas } from './tabs/tabEntrevistas.js';
import { renderizarEntrevistaGestor } from './tabs/tabGestor.js';
import { renderizarFinalizados } from './tabs/tabFinalizados.js';

// =====================================================================
// CONSTANTES GLOBAIS E ELEMENTOS DO DOM (REDUZIDOS)
// =====================================================================

const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATOS_COLLECTION_NAME = "candidaturas";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);

// Elementos do DOM
const filtroVaga = document.getElementById("filtro-vaga");
const statusCandidaturaTabs = document.getElementById(
 "status-candidatura-tabs"
);
const conteudoRecrutamento = document.getElementById("conteudo-recrutamento");
const btnGerenciarConteudo = document.getElementById("btn-gestao-conteudo");

const modalCandidato = document.getElementById("modal-candidato");
const modalCandidatoBody = document.getElementById("candidato-modal-body");
const modalCandidatoFooter = document.getElementById("candidato-modal-footer");

let vagaSelecionadaId = null;
let currentUserData = {};
let dadosCandidatoAtual = null; // Variável para armazenar os dados do candidato atualmente no modal

// =====================================================================
// FUNÇÕES DE UTILIDADE E CONTROLE PRINCIPAL
// =====================================================================

/**
* Utilitário para formatar o Timestamp
*/
function formatarTimestamp(timestamp) {
 if (!timestamp) return "N/A";
 // Assumindo que o timestamp do Firebase pode ser um objeto com .seconds
 const date = timestamp.toDate
  ? timestamp.toDate()
  : typeof timestamp.seconds === "number"
  ? new Date(timestamp.seconds * 1000)
  : new Date(timestamp);
 return date.toLocaleDateString("pt-BR");
}

/**
 * Funções de acesso para outros módulos
 */
export const getGlobalState = () => ({
    vagaSelecionadaId,
    currentUserData,
    candidatosCollection,
    vagasCollection,
    formatarTimestamp,
    conteudoRecrutamento,
    statusCandidaturaTabs,
    handleTabClick // Permite que a triagem recarregue a aba após salvar
});

async function carregarVagasAtivas() {
 if (!filtroVaga) return;

 try {
    // ... (Lógica de carregar vagas completa, omitida por brevidade no comentário)
    const q = query(
   vagasCollection,
   where("status", "in", [
    "em-divulgacao",
    "Em Divulgação",
    "Cronograma Pendente",
    "Cronograma Definido (Triagem Pendente)",
    "Entrevista RH Pendente",
    "Testes Pendente",
    "Entrevista Gestor Pendente",
    "Contratado",
    "Encerrada",
   ])
  );
  
  let snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    q = query(
    vagasCollection,
    where("status_vaga", "in", [
     "em-divulgacao",
     "Em Divulgação",
     "Cronograma Pendente",
     "Cronograma Definido (Triagem Pendente)",
     "Entrevista RH Pendente",
     "Testes Pendente",
     "Entrevista Gestor Pendente",
     "Contratado",
     "Encerrada",
    ])
   );
   snapshot = await getDocs(q);
  }

  let htmlOptions = '<option value="">Selecione uma Vaga...</option>';

  if (snapshot.empty) {
   htmlOptions = '<option value="">Nenhuma vaga em processo de recrutamento.</option>';
  } else {
   snapshot.docs.forEach((doc) => {
    const vaga = doc.data();
    const titulo = vaga.titulo_vaga || vaga.nome || vaga.titulo || 'Vaga sem título';
    const status = vaga.status_vaga || vaga.status || 'Status desconhecido';
    
    htmlOptions += `<option value="${doc.id}">${titulo} - (${status})</option>`;
   });
  }
  
  filtroVaga.innerHTML = htmlOptions;

  const urlParams = new URLSearchParams(window.location.search);
  const vagaFromUrl = urlParams.get("vaga");

  if (vagaFromUrl) {
   vagaSelecionadaId = vagaFromUrl;
   filtroVaga.value = vagaSelecionadaId;
   handleFiltroVagaChange();
  } else if (snapshot.size > 0 && filtroVaga.options.length > 1) {
   vagaSelecionadaId = snapshot.docs[0].id;
   filtroVaga.value = vagaSelecionadaId;
   handleFiltroVagaChange();
  }

  const etapaFromUrl = urlParams.get("etapa");
  if (etapaFromUrl) {
   const targetTab = statusCandidaturaTabs.querySelector(
    `[data-status="${etapaFromUrl}"]`
   );
   if (targetTab) {
    handleTabClick({ currentTarget: targetTab });
   }
  }
 } catch (error) {
  console.error("❌ Erro ao carregar vagas ativas:", error);
  if (window.showToast) {
   window.showToast("Erro ao carregar lista de vagas.", "error");
  } else {
   alert("Erro ao carregar lista de vagas.");
  }
 }
}


/**
* Abre o modal de visualização/detalhes do candidato.
 * 🔴 CORREÇÃO: Função exposta globalmente.
*/
export async function abrirModalCandidato(candidatoId, modo, candidato) {
 if (!modalCandidato || !modalCandidatoBody) return;
 
 // Se os dados não foram passados, busca no Firebase
 if (!candidato) {
   modalCandidatoBody.innerHTML = '<div class="loading-spinner">Carregando dados do candidato...</div>';
   modalCandidato.classList.add("is-visible");

   try {
     const candSnap = await getDoc(doc(candidatosCollection, candidatoId));
     if (!candSnap.exists()) {
       modalCandidatoBody.innerHTML = '<p class="alert alert-danger">Candidatura não encontrada.</p>';
       return;
     }
     candidato = candSnap.data();
   } catch (error) {
     modalCandidatoBody.innerHTML = '<p class="alert alert-danger">Erro ao carregar os detalhes da candidatura.</p>';
     return;
   }
 }


 modalCandidatoFooter.innerHTML =
  '<button type="button" class="action-button secondary fechar-modal-candidato">Fechar</button>';

 // CORREÇÃO: Anexar o listener AGORA que o botão existe
 const btnFechar = modalCandidatoFooter.querySelector(".fechar-modal-candidato");
 if (btnFechar) {
   btnFechar.addEventListener("click", () => {
     modalCandidato.classList.remove("is-visible");
     const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");
     if (activeTab) handleTabClick({ currentTarget: activeTab });
   });
 }
  
 document.getElementById("candidato-nome-titulo").textContent = `Detalhes: ${
  candidato.nome_completo || "N/A"
 }`;

 // --- Geração do Conteúdo Detalhes ---
 let contentHtml = `
   <div class="row detalhes-candidato-modal">
     <div class="col-md-6">
       <h5>Informações Pessoais</h5>
       <p><strong>Email:</strong> ${candidato.email_candidato}</p>
       <p><strong>Telefone (WhatsApp):</strong> ${
        candidato.telefone_contato || "N/A"
       }</p>
       <p><strong>Vaga Aplicada:</strong> ${
        candidato.titulo_vaga_original || "N/A"
       }</p>
       <p><strong>Localidade:</strong> ${
        candidato.cidade || "N/A"
       } / ${candidato.estado || "UF"}</p>
       <p><strong>Status Atual:</strong> <span class="badge bg-primary">${
        candidato.status_recrutamento || "N/A"
       }</span></p>
     </div>
     <div class="col-md-6">
       <h5>Experiência e Arquivos</h5>
       <p><strong>Resumo Experiência:</strong> ${
        candidato.resumo_experiencia || "Não informado"
       }</p>
       <p><strong>Habilidades:</strong> ${
        candidato.habilidades_competencias || "Não informadas"
       }</p>
       <p><strong>Currículo:</strong> 
         <a href="${
          candidato.link_curriculo_drive || "#"
         }" target="_blank" class="action-button secondary ${ 
  !candidato.link_curriculo_drive ? "disabled" : ""
 }">
           <i class="fas fa-file-pdf"></i> Ver Currículo
         </a>
       </p>
     </div>
   </div>
   
   <hr>
   
   <div class="historico-candidatura">
     <h5>Histórico de Avaliações</h5>
     ${
      candidato.triagem_rh
       ? `
       <h6>Triagem RH</h6>
       <p><strong>Decisão:</strong> ${
        candidato.triagem_rh.apto_entrevista
       } | 
       <strong>Data:</strong> ${formatarTimestamp(
        candidato.triagem_rh.data_avaliacao
       )}</p>
       <p class="small-info">Comentários: ${
        candidato.triagem_rh.comentarios_gerais || "N/A"
       }</p>
     `
       : "<p>Ainda não avaliado na Triagem RH.</p>"
     }
     
     ${
      candidato.rejeicao?.etapa
       ? `
       <h6 class="text-danger">Rejeição Registrada</h6>
       <p><strong>Etapa:</strong> ${candidato.rejeicao.etapa} | 
       <strong>Data:</strong> ${formatarTimestamp(
        candidato.rejeicao.data
       )}</p>
       <p class="small-info">Justificativa: ${
        candidato.rejeicao.justificativa || "N/A"
       }</p>
     `
       : ""
     }
     
   </div>
 `;

 modalCandidatoBody.innerHTML = contentHtml;
 modalCandidato.classList.add("is-visible");
}

// 🔴 CORREÇÃO: Expõe a função globalmente para chamadas via window.abrirModalCandidato
window.abrirModalCandidato = abrirModalCandidato;


/**
* Reprova uma candidatura em qualquer etapa. (Mantida no principal e exposta)
*/
window.reprovarCandidatura = async function (
 candidatoId,
 etapa,
 justificativaFicha = null
) {
 let justificativa =
  justificativaFicha ||
  prompt(
   `Confirme a reprovação do candidato nesta etapa (${etapa}). Informe a justificativa:`
  );

 if (!justificativa || justificativa.trim() === "") {
  if (window.showToast) {
   window.showToast(
    "A justificativa de reprovação é obrigatória.",
    "warning"
   );
  } else {
   alert("A justificativa de reprovação é obrigatória.");
  }
  return;
 }

 if (!confirm(`Confirmar reprovação na etapa ${etapa}?`)) return;

 try {
  // Atualiza o status
  const candidatoRef = doc(candidatosCollection, candidatoId);

  await updateDoc(candidatoRef, {
   status_recrutamento: "Rejeitado (Comunicação Pendente)",
   "rejeicao.etapa": etapa,
   "rejeicao.data": firebase.firestore.FieldValue.serverTimestamp(),
   "rejeicao.justificativa": justificativa,
   // Adicionar ao histórico principal (usando arrayUnion)
   historico: arrayUnion({
    data: firebase.firestore.FieldValue.serverTimestamp(),
    acao: `Candidatura REJEITADA na etapa de ${etapa}. Motivo: ${justificativa}`,
    usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
   }),
  });

  if (window.showToast) {
   window.showToast(`Candidatura rejeitada na etapa ${etapa}.`, "error");
  } else {
   alert("Candidatura rejeitada.");
  }
  // Se o modal estiver aberto, feche
  modalCandidato.classList.remove("is-visible");

  // Recarrega a listagem atual
  const activeStatus = statusCandidaturaTabs
   .querySelector(".tab-link.active")
   ?.getAttribute("data-status");
  if (activeStatus === "triagem") renderizarTriagem();
  else if (activeStatus === "entrevistas") renderizarEntrevistas();
  else if (activeStatus === "gestor") renderizarEntrevistaGestor();
 } catch (error) {
  console.error("Erro ao reprovar candidato:", error);
  if (window.showToast) {
   window.showToast("Erro ao reprovar candidato.", "error");
  } else {
   alert("Erro ao reprovar candidato.");
  }
 }
};

// =====================================================================
// HANDLERS DE UI E ROTEAMENTO (CONTROLADOR)
// =====================================================================

/**
* Lida com a mudança na seleção da vaga.
*/
function handleFiltroVagaChange() {
 vagaSelecionadaId = filtroVaga.value;

 const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");

 if (vagaSelecionadaId) {
  // Se houver vaga selecionada, carrega o conteúdo da aba ativa (ou cronograma)
  if (activeTab) {
   handleTabClick({ currentTarget: activeTab });
  } else {
        // Se nenhuma aba está ativa, carrega o Cronograma por padrão
   renderizarCronograma(getGlobalState());
  }
 } else {
  // Se a vaga for deselecionada
  conteudoRecrutamento.innerHTML =
   '<p id="mensagem-inicial" class="alert alert-info">Selecione uma vaga no filtro acima para iniciar a visualização do processo seletivo.</p>';
 }
}

/**
* Lida com o clique nas abas de status, roteando para o módulo de aba correto.
*/
function handleTabClick(e) {
 const status = e.currentTarget.getAttribute("data-status");

 document
  .querySelectorAll("#status-candidatura-tabs .tab-link")
  .forEach((btn) => btn.classList.remove("active"));
 e.currentTarget.classList.add("active");

 if (!vagaSelecionadaId && status !== "gestao-conteudo") {
  conteudoRecrutamento.innerHTML =
   '<p class="alert alert-info">Por favor, selecione uma vaga para visualizar esta etapa.</p>';
  return;
 }
    
    const globalState = getGlobalState();

 switch (status) {
  case "cronograma":
   renderizarCronograma(globalState);
   break;
  case "triagem":
   renderizarTriagem(globalState);
   break;
  case "entrevistas":
   renderizarEntrevistas(globalState);
   break;
  case "gestor":
   renderizarEntrevistaGestor(globalState);
   break;
  case "finalizados":
   renderizarFinalizados(globalState);
   break;
  case "gestao-conteudo":
   // Redirecionamento direto para o módulo de gestão de estudos
   window.location.hash = "#rh/gestao_estudos_de_caso";
   break;
  default:
   conteudoRecrutamento.innerHTML =
    "<p>Selecione uma etapa do processo.</p>";
 }
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================


/**
* Ponto de entrada do módulo.
*/
export async function initRecrutamento(user, userData) {
 console.log("🔹 Iniciando Módulo de Recrutamento e Seleção...");

 currentUserData = userData || {};

 // 1. Carregar lista de vagas ativas
 await carregarVagasAtivas();

 // 2. Configurar eventos de filtro e abas
 if (filtroVaga) {
  filtroVaga.addEventListener("change", handleFiltroVagaChange);
 }

 if (statusCandidaturaTabs) {
  statusCandidaturaTabs.querySelectorAll(".tab-link").forEach((btn) => {
   btn.addEventListener("click", handleTabClick);
  });
 }
}

// ✅ ADICIONE ESTA LINHA PARA COMPATIBILIDADE COM O ROTEADOR
export { initRecrutamento as init };