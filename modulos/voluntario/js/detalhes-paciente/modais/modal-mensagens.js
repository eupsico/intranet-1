// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-mensagens.js
// Lógica para o modal de seleção e envio de mensagens via WhatsApp.

import * as estado from "../estado.js"; // Acesso ao estado global (paciente, user, configs)
import { formatarDataParaTexto } from "../utilitarios.js"; // Função utilitária

// --- Variáveis Internas do Módulo ---
// (Não precisam ser exportadas, pois são usadas apenas pelas funções deste módulo)
let dadosParaMensagem = {}; // Armazena dados contextuais ao abrir o modal
let templateOriginal = ""; // Armazena o template selecionado antes das substituições

// --- Funções Exportadas ---

/**
 * Abre o modal para seleção de modelos de mensagem.
 */
export function abrirModalMensagens() {
  // Verifica se os dados necessários do estado global estão carregados
  if (
    !estado.pacienteDataGlobal ||
    !estado.userDataGlobal ||
    !estado.systemConfigsGlobal
  ) {
    alert(
      "Dados necessários para abrir o modal de mensagens não estão carregados. Tente recarregar a página."
    );
    return;
  }

  const modal = document.getElementById("enviar-mensagem-modal");
  const nomePacienteSpan = document.getElementById(
    "mensagem-paciente-nome-selecao"
  );
  const listaModelos = document.getElementById("lista-modelos-mensagem");
  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");
  const btnWhatsapp = modal?.querySelector("#btn-gerar-enviar-whatsapp");
  const btnVoltar = document.getElementById("btn-voltar-selecao");

  if (
    !modal ||
    !nomePacienteSpan ||
    !listaModelos ||
    !selecaoView ||
    !formularioView ||
    !btnVoltar ||
    !btnWhatsapp
  ) {
    console.error(
      "Elementos internos do modal de mensagens não encontrados. Verifique o HTML."
    );
    alert("Erro ao abrir modal de mensagens: estrutura interna inválida.");
    return;
  } // Pega o atendimento ativo (PB ou Plantão) relevante para o usuário logado

  const atendimentoAtivo =
    estado.pacienteDataGlobal.atendimentosPB?.find(
      (at) =>
        at.profissionalId === estado.userDataGlobal.uid &&
        at.statusAtendimento === "ativo"
    ) ||
    (estado.pacienteDataGlobal.status === "em_atendimento_plantao"
      ? estado.pacienteDataGlobal.plantaoInfo // Assume que plantaoInfo contém a estrutura necessária
      : null); // Armazena os dados atuais para uso nas funções internas deste módulo

  dadosParaMensagem = {
    paciente: estado.pacienteDataGlobal,
    atendimento: atendimentoAtivo, // Pode ser null se não houver atendimento ativo relevante
    systemConfigs: estado.systemConfigsGlobal,
    userData: estado.userDataGlobal,
  }; // Reseta a UI do modal para a seleção

  nomePacienteSpan.textContent =
    estado.pacienteDataGlobal.nomeCompleto || "Paciente";
  listaModelos.innerHTML = ""; // Limpa lista antiga
  selecaoView.style.display = "block";
  formularioView.style.display = "none";
  btnWhatsapp.style.display = "none";
  // Limpa preview anterior (importante ao reabrir)
  const previewTextarea = document.getElementById("output-mensagem-preview");
  if (previewTextarea) previewTextarea.value = ""; // Popula a lista de modelos disponíveis a partir das configurações do sistema

  const templates = estado.systemConfigsGlobal?.textos || {};
  const chavesTemplates = Object.keys(templates).filter((key) =>
    key.startsWith("msg_")
  ); // Filtra chaves que começam com 'msg_' (convenção)

  if (chavesTemplates.length === 0) {
    listaModelos.innerHTML =
      '<li class="info-note">Nenhum modelo de mensagem configurado no sistema (com prefixo "msg_").</li>';
  } else {
    chavesTemplates.forEach((key) => {
      // Formata a chave para um título legível
      const title = key
        .replace(/^msg_/, "") // Remove o prefixo
        .replace(/([A-Z])/g, " $1") // Espaço antes de maiúsculas
        .replace(/_/g, " ") // Underscore para espaço
        .replace(/^./, (str) => str.toUpperCase()); // Capitaliza início

      const listItem = document.createElement("li"); // Usar <li> em vez de <button> direto pode ser melhor semanticamente
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-button secondary-button";
      button.textContent = title || key; // Usa título formatado ou a chave como fallback
      button.onclick = () => preencherFormularioMensagem(key, title || key); // Chama função interna
      listItem.appendChild(button);
      listaModelos.appendChild(listItem);
    });
  } // Configura o botão Voltar

  btnVoltar.onclick = () => {
    selecaoView.style.display = "block";
    formularioView.style.display = "none";
    btnWhatsapp.style.display = "none";
    if (previewTextarea) previewTextarea.value = ""; // Limpa preview ao voltar
  }; // Exibe o modal

  modal.style.display = "flex";
}

