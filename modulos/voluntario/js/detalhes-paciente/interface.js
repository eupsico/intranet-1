// Arquivo: /modulos/voluntario/js/detalhes-paciente/interface.js
// Responsável pela renderização da UI, preenchimento de formulários e manipulação do DOM.

import * as estado from "./estado.js";
import { calcularIdade, formatarStatus } from "./utilitarios.js"; // Importa do novo utilitarios.js

// --- Funções de Manipulação da UI ---

/**
 * Define a visibilidade de um botão de ação.
 * @param {string} id - O ID do elemento botão.
 * @param {boolean} isVisible - true para mostrar, false para ocultar.
 */
export function setButtonVisibility(id, isVisible) {
  const btn = document.getElementById(id);
  if (btn) {
    // Adapta para botões normais e itens de menu hamburger
    const displayStyle =
      btn.classList.contains("hamburger-menu-item") ||
      btn.closest(".dropdown-content")
        ? "block"
        : "inline-block";
    btn.style.display = isVisible ? displayStyle : "none";
  } else {
    console.warn(
      `Botão de ação #${id} não encontrado para definir visibilidade.`
    );
  }
}

/**
 * Controla quais botões de ação são exibidos com base no status do paciente.
 * @param {string} status - O status atual do paciente.
 */
export function atualizarVisibilidadeBotoesAcao(status) {
  console.log("Atualizando visibilidade dos botões para o status:", status); // Define a visibilidade padrão (oculta todos primeiro, exceto os básicos)

  setButtonVisibility("btn-abrir-modal-mensagem", true); // Sempre visível? (Verificar regra)
  setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false); // Legado
  setButtonVisibility("btn-abrir-modal-alterar-horario", false); // Legado
  setButtonVisibility("btn-abrir-modal-reavaliacao", true); // Quase sempre visível
  setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
  setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
  setButtonVisibility("btn-abrir-modal-horarios-pb", false); // Novo fluxo

  switch (status) {
    case "em_atendimento_pb": // (PB Ativo)
    case "pacientes_parcerias": // <-- ADICIONADO: Mesmo comportamento do PB
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", true); // Botão legado ainda visível?
      setButtonVisibility("btn-abrir-modal-alterar-horario", true); // Botão legado ainda visível?
      setButtonVisibility("btn-abrir-modal-desfecho-pb", true);
      break;

    case "aguardando_info_horarios": // (Aguardando Horários)
      setButtonVisibility("btn-abrir-modal-horarios-pb", true); // Mostra o botão do novo fluxo // Garante que outros botões PB estejam ocultos
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false);
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
      break;

    case "cadastrar_horario_psicomanager": // (Horários Informados, aguardando admin) // Apenas Mensagem e Reavaliação visíveis por padrão. // Oculta explicitamente os outros para clareza.
      setButtonVisibility("btn-abrir-modal-solicitar-sessoes", false);
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", false);
      setButtonVisibility("btn-abrir-modal-horarios-pb", false);
      break;

    case "em_atendimento_plantao": // (Plantão Ativo) // setButtonVisibility("btn-abrir-modal-solicitar-sessoes", true); // Solicitar sessões faz sentido no plantão? Verificar regra.
      setButtonVisibility("btn-abrir-modal-encerramento-plantao", true); // Garante que botões PB estejam ocultos
      setButtonVisibility("btn-abrir-modal-alterar-horario", false);
      setButtonVisibility("btn-abrir-modal-desfecho-pb", false);
      setButtonVisibility("btn-abrir-modal-horarios-pb", false);
      break;

    default: // Para outros status (ex: 'alta', 'desistencia', etc.)
      console.log(
        `Status "${status}" não tem regras de botões personalizadas. Usando padrão (Mensagem e Reavaliação).`
      ); // O padrão já deixa apenas Mensagem e Reavaliação visíveis.
      break;
  }
}

/**
 * Preenche os formulários da página com os dados do paciente do estado.
 */
