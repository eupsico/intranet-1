// Arquivo: /modulos/voluntario/js/detalhe-paciente.js
// Responsável pela lógica da página de detalhes do paciente.
// *** ALTERAÇÕES: Modal Horarios PB refatorado para fluxo dinâmico ***

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  // --- Adicionados para a nova lógica ---
  writeBatch,
  deleteDoc,
  // --- Fim Adicionados ---
} from "../../../assets/js/firebase-init.js";

// --- Variáveis Globais do Módulo ---
let pacienteIdGlobal = null;
let pacienteDataGlobal = null;
let userDataGlobal = null; // Informações do usuário logado
let systemConfigsGlobal = null; // Configurações do sistema (textos, listas)
let salasPresenciaisGlobal = []; // Lista de salas
let dadosDaGradeGlobal = {}; // Dados da grade geral
let sessoesCarregadas = []; // Armazena sessões carregadas

// --- Inicialização da Página ---
export async function init(user, userData, pacienteId) {
  console.log("Inicializando detalhe-paciente.js");
  userDataGlobal = userData; // Armazena dados do usuário logado

  pacienteIdGlobal = pacienteId;

  if (!pacienteIdGlobal) {
    console.error("ID do paciente não foi passado para a função init.");
    const urlParams = new URLSearchParams(window.location.search);
    pacienteIdGlobal = urlParams.get("id");
    if (!pacienteIdGlobal) {
      document.getElementById("detalhe-paciente-view").innerHTML =
        '<p class="alert alert-error">Erro: ID do paciente não fornecido.</p>';
      return;
    }
    console.warn(
      "ID do paciente obtido da URL como fallback:",
      pacienteIdGlobal
    );
  }

  try {
    // Carregar dados essenciais em paralelo
    await Promise.all([
      carregarDadosPaciente(pacienteIdGlobal),
      carregarSystemConfigs(), // Carrega configs e salas
    ]);

    if (!pacienteDataGlobal) {
      throw new Error("Paciente não encontrado no banco de dados.");
    } // Popular a interface

    preencherFormularios(); // Agora preenche mais campos
    atualizarVisibilidadeBotoesAcao(pacienteDataGlobal.status);
    await carregarSessoes(); // Precisa carregar antes de checar pendências de sessão
    renderizarPendencias(); // Chama a função de pendências // Adicionar Event Listeners

    adicionarEventListenersGerais();
    adicionarEventListenersModais(); // Listeners específicos dos modais
  } catch (error) {
    console.error("Erro ao inicializar página de detalhes do paciente:", error);
    document.getElementById(
      "detalhe-paciente-view"
    ).innerHTML = `<p class="alert alert-error">Erro ao carregar dados do paciente: ${error.message}</p>`;
  }
}

// --- Funções de Carregamento de Dados ---

async function carregarDadosPaciente(pacienteId) {
  try {
    const docRef = doc(db, "trilhaPaciente", pacienteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      pacienteDataGlobal = { id: docSnap.id, ...docSnap.data() };
      console.log("Dados do paciente carregados:", pacienteDataGlobal);
    } else {
      console.warn(`Paciente com ID ${pacienteId} não encontrado.`);
      pacienteDataGlobal = null;
    }
  } catch (error) {
    console.error("Erro ao buscar dados do paciente:", error);
    pacienteDataGlobal = null;
    throw error; // Propaga o erro para o init tratar
  }
}

async function carregarSystemConfigs() {
  if (systemConfigsGlobal) return;
  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      systemConfigsGlobal = docSnap.data();
      salasPresenciaisGlobal =
        systemConfigsGlobal.listas?.salasPresenciais || [];
      console.log("Configurações do sistema carregadas:", systemConfigsGlobal);
    } else {
      console.warn("Documento de configurações do sistema não encontrado.");
      systemConfigsGlobal = { textos: {}, listas: {} };
      salasPresenciaisGlobal = [];
    } // Carregar dados da grade aqui também, se fizer sentido
    await loadGradeData();
  } catch (error) {
    console.error("Erro ao carregar configurações do sistema:", error);
    systemConfigsGlobal = { textos: {}, listas: {} };
    salasPresenciaisGlobal = [];
  }
}

async function loadGradeData() {
  // Função para carregar a grade
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDaGradeGlobal = gradeSnap.data();
      console.log("Dados da grade carregados.");
    } else {
      console.warn("Documento da grade não encontrado.");
      dadosDaGradeGlobal = {};
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade:", error);
    dadosDaGradeGlobal = {};
  }
}

async function carregarSessoes() {
  const container = document.getElementById("session-list-container");
  const loading = document.getElementById("session-list-loading");
  const placeholder = document.getElementById("session-list-placeholder"); // Garantir que os elementos existem antes de manipulá-los

  if (!container || !loading || !placeholder) {
    console.error("Elementos da lista de sessões não encontrados no HTML.");
    return;
  }

  loading.style.display = "block";
  placeholder.style.display = "none";
  container.querySelectorAll(".session-item").forEach((item) => item.remove()); // Limpa lista antiga
  sessoesCarregadas = []; // Limpa antes de carregar

  try {
    const sessoesRef = collection(
      db,
      "trilhaPaciente",
      pacienteIdGlobal,
      "sessoes"
    );
    const q = query(sessoesRef, orderBy("dataHora", "desc"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      // Armazena na variável global
      sessoesCarregadas.push({ id: doc.id, ...doc.data() });
    });

    console.log("Sessões carregadas:", sessoesCarregadas);

    if (sessoesCarregadas.length === 0) {
      placeholder.style.display = "block";
    } else {
      renderizarSessoes(sessoesCarregadas); // Renderiza usando a variável global
    }
  } catch (error) {
    console.error("Erro ao carregar sessões:", error);
    container.innerHTML = `<p class="alert alert-error">Erro ao carregar sessões: ${error.message}</p>`;
    placeholder.style.display = "none";
  } finally {
    loading.style.display = "none";
  }
}

// --- Funções de Renderização ---

function preencherFormularios() {
  if (!pacienteDataGlobal) return; // Função auxiliar para preencher valor (input ou span) - Modificada para inputs readonly

  const setElementValue = (
    id,
    value,
    isInputReadOnly = false,
    targetElement = document
  ) => {
    const element = targetElement.getElementById(id); // Procura dentro do targetElement (padrão document)
    if (element) {
      if (element.tagName === "SPAN") {
        // Se for SPAN (usado em alguns lugares ainda)
        element.textContent = value || "--";
      } else if (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT"
      ) {
        // Se for campo de formulário
        // Formata valor monetário para exibição se for o campo de contribuição
        if (id === "dp-valor-contribuicao" && typeof value === "number") {
          element.value = value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          element.value = value || "";
        } // Se for readonly, também atualiza textContent para alguns casos visuais se necessário (ex: status)
        if (isInputReadOnly) {
          // Para o status, copia as classes do span oculto para o input
          if (id === "dp-status-atual-input") {
            const statusSpan = document.getElementById("dp-status-atual"); // Pega o span oculto
            if (statusSpan) {
              // Limpa classes antigas de status antes de adicionar a nova
              element.className = "form-control status-badge-input"; // Reseta para classe base // Adiciona as classes relevantes do span (exceto readonly-value e status-badge base)
              statusSpan.classList.forEach((cls) => {
                if (cls !== "readonly-value" && cls !== "status-badge") {
                  element.classList.add(cls);
                }
              }); // Define o texto do input como o texto formatado do status
              element.value = statusSpan.textContent || "--";
            } else {
              element.value = value || "--"; // Fallback se span não existir
            }
          } else {
            element.value = value || "--"; // Para outros inputs readonly
          }
        }
      }
    } else {
      console.warn(`Elemento #${id} não encontrado para preenchimento.`);
    }
  }; // === Aba: Informações Pessoais ===

  const status = pacienteDataGlobal.status || "desconhecido"; // -- Alteração para preencher Input Readonly de Status --

  setElementValue("dp-status-atual", formatarStatus(status), true);
  const statusSpan = document.getElementById("dp-status-atual");
  if (statusSpan)
    statusSpan.className = `readonly-value status-badge ${status}`;
  setElementValue("dp-status-atual-input", formatarStatus(status), true); // -- Fim Alteração Status -- // -- Alteração para preencher Input Readonly de Idade --
  const idadeCalculada = calcularIdade(pacienteDataGlobal.dataNascimento);
  setElementValue("dp-idade", idadeCalculada, true);
  setElementValue("dp-idade-input", idadeCalculada, true); // -- Fim Alteração Idade --
  const dataEncaminhamentoRaw =
    pacienteDataGlobal.plantaoInfo?.dataEncaminhamento ||
    pacienteDataGlobal.atendimentosPB?.[0]?.dataEncaminhamento;
  const dataEncaminhamento = dataEncaminhamentoRaw
    ? new Date(dataEncaminhamentoRaw + "T03:00:00").toLocaleDateString("pt-BR")
    : "--"; // -- Alteração para preencher Input Readonly de Desde --

  setElementValue("dp-desde", dataEncaminhamento, true);
  setElementValue("dp-desde-input", dataEncaminhamento, true); // -- Fim Alteração Desde --
  setElementValue("dp-nome-completo", pacienteDataGlobal.nomeCompleto);
  setElementValue("dp-telefone", pacienteDataGlobal.telefoneCelular);
  setElementValue("dp-data-nascimento", pacienteDataGlobal.dataNascimento);
  setElementValue("dp-cpf", pacienteDataGlobal.cpf);

  const endereco = pacienteDataGlobal.endereco || {};
  setElementValue("dp-endereco-logradouro", endereco.logradouro);
  setElementValue("dp-endereco-numero", endereco.numero);
  setElementValue("dp-endereco-complemento", endereco.complemento);
  setElementValue("dp-endereco-bairro", endereco.bairro);
  setElementValue("dp-endereco-cidade", endereco.cidade);
  setElementValue("dp-endereco-estado", endereco.estado);
  setElementValue("dp-endereco-cep", endereco.cep);

  setElementValue("dp-responsavel-nome", pacienteDataGlobal.responsavel?.nome);
  setElementValue(
    "dp-contato-emergencia-nome",
    pacienteDataGlobal.contatoEmergencia?.nome
  );
  setElementValue(
    "dp-contato-emergencia-telefone",
    pacienteDataGlobal.contatoEmergencia?.telefone
  ); // === Aba: Informações Financeiras ===

  setElementValue(
    "dp-valor-contribuicao",
    pacienteDataGlobal.valorContribuicao
  ); // === Aba: Acompanhamento Clínico ===

  const acompanhamento = pacienteDataGlobal.acompanhamentoClinico || {};
  setElementValue("ac-avaliacao-demanda", acompanhamento.avaliacaoDemanda);
  setElementValue("ac-definicao-objetivos", acompanhamento.definicaoObjetivos);
  setElementValue("ac-diagnostico", acompanhamento.diagnostico);
  setElementValue(
    "ac-registro-encerramento",
    acompanhamento.registroEncerramento
  );
}

function renderizarSessoes(sessoes) {
  const container = document.getElementById("session-list-container");
  if (!container) {
    console.error(
      "Container da lista de sessões não encontrado para renderização."
    );
    return;
  }
  container.querySelectorAll(".session-item").forEach((item) => item.remove());

  sessoes.forEach((sessao) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "session-item";
    itemDiv.dataset.sessaoId = sessao.id;

    const dataHora = sessao.dataHora?.toDate ? sessao.dataHora.toDate() : null;
    const dataFormatada = dataHora
      ? dataHora.toLocaleDateString("pt-BR")
      : "Data Indefinida";
    const horaFormatada = dataHora
      ? dataHora.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const statusSessao = sessao.status || "pendente";

    let statusTexto = "Pendente";
    let statusClasse = "status-pendente";
    if (statusSessao === "presente") {
      statusTexto = "Realizada (Presente)";
      statusClasse = "status-realizada status-presenca";
      itemDiv.classList.add("status-realizada");
    } else if (statusSessao === "ausente") {
      statusTexto = "Realizada (Ausente)";
      statusClasse = "status-realizada status-ausente";
      itemDiv.classList.add("status-realizada");
    } else {
      itemDiv.classList.add("status-pendente");
    }

    itemDiv.innerHTML = `
  		<div class="session-info">
  			<div class="info-item">
  				<span class="label">Data</span>
  				<span class="value">${dataFormatada}</span>
  			</div>
  			<div class="info-item">
  				<span class="label">Horário</span>
  				<span class="value">${horaFormatada}</span>
  			</div>
  			<div class="info-item">
  				<span class="label">Status</span>
  				<span class="value status ${statusClasse}">${statusTexto}</span>
  			</div>
  		</div>
  		<div class="session-actions">
  			${
      statusSessao === "pendente"
        ? `
  				<button type="button" class="btn-presenca" data-action="presente">Presente</button>
  				<button type="button" class="btn-ausencia" data-action="ausente">Ausente</button>
  			`
        : ""
    }
  			<button type="button" class="action-button secondary-button btn-anotacoes" data-action="anotacoes">
  				${sessao.anotacoes ? "Ver/Editar" : "Adicionar"} Anotações
  			</button>
  		</div>
  	`;
    container.appendChild(itemDiv);
  });
}

async function renderizarPendencias() {
  const listEl = document.getElementById("pendencias-list");
  const loadingEl = document.getElementById("pendencias-loading");
  const placeholderEl = document.getElementById("pendencias-placeholder");
  const badgeEl = document.getElementById("pendencias-count-badge");

  if (!listEl || !loadingEl || !placeholderEl || !badgeEl) {
    console.error("Elementos da seção de pendências não encontrados.");
    return;
  }

  listEl.innerHTML = "";
  loadingEl.style.display = "block";
  placeholderEl.style.display = "none";
  badgeEl.style.display = "none";
  badgeEl.textContent = "0";

  const pendencias = [];

  try {
    if (!pacienteDataGlobal || !userDataGlobal) {
      throw new Error(
        "Dados do paciente ou do usuário não disponíveis para verificar pendências."
      );
    } // 1. Verificar Contrato PB

    const meuAtendimentoPB = pacienteDataGlobal.atendimentosPB?.find(
      (at) =>
        at.profissionalId === userDataGlobal.uid &&
        ["ativo", "aguardando_horarios", "horarios_informados"].includes(
          at.statusAtendimento
        ) // Inclui horarios_informados
    );
    if (meuAtendimentoPB && !meuAtendimentoPB.contratoAssinado) {
      pendencias.push({
        texto: "⚠️ Falta assinar/enviar o contrato de Psicoterapia Breve.",
        tipo: "warning",
      });
    } // 2. Verificar Aniversário

    if (pacienteDataGlobal.dataNascimento) {
      try {
        const hoje = new Date();
        const dataNascStr = pacienteDataGlobal.dataNascimento.split("T")[0];
        const nasc = new Date(dataNascStr + "T00:00:00");
        if (!isNaN(nasc.getTime())) {
          const diaNasc = nasc.getDate();
          const mesNasc = nasc.getMonth();
          const anoAtual = hoje.getFullYear();
          for (let ano of [anoAtual, anoAtual + 1]) {
            const proximoAniversario = new Date(ano, mesNasc, diaNasc);
            if (proximoAniversario < hoje && ano === anoAtual) continue;
            const diffTempo = proximoAniversario.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias <= 7) {
              const dataFormatada = `${String(diaNasc).padStart(
                2,
                "0"
              )}/${String(mesNasc + 1).padStart(2, "0")}`;
              const texto =
                diffDias === 0
                  ? `🎂 Aniversário HOJE (${dataFormatada})!`
                  : `🎂 Aniversário próximo: ${dataFormatada} (em ${diffDias} dias).`;
              pendencias.push({ texto: texto, tipo: "info" });
              break;
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao verificar aniversário:", e);
      }
    } // 3. Verificar Sessões Pendentes

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataLimitePassado = new Date(
      hoje.getTime() - 30 * 24 * 60 * 60 * 1000
    );

    sessoesCarregadas.forEach((sessao) => {
      const dataHoraSessao = sessao.dataHora?.toDate
        ? sessao.dataHora.toDate()
        : null;
      if (!dataHoraSessao) return;
      const dataSessao = new Date(dataHoraSessao);
      dataSessao.setHours(0, 0, 0, 0);
      if (dataSessao < hoje && dataSessao >= dataLimitePassado) {
        const dataFormatada = dataHoraSessao.toLocaleDateString("pt-BR");
        if (sessao.status === "pendente") {
          pendencias.push({
            texto: `🚨 Sessão de ${dataFormatada} sem registro de presença/ausência.`,
            tipo: "error",
          });
        }
        if (
          sessao.status !== "pendente" &&
          (!sessao.anotacoes || !sessao.anotacoes.fichaEvolucao)
        ) {
          pendencias.push({
            texto: `📝 Sessão de ${dataFormatada} (${sessao.status}) sem registro de anotações (Ficha Evolução).`,
            tipo: "warning",
          });
        }
      }
    }); // Renderizar

    if (pendencias.length > 0) {
      pendencias.forEach((p) => {
        const li = document.createElement("li");
        li.className = `pendencia-item ${p.tipo}`;
        li.textContent = p.texto;
        listEl.appendChild(li);
      });
      badgeEl.textContent = pendencias.length;
      badgeEl.style.display = "inline-block";
    } else {
      placeholderEl.style.display = "block";
    }
  } catch (error) {
    console.error("Erro ao verificar pendências:", error);
    listEl.innerHTML = `<li class="pendencia-item error">Erro ao carregar pendências: ${error.message}</li>`;
  } finally {
    loadingEl.style.display = "none";
  }
}

// --- Manipuladores de Eventos Gerais ---

function adicionarEventListenersGerais() {
  // Abas Principais
  const tabLinks = document.querySelectorAll(
    ".detalhe-paciente-tabs-column .tab-link"
  );
  tabLinks.forEach((link) => {
    link.addEventListener("click", handleTabClick);
  }); // Forms Editáveis

  document
    .getElementById("btn-salvar-info-pessoais")
    ?.addEventListener("click", handleSalvarDadosPessoaisEEndereco);
  document
    .getElementById("btn-salvar-endereco")
    ?.addEventListener("click", handleSalvarDadosPessoaisEEndereco);
  document
    .getElementById("form-info-financeiras")
    ?.addEventListener("submit", handleSalvarInfoFinanceiras);
  document
    .getElementById("acompanhamento-clinico-form")
    ?.addEventListener("submit", handleSalvarAcompanhamento); // Ações da Lista de Sessões

  const sessionListContainer = document.getElementById(
    "session-list-container"
  );
  if (sessionListContainer) {
    sessionListContainer.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const sessaoItem = button.closest(".session-item");
      const sessaoId = sessaoItem?.dataset.sessaoId;
      const action = button.dataset.action;
      if (!sessaoId) return;
      if (action === "presente" || action === "ausente") {
        handlePresencaAusenciaClick(sessaoId, action, button);
      } else if (action === "anotacoes") {
        handleAbrirAnotacoes(sessaoId);
      }
    });
  } // Gerar Prontuário PDF

  document
    .getElementById("btn-gerar-prontuario-pdf")
    ?.addEventListener("click", handleGerarProntuarioPDF); // Listener para Acordeão

  const accordionContainer = document.querySelector(".accordion-container");
  if (accordionContainer) {
    accordionContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".accordion-button");
      if (button) {
        const accordionItem = button.closest(".accordion-item");
        if (accordionItem) {
          handleAccordionToggle(accordionItem);
        }
      }
    });
  } else {
    console.warn(
      "Container do acordeão (.accordion-container) não encontrado."
    );
  } // Botão do Menu Hamburger de Ações

  const btnPacienteActions = document.getElementById(
    "btn-paciente-actions-toggle"
  );
  if (btnPacienteActions) {
    btnPacienteActions.addEventListener("click", (event) => {
      event.stopPropagation();
      const menuContainer = btnPacienteActions.closest(
        ".action-buttons-container.main-actions"
      );
      togglePacienteActionsMenu(menuContainer);
    });
  } else {
    console.warn(
      "Botão do menu de ações do paciente (#btn-paciente-actions-toggle) não encontrado."
    );
  }
}

