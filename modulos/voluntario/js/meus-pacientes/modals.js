// Arquivo: /modulos/voluntario/js/meus-pacientes/modals.js

import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  httpsCallable,
  functions,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from "../../../../assets/js/firebase-init.js";

// --- Lógica do Modal de Mensagens (Aprimorada) ---

let dadosParaMensagem = {};
let templateOriginal = "";

export function abrirModalMensagens(
  paciente,
  atendimento,
  { systemConfigs, userData }
) {
  const modal = document.getElementById("enviar-mensagem-modal");
  const nomePacienteSpan = document.getElementById(
    "mensagem-paciente-nome-selecao"
  );
  const listaModelos = document.getElementById("lista-modelos-mensagem");
  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");

  const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");

  dadosParaMensagem = { paciente, atendimento, systemConfigs, userData };
  nomePacienteSpan.textContent = paciente.nomeCompleto;
  listaModelos.innerHTML = "";
  selecaoView.style.display = "block";
  formularioView.style.display = "none";

  if (btnWhatsapp) {
    btnWhatsapp.style.display = "none";
  }

  const templates = systemConfigs?.textos || {};
  if (Object.keys(templates).length === 0) {
    listaModelos.innerHTML = "<p>Nenhum modelo de mensagem configurado.</p>";
  } else {
    for (const key in templates) {
      const title = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      const btn = document.createElement("button");
      btn.className = "action-button secondary-button";
      btn.textContent = title;
      btn.onclick = () => preencherFormularioMensagem(key, title);
      listaModelos.appendChild(btn);
    }
  }
  modal.style.display = "flex";

  document.getElementById("btn-voltar-selecao").onclick = () => {
    selecaoView.style.display = "block";
    formularioView.style.display = "none";
    if (btnWhatsapp) {
      btnWhatsapp.style.display = "none";
    }
  };
}

function preencherFormularioMensagem(templateKey, templateTitle) {
  const { systemConfigs, userData } = dadosParaMensagem;

  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");
  const formTitle = document.getElementById("mensagem-form-title");
  const formContainer = document.getElementById(
    "mensagem-dynamic-form-container"
  );

  const modal = document.getElementById("enviar-mensagem-modal");
  const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");

  formTitle.textContent = templateTitle;
  formContainer.innerHTML = "";
  templateOriginal = systemConfigs.textos[templateKey] || "";

  const variaveis = templateOriginal.match(/{[a-zA-Z0-9_]+}/g) || [];
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
    let campoElemento;

    switch (nomeVariavelLower) {
      case "prof":
      case "profissao":
        novoLabel = "Selecione sua profissão:";
        campoElemento = document.createElement("select");
        campoElemento.innerHTML = "<option value=''>Selecione...</option>";
        const profissoes = systemConfigs?.listas?.profissoes || [];
        profissoes.forEach((prof) => {
          campoElemento.innerHTML += `<option value="${prof}">${prof}</option>`;
        });
        if (userData.profissao) {
          campoElemento.value = userData.profissao;
        }
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
        dias.forEach((dia) => {
          campoElemento.innerHTML += `<option value="${dia}">${dia}</option>`;
        });
        break;
      case "mod":
      case "modalidade":
        novoLabel = "Selecione a modalidade:";
        campoElemento = document.createElement("select");
        campoElemento.innerHTML = "<option value=''>Selecione...</option>";
        campoElemento.innerHTML +=
          "<option value='Presencial'>Presencial</option>";
        campoElemento.innerHTML += "<option value='Online'>Online</option>";
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
        campoElemento.type = "text";
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
    campoElemento.oninput = () => atualizarPreviewMensagem();

    formGroup.appendChild(label);
    formGroup.appendChild(campoElemento);
    formContainer.appendChild(formGroup);
  });

  atualizarPreviewMensagem();

  selecaoView.style.display = "none";
  formularioView.style.display = "block";

  if (btnWhatsapp) {
    btnWhatsapp.style.display = "inline-block";
  }
}

function formatarData(dataString) {
  if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString;
  }
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizarPreviewMensagem() {
  const { paciente, atendimento, userData } = dadosParaMensagem;
  const previewTextarea = document.getElementById("output-mensagem-preview");
  let mensagemAtualizada = templateOriginal;

  mensagemAtualizada = mensagemAtualizada
    .replace(/{p}/g, paciente.nomeCompleto)
    .replace(/{nomePaciente}/g, paciente.nomeCompleto)
    .replace(/{t}/g, userData.nome)
    .replace(/{saudacao}/g, "Olá");

  if (templateOriginal.includes("{contractUrl}") && atendimento) {
    const contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${paciente.id}&atendimentoId=${atendimento.atendimentoId}`;
    mensagemAtualizada = mensagemAtualizada.replace(
      /{contractUrl}/g,
      contractUrl
    );
  }

  const inputs = document.querySelectorAll(".dynamic-var");
  inputs.forEach((input) => {
    const placeholder = input.dataset.variavel;
    let valor = input.value;
    if (input.type === "date") {
      valor = formatarData(valor);
    }
    mensagemAtualizada = mensagemAtualizada.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      valor || placeholder
    );
  });

  previewTextarea.value = mensagemAtualizada;
}

export function handleMensagemSubmit() {
  const { paciente } = dadosParaMensagem;
  const telefone = paciente.telefoneCelular?.replace(/\D/g, "");
  const mensagem = document.getElementById("output-mensagem-preview").value;
  const modal = document.getElementById("enviar-mensagem-modal");

  if (telefone && mensagem && !mensagem.includes("{")) {
    window.open(
      `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
    modal.style.display = "none";
  } else {
    alert(
      "Não foi possível gerar o link. Verifique se todos os campos foram preenchidos e se o paciente possui um telefone válido."
    );
  }
}