/**
 * Preenche os formulários da página com os dados do paciente do estado.
 */
export function preencherFormularios() {
  console.log(">>> Entrou em preencherFormularios()");
  if (!estado.pacienteDataGlobal) {
    console.warn(
      "preencherFormularios chamado sem dados do paciente no estado."
    );
    return;
  }

  const setElementValue = (
    id,
    value,
    isInputReadOnly = false,
    targetElement = document
  ) => {
    const element = targetElement.getElementById(id);
    if (element) {
      const tagName = element.tagName;
      if (tagName === "SPAN") {
        element.textContent = value ?? "--";
      } else if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) {
        let displayValue = value ?? "";
        if (id === "dp-valor-contribuicao" && typeof value === "number") {
          displayValue = value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        element.value = displayValue;

        if (isInputReadOnly && id === "dp-status-atual-input") {
          const statusSpan = document.getElementById("dp-status-atual");
          if (statusSpan) {
            element.className = "form-control status-badge-input";
            statusSpan.classList.forEach((cls) => {
              if (!["readonly-value", "status-badge"].includes(cls)) {
                element.classList.add(cls);
              }
            });
            element.value = statusSpan.textContent || "--";
          } else {
            element.value = value ?? "--";
          }
        } else if (isInputReadOnly) {
          element.value = value ?? "--";
        }
      }
    }
  };

  const paciente = estado.pacienteDataGlobal;

  // --- STATUS E DADOS BÁSICOS ---
  const statusPaciente = paciente.status || "desconhecido";
  const statusFormatado = formatarStatus(statusPaciente);
  const statusSpan = document.getElementById("dp-status-atual");
  if (statusSpan) {
    statusSpan.textContent = statusFormatado;
    statusSpan.className = `readonly-value status-badge ${statusPaciente}`;
  }
  setElementValue("dp-status-atual", statusFormatado, true);
  setElementValue("dp-status-atual-input", statusFormatado, true);

  // --- PARCERIA ---
  const parceriaContainer = document.getElementById("dp-parceria-container");
  const parceriaSelect = document.getElementById("dp-parceria");
  if (parceriaContainer && parceriaSelect) {
    if (statusPaciente === "pacientes_parcerias") {
      parceriaContainer.style.display = "block";
      // Preenche select se vazio
      if (parceriaSelect.options.length <= 1) {
        const parceriasList =
          estado.systemConfigsGlobal?.listas?.parcerias || [];
        parceriasList.forEach((parc) => {
          const opt = document.createElement("option");
          opt.value = parc;
          opt.textContent = parc;
          parceriaSelect.appendChild(opt);
        });
      }
      setElementValue("dp-parceria", paciente.parceria);
    } else {
      parceriaContainer.style.display = "none";
    }
  }

  // --- LÓGICA DO CONTRATO (CORRIGIDA) ---
  const areaAssinado = document.getElementById("area-contrato-assinado");
  const areaPendente = document.getElementById("area-contrato-pendente");
  const linkContrato = document.getElementById("link-ver-contrato");
  const dataAssinatura = document.getElementById("data-assinatura-contrato");

  // Procura contrato assinado no objeto principal ou nos atendimentos
  let contratoUrl = paciente.contratoUrl;
  let contratoData = paciente.contratoData;
  let estaAssinado = false; // Nova flag de controle

  // Verifica se existe assinatura no nível raiz
  if (contratoUrl || contratoData) {
    estaAssinado = true;
  }

  // Se não achar no raiz, tenta achar no atendimento PB ativo do usuário
  if (!estaAssinado && paciente.atendimentosPB && estado.userDataGlobal) {
    const meuAtendimento = paciente.atendimentosPB.find(
      (at) => at.profissionalId === estado.userDataGlobal.uid
    );

    // CORREÇÃO: Verifica se o objeto contratoAssinado existe, independente da URL
    if (meuAtendimento && meuAtendimento.contratoAssinado) {
      estaAssinado = true;

      // Tenta pegar a URL se existir
      contratoUrl =
        meuAtendimento.contratoAssinado.urlPdf ||
        meuAtendimento.contratoAssinado.arquivoUrl;

      contratoData = meuAtendimento.contratoAssinado.assinadoEm;
    }
  }

  if (areaAssinado && areaPendente) {
    if (estaAssinado) {
      // CONTRATO ASSINADO
      areaAssinado.style.display = "block";
      areaPendente.style.display = "none";

      if (linkContrato) {
        if (contratoUrl) {
          linkContrato.href = contratoUrl;
          linkContrato.style.display = "inline-flex"; // Mostra o botão se tiver link
        } else {
          linkContrato.style.display = "none"; // Esconde o botão se for apenas registro de dados
        }
      }

      if (dataAssinatura) {
        if (contratoData) {
          const d = contratoData.toDate
            ? contratoData.toDate()
            : new Date(contratoData);
          dataAssinatura.textContent =
            d.toLocaleDateString("pt-BR") +
            " às " +
            d.toLocaleTimeString("pt-BR");
        } else {
          dataAssinatura.textContent = "Data não registrada";
        }
      }
    } else {
      // CONTRATO PENDENTE
      areaAssinado.style.display = "none";
      areaPendente.style.display = "block";
    }
  }
  // --- DEMAIS DADOS ---
  const idadeCalculada = calcularIdade(paciente.dataNascimento);
  setElementValue("dp-idade", idadeCalculada, true);
  setElementValue("dp-idade-input", idadeCalculada, true);

  const dataEncaminhamentoRaw =
    paciente.plantaoInfo?.dataEncaminhamento ||
    paciente.atendimentosPB?.[0]?.dataEncaminhamento;
  const dataEncaminhamento = dataEncaminhamentoRaw
    ? new Date(dataEncaminhamentoRaw + "T03:00:00").toLocaleDateString("pt-BR")
    : "--";
  setElementValue("dp-desde", dataEncaminhamento, true);
  setElementValue("dp-desde-input", dataEncaminhamento, true);

  setElementValue("dp-nome-completo", paciente.nomeCompleto);
  setElementValue("dp-telefone", paciente.telefoneCelular);
  setElementValue("dp-data-nascimento", paciente.dataNascimento);
  setElementValue("dp-cpf", paciente.cpf);

  const endereco = paciente.endereco || {};
  setElementValue("dp-endereco-logradouro", endereco.logradouro);
  setElementValue("dp-endereco-numero", endereco.numero);
  setElementValue("dp-endereco-complemento", endereco.complemento);
  setElementValue("dp-endereco-bairro", endereco.bairro);
  setElementValue("dp-endereco-cidade", endereco.cidade);
  setElementValue("dp-endereco-estado", endereco.estado);
  setElementValue("dp-endereco-cep", endereco.cep);

  setElementValue("dp-responsavel-nome", paciente.responsavel?.nome);
  setElementValue(
    "dp-contato-emergencia-nome",
    paciente.contatoEmergencia?.nome
  );
  setElementValue(
    "dp-contato-emergencia-telefone",
    paciente.contatoEmergencia?.telefone
  );

  setElementValue("dp-valor-contribuicao", paciente.valorContribuicao);

  const acompanhamento = paciente.acompanhamentoClinico || {};
  setElementValue("ac-avaliacao-demanda", acompanhamento.avaliacaoDemanda);
  setElementValue("ac-definicao-objetivos", acompanhamento.definicaoObjetivos);
  setElementValue("ac-diagnostico", acompanhamento.diagnostico);
  setElementValue(
    "ac-registro-encerramento",
    acompanhamento.registroEncerramento
  );

  // --- LISTA DE ARQUIVOS CLÍNICOS (UPLOAD) ---
  const arquivosContainer = document.getElementById("ac-arquivos-lista");
  if (arquivosContainer) {
    arquivosContainer.innerHTML = "";
    if (paciente.arquivosClinicos && paciente.arquivosClinicos.length > 0) {
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = "0";
      ul.style.margin = "0";

      paciente.arquivosClinicos.forEach((arq) => {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        li.style.padding = "10px";
        li.style.border = "1px solid #eee";
        li.style.borderRadius = "4px";
        li.style.backgroundColor = "#fff";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";

        const dataUpload = arq.data
          ? (arq.data.toDate
              ? arq.data.toDate()
              : new Date(arq.data)
            ).toLocaleDateString("pt-BR")
          : "";

        li.innerHTML = `
                <div style="overflow: hidden; text-overflow: ellipsis;">
                    <a href="${arq.url}" target="_blank" style="font-weight: 600; color: var(--cor-primaria); text-decoration: none; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-file-alt"></i> ${arq.nome}
                    </a>
                    <span style="display: block; font-size: 0.8em; color: #777; margin-left: 20px;">Enviado em: ${dataUpload}</span>
                </div>
                <a href="${arq.url}" target="_blank" class="action-button secondary-button small" title="Baixar">
                    <i class="fas fa-download"></i>
                </a>
              `;
        ul.appendChild(li);
      });
      arquivosContainer.appendChild(ul);
    } else {
      arquivosContainer.innerHTML =
        '<p class="text-muted" style="font-size: 0.9em; font-style: italic; text-align: center; padding: 10px;">Nenhum arquivo anexado.</p>';
    }
  }

  console.log("Formulários preenchidos.");
}
/**
 * Renderiza a lista de sessões na interface.
 * Assume que o estado.sessoesCarregadas já foi populado.
 */