function handleAccordionToggle(accordionItem) {
  if (!accordionItem) return;
  const isOpen = accordionItem.classList.contains("open");
  const container = accordionItem.closest(".accordion-container");
  if (container) {
    container.querySelectorAll(".accordion-item").forEach((item) => {
      if (item !== accordionItem) {
        item.classList.remove("open");
        const icon = item.querySelector(".accordion-icon");
        if (icon) icon.innerHTML = "&#9654;";
      }
    });
  }
  accordionItem.classList.toggle("open");
  const icon = accordionItem.querySelector(".accordion-icon");
  if (icon) {
    icon.innerHTML = accordionItem.classList.contains("open")
      ? "&#9660;"
      : "&#9654;";
  }
}

function toggleDropdown(dropdownContainer) {
  if (!dropdownContainer) return;
  document
    .querySelectorAll(".dropdown-container.active")
    .forEach((otherContainer) => {
      if (otherContainer !== dropdownContainer) {
        otherContainer.classList.remove("active");
      }
    });
  dropdownContainer.classList.toggle("active");
}

function togglePacienteActionsMenu(menuContainer) {
  if (!menuContainer) return;
  document
    .querySelectorAll(".dropdown-container.active")
    .forEach((otherContainer) => {
      if (otherContainer !== menuContainer) {
        otherContainer.classList.remove("active");
      }
    });
  menuContainer.classList.toggle("active");
}

function closeDropdownOnClickOutside(event) {
  // Fecha dropdowns antigos
  document
    .querySelectorAll(".dropdown-container.active")
    .forEach((container) => {
      if (!container.contains(event.target)) {
        container.classList.remove("active");
      }
    }); // Fecha o NOVO menu de ações do paciente
  document
    .querySelectorAll(".action-buttons-container.main-actions.active")
    .forEach((container) => {
      if (!container.contains(event.target)) {
        container.classList.remove("active");
      }
    });
}

function handleTabClick(event) {
  const clickedTab = event.currentTarget;
  const targetTabId = clickedTab.dataset.tab;
  const targetContent = document.getElementById(targetTabId);
  const parentTabsContainer = clickedTab.closest(".tabs-container");
  if (!parentTabsContainer || !targetContent) return;

  parentTabsContainer
    .querySelectorAll(".tab-link.active")
    .forEach((tab) => tab.classList.remove("active"));

  let contentContainer = null;
  if (parentTabsContainer.id === "anotacoes-tabs-nav") {
    contentContainer = document.getElementById("anotacoes-tabs-content");
  } else if (parentTabsContainer.classList.contains("vertical-tabs")) {
    contentContainer = parentTabsContainer.nextElementSibling; // Assume que o container de conteúdo é o próximo irmão
  }

  if (contentContainer) {
    // Esconde todos os conteúdos DENTRO do container específico
    contentContainer
      .querySelectorAll(".tab-content.active")
      .forEach((content) => content.classList.remove("active"));
  } else {
    // Fallback: Tenta esconder todos os conteúdos na página (menos ideal)
    console.warn(
      "Não foi possível determinar o container de conteúdo específico para as abas. Escondendo todos os .tab-content."
    );
    document
      .querySelectorAll(".tab-content.active")
      .forEach((content) => content.classList.remove("active"));
  }

  clickedTab.classList.add("active");
  targetContent.classList.add("active"); // Mostra o conteúdo alvo
}
async function handleSalvarDadosPessoaisEEndereco(event) {
  event.preventDefault(); // Previne qualquer comportamento padrão do botão
  const button = event.currentTarget; // O botão que foi clicado
  const form = document.getElementById("form-info-pessoais"); // Pega o formulário pai

  if (!form || !button) {
    console.error(
      "Formulário ou botão não encontrado ao salvar dados pessoais/endereço."
    );
    return;
  }

  const originalButtonText = button.textContent; // Guarda o texto original do botão clicado
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...'; // Desabilita o outro botão de salvar também, se existir

  const otherButtonId =
    button.id === "btn-salvar-info-pessoais"
      ? "btn-salvar-endereco"
      : "btn-salvar-info-pessoais";
  const otherButton = document.getElementById(otherButtonId);
  if (otherButton) {
    otherButton.disabled = true;
  }

  try {
    // Coleta TODOS os dados do formulário
    const dataToUpdate = {
      // Informações Pessoais (exceto readonly como nome, cpf, idade)
      telefoneCelular: form.querySelector("#dp-telefone")?.value || null,
      dataNascimento: form.querySelector("#dp-data-nascimento")?.value || null, // Contatos (usando notação de ponto)
      "responsavel.nome":
        form.querySelector("#dp-responsavel-nome")?.value || null,
      "contatoEmergencia.nome":
        form.querySelector("#dp-contato-emergencia-nome")?.value || null,
      "contatoEmergencia.telefone":
        form.querySelector("#dp-contato-emergencia-telefone")?.value || null, // Endereço (usando notação de ponto)
      "endereco.logradouro":
        form.querySelector("#dp-endereco-logradouro")?.value || null,
      "endereco.numero":
        form.querySelector("#dp-endereco-numero")?.value || null,
      "endereco.complemento":
        form.querySelector("#dp-endereco-complemento")?.value || null,
      "endereco.bairro":
        form.querySelector("#dp-endereco-bairro")?.value || null,
      "endereco.cidade":
        form.querySelector("#dp-endereco-cidade")?.value || null,
      "endereco.estado":
        form.querySelector("#dp-endereco-estado")?.value || null,
      "endereco.cep": form.querySelector("#dp-endereco-cep")?.value || null, // Timestamp da última atualização
      lastUpdate: serverTimestamp(),
    }; // Salva no Firestore

    const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);
    alert("Informações pessoais e de endereço atualizadas com sucesso!"); // Recarrega os dados do paciente para garantir consistência

    await carregarDadosPaciente(pacienteIdGlobal); // Re-preenche o formulário com dados atualizados (opcional, mas bom para feedback)
    preencherFormularios();
  } catch (error) {
    console.error("Erro ao salvar informações pessoais e de endereço:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    // Reabilita o botão clicado
    button.disabled = false;
    button.textContent = originalButtonText; // Reabilita o outro botão
    if (otherButton) {
      otherButton.disabled = false;
    }
  }
}

async function handleSalvarInfoFinanceiras(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("#btn-salvar-info-financeiras"); // ID específico
  const inputValor = form.querySelector("#dp-valor-contribuicao");
  if (!button || !inputValor) return; // Verifica se elementos existem

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    const novoValorStr = inputValor?.value || ""; // Tenta converter aceitando vírgula ou ponto, e remove outros caracteres
    const valorNumerico = parseFloat(
      novoValorStr.replace(/[^0-9,.]/g, "").replace(",", ".")
    );

    if (isNaN(valorNumerico) || valorNumerico < 0) {
      throw new Error(
        "Valor da contribuição inválido. Use números e, opcionalmente, vírgula ou ponto para centavos."
      );
    }

    const dataToUpdate = {
      valorContribuicao: valorNumerico, // Salva como número
      lastUpdate: serverTimestamp(), // Adicionar lógica de histórico de contribuição se necessário
    };

    const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);
    alert("Informação financeira atualizada com sucesso!");
    if (pacienteDataGlobal) {
      // Atualiza localmente se dados existem
      pacienteDataGlobal.valorContribuicao = valorNumerico;
    }
  } catch (error) {
    console.error("Erro ao salvar informação financeira:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar Contribuição";
  }
}

async function handleSalvarAcompanhamento(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("#btn-salvar-acompanhamento"); // ID específico
  if (!button) return;

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    const dataToUpdate = {
      "acompanhamentoClinico.avaliacaoDemanda":
        form.querySelector("#ac-avaliacao-demanda")?.value || null,
      "acompanhamentoClinico.definicaoObjetivos":
        form.querySelector("#ac-definicao-objetivos")?.value || null,
      "acompanhamentoClinico.diagnostico":
        form.querySelector("#ac-diagnostico")?.value || null,
      "acompanhamentoClinico.registroEncerramento":
        form.querySelector("#ac-registro-encerramento")?.value || null,
      lastUpdate: serverTimestamp(),
    }; // Usa notação de ponto para atualizar campos aninhados

    const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);
    alert("Acompanhamento clínico atualizado com sucesso!"); // Atualiza dados locais (opcional)
    if (pacienteDataGlobal) {
      if (!pacienteDataGlobal.acompanhamentoClinico)
        pacienteDataGlobal.acompanhamentoClinico = {};
      pacienteDataGlobal.acompanhamentoClinico.avaliacaoDemanda =
        dataToUpdate["acompanhamentoClinico.avaliacaoDemanda"];
      pacienteDataGlobal.acompanhamentoClinico.definicaoObjetivos =
        dataToUpdate["acompanhamentoClinico.definicaoObjetivos"];
      pacienteDataGlobal.acompanhamentoClinico.diagnostico =
        dataToUpdate["acompanhamentoClinico.diagnostico"];
      pacienteDataGlobal.acompanhamentoClinico.registroEncerramento =
        dataToUpdate["acompanhamentoClinico.registroEncerramento"];
    }
  } catch (error) {
    console.error("Erro ao salvar acompanhamento clínico:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar Acompanhamento Clínico";
  }
}

async function handlePresencaAusenciaClick(sessaoId, novoStatus, button) {
  const actionButtonsContainer = button.closest(".session-actions");
  const allButtonsInRow = actionButtonsContainer?.querySelectorAll("button");
  allButtonsInRow?.forEach((btn) => (btn.disabled = true)); // Desabilita botões da linha

  try {
    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      pacienteIdGlobal,
      "sessoes",
      sessaoId
    );
    await updateDoc(sessaoRef, {
      status: novoStatus, // 'presente' ou 'ausente'
      statusAtualizadoEm: serverTimestamp(), // Usa serverTimestamp aqui
      statusAtualizadoPor: {
        // Opcional: guardar quem atualizou
        id: userDataGlobal.uid,
        nome: userDataGlobal.nome,
      },
    });
    console.log(`Status da sessão ${sessaoId} atualizado para ${novoStatus}`); // Recarregar a lista de sessões para refletir a mudança e as pendências
    await carregarSessoes();
    renderizarPendencias(); // Re-renderiza pendências
  } catch (error) {
    console.error(`Erro ao atualizar status da sessão ${sessaoId}:`, error);
    alert(`Erro ao marcar ${novoStatus}: ${error.message}`);
    allButtonsInRow?.forEach((btn) => (btn.disabled = false)); // Reabilita em caso de erro
  } // Não precisa reabilitar se der sucesso, pois a lista será recarregada
}

async function handleAbrirAnotacoes(sessaoId) {
  const modal = document.getElementById("anotacoes-sessao-modal");
  const form = document.getElementById("anotacoes-sessao-form");
  if (!modal || !form) {
    console.error("Modal ou formulário de anotações não encontrado.");
    alert("Erro ao abrir anotações: Elementos não encontrados.");
    return;
  }

  form.reset();
  const sessaoIdInput = form.querySelector("#anotacoes-sessao-id");
  if (!sessaoIdInput) {
    console.error("Input hidden #anotacoes-sessao-id não encontrado.");
    alert("Erro interno no modal de anotações.");
    return;
  }
  sessaoIdInput.value = sessaoId;

  const fieldsSelectors = [
    "#anotacoes-ficha-evolucao",
    "#anotacoes-campo-compartilhado-prof",
    "#anotacoes-campo-compartilhado-admin",
  ];
  const fieldsElements = fieldsSelectors
    .map((sel) => form.querySelector(sel))
    .filter(Boolean);
  const btnSalvar = form.querySelector("#btn-salvar-anotacoes");

  fieldsElements.forEach((el) => (el.disabled = true));
  if (btnSalvar) btnSalvar.disabled = true;

  modal.style.display = "flex";

  try {
    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      pacienteIdGlobal,
      "sessoes",
      sessaoId
    );
    const sessaoSnap = await getDoc(sessaoRef);

    if (sessaoSnap.exists()) {
      const data = sessaoSnap.data();
      const anotacoes = data.anotacoes || {};
      const fichaEvolucaoEl = form.querySelector("#anotacoes-ficha-evolucao");
      if (fichaEvolucaoEl)
        fichaEvolucaoEl.value = anotacoes.fichaEvolucao || "";
      const compProfEl = form.querySelector(
        "#anotacoes-campo-compartilhado-prof"
      );
      if (compProfEl) compProfEl.value = anotacoes.compartilhadoProf || "";
      const compAdminEl = form.querySelector(
        "#anotacoes-campo-compartilhado-admin"
      );
      if (compAdminEl) compAdminEl.value = anotacoes.compartilhadoAdmin || "";
    } else {
      console.warn(
        `Sessão ${sessaoId} não encontrada para carregar anotações.`
      );
    }
  } catch (error) {
    console.error(`Erro ao carregar anotações da sessão ${sessaoId}:`, error);
    alert("Erro ao carregar anotações existentes.");
    return;
  } finally {
    fieldsElements.forEach((el) => (el.disabled = false));
    if (btnSalvar) btnSalvar.disabled = false;
  }
}