// --- Lógica do Modal de Solicitar Novas Sessões ---

export function abrirModalSolicitarSessoes(
  paciente,
  atendimento,
  { userData, salasPresenciais, dadosDaGrade }
) {
  const modal = document.getElementById("solicitar-sessoes-modal");
  modal.style.display = "flex";
  const form = document.getElementById("solicitar-sessoes-form");
  form.reset();
  form.classList.remove("was-validated");

  document.getElementById("solicitar-profissional-nome").value = userData.nome;
  document.getElementById("solicitar-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("solicitar-paciente-id").value = paciente.id;
  document.getElementById("solicitar-atendimento-id").value =
    atendimento?.atendimentoId || "";

  const horarioSelect = document.getElementById("solicitar-horario");
  horarioSelect.innerHTML = "";
  for (let i = 7; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horarioSelect.innerHTML += `<option value="${i}">${hora}</option>`; // Usa i como value
  }

  const salaSelect = document.getElementById("solicitar-sala");
  salaSelect.innerHTML = '<option value="Online">Online</option>';
  if (salasPresenciais) {
    salasPresenciais.forEach((sala) => {
      salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
    });
  }

  const fieldsToWatch = [
    "solicitar-dia-semana",
    "solicitar-horario",
    "solicitar-tipo-atendimento",
    "solicitar-sala",
  ];
  fieldsToWatch.forEach(
    (id) =>
      (document.getElementById(id).onchange = () =>
        validarHorarioNaGrade(dadosDaGrade, salasPresenciais))
  );

  const tipoAtendimentoSelect = document.getElementById(
    "solicitar-tipo-atendimento"
  );
  tipoAtendimentoSelect.onchange = () => {
    const tipo = tipoAtendimentoSelect.value;
    const salaSelectEl = document.getElementById("solicitar-sala");
    salaSelectEl.disabled = tipo === "online";
    if (tipo === "online") salaSelectEl.value = "Online";
    validarHorarioNaGrade(dadosDaGrade, salasPresenciais);
  };
  tipoAtendimentoSelect.dispatchEvent(new Event("change"));
}

export function handleSolicitarSessoesSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("solicitar-sessoes-form");
  const modal = document.getElementById("solicitar-sessoes-modal");

  if (form.checkValidity() === false) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    form.classList.add("was-validated");
    return;
  }

  alert(
    "Sua solicitação de novo horário foi enviada ao administrativo para cadastro na grade."
  );
  modal.style.display = "none";
}

function validarHorarioNaGrade(dadosDaGrade, salasPresenciais) {
  const dia = document.getElementById("solicitar-dia-semana").value;
  const horario = document.getElementById("solicitar-horario").value; // Value é a hora (7, 8, ...)
  const tipo = document.getElementById("solicitar-tipo-atendimento").value;
  const sala = document.getElementById("solicitar-sala").value;
  const feedbackDiv = document.getElementById("validacao-grade-feedback");

  const horaKey = `${String(horario).padStart(2, "0")}-00`;
  let isOcupado = false;

  if (tipo === "online") {
    for (let i = 0; i < 6; i++) {
      if (dadosDaGrade?.online?.[dia]?.[horaKey]?.[`col${i}`]) {
        isOcupado = true;
        break;
      }
    }
  } else {
    const salaIndex = salasPresenciais?.indexOf(sala);
    if (
      salaIndex !== -1 &&
      dadosDaGrade?.presencial?.[dia]?.[horaKey]?.[`col${salaIndex}`]
    ) {
      isOcupado = true;
    }
  }

  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "info-note exists";
    feedbackDiv.innerHTML =
      "<strong>Atenção:</strong> Este horário já está preenchido na grade. <br>De qualquer forma, sua solicitação será enviada para o administrativo cadastrar o horário.";
  } else {
    feedbackDiv.className = "info-note success";
    feedbackDiv.innerHTML =
      "<strong>Disponível:</strong> O horário selecionado está livre na grade e será enviado para cadastro pelo administrativo.";
  }
}

// --- INÍCIO DA LÓGICA DO NOVO MODAL ---