export function renderizarSessoes() {
  const container = document.getElementById("session-list-container");
  const loading = document.getElementById("session-list-loading");
  const placeholder = document.getElementById("session-list-placeholder");

  // Verificação de segurança reforçada
  if (!container) {
    console.warn(
      "Ainda não é possível renderizar sessões: container não encontrado no DOM."
    );
    return;
  }

  container.innerHTML = "";
  if (loading) loading.style.display = "none";
  if (placeholder) placeholder.style.display = "none";

  const sessoes = estado.sessoesCarregadas;

  if (!sessoes || sessoes.length === 0) {
    if (placeholder) placeholder.style.display = "block";
    return;
  }

  sessoes.forEach((sessao) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "session-item";
    itemDiv.dataset.sessaoId = sessao.id;

    // --- Lógica de Data e Hora ---
    let dataObj = null;
    let horaTexto = "";

    if (sessao.dataHora?.toDate) {
      dataObj = sessao.dataHora.toDate();
      horaTexto = dataObj.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (sessao.data) {
      const horaTemp = sessao.horaInicio || "00:00";
      try {
        dataObj = new Date(`${sessao.data}T${horaTemp}:00`);
        horaTexto = horaTemp;
      } catch (e) {
        console.warn("Data inválida na sessão", sessao);
      }
    }

    const dataFormatada =
      dataObj && !isNaN(dataObj)
        ? dataObj.toLocaleDateString("pt-BR")
        : "Data Inválida";
    const statusSessao = sessao.status || "pendente";

    // --- Ícones e Textos Baseados no Status ---
    let statusLabel = "Agendado";
    let statusIcon = "📅"; // Ícone padrão
    let statusClass = "";

    switch (statusSessao) {
      case "presente":
        statusLabel = "Paciente Presente";
        statusIcon = "👍";
        statusClass = "presente";
        break;
      case "ausente":
        statusLabel = "Paciente Ausente";
        statusIcon = "👎";
        statusClass = "ausente";
        break;
      case "cancelada_paciente":
        statusLabel = "Cancelado (Paciente)";
        statusIcon = "🚫";
        statusClass = "cancelada_paciente";
        break;
      case "cancelada_prof":
        statusLabel = "Cancelado (Profissional)";
        statusIcon = "⛔";
        statusClass = "cancelada_prof";
        break;
      default:
        statusLabel = "Agendado";
        statusIcon = "📅";
    }

    // --- HTML do Card com Dropdown ---
    itemDiv.innerHTML = `
      <div class="session-info">
        <div class="info-item">
          <span class="label">Data</span>
          <span class="value">${dataFormatada}</span>
        </div>
        <div class="info-item">
          <span class="label">Horário</span>
          <span class="value">${horaTexto}</span>
        </div>
        <div class="info-item">
          <span class="label">Status</span>
          <span class="value status-text ${statusClass}">
             ${statusIcon} ${statusLabel}
          </span>
        </div>
      </div>

      <div class="session-actions">
          <div class="dropdown-container">
              <button type="button" class="btn-status-dropdown" data-action="toggle-status-menu">
                  <span class="icon">⚙️</span> Opções
              </button>
              
              <div class="status-dropdown-menu">
                  <button type="button" class="status-dropdown-item item-presente" data-action="mudar-status" data-novo-status="presente">
                      👍 Paciente Presente
                  </button>
                  <button type="button" class="status-dropdown-item item-ausente" data-action="mudar-status" data-novo-status="ausente">
                      👎 Paciente Ausente
                  </button>
                  <button type="button" class="status-dropdown-item item-cancelado-paciente" data-action="mudar-status" data-novo-status="cancelada_paciente">
                      🚫 Paciente Cancelou
                  </button>
                  <button type="button" class="status-dropdown-item item-cancelado-prof" data-action="mudar-status" data-novo-status="cancelada_prof">
                      ⛔ Profissional Cancelou
                  </button>
                   <hr style="margin: 5px 0; border: 0; border-top: 1px solid #eee;">
                  <button type="button" class="status-dropdown-item" data-action="mudar-status" data-novo-status="pendente">
                      📅 Agendado (Resetar)
                  </button>
              </div>
          </div>
        
          <button type="button" class="action-button secondary-button btn-anotacoes" data-action="anotacoes">
             📝 Anotações
          </button>
      </div>
    `;
    container.appendChild(itemDiv);
  });
  console.log("Lista de sessões renderizada.");
}

