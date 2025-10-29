// modulos/rh/js/gestao_vagas.js
import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc, // Adicionado getDoc para buscar uma única vaga na edição
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

// Importa a função do novo utilitário user-management (mantido)
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// Importações do Firebase atualizadas
import { arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// =====================================================================
// CONSTANTES GLOBAIS E ELEMENTOS DO DOM
// =====================================================================

const VAGAS_COLLECTION_NAME = "vagas";
const CONFIG_COLLECTION_NAME = "configuracoesSistema";
const ID_MODAL_REJEICAO = "modal-rejeicao-ficha";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// Elementos do DOM globais
const modalVaga = document.getElementById("modal-vaga");
const formVaga = document.getElementById("form-vaga");
const modalTitle = modalVaga ? modalVaga.querySelector("h3") : null;
const btnSalvar = document.getElementById("btn-salvar-vaga");

const btnCancelarVaga = document.getElementById("btn-cancelar-vaga");
const btnEncerrarVaga = document.getElementById("btn-encerrar-vaga");

const secaoFichaTecnica = document.getElementById("secao-ficha-tecnica");
const secaoCriacaoArte = document.getElementById("secao-criacao-arte");
const secaoDivulgacao = document.getElementById("secao-divulgacao");

const caixaAlteracoesArte = document.getElementById("caixa-alteracoes-arte");
const btnEnviarAlteracoes = document.getElementById("btn-enviar-alteracoes");

let currentUserData = {};

// =====================================================================
// FUNÇÕES AUXILIARES E DE LÓGICA DE NEGÓCIO
// =====================================================================

/**
 * NOVO: Gera um resumo da vaga usando os dados principais da Ficha Técnica (para a arte).
 */
function gerarResumoVaga(vaga) {
  let resumo = `Vaga: ${vaga.nome || "Não Informado"}\n`;
  resumo += `Departamento: ${vaga.departamento || "Não Informado"}\n`;
  resumo += `Regime: ${vaga.regimeTrabalho || "Não Informado"} | Modalidade: ${
    vaga.modalidadeTrabalho || "Não Informado"
  }\n`;
  resumo += `Salário: ${vaga.valorSalario || "A Combinar"}\n\n`;
  resumo += `Principais Atividades: ${
    vaga.cargo?.responsabilidades || "N/A"
  }\n\n`;
  resumo += `Nível/Formação Mínima: ${vaga.experiencia?.nivel || "Júnior"} | ${
    vaga.formacao?.minima || "Ensino Superior"
  }\n`;

  return resumo.trim();
}

/**
 * NOVO: Função para carregar listas dinâmicas (Departamentos, Regimes, Modalidades) do Firebase.
 */
async function carregarListasFirebase() {
  const selectDepartamento = document.getElementById("vaga-departamento");

  if (!selectDepartamento) return;

  try {
    // 1. Carregar Departamentos
    // Caminho: configuracoesSistema -> geral -> listas (map) -> departamentos (array)
    const configRef = doc(db, CONFIG_COLLECTION_NAME, "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      const listas = docSnap.data().listas;
      const departamentos = listas?.departamentos || [];

      selectDepartamento.innerHTML =
        '<option value="">Selecione o Departamento</option>';

      departamentos.forEach((depto) => {
        const option = document.createElement("option");
        option.value = depto;
        option.textContent = depto;
        selectDepartamento.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar listas do Firebase:", error);
    window.showToast("Erro ao carregar listas de configuração.", "error");
  }
}

/**
 * Lida com a submissão do formulário de nova vaga ou edição.
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  const vagaId = formVaga.getAttribute("data-vaga-id");
  let isEditing = !!vagaId;
  const submitButton = e.submitter;
  if (submitButton) submitButton.disabled = true;

  try {
    // 1. EXTRAÇÃO DE DADOS PRINCIPAIS E DE AGRUPAMENTO (Ficha Técnica)
    const nome = document.getElementById("vaga-nome").value;
    const departamento = document.getElementById("vaga-departamento").value;
    const tipoRecrutamento = document.getElementById(
      "vaga-tipo-recrutamento"
    ).value;
    const regimeTrabalho = document.getElementById(
      "vaga-regime-trabalho"
    ).value;
    const modalidadeTrabalho = document.getElementById(
      "vaga-modalidade-trabalho"
    ).value;
    const valorSalario = document.getElementById("vaga-valor-salario").value;
    const dataFechamento = document.getElementById(
      "vaga-data-fechamento"
    ).value;
    const responsabilidades = document.getElementById(
      "vaga-responsabilidades"
    ).value; // Outros campos agrupados...

    const resultados = document.getElementById("vaga-resultados").value;
    const novaSubstituicao = document.getElementById(
      "vaga-nova-substituicao"
    ).value;
    const formacaoMinima = document.getElementById(
      "vaga-formacao-minima"
    ).value;
    const conselho = document.getElementById("vaga-conselho").value;
    const especializacoes = document.getElementById(
      "vaga-especializacoes"
    ).value;
    const compTecnicas = document.getElementById("vaga-comp-tecnicas").value;
    const compComportamentais = document.getElementById(
      "vaga-comp-comportamentais"
    ).value;
    const certificacoes = document.getElementById("vaga-certificacoes").value;
    const nivelExperiencia = document.getElementById(
      "vaga-nivel-experiencia"
    ).value;
    const contextosSimilares = document.getElementById(
      "vaga-contextos-similares"
    ).value;
    const atuacaoGrupos = document.getElementById("vaga-atuacao-grupos").value;
    const fitValores = document.getElementById("vaga-fit-valores").value;
    const estiloEquipe = document.getElementById("vaga-estilo-equipe").value;
    const perfilDestaque = document.getElementById(
      "vaga-perfil-destaque"
    ).value;
    const oportunidades = document.getElementById("vaga-oportunidades").value;
    const desafios = document.getElementById("vaga-desafios").value;
    const planoCarreira = document.getElementById("vaga-plano-carreira").value; // Campos da Seção de Arte e Divulgação (Salva mesmo se a seção estiver oculta)

    const resumoArte = document.getElementById("vaga-resumo-arte").value;
    const linkArte = document.getElementById("vaga-link-arte").value;
    const observacaoArte = document.getElementById(
      "vaga-observacao-arte"
    ).value; // Novo campo

    const selectCanais = document.getElementById("vaga-canais-divulgacao");
    const canaisDivulgacao = Array.from(selectCanais.options)
      .filter((option) => option.selected)
      .map((option) => option.value); // 2. CONSTRUÇÃO DO OBJETO DE DADOS

    const vagaData = {
      nome: nome,
      departamento: departamento,
      tipoRecrutamento: tipoRecrutamento,
      regimeTrabalho: regimeTrabalho,
      modalidadeTrabalho: modalidadeTrabalho,
      valorSalario: valorSalario,
      dataFechamento: dataFechamento, // Guarda a data no formato 'YYYY-MM-DD' // Mapeamento dos campos detalhados

      cargo: {
        responsabilidades: responsabilidades,
        resultados: resultados,
        novaSubstituicao: novaSubstituicao,
      },
      formacao: {
        minima: formacaoMinima,
        conselho: conselho,
        especializacoes: especializacoes,
      },
      competencias: {
        tecnicas: compTecnicas,
        comportamentais: compComportamentais,
        certificacoes: certificacoes,
      },
      experiencia: {
        nivel: nivelExperiencia,
        contextosSimilares: contextosSimilares,
        atuacaoGrupos: atuacaoGrupos,
      },
      fitCultural: {
        valoresEuPsico: fitValores,
        estiloEquipe: estiloEquipe,
        perfilDestaque: perfilDestaque,
      },
      crescimento: {
        oportunidades: oportunidades,
        desafios: desafios,
        planoCarreira: planoCarreira,
      }, // Informações da arte e divulgação

      arte: {
        resumo: resumoArte,
        link: linkArte,
        status: "Pendente", // Status só muda por ação dos botões
        observacao: observacaoArte, // Novo campo salvo // alteraçõesPendentes: string
      },
      canaisDivulgacao: canaisDivulgacao,
    };

    const historicoEntry = {
      data: new Date(),
      usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
    };

    let newStatus = "";

    if (isEditing) {
      // Carrega status anterior para decidir o que fazer no histórico
      const vagaDoc = await getDoc(doc(db, VAGAS_COLLECTION_NAME, vagaId));
      const oldStatus = vagaDoc.data().status; // 3. AÇÃO DE EDIÇÃO/ATUALIZAÇÃO // A edição da Ficha só é permitida se a vaga NÃO FOI APROVADA

      if (oldStatus === "em-divulgacao" || oldStatus === "em-recrutamento") {
        window.showToast(
          "Não é possível editar a Ficha Técnica de uma vaga aprovada.",
          "error"
        );
        return;
      }

      newStatus = oldStatus; // Se for em Criação, mantemos o status, mas se o usuário clicar em Salvar e Enviar, muda para aguardando-aprovacao

      if (
        oldStatus === "em-criação" &&
        submitButton.textContent.includes("Aprovação")
      ) {
        newStatus = "aguardando-aprovacao";
        vagaData.status = newStatus;
        vagaData.historico = arrayUnion({
          ...historicoEntry,
          acao: "Ficha Técnica finalizada e enviada para aprovação do gestor.",
        });
      } else {
        // Se for edição em Rascunho (em-criação) ou em Aguardando Aprovação (sem alteração de status)
        vagaData.historico = arrayUnion({
          ...historicoEntry,
          acao: `Vaga editada (Ficha Técnica atualizada). Status: ${newStatus}`,
        });
      }

      const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
      await updateDoc(vagaRef, vagaData);

      window.showToast(
        "Ficha Técnica da Vaga atualizada com sucesso!",
        "success"
      );
    } else {
      // 4. AÇÃO DE CRIAÇÃO (Novo Fluxo: Salvar e Enviar para Aprovação do Gestor)
      newStatus = "aguardando-aprovacao";
      vagaData.status = newStatus;
      vagaData.dataCriacao = new Date();
      vagaData.candidatosCount = 0;
      vagaData.historico = [
        {
          ...historicoEntry,
          acao: "Vaga criada (Ficha Técnica) e enviada para aprovação do gestor.",
        },
      ];

      await addDoc(vagasCollection, vagaData);
      window.showToast(
        "Ficha Técnica da Vaga salva com sucesso! Enviada para aprovação do gestor.",
        "success"
      );
    }

    document.getElementById("modal-vaga").style.display = "none"; // Recarrega a lista para o status que será o novo (aguardando-aprovacao)
    carregarVagas(newStatus);
  } catch (error) {
    console.error("Erro ao salvar/atualizar a Ficha Técnica da vaga:", error);
    window.showToast(
      "Ocorreu um erro ao salvar/atualizar a Ficha Técnica da vaga.",
      "error"
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

/**
 * NOVO: Lida com o salvamento do Link da Arte e Observação
 * @param {string} vagaId
 * @param {string} link
 * @param {string} observacao
 */
async function handleSalvarArteLink(vagaId, link, observacao) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    // Busca docSnap para manter o status e resumo atual
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");
    const currentArte = docSnap.data().arte || {};

    await updateDoc(vagaRef, {
      arte: {
        ...currentArte,
        link: link,
        observacao: observacao, // Salva o novo campo de observação
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Link e Observação da Arte atualizados. Link: ${link}`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Link e Observação da Arte salvos com sucesso.",
      "success"
    );
    // Recarrega o modal para exibir o status atualizado
    handleDetalhesVaga(vagaId);
  } catch (error) {
    console.error("Erro ao salvar Link/Observação da Arte:", error);
    window.showToast(
      "Ocorreu um erro ao salvar o Link/Observação da Arte.",
      "error"
    );
  }
}

/**
 * NOVO: Abre um modal para solicitar a justificativa da rejeição.
 * @param {string} vagaId
 */
function modalRejeicaoFichaTecnica(vagaId) {
  let modal = document.getElementById(ID_MODAL_REJEICAO); // Se o modal não existe, cria ele (simulação de um modal simples)

  if (!modal) {
    modal = document.createElement("div");
    modal.id = ID_MODAL_REJEICAO;
    modal.className = "modal-overlay"; // Adiciona um estilo básico para garantir que o modal de rejeição seja visível
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modal.style.zIndex = "1000";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 450px; background-color: white; padding: 20px; border-radius: 8px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px;">
          <h3 style="margin: 0;">Rejeitar Ficha Técnica</h3>
          <button type="button" class="close-modal-btn fechar-modal-rejeicao" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div class="modal-body">
          <p>Por favor, informe o motivo pelo qual a Ficha Técnica será rejeitada e retornada para a fase de criação:</p>
          <div class="form-group" style="margin-bottom: 15px;">
            <label for="rejeicao-motivo">Justificativa:</label>
            <textarea id="rejeicao-motivo" rows="4" required style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="btn btn-secondary fechar-modal-rejeicao">Cancelar</button>
          <button type="button" class="btn btn-danger" id="btn-confirmar-rejeicao">Confirmar Rejeição</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal); // Adiciona evento de fechar

    modal.querySelectorAll(".fechar-modal-rejeicao").forEach((btn) => {
      btn.onclick = () => (modal.style.display = "none");
    });
  } // Configura evento de confirmação no novo modal

  const btnConfirmar = modal.querySelector("#btn-confirmar-rejeicao");
  if (btnConfirmar) {
    btnConfirmar.onclick = () => {
      const motivo = document.getElementById("rejeicao-motivo").value;
      if (motivo.trim()) {
        modal.style.display = "none";
        handleRejeitarFichaTecnica(vagaId, motivo);
      } else {
        window.showToast("O motivo da rejeição é obrigatório.", "warning");
      }
    };
  } // Reseta o campo de texto antes de abrir

  document.getElementById("rejeicao-motivo").value = "";

  modal.style.display = "flex";
}

/**
 * NOVO: Lida com a Rejeição da Ficha Técnica pelo Gestor (volta para Em Criação).
 * MODIFICADA: Agora recebe a justificativa.
 * @param {string} vagaId
 * @param {string} justificativa
 */
async function handleRejeitarFichaTecnica(vagaId, justificativa) {
  if (!vagaId || !justificativa) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "em-criação", // Volta para Em Criação (aba "Abertas")
      historico: arrayUnion({
        data: new Date(),
        acao: `Ficha Técnica REJEITADA. Motivo: ${justificativa.substring(
          0,
          80
        )}...`,
        justificativa: justificativa,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Ficha Técnica rejeitada. Retornando para Em Elaboração.",
      "info"
    );
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("abertas");
  } catch (error) {
    console.error("Erro ao rejeitar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao rejeitar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Lida com a Aprovação da Ficha Técnica pelo Gestor.
 */
async function handleAprovarFichaTecnica(vagaId) {
  if (
    !vagaId ||
    !confirm(
      "Confirma a APROVAÇÃO desta Ficha Técnica de Vaga? Isso liberará a próxima etapa de Criação da Arte."
    )
  )
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "arte-pendente", // Próxima fase: Criação da Arte
      dataAprovacaoFicha: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Ficha Técnica APROVADA. Próxima etapa: Criação da Arte.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Ficha Técnica aprovada! Próximo passo é a Criação da Arte.",
      "success"
    );
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao aprovar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao aprovar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Lida com a Aprovação da Arte pelo Gestor.
 */
async function handleAprovarArte() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
  if (!vagaId || !confirm("Confirma a APROVAÇÃO da arte de divulgação?"))
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId); // Busca docSnap para usar os dados de arte existentes
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "em-divulgacao", // Próxima fase: em Divulgação
      arte: {
        ...docSnap.data().arte, // Mantém resumo, link e observação
        status: "Aprovada",
        alteracoesPendentes: null, // Limpa qualquer pendência
      },
      historico: arrayUnion({
        data: new Date(),
        acao: "Arte de divulgação APROVADA. Vaga pronta para ser divulgada.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Arte aprovada! A vaga agora está em Divulgação.",
      "success"
    );
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("em-divulgacao");
  } catch (error) {
    console.error("Erro ao aprovar arte:", error);
    window.showToast("Ocorreu um erro ao aprovar a arte.", "error");
  }
}

/**
 * NOVO: Lida com a Solicitação de Alterações na Arte.
 */
async function handleSolicitarAlteracoes(vagaId) {
  const alteracoes = document.getElementById("vaga-alteracoes-arte").value;

  if (!vagaId) {
    // Obter vagaId do formulário se não foi passado como argumento (usado na injeção)
    vagaId = formVaga.getAttribute("data-vaga-id");
  }

  if (!vagaId || !alteracoes) {
    window.showToast(
      "Por favor, descreva as alterações solicitadas.",
      "warning"
    );
    return;
  }

  if (!confirm("Confirma a SOLICITAÇÃO de alterações na arte?")) return;

  const btnSubmit = document.getElementById("btn-enviar-alteracoes");
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId); // Busca docSnap para usar os dados de arte existentes
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "arte-pendente", // Mantém o status para que o RH saiba que está pendente de correção
      arte: {
        ...docSnap.data().arte, // Mantém resumo e link
        status: "Alteração Solicitada",
        alteracoesPendentes: alteracoes,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Alterações na arte solicitadas: ${alteracoes.substring(
          0,
          50
        )}...`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Solicitação de alterações enviada com sucesso.", "info");
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao solicitar alterações na arte:", error);
    window.showToast("Ocorreu um erro ao solicitar alterações.", "error");
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

/**
 * NOVO: Lida com o Cancelamento da Divulgação.
 */
async function handleCancelarDivulgacao() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
  if (!vagaId) return;

  if (
    !confirm(
      "Tem certeza que deseja CANCELAR a divulgação e arquivar esta vaga? Esta ação pode ser revertida manualmente, mas interrompe o fluxo de recrutamento."
    )
  ) {
    return;
  }

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "cancelada", // Novo status para cancelamento
      dataCancelamento: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga CANCELADA (Fluxo de divulgação interrompido).",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Vaga cancelada com sucesso!", "info");
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("fechadas"); // Exibe vagas canceladas/encerradas na aba Fechadas
  } catch (error) {
    console.error("Erro ao cancelar a vaga:", error);
    window.showToast("Ocorreu um erro ao cancelar a vaga.", "error");
  }
}

/**
 * NOVO: Lida com o Encerramento da Vaga (pós-recrutamento ou por outro motivo).
 */
async function handleEncerrarVaga() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
  if (!vagaId) return;

  if (
    !confirm(
      "Tem certeza que deseja ENCERRAR a vaga? Se o recrutamento foi concluído, esta é a ação correta. Se não, use 'Cancelar Vaga'."
    )
  ) {
    return;
  }

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "encerrada", // Novo status para encerramento
      dataEncerramento: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga ENCERRADA (Recrutamento concluído ou finalizado).",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Vaga encerrada com sucesso!", "success");
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("fechadas"); // Exibe vagas canceladas/encerradas na aba Fechadas
  } catch (error) {
    console.error("Erro ao encerrar a vaga:", error);
    window.showToast("Ocorreu um erro ao encerrar a vaga.", "error");
  }
}

/**
 * Carrega e exibe as vagas com base no status.
 * @param {string} status
 */
async function carregarVagas(status) {
  const listaVagas = document.getElementById("lista-vagas");
  if (!listaVagas) return;
  listaVagas.innerHTML =
    '<div class="loading-spinner">Carregando vagas...</div>'; // NOVO: Mapeia o status da aba para o status real do Firestore para consultas

  let statusArray = [status];

  if (status === "abertas") {
    // "Abertas" agora é somente "Em Criação" (rascunho)
    statusArray = ["em-criação"];
  } else if (status === "fechadas") {
    statusArray = ["cancelada", "encerrada"];
  } else if (status === "aprovacao-gestao") {
    statusArray = ["aguardando-aprovacao"];
  } else if (status === "arte-pendente") {
    statusArray = ["arte-pendente"];
  } else if (status === "em-divulgacao") {
    statusArray = ["em-divulgacao"];
  } // 1. Consulta Estreita (Conteúdo da Aba Ativa)

  const queryConteudo = query(
    vagasCollection,
    where("status", "in", statusArray)
  ); // 2. Consulta Ampla (Para Contagem Global) // Busca todos os status ativos/fechados para garantir que a contagem seja precisa.

  const allStatuses = [
    "em-criação",
    "aguardando-aprovacao",
    "arte-pendente",
    "em-divulgacao",
    "encerrada",
    "cancelada",
  ];

  const queryContagemGlobal = query(
    vagasCollection,
    where("status", "in", allStatuses)
  ); // Executa ambas as consultas em paralelo

  const [snapshotConteudo, snapshotContagem] = await Promise.all([
    getDocs(queryConteudo),
    getDocs(queryContagemGlobal),
  ]);

  let htmlVagas = "";
  let count = 0;

  const counts = {
    abertas: 0,
    "aprovacao-gestao": 0,
    "arte-pendente": 0,
    "em-divulgacao": 0,
    fechadas: 0,
  }; // 1. Contagem GLOBAL (Baseada em todos os documentos)

  snapshotContagem.docs.forEach((doc) => {
    const vaga = doc.data(); // Contagem da aba "Em Elaboração"

    if (vaga.status === "em-criação") {
      counts["abertas"]++;
    } // Contagem das demais abas

    if (vaga.status === "aguardando-aprovacao") counts["aprovacao-gestao"]++;
    if (vaga.status === "arte-pendente") counts["arte-pendente"]++;
    if (vaga.status === "em-divulgacao") counts["em-divulgacao"]++;
    if (vaga.status === "cancelada" || vaga.status === "encerrada")
      counts["fechadas"]++;
  }); // 2. Renderização (Apenas os documentos da aba ativa)

  snapshotConteudo.docs.forEach((doc) => {
    const vaga = doc.data();
    vaga.id = doc.id;
    count++; // Conta apenas os que serão renderizados

    const statusFormatado = vaga.status
      .toUpperCase()
      .replace(/-/g, " ")
      .replace("APROVACAO GESTAO", "AGUARDANDO APROVAÇÃO"); // CORRIGIDO: Mapeia informações principais, incluindo o Departamento

    const infoSecundaria = [
      `Dpto: ${vaga.departamento || "Não definido"}`,
      `Regime: ${vaga.regimeTrabalho || "Não definido"}`,
      `Salário: ${vaga.valorSalario || "Não informado"}`,
    ].join(" | ");

    htmlVagas += `
    <div class="card card-vaga" data-id="${vaga.id}">
      <h4>${vaga.nome}</h4>
      <p class="text-secondary small-info">${infoSecundaria}</p>
      <p>Status: **${statusFormatado}**</p>
      <p>Candidatos: ${vaga.candidatosCount || 0}</p>
      <div class="rh-card-actions">
        <button class="btn btn-primary btn-detalhes" data-id="${
          vaga.id
        }">Ver/Gerenciar Vaga</button>
      </div>
    </div>
  `;
  }); // Atualiza os contadores em todos os botões de status (usa counts globais)

  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    const btnStatus = btn.getAttribute("data-status");
    const countValue = counts[btnStatus] || 0; // Formatação dos nomes das abas

    let tabText = btnStatus;
    if (btnStatus === "aprovacao-gestao") tabText = "Aguardando Aprovação";
    if (btnStatus === "arte-pendente") tabText = "Criação da Arte";
    if (btnStatus === "em-divulgacao") tabText = "Em Divulgação";
    if (btnStatus === "fechadas") tabText = "Fechadas/Encerradas";
    if (btnStatus === "abertas") tabText = "Em Elaboração";

    btn.textContent = `${tabText} (${countValue})`;
  });

  if (count === 0) {
    listaVagas.innerHTML = `<p id="mensagem-vagas">Nenhuma vaga encontrada para o status: **${status
      .replace(/-/g, " ")
      .toUpperCase()}**.</p>`;
    return;
  }

  listaVagas.innerHTML = htmlVagas; // Adiciona eventos de detalhe/gerenciamento

  document.querySelectorAll(".btn-detalhes").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      handleDetalhesVaga(e.target.getAttribute("data-id"));
    });
  });
}