export function abrirModalAlterarHorario(
  paciente,
  atendimento,
  { userData, salasPresenciais }
) {
  const modal = document.getElementById("alterar-horario-modal");
  const form = document.getElementById("alterar-horario-form");
  form.reset(); // Limpa o formulário

  // Preenche dados fixos
  document.getElementById("alterar-paciente-id").value = paciente.id;
  document.getElementById("alterar-atendimento-id").value =
    atendimento.atendimentoId;
  document.getElementById("alterar-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("alterar-profissional-nome").value = userData.nome;

  // Preenche dados atuais (se existirem)
  const horarioAtual = atendimento?.horarioSessao || {};
  document.getElementById("alterar-dia-atual").value =
    horarioAtual.diaSemana || "N/A";
  document.getElementById("alterar-horario-atual").value =
    horarioAtual.horario || "N/A";
  document.getElementById("alterar-modalidade-atual").value =
    horarioAtual.tipoAtendimento || "N/A";

  // Preenche select de Horário (08:00 às 21:00)
  const horarioSelect = document.getElementById("alterar-horario");
  horarioSelect.innerHTML = "<option value=''>Selecione...</option>"; // Adiciona a opção padrão
  for (let i = 8; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
  }

  // Preenche select de Salas
  const salaSelect = document.getElementById("alterar-sala");
  salaSelect.innerHTML = '<option value="Online">Online</option>'; // Online sempre disponível
  if (salasPresenciais && Array.isArray(salasPresenciais)) {
    salasPresenciais.forEach((sala) => {
      if (sala && sala.trim() !== "") {
        // Garante que não adicione opções vazias
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // Lógica para habilitar/desabilitar Sala baseado na Modalidade
  const tipoAtendimentoSelect = document.getElementById(
    "alterar-tipo-atendimento"
  );
  tipoAtendimentoSelect.onchange = () => {
    const tipo = tipoAtendimentoSelect.value;
    salaSelect.disabled = tipo === "Online";
    if (tipo === "Online") {
      salaSelect.value = "Online";
    } else {
      // Se tiver salas presenciais, seleciona a primeira por padrão, senão deixa vazio
      if (salasPresenciais && salasPresenciais.length > 0) {
        salaSelect.value = salasPresenciais[0]; // Ou pode deixar como ""
      } else {
        salaSelect.value = ""; // Nenhuma sala presencial disponível
      }
    }
  };
  // Dispara o evento change inicial para configurar a sala corretamente
  tipoAtendimentoSelect.dispatchEvent(new Event("change"));

  modal.style.display = "flex"; // Mostra o modal
}

// Função para lidar com o submit do formulário de alteração
export function handleAlterarHorarioSubmit(evento) {
  evento.preventDefault(); // Impede o envio padrão do formulário
  const form = document.getElementById("alterar-horario-form");
  const modal = document.getElementById("alterar-horario-modal");

  // Validação simples (pode ser aprimorada)
  if (!form.checkValidity()) {
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para a nova configuração."
    );
    // Adicionar classe para destacar campos inválidos (se usar validação HTML5)
    form.classList.add("was-validated");
    return;
  }

  // Coleta os dados (exemplo)
  const dados = {
    pacienteId: document.getElementById("alterar-paciente-id").value,
    atendimentoId: document.getElementById("alterar-atendimento-id").value,
    novoDia: document.getElementById("alterar-dia-semana").value,
    novoHorario: document.getElementById("alterar-horario").value,
    novaModalidade: document.getElementById("alterar-tipo-atendimento").value,
    novaFrequencia: document.getElementById("alterar-frequencia").value,
    dataInicioAlteracao: document.getElementById("alterar-data-inicio").value,
    novaSala: document.getElementById("alterar-sala").value,
    alterarGrade: document.getElementById("alterar-grade").value,
    justificativa: document.getElementById("alterar-justificativa").value,
  };

  console.log("Dados da solicitação de alteração:", dados); // Para depuração

  // Aqui você adicionaria a lógica para enviar os dados
  // Ex: chamar uma função Cloud, atualizar Firestore, etc.
  // Por enquanto, apenas exibimos um alerta e fechamos o modal.

  alert("Solicitação de alteração enviada para o administrativo!");
  modal.style.display = "none"; // Esconde o modal
  form.reset(); // Limpa o formulário
  form.classList.remove("was-validated"); // Remove a classe de validação
}

// Variável para guardar a configuração da agenda de reavaliação e dados do paciente/usuário
let currentReavaliacaoConfig = {};

/**
 * Abre o modal de solicitação de reavaliação.
 * Verifica se existe agenda configurada para "reavaliação".
 */
export async function abrirModalReavaliacao(
  paciente,
  atendimento,
  { user, userData, systemConfigs }
) {
  const modal = document.getElementById("reavaliacao-modal");
  const form = document.getElementById("reavaliacao-form");
  const msgSemAgenda = document.getElementById("reavaliacao-sem-agenda");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  const tipoAtendimentoGroup = document.getElementById(
    "reavaliacao-tipo-atendimento-group"
  );
  const tipoAtendimentoSelect = document.getElementById(
    "reavaliacao-tipo-atendimento"
  );

  // ***** NOVOS SELETORES *****
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  const dataSelecionadaInput = document.getElementById(
    "reavaliacao-data-selecionada"
  );
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  // Resetar o estado do modal
  form.reset();
  msgSemAgenda.style.display = "none";
  form.style.display = "none";
  btnConfirmar.style.display = "none";

  // ***** RESET MODIFICADO *****
  datasContainer.innerHTML =
    "<p>Selecione uma modalidade para ver as datas.</p>";
  horariosContainer.innerHTML =
    "<p>Selecione uma data para ver os horários.</p>";
  dataSelecionadaInput.value = "";
  // ***** FIM DO RESET MODIFICADO *****

  // Preencher dados fixos do formulário
  document.getElementById("reavaliacao-paciente-id").value = paciente.id;
  document.getElementById("reavaliacao-profissional-nome").value =
    userData.nome;
  document.getElementById("reavaliacao-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("reavaliacao-valor-atual").value =
    paciente.valorContribuicao || ""; // Deixa em branco se não houver

  modal.style.display = "flex";

  try {
    // 1. Verificar se há agenda configurada para "reavaliação"

    // ***** LÓGICA DE BUSCA MODIFICADA *****
    // Busca todas as agendas de reavaliação futuras
    const hoje = new Date().toISOString().split("T")[0];
    const agendaQuery = query(
      collection(db, "agendaConfigurada"),
      where("tipo", "==", "reavaliacao"),
      where("data", ">=", hoje) // Busca apenas de hoje em diante
    );
    // ***** FIM DA LÓGICA DE BUSCA *****

    const agendaSnapshot = await getDocs(agendaQuery);

    if (agendaSnapshot.empty) {
      // 2. Se não houver agenda, mostrar mensagem de erro
      msgSemAgenda.style.display = "block";
      return;
    }

    // 3. Se houver agenda, mostrar formulário
    form.style.display = "block";
    btnConfirmar.style.display = "block";

    let agendasConfig = [];
    agendaSnapshot.forEach((doc) =>
      agendasConfig.push({ id: doc.id, ...doc.data() })
    );

    // Salva as configurações para usar no submit e no carregamento de horários
    currentReavaliacaoConfig = {
      agendas: agendasConfig,
      paciente: paciente,
      user: user,
      userData: userData,
    };

    // 4. Lógica da Modalidade (Tipo de Atendimento)
    const modalidades = [
      ...new Set(agendasConfig.map((a) => a.modalidade)),
    ].filter(Boolean);

    tipoAtendimentoSelect.innerHTML = "";
    if (modalidades.length > 1) {
      // Mais de uma modalidade (Online, Presencial)
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
      // Apenas uma modalidade
      tipoAtendimentoGroup.style.display = "none";
      tipoAtendimentoSelect.innerHTML = `<option value="${modalidades[0]}" selected>${modalidades[0]}</option>`;
      tipoAtendimentoSelect.required = false;
      // Se só tem uma modalidade, já carrega as datas
      renderizarDatasDisponiveis(modalidades[0]);
    } else {
      throw new Error(
        "Agenda de reavaliação configurada de forma inválida (sem modalidade)."
      );
    }

    // 5. Adicionar listeners
    tipoAtendimentoSelect.onchange = () => {
      // Limpa seleções anteriores
      horariosContainer.innerHTML =
        "<p>Selecione uma data para ver os horários.</p>";
      dataSelecionadaInput.value = "";
      // Renderiza as novas datas
      renderizarDatasDisponiveis(tipoAtendimentoSelect.value);
    };

    // Listener para seleção de DATA
    datasContainer.onclick = (e) => {
      const target = e.target.closest(".slot-time");
      if (target && !target.disabled) {
        // Desmarca a data selecionada anteriormente
        const selecionadoAnterior = datasContainer.querySelector(
          ".slot-time.selected"
        );
        if (selecionadoAnterior) {
          selecionadoAnterior.classList.remove("selected");
        }
        // Marca a nova data
        target.classList.add("selected");
        dataSelecionadaInput.value = target.dataset.data; // Armazena AAAA-MM-DD

        // Carrega os horários para esta data
        carregarHorariosReavaliacao();
      }
    };

    // Listener para seleção de HORÁRIO
    horariosContainer.onclick = (e) => {
      const target = e.target.closest(".slot-time");
      if (target && !target.disabled) {
        const selecionadoAnterior = horariosContainer.querySelector(
          ".slot-time.selected"
        );
        if (selecionadoAnterior) {
          selecionadoAnterior.classList.remove("selected");
        }
        target.classList.add("selected");
      }
    };
  } catch (error) {
    console.error("Erro ao abrir modal de reavaliação:", error);
    msgSemAgenda.textContent =
      "Erro ao carregar a agenda de reavaliação. Tente novamente.";
    msgSemAgenda.style.display = "block";
  }
}

/**
 * NOVA FUNÇÃO
 * Renderiza os botões de DATA com base na modalidade selecionada.
 */
function renderizarDatasDisponiveis(modalidade) {
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  if (!modalidade) {
    datasContainer.innerHTML =
      "<p>Selecione uma modalidade para ver as datas.</p>";
    return;
  }

  const { agendas } = currentReavaliacaoConfig;

  // Filtra as agendas pela modalidade E agrupa por data (para remover duplicados)
  const datasDisponiveis = [
    ...new Set(
      agendas.filter((a) => a.modalidade === modalidade).map((a) => a.data)
    ),
  ];

  datasDisponiveis.sort(); // Ordena as datas

  if (datasDisponiveis.length === 0) {
    datasContainer.innerHTML =
      "<p>Nenhuma data disponível encontrada para esta modalidade.</p>";
    return;
  }

  // Formata as datas para exibição
  const datasHtml = datasDisponiveis
    .map((dataISO) => {
      const dataObj = new Date(dataISO + "T03:00:00"); // Ajuste de fuso
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
    })
    .join("");

  datasContainer.innerHTML = datasHtml;
}

/**
 * Carrega os horários disponíveis para reavaliação com base na data e modalidade.
 * (Similar ao `agendamento-triagem.js`)
 */
async function carregarHorariosReavaliacao() {
  // ***** LÓGICA MODIFICADA *****
  const modalidade = document.getElementById(
    "reavaliacao-tipo-atendimento"
  ).value;
  const dataISO = document.getElementById("reavaliacao-data-selecionada").value; // Pega do input oculto
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  if (!modalidade || !dataISO) {
    horariosContainer.innerHTML =
      "<p>Por favor, selecione a modalidade e a data.</p>";
    return;
  }
  // ***** FIM DA MODIFICAÇÃO *****

  horariosContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // 1. Encontrar as configurações de agenda para esta data/modalidade
    // (Pode haver múltiplas assistentes sociais com agenda no mesmo dia)
    const agendasDoDia = currentReavaliacaoConfig.agendas.filter(
      (a) => a.modalidade === modalidade && a.data === dataISO
    );

    if (agendasDoDia.length === 0) {
      throw new Error("Configuração de agenda não encontrada para esta data.");
    }

    // 2. Pegar todos os slots disponíveis de todas as assistentes para este dia/modalidade
    let slotsDoDia = new Set();
    agendasDoDia.forEach((agenda) => {
      // A 'agendaConfigurada' já deve ter os slots em 'dias'
      // Mas o modelo da imagem (image_3b810e.png) mostra 'inicio' e 'fim'
      // Vamos usar a lógica de 'inicio' e 'fim' como no agendamento-publico.js
      const [hInicio, mInicio] = agenda.inicio.split(":").map(Number);
      const [hFim, mFim] = agenda.fim.split(":").map(Number);
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
        "<p>Nenhum horário configurado para este dia da semana.</p>";
      return;
    }

    // 3. Buscar agendamentos existentes para cruzar dados
    const agendamentosQuery = query(
      collection(db, "agendamentos"),
      where("data", "==", dataISO),
      where("tipo", "==", "reavaliacao"),
      where("modalidade", "==", modalidade)
    );
    const agendamentosSnapshot = await getDocs(agendamentosQuery);
    const horariosOcupados = agendamentosSnapshot.docs.map(
      (doc) => doc.data().hora
    );

    // 4. Renderizar os slots
    let slotsHtml = "";
    slotsOrdenados.forEach((hora) => {
      if (horariosOcupados.includes(hora)) {
        slotsHtml += `<button type="button" class="slot-time disabled" disabled>${hora}</button>`;
      } else {
        slotsHtml += `<button type="button" class="slot-time" data-hora="${hora}">${hora}</button>`;
      }
    });

    horariosContainer.innerHTML =
      slotsHtml || "<p>Nenhum horário disponível neste dia.</p>";
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    horariosContainer.innerHTML =
      '<p class="info-note danger">Erro ao carregar horários. Tente novamente.</p>';
  }
}

/**
 * Lida com o submit do formulário de reavaliação.
 * Cria um novo documento na coleção "agendamentos".
 */

/**
 * Lida com o submit do formulário de reavaliação.
 * Cria um novo documento na coleção "agendamentos" E ATUALIZA O TRILHAPACIENTE.
 */
export async function handleReavaliacaoSubmit(evento) {
  evento.preventDefault();
  const modal = document.getElementById("reavaliacao-modal");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Salvando...";

  try {
    // 1. Coletar dados do formulário e da config
    const pacienteId = document.getElementById("reavaliacao-paciente-id").value;
    const profissionalNome = document.getElementById(
      "reavaliacao-profissional-nome"
    ).value;
    const pacienteNome = document.getElementById(
      "reavaliacao-paciente-nome"
    ).value;
    const valorAtual =
      document.getElementById("reavaliacao-valor-atual").value || "N/A";
    const motivo = document.getElementById("reavaliacao-motivo").value;
    const modalidade = document.getElementById(
      "reavaliacao-tipo-atendimento"
    ).value;
    const data = document.getElementById("reavaliacao-data-selecionada").value;
    const selectedSlot = document.querySelector(
      "#reavaliacao-horarios-disponiveis .slot-time.selected"
    );
    const hora = selectedSlot ? selectedSlot.dataset.hora : null;

    // 2. Validação
    if (!motivo || !modalidade || !data || !hora) {
      throw new Error(
        "Por favor, preencha o motivo, data e selecione um horário."
      );
    }

    const dataHoraSlot = new Date(`${data}T${hora}:00`);
    const hSlot = parseInt(hora.split(":")[0], 10);
    const mSlot = parseInt(hora.split(":")[1], 10);
    const minutoSlot = hSlot * 60 + mSlot;

    const agendaCorrespondente = currentReavaliacaoConfig.agendas.find((a) => {
      const [hInicio, mInicio] = a.inicio.split(":").map(Number);
      const [hFim, mFim] = a.fim.split(":").map(Number);
      const inicioEmMinutos = hInicio * 60 + mInicio;
      const fimEmMinutos = hFim * 60 + mFim;

      return (
        a.data === data &&
        a.modalidade === modalidade &&
        minutoSlot >= inicioEmMinutos &&
        minutoSlot < fimEmMinutos
      );
    });

    if (!agendaCorrespondente) {
      throw new Error(
        "Não foi possível encontrar uma assistente social disponível para este horário. A agenda pode ter sido atualizada. Tente selecionar novamente."
      );
    }

    // 3. Preparar objeto para salvar em "agendamentos"
    const agendamentoData = {
      pacienteId: pacienteId,
      pacienteNome: pacienteNome,
      profissionalId: currentReavaliacaoConfig.user.uid,
      profissionalNome: profissionalNome,
      data: data,
      hora: hora,
      modalidade: modalidade,
      tipo: "reavaliacao",
      status: "agendado",
      assistenteSocialId: agendaCorrespondente.assistenteId,
      assistenteSocialNome: agendaCorrespondente.assistenteNome,
      dataAgendamento: Timestamp.fromDate(dataHoraSlot),
      solicitacaoInfo: {
        valorContribuicaoAtual: valorAtual,
        motivoReavaliacao: motivo,
        solicitadoEm: serverTimestamp(),
      },
      criadoEm: serverTimestamp(),
      // --- INÍCIO DA ALTERAÇÃO ---
      // Guardar o status de origem do paciente
      statusOrigem: currentReavaliacaoConfig.paciente.status,
      // --- FIM DA ALTERAÇÃO ---
    };

    // 4. Salvar na coleção "agendamentos"
    await addDoc(collection(db, "agendamentos"), agendamentoData);

    // --- INÍCIO DA ALTERAÇÃO ---
    // 5. Atualizar o trilhaPaciente
    const pacienteRef = doc(db, "trilhaPaciente", pacienteId);
    await updateDoc(pacienteRef, {
      status: "aguardando_reavaliacao", // Novo status
      statusAnteriorReavaliacao: currentReavaliacaoConfig.paciente.status, // Guarda o status antigo
      lastUpdate: serverTimestamp(),
    });
    // --- FIM DA ALTERAÇÃO ---

    // 6. Sucesso
    alert(
      "Reavaliação agendada com sucesso! O paciente foi movido para a fila de reavaliação."
    );
    modal.style.display = "none";
    location.reload(); // Recarrega a página "Meus Pacientes" para refletir a mudança de status
  } catch (error) {
    console.error("Erro ao agendar reavaliação:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    // 7. Resetar botão
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Enviar Solicitação";
  }
}

// --- Lógica dos Modais Originais ---

export async function abrirModalEncerramento(pacienteId, dadosDoPaciente) {
  const modal = document.getElementById("encerramento-modal");
  const form = document.getElementById("encerramento-form");
  form.reset();
  document.getElementById("paciente-id-modal").value = pacienteId;
  document
    .getElementById("motivo-nao-pagamento-container")
    .classList.add("hidden");
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );
  novaDisponibilidadeContainer.classList.add("hidden");
  novaDisponibilidadeContainer.innerHTML = "";
  const disponibilidadeEspecifica =
    dadosDoPaciente.disponibilidadeEspecifica || [];
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
  document.getElementById("disponibilidade-atual").textContent =
    textoDisponibilidade;
  const pagamentoSelect = form.querySelector("#pagamento-contribuicao");
  pagamentoSelect.onchange = () => {
    document
      .getElementById("motivo-nao-pagamento-container")
      .classList.toggle("hidden", pagamentoSelect.value !== "nao");
    document.getElementById("motivo-nao-pagamento").required =
      pagamentoSelect.value === "nao";
  };
  const dispSelect = form.querySelector("#manter-disponibilidade");
  dispSelect.onchange = async () => {
    const mostrar = dispSelect.value === "nao";
    novaDisponibilidadeContainer.classList.toggle("hidden", !mostrar);
    if (mostrar && novaDisponibilidadeContainer.innerHTML.trim() === "") {
      novaDisponibilidadeContainer.innerHTML =
        '<div class="loading-spinner"></div>';
      try {
        const response = await fetch(
          "../../../public/fichas-de-inscricao.html"
        );
        const text = await response.text();
        const parser = new DOMParser();
        const docHtml = parser.parseFromString(text, "text/html");
        const disponibilidadeHtml = docHtml.getElementById(
          "disponibilidade-section"
        ).innerHTML;
        novaDisponibilidadeContainer.innerHTML = disponibilidadeHtml;
      } catch (error) {
        console.error("Erro ao carregar HTML da disponibilidade:", error);
        novaDisponibilidadeContainer.innerHTML =
          '<p class="alert alert-error">Erro ao carregar opções.</p>';
      }
    }
  };
  modal.style.display = "block";
}

export function abrirModalHorariosPb(pacienteId, atendimentoId, { userData }) {
  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");
  form.reset();
  form.querySelector("#paciente-id-horarios-modal").value = pacienteId;
  form.querySelector("#atendimento-id-horarios-modal").value = atendimentoId;
  const motivoContainer = document.getElementById(
    "motivo-nao-inicio-pb-container"
  );
  const continuacaoContainer = document.getElementById("form-continuacao-pb");
  const desistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  );
  const solicitacaoContainer = document.getElementById(
    "detalhar-solicitacao-container"
  );
  motivoContainer.classList.add("hidden");
  continuacaoContainer.classList.add("hidden");
  desistenciaContainer.classList.add("hidden");
  solicitacaoContainer.classList.add("hidden");
  continuacaoContainer.innerHTML = "";
  document.getElementById("motivo-desistencia-pb").required = false;
  document.getElementById("detalhes-solicitacao-pb").required = false;
  const iniciouRadio = form.querySelectorAll('input[name="iniciou-pb"]');
  iniciouRadio.forEach((radio) => {
    radio.onchange = () => {
      const mostrarFormulario = radio.value === "sim" && radio.checked;
      const mostrarMotivo = radio.value === "nao" && radio.checked;
      continuacaoContainer.classList.toggle("hidden", !mostrarFormulario);
      motivoContainer.classList.toggle("hidden", !mostrarMotivo);
      if (mostrarFormulario) {
        desistenciaContainer.classList.add("hidden");
        solicitacaoContainer.classList.add("hidden");
      }
      if (mostrarFormulario && continuacaoContainer.innerHTML === "") {
        continuacaoContainer.innerHTML = construirFormularioHorarios(
          userData.nome
        );
      }
      continuacaoContainer
        .querySelectorAll("select, input, textarea")
        .forEach((elemento) => {
          if (elemento.id !== "observacoes-pb-horarios")
            elemento.required = mostrarFormulario;
        });
    };
  });
  const motivoNaoInicioRadio = form.querySelectorAll(
    'input[name="motivo-nao-inicio"]'
  );
  motivoNaoInicioRadio.forEach((radio) => {
    radio.onchange = () => {
      if (radio.checked) {
        const eDesistiu = radio.value === "desistiu";
        desistenciaContainer.classList.toggle("hidden", !eDesistiu);
        solicitacaoContainer.classList.toggle("hidden", eDesistiu);
        document.getElementById("motivo-desistencia-pb").required = eDesistiu;
        document.getElementById("detalhes-solicitacao-pb").required =
          !eDesistiu;
      }
    };
  });
  modal.style.display = "block";
}

function construirFormularioHorarios(nomeProfissional) {
  let horasOptions = "";
  for (let i = 8; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horasOptions += `<option value="${hora}">${hora}</option>`;
  }
  const salas = [
    "Christian Dunker",
    "Leila Tardivo",
    "Leonardo Abrahão",
    "Karina Okajima Fukumitsu",
    "Maria Célia Malaquias (Grupo)",
    "Maria Júlia Kovacs",
    "Online",
  ];
  let salasOptions = salas
    .map((sala) => `<option value="${sala}">${sala}</option>`)
    .join("");
  return `<div class="form-group"><label>Nome Profissional:</label><input type="text" value="${nomeProfissional}" class="form-control" readonly></div><div class="form-group"><label for="dia-semana-pb">Dia da semana:</label><select id="dia-semana-pb" class="form-control" required><option value="">Selecione...</option><option>Segunda-feira</option><option>Terça-feira</option><option>Quarta-feira</option><option>Quinta-feira</option><option>Sexta-feira</option><option>Sábado</option></select></div><div class="form-group"><label for="horario-pb">Horário:</label><select id="horario-pb" class="form-control" required><option value="">Selecione...</option>${horasOptions}</select></div><div class="form-group"><label for="tipo-atendimento-pb-voluntario">Tipo de atendimento:</label><select id="tipo-atendimento-pb-voluntario" class="form-control" required><option value="">Selecione...</option><option>Presencial</option><option>Online</option></select></div><div class="form-group"><label for="alterar-grade-pb">Alterar/Incluir na grade?</label><select id="alterar-grade-pb" class="form-control" required><option value="">Selecione...</option><option>Sim</option><option>Não</option></select></div><div class="form-group"><label for="frequencia-atendimento-pb">Frequência:</label><select id="frequencia-atendimento-pb" class="form-control" required><option value="">Selecione...</option><option>Semanal</option><option>Quinzenal</option><option>Mensal</option></select></div><div class="form-group"><label for="sala-atendimento-pb">Sala:</label><select id="sala-atendimento-pb" class="form-control" required><option value="">Selecione...</option>${salasOptions}</select></div><div class="form-group"><label for="data-inicio-sessoes">Data de início:</label><input type="date" id="data-inicio-sessoes" class="form-control" required></div><div class="form-group"><label for="observacoes-pb-horarios">Observações:</label><textarea id="observacoes-pb-horarios" rows="3" class="form-control"></textarea></div>`;
}

export async function abrirModalDesfechoPb(dadosDoPaciente, meuAtendimento) {
  const modal = document.getElementById("desfecho-pb-modal");
  const body = document.getElementById("desfecho-pb-modal-body");
  const footer = document.getElementById("desfecho-pb-modal-footer");

  body.innerHTML = '<div class="loading-spinner"></div>';
  footer.style.display = "none";
  modal.style.display = "block";

  try {
    if (!meuAtendimento) {
      throw new Error(
        "Dados do atendimento específico (PB) não foram encontrados. Não é possível registrar o desfecho."
      );
    }

    const response = await fetch("../page/form-atendimento-pb.html");
    if (!response.ok)
      throw new Error(
        "Arquivo do formulário de desfecho (form-atendimento-pb.html) não encontrado."
      );

    body.innerHTML = await response.text();
    footer.style.display = "flex";

    const form = body.querySelector("#form-atendimento-pb");
    form.dataset.pacienteId = dadosDoPaciente.id;
    form.dataset.atendimentoId = meuAtendimento.atendimentoId;

    form.querySelector("#profissional-nome").value =
      meuAtendimento.profissionalNome;
    form.querySelector("#paciente-nome").value = dadosDoPaciente.nomeCompleto;
    form.querySelector("#valor-contribuicao").value =
      dadosDoPaciente.valorContribuicao || "Não definido";
    form.querySelector("#data-inicio-atendimento").value = meuAtendimento
      .horarioSessao?.dataInicio
      ? new Date(
          meuAtendimento.horarioSessao.dataInicio + "T03:00:00"
        ).toLocaleDateString("pt-BR")
      : "N/A";

    const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
    const motivoContainer = form.querySelector(
      "#motivo-alta-desistencia-container"
    );
    const encaminhamentoContainer = form.querySelector(
      "#encaminhamento-container"
    );

    desfechoSelect.addEventListener("change", () => {
      motivoContainer.style.display = ["Alta", "Desistencia"].includes(
        desfechoSelect.value
      )
        ? "block"
        : "none";
      encaminhamentoContainer.style.display =
        desfechoSelect.value === "Encaminhamento" ? "block" : "none";
    });

    form.addEventListener("submit", handleDesfechoPbSubmit);
  } catch (error) {
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
    footer.style.display = "flex";
    console.error(error);
  }
}
// --- Funções de Submit dos Formulários ---

export async function handleEncerramentoSubmit(evento, user, userData) {
  evento.preventDefault();
  const form = evento.target;
  const botaoSalvar = form
    .closest(".modal")
    .querySelector('button[type="submit"]');
  botaoSalvar.disabled = true;
  const pacienteId = document.getElementById("paciente-id-modal").value;
  const encaminhamentos = Array.from(
    form.querySelectorAll('input[name="encaminhamento"]:checked')
  ).map((cb) => cb.value);

  if (encaminhamentos.length === 0) {
    alert("Selecione ao menos uma opção de encaminhamento.");
    botaoSalvar.disabled = false;
    return;
  }

  let novoStatus = encaminhamentos.includes("Alta")
    ? "alta"
    : encaminhamentos.includes("Desistência")
    ? "desistencia"
    : "encaminhar_para_pb";
  let dadosParaAtualizar = {
    status: novoStatus,
    "plantaoInfo.encerramento": {
      responsavelId: user.uid,
      responsavelNome: userData.nome,
      encaminhamento: encaminhamentos,
      dataEncerramento: form.querySelector("#data-encerramento").value,
      sessoesRealizadas: form.querySelector("#quantidade-sessoes").value,
      pagamentoEfetuado: form.querySelector("#pagamento-contribuicao").value,
      motivoNaoPagamento: form.querySelector("#motivo-nao-pagamento").value,
      relato: form.querySelector("#relato-encerramento").value,
    },
    lastUpdate: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, "trilhaPaciente", pacienteId), dadosParaAtualizar);
    alert("Encerramento salvo com sucesso!");
    document.getElementById("encerramento-modal").style.display = "none";
    location.reload();
  } catch (error) {
    console.error("Erro ao salvar encerramento:", error);
    alert("Erro ao salvar.");
  } finally {
    botaoSalvar.disabled = false;
  }
}

export async function handleHorariosPbSubmit(evento, user, userData) {
  evento.preventDefault();
  const formulario = evento.target;
  const botaoSalvar = formulario
    .closest(".modal")
    .querySelector('button[type="submit"]');
  botaoSalvar.disabled = true;

  const pacienteId = formulario.querySelector(
    "#paciente-id-horarios-modal"
  ).value;
  const atendimentoId = formulario.querySelector(
    "#atendimento-id-horarios-modal"
  ).value;
  const docRef = doc(db, "trilhaPaciente", pacienteId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    alert("Erro: Paciente não encontrado!");
    botaoSalvar.disabled = false;
    return;
  }

  const dadosDoPaciente = docSnap.data();
  const atendimentos = dadosDoPaciente.atendimentosPB || [];
  const indiceDoAtendimento = atendimentos.findIndex(
    (at) => at.atendimentoId === atendimentoId
  );

  if (indiceDoAtendimento === -1) {
    alert("Erro: Atendimento não encontrado para este paciente!");
    botaoSalvar.disabled = false;
    return;
  }

  const iniciou = formulario.querySelector(
    'input[name="iniciou-pb"]:checked'
  )?.value;
  if (!iniciou) {
    alert("Por favor, selecione se o paciente iniciou o atendimento.");
    botaoSalvar.disabled = false;
    return;
  }

  let dadosParaAtualizar = {};
  if (iniciou === "sim") {
    atendimentos[indiceDoAtendimento].horarioSessao = {
      responsavelId: user.uid,
      responsavelNome: userData.nome,
      diaSemana: formulario.querySelector("#dia-semana-pb").value,
      horario: formulario.querySelector("#horario-pb").value,
      tipoAtendimento: formulario.querySelector(
        "#tipo-atendimento-pb-voluntario"
      ).value,
      alterarGrade: formulario.querySelector("#alterar-grade-pb").value,
      frequencia: formulario.querySelector("#frequencia-atendimento-pb").value,
      salaAtendimento: formulario.querySelector("#sala-atendimento-pb").value,
      dataInicio: formulario.querySelector("#data-inicio-sessoes").value,
      observacoes: formulario.querySelector("#observacoes-pb-horarios").value,
    };
    dadosParaAtualizar = {
      atendimentosPB: atendimentos,
      status: "cadastrar_horario_psicomanager",
      lastUpdate: serverTimestamp(),
    };
  } else {
    const motivoNaoInicio = formulario.querySelector(
      'input[name="motivo-nao-inicio"]:checked'
    )?.value;
    if (!motivoNaoInicio) {
      alert("Por favor, selecione o motivo do não início.");
      botaoSalvar.disabled = false;
      return;
    }

    if (motivoNaoInicio === "desistiu") {
      const motivoDescricao = formulario.querySelector(
        "#motivo-desistencia-pb"
      ).value;
      if (!motivoDescricao) {
        alert("Por favor, descreva o motivo da desistência.");
        botaoSalvar.disabled = false;
        return;
      }
      atendimentos[indiceDoAtendimento].status = "desistencia";
      atendimentos[indiceDoAtendimento].motivoDesistencia = motivoDescricao;
      dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: "desistencia",
        lastUpdate: serverTimestamp(),
      };
    } else {
      const detalhesSolicitacao = formulario.querySelector(
        "#detalhes-solicitacao-pb"
      ).value;
      if (!detalhesSolicitacao) {
        alert("Por favor, detalhe a solicitação do paciente.");
        botaoSalvar.disabled = false;
        return;
      }
      atendimentos[indiceDoAtendimento].status = "solicitado_reencaminhamento";
      atendimentos[indiceDoAtendimento].solicitacaoReencaminhamento =
        detalhesSolicitacao;
      dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: "reavaliar_encaminhamento",
        lastUpdate: serverTimestamp(),
      };
    }
  }

  try {
    await updateDoc(docRef, dadosParaAtualizar);
    alert("Informações salvas com sucesso!");
    document.getElementById("horarios-pb-modal").style.display = "none";
    location.reload();
  } catch (error) {
    console.error("Erro ao salvar informações:", error);
    alert("Erro ao salvar. Tente novamente.");
  } finally {
    botaoSalvar.disabled = false;
  }
}

