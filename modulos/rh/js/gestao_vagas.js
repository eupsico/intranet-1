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
  FieldValue,
  getDoc, // Adicionado getDoc para buscar uma única vaga na edição
  deleteDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js"; // Ajuste o caminho conforme necessário

// Importa a função do novo utilitário user-management
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// NOVO: Define a constante para o nome da coleção
const VAGAS_COLLECTION_NAME = "recursos_humanos";

// Coleção principal no Firestore para as vagas
// CORRIGIDO: Agora aponta para a nova coleção.
const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidatosCollection = collection(db, "candidatos");

// Elementos do DOM globais
const modalVaga = document.getElementById("modal-vaga");
const formVaga = document.getElementById("form-vaga");
const selectGestor = document.getElementById("vaga-gestor");
const btnSalvar = formVaga
  ? formVaga.querySelector('button[type="submit"]')
  : null;
const modalTitle = modalVaga ? modalVaga.querySelector("h3") : null;
// NOVO: Adiciona o botão de excluir
const btnExcluir = document.getElementById("btn-excluir-vaga");

let currentUserData = {}; // Para armazenar os dados do usuário logado

/**
 * Função para carregar a lista de gestores e popular o campo select.
 */
async function carregarGestores() {
  // CORRIGIDO: Busca usuários com a função 'gestor' (tudo minúsculo)
  const gestores = await fetchUsersByRole("gestor");

  if (!selectGestor) return;
  selectGestor.innerHTML = '<option value="">Selecione o Gestor...</option>';

  if (gestores.length === 0) {
    // Exibir esta mensagem apenas se não encontrar o gestor.
    console.warn(
      "Nenhum usuário com a função 'gestor' encontrado no banco de dados."
    );
    return;
  }

  gestores.forEach((gestor) => {
    const option = document.createElement("option");
    option.value = gestor.id;
    option.textContent = gestor.nome || gestor.email; // Prefere o nome, senão usa o email
    selectGestor.appendChild(option);
  });
}

/**
 * Função para configurar o modal para criação de uma nova vaga.
 */
function openNewVagaModal() {
  if (formVaga) {
    formVaga.reset();
    formVaga.removeAttribute("data-vaga-id"); // Remove ID para indicar criação
  }
  if (modalTitle) modalTitle.textContent = "Ficha Técnica da Vaga"; // CORRIGIDO: Novo Título
  if (btnSalvar) btnSalvar.textContent = "Salvar e Iniciar Aprovação";

  // NOVO: Oculta o botão de excluir na criação
  if (btnExcluir) btnExcluir.style.display = "none";

  if (modalVaga) modalVaga.style.display = "flex"; // Implementa o popup
}

/**
 * Função para buscar e exibir os detalhes de uma vaga para edição.
 * @param {string} vagaId
 */