/**
 * Renderiza a lista de pendências do paciente.
 * Assume que estado.pacienteDataGlobal, estado.userDataGlobal e estado.sessoesCarregadas estão populados.
 */
export function renderizarPendencias() {
  const listEl = document.getElementById("pendencias-list");
  const loadingEl = document.getElementById("pendencias-loading");
  const placeholderEl = document.getElementById("pendencias-placeholder");
  const badgeEl = document.getElementById("pendencias-count-badge");

  if (!listEl || !loadingEl || !placeholderEl || !badgeEl) {
    console.error(
      "Elementos da seção de pendências não encontrados para renderização."
    );
    return;
  } // Reset UI

  listEl.innerHTML = "";
  loadingEl.style.display = "none"; // Esconde loading por padrão
  placeholderEl.style.display = "none";
  badgeEl.style.display = "none";
  badgeEl.textContent = "0";

  const pendencias = [];
  const paciente = estado.pacienteDataGlobal;
  const user = estado.userDataGlobal;
  const sessoes = estado.sessoesCarregadas;

  try {
    if (!paciente || !user) {
      throw new Error(
        "Dados do paciente ou do usuário não disponíveis para verificar pendências."
      );
    } // 1. Verificar Contrato PB

    const meuAtendimentoPB = paciente.atendimentosPB?.find(
      (at) =>
        at.profissionalId === user.uid &&
        ["ativo", "aguardando_horarios", "horarios_informados"].includes(
          at.statusAtendimento
        )
    );
    if (meuAtendimentoPB && !meuAtendimentoPB.contratoAssinado) {
      pendencias.push({
        texto: "⚠️ Falta assinar/enviar o contrato de Psicoterapia Breve.",
        tipo: "warning",
      });
    } // 2. Verificar Aniversário

    if (paciente.dataNascimento) {
      try {
        const hoje = new Date();
        const [anoNasc, mesNasc, diaNasc] = paciente.dataNascimento
          .split("T")[0]
          .split("-")
          .map(Number);
        if (diaNasc && mesNasc && anoNasc) {
          // Validação básica
          const mesNascIndex = mesNasc - 1; // Mês é 0-indexed
          const anoAtual = hoje.getFullYear();

          for (let anoOffset = 0; anoOffset <= 1; anoOffset++) {
            // Checa ano atual e próximo
            const anoChecagem = anoAtual + anoOffset;
            const proximoAniversario = new Date(
              Date.UTC(anoChecagem, mesNascIndex, diaNasc)
            ); // Use UTC para evitar problemas de fuso

            // Ignora aniversários passados no ano corrente
            if (anoChecagem === anoAtual && proximoAniversario < hoje) continue;

            // Calcula diferença em dias (considerando apenas a data)
            const hojeMeiaNoite = new Date(
              Date.UTC(
                hoje.getUTCFullYear(),
                hoje.getUTCMonth(),
                hoje.getUTCDate()
              )
            );
            const diffTempo =
              proximoAniversario.getTime() - hojeMeiaNoite.getTime();
            const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

            if (diffDias >= 0 && diffDias <= 7) {
              const dataFormatada = `${String(diaNasc).padStart(
                2,
                "0"
              )}/${String(mesNasc).padStart(2, "0")}`;
              const texto =
                diffDias === 0
                  ? `🎂 Aniversário HOJE (${dataFormatada})!`
                  : `🎂 Aniversário próximo: ${dataFormatada} (em ${diffDias} dias).`;
              pendencias.push({ texto: texto, tipo: "info" });
              break; // Sai do loop de anos se encontrar
            }
          }
        }
      } catch (e) {
        console.warn(
          "Erro ao verificar aniversário:",
          e,
          "Data Nasc:",
          paciente.dataNascimento
        );
      }
    } // 3. Verificar Sessões Pendentes (Usa estado.sessoesCarregadas)

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera hora para comparar só data
    const dataLimitePassado = new Date(
      hoje.getTime() - 30 * 24 * 60 * 60 * 1000
    ); // 30 dias atrás

    sessoes.forEach((sessao) => {
      const dataHoraSessao = sessao.dataHora?.toDate
        ? sessao.dataHora.toDate()
        : null;
      if (!dataHoraSessao) return;

      const dataSessao = new Date(dataHoraSessao);
      dataSessao.setHours(0, 0, 0, 0); // Zera hora para comparar só data

      // Verifica se a sessão ocorreu entre 30 dias atrás e ontem
      if (dataSessao < hoje && dataSessao >= dataLimitePassado) {
        const dataFormatada = dataHoraSessao.toLocaleDateString("pt-BR"); // Pendência de Presença/Ausência
        if (sessao.status === "pendente") {
          pendencias.push({
            texto: `🚨 Sessão de ${dataFormatada} sem registro de presença/ausência.`,
            tipo: "error",
          });
        } // Pendência de Anotações (Ficha de Evolução)
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
    }); // --- Renderizar Pendências ---

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
      placeholderEl.style.display = "block"; // Mostra placeholder se não houver pendências
    }
  } catch (error) {
    console.error("Erro ao verificar/renderizar pendências:", error);
    listEl.innerHTML = `<li class="pendencia-item error">Erro ao carregar pendências: ${error.message}</li>`;
  }
}