async function handleSalvarAnotacoes(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("#btn-salvar-anotacoes");
  const sessaoId = form.querySelector("#anotacoes-sessao-id")?.value;
  const modal = document.getElementById("anotacoes-sessao-modal");

  if (!sessaoId) {
    alert("Erro: ID da sessão não encontrado.");
    return;
  }
  if (!modal || !button) {
    console.error("Modal ou botão de salvar anotações não encontrado.");
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    const anotacoesData = {};
    const fichaEvolucaoEl = form.querySelector("#anotacoes-ficha-evolucao");
    if (fichaEvolucaoEl) anotacoesData.fichaEvolucao = fichaEvolucaoEl.value;
    const compProfEl = form.querySelector(
      "#anotacoes-campo-compartilhado-prof"
    );
    if (compProfEl) anotacoesData.compartilhadoProf = compProfEl.value;
    const compAdminEl = form.querySelector(
      "#anotacoes-campo-compartilhado-admin"
    );
    if (compAdminEl) anotacoesData.compartilhadoAdmin = compAdminEl.value;

    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      pacienteIdGlobal,
      "sessoes",
      sessaoId
    );
    await updateDoc(sessaoRef, {
      anotacoes: anotacoesData,
      anotacoesAtualizadasEm: serverTimestamp(), // Usa serverTimestamp aqui
      anotacoesAtualizadasPor: {
        id: userDataGlobal.uid,
        nome: userDataGlobal.nome,
      },
    });

    alert("Anotações salvas com sucesso!");
    modal.style.display = "none";

    const sessaoItem = document.querySelector(
      `.session-item[data-sessao-id="${sessaoId}"]`
    );
    if (sessaoItem) {
      const btnAnotacoes = sessaoItem.querySelector(".btn-anotacoes");
      if (btnAnotacoes) {
        btnAnotacoes.textContent = "Ver/Editar Anotações";
      }
    }
    await carregarSessoes();
    renderizarPendencias();
  } catch (error) {
    console.error(`Erro ao salvar anotações da sessão ${sessaoId}:`, error);
    alert(`Erro ao salvar anotações: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Salvar Anotações";
    }
  }
}

function handleGerarProntuarioPDF() {
  console.log("Iniciando geração do PDF do prontuário...");
  const form = document.getElementById("form-gerar-prontuario");
  if (!form) {
    console.error("Formulário de geração de prontuário não encontrado.");
    alert("Erro: Formulário não encontrado.");
    return;
  }

  const selectedItems = Array.from(
    form.querySelectorAll('input[name="prontuario-item"]:checked')
  ).map((cb) => cb.value);

  if (selectedItems.length === 0) {
    alert("Selecione pelo menos um item para incluir no prontuário.");
    return;
  }

  alert(
    `Itens selecionados para o PDF: ${selectedItems.join(
      ", "
    )}\n\n(Lógica de geração do PDF ainda não implementada)`
  );
}
/**
 * Define a visibilidade de um botão de ação.
 * @param {string} id - O ID do elemento botão (ex: 'btn-abrir-modal-mensagem')
 * @param {boolean} isVisible - true para mostrar, false para ocultar
 */
function setButtonVisibility(id, isVisible) {
  const btn = document.getElementById(id);
  if (btn) {
    // No menu hamburger, os botões são .hamburger-menu-item
    // O estilo de exibição padrão para eles é 'block'
    btn.style.display = isVisible ? "block" : "none";
  } else {
    console.warn(
      `Botão de ação #${id} não encontrado para definir visibilidade.`
    );
  }
}

/**
 * Controla quais botões de ação são exibidos com base no status do paciente.
 * @param {string} status - O status atual do paciente (ex: 'em_atendimento_pb')
 */
function atualizarVisibilidadeBotoesAcao(status) {
  console.log("Atualizando visibilidade dos botões para o status:", status); // Define a visibilidade padrão (oculta todos primeiro, exceto o básico)

  setButtonVisibility("btn-abrir-modal-mensagem", true); // Sempre visível
  setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false);
  setButtonVisibility("btn-abrir-modal-alterar-horario", false);
  setButtonVisibility("btn-abrir-modal-reavaliacao", true); // Quase sempre visível
  setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
  setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
  setButtonVisibility("btn-abrir-modal-horarios-pb", false);

  switch (status) {
    case "em_atendimento_pb": // (PB Ativo) Mostrar Mensagem, Solicitar Sessões, Alterar Horário, Reavaliação, Desfecho PB
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", true);
      setButtonVisibility("btn-abrir-modal-alterar-horario", true);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", true);
      break;

    case "aguardando_info_horarios": // (Aguardando Horários) Mostrar Mensagem, Reavaliação, Informar Horários PB
      setButtonVisibility("btn-abrir-modal-horarios-pb", true); // Oculta os outros (já feito no padrão, exceto Reavaliação e Mensagem)
      // Garante que outros botões PB estejam ocultos
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false);
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
      break;

    case "cadastrar_horario_psicomanager": // Adicionado: Após informar horários
      // (Horários Informados) Apenas Mensagem e Reavaliação. Aguarda admin.
      // Já está no padrão, mas explícito aqui para clareza.
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false);
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
      setButtonVisibility("btn-abrir-modal-horarios-pb", false); // Esconde botão de informar horários
      break;

    case "em_atendimento_plantao": // (Plantão Ativo) Mostrar Mensagem, Reavaliação, Solicitar Novas Sessões (se aplicável), Registrar Encerramento Plantão
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", true); // Verificar se essa ação é válida no plantão
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", true);
      // Garante que botões PB estejam ocultos
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-horarios-pb", false);
      break;

    default: // Para outros status (ex: 'alta', 'desistencia', 'reavaliar_encaminhamento'), mantém o padrão
      // (Apenas "Enviar Mensagem" e "Solicitar Reavaliação" visíveis)
      console.log(
        `Status "${status}" não tem regras de botões personalizadas. Usando padrão.`
      );
      break;
  }
}
// --- Funções Auxiliares ---

function calcularIdade(dataNascimento) {
  if (
    !dataNascimento ||
    typeof dataNascimento !== "string" ||
    dataNascimento.trim() === ""
  ) {
    return "N/A";
  }
  try {
    // Tenta corrigir datas inválidas como YYYY-MM-DD adicionando T00:00:00
    const dateString = dataNascimento.includes("T")
      ? dataNascimento
      : dataNascimento + "T00:00:00";
    const nasc = new Date(dateString);

    if (isNaN(nasc.getTime())) {
      console.warn(
        "Formato de dataNascimento inválido ao calcular idade:",
        dataNascimento
      );
      return "N/A";
    }
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade >= 0 ? `${idade} anos` : "N/A";
  } catch (e) {
    console.warn("Erro ao calcular idade:", e);
    return "N/A";
  }
}

function formatarStatus(status) {
  // Mapeamento simples de status para texto legível
  const mapa = {
    em_atendimento_plantao: "Em Atendimento (Plantão)",
    aguardando_info_horarios: "Aguardando Horários (PB)",
    cadastrar_horario_psicomanager: "Horários Informados (PB)",
    em_atendimento_pb: "Em Atendimento (PB)",
    alta: "Alta",
    desistencia: "Desistência",
    encaminhado_grupo: "Encaminhado p/ Grupo",
    encaminhado_parceiro: "Encaminhado p/ Parceiro", // Adicionar outros status conforme necessário
    encaminhar_para_pb: "Encaminhado para PB",
    reavaliar_encaminhamento: "Reavaliar Encaminhamento",
    triagem_agendada: "Triagem Agendada",
    inscricao_documentos: "Aguardando Documentos",
    aguardando_reavaliacao: "Aguardando Reavaliação",
  }; // Transforma o status em algo legível se não estiver no mapa
  const statusFormatado = status
    ? status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Desconhecido";

  return mapa[status] || statusFormatado;
}

// --- LÓGICA DOS MODAIS ---

function adicionarEventListenersModais() {
  // Listener global para fechar modais E dropdowns
  document.body.addEventListener("click", function (e) {
    let closeModal = false;
    let clickedInsideModalContent = false;
    let clickedInsideDropdown = false; // Flag para dropdown // Verifica clique em botão de fechar/cancelar modal

    if (
      e.target.matches(".modal-cancel-btn") ||
      e.target.closest(".modal-cancel-btn") ||
      e.target.matches(".close-button") ||
      e.target.closest(".close-button")
    ) {
      closeModal = true;
    } // Verifica se o clique foi dentro do conteúdo de um modal aberto

    if (e.target.closest(".modal-content")) {
      clickedInsideModalContent = true;
    } // Verifica se o clique foi dentro de um dropdown

    if (
      e.target.closest(".dropdown-container") ||
      e.target.closest(".action-buttons-container.main-actions")
    ) {
      clickedInsideDropdown = true;
    } // Fecha Modal se necessário

    if (
      closeModal ||
      (e.target.matches(".modal-overlay[style*='display: flex']") &&
        !clickedInsideModalContent)
    ) {
      const modalAberto = e.target.closest(
        ".modal-overlay[style*='display: flex']"
      );
      if (modalAberto) {
        // Garante que só fecha se não clicar em item de dropdown DENTRO do modal
        if (!e.target.closest(".dropdown-item")) {
          modalAberto.style.display = "none";
        }
      }
    } // Chama a função para fechar dropdowns se o clique foi fora deles

    if (!clickedInsideDropdown) {
      closeDropdownOnClickOutside(e);
    }
  }); // Submits dos Modais (Delegados)

  document.body.addEventListener("click", async (e) => {
    // Busca por botões de submit específicos dos modais ORIGINAIS
    const btnSolicitarSessoes = e.target.closest("#btn-confirmar-solicitacao");
    const btnEnviarWhatsapp = e.target.closest("#btn-gerar-enviar-whatsapp");
    const btnAlterarHorario = e.target.closest(
      "#btn-confirmar-alteracao-horario"
    );
    const btnConfirmarReavaliacao = e.target.closest(
      "#btn-confirmar-reavaliacao"
    );

    // Verifica se o clique foi DENTRO do modal Horarios PB (para ignorar submits duplicados)
    const isInHorariosPbModal = e.target.closest("#horarios-pb-modal");

    if (btnSolicitarSessoes && !isInHorariosPbModal) {
      // Só dispara se NÃO for do Horarios PB
      e.preventDefault();
      await handleSolicitarSessoesSubmit(e);
    } else if (btnEnviarWhatsapp) {
      // Mensagens não é afetado
      e.preventDefault();
      handleMensagemSubmit();
    } else if (btnAlterarHorario && !isInHorariosPbModal) {
      // Só dispara se NÃO for do Horarios PB
      e.preventDefault();
      await handleAlterarHorarioSubmit(e);
    } else if (btnConfirmarReavaliacao) {
      // Reavaliação não é afetado
      e.preventDefault();
      await handleReavaliacaoSubmit(e);
    }
  }); // Submit dos forms (usando ID do form)

  document
    .getElementById("encerramento-form")
    ?.addEventListener("submit", (e) =>
      handleEncerramentoSubmit(e, userDataGlobal?.uid, userDataGlobal)
    );
  document.getElementById("horarios-pb-form")?.addEventListener(
    "submit",
    (e) => handleHorariosPbSubmit(e, userDataGlobal?.uid, userDataGlobal) // Único submit para o modal refatorado
  );
  document
    .getElementById("anotacoes-sessao-form")
    ?.addEventListener("submit", handleSalvarAnotacoes);
  // Adiciona listener para submit do Desfecho PB (que é carregado dinamicamente)
  // Usa delegação no body para pegar o submit do #form-atendimento-pb
  document.body.addEventListener("submit", (e) => {
    if (e.target.id === "form-atendimento-pb") {
      handleDesfechoPbSubmit(e);
    }
  }); // Botões que ABREM os modais (Nenhuma alteração aqui)

  document
    .getElementById("btn-abrir-modal-mensagem")
    ?.addEventListener("click", abrirModalMensagens);
  document
    .getElementById("btn-abrir-modal-solicitar-sessoes")
    ?.addEventListener("click", abrirModalSolicitarSessoes);
  document
    .getElementById("btn-abrir-modal-alterar-horario")
    ?.addEventListener("click", abrirModalAlterarHorario);
  document
    .getElementById("btn-abrir-modal-reavaliacao")
    ?.addEventListener("click", abrirModalReavaliacao);
  document
    .getElementById("btn-abrir-modal-desfecho-pb")
    ?.addEventListener("click", abrirModalDesfechoPb);
  document
    .getElementById("btn-abrir-modal-encerramento-plantao")
    ?.addEventListener("click", abrirModalEncerramento);
  document
    .getElementById("btn-abrir-modal-horarios-pb")
    ?.addEventListener("click", abrirModalHorariosPb); // Chama a função refatorada // Listener para abas do Modal de Anotações

  const anotacoesModalBody = document.querySelector(
    "#anotacoes-sessao-modal .modal-body"
  );
  if (anotacoesModalBody) {
    anotacoesModalBody.addEventListener("click", (event) => {
      const clickedTabLink = event.target.closest(
        "#anotacoes-tabs-nav .tab-link"
      );
      if (clickedTabLink && !clickedTabLink.classList.contains("active")) {
        handleTabClick({ currentTarget: clickedTabLink });
      }
    });
  } else {
    console.warn(
      "Corpo do modal de anotações (#anotacoes-sessao-modal .modal-body) não encontrado."
    );
  }
}
// --- Lógica do Modal de Mensagens ---
let dadosParaMensagemGlobal = {};
let templateOriginalGlobal = "";

function abrirModalMensagens(/* Usa globais */) {
  if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
    alert(
      "Dados necessários para abrir o modal de mensagens não estão carregados."
    );
    return;
  } // Pega o atendimento ativo (PB ou Plantão)
  const atendimentoAtivo =
    pacienteDataGlobal.atendimentosPB?.find(
      (at) =>
        at.profissionalId === userDataGlobal.uid &&
        at.statusAtendimento === "ativo"
    ) ||
    (pacienteDataGlobal.status === "em_atendimento_plantao"
      ? pacienteDataGlobal.plantaoInfo
      : null);

  const modal = document.getElementById("enviar-mensagem-modal");
  if (!modal) {
    console.error("Modal 'enviar-mensagem-modal' não encontrado no HTML.");
    alert("Erro ao abrir modal de mensagens: Elemento não encontrado.");
    return;
  }

  const nomePacienteSpan = document.getElementById(
    "mensagem-paciente-nome-selecao"
  );
  const listaModelos = document.getElementById("lista-modelos-mensagem");
  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");
  const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");
  const btnVoltar = document.getElementById("btn-voltar-selecao");

  if (
    !nomePacienteSpan ||
    !listaModelos ||
    !selecaoView ||
    !formularioView ||
    !btnVoltar ||
    !btnWhatsapp
  ) {
    console.error("Elementos internos do modal de mensagens não encontrados.");
    alert("Erro ao preparar modal de mensagens: estrutura interna inválida.");
    return;
  } // Armazena dados específicos para esta função

  dadosParaMensagemGlobal = {
    paciente: pacienteDataGlobal,
    atendimento: atendimentoAtivo,
    systemConfigs: systemConfigsGlobal,
    userData: userDataGlobal,
  };

  nomePacienteSpan.textContent = pacienteDataGlobal.nomeCompleto;
  listaModelos.innerHTML = "";
  selecaoView.style.display = "block";
  formularioView.style.display = "none";
  btnWhatsapp.style.display = "none";

  const templates = systemConfigsGlobal?.textos || {};
  if (Object.keys(templates).length === 0) {
    listaModelos.innerHTML = "<p>Nenhum modelo de mensagem configurado.</p>";
  } else {
    for (const key in templates) {
      // Poderia filtrar por prefixo se necessário: if (!key.startsWith('msg_')) continue;
      const title = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-button secondary-button";
      btn.textContent = title;
      btn.onclick = () => preencherFormularioMensagem(key, title);
      listaModelos.appendChild(btn);
    }
  }
  modal.style.display = "flex";

  btnVoltar.onclick = () => {
    selecaoView.style.display = "block";
    formularioView.style.display = "none";
    btnWhatsapp.style.display = "none";
  };
}