async function handleDetalhesVaga(vagaId) {
  if (!vagaId) return;

  try {
    // CORRIGIDO: Usa a nova coleção
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);

    if (!docSnap.exists()) {
      window.showToast("Vaga não encontrada.", "error");
      return;
    }

    const vaga = docSnap.data();

    // 1. Preenche o formulário (Mapeamento completo dos novos campos)
    if (document.getElementById("vaga-nome"))
      document.getElementById("vaga-nome").value = vaga.nome || "";

    // NOVOS CAMPOS: SOBRE O CARGO
    if (document.getElementById("vaga-responsabilidades"))
      document.getElementById("vaga-responsabilidades").value =
        vaga.cargo?.responsabilidades || "";
    if (document.getElementById("vaga-resultados"))
      document.getElementById("vaga-resultados").value =
        vaga.cargo?.resultados || "";
    if (document.getElementById("vaga-nova-substituicao"))
      document.getElementById("vaga-nova-substituicao").value =
        vaga.cargo?.novaSubstituicao || "";

    // NOVOS CAMPOS: FORMAÇÃO E QUALIFICAÇÕES
    if (document.getElementById("vaga-formacao-minima"))
      document.getElementById("vaga-formacao-minima").value =
        vaga.formacao?.minima || "";
    if (document.getElementById("vaga-conselho"))
      document.getElementById("vaga-conselho").value =
        vaga.formacao?.conselho || "";
    if (document.getElementById("vaga-especializacoes"))
      document.getElementById("vaga-especializacoes").value =
        vaga.formacao?.especializacoes || "";

    // NOVOS CAMPOS: COMPETÊNCIAS E HABILIDADES
    if (document.getElementById("vaga-comp-tecnicas"))
      document.getElementById("vaga-comp-tecnicas").value =
        vaga.competencias?.tecnicas || "";
    if (document.getElementById("vaga-comp-comportamentais"))
      document.getElementById("vaga-comp-comportamentais").value =
        vaga.competencias?.comportamentais || "";
    if (document.getElementById("vaga-certificacoes"))
      document.getElementById("vaga-certificacoes").value =
        vaga.competencias?.certificacoes || "";

    // NOVOS CAMPOS: EXPERIÊNCIA E ATUAÇÃO
    if (document.getElementById("vaga-nivel-experiencia"))
      document.getElementById("vaga-nivel-experiencia").value =
        vaga.experiencia?.nivel || "";
    if (document.getElementById("vaga-contextos-similares"))
      document.getElementById("vaga-contextos-similares").value =
        vaga.experiencia?.contextosSimilares || "";
    if (document.getElementById("vaga-atuacao-grupos"))
      document.getElementById("vaga-atuacao-grupos").value =
        vaga.experiencia?.atuacaoGrupos || "";

    // NOVOS CAMPOS: FIT CULTURAL E VALORES
    if (document.getElementById("vaga-fit-valores"))
      document.getElementById("vaga-fit-valores").value =
        vaga.fitCultural?.valoresEuPsico || "";
    if (document.getElementById("vaga-estilo-equipe"))
      document.getElementById("vaga-estilo-equipe").value =
        vaga.fitCultural?.estiloEquipe || "";
    if (document.getElementById("vaga-perfil-destaque"))
      document.getElementById("vaga-perfil-destaque").value =
        vaga.fitCultural?.perfilDestaque || "";

    // NOVOS CAMPOS: CRESCIMENTO E DESAFIOS
    if (document.getElementById("vaga-oportunidades"))
      document.getElementById("vaga-oportunidades").value =
        vaga.crescimento?.oportunidades || "";
    if (document.getElementById("vaga-desafios"))
      document.getElementById("vaga-desafios").value =
        vaga.crescimento?.desafios || "";
    if (document.getElementById("vaga-plano-carreira"))
      document.getElementById("vaga-plano-carreira").value =
        vaga.crescimento?.planoCarreira || "";

    // NOVOS CAMPOS: REQUISITOS PRÁTICOS
    if (document.getElementById("vaga-carga-horaria"))
      document.getElementById("vaga-carga-horaria").value =
        vaga.praticos?.cargaHoraria || "";
    if (document.getElementById("vaga-faixa-salarial"))
      document.getElementById("vaga-faixa-salarial").value =
        vaga.praticos?.faixaSalarial || "";

    // Campo Antigo: Mantido para compatibilidade, se necessário no futuro.
    if (document.getElementById("vaga-descricao"))
      document.getElementById("vaga-descricao").value = vaga.descricao || "";

    // Garante que o select do gestor esteja populado antes de tentar selecionar
    await carregarGestores();
    if (document.getElementById("vaga-gestor"))
      document.getElementById("vaga-gestor").value = vaga.gestorId;

    // 2. Configura o modal para edição
    if (formVaga) formVaga.setAttribute("data-vaga-id", vagaId);
    if (modalTitle) modalTitle.textContent = "Editar Ficha Técnica da Vaga";
    if (btnSalvar) btnSalvar.textContent = "Salvar Alterações";

    // NOVO: Exibe o botão de excluir na edição
    if (btnExcluir) btnExcluir.style.display = "inline-block";

    if (modalVaga) modalVaga.style.display = "flex"; // Implementa o popup
  } catch (error) {
    console.error("Erro ao carregar detalhes da vaga:", error);
    window.showToast("Erro ao carregar os dados para edição.", "error");
  }
}

