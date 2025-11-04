// modulos/rh/js/tabs/tabTriagem.js

import { getGlobalState } from "../recrutamento.js";
// CORREÇÃO: Caminho do firebase-init ajustado para 4 níveis (../../../../)
import {
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// Elementos do Modal de Triagem (Obtidos globalmente para uso nas funções)
const modalAvaliacaoTriagem = document.getElementById(
  "modal-avaliacao-triagem"
);
const btnFinalizarTriagem = document.getElementById(
  "btn-finalizar-triagem-modal"
);

let dadosCandidatoAtual = null; // Variável para armazenar os dados do candidato atualmente no modal

/**
 * Checklist estático para a Triagem.
 */
const CHECKLIST_TRIAGEM = [
  {
    id: "check-pre-req",
    label:
      "Candidato atende aos pré-requisitos básicos (Formação/Conselho/Exp. Mínima).",
  },
  {
    id: "check-link-curriculo",
    label: "Link do currículo (Drive/PDF) está acessível e válido.",
  },
  {
    id: "check-salario-compativel",
    label:
      "Expectativa salarial (se informada) está compatível com a faixa da vaga.",
  },
  {
    id: "check-fit-cultural",
    label: "Perfil aparente (resumo/habilidades) possui bom fit cultural.",
  },
];

/**
 * Renderiza o checklist com os valores salvos e configura o salvamento automático.
 */
function renderizarChecklistTriagem(savedChecks = {}) {
  const container = document.getElementById("checklist-triagem-container");
  if (!container) return;

  container.innerHTML = CHECKLIST_TRIAGEM.map((item) => {
    const isChecked = savedChecks[item.id] === true ? "checked" : "";
    return `
   <div class="form-check checklist-item">
    <input 
     class="form-check-input" 
     type="checkbox" 
     value="1" 
     id="${item.id}" 
     data-check-id="${item.id}"
     ${isChecked}
    />
    <label class="form-check-label" for="${item.id}">
     ${item.label}
    </label>
   </div>
  `;
  }).join(""); // Adicionar salvamento automático (on change)

  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.removeEventListener("change", handleSalvarChecklist);
    checkbox.addEventListener("change", handleSalvarChecklist);
  });
}

/**
 * Salva o estado atual do checklist no Firebase (salvamento automático).
 */
async function handleSalvarChecklist(e) {
  const { candidatosCollection } = getGlobalState();

  const candidaturaId = modalAvaliacaoTriagem?.dataset.candidaturaId;
  if (!candidaturaId) return;

  const checklistContainer = document.getElementById(
    "checklist-triagem-container"
  );
  const currentChecks = {};

  checklistContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      currentChecks[checkbox.id] = checkbox.checked;
    });

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      "triagem_rh.checklist": currentChecks,
    });

    if (dadosCandidatoAtual?.triagem_rh) {
      dadosCandidatoAtual.triagem_rh.checklist = currentChecks;
    } else if (dadosCandidatoAtual) {
      dadosCandidatoAtual.triagem_rh = { checklist: currentChecks };
    }
  } catch (error) {
    console.error("Erro ao salvar checklist:", error);
    window.showToast("Erro ao salvar o checklist automaticamente.", "error");
  }
}

/**
 * Abre o modal de avaliação de triagem. (Exportada como window.function para acesso do btn-avaliar-triagem)
 */