function preencherFormularioMensagem(templateKey, templateTitle) {
  const { systemConfigs, userData } = dadosParaMensagemGlobal;

  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");
  const formTitle = document.getElementById("mensagem-form-title");
  const formContainer = document.getElementById(
    "mensagem-dynamic-form-container"
  );
  const modal = document.getElementById("enviar-mensagem-modal");
  const btnWhatsapp = modal?.querySelector("#btn-gerar-enviar-whatsapp");
  const previewTextarea = document.getElementById("output-mensagem-preview");

  if (
    !selecaoView ||
    !formularioView ||
    !formTitle ||
    !formContainer ||
    !previewTextarea ||
    !btnWhatsapp
  ) {
    console.error("Elementos do formulário de mensagem não encontrados.");
    alert("Erro ao preencher formulário de mensagem.");
    return;
  }

  formTitle.textContent = templateTitle;
  formContainer.innerHTML = "";
  templateOriginalGlobal = systemConfigs?.textos?.[templateKey] || "";

  const variaveis = templateOriginalGlobal.match(/{[a-zA-Z0-9_]+}/g) || [];
  const variaveisUnicas = [...new Set(variaveis)];
  const variaveisFixas = [
    "{p}",
    "{nomePaciente}",
    "{t}",
    "{saudacao}",
    "{contractUrl}",
  ];

  variaveisUnicas.forEach((variavel) => {
    if (variaveisFixas.includes(variavel)) return;
    const nomeVariavel = variavel.replace(/[{}]/g, "");
    const labelText =
      nomeVariavel.charAt(0).toUpperCase() +
      nomeVariavel.slice(1).replace(/_/g, " ");
    const formGroup = document.createElement("div");
    formGroup.className = "form-group";
    const label = document.createElement("label");
    let novoLabel = "";
    const nomeVariavelLower = nomeVariavel.toLowerCase();
    let campoElemento; // Switch case para criar campos dinâmicos

    switch (nomeVariavelLower) {
      case "prof":
      case "profissao":
        novoLabel = "Selecione sua profissão:";
        campoElemento = document.createElement("select");
        campoElemento.innerHTML = "<option value=''>Selecione...</option>";
        const profissoes = systemConfigs?.listas?.profissoes || [];
        profissoes.forEach(
          (prof) =>
            (campoElemento.innerHTML += `<option value="${prof}">${prof}</option>`)
        );
        if (userData?.profissao) campoElemento.value = userData.profissao;
        break;
      case "dia":
      case "diasemana":
        novoLabel = "Selecione o dia de atendimento:";
        campoElemento = document.createElement("select");
        const dias = [
          "Segunda-feira",
          "Terça-feira",
          "Quarta-feira",
          "Quinta-feira",
          "Sexta-feira",
          "Sábado",
        ];
        campoElemento.innerHTML = "<option value=''>Selecione...</option>";
        dias.forEach(
          (dia) =>
            (campoElemento.innerHTML += `<option value="${dia}">${dia}</option>`)
        );
        break;
      case "mod":
      case "modalidade":
        novoLabel = "Selecione a modalidade:";
        campoElemento = document.createElement("select");
        campoElemento.innerHTML =
          "<option value=''>Selecione...</option><option value='Presencial'>Presencial</option><option value='Online'>Online</option>";
        break;
      case "data":
      case "datainicio":
        novoLabel = "Informe a data de inicio da terapia:";
        campoElemento = document.createElement("input");
        campoElemento.type = "date";
        break;
      case "hora":
      case "horario":
        novoLabel = "Informe a hora da sessão:";
        campoElemento = document.createElement("input");
        campoElemento.type = "time";
        break;
      case "v":
      case "valor":
        novoLabel = "Preencha o valor da sessão:";
        campoElemento = document.createElement("input");
        campoElemento.type = "text"; // Manter texto para R$ XX,YY
        break;
      case "px":
      case "pix":
        novoLabel = "Informe seu PIX:";
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
        break;
      case "m":
        novoLabel = "Informe o Mês de referência (ex: Janeiro):";
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
        break;
      case "d":
        novoLabel = "Informe o Dia do vencimento (ex: 10):";
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
        break;
      default:
        novoLabel = `Preencha o campo "${labelText}":`;
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
    }

    label.textContent = novoLabel;
    label.htmlFor = `var-${nomeVariavel}`;
    campoElemento.className = "form-control dynamic-var";
    campoElemento.id = `var-${nomeVariavel}`;
    campoElemento.dataset.variavel = variavel;
    // Remove listener antigo e adiciona novo para garantir
    campoElemento.replaceWith(campoElemento.cloneNode(true));
    formContainer.appendChild(label);
    formContainer.appendChild(document.getElementById(`var-${nomeVariavel}`)); // Adiciona o elemento clonado
    document
      .getElementById(`var-${nomeVariavel}`)
      .addEventListener("input", atualizarPreviewMensagem);
  });

  atualizarPreviewMensagem();
  selecaoView.style.display = "none";
  formularioView.style.display = "block";
  btnWhatsapp.style.display = "inline-block";
}

function formatarDataParaTexto(dataString) {
  if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) return dataString;
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizarPreviewMensagem() {
  const { paciente, atendimento, userData } = dadosParaMensagemGlobal;
  const previewTextarea = document.getElementById("output-mensagem-preview");
  if (!previewTextarea) {
    console.error("Textarea de preview da mensagem não encontrado.");
    return;
  }

  let mensagemAtualizada = templateOriginalGlobal;
  const nomePaciente = paciente?.nomeCompleto || "[Nome Paciente]";
  const nomeTerapeuta = userData?.nome || "[Nome Terapeuta]";

  mensagemAtualizada = mensagemAtualizada
    .replace(/{p}/g, nomePaciente)
    .replace(/{nomePaciente}/g, nomePaciente)
    .replace(/{t}/g, nomeTerapeuta)
    .replace(/{saudacao}/g, "Olá");

  if (
    templateOriginalGlobal.includes("{contractUrl}") &&
    atendimento &&
    paciente
  ) {
    const atendimentoIdParaLink = atendimento.atendimentoId || atendimento.id;
    if (atendimentoIdParaLink) {
      const contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${paciente.id}&atendimentoId=${atendimentoIdParaLink}`;
      mensagemAtualizada = mensagemAtualizada.replace(
        /{contractUrl}/g,
        contractUrl
      );
    } else {
      console.warn(
        "Não foi possível gerar link do contrato: ID do atendimento não encontrado."
      );
      mensagemAtualizada = mensagemAtualizada.replace(
        /{contractUrl}/g,
        "[Link do Contrato Indisponível]"
      );
    }
  } else if (templateOriginalGlobal.includes("{contractUrl}")) {
    mensagemAtualizada = mensagemAtualizada.replace(
      /{contractUrl}/g,
      "[Link do Contrato Indisponível]"
    );
  }

  const inputs = document.querySelectorAll(".dynamic-var");
  inputs.forEach((input) => {
    const placeholder = input.dataset.variavel;
    let valor = input.value;
    if (input.type === "date") valor = formatarDataParaTexto(valor);
    const placeholderRegex = new RegExp(
      placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g"
    );
    mensagemAtualizada = mensagemAtualizada.replace(
      placeholderRegex,
      valor || placeholder
    );
  });

  previewTextarea.value = mensagemAtualizada;
}

function handleMensagemSubmit() {
  const { paciente } = dadosParaMensagemGlobal;
  const telefone = paciente?.telefoneCelular?.replace(/\D/g, "");
  const previewTextarea = document.getElementById("output-mensagem-preview");
  const mensagem = previewTextarea?.value || "";
  const modal = document.getElementById("enviar-mensagem-modal");

  if (telefone && mensagem && !mensagem.includes("{")) {
    window.open(
      `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
    if (modal) modal.style.display = "none";
  } else {
    let errorMsg = "Não foi possível gerar o link.";
    if (!telefone)
      errorMsg += " Verifique se o paciente possui um telefone válido.";
    if (mensagem.includes("{"))
      errorMsg += " Verifique se todos os campos foram preenchidos.";
    alert(errorMsg);
  }
}

// --- Lógica do Modal de Solicitar Novas Sessões (Original - Mantido) ---

function abrirModalSolicitarSessoes(/* Usa globais pacienteDataGlobal, userDataGlobal, systemConfigsGlobal */) {
  if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
    alert(
      "Dados necessários para abrir o modal de solicitação não estão carregados."
    );
    return;
  } // Pega o atendimento ativo onde o profissional logado é o responsável
  const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === userDataGlobal.uid &&
      at.statusAtendimento === "ativo"
  );
  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para solicitar novas sessões."
    );
    return;
  }

  const modal = document.getElementById("solicitar-sessoes-modal");
  if (!modal) {
    console.error("Modal solicitar-sessoes-modal não encontrado.");
    return;
  }

  modal.style.display = "flex";
  const form = document.getElementById("solicitar-sessoes-form");
  if (!form) {
    console.error("Form solicitar-sessoes-form não encontrado.");
    return;
  }

  form.reset();
  form.classList.remove("was-validated"); // Preenche elementos

  const profNomeEl = document.getElementById("solicitar-profissional-nome");
  if (profNomeEl) profNomeEl.value = userDataGlobal.nome;
  const pacNomeEl = document.getElementById("solicitar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;

  const pacIdInput = form.querySelector("#solicitar-paciente-id");
  if (pacIdInput) pacIdInput.value = pacienteIdGlobal;
  const atendIdInput = form.querySelector("#solicitar-atendimento-id");
  if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId;

  const horarioSelect = document.getElementById("solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  const salaSelect = document.getElementById("solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>'; // Adiciona Selecione
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        // Evita duplicar
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  const fieldsToWatchIds = [
    "solicitar-dia-semana",
    "solicitar-horario",
    "solicitar-tipo-atendimento",
    "solicitar-sala",
  ];
  fieldsToWatchIds.forEach((id) => {
    const element = document.getElementById(id);
    // Remove listener antigo e adiciona novo
    if (element) {
      element.replaceWith(element.cloneNode(true)); // Clona
      document
        .getElementById(id)
        .addEventListener("change", () => validarHorarioNaGradeOriginal()); // Chama validação original
    }
  });

  const tipoAtendimentoSelect = document.getElementById(
    "solicitar-tipo-atendimento"
  );
  const salaSelectEl = document.getElementById("solicitar-sala"); // Guarda referência

  if (tipoAtendimentoSelect && salaSelectEl) {
    const ajustarSalaOriginal = () => {
      const tipo = tipoAtendimentoSelect.value; // 'online' ou 'presencial'
      salaSelectEl.disabled = tipo === "online";
      salaSelectEl.required = tipo !== "online";

      if (tipo === "online") {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online" || salaSelectEl.value === "") {
        // Se mudou de Online para Presencial OU se estava vazio, força seleção
        salaSelectEl.value = "";
      }
      validarHorarioNaGradeOriginal(); // Chama validação original
    };
    // Remove listener antigo e adiciona novo
    tipoAtendimentoSelect.replaceWith(tipoAtendimentoSelect.cloneNode(true));
    document
      .getElementById("solicitar-tipo-atendimento")
      .addEventListener("change", ajustarSalaOriginal);
    ajustarSalaOriginal(); // Chama para estado inicial
  }
}

// Handler submit do modal original de solicitar sessões
async function handleSolicitarSessoesSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("solicitar-sessoes-form");
  const modal = document.getElementById("solicitar-sessoes-modal");
  const btnSubmit = document.getElementById("btn-confirmar-solicitacao");

  if (!form || !modal || !btnSubmit) {
    console.error("Elementos do modal de solicitar sessões não encontrados.");
    return;
  }

  const pacienteId = form.querySelector("#solicitar-paciente-id")?.value;
  const atendimentoId = form.querySelector("#solicitar-atendimento-id")?.value;

  if (!pacienteId || !atendimentoId) {
    alert(
      "Erro: IDs do paciente ou atendimento não encontrados no formulário."
    );
    return;
  }

  if (form.checkValidity() === false) {
    form.reportValidity(); // Mostra erros de validação HTML5
    alert("Por favor, preencha todos os campos obrigatórios (*)."); // form.classList.add("was-validated"); // Bootstrap class, pode não ser necessário se usar reportValidity
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    const solicitacaoData = {
      tipo: "novas_sessoes",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: userDataGlobal.uid,
      solicitanteNome: userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        form.querySelector("#solicitar-paciente-nome")?.value ||
        pacienteDataGlobal?.nomeCompleto ||
        "",
      atendimentoId: atendimentoId,
      detalhes: {
        diaSemana: form.querySelector("#solicitar-dia-semana")?.value || null,
        horario: form.querySelector("#solicitar-horario")?.value || null,
        modalidade:
          form.querySelector("#solicitar-tipo-atendimento")?.value || null,
        frequencia: form.querySelector("#solicitar-frequencia")?.value || null,
        sala: form.querySelector("#solicitar-sala")?.value || null,
        dataInicioPreferencial:
          form.querySelector("#solicitar-data-inicio")?.value || null,
      },
      adminFeedback: null,
    };

    await addDoc(collection(db, "solicitacoes"), solicitacaoData);
    console.log(
      "Solicitação de novas sessões (original) criada:",
      solicitacaoData
    );
    alert(
      "Solicitação de novas sessões enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
    form.reset(); //form.classList.remove("was-validated");
  } catch (error) {
    console.error(
      "Erro ao enviar solicitação de novas sessões (original):",
      error
    );
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação";
  }
}

// --- Lógica do Modal de Alterar Horário (Original - Mantido) ---

function abrirModalAlterarHorario(/* Usa globais pacienteDataGlobal, userDataGlobal, systemConfigsGlobal */) {
  if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
    alert(
      "Dados necessários para abrir o modal de alteração não estão carregados."
    );
    return;
  } // Pega o atendimento ativo onde o profissional logado é o responsável
  const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === userDataGlobal.uid &&
      at.statusAtendimento === "ativo"
  );
  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para alterar o horário."
    );
    return;
  }

  const modal = document.getElementById("alterar-horario-modal");
  if (!modal) {
    console.error("Modal alterar-horario-modal não encontrado.");
    return;
  }
  const form = document.getElementById("alterar-horario-form");
  if (!form) {
    console.error("Form alterar-horario-form não encontrado.");
    return;
  }
  form.reset(); // Preenche dados fixos e IDs ocultos

  const pacNomeEl = document.getElementById("alterar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;
  const profNomeEl = document.getElementById("alterar-profissional-nome");
  if (profNomeEl) profNomeEl.value = userDataGlobal.nome;

  const pacIdInput = form.querySelector("#alterar-paciente-id");
  if (pacIdInput) pacIdInput.value = pacienteIdGlobal;
  const atendIdInput = form.querySelector("#alterar-atendimento-id");
  if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId; // Preenche dados atuais

  const horarioAtual = atendimentoAtivo?.horarioSessoes || {};
  const diaAtualEl = document.getElementById("alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = document.getElementById("alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";
  const modAtualEl = document.getElementById("alterar-modalidade-atual");
  if (modAtualEl) modAtualEl.value = horarioAtual.tipoAtendimento || "N/A"; // Preenche select de Horário

  const horarioSelect = document.getElementById("alterar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 8; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  } // Preenche select de Salas

  const salaSelect = document.getElementById("alterar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  } // Lógica para habilitar/desabilitar Sala

  const tipoAtendimentoSelect = document.getElementById(
    "alterar-tipo-atendimento"
  );
  const salaSelectEl = document.getElementById("alterar-sala"); // Guarda referência

  if (tipoAtendimentoSelect && salaSelectEl) {
    const ajustarSalaAlteracaoOriginal = () => {
      const tipo = tipoAtendimentoSelect.value; // 'Online' ou 'Presencial'
      salaSelectEl.disabled = tipo === "Online";
      salaSelectEl.required = tipo !== "Online";

      if (tipo === "Online") {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online" || salaSelectEl.value === "") {
        salaSelectEl.value = ""; // Força seleção se presencial
      }
    };
    // Remove listener antigo e adiciona novo
    tipoAtendimentoSelect.replaceWith(tipoAtendimentoSelect.cloneNode(true));
    document
      .getElementById("alterar-tipo-atendimento")
      .addEventListener("change", ajustarSalaAlteracaoOriginal);
    ajustarSalaAlteracaoOriginal(); // Chama para estado inicial
  }

  modal.style.display = "flex";
}

// Handler submit do modal original de alterar horário
async function handleAlterarHorarioSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("alterar-horario-form");
  const modal = document.getElementById("alterar-horario-modal");
  const btnSubmit = document.getElementById("btn-confirmar-alteracao-horario");

  if (!form || !modal || !btnSubmit) {
    console.error("Elementos do modal de alterar horário não encontrados.");
    return;
  }

  const pacienteId = form.querySelector("#alterar-paciente-id")?.value;
  const atendimentoId = form.querySelector("#alterar-atendimento-id")?.value;

  if (!pacienteId || !atendimentoId) {
    alert(
      "Erro: IDs do paciente ou atendimento não encontrados no formulário."
    );
    return;
  }

  const atendimentoAtivo = pacienteDataGlobal?.atendimentosPB?.find(
    (at) => at.atendimentoId === atendimentoId
  );
  if (!atendimentoAtivo && pacienteDataGlobal?.atendimentosPB) {
    console.error(
      `Atendimento ativo com ID ${atendimentoId} não encontrado para pegar dados antigos.`
    );
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para a nova configuração."
    ); // form.classList.add("was-validated");
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    const horarioAntigo = atendimentoAtivo?.horarioSessoes || {};
    const dadosAntigos = {
      dia: horarioAntigo.diaSemana || "N/A",
      horario: horarioAntigo.horario || "N/A",
      modalidade: horarioAntigo.tipoAtendimento || "N/A",
      sala: horarioAntigo.salaAtendimento || "N/A",
      frequencia: horarioAntigo.frequencia || "N/A",
    };

    const dadosNovos = {
      dia: form.querySelector("#alterar-dia-semana")?.value || null,
      horario: form.querySelector("#alterar-horario")?.value || null,
      modalidade:
        form.querySelector("#alterar-tipo-atendimento")?.value || null,
      frequencia: form.querySelector("#alterar-frequencia")?.value || null,
      sala: form.querySelector("#alterar-sala")?.value || null,
      dataInicio: form.querySelector("#alterar-data-inicio")?.value || null,
      alterarGrade: form.querySelector("#alterar-grade")?.value || null,
    };

    const solicitacaoData = {
      tipo: "alteracao_horario",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: userDataGlobal.uid,
      solicitanteNome: userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        form.querySelector("#alterar-paciente-nome")?.value ||
        pacienteDataGlobal?.nomeCompleto ||
        "",
      atendimentoId: atendimentoId,
      detalhes: {
        dadosAntigos: dadosAntigos,
        dadosNovos: dadosNovos,
        justificativa:
          form.querySelector("#alterar-justificativa")?.value || "",
      },
      adminFeedback: null,
    };

    await addDoc(collection(db, "solicitacoes"), solicitacaoData);
    console.log(
      "Solicitação de alteração de horário (original) criada:",
      solicitacaoData
    );
    alert(
      "Solicitação de alteração de horário enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
    form.reset(); //form.classList.remove("was-validated");
  } catch (error) {
    console.error(
      "Erro ao enviar solicitação de alteração de horário (original):",
      error
    );
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação de Alteração";
  }
}
// --- Lógica do Modal de Reavaliação ---
let currentReavaliacaoConfigGlobal = {};

async function abrirModalReavaliacao(/* Usa globais */) {
  if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
    alert(
      "Dados necessários para abrir o modal de reavaliação não estão carregados."
    );
    return;
  } // Pega o atendimento ativo (pode ser null)
  const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === userDataGlobal.uid &&
      at.statusAtendimento === "ativo"
  );

  const modal = document.getElementById("reavaliacao-modal");
  if (!modal) {
    console.error("Modal reavaliacao-modal não encontrado.");
    return;
  }
  const form = document.getElementById("reavaliacao-form");
  if (!form) {
    console.error("Form reavaliacao-form não encontrado.");
    return;
  }
  const msgSemAgenda = document.getElementById("reavaliacao-sem-agenda");
  if (!msgSemAgenda) {
    console.error("Elemento reavaliacao-sem-agenda não encontrado.");
    return;
  }
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  if (!btnConfirmar) {
    console.error("Elemento btn-confirmar-reavaliacao não encontrado.");
    return;
  }
  const tipoAtendimentoGroup = document.getElementById(
    "reavaliacao-tipo-atendimento-group"
  );
  if (!tipoAtendimentoGroup) {
    console.error(
      "Elemento reavaliacao-tipo-atendimento-group não encontrado."
    );
    return;
  }
  const tipoAtendimentoSelect = document.getElementById(
    "reavaliacao-tipo-atendimento"
  );
  if (!tipoAtendimentoSelect) {
    console.error("Elemento reavaliacao-tipo-atendimento não encontrado.");
    return;
  }
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  if (!datasContainer) {
    console.error("Elemento reavaliacao-datas-disponiveis não encontrado.");
    return;
  }
  const dataSelecionadaInput = document.getElementById(
    "reavaliacao-data-selecionada"
  );
  if (!dataSelecionadaInput) {
    console.error("Elemento reavaliacao-data-selecionada não encontrado.");
    return;
  }
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );
  if (!horariosContainer) {
    console.error("Elemento reavaliacao-horarios-disponiveis não encontrado.");
    return;
  } // Resetar

  form.reset();
  msgSemAgenda.style.display = "none";
  form.style.display = "none";
  btnConfirmar.style.display = "none";
  datasContainer.innerHTML =
    "<p>Selecione uma modalidade para ver as datas.</p>";
  horariosContainer.innerHTML =
    "<p>Selecione uma data para ver os horários.</p>";
  dataSelecionadaInput.value = ""; // Preencher dados fixos e ID oculto

  const pacIdInput = form.querySelector("#reavaliacao-paciente-id");
  if (pacIdInput) pacIdInput.value = pacienteIdGlobal;
  const atendIdInput = form.querySelector("#reavaliacao-atendimento-id");
  if (atendIdInput) atendIdInput.value = atendimentoAtivo?.atendimentoId || "";

  const profNomeEl = document.getElementById("reavaliacao-profissional-nome");
  if (profNomeEl) profNomeEl.value = userDataGlobal.nome;
  const pacNomeEl = document.getElementById("reavaliacao-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;
  const valorAtualEl = document.getElementById("reavaliacao-valor-atual");
  if (valorAtualEl)
    valorAtualEl.value =
      pacienteDataGlobal.valorContribuicao != null
        ? String(pacienteDataGlobal.valorContribuicao).replace(".", ",")
        : "";

  modal.style.display = "flex";

  try {
    const hoje = new Date().toISOString().split("T")[0];
    const agendaQuery = query(
      collection(db, "agendaConfigurada"),
      where("tipo", "==", "reavaliacao"),
      where("data", ">=", hoje)
    );
    const agendaSnapshot = await getDocs(agendaQuery);

    if (agendaSnapshot.empty) {
      msgSemAgenda.textContent =
        "Não há agenda de reavaliação disponível no momento.";
      msgSemAgenda.style.display = "block";
      msgSemAgenda.className = "alert alert-warning";
      return;
    }

    form.style.display = "block";
    btnConfirmar.style.display = "block";

    let agendasConfig = [];
    agendaSnapshot.forEach((doc) =>
      agendasConfig.push({ id: doc.id, ...doc.data() })
    );

    currentReavaliacaoConfigGlobal = { agendas: agendasConfig };

    const modalidades = [
      ...new Set(agendasConfig.map((a) => a.modalidade)),
    ].filter(Boolean);
    tipoAtendimentoSelect.innerHTML = "";
    if (modalidades.length > 1) {
      tipoAtendimentoGroup.style.display = "block";
      tipoAtendimentoSelect.innerHTML =
        '<option value="">Selecione a modalidade...</option>';
      modalidades.forEach((mod) => {
        const modFormatado =
          mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase();
        tipoAtendimentoSelect.innerHTML += `<option value="${mod}">${modFormatado}</option>`;
      });
      tipoAtendimentoSelect.required = true;
    } else if (modalidades.length === 1) {
      tipoAtendimentoGroup.style.display = "none";
      tipoAtendimentoSelect.innerHTML = `<option value="${
        modalidades[0]
      }" selected>${
        modalidades[0].charAt(0).toUpperCase() +
        modalidades[0].slice(1).toLowerCase()
      }</option>`;
      tipoAtendimentoSelect.required = false;
      renderizarDatasDisponiveis(modalidades[0]);
    } else {
      throw new Error(
        "Agenda de reavaliação configurada de forma inválida (sem modalidade)."
      );
    } // Listeners

    // Remove listeners antigos antes de adicionar novos
    tipoAtendimentoSelect.replaceWith(tipoAtendimentoSelect.cloneNode(true)); // Clona para remover
    document
      .getElementById("reavaliacao-tipo-atendimento")
      .addEventListener("change", () => {
        // Adiciona ao clonado
        horariosContainer.innerHTML =
          "<p>Selecione uma data para ver os horários.</p>";
        dataSelecionadaInput.value = "";
        renderizarDatasDisponiveis(
          document.getElementById("reavaliacao-tipo-atendimento").value
        );
      });

    datasContainer.replaceWith(datasContainer.cloneNode(true)); // Clona para remover
    document
      .getElementById("reavaliacao-datas-disponiveis")
      .addEventListener("click", (e) => {
        // Adiciona ao clonado
        const target = e.target.closest(".slot-time");
        if (target && !target.disabled) {
          document
            .getElementById("reavaliacao-datas-disponiveis")
            .querySelector(".slot-time.selected")
            ?.classList.remove("selected");
          target.classList.add("selected");
          dataSelecionadaInput.value = target.dataset.data;
          carregarHorariosReavaliacao();
        }
      });

    horariosContainer.replaceWith(horariosContainer.cloneNode(true)); // Clona para remover
    document
      .getElementById("reavaliacao-horarios-disponiveis")
      .addEventListener("click", (e) => {
        // Adiciona ao clonado
        const target = e.target.closest(".slot-time");
        if (target && !target.disabled) {
          document
            .getElementById("reavaliacao-horarios-disponiveis")
            .querySelector(".slot-time.selected")
            ?.classList.remove("selected");
          target.classList.add("selected");
        }
      });
  } catch (error) {
    console.error("Erro ao abrir modal de reavaliação:", error);
    msgSemAgenda.textContent =
      "Erro ao carregar a agenda de reavaliação. Tente novamente.";
    msgSemAgenda.style.display = "block";
    msgSemAgenda.className = "alert alert-error";
    form.style.display = "none";
    btnConfirmar.style.display = "none";
  }
}