/**
 * Lida com a submissão do formulário de nova vaga ou edição.
 * @param {Event} e
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  const vagaId = formVaga.getAttribute("data-vaga-id");
  const isEditing = !!vagaId;
  const submitButton = e.submitter;
  if (submitButton) submitButton.disabled = true;

  // 1. EXTRAÇÃO DE DADOS DE TODOS OS CAMPOS DO NOVO FORMULÁRIO (FICHA TÉCNICA)
  const nome = document.getElementById("vaga-nome").value;
  const gestorId = document.getElementById("vaga-gestor").value;

  // Usaremos responsabilidades como a 'descricao' principal (se o backend exigir)
  const responsabilidades = document.getElementById(
    "vaga-responsabilidades"
  ).value;

  // Novas variáveis
  const resultados = document.getElementById("vaga-resultados").value;
  const novaSubstituicao = document.getElementById(
    "vaga-nova-substituicao"
  ).value;
  const formacaoMinima = document.getElementById("vaga-formacao-minima").value;
  const conselho = document.getElementById("vaga-conselho").value;
  const especializacoes = document.getElementById("vaga-especializacoes").value;
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
  const perfilDestaque = document.getElementById("vaga-perfil-destaque").value;
  const oportunidades = document.getElementById("vaga-oportunidades").value;
  const desafios = document.getElementById("vaga-desafios").value;
  const planoCarreira = document.getElementById("vaga-plano-carreira").value;
  const cargaHoraria = document.getElementById("vaga-carga-horaria").value;
  const faixaSalarial = document.getElementById("vaga-faixa-salarial").value;

  try {
    const vagaData = {
      nome: nome,
      descricao: responsabilidades, // Usando responsabilidades como o campo 'descricao' principal para compatibilidade.
      gestorId: gestorId,

      // NOVOS CAMPOS AGRUPADOS PARA MELHOR ORGANIZAÇÃO NO FIRESTORE

      // 1. Sobre o Cargo
      cargo: {
        responsabilidades: responsabilidades,
        resultados: resultados,
        novaSubstituicao: novaSubstituicao,
      },
      // 2. Formação e Qualificações
      formacao: {
        minima: formacaoMinima,
        conselho: conselho,
        especializacoes: especializacoes,
      },
      // 3. Competências e Habilidades
      competencias: {
        tecnicas: compTecnicas,
        comportamentais: compComportamentais,
        certificacoes: certificacoes,
      },
      // 4. Experiência e Atuação
      experiencia: {
        nivel: nivelExperiencia,
        contextosSimilares: contextosSimilares,
        atuacaoGrupos: atuacaoGrupos,
      },
      // 5. Fit Cultural e Valores
      fitCultural: {
        valoresEuPsico: fitValores,
        estiloEquipe: estiloEquipe,
        perfilDestaque: perfilDestaque,
      },
      // 6. Crescimento e Desafios
      crescimento: {
        oportunidades: oportunidades,
        desafios: desafios,
        planoCarreira: planoCarreira,
      },
      // 7. Requisitos Práticos
      praticos: {
        cargaHoraria: cargaHoraria,
        faixaSalarial: faixaSalarial,
      },
    };

    const historicoEntry = {
      data: new Date(),
      usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
    };

    if (isEditing) {
      // Ação de Edição
      vagaData.historico = FieldValue.arrayUnion({
        ...historicoEntry,
        acao: "Vaga editada. (Ficha Técnica Atualizada)",
      });

      // CORRIGIDO: Usa a nova coleção
      const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
      await updateDoc(vagaRef, vagaData);
      window.showToast(
        "Ficha Técnica da Vaga atualizada com sucesso!",
        "success"
      );
    } else {
      // Ação de Criação
      vagaData.status = "aguardando-aprovacao"; // Inicia sempre aguardando aprovação
      vagaData.dataCriacao = new Date();
      vagaData.candidatosCount = 0;
      vagaData.historico = [
        {
          ...historicoEntry,
          acao: "Vaga criada (Ficha Técnica) e enviada para aprovação do gestor.",
        },
      ];

      // CORRIGIDO: Salva na nova coleção (variável vagasCollection já está corrigida)
      await addDoc(vagasCollection, vagaData);
      window.showToast(
        "Ficha Técnica da Vaga salva com sucesso! Aguardando aprovação.",
        "success"
      );
    }

    document.getElementById("modal-vaga").style.display = "none"; // Recarrega a lista para o status que for mais provável de ser o atual após a ação
    const activeTab = document.querySelector(".status-tabs .tab-link.active");
    const newStatus = isEditing
      ? activeTab.getAttribute("data-status")
      : "aguardando-aprovacao";
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
 * NOVO: Função para excluir uma vaga.
 * @param {Event} e
 */