/**
 * Preenche a segunda view do modal (formulário) com base no template selecionado.
 * Cria campos dinâmicos para as variáveis encontradas no template.
 * (Função interna do módulo)
 * @param {string} templateKey - A chave do template nas configurações (ex: "msg_boasVindas").
 * @param {string} templateTitle - O título formatado do template.
 */
function preencherFormularioMensagem(templateKey, templateTitle) {
  // Pega dados armazenados ao abrir o modal
  const { systemConfigs, userData } = dadosParaMensagem;

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
    console.error(
      "Elementos da view de formulário de mensagem não encontrados."
    );
    alert("Erro ao tentar preencher o formulário de mensagem.");
    return;
  } // Atualiza título e limpa container de campos dinâmicos

  formTitle.textContent = templateTitle;
  formContainer.innerHTML = ""; // Armazena o template original selecionado na variável do módulo
  templateOriginal = systemConfigs?.textos?.[templateKey] || ""; // Encontra todas as variáveis no formato {variavel}

  const variaveis = templateOriginal.match(/{[a-zA-Z0-9_]+}/g) || [];
  const variaveisUnicas = [...new Set(variaveis)]; // Variáveis que são preenchidas automaticamente e não precisam de input

  const variaveisFixas = [
    "{p}",
    "{nomePaciente}",
    "{t}",
    "{saudacao}",
    "{contractUrl}",
  ];

  // Variável para rastrear se algum campo foi adicionado
  let camposAdicionados = false;

  variaveisUnicas.forEach((variavelPlaceholder) => {
    // Pula variáveis fixas
    if (variaveisFixas.includes(variavelPlaceholder)) return;

    camposAdicionados = true; // Marca que pelo menos um campo dinâmico foi encontrado
    const nomeVariavel = variavelPlaceholder.replace(/[{}]/g, ""); // Ex: "diaSemana"
    const labelText =
      nomeVariavel.charAt(0).toUpperCase() +
      nomeVariavel.slice(1).replace(/_/g, " "); // Formata para Label
    const inputId = `var-${nomeVariavel}`; // ID único para o input/select

    const formGroup = document.createElement("div");
    formGroup.className = "form-group";

    const label = document.createElement("label");
    label.htmlFor = inputId;

    let campoElemento; // Será <input> ou <select>
    let novoLabel = ""; // Texto específico do label // --- Lógica para criar campos específicos com base no nome da variável ---

    const nomeVariavelLower = nomeVariavel.toLowerCase();
    switch (nomeVariavelLower) {
      case "prof": // Mantido para compatibilidade, caso existam templates antigos
      case "profissao":
        novoLabel = "Selecione sua profissão:";
        campoElemento = document.createElement("select");
        campoElemento.innerHTML = '<option value="">Selecione...</option>';
        const profissoes = systemConfigs?.listas?.profissoes || [];
        profissoes.forEach(
          (prof) =>
            (campoElemento.innerHTML += `<option value="${prof}">${prof}</option>`)
        ); // Tenta pré-selecionar com base nos dados do usuário logado
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
        campoElemento.innerHTML = '<option value="">Selecione...</option>';
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
        novoLabel = "Informe a data (ex: Início da terapia):";
        campoElemento = document.createElement("input");
        campoElemento.type = "date";
        break;
      case "hora":
      case "horario":
        novoLabel = "Informe a hora da sessão (HH:MM):";
        campoElemento = document.createElement("input");
        campoElemento.type = "time";
        break;
      case "v":
      case "valor":
        novoLabel = "Preencha o valor da sessão (ex: R$ 100,00):";
        campoElemento = document.createElement("input");
        campoElemento.type = "text"; // Manter como texto para aceitar R$ e vírgula/ponto
        campoElemento.placeholder = "Ex: R$ 100,00";
        break;
      case "px":
      case "pix":
        novoLabel = "Informe sua chave PIX:";
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
        campoElemento.placeholder = "Chave PIX (CPF, e-mail, telefone...)";
        break;
      case "m":
      case "mes": // Adicionando alias mais claro
        novoLabel = "Informe o Mês de referência (ex: Janeiro):";
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
        campoElemento.placeholder = "Nome do mês";
        break;
      case "d":
      case "diavencimento": // Alias mais claro
        novoLabel = "Informe o Dia do vencimento (ex: 10):";
        campoElemento = document.createElement("input");
        campoElemento.type = "number"; // Usar number para facilitar
        campoElemento.min = "1";
        campoElemento.max = "31";
        campoElemento.placeholder = "DD";
        break;
      default: // Caso genérico para variáveis não mapeadas
        novoLabel = `Preencha o campo "${labelText}":`;
        campoElemento = document.createElement("input");
        campoElemento.type = "text";
    } // Define atributos comuns

    label.textContent = novoLabel || `Preencha "${labelText}":`; // Usa label específico ou genérico
    campoElemento.className = "form-control dynamic-var"; // Classe para identificar e estilizar
    campoElemento.id = inputId;
    campoElemento.dataset.variavel = variavelPlaceholder; // Guarda o placeholder original ({variavel})
    campoElemento.required = true; // Torna todos os campos dinâmicos obrigatórios por padrão // Adiciona listener para atualizar o preview em tempo real

    campoElemento.addEventListener("input", atualizarPreviewMensagem); // Chama função interna

    // Adiciona ao DOM
    formGroup.appendChild(label);
    formGroup.appendChild(campoElemento);
    formContainer.appendChild(formGroup);
  });

  // Se nenhum campo dinâmico foi adicionado, exibe uma mensagem
  if (!camposAdicionados) {
    const info = document.createElement("p");
    info.className = "info-note";
    info.textContent = "Este modelo não requer informações adicionais.";
    formContainer.appendChild(info);
  } // Atualiza o preview inicial com as variáveis fixas e placeholders

  atualizarPreviewMensagem(); // Muda a visualização do modal

  selecaoView.style.display = "none";
  formularioView.style.display = "block";
  btnWhatsapp.style.display = "inline-block"; // Mostra o botão de enviar
}