function renderizarDatasDisponiveis(modalidade) {
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  if (!datasContainer) return;

  if (!modalidade) {
    datasContainer.innerHTML =
      "<p>Selecione uma modalidade para ver as datas.</p>";
    return;
  }

  const { agendas } = currentReavaliacaoConfigGlobal;
  if (!agendas) {
    console.error("Configuração de reavaliação não carregada.");
    datasContainer.innerHTML = "<p>Erro ao carregar configuração.</p>";
    return;
  }

  const datasDisponiveis = [
    ...new Set(
      agendas.filter((a) => a.modalidade === modalidade).map((a) => a.data)
    ),
  ];
  datasDisponiveis.sort();

  if (datasDisponiveis.length === 0) {
    datasContainer.innerHTML =
      "<p>Nenhuma data disponível encontrada para esta modalidade.</p>";
    return;
  }

  const datasHtml = datasDisponiveis
    .map((dataISO) => {
      try {
        const dataObj = new Date(dataISO + "T03:00:00");
        if (isNaN(dataObj.getTime())) throw new Error("Data inválida");
        const diaSemana = dataObj.toLocaleDateString("pt-BR", {
          weekday: "long",
        });
        const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        const diaSemanaCapitalizado =
          diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        return `<button type="button" class="slot-time" data-data="${dataISO}">${diaSemanaCapitalizado} (${dataFormatada})</button>`;
      } catch (e) {
        console.error(`Erro ao formatar data ${dataISO}:`, e);
        return "";
      }
    })
    .join("");

  datasContainer.innerHTML =
    datasHtml || "<p>Erro ao processar datas disponíveis.</p>";
}

async function carregarHorariosReavaliacao() {
  const modalidadeEl = document.getElementById("reavaliacao-tipo-atendimento");
  const dataISOEl = document.getElementById("reavaliacao-data-selecionada");
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  if (!modalidadeEl || !dataISOEl || !horariosContainer) {
    console.error(
      "Elementos para carregar horários de reavaliação não encontrados."
    );
    return;
  }

  const modalidade = modalidadeEl.value;
  const dataISO = dataISOEl.value;

  if (!modalidade || !dataISO) {
    horariosContainer.innerHTML =
      "<p>Por favor, selecione a modalidade e a data.</p>";
    return;
  }

  horariosContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const { agendas } = currentReavaliacaoConfigGlobal;
    if (!agendas) throw new Error("Configuração de reavaliação não carregada.");

    const agendasDoDia = agendas.filter(
      (a) => a.modalidade === modalidade && a.data === dataISO
    );
    if (agendasDoDia.length === 0) {
      horariosContainer.innerHTML =
        "<p>Nenhum horário configurado para este dia/modalidade.</p>";
      return;
    }

    let slotsDoDia = new Set();
    agendasDoDia.forEach((agenda) => {
      if (
        !agenda.inicio ||
        !agenda.fim ||
        !agenda.inicio.includes(":") ||
        !agenda.fim.includes(":")
      ) {
        console.warn(
          `Agenda ${agenda.id || ""} com formato de hora inválido:`,
          agenda.inicio,
          agenda.fim
        );
        return;
      }
      const [hInicio, mInicio] = agenda.inicio.split(":").map(Number);
      const [hFim, mFim] = agenda.fim.split(":").map(Number);
      if (isNaN(hInicio) || isNaN(mInicio) || isNaN(hFim) || isNaN(mFim)) {
        console.warn(
          `Agenda ${
            agenda.id || ""
          } com formato de hora inválido após conversão:`,
          agenda.inicio,
          agenda.fim
        );
        return;
      }
      const inicioEmMinutos = hInicio * 60 + mInicio;
      const fimEmMinutos = hFim * 60 + mFim;
      for (
        let minutos = inicioEmMinutos;
        minutos < fimEmMinutos;
        minutos += 30
      ) {
        const hAtual = Math.floor(minutos / 60);
        const mAtual = minutos % 60;
        const horaSlot = `${String(hAtual).padStart(2, "0")}:${String(
          mAtual
        ).padStart(2, "0")}`;
        slotsDoDia.add(horaSlot);
      }
    });
    const slotsOrdenados = [...slotsDoDia].sort();
    if (slotsOrdenados.length === 0) {
      horariosContainer.innerHTML =
        "<p>Nenhum horário configurado para este dia.</p>";
      return;
    }

    const agendamentosQuery = query(
      collection(db, "agendamentos"),
      where("data", "==", dataISO),
      where("tipo", "==", "reavaliacao"),
      where("modalidade", "==", modalidade),
      where("status", "in", ["agendado", "confirmado"])
    );
    const agendamentosSnapshot = await getDocs(agendamentosQuery);
    const horariosOcupados = new Set(
      agendamentosSnapshot.docs.map((doc) => doc.data().hora)
    );

    let slotsHtml = slotsOrdenados
      .map((hora) => {
        const isDisabled = horariosOcupados.has(hora);
        return `<button type="button" class="slot-time ${
          isDisabled ? "disabled" : ""
        }" data-hora="${hora}" ${
          isDisabled ? "disabled" : ""
        }>${hora}</button>`;
      })
      .join("");

    horariosContainer.innerHTML =
      slotsHtml || "<p>Nenhum horário disponível neste dia.</p>";
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    horariosContainer.innerHTML =
      '<p class="alert alert-error">Erro ao carregar horários. Tente novamente.</p>';
  }
}

async function handleReavaliacaoSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("reavaliacao-form");
  const modal = document.getElementById("reavaliacao-modal");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");

  if (!form || !modal || !btnConfirmar) {
    console.error("Elementos do modal de reavaliação não encontrados.");
    return;
  }

  const pacienteId = form.querySelector("#reavaliacao-paciente-id")?.value;
  const atendimentoId =
    form.querySelector("#reavaliacao-atendimento-id")?.value || null;

  if (!pacienteId) {
    alert("Erro: ID do paciente não encontrado no formulário.");
    return;
  }

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Enviando...";

  try {
    const motivoEl = document.getElementById("reavaliacao-motivo");
    const valorAtualEl = document.getElementById("reavaliacao-valor-atual");
    const modalidadePrefEl = document.getElementById(
      "reavaliacao-tipo-atendimento"
    );
    const dataPrefEl = document.getElementById("reavaliacao-data-selecionada");
    const selectedSlot = document.querySelector(
      "#reavaliacao-horarios-disponiveis .slot-time.selected"
    );

    const motivo = motivoEl?.value || "";
    const valorAtualStr = valorAtualEl?.value || "0";
    const valorAtualNum = parseFloat(valorAtualStr.replace(",", ".")) || 0;
    const modalidadePref = modalidadePrefEl?.value || null;
    const dataPref = dataPrefEl?.value || null;
    const horaPref = selectedSlot ? selectedSlot.dataset.hora : null;

    if (!motivo) {
      throw new Error("Por favor, preencha o motivo da reavaliação.");
    } // Não validar data/hora pref aqui, pois pode ser opcional
    const solicitacaoData = {
      tipo: "reavaliacao",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: userDataGlobal.uid,
      solicitanteNome: userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        form.querySelector("#reavaliacao-paciente-nome")?.value ||
        pacienteDataGlobal?.nomeCompleto ||
        "",
      atendimentoId: atendimentoId,
      detalhes: {
        motivo: motivo,
        valorContribuicaoAtual: valorAtualNum,
        preferenciaAgendamento: {
          modalidade: modalidadePref,
          data: dataPref,
          hora: horaPref,
        },
      },
      adminFeedback: null,
    };

    await addDoc(collection(db, "solicitacoes"), solicitacaoData);
    console.log("Solicitação de reavaliação criada:", solicitacaoData);
    alert(
      "Solicitação de reavaliação enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
  } catch (error) {
    console.error("Erro ao enviar solicitação de reavaliação:", error);
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Enviar Solicitação";
  }
}