/**
 * Função de inicialização principal do módulo.
 * CORREÇÃO: Função renomeada para ser mais robusta e exportada via alias.
 * @param {object} user - Objeto de usuário do Firebase Auth.
 * @param {object} userData - Dados de perfil do usuário logado no Firestore.
 */
async function initgestaovagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas e Recrutamento...");

  currentUserData = userData || {};

  if (modalVaga) modalVaga.style.display = "none";

  const btnNovaVaga = document.getElementById("btn-nova-vaga"); // 1. Carrega as listas dinâmicas (Departamentos)

  await carregarListasFirebase(); // 2. Configura eventos de UI

  if (btnNovaVaga) {
    // CORREÇÃO: A função openNewVagaModal deve ser definida para ser acessível
    btnNovaVaga.addEventListener("click", openNewVagaModal);
  } // NOVO: Adiciona eventos aos botões de controle de fluxo no modal

  if (btnCancelarVaga) {
    btnCancelarVaga.addEventListener("click", handleCancelarDivulgacao);
  }
  if (btnEncerrarVaga) {
    btnEncerrarVaga.addEventListener("click", handleEncerrarVaga);
  } // Configura evento de fechamento do modal

  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      // NOVO: Remove botões dinâmicos ao fechar o modal
      const dynamicButtonsFicha = modalVaga.querySelector(
        ".acoes-aprovacao-ficha-wrapper"
      );
      if (dynamicButtonsFicha) dynamicButtonsFicha.remove();

      const dynamicButtonsArte = modalVaga.querySelector(".acoes-arte-wrapper");
      if (dynamicButtonsArte) dynamicButtonsArte.remove();

      if (modalVaga) modalVaga.style.display = "none";
    });
  }); // Configura submissão do formulário (Salvar Ficha Técnica)

  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  } // 3. Carrega a lista inicial (vagas abertas)

  document.querySelectorAll(".status-tabs .tab-link").forEach((b) => {
    b.classList.remove("active");
    if (b.getAttribute("data-status") === "abertas") {
      b.classList.add("active");
    }
  });

  await carregarVagas("abertas"); // 4. Adiciona eventos aos botões de status (filtragem)

  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .tab-link")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarVagas(status);
    });
  });
}

// CORREÇÃO DE ERRO DE INICIALIZAÇÃO: Exporta a função principal e um alias 'init'
export { initgestaovagas };