window.abrirModalAvaliacaoTriagem = function (candidatoId, dadosCandidato) {
  // Acessa a função global de toggle, que foi inserida no HTML
  const { toggleMotivoAprovacaoRejeicao } = window;

  if (!modalAvaliacaoTriagem) return; // Salva a referência global do candidato para uso no salvamento

  dadosCandidatoAtual = dadosCandidato; // 1. Configurações Iniciais e IDs

  modalAvaliacaoTriagem.dataset.candidaturaId = candidatoId; // 2. Popula dados do Candidato (Ficha)

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)"; // 🔴 CORREÇÃO 1: Injeta o nome do candidato no SPAN que está dentro do P (novo formato)

  const candidatoNomeEl = document.getElementById("candidato-modal-nome");
  if (candidatoNomeEl) candidatoNomeEl.textContent = nomeCompleto;

  document.getElementById(
    "avaliacao-modal-title"
  ).textContent = `Avaliação de Currículo - ${nomeCompleto}`;
  document.getElementById("modal-dado-email").textContent =
    dadosCandidato.email || "Não informado";
  document.getElementById("modal-dado-telefone").textContent =
    dadosCandidato.telefone_contato || "Não informado";
  document.getElementById("modal-dado-cidade-estado").textContent = `${
    dadosCandidato.cidade || "Não informada"
  } / ${dadosCandidato.estado || "UF"}`;
  document.getElementById("modal-dado-como-conheceu").textContent =
    dadosCandidato.como_conheceu || "Não informado"; // 🔴 CORREÇÃO 2: Campos de Resumo e Habilidades (com checagem de null)
  const resumoEl = document.getElementById("modal-dado-resumo-experiencia");
  const habilidadesEl = document.getElementById("modal-dado-habilidades");
  if (resumoEl)
    resumoEl.textContent =
      dadosCandidato.resumo_experiencia || "Não preenchido no formulário.";
  if (habilidadesEl)
    habilidadesEl.textContent =
      dadosCandidato.habilidades_competencias ||
      "Não preenchidas no formulário."; // 3. Popula dados de Avaliação (Checklist e Form)

  const triagemAnterior = dadosCandidato.triagem_rh || {};

  renderizarChecklistTriagem(triagemAnterior.checklist); // Campos de Critérios e Decisão (Com checagem de null)

  const prerequisitosEl = document.getElementById(
    "modal-prerequisitos-atendidos"
  );
  if (prerequisitosEl)
    prerequisitosEl.value = triagemAnterior.prerequisitos_atendidos || ""; // Campo de Reprovação (Motivo Detalhado)

  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");
  if (motivoRejeicaoEl)
    motivoRejeicaoEl.value = triagemAnterior.motivo_rejeicao || ""; // Campo de Aprovação (Próximos Passos)

  const infoAprovacaoEl = document.getElementById("modal-info-aprovacao");
  if (infoAprovacaoEl)
    infoAprovacaoEl.value = triagemAnterior.info_aprovacao || ""; // Lógica dos Rádios

  const radioSim = document.getElementById("modal-apto-sim");
  const radioNao = document.getElementById("modal-apto-nao");

  if (radioSim) radioSim.checked = triagemAnterior.apto_entrevista === "Sim";
  if (radioNao) radioNao.checked = triagemAnterior.apto_entrevista === "Não"; // 🟡 Atualiza o link do currículo no botão do rodapé

  const btnVerCurriculo = document.getElementById("btn-ver-curriculo-triagem");
  if (btnVerCurriculo) {
    btnVerCurriculo.dataset.curriculoLink =
      dadosCandidato.link_curriculo_drive || "";
    btnVerCurriculo.disabled = !dadosCandidato.link_curriculo_drive;
  } // 🔴 CRÍTICO: Força a UI a atualizar com base no valor carregado. // Isso garante que a CAIXA DE REPROVAÇÃO ABRA ao carregar dados antigos.

  if (toggleMotivoAprovacaoRejeicao) {
    toggleMotivoAprovacaoRejeicao();
  } // 4. Exibe o Modal

  modalAvaliacaoTriagem.classList.add("is-visible");
};

/**
 * Lógica de Submissão para salvar a decisão final da Triagem.
 */