async function handleExcluirVaga(e) {
  const vagaId = formVaga.getAttribute("data-vaga-id");
  if (!vagaId) return;

  if (
    !confirm(
      "Tem certeza que deseja EXCLUIR permanentemente esta Ficha Técnica de Vaga? Esta ação não pode ser desfeita."
    )
  ) {
    return;
  }

  try {
    // CORRIGIDO: Usa a nova coleção
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await deleteDoc(vagaRef);

    window.showToast("Ficha Técnica da Vaga excluída com sucesso!", "success");

    // Esconde o modal e recarrega a lista
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("abertas");
  } catch (error) {
    console.error("Erro ao excluir a Ficha Técnica da vaga:", error);
    window.showToast(
      "Ocorreu um erro ao excluir a Ficha Técnica da vaga.",
      "error"
    );
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
    '<div class="loading-spinner">Carregando vagas...</div>';

  // NOVO: Mapeia o status da aba para o status real do Firestore
  let statusParaQuery = status;
  if (status === "aprovacao-gestao") {
    statusParaQuery = "aguardando-aprovacao";
  }

  // CORRIGIDO: Sempre busca TODOS os documentos da coleção para que a contagem em todas as abas seja precisa.
  const q = query(vagasCollection);

  try {
    const snapshot = await getDocs(q); // Snapshot completo de todas as vagas.
    let htmlVagas = "";
    let count = 0; // Contador para a aba ativa

    const counts = {
      abertas: 0,
      "aprovacao-gestao": 0,
      "em-divulgacao": 0,
      fechadas: 0,
    };

    // Contagem e Renderização
    snapshot.docs.forEach((doc) => {
      const vaga = doc.data(); // Atualiza contadores para as abas

      // 1. Contagem (A lógica de contagem total percorre todos os documentos do snapshot COMPLETO)
      if (
        vaga.status === "aguardando-aprovacao" ||
        vaga.status === "em-divulgacao"
      ) {
        counts["abertas"]++;
      }
      if (vaga.status === "aguardando-aprovacao") counts["aprovacao-gestao"]++;
      if (vaga.status === "em-divulgacao") counts["em-divulgacao"]++;
      if (vaga.status === "fechadas") counts["fechadas"]++;

      // 2. Renderização (Verifica se a vaga pertence à aba ativa para ser exibida)
      const shouldRender =
        (status === "abertas" &&
          (vaga.status === "aguardando-aprovacao" ||
            vaga.status === "em-divulgacao")) ||
        (status !== "abertas" && vaga.status === statusParaQuery); // CORRIGIDO: Usa statusParaQuery

      if (shouldRender) {
        vaga.id = doc.id;
        count++;

        // NOVO: Mapeia informações principais para a aprovação (conforme solicitação)
        const infoAprovacao = [
          `Nível: ${vaga.experiencia?.nivel || "Não definido"}`,
          `Formação: ${vaga.formacao?.minima || "Não definida"}`,
          `Resp.: ${
            vaga.cargo?.responsabilidades
              ? vaga.cargo.responsabilidades.substring(0, 40) + "..."
              : "Não definida"
          }`,
        ].join(" | ");

        htmlVagas += `
            <div class="card card-vaga" data-id="${vaga.id}">
                <h4>${vaga.nome}</h4>
                <p class="text-secondary small-info">${infoAprovacao}</p>
                <p>Status: **${vaga.status
                  .toUpperCase()
                  .replace(/-/g, " ")}**</p>
                <p>Candidatos: ${vaga.candidatosCount || 0}</p>
                <div class="rh-card-actions">
                    <button class="btn btn-primary btn-detalhes" data-id="${
                      vaga.id
                    }">Ver/Editar Detalhes</button>
                    ${
                      vaga.status === "aguardando-aprovacao"
                        ? `<button class="btn btn-success btn-aprovar" data-id="${vaga.id}">Aprovar Vaga</button>`
                        : ""
                    }
                </div>
            </div>
        `;
      }
    });

    // Atualiza os contadores em todos os botões de status
    document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
      // CORRIGIDO: usa a classe .tab-link
      const btnStatus = btn.getAttribute("data-status");
      const countValue = counts[btnStatus] || 0;

      btn.textContent = `${btnStatus
        .replace(/-/g, " ")
        .replace("aprovacao gestao", "Aguardando Aprovação")
        .toUpperCase()} (${countValue})`;
    });

    if (count === 0) {
      listaVagas.innerHTML = `<p id="mensagem-vagas">Nenhuma vaga encontrada para o status: **${status.replace(
        /-/g,
        " "
      )}**.</p>`;
      return;
    }

    listaVagas.innerHTML = htmlVagas;

    // Adiciona eventos para botões de detalhes/edição
    document.querySelectorAll(".btn-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        handleDetalhesVaga(e.target.getAttribute("data-id"));
      });
    });
    // Adiciona eventos para botões de aprovação
    document.querySelectorAll(".btn-aprovar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        handleAprovarVaga(e.target.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar vagas:", error);
    listaVagas.innerHTML = '<p class="error">Erro ao carregar as vagas.</p>';
  }
}