// --- Lógica do Modal de Desfecho PB ---

async function abrirModalDesfechoPb(/* Usa globais */) {
  if (!pacienteDataGlobal || !userDataGlobal) {
    alert(
      "Dados necessários para abrir o modal de desfecho não estão carregados."
    );
    return;
  }
  const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === userDataGlobal.uid &&
      at.statusAtendimento === "ativo"
  );
  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para registrar o desfecho."
    );
    return;
  }

  const modal = document.getElementById("desfecho-pb-modal");
  if (!modal) {
    console.error("Modal desfecho-pb-modal não encontrado.");
    return;
  }
  const body = document.getElementById("desfecho-pb-modal-body");
  if (!body) {
    console.error("Elemento desfecho-pb-modal-body não encontrado.");
    return;
  }
  const footer = document.getElementById("desfecho-pb-modal-footer");
  if (!footer) {
    console.error("Elemento desfecho-pb-modal-footer não encontrado.");
    return;
  }

  body.innerHTML = '<div class="loading-spinner"></div>';
  footer.style.display = "none";
  modal.style.display = "flex";

  try {
    // ** Verifique o caminho deste arquivo HTML **
    const response = await fetch("./form-atendimento-pb.html"); // AJUSTE AQUI SE NECESSÁRIO
    if (!response.ok)
      throw new Error(
        `Arquivo do formulário de desfecho não encontrado (${response.status}).`
      );

    body.innerHTML = await response.text();
    footer.style.display = "flex";

    const form = body.querySelector("#form-atendimento-pb");
    if (!form)
      throw new Error(
        "Formulário #form-atendimento-pb não encontrado no HTML carregado."
      ); // Preencher dados fixos

    const pacIdInput = form.querySelector("#desfecho-paciente-id");
    if (pacIdInput) pacIdInput.value = pacienteIdGlobal;
    const atendIdInput = form.querySelector("#desfecho-atendimento-id");
    if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId;

    const profNomeEl = form.querySelector("#profissional-nome");
    if (profNomeEl)
      profNomeEl.value =
        atendimentoAtivo.profissionalNome || userDataGlobal.nome;
    const pacNomeEl = form.querySelector("#paciente-nome");
    if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;
    const valorContEl = form.querySelector("#valor-contribuicao");
    if (valorContEl)
      valorContEl.value =
        pacienteDataGlobal.valorContribuicao != null
          ? String(pacienteDataGlobal.valorContribuicao).replace(".", ",")
          : "Não definido";
    const dataInicioRaw = atendimentoAtivo.horarioSessoes?.dataInicio;
    const dataInicioEl = form.querySelector("#data-inicio-atendimento");
    if (dataInicioEl)
      dataInicioEl.value = dataInicioRaw
        ? new Date(dataInicioRaw + "T03:00:00").toLocaleDateString("pt-BR")
        : "N/A"; // Lógica de exibição condicional

    const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
    const motivoContainer = form.querySelector(
      "#motivo-alta-desistencia-container"
    );
    const encaminhamentoContainer = form.querySelector(
      "#encaminhamento-container"
    );

    if (!desfechoSelect || !motivoContainer || !encaminhamentoContainer) {
      throw new Error("Elementos do formulário de desfecho não encontrados.");
    }

    // Remove listener antigo e adiciona novo
    desfechoSelect.replaceWith(desfechoSelect.cloneNode(true));
    form
      .querySelector("#desfecho-acompanhamento")
      .addEventListener("change", () => {
        const select = form.querySelector("#desfecho-acompanhamento"); // Pega o clonado
        const value = select.value;
        motivoContainer.style.display = ["Alta", "Desistencia"].includes(value)
          ? "block"
          : "none";
        encaminhamentoContainer.style.display =
          value === "Encaminhamento" ? "block" : "none"; // Ajusta required
        const motivoInput = form.querySelector("#motivo-alta-desistencia");
        if (motivoInput)
          motivoInput.required = ["Alta", "Desistencia"].includes(value);
        const encParaInput = form.querySelector("#encaminhado-para");
        if (encParaInput) encParaInput.required = value === "Encaminhamento";
        const motivoEncInput = form.querySelector("#motivo-encaminhamento");
        if (motivoEncInput)
          motivoEncInput.required = value === "Encaminhamento";
      });
    form
      .querySelector("#desfecho-acompanhamento")
      .dispatchEvent(new Event("change")); // Estado inicial no clonado // Listener de submit já está delegado no body em adicionarEventListenersModais
  } catch (error) {
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
    footer.style.display = "flex";
    console.error(error);
  }
}