async function submeterAvaliacaoTriagem(e) {
  e.preventDefault();

  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = getGlobalState();

  const candidaturaId = modalAvaliacaoTriagem?.dataset.candidaturaId;
  if (!candidaturaId) return; // Determinar a decisão

  const aptoEntrevista = document.querySelector(
    'input[name="modal-apto-entrevista"]:checked'
  )?.value;
  const decisao = aptoEntrevista === "Sim"; // Elementos

  const prerequisitosEl = document.getElementById(
    "modal-prerequisitos-atendidos"
  );
  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");
  const infoAprovacaoEl = document.getElementById("modal-info-aprovacao"); // 🔴 Lógica de validação de campo obrigatório para Reprovação

  if (
    !decisao &&
    motivoRejeicaoEl?.required &&
    !motivoRejeicaoEl.value.trim()
  ) {
    alert("Por favor, preencha o motivo detalhado da reprovação.");
    return;
  }

  btnFinalizarTriagem.disabled = true;
  btnFinalizarTriagem.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...'; // Determinar o novo status no banco de dados e qual aba deve ser recarregada

  const novoStatusCandidato = decisao
    ? "Triagem Aprovada (Entrevista Pendente)" // Deve ir para aba de Entrevistas
    : "Triagem Reprovada (Encerrada)"; // Deve ir para aba de Finalizados // Define qual aba deve ser ativada/recarregada após a submissão

  const abaRecarregar = decisao ? "entrevistas" : "finalizados"; // Objeto de avaliação final (inclui o estado atual do checklist)

  const dadosAvaliacao = {
    prerequisitos_atendidos: prerequisitosEl?.value || "", // Garante que o campo de Reprovação seja mapeado corretamente para o Firebase
    motivo_rejeicao: decisao ? "" : motivoRejeicaoEl?.value.trim() || "",
    apto_entrevista: aptoEntrevista,
    info_aprovacao: decisao
      ? infoAprovacaoEl
        ? infoAprovacaoEl.value.trim()
        : ""
      : "",
    data_avaliacao: serverTimestamp(),
    avaliador_uid: currentUserData.id || "rh_system_user",
    checklist: dadosCandidatoAtual?.triagem_rh?.checklist || {},
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId); // Atualizar o documento da candidatura

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      triagem_rh: dadosAvaliacao, // CORREÇÃO CRÍTICA DO FIREBASE: Usa data do cliente para evitar o erro de serverTimestamp aninhado.
      historico: arrayUnion({
        data: new Date().toISOString(),
        acao: `Triagem ${
          decisao ? "APROVADA" : "REPROVADA"
        }. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast("Decisão da Triagem registrada com sucesso!", "success"); // Fecha o modal

    modalAvaliacaoTriagem.classList.remove("is-visible"); // 🔴 Recarrega a listagem atual para remover o card da aba Triagem e muda para a próxima aba.

    renderizarTriagem(getGlobalState());

    const currentActiveTab = statusCandidaturaTabs
      .querySelector(".tab-link.active")
      .getAttribute("data-status");
    if (currentActiveTab !== abaRecarregar) {
      const targetTab = statusCandidaturaTabs.querySelector(
        `[data-status="${abaRecarregar}"]`
      );
      if (targetTab) {
        handleTabClick({ currentTarget: targetTab });
      }
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação de triagem:", error);
    window.showToast(`Erro ao registrar a decisão: ${error.message}`, "error");
  } finally {
    btnFinalizarTriagem.disabled = false;
    btnFinalizarTriagem.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  }
}

/**
 * Renderiza a listagem de candidatos para a triagem.
 */
export async function renderizarTriagem(state) {
  const { vagaSelecionadaId, conteudoRecrutamento, candidatosCollection } =
    state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidaturas para Triagem...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where(
        "status_recrutamento",
        "==",
        "Candidatura Recebida (Triagem Pendente)"
      )
    );
    const snapshot = await getDocs(q); // Atualiza contagem na aba

    const triagemTab = document
      .getElementById("status-candidatura-tabs")
      .querySelector('.tab-link[data-status="triagem"]');
    if (triagemTab)
      triagemTab.textContent = `2. Avaliação de Currículo (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidatura para triagem ou todas já foram processadas.</p>';
      return;
    }

    let listaHtml = `
 <div class="list-candidaturas">
 <h3>Candidaturas na Fase de Triagem (${snapshot.size})</h3>
`;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id; // ... (lógica de formatação de status e whatsapp inalterada) ...
      const statusTriagem = cand.status_recrutamento || "Aguardando Triagem";

      let corStatus = "secondary";
      if (statusTriagem.includes("Aprovada")) {
        corStatus = "success";
      } else if (statusTriagem.includes("Reprovada")) {
        corStatus = "danger";
      } else if (statusTriagem.includes("Recebida")) {
        corStatus = "info";
      }

      const telefone = cand.telefone_contato
        ? cand.telefone_contato.replace(/\D/g, "")
        : "";
      const mensagemWhatsApp = encodeURIComponent(
        `Olá ${
          cand.nome_completo || "candidato(a)"
        }, agradecemos seu interesse e candidatura à vaga da EuPsico. Seu currículo está em análise e entraremos em contato assim que tivermos uma resposta. Você pode acompanhar nossas novidades e a empresa aqui: https://www.eupsico.org.br/ e https://www.instagram.com/eupsico.psi/`
      );
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}&text=${mensagemWhatsApp}`
        : "#";

      listaHtml += `
 <div class="card card-candidato-triagem" data-id="${candidatoId}">
  <div class="info-primaria">
   <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
   <p>Status: <span class="badge bg-${corStatus}">${statusTriagem.replace(
        "_",
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
    class="action-button info btn-detalhes-triagem" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-info-circle me-1"></i> Detalhes
   </button>
   <button 
    class="action-button warning btn-avaliar-triagem" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-edit me-1"></i> Avaliar Candidatura
   </button>
  </div>
 </div>
 `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml; // 🔴 Listeners DYNAMICOS para Detalhes e Avaliar Candidatura // 1. Configura evento para abrir modal de detalhes (modalCandidato)

    document.querySelectorAll(".btn-detalhes-triagem").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(candidatoId, "detalhes", dados);
      });
    }); // 2. Configura evento para abrir o modal de avaliação (modalAvaliacaoTriagem)

    document.querySelectorAll(".btn-avaliar-triagem").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoTriagem(candidatoId, dados);
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar triagem:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

// =====================================================================
// INICIALIZAÇÃO DE LISTENERS ESTÁTICOS DO MODAL DE TRIAGEM
// =====================================================================

if (modalAvaliacaoTriagem) {
  // 1. Botão 'Registrar Decisão' (Chama submeterAvaliacaoTriagem)
  if (btnFinalizarTriagem) {
    btnFinalizarTriagem.removeEventListener("click", submeterAvaliacaoTriagem);
    btnFinalizarTriagem.addEventListener("click", submeterAvaliacaoTriagem); // 🔴 Define o texto inicial do botão
    btnFinalizarTriagem.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  } // 2. Botão 'Fechar' (inclui o X do cabeçalho devido ao data-modal-id)

  document
    .querySelectorAll("[data-modal-id='modal-avaliacao-triagem']")
    .forEach((btn) => {
      // Usa uma função para fechar o modal
      const fecharTriagemModal = () =>
        modalAvaliacaoTriagem.classList.remove("is-visible");

      btn.removeEventListener("click", fecharTriagemModal);
      btn.addEventListener("click", fecharTriagemModal);
    }); // 3. Botão 'Ver Currículo'

  const btnVerCurriculo = document.getElementById("btn-ver-curriculo-triagem");
  if (btnVerCurriculo) {
    // Limpa listeners garantindo que não haja duplicatas
    const old_element = btnVerCurriculo;
    const new_element = old_element.cloneNode(true);
    old_element.parentNode.replaceChild(new_element, old_element);

    new_element.addEventListener("click", (e) => {
      const link = e.currentTarget.dataset.curriculoLink;
      if (link) {
        window.open(link, "_blank");
      } else {
        window.showToast("Link do currículo não disponível.", "warning");
      }
    });
  } // 4. Lógica de mostrar/esconder o campo Motivo da Rejeição / Info Aprovação

  const radioSim = document.getElementById("modal-apto-sim");
  const radioNao = document.getElementById("modal-apto-nao"); // 🔴 Anexa listeners de RÁDIO AQUI, se a função global existir

  if (radioSim && window.toggleMotivoAprovacaoRejeicao) {
    radioSim.removeEventListener(
      "change",
      window.toggleMotivoAprovacaoRejeicao
    );
    radioSim.addEventListener("change", window.toggleMotivoAprovacaoRejeicao);
  }
  if (radioNao && window.toggleMotivoAprovacaoRejeicao) {
    radioNao.removeEventListener(
      "change",
      window.toggleMotivoAprovacaoRejeicao
    );
    radioNao.addEventListener("change", window.toggleMotivoAprovacaoRejeicao);
  }
}