/**
 * Função mock para simular a aprovação de uma vaga pelo gestor.
 * Numa arquitetura robusta, isso seria uma Cloud Function ou um processo de permissão.
 * @param {string} vagaId
 */
async function handleAprovarVaga(vagaId) {
  if (
    !confirm(
      "Tem certeza que deseja aprovar esta vaga e iniciar o recrutamento?"
    )
  ) {
    return;
  }

  try {
    // CORRIGIDO: Usa a nova coleção
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "em-divulgacao", // Passa para a fase de recrutamento/divulgação
      dataAprovacao: new Date(),
      // CORRIGIDO: Usa a função arrayUnion importada diretamente
      historico: arrayUnion({
        // <--- MUDANÇA AQUI
        data: new Date(),
        acao: "Vaga aprovada e liberada para divulgação/recrutamento.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO", // TODO: Substituir pelo ID do usuário logado
      }),
    });

    window.showToast(
      "Vaga aprovada com sucesso! Agora está em recrutamento.",
      "success"
    );
    carregarVagas("em-divulgacao"); // Recarrega para a nova aba
  } catch (error) {
    console.error("Erro ao aprovar vaga:", error);
    window.showToast("Ocorreu um erro ao aprovar a vaga.", "error");
  }
}

/**
 * Função de inicialização principal do módulo, chamada pelo rh-painel.js.
 * @param {object} user - Objeto de usuário do Firebase Auth.
 * @param {object} userData - Dados de perfil do usuário logado no Firestore.
 */
export async function initgestaovagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas e Recrutamento...");

  // Armazena dados do usuário para uso em logs de auditoria/histórico
  currentUserData = userData || {};

  // CORRIGIDO: Garante que o modal esteja oculto ao carregar,
  // resolvendo o problema de auto-abertura.
  if (modalVaga) modalVaga.style.display = "none";

  const btnNovaVaga = document.getElementById("btn-nova-vaga");

  // 1. Carrega a lista de gestores (assíncrono)
  await carregarGestores();

  // 2. Configura eventos de UI
  if (btnNovaVaga) {
    btnNovaVaga.addEventListener("click", openNewVagaModal);
  }

  // NOVO: Adiciona evento de exclusão
  if (btnExcluir) {
    btnExcluir.addEventListener("click", handleExcluirVaga);
  }

  // Configura evento de fechamento do modal
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (modalVaga) modalVaga.style.display = "none";
    });
  });

  // Configura submissão do formulário (criação/edição)
  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  }

  // 3. Carrega a lista inicial (vagas abertas)
  // Garante que a aba 'abertas' esteja ativa por padrão
  document.querySelectorAll(".status-tabs .tab-link").forEach((b) => {
    // CORRIGIDO: Usa a classe .tab-link
    b.classList.remove("active");
    if (b.getAttribute("data-status") === "abertas") {
      b.classList.add("active");
    }
  });

  await carregarVagas("abertas");

  // 4. Adiciona eventos aos botões de status (filtragem)
  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    // CORRIGIDO: Usa a classe .tab-link
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .tab-link") // CORRIGIDO: Usa a classe .tab-link
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarVagas(status);
    });
  });
}