// --- Funções Auxiliares de UI (Acordeão, Dropdown, Tabs) ---

export function handleAccordionToggle(accordionItem) {
  if (!accordionItem) return;
  const isOpen = accordionItem.classList.contains("open");
  const container = accordionItem.closest(".accordion-container"); // Fecha outros itens no mesmo acordeão

  if (container) {
    container.querySelectorAll(".accordion-item.open").forEach((item) => {
      if (item !== accordionItem) {
        item.classList.remove("open");
        const icon = item.querySelector(".accordion-icon");
        if (icon) icon.innerHTML = "&#9654;"; // Seta para direita
      }
    });
  } // Alterna o item clicado

  accordionItem.classList.toggle("open");
  const icon = accordionItem.querySelector(".accordion-icon");
  if (icon) {
    icon.innerHTML = accordionItem.classList.contains("open")
      ? "&#9660;"
      : "&#9654;"; // Seta para baixo ou direita
  }
}

export function toggleDropdown(dropdownContainer) {
  if (!dropdownContainer) return; // Fecha outros dropdowns abertos antes de abrir/fechar o atual
  document
    .querySelectorAll(".dropdown-container.active")
    .forEach((otherContainer) => {
      if (otherContainer !== dropdownContainer) {
        otherContainer.classList.remove("active");
      }
    });
  dropdownContainer.classList.toggle("active");
}