/**
 * Atualiza o textarea de preview da mensagem com base nos valores dos campos.
 * Substitui as variáveis fixas e as dinâmicas (dos inputs/selects).
 * (Função interna do módulo)
 */
function atualizarPreviewMensagem() {
  // Pega dados armazenados
  const { paciente, atendimento, userData } = dadosParaMensagem;
  const previewTextarea = document.getElementById("output-mensagem-preview");

  if (!previewTextarea) {
    console.error(
      "Textarea de preview da mensagem não encontrado (#output-mensagem-preview)."
    );
    return;
  }

  let mensagemAtualizada = templateOriginal; // Começa com o template original // --- Substituição das Variáveis Fixas ---

  const nomePaciente = paciente?.nomeCompleto || "[Nome Paciente]";
  const nomeTerapeuta = userData?.nome || "[Nome Terapeuta]"; // Define uma saudação padrão (poderia ser baseada na hora do dia)
  const saudacao = "Olá";

  mensagemAtualizada = mensagemAtualizada
    .replace(/{p}|{nomePaciente}/g, nomePaciente) // Substitui {p} e {nomePaciente}
    .replace(/{t}/g, nomeTerapeuta) // Substitui {t} (terapeuta)
    .replace(/{saudacao}/g, saudacao); // Substitui {saudacao} // Lógica para substituir {contractUrl} (Link do Contrato)

  if (templateOriginal.includes("{contractUrl}")) {
    let contractUrl = "[Link do Contrato Indisponível]"; // Valor padrão // Verifica se temos paciente, atendimento e IDs necessários
    if (paciente?.id && atendimento?.atendimentoId) {
      // Constrói a URL - **IMPORTANTE: Verifique se este caminho está correto**
      contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${paciente.id}&atendimentoId=${atendimento.atendimentoId}`;
    } else {
      console.warn(
        "Não foi possível gerar link do contrato: ID do paciente ou atendimento ausente.",
        paciente?.id,
        atendimento?.atendimentoId
      );
    }
    mensagemAtualizada = mensagemAtualizada.replace(
      /{contractUrl}/g,
      contractUrl
    );
  } // --- Substituição das Variáveis Dinâmicas (dos campos) ---

  const inputsDinamicos = document.querySelectorAll(
    "#mensagem-dynamic-form-container .dynamic-var"
  );
  inputsDinamicos.forEach((input) => {
    const placeholder = input.dataset.variavel; // Pega o placeholder original ({variavel})
    let valor = input.value; // Formata a data se for do tipo date

    if (input.type === "date" && valor) {
      valor = formatarDataParaTexto(valor); // Usa a função utilitária
    }

    // Cria Regex para substituir *todas* as ocorrências do placeholder
    // Escapa caracteres especiais no placeholder para segurança na Regex
    const placeholderRegex = new RegExp(
      placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g"
    ); // Substitui o placeholder pelo valor do campo, ou mantém o placeholder se vazio

    mensagemAtualizada = mensagemAtualizada.replace(
      placeholderRegex,
      valor || placeholder
    );
  }); // Atualiza o valor do textarea

  previewTextarea.value = mensagemAtualizada;
}

/**
 * Handler para o botão "Gerar Link e Enviar WhatsApp".
 * Abre o link `wa.me` em uma nova aba.
 */
export function handleMensagemSubmit() {
  const { paciente } = dadosParaMensagem; // Pega dados armazenados
  const previewTextarea = document.getElementById("output-mensagem-preview");
  const mensagem = previewTextarea?.value || "";
  const modal = document.getElementById("enviar-mensagem-modal"); // Valida telefone e mensagem

  const telefone = paciente?.telefoneCelular?.replace(/\D/g, ""); // Limpa formatação do telefone

  if (!telefone) {
    alert(
      "Não foi possível gerar o link: O paciente não possui um número de telefone celular cadastrado."
    );
    return;
  }
  if (!mensagem) {
    alert("Não foi possível gerar o link: A mensagem está vazia.");
    return;
  }
  // Verifica se ainda existem placeholders não preenchidos na mensagem final
  if (/{[a-zA-Z0-9_]+}/.test(mensagem)) {
    alert(
      "Atenção: A mensagem ainda contém variáveis não preenchidas (ex: {variavel}). Por favor, preencha todos os campos obrigatórios."
    );
    return; // Impede o envio se houver placeholders
  } // Monta a URL do WhatsApp

  const whatsappUrl = `https://wa.me/55${telefone}?text=${encodeURIComponent(
    mensagem
  )}`; // Abre em nova aba

  window.open(whatsappUrl, "_blank"); // Fecha o modal após gerar o link (opcional, mas comum)

  if (modal) {
    modal.style.display = "none";
  }
}