async function handleDesfechoPbSubmit(evento) {
  evento.preventDefault();
  const form = evento.target;
  const pacienteId = form.dataset.pacienteId;
  const atendimentoId = form.dataset.atendimentoId;
  const botaoSalvar = form
    .closest(".modal")
    .querySelector("#btn-salvar-desfecho-submit"); // Corrigido para pegar o botão certo
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    const desfecho = form.querySelector("#desfecho-acompanhamento").value;
    if (!desfecho) throw new Error("Selecione um desfecho.");

    const payload = { pacienteId, atendimentoId, desfecho };

    if (desfecho === "Encaminhamento") {
      payload.encaminhamento = {
        servico: form.querySelector("#encaminhado-para").value,
        motivo: form.querySelector("#motivo-encaminhamento").value,
        demanda: form.querySelector("#demanda-paciente").value,
        continuaAtendimento: form.querySelector("#continua-atendimento").value,
        relatoCaso: form.querySelector("#relato-caso").value,
      };
      if (!payload.encaminhamento.servico || !payload.encaminhamento.motivo) {
        throw new Error("Para encaminhamento, preencha o serviço e o motivo.");
      }
    } else {
      payload.motivo = form.querySelector("#motivo-alta-desistencia").value;
      if (!payload.motivo && ["Alta", "Desistencia"].includes(desfecho)) {
        // Verificação corrigida
        throw new Error("O motivo é obrigatório para Alta ou Desistência.");
      }
    }

    const registrarDesfechoPb = httpsCallable(functions, "registrarDesfechoPb");
    const result = await registrarDesfechoPb(payload);

    if (!result.data.success) {
      throw new Error(result.data.message || "Ocorreu um erro no servidor.");
    }

    alert("Desfecho registrado com sucesso!");
    document.getElementById("desfecho-pb-modal").style.display = "none";
    location.reload();
  } catch (error) {
    console.error("Erro ao salvar desfecho:", error);
    alert(`Falha ao salvar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar Desfecho"; // Corrigido texto do botão
  }
}