export function togglePacienteActionsMenu(menuContainer) {
  if (!menuContainer) return;
  // Similar ao toggleDropdown, fecha outros menus/dropdowns ativos
  document
    .querySelectorAll(
      ".dropdown-container.active, .action-buttons-container.main-actions.active"
    )
    .forEach((container) => {
      if (container !== menuContainer) {
        container.classList.remove("active");
      }
    });
  menuContainer.classList.toggle("active");
}

export function closeDropdownOnClickOutside(event) {
  // Fecha dropdowns genéricos E o menu de ações do paciente
  document
    .querySelectorAll(
      ".dropdown-container.active, .action-buttons-container.main-actions.active"
    )
    .forEach((container) => {
      if (!container.contains(event.target)) {
        container.classList.remove("active");
      }
    });
}

export function handleTabClick(event) {
  const clickedTab = event.currentTarget;
  const targetTabId = clickedTab.dataset.tab;
  const targetContent = document.getElementById(targetTabId);
  const parentTabsContainer = clickedTab.closest(".tabs-container");

  if (!parentTabsContainer || !targetContent) {
    console.warn(
      "Tab ou conteúdo não encontrado para handleTabClick",
      clickedTab
    );
    return;
  } // Desativa a aba ativa anterior DENTRO do mesmo container de abas

  parentTabsContainer
    .querySelectorAll(".tab-link.active")
    .forEach((tab) => tab.classList.remove("active")); // Encontra o container de conteúdo associado

  let contentContainer = null;
  if (parentTabsContainer.id === "anotacoes-tabs-nav") {
    // Específico do modal de anotações
    contentContainer = document.getElementById("anotacoes-tabs-content");
  } else if (parentTabsContainer.classList.contains("vertical-tabs")) {
    // Abas verticais principais
    // Assume que o container de conteúdo é o próximo irmão do container das abas
    contentContainer = parentTabsContainer
      .closest(".detalhe-paciente-tabs-container")
      ?.querySelector(".detalhe-paciente-content-column");
  } else {
    // Tenta encontrar um container de conteúdo genérico associado (pode variar)
    contentContainer = parentTabsContainer.nextElementSibling; // Suposição comum
  } // Esconde o conteúdo ativo anterior DENTRO do container de conteúdo encontrado

  if (contentContainer) {
    contentContainer
      .querySelectorAll(".tab-content.active")
      .forEach((content) => content.classList.remove("active"));
  } else {
    // Fallback: Tenta esconder todos na página (menos ideal, mas funcional)
    // Para maior precisão, o ideal é que cada grupo de tabs tenha um container pai claro
    document
      .querySelectorAll(".tab-content.active")
      .forEach((content) => content.classList.remove("active"));
  } // Ativa a nova aba e o novo conteúdo

  clickedTab.classList.add("active");
  targetContent.classList.add("active");
}