// handleDesfechoPbSubmit continua o mesmo, pois é chamado pelo listener delegado no body
async function handleDesfechoPbSubmit(evento) {
  evento.preventDefault();
  const form = evento.target; // O form que disparou o evento (#form-atendimento-pb)
  const modal = form.closest(".modal-overlay");
  const botaoSalvar = modal?.querySelector("#btn-salvar-desfecho-submit");

  if (!form || !modal || !botaoSalvar) {
    console.error(
      "Elementos do modal de desfecho não encontrados durante o submit."
    );
    alert("Erro interno ao enviar desfecho.");
    return;
  } // IDs do form

  const pacienteId = form.querySelector("#desfecho-paciente-id")?.value;
  const atendimentoId = form.querySelector("#desfecho-atendimento-id")?.value;

  if (!pacienteId || !atendimentoId || pacienteId !== pacienteIdGlobal) {
    alert("Erro: Inconsistência nos IDs do formulário.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Enviando...";

  try {
    const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
    const desfechoTipo = desfechoSelect?.value;
    if (!desfechoTipo) throw new Error("Selecione um tipo de desfecho.");

    let detalhesDesfecho = {};
    if (desfechoTipo === "Encaminhamento") {
      detalhesDesfecho = {
        servicoEncaminhado:
          form.querySelector("#encaminhado-para")?.value || null,
        motivoEncaminhamento:
          form.querySelector("#motivo-encaminhamento")?.value || null,
        demandaPaciente: form.querySelector("#demanda-paciente")?.value || "",
        continuaAtendimentoEuPsico:
          form.querySelector("#continua-atendimento")?.value || "Não informado",
        relatoCaso: form.querySelector("#relato-caso")?.value || "",
      };
      if (
        !detalhesDesfecho.servicoEncaminhado ||
        !detalhesDesfecho.motivoEncaminhamento
      ) {
        throw new Error(
          "Para encaminhamento, o serviço e o motivo são obrigatórios."
        );
      }
    } else if (["Alta", "Desistencia"].includes(desfechoTipo)) {
      detalhesDesfecho = {
        motivo: form.querySelector("#motivo-alta-desistencia")?.value || null,
      };
      if (!detalhesDesfecho.motivo) {
        throw new Error(`O motivo é obrigatório para ${desfechoTipo}.`);
      }
    }
    const dataDesfechoInput = form.querySelector("#data-desfecho");
    if (!dataDesfechoInput || !dataDesfechoInput.value) {
      throw new Error("A data do desfecho é obrigatória.");
    }
    detalhesDesfecho.dataDesfecho = dataDesfechoInput.value;

    const solicitacaoData = {
      tipo: "desfecho",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: userDataGlobal.uid,
      solicitanteNome: userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        form.querySelector("#paciente-nome")?.value ||
        pacienteDataGlobal?.nomeCompleto ||
        "",
      atendimentoId: atendimentoId,
      detalhes: {
        tipoDesfecho: desfechoTipo,
        ...detalhesDesfecho,
        sessoesRealizadas:
          form.querySelector("#quantidade-sessoes-realizadas")?.value || "N/A",
        observacoesGerais:
          form.querySelector("#observacoes-gerais")?.value || "",
      },
      adminFeedback: null,
    };

    await addDoc(collection(db, "solicitacoes"), solicitacaoData);
    console.log("Solicitação de desfecho criada:", solicitacaoData);
    alert("Registro de desfecho enviado com sucesso para o administrativo!");
    modal.style.display = "none"; // Recarregar dados do paciente para atualizar status/UI
    await carregarDadosPaciente(pacienteIdGlobal);
    preencherFormularios();
    renderizarPendencias();
    // Poderia recarregar sessões também se relevante
    await carregarSessoes();
    atualizarVisibilidadeBotoesAcao(pacienteDataGlobal.status);
  } catch (error) {
    console.error("Erro ao enviar solicitação de desfecho:", error);
    alert(`Falha ao enviar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar Desfecho";
  }
}
function abrirModalEncerramento(/* Usa globais */) {
  if (!pacienteDataGlobal || !userDataGlobal) {
    alert(
      "Dados necessários para abrir o modal de encerramento não estão carregados."
    );
    return;
  } // Verificar se o status atual é 'em_atendimento_plantao'
  if (pacienteDataGlobal.status !== "em_atendimento_plantao") {
    alert("Este paciente não está em atendimento de Plantão ativo.");
    return;
  }

  const modal = document.getElementById("encerramento-modal");
  if (!modal) {
    console.error("Modal encerramento-modal não encontrado.");
    return;
  }
  const form = document.getElementById("encerramento-form");
  if (!form) {
    console.error("Form encerramento-form não encontrado.");
    return;
  }

  form.reset();
  const pacIdInput = form.querySelector("#paciente-id-modal");
  if (pacIdInput) pacIdInput.value = pacienteIdGlobal; // Usa global ID

  const motivoNaoPagContainer = document.getElementById(
    "motivo-nao-pagamento-container"
  );
  if (motivoNaoPagContainer) motivoNaoPagContainer.classList.add("hidden");
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );
  if (novaDisponibilidadeContainer) {
    novaDisponibilidadeContainer.classList.add("hidden");
    novaDisponibilidadeContainer.innerHTML = "";
  } // Lógica da disponibilidade

  const disponibilidadeEspecifica =
    pacienteDataGlobal.disponibilidadeEspecifica || [];
  const textoDisponibilidade =
    disponibilidadeEspecifica.length > 0
      ? disponibilidadeEspecifica
          .map((item) => {
            const [periodo, hora] = item.split("_");
            const periodoFormatado =
              periodo.replace("-", " (").replace("-", " ") + ")";
            return `${
              periodoFormatado.charAt(0).toUpperCase() +
              periodoFormatado.slice(1)
            } ${hora}`;
          })
          .join(", ")
      : "Nenhuma disponibilidade específica informada.";
  const dispAtualEl = document.getElementById("disponibilidade-atual");
  if (dispAtualEl) dispAtualEl.textContent = textoDisponibilidade;

  const pagamentoSelect = form.querySelector("#pagamento-contribuicao");
  const motivoNaoPagInput = document.getElementById("motivo-nao-pagamento");
  if (pagamentoSelect) {
    // Remove listener antigo e adiciona novo
    const clonePagamento = pagamentoSelect.cloneNode(true);
    pagamentoSelect.parentNode.replaceChild(clonePagamento, pagamentoSelect);
    clonePagamento.addEventListener("change", () => {
      if (motivoNaoPagContainer)
        motivoNaoPagContainer.classList.toggle(
          "hidden",
          clonePagamento.value !== "nao"
        );
      if (motivoNaoPagInput)
        motivoNaoPagInput.required = clonePagamento.value === "nao";
    });
    clonePagamento.dispatchEvent(new Event("change")); // Estado inicial
  }

  const dispSelect = form.querySelector("#manter-disponibilidade");
  if (dispSelect && novaDisponibilidadeContainer) {
    // Remove listener antigo e adiciona novo
    const cloneDisp = dispSelect.cloneNode(true);
    dispSelect.parentNode.replaceChild(cloneDisp, dispSelect);
    cloneDisp.addEventListener("change", async () => {
      const mostrar = cloneDisp.value === "nao";
      novaDisponibilidadeContainer.classList.toggle("hidden", !mostrar); // Limpa requireds antigos
      novaDisponibilidadeContainer
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => (cb.required = false));

      if (mostrar && novaDisponibilidadeContainer.innerHTML.trim() === "") {
        novaDisponibilidadeContainer.innerHTML =
          '<div class="loading-spinner"></div>';
        try {
          // ** Verifique o caminho **
          const response = await fetch(
            "../../../public/fichas-de-inscricao.html" // AJUSTE AQUI SE NECESSÁRIO
          );
          if (!response.ok)
            throw new Error(
              `Erro ${response.status} ao buscar fichas-de-inscricao.html`
            );
          const text = await response.text();
          const parser = new DOMParser();
          const docHtml = parser.parseFromString(text, "text/html");
          const disponibilidadeHtml = docHtml.getElementById(
            "disponibilidade-section"
          )?.innerHTML;
          if (disponibilidadeHtml) {
            novaDisponibilidadeContainer.innerHTML = disponibilidadeHtml; // Adicionar required aos checkboxes AGORA
            novaDisponibilidadeContainer
              .querySelectorAll('input[type="checkbox"]')
              .forEach((cb) => (cb.required = true));
          } else {
            throw new Error(
              "Seção de disponibilidade não encontrada no arquivo HTML."
            );
          }
        } catch (error) {
          console.error("Erro ao carregar HTML da disponibilidade:", error);
          novaDisponibilidadeContainer.innerHTML =
            '<p class="alert alert-error">Erro ao carregar opções.</p>';
        }
      } else if (!mostrar) {
        // Se for 'sim', garante que os checkboxes não sejam required
        novaDisponibilidadeContainer
          .querySelectorAll('input[type="checkbox"]')
          .forEach((cb) => (cb.required = false));
      }
    });
    cloneDisp.dispatchEvent(new Event("change")); // Estado inicial
  }

  modal.style.display = "flex";
}

async function handleEncerramentoSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const form = evento.target;
  const modal = form.closest(".modal-overlay");
  const botaoSalvar = modal?.querySelector("#modal-save-btn");

  if (!form || !modal || !botaoSalvar || !userUid || !userData) {
    console.error(
      "Elementos do modal de encerramento ou dados do usuário ausentes."
    );
    alert("Erro interno ao salvar encerramento.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...';

  const pacienteId = form.querySelector("#paciente-id-modal")?.value;
  if (!pacienteId || pacienteId !== pacienteIdGlobal) {
    console.error("Inconsistência de ID de paciente no modal de encerramento!");
    alert("Erro interno. Recarregue a página.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  const encaminhamentos = Array.from(
    form.querySelectorAll('input[name="encaminhamento"]:checked')
  ).map((cb) => cb.value); // Validações

  if (encaminhamentos.length === 0) {
    alert("Selecione ao menos uma opção de encaminhamento.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const dataEncerramentoInput = form.querySelector("#data-encerramento");
  if (!dataEncerramentoInput?.value) {
    alert("A data de encerramento é obrigatória.");
    dataEncerramentoInput?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const qtdSessoesInput = form.querySelector("#quantidade-sessoes");
  if (!qtdSessoesInput?.value) {
    alert("A quantidade de sessões é obrigatória.");
    qtdSessoesInput?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const pagamentoSelect = form.querySelector("#pagamento-contribuicao");
  const pagamentoValue = pagamentoSelect?.value;
  if (!pagamentoValue) {
    alert("Informe se o pagamento foi efetuado.");
    pagamentoSelect?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const motivoNaoPagInput = form.querySelector("#motivo-nao-pagamento");
  if (pagamentoValue === "nao" && !motivoNaoPagInput?.value) {
    alert("Informe o motivo do não pagamento.");
    motivoNaoPagInput?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const relatoInput = form.querySelector("#relato-encerramento");
  if (!relatoInput?.value) {
    alert("O breve relato é obrigatório.");
    relatoInput?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  const manterDispSelect = form.querySelector("#manter-disponibilidade");
  const manterDispValue = manterDispSelect?.value;
  if (!manterDispValue) {
    alert("Informe sobre a disponibilidade.");
    manterDispSelect?.focus();
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (
    manterDispValue === "nao" &&
    form.querySelectorAll(
      '#nova-disponibilidade-container input[type="checkbox"]:checked'
    ).length === 0
  ) {
    alert(
      "Se a disponibilidade mudou, por favor, selecione os novos horários disponíveis."
    );
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  } // Busca dados atuais do paciente para disponibilidade

  let dadosDoPacienteAtual = null;
  try {
    const docRef = doc(db, "trilhaPaciente", pacienteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      dadosDoPacienteAtual = docSnap.data();
    } else {
      throw new Error("Paciente não encontrado ao tentar salvar encerramento.");
    }
  } catch (error) {
    console.error("Erro ao buscar dados do paciente para encerramento:", error);
    alert(`Erro ao buscar dados do paciente: ${error.message}`);
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  let novoStatus = encaminhamentos.includes("Alta")
    ? "alta"
    : encaminhamentos.includes("Desistência")
    ? "desistencia"
    : // Define um status mais específico se encaminhado para PB
    encaminhamentos.includes("Atendimento Psicológico")
    ? "encaminhar_para_pb"
    : // Outros encaminhamentos podem ter status específicos ou um genérico
      "encaminhado_outro"; // Exemplo de status genérico para outros encaminhamentos

  const encerramentoData = {
    responsavelId: userUid,
    responsavelNome: userData.nome,
    encaminhamento: encaminhamentos,
    dataEncerramento: dataEncerramentoInput.value,
    sessoesRealizadas: qtdSessoesInput.value,
    pagamentoEfetuado: pagamentoValue,
    motivoNaoPagamento: motivoNaoPagInput?.value || null,
    relato: relatoInput.value,
    encerradoEm: serverTimestamp(),
  };

  let dadosParaAtualizar = {
    status: novoStatus,
    "plantaoInfo.encerramento": encerramentoData,
    lastUpdate: serverTimestamp(),
  };

  if (manterDispValue === "nao") {
    const checkboxes = form.querySelectorAll(
      '#nova-disponibilidade-container input[type="checkbox"]:checked'
    );
    dadosParaAtualizar.disponibilidadeEspecifica = Array.from(checkboxes).map(
      (cb) => cb.value
    );
  } else {
    // Mantém a disponibilidade existente
    dadosParaAtualizar.disponibilidadeEspecifica =
      dadosDoPacienteAtual?.disponibilidadeEspecifica || [];
  }

  try {
    await updateDoc(doc(db, "trilhaPaciente", pacienteId), dadosParaAtualizar);
    alert("Encerramento salvo com sucesso!");
    modal.style.display = "none"; // Recarrega dados e UI
    await carregarDadosPaciente(pacienteIdGlobal);
    preencherFormularios();
    renderizarPendencias();
    atualizarVisibilidadeBotoesAcao(pacienteDataGlobal.status);
  } catch (error) {
    console.error("Erro ao salvar encerramento:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
  }
}

// --- Funções Horários PB (REFATORADAS PARA FLUXO DINÂMICO) ---

async function abrirModalHorariosPb(/* Usa globais */) {
  if (!pacienteDataGlobal || !userDataGlobal) {
    alert("Dados necessários não carregados.");
    return;
  }

  // Busca o atendimento PB relevante para este profissional
  const atendimentoPbDoUsuario = pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === userDataGlobal.uid &&
      // Permite abrir se estiver aguardando OU se o admin reabriu por algum motivo,
      // ou se já está ativo mas talvez precise alterar. Evita abrir se já concluído/desistido.
      [
        "aguardando_info_horarios",
        "horarios_informados",
        "ativo",
        "solicitado_reencaminhamento",
      ].includes(at.statusAtendimento) &&
      !at.statusAtendimento.startsWith("concluido_") &&
      at.statusAtendimento !== "desistencia_antes_inicio"
  );

  if (!atendimentoPbDoUsuario) {
    alert(
      "Não foi encontrado um atendimento PB atribuído a você (que necessite desta ação) para este paciente."
    );
    return;
  }

  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");
  const pacienteIdInput = form.querySelector("#paciente-id-horarios-modal");
  const atendimentoIdInput = form.querySelector(
    "#atendimento-id-horarios-modal"
  ); // Containers dinâmicos

  const motivoNaoInicioContainer = document.getElementById(
    "motivo-nao-inicio-pb-container"
  );
  const formContinuacaoContainer = document.getElementById(
    "form-continuacao-pb"
  ); // Para form Novas Sessões
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  ); // Para motivo desistência
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb"); // Para form Alterar Horário

  const btnSalvarHorarios = modal.querySelector('button[type="submit"]'); // Verifica se TODOS os containers existem

  if (
    !modal ||
    !form ||
    !pacienteIdInput ||
    !atendimentoIdInput ||
    !motivoNaoInicioContainer ||
    !formContinuacaoContainer ||
    !motivoDesistenciaContainer ||
    !formAlteracaoContainer ||
    !btnSalvarHorarios
  ) {
    console.error(
      "Elementos essenciais do modal Horários PB (incluindo #form-alteracao-pb) não encontrados."
    );
    alert(
      "Erro ao abrir o modal. Verifique o HTML se #form-alteracao-pb existe."
    );
    return;
  } // --- Reset Inicial ---

  form.reset();
  pacienteIdInput.value = pacienteIdGlobal;
  atendimentoIdInput.value = atendimentoPbDoUsuario.atendimentoId; // Oculta todos os containers condicionais
  [
    motivoNaoInicioContainer,
    formContinuacaoContainer,
    motivoDesistenciaContainer,
    formAlteracaoContainer,
  ].forEach((el) => (el.style.display = "none")); // Limpa o conteúdo dos containers que carregam forms externos
  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = ""; // Limpa requireds de todos os elementos potencialmente carregados ou do form base
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));
  // Garante que o radio 'iniciou-pb' seja obrigatório
  form
    .querySelectorAll('input[name="iniciou-pb"]')
    .forEach((r) => (r.required = true));

  // Define o estado do botão salvar
  btnSalvarHorarios.disabled = false;
  btnSalvarHorarios.textContent = "Salvar";

  // Remove listeners antigos para evitar duplicação (importante ao reabrir modal)
  // Clonar e substituir é uma forma eficaz de remover todos os listeners JS
  form
    .querySelectorAll(
      'input[name="iniciou-pb"], input[name="motivo-nao-inicio"]'
    )
    .forEach((radio) => {
      // Guarda o estado 'required' original
      const isRequired = radio.required;
      const clone = radio.cloneNode(true);
      clone.required = isRequired; // Restaura o required no clone
      // Limpa o estado 'checked' no clone antes de substituir
      clone.checked = false;
      radio.parentNode.replaceChild(clone, radio);
    }); // --- Listeners Principais (Recriados após clonagem) ---

  const radiosIniciou = form.querySelectorAll('input[name="iniciou-pb"]');
  radiosIniciou.forEach((radio) => {
    radio.addEventListener("change", async () => {
      // Limpa containers dinâmicos e requireds antes de mostrar o correto
      formContinuacaoContainer.style.display = "none";
      formContinuacaoContainer.innerHTML = "";
      motivoNaoInicioContainer.style.display = "none";
      motivoDesistenciaContainer.style.display = "none";
      motivoDesistenciaContainer.querySelector(
        "#motivo-desistencia-pb"
      ).required = false;
      formAlteracaoContainer.style.display = "none";
      formAlteracaoContainer.innerHTML = "";
      form
        .querySelectorAll("#form-alteracao-pb [required]")
        .forEach((el) => (el.required = false));
      // Reseta requireds gerais do form principal (motivos)
      form
        .querySelectorAll(
          'input[name="motivo-nao-inicio"], #motivo-desistencia-pb'
        )
        .forEach((el) => (el.required = false));

      if (radio.value === "sim" && radio.checked) {
        formContinuacaoContainer.style.display = "block";
        formContinuacaoContainer.innerHTML =
          '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando formulário...';
        try {
          // ** Verifique se este caminho está correto em relação ao detalhe-paciente.html **
          // Assume que o HTML está na mesma pasta ou subpasta 'partials/' ou similar
          const response = await fetch("./modal-content-novas-sessoes.html"); // AJUSTE AQUI SE NECESSÁRIO
          if (!response.ok)
            throw new Error(
              `Erro ${response.status} ao buscar ./modal-content-novas-sessoes.html`
            );
          formContinuacaoContainer.innerHTML = await response.text();
          // Configura a lógica JS específica DESTE formulário carregado
          setupFormLogicNovasSessoes(
            formContinuacaoContainer,
            atendimentoPbDoUsuario
          );
        } catch (error) {
          console.error("Erro ao carregar form Novas Sessões:", error);
          formContinuacaoContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar formulário: ${error.message}</p>`;
        }
      } else if (radio.value === "nao" && radio.checked) {
        motivoNaoInicioContainer.style.display = "block";
        // Reseta radios de motivo e torna-os required
        form
          .querySelectorAll('input[name="motivo-nao-inicio"]')
          .forEach((r) => {
            r.checked = false;
            r.required = true; // Torna a escolha do motivo obrigatória
          });
      }
    });
  });

  const radiosMotivoNaoInicio = form.querySelectorAll(
    'input[name="motivo-nao-inicio"]'
  );
  radiosMotivoNaoInicio.forEach((radio) => {
    radio.addEventListener("change", async () => {
      // Limpa containers específicos do 'Não' e seus requireds
      motivoDesistenciaContainer.style.display = "none";
      motivoDesistenciaContainer.querySelector(
        "#motivo-desistencia-pb"
      ).required = false;
      formAlteracaoContainer.style.display = "none";
      formAlteracaoContainer.innerHTML = "";
      form
        .querySelectorAll("#form-alteracao-pb [required]")
        .forEach((el) => (el.required = false));

      if (radio.value === "desistiu" && radio.checked) {
        motivoDesistenciaContainer.style.display = "block";
        motivoDesistenciaContainer.querySelector(
          "#motivo-desistencia-pb"
        ).required = true;
      } else if (radio.value === "outra_modalidade" && radio.checked) {
        formAlteracaoContainer.style.display = "block";
        formAlteracaoContainer.innerHTML =
          '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando formulário...';
        try {
          // ** Verifique se este caminho está correto em relação ao detalhe-paciente.html **
          // Assume que o HTML está na mesma pasta ou subpasta 'partials/' ou similar
          const response = await fetch("./modal-content-alterar-horario.html"); // AJUSTE AQUI SE NECESSÁRIO
          if (!response.ok)
            throw new Error(
              `Erro ${response.status} ao buscar ./modal-content-alterar-horario.html`
            );
          formAlteracaoContainer.innerHTML = await response.text();
          // Configura a lógica JS específica DESTE formulário carregado
          setupFormLogicAlterarHorario(
            formAlteracaoContainer,
            atendimentoPbDoUsuario
          );
        } catch (error) {
          console.error("Erro ao carregar form Alterar Horário:", error);
          formAlteracaoContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar formulário: ${error.message}</p>`;
        }
      }
    });
  });

  modal.style.display = "flex";
}

// --- Funções Auxiliares para Configurar Forms Carregados Dinamicamente ---

function setupFormLogicNovasSessoes(container, atendimentoAtivo) {
  // Busca o form DENTRO do container onde o HTML foi carregado
  const form = container.querySelector("#solicitar-sessoes-form"); // Assumindo ID do form original
  if (!form) {
    console.error(
      "Formulário #solicitar-sessoes-form não encontrado no HTML carregado em #form-continuacao-pb."
    );
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Novas Sessões não encontrada.</p>`;
    return;
  }

  // Preenche campos fixos
  const profNomeEl = form.querySelector("#solicitar-profissional-nome");
  if (profNomeEl) profNomeEl.value = userDataGlobal.nome;
  const pacNomeEl = form.querySelector("#solicitar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;

  // IDs ocultos estão no form principal do modal (#horarios-pb-form)

  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // Listeners para validação de grade e tipo/sala
  const fieldsToWatchIds = [
    "solicitar-dia-semana",
    "solicitar-horario",
    "solicitar-tipo-atendimento",
    "solicitar-sala",
  ];
  fieldsToWatchIds.forEach((id) => {
    const element = form.querySelector(`#${id}`);
    if (element) {
      // Remove listener antigo (se houver) e adiciona novo
      element.replaceWith(element.cloneNode(true)); // Clona para remover listeners antigos
      form
        .querySelector(`#${id}`)
        .addEventListener("change", () => validarHorarioNaGrade(form)); // Passa o form como contexto
    }
  });

  const tipoAtendimentoSelect = form.querySelector(
    "#solicitar-tipo-atendimento"
  );
  const salaSelectEl = form.querySelector("#solicitar-sala"); // Guarda referência

  if (tipoAtendimentoSelect && salaSelectEl) {
    const ajustarSalaNovasSessoes = () => {
      // Função específica
      const tipo = tipoAtendimentoSelect.value; // 'online' ou 'presencial'
      salaSelectEl.disabled = tipo === "online";
      salaSelectEl.required = tipo !== "online"; // Obrigatório se não for online

      if (tipo === "online") {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online" || salaSelectEl.value === "") {
        // Se mudou de Online para Presencial OU se estava vazio, força seleção
        // Mantém seleção se já era presencial
        salaSelectEl.value = "";
      }
      validarHorarioNaGrade(form);
    };
    // Remove listener antigo e adiciona novo
    tipoAtendimentoSelect.replaceWith(tipoAtendimentoSelect.cloneNode(true));
    form
      .querySelector("#solicitar-tipo-atendimento")
      .addEventListener("change", ajustarSalaNovasSessoes);
    ajustarSalaNovasSessoes(); // Chama para estado inicial
  } else {
    console.warn(
      "Dropdown de tipo ou sala não encontrado no form Novas Sessões carregado."
    );
  }

  // Define os requireds iniciais
  form
    .querySelectorAll(
      "#solicitar-dia-semana, #solicitar-horario, #solicitar-tipo-atendimento, #solicitar-frequencia, #solicitar-data-inicio"
    )
    .forEach((el) => (el.required = true));
  if (
    tipoAtendimentoSelect &&
    salaSelectEl &&
    tipoAtendimentoSelect.value !== "online"
  ) {
    salaSelectEl.required = true;
  }

  console.log("Formulário Novas Sessões configurado.");
}

function setupFormLogicAlterarHorario(container, atendimentoAtivo) {
  const form = container.querySelector("#alterar-horario-form"); // Assumindo ID do form original
  if (!form) {
    console.error(
      "Formulário #alterar-horario-form não encontrado no HTML carregado em #form-alteracao-pb."
    );
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Alterar Horário não encontrada.</p>`;
    return;
  }

  // Preenche dados fixos
  const pacNomeEl = form.querySelector("#alterar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = pacienteDataGlobal.nomeCompleto;
  const profNomeEl = form.querySelector("#alterar-profissional-nome");
  if (profNomeEl) profNomeEl.value = userDataGlobal.nome;

  // IDs ocultos estão no form principal do modal (#horarios-pb-form)

  // Preenche dados atuais do atendimento existente
  const horarioAtual = atendimentoAtivo?.horarioSessoes || {};
  const diaAtualEl = form.querySelector("#alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = form.querySelector("#alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";
  const modAtualEl = form.querySelector("#alterar-modalidade-atual");
  if (modAtualEl) modAtualEl.value = horarioAtual.tipoAtendimento || "N/A";

  // Preenche select de Horário
  const horarioSelect = form.querySelector("#alterar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 8; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  // Preenche select de Salas
  const salaSelect = form.querySelector("#alterar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // Lógica para habilitar/desabilitar Sala
  const tipoAtendimentoSelect = form.querySelector("#alterar-tipo-atendimento");
  const salaSelectEl = form.querySelector("#alterar-sala"); // Guarda referência

  if (tipoAtendimentoSelect && salaSelectEl) {
    const ajustarSalaAlteracao = () => {
      // Função específica
      const tipo = tipoAtendimentoSelect.value; // 'Online' ou 'Presencial'
      salaSelectEl.disabled = tipo === "Online";
      salaSelectEl.required = tipo !== "Online"; // Obrigatório se não for online

      if (tipo === "Online") {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online" || salaSelectEl.value === "") {
        // Se mudou de Online para Presencial OU se estava vazio, força seleção
        salaSelectEl.value = "";
      }
      // Não precisa validar grade aqui, só no submit ou se tivéssemos feedback
    };
    // Remove listener antigo e adiciona novo
    tipoAtendimentoSelect.replaceWith(tipoAtendimentoSelect.cloneNode(true));
    form
      .querySelector("#alterar-tipo-atendimento")
      .addEventListener("change", ajustarSalaAlteracao);
    ajustarSalaAlteracao(); // Chama para estado inicial
  } else {
    console.warn(
      "Dropdown de tipo ou sala não encontrado no form Alterar Horário carregado."
    );
  }

  // Define os requireds iniciais
  form
    .querySelectorAll(
      "#alterar-dia-semana, #alterar-horario, #alterar-tipo-atendimento, #alterar-frequencia, #alterar-data-inicio, #alterar-grade"
    )
    .forEach((el) => (el.required = true));
  if (
    tipoAtendimentoSelect &&
    salaSelectEl &&
    tipoAtendimentoSelect.value !== "Online"
  ) {
    salaSelectEl.required = true;
  }

  console.log("Formulário Alterar Horário configurado.");
}

// --- Função para validar grade (Adaptada para receber o form como parâmetro) ---
function validarHorarioNaGrade(formContext) {
  // Usa o feedback DIV GLOBAL, pois ele existe fora dos forms carregados
  const feedbackDiv = document.getElementById("validacao-grade-feedback");

  if (!formContext) {
    console.warn("validarHorarioNaGrade chamada sem contexto de formulário.");
    if (feedbackDiv) feedbackDiv.style.display = "none"; // Esconde o global
    return;
  }

  // Tenta encontrar os elementos dentro do form passado (IDs do form Novas Sessões)
  const diaEl = formContext.querySelector("#solicitar-dia-semana");
  const horarioEl = formContext.querySelector("#solicitar-horario");
  const tipoEl = formContext.querySelector("#solicitar-tipo-atendimento");
  const salaEl = formContext.querySelector("#solicitar-sala");

  if (!feedbackDiv) {
    console.warn(
      "Elemento de feedback #validacao-grade-feedback não encontrado na página."
    );
    return; // Não pode mostrar feedback
  }

  // Esconde feedback antes de validar
  feedbackDiv.style.display = "none";
  feedbackDiv.className = "info-note"; // Reseta classes
  feedbackDiv.innerHTML = "";

  if (!diaEl || !horarioEl || !tipoEl || !salaEl) {
    // Se os elementos não são do form esperado (ex: form Alterar Horário está ativo), não valida
    // console.warn("Elementos para validação de grade (Novas Sessões) não encontrados no contexto:", formContext.id);
    return;
  }

  const dia = diaEl.value;
  const horarioCompleto = horarioEl.value;
  // ** Atenção: O valor do tipo no form Novas Sessões está 'online'/'presencial' (minúsculo) **
  const tipo = tipoEl.value; // Usar o valor como está ('online' ou 'presencial')
  const sala = salaEl.value;

  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;
  let isOcupado = false;

  // Garante que dia, hora e tipo foram selecionados. E sala se for presencial.
  if (!dia || !horaKey || !tipo || (tipo === "presencial" && !sala)) {
    return; // Não valida se faltar dados essenciais
  }

  // Mapear dia para chave da grade ('segunda', 'terca', etc.)
  const diasMapGrade = {
    "Segunda-feira": "segunda",
    "Terça-feira": "terca",
    "Quarta-feira": "quarta",
    "Quinta-feira": "quinta",
    "Sexta-feira": "sexta",
    Sábado: "sabado",
  };
  const diaChave = diasMapGrade[dia] || dia.toLowerCase(); // Fallback se já for minúsculo

  // Usa dadosDaGradeGlobal e salasPresenciaisGlobal (variáveis globais)
  if (tipo === "online") {
    for (let i = 0; i < 6; i++) {
      // Assumindo 6 colunas online na grade
      if (dadosDaGradeGlobal?.online?.[diaChave]?.[horaKey]?.[`col${i}`]) {
        isOcupado = true;
        break;
      }
    }
  } else if (tipo === "presencial") {
    const salaIndex = salasPresenciaisGlobal?.indexOf(sala);
    if (
      salaIndex !== undefined &&
      salaIndex !== -1 &&
      dadosDaGradeGlobal?.presencial?.[diaChave]?.[horaKey]?.[`col${salaIndex}`]
    ) {
      isOcupado = true;
    }
  }

  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "info-note exists alert alert-warning";
    feedbackDiv.innerHTML =
      "<strong>Atenção:</strong> Este horário já está preenchido na grade. <br>Sua solicitação será enviada mesmo assim para análise do administrativo.";
  } else {
    feedbackDiv.className = "info-note success alert alert-success";
    feedbackDiv.innerHTML =
      "<strong>Disponível:</strong> O horário selecionado parece livre na grade. A solicitação será enviada para análise do administrativo.";
  }
}

// --- Handler de Submit Refatorado ---
async function handleHorariosPbSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const formularioPrincipal = evento.target; // É o #horarios-pb-form
  const modal = formularioPrincipal.closest(".modal-overlay");
  const botaoSalvar = modal?.querySelector('button[type="submit"]');

  if (!formularioPrincipal || !modal || !botaoSalvar || !userUid || !userData) {
    console.error("Elementos do modal ou dados do usuário ausentes no submit.");
    alert("Erro interno ao salvar.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...';

  const pacienteId = formularioPrincipal.querySelector(
    "#paciente-id-horarios-modal"
  )?.value;
  const atendimentoId = formularioPrincipal.querySelector(
    "#atendimento-id-horarios-modal"
  )?.value;
  const docRef = doc(db, "trilhaPaciente", pacienteId);

  try {
    const iniciouRadio = formularioPrincipal.querySelector(
      'input[name="iniciou-pb"]:checked'
    );
    const motivoNaoInicioRadio = formularioPrincipal.querySelector(
      'input[name="motivo-nao-inicio"]:checked'
    );

    if (!iniciouRadio) {
      // Garante que a validação HTML básica seja disparada se nenhum for selecionado
      formularioPrincipal.reportValidity();
      throw new Error("Selecione se o paciente iniciou o atendimento.");
    }
    const iniciou = iniciouRadio.value;

    // --- Fluxo SIM (Equivalente a Novas Sessões) ---
    if (iniciou === "sim") {
      const formContinuacao = document
        .getElementById("form-continuacao-pb")
        ?.querySelector("#solicitar-sessoes-form");
      if (!formContinuacao)
        throw new Error(
          "Erro interno: Formulário de continuação não encontrado."
        );

      // Valida o formulário carregado
      if (!formContinuacao.checkValidity()) {
        formContinuacao.reportValidity();
        throw new Error(
          "Preencha todos os campos obrigatórios (*) do formulário de agendamento."
        );
      }

      // Coleta dados do formulário carregado (Novas Sessões)
      const horarioSessaoData = {
        responsavelId: userUid,
        responsavelNome: userData.nome,
        diaSemana:
          formContinuacao.querySelector("#solicitar-dia-semana")?.value || null,
        horario:
          formContinuacao.querySelector("#solicitar-horario")?.value || null,
        tipoAtendimento:
          formContinuacao.querySelector("#solicitar-tipo-atendimento")?.value ||
          null, // 'online' ou 'presencial'
        frequencia:
          formContinuacao.querySelector("#solicitar-frequencia")?.value || null,
        salaAtendimento:
          formContinuacao.querySelector("#solicitar-sala")?.value || null,
        dataInicio:
          formContinuacao.querySelector("#solicitar-data-inicio")?.value ||
          null,
        alterarGrade: "Sim", // Assumindo que ao informar horários, a intenção é incluir na grade
        observacoes: "", // Campo não existe no form Novas Sessões
        definidoEm: Timestamp.now(), // Usa Timestamp.now() dentro do array
      };

      // Atualiza a trilha do paciente
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
      const dadosDoPaciente = docSnap.data();
      const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
      const indiceDoAtendimento = atendimentos.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );
      if (indiceDoAtendimento === -1)
        throw new Error("Atendimento não encontrado para este paciente!");

      atendimentos[indiceDoAtendimento].horarioSessoes = horarioSessaoData;
      atendimentos[indiceDoAtendimento].statusAtendimento =
        "horarios_informados"; // Atualiza status do atendimento específico

      const dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: "cadastrar_horario_psicomanager", // Atualiza status principal
        lastUpdate: serverTimestamp(),
        // NÃO define dataCadastroPsicomanager aqui
      };
      await updateDoc(docRef, dadosParaAtualizar);

      // Cria a solicitação para o admin
      const solicitacaoData = {
        tipo: "novas_sessoes",
        status: "Pendente",
        dataSolicitacao: serverTimestamp(),
        solicitanteId: userUid,
        solicitanteNome: userData.nome,
        pacienteId: pacienteId,
        pacienteNome: dadosDoPaciente.nomeCompleto,
        atendimentoId: atendimentoId,
        detalhes: {
          // Mapeia para os nomes esperados pelo admin/solicitação original
          diaSemana: horarioSessaoData.diaSemana,
          horario: horarioSessaoData.horario,
          modalidade:
            horarioSessaoData.tipoAtendimento === "online"
              ? "Online"
              : horarioSessaoData.tipoAtendimento === "presencial"
              ? "Presencial"
              : horarioSessaoData.tipoAtendimento, // Garante capitalização
          frequencia: horarioSessaoData.frequencia,
          sala: horarioSessaoData.salaAtendimento,
          dataInicioPreferencial: horarioSessaoData.dataInicio,
          // Inclui 'alterarGrade' se o admin precisar saber
          alterarGradeSolicitado: horarioSessaoData.alterarGrade,
        },
        adminFeedback: null,
      };
      await addDoc(collection(db, "solicitacoes"), solicitacaoData);
      console.log(
        "Solicitação de 'novas sessões' (para cadastro) criada via Horários PB."
      );

      // --- Fluxo NÃO ---
    } else if (iniciou === "nao") {
      if (!motivoNaoInicioRadio) {
        // Tenta forçar validação do radio 'motivo'
        const primeiroRadioMotivo = formularioPrincipal.querySelector(
          'input[name="motivo-nao-inicio"]'
        );
        primeiroRadioMotivo?.focus(); // Tenta focar
        primeiroRadioMotivo?.reportValidity(); // Tenta mostrar balão de erro
        throw new Error("Selecione o motivo do não início.");
      }
      const motivoNaoInicio = motivoNaoInicioRadio.value;

      // --- Sub-fluxo NÃO -> DESISTIU ---
      if (motivoNaoInicio === "desistiu") {
        const motivoDescricaoInput = formularioPrincipal.querySelector(
          "#motivo-desistencia-pb"
        );
        const motivoDescricao = motivoDescricaoInput?.value.trim() || "";
        if (!motivoDescricao) {
          motivoDescricaoInput?.focus();
          motivoDescricaoInput?.reportValidity();
          throw new Error("Descreva o motivo da desistência.");
        }

        const dataDesistencia = new Date(); // Data/hora atual da desistência

        // Atualiza a trilha do paciente
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (indiceDoAtendimento === -1)
          throw new Error("Atendimento não encontrado para este paciente!");

        atendimentos[indiceDoAtendimento].statusAtendimento =
          "desistencia_antes_inicio";
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao;
        atendimentos[indiceDoAtendimento].naoIniciouEm =
          Timestamp.fromDate(dataDesistencia);

        const dadosParaAtualizar = {
          atendimentosPB: atendimentos,
          status: "desistencia", // Status principal do paciente
          lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRef, dadosParaAtualizar);
        console.log("Paciente marcado como desistência antes do início.");

        // Exclui sessões futuras associadas a ESTE atendimentoId
        await excluirSessoesFuturas(pacienteId, atendimentoId, dataDesistencia);

        // --- Sub-fluxo NÃO -> OUTRA MODALIDADE (Equivalente a Alterar Horário) ---
      } else if (motivoNaoInicio === "outra_modalidade") {
        const formAlteracao = document
          .getElementById("form-alteracao-pb")
          ?.querySelector("#alterar-horario-form");
        if (!formAlteracao)
          throw new Error(
            "Erro interno: Formulário de alteração não encontrado."
          );

        // Valida o formulário carregado
        if (!formAlteracao.checkValidity()) {
          formAlteracao.reportValidity();
          throw new Error(
            "Preencha todos os campos obrigatórios (*) da nova configuração desejada."
          );
        }

        // Coleta dados do formulário carregado (Alterar Horário)
        const dadosNovos = {
          dia:
            formAlteracao.querySelector("#alterar-dia-semana")?.value || null,
          horario:
            formAlteracao.querySelector("#alterar-horario")?.value || null,
          modalidade:
            formAlteracao.querySelector("#alterar-tipo-atendimento")?.value ||
            null, // 'Online' ou 'Presencial'
          frequencia:
            formAlteracao.querySelector("#alterar-frequencia")?.value || null,
          sala: formAlteracao.querySelector("#alterar-sala")?.value || null,
          dataInicio:
            formAlteracao.querySelector("#alterar-data-inicio")?.value || null,
          alterarGrade:
            formAlteracao.querySelector("#alterar-grade")?.value || null, // 'Sim' ou 'Não'
        };
        const justificativa =
          formAlteracao.querySelector("#alterar-justificativa")?.value ||
          "Solicitado antes do início do atendimento devido a preferência por outro horário/modalidade.";

        // Busca dados atuais para preencher "dadosAntigos"
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentoAtual = dadosDoPaciente.atendimentosPB?.find(
          (at) => at.atendimentoId === atendimentoId
        );
        // Os dados antigos podem não existir ainda se o fluxo veio direto para cá
        const horarioAntigo = atendimentoAtual?.horarioSessoes || {};
        const dadosAntigos = {
          dia: horarioAntigo.diaSemana || "N/A",
          horario: horarioAntigo.horario || "N/A",
          modalidade: horarioAntigo.tipoAtendimento || "N/A",
          sala: horarioAntigo.salaAtendimento || "N/A",
          frequencia: horarioAntigo.frequencia || "N/A",
        };

        // Atualiza a trilha do paciente
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (indiceDoAtendimento === -1)
          throw new Error("Atendimento não encontrado!");

        atendimentos[indiceDoAtendimento].statusAtendimento =
          "solicitado_reencaminhamento"; // Ou um status mais específico?
        atendimentos[indiceDoAtendimento].motivoNaoInicio = "outra_modalidade";
        // Guarda a solicitação aqui se precisar rastrear
        atendimentos[indiceDoAtendimento].solicitacaoAlteracaoPendente = {
          ...dadosNovos,
          justificativa: justificativa,
          dataSolicitacao: Timestamp.now(),
        };
        atendimentos[indiceDoAtendimento].naoIniciouEm = Timestamp.now();

        const dadosParaAtualizar = {
          atendimentosPB: atendimentos,
          status: "reavaliar_encaminhamento", // Status principal do paciente para admin analisar
          lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRef, dadosParaAtualizar);

        // Cria a solicitação para o admin
        const solicitacaoData = {
          tipo: "alteracao_horario",
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: userUid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: {
            dadosAntigos: dadosAntigos,
            dadosNovos: dadosNovos, // Contém os dados preenchidos no form de alteração
            justificativa: justificativa,
          },
          adminFeedback: null,
        };
        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log(
          "Solicitação de 'alteracao_horario' criada via Horários PB (Não iniciou -> Outra)."
        );
      } else {
        // Caso algum outro valor de radio apareça (não deve acontecer com HTML atual)
        throw new Error("Seleção de motivo inválida.");
      }
    } else {
      // Caso o valor do radio 'iniciou-pb' seja inválido
      throw new Error("Seleção 'Iniciou Atendimento' inválida.");
    }

    alert("Informações salvas com sucesso!");
    modal.style.display = "none"; // Recarrega os dados para refletir as mudanças
    await carregarDadosPaciente(pacienteIdGlobal);
    preencherFormularios();
    renderizarPendencias();
    await carregarSessoes();
    atualizarVisibilidadeBotoesAcao(pacienteDataGlobal.status);
  } catch (error) {
    console.error("Erro ao salvar informações de Horários PB:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    // Garante que o botão seja reabilitado mesmo em caso de erro
    if (botaoSalvar) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
  }
}

// --- NOVA FUNÇÃO: Excluir Sessões Futuras ---
async function excluirSessoesFuturas(
  pacienteId,
  atendimentoId,
  dataReferencia
) {
  console.log(
    `Buscando sessões futuras para exclusão (Atendimento: ${atendimentoId}, após ${dataReferencia.toISOString()})`
  );
  const sessoesRef = collection(db, "trilhaPaciente", pacienteId, "sessoes");
  // Convertendo a data JS para Timestamp do Firestore para a comparação
  const timestampReferencia = Timestamp.fromDate(dataReferencia);

  // Query para buscar sessões DESTE atendimentoId que ocorrem APÓS a data de referência
  const q = query(
    sessoesRef,
    where("atendimentoId", "==", atendimentoId),
    where("dataHora", ">", timestampReferencia) // Compara com o Timestamp
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("Nenhuma sessão futura encontrada para excluir.");
      return; // Nenhuma sessão para excluir
    }

    // Usa um batch para excluir todas as sessões encontradas atomicamente
    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((doc) => {
      console.log(
        `Marcando sessão ${doc.id} (${
          doc.data().dataHora?.toDate()?.toLocaleString("pt-BR") ||
          "Data inválida"
        }) para exclusão.`
      );
      batch.delete(doc.ref); // Adiciona a operação de exclusão ao batch
      count++;
    });

    // Executa todas as exclusões no batch
    await batch.commit();
    console.log(`${count} sessões futuras excluídas com sucesso.`);

    // Recarrega a lista de sessões na interface do usuário para refletir a exclusão
    await carregarSessoes();
  } catch (error) {
    console.error("Erro ao excluir sessões futuras:", error);
    // Informa o usuário sobre o erro, mas não interrompe o fluxo principal (a desistência já foi salva)
    alert(
      `Erro ao tentar excluir sessões futuras agendadas: ${error.message}. Por favor, verifique manualmente as sessões futuras do paciente.`
    );
  }
}
