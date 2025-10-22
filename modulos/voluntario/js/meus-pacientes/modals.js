// Arquivo: /modulos/voluntario/js/meus-pacientes/modals.js
// --- VERSÃO CORRIGIDA: Reinclui abrirModalEncerramento e abrirModalHorariosPb ---
// Alterado para criar solicitações (Novas Sessões, Alteração, Desfecho, Reavaliação) na coleção 'solicitacoes'

import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  httpsCallable, // Mantido para handleDesfechoPbSubmit original, se necessário reverter
  functions, // Mantido para handleDesfechoPbSubmit original, se necessário reverter
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from "../../../../assets/js/firebase-init.js";

// Variáveis de escopo do módulo para armazenar dados necessários nos submits
let currentUserData = null;
let currentPacienteData = null;
let currentAtendimentoData = null;

// --- Lógica do Modal de Mensagens ---
let dadosParaMensagem = {};
let templateOriginal = "";

export function abrirModalMensagens(
  paciente,
  atendimento,
  { systemConfigs, userData }
) {
  // Armazena dados para uso posterior se necessário
  currentUserData = userData; // Salva para outros modais
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento;

  const modal = document.getElementById("enviar-mensagem-modal");
  const nomePacienteSpan = document.getElementById(
    "mensagem-paciente-nome-selecao"
  );
  const listaModelos = document.getElementById("lista-modelos-mensagem");
  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");

  const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");

  dadosParaMensagem = { paciente, atendimento, systemConfigs, userData }; // Mantém para esta função específica
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
  const { systemConfigs, userData } = dadosParaMensagem; // Usa dados específicos da mensagem

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

function formatarDataParaTexto(dataString) {
  // Renomeada para clareza
  if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString;
  }
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizarPreviewMensagem() {
  const { paciente, atendimento, userData } = dadosParaMensagem; // Usa dados específicos
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
      valor = formatarDataParaTexto(valor); // Usa a função renomeada
    }
    mensagemAtualizada = mensagemAtualizada.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      valor || placeholder
    );
  });

  previewTextarea.value = mensagemAtualizada;
}

export function handleMensagemSubmit() {
  const { paciente } = dadosParaMensagem; // Usa dados específicos
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
  { userData, salasPresenciais, dadosDaGrade } // Recebe userData aqui
) {
  // Armazena dados no escopo do módulo
  currentUserData = userData;
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento;

  const modal = document.getElementById("solicitar-sessoes-modal");
  modal.style.display = "flex";
  const form = document.getElementById("solicitar-sessoes-form");
  form.reset();
  form.classList.remove("was-validated");

  // Usa currentUserData
  document.getElementById("solicitar-profissional-nome").value =
    currentUserData.nome;
  document.getElementById("solicitar-paciente-nome").value =
    paciente.nomeCompleto;

  const horarioSelect = document.getElementById("solicitar-horario");
  horarioSelect.innerHTML = "";
  for (let i = 7; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`; // **CORREÇÃO: Usar a hora formatada como value**
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
    salaSelectEl.disabled = tipo === "online"; // **CORREÇÃO: comparar com 'online' em minúsculo**
    if (tipo === "online") salaSelectEl.value = "Online";
    validarHorarioNaGrade(dadosDaGrade, salasPresenciais);
  };
  tipoAtendimentoSelect.dispatchEvent(new Event("change"));
}

export async function handleSolicitarSessoesSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("solicitar-sessoes-form");
  const modal = document.getElementById("solicitar-sessoes-modal");
  const btnSubmit = document.getElementById("btn-confirmar-solicitacao");

  if (form.checkValidity() === false) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    form.classList.add("was-validated");
    return;
  }

  // Desabilita botão e mostra loading (opcional)
  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    // Coleta os dados do formulário e do contexto
    const solicitacaoData = {
      tipo: "novas_sessoes",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      detalhes: {
        diaSemana: form.querySelector("#solicitar-dia-semana").value,
        horario: form.querySelector("#solicitar-horario").value,
        modalidade: form.querySelector("#solicitar-tipo-atendimento").value,
        sala: form.querySelector("#solicitar-sala").value,
        dataInicioPreferencial: form.querySelector("#solicitar-data-inicio")
          .value,
      },
      adminFeedback: null,
    };

    // Salva na coleção 'solicitacoes'
    await addDoc(collection(db, "solicitacoes"), solicitacaoData);

    console.log("Solicitação de novas sessões criada:", solicitacaoData);
    alert(
      "Solicitação de novas sessões enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
    form.reset();
    form.classList.remove("was-validated");
  } catch (error) {
    console.error("Erro ao enviar solicitação de novas sessões:", error);
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // Reabilita o botão
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação";
  }
}

function validarHorarioNaGrade(dadosDaGrade, salasPresenciais) {
  const dia = document.getElementById("solicitar-dia-semana").value;
  const horarioCompleto = document.getElementById("solicitar-horario").value;
  const tipo = document.getElementById("solicitar-tipo-atendimento").value;
  const sala = document.getElementById("solicitar-sala").value;
  const feedbackDiv = document.getElementById("validacao-grade-feedback");

  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;
  let isOcupado = false;

  if (!horaKey) {
    feedbackDiv.style.display = "none";
    return;
  }

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
      salaIndex !== undefined &&
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
      "<strong>Atenção:</strong> Este horário já está preenchido na grade. <br>Sua solicitação será enviada mesmo assim para análise do administrativo.";
  } else {
    feedbackDiv.className = "info-note success";
    feedbackDiv.innerHTML =
      "<strong>Disponível:</strong> O horário selecionado parece livre na grade. A solicitação será enviada para análise do administrativo.";
  }
}

// --- Lógica do Modal de Alterar Horário ---

export function abrirModalAlterarHorario(
  paciente,
  atendimento,
  { userData, salasPresenciais } // Recebe userData
) {
  // Armazena dados no escopo do módulo
  currentUserData = userData;
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento;

  const modal = document.getElementById("alterar-horario-modal");
  const form = document.getElementById("alterar-horario-form");
  form.reset(); // Limpa o formulário

  // Preenche dados fixos (usa currentUserData)
  document.getElementById("alterar-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("alterar-profissional-nome").value =
    currentUserData.nome;

  // Preenche dados atuais (se existirem)
  const horarioAtual = atendimento?.horarioSessoes || {}; // **CORREÇÃO: Usar horarioSessoes** (Verificar se é esse mesmo o nome do campo)
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
      if (salasPresenciais && salasPresenciais.length > 0) {
        salaSelect.value = ""; // Deixa vazio para forçar seleção
      } else {
        salaSelect.value = "";
      }
    }
  };
  tipoAtendimentoSelect.dispatchEvent(new Event("change"));

  modal.style.display = "flex"; // Mostra o modal
}

export async function handleAlterarHorarioSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("alterar-horario-form");
  const modal = document.getElementById("alterar-horario-modal");
  const btnSubmit = document.getElementById("btn-confirmar-alteracao-horario");

  if (!form.checkValidity()) {
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para a nova configuração."
    );
    form.classList.add("was-validated");
    return;
  }

  // Desabilita botão e mostra loading (opcional)
  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    // Coleta dados antigos
    const horarioAntigo = currentAtendimentoData?.horarioSessoes || {}; // **CORREÇÃO: Usar horarioSessoes**
    const dadosAntigos = {
      dia: horarioAntigo.diaSemana || "N/A",
      horario: horarioAntigo.horario || "N/A",
      modalidade: horarioAntigo.tipoAtendimento || "N/A",
      sala: horarioAntigo.salaAtendimento || "N/A",
      frequencia: horarioAntigo.frequencia || "N/A",
    };

    // Coleta dados novos
    const dadosNovos = {
      dia: form.querySelector("#alterar-dia-semana").value,
      horario: form.querySelector("#alterar-horario").value,
      modalidade: form.querySelector("#alterar-tipo-atendimento").value,
      frequencia: form.querySelector("#alterar-frequencia").value,
      sala: form.querySelector("#alterar-sala").value,
      dataInicio: form.querySelector("#alterar-data-inicio").value,
      alterarGrade: form.querySelector("#alterar-grade").value,
    };

    // Prepara o objeto da solicitação
    const solicitacaoData = {
      tipo: "alteracao_horario",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      detalhes: {
        dadosAntigos: dadosAntigos,
        dadosNovos: dadosNovos,
        justificativa: form.querySelector("#alterar-justificativa").value || "",
      },
      adminFeedback: null,
    };

    // Salva na coleção 'solicitacoes'
    await addDoc(collection(db, "solicitacoes"), solicitacaoData);

    console.log("Solicitação de alteração de horário criada:", solicitacaoData);
    alert(
      "Solicitação de alteração de horário enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
    form.reset();
    form.classList.remove("was-validated");
  } catch (error) {
    console.error("Erro ao enviar solicitação de alteração de horário:", error);
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // Reabilita o botão
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação de Alteração";
  }
}

// --- Lógica do Modal de Reavaliação ---
let currentReavaliacaoConfig = {};

export async function abrirModalReavaliacao(
  paciente,
  atendimento,
  { user, userData, systemConfigs }
) {
  // Armazena dados
  currentUserData = userData;
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento;

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
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  const dataSelecionadaInput = document.getElementById(
    "reavaliacao-data-selecionada"
  );
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  // Resetar
  form.reset();
  msgSemAgenda.style.display = "none";
  form.style.display = "none";
  btnConfirmar.style.display = "none";
  datasContainer.innerHTML =
    "<p>Selecione uma modalidade para ver as datas.</p>";
  horariosContainer.innerHTML =
    "<p>Selecione uma data para ver os horários.</p>";
  dataSelecionadaInput.value = "";

  // Preencher dados fixos
  document.getElementById("reavaliacao-paciente-id").value = paciente.id;
  document.getElementById("reavaliacao-profissional-nome").value =
    currentUserData.nome;
  document.getElementById("reavaliacao-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("reavaliacao-valor-atual").value =
    paciente.valorContribuicao || "";

  modal.style.display = "flex";

  try {
    // Buscar agendas futuras
    const hoje = new Date().toISOString().split("T")[0];
    const agendaQuery = query(
      collection(db, "agendaConfigurada"),
      where("tipo", "==", "reavaliacao"),
      where("data", ">=", hoje)
    );
    const agendaSnapshot = await getDocs(agendaQuery);

    if (agendaSnapshot.empty) {
      msgSemAgenda.style.display = "block";
      return;
    }

    // Mostrar formulário
    form.style.display = "block";
    btnConfirmar.style.display = "block";

    let agendasConfig = [];
    agendaSnapshot.forEach((doc) =>
      agendasConfig.push({ id: doc.id, ...doc.data() })
    );

    currentReavaliacaoConfig = {
      agendas: agendasConfig,
      paciente: paciente,
      userData: currentUserData,
    };

    // Lógica da Modalidade
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
      tipoAtendimentoSelect.innerHTML = `<option value="${modalidades[0]}" selected>${modalidades[0]}</option>`;
      tipoAtendimentoSelect.required = false;
      renderizarDatasDisponiveis(modalidades[0]); // Já carrega datas
    } else {
      throw new Error(
        "Agenda de reavaliação configurada de forma inválida (sem modalidade)."
      );
    }

    // Listeners
    tipoAtendimentoSelect.onchange = () => {
      horariosContainer.innerHTML =
        "<p>Selecione uma data para ver os horários.</p>";
      dataSelecionadaInput.value = "";
      renderizarDatasDisponiveis(tipoAtendimentoSelect.value);
    };
    datasContainer.onclick = (e) => {
      const target = e.target.closest(".slot-time");
      if (target && !target.disabled) {
        datasContainer
          .querySelector(".slot-time.selected")
          ?.classList.remove("selected");
        target.classList.add("selected");
        dataSelecionadaInput.value = target.dataset.data;
        carregarHorariosReavaliacao();
      }
    };
    horariosContainer.onclick = (e) => {
      const target = e.target.closest(".slot-time");
      if (target && !target.disabled) {
        horariosContainer
          .querySelector(".slot-time.selected")
          ?.classList.remove("selected");
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
      const dataObj = new Date(dataISO + "T03:00:00");
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

async function carregarHorariosReavaliacao() {
  const modalidade = document.getElementById(
    "reavaliacao-tipo-atendimento"
  ).value;
  const dataISO = document.getElementById("reavaliacao-data-selecionada").value;
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  if (!modalidade || !dataISO) {
    horariosContainer.innerHTML =
      "<p>Por favor, selecione a modalidade e a data.</p>";
    return;
  }

  horariosContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const agendasDoDia = currentReavaliacaoConfig.agendas.filter(
      (a) => a.modalidade === modalidade && a.data === dataISO
    );

    if (agendasDoDia.length === 0) {
      horariosContainer.innerHTML =
        "<p>Nenhum horário configurado para este dia/modalidade.</p>";
      return;
    }

    let slotsDoDia = new Set();
    agendasDoDia.forEach((agenda) => {
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

    let slotsHtml = "";
    slotsOrdenados.forEach((hora) => {
      if (horariosOcupados.has(hora)) {
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

export async function handleReavaliacaoSubmit(evento) {
  evento.preventDefault();
  const modal = document.getElementById("reavaliacao-modal");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Enviando...";

  try {
    const motivo = document.getElementById("reavaliacao-motivo").value;
    const valorAtual =
      document.getElementById("reavaliacao-valor-atual").value || "N/A";
    const modalidadePref = document.getElementById(
      "reavaliacao-tipo-atendimento"
    ).value;
    const dataPref = document.getElementById(
      "reavaliacao-data-selecionada"
    ).value;
    const selectedSlot = document.querySelector(
      "#reavaliacao-horarios-disponiveis .slot-time.selected"
    );
    const horaPref = selectedSlot ? selectedSlot.dataset.hora : null;

    if (!motivo) {
      throw new Error("Por favor, preencha o motivo da reavaliação.");
    }

    const solicitacaoData = {
      tipo: "reavaliacao",
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      detalhes: {
        motivo: motivo,
        valorContribuicaoAtual: valorAtual,
        preferenciaAgendamento: {
          modalidade: modalidadePref || null,
          data: dataPref || null,
          hora: horaPref || null,
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

export async function abrirModalDesfechoPb(
  paciente,
  atendimento,
  { userData }
) {
  // Armazena dados
  currentUserData = userData;
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento;

  const modal = document.getElementById("desfecho-pb-modal");
  const body = document.getElementById("desfecho-pb-modal-body");
  const footer = document.getElementById("desfecho-pb-modal-footer");

  body.innerHTML = '<div class="loading-spinner"></div>';
  footer.style.display = "none";
  modal.style.display = "block";

  try {
    if (!currentAtendimentoData) {
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

    form.querySelector("#profissional-nome").value =
      currentAtendimentoData.profissionalNome || currentUserData.nome;
    form.querySelector("#paciente-nome").value =
      currentPacienteData.nomeCompleto;
    form.querySelector("#valor-contribuicao").value =
      currentPacienteData.valorContribuicao || "Não definido";
    form.querySelector("#data-inicio-atendimento").value =
      currentAtendimentoData.horarioSessoes?.dataInicio // **CORREÇÃO: Usar horarioSessoes**
        ? new Date(
            currentAtendimentoData.horarioSessoes.dataInicio + "T03:00:00"
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
      form.querySelector("#motivo-alta-desistencia").required = [
        "Alta",
        "Desistencia",
      ].includes(desfechoSelect.value);
      form.querySelector("#encaminhado-para").required =
        desfechoSelect.value === "Encaminhamento";
      form.querySelector("#motivo-encaminhamento").required =
        desfechoSelect.value === "Encaminhamento";
    });
    desfechoSelect.dispatchEvent(new Event("change"));

    form.addEventListener("submit", handleDesfechoPbSubmit);
  } catch (error) {
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
    footer.style.display = "flex";
    console.error(error);
  }
}

async function handleDesfechoPbSubmit(evento) {
  evento.preventDefault();
  const form = evento.target;
  const modal = form.closest(".modal-overlay");
  const botaoSalvar = modal.querySelector("#btn-salvar-desfecho-submit");

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Enviando...";

  try {
    const desfechoTipo = form.querySelector("#desfecho-acompanhamento").value;
    if (!desfechoTipo) throw new Error("Selecione um tipo de desfecho.");

    let detalhesDesfecho = {};
    if (desfechoTipo === "Encaminhamento") {
      detalhesDesfecho = {
        servicoEncaminhado: form.querySelector("#encaminhado-para").value,
        motivoEncaminhamento: form.querySelector("#motivo-encaminhamento")
          .value,
        demandaPaciente: form.querySelector("#demanda-paciente").value || "",
        continuaAtendimentoEuPsico: form.querySelector("#continua-atendimento")
          .value,
        relatoCaso: form.querySelector("#relato-caso").value || "",
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
        motivo: form.querySelector("#motivo-alta-desistencia").value,
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
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
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
    modal.style.display = "none";
  } catch (error) {
    console.error("Erro ao enviar solicitação de desfecho:", error);
    alert(`Falha ao enviar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar Desfecho";
  }
}

// --- Funções Originais (Mantidas por enquanto) ---

// *** FUNÇÃO REINCLUÍDA ***
export async function abrirModalEncerramento(pacienteId, dadosDoPaciente) {
  // Armazena dados no escopo do módulo
  currentPacienteData = dadosDoPaciente; // Necessário para handleEncerramentoSubmit
  // currentUserData já deve ter sido setado ao abrir outro modal ou no init da página

  const modal = document.getElementById("encerramento-modal");
  const form = document.getElementById("encerramento-form");
  form.reset();
  document.getElementById("paciente-id-modal").value = pacienteId; // Mantém ID no form para handleEncerramentoSubmit
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
        // Ajuste no caminho do fetch relativo ao JS, não ao HTML
        const response = await fetch(
          "../../../public/fichas-de-inscricao.html" // Ajuste o caminho se necessário
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
  modal.style.display = "block"; // Usar 'block' ou 'flex' dependendo do CSS
}

// *** FUNÇÃO REINCLUÍDA ***
export function abrirModalHorariosPb(pacienteId, atendimentoId, { userData }) {
  // Armazena dados no escopo do módulo
  currentUserData = userData;
  // Busca paciente e atendimento se necessário, ou assume que já estão em current...Data
  // Aqui, vamos confiar que handleHorariosPbSubmit buscará os dados frescos pelo ID
  // currentPacienteData = ?; // Talvez não precise aqui se o submit busca pelo ID
  // currentAtendimentoData = ?;

  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");
  form.reset();
  form.querySelector("#paciente-id-horarios-modal").value = pacienteId; // ID no form é necessário para o submit
  form.querySelector("#atendimento-id-horarios-modal").value = atendimentoId; // ID no form é necessário para o submit
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
  continuacaoContainer.innerHTML = ""; // Limpa formulário dinâmico
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
        document.getElementById("motivo-desistencia-pb").required = false; // Garante que não é required
        document.getElementById("detalhes-solicitacao-pb").required = false; // Garante que não é required
      }
      if (mostrarFormulario && continuacaoContainer.innerHTML === "") {
        continuacaoContainer.innerHTML = construirFormularioHorarios(
          userData.nome // Usa o nome do userData passado
        );
      }
      // Ajusta required dos campos dinâmicos
      continuacaoContainer
        .querySelectorAll("select, input, textarea")
        .forEach((elemento) => {
          // Apenas campos dentro do form dinâmico, exceto observações
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

        // Garante que campos do formulário de continuação não sejam required se 'Não iniciou'
        continuacaoContainer
          .querySelectorAll("select, input, textarea")
          .forEach((elemento) => (elemento.required = false));
      }
    };
  });
  modal.style.display = "block"; // Usar 'block' ou 'flex' dependendo do CSS
}

// *** FUNÇÃO REINCLUÍDA *** (Helper para abrirModalHorariosPb)
function construirFormularioHorarios(nomeProfissional) {
  let horasOptions = "";
  for (let i = 8; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horasOptions += `<option value="${hora}">${hora}</option>`;
  }
  // TODO: Buscar salas da configuração do sistema (systemConfigs.listas.salasPresenciais)
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

  // Adiciona required aos campos corretos
  return `
    <div class="form-group">
      <label>Nome Profissional:</label>
      <input type="text" value="${nomeProfissional}" class="form-control" readonly>
    </div>
    <div class="form-group">
      <label for="dia-semana-pb">Dia da semana:*</label>
      <select id="dia-semana-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Segunda-feira">Segunda-feira</option>
        <option value="Terça-feira">Terça-feira</option>
        <option value="Quarta-feira">Quarta-feira</option>
        <option value="Quinta-feira">Quinta-feira</option>
        <option value="Sexta-feira">Sexta-feira</option>
        <option value="Sábado">Sábado</option>
      </select>
    </div>
    <div class="form-group">
      <label for="horario-pb">Horário:*</label>
      <select id="horario-pb" class="form-control" required>
        <option value="">Selecione...</option>
        ${horasOptions}
      </select>
    </div>
    <div class="form-group">
      <label for="tipo-atendimento-pb-voluntario">Tipo de atendimento:*</label>
      <select id="tipo-atendimento-pb-voluntario" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Presencial">Presencial</option>
        <option value="Online">Online</option>
      </select>
    </div>
    <div class="form-group">
      <label for="alterar-grade-pb">Alterar/Incluir na grade?*</label>
      <select id="alterar-grade-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Sim">Sim</option>
        <option value="Não">Não</option>
      </select>
    </div>
    <div class="form-group">
      <label for="frequencia-atendimento-pb">Frequência:*</label>
      <select id="frequencia-atendimento-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Semanal">Semanal</option>
        <option value="Quinzenal">Quinzenal</option>
        <option value="Mensal">Mensal</option>
      </select>
    </div>
    <div class="form-group">
      <label for="sala-atendimento-pb">Sala:*</label>
      <select id="sala-atendimento-pb" class="form-control" required>
        <option value="">Selecione...</option>
        ${salasOptions}
      </select>
    </div>
    <div class="form-group">
      <label for="data-inicio-sessoes">Data de início:*</label>
      <input type="date" id="data-inicio-sessoes" class="form-control" required>
    </div>
    <div class="form-group">
      <label for="observacoes-pb-horarios">Observações:</label>
      <textarea id="observacoes-pb-horarios" rows="3" class="form-control"></textarea>
    </div>
  `;
}

// *** FUNÇÃO REINCLUÍDA *** (Submit do encerramento Plantão)
export async function handleEncerramentoSubmit(evento, user, userData) {
  // Esta função MODIFICA A TRILHA DIRETAMENTE - Mantida como está.
  evento.preventDefault();
  const form = evento.target;
  const botaoSalvar = form
    .closest(".modal")
    .querySelector('button[type="submit"]');
  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...'; // Add loading

  const pacienteId = document.getElementById("paciente-id-modal").value;
  const encaminhamentos = Array.from(
    form.querySelectorAll('input[name="encaminhamento"]:checked')
  ).map((cb) => cb.value);

  // Busca dados atuais do paciente para a lógica de disponibilidade
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
    console.error("Erro ao buscar dados do paciente:", error);
    alert(`Erro ao buscar dados do paciente: ${error.message}`);
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  // Validações
  if (encaminhamentos.length === 0) {
    alert("Selecione ao menos uma opção de encaminhamento.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar"; // Reset button text
    return;
  }
  if (!form.querySelector("#data-encerramento").value) {
    alert("A data de encerramento é obrigatória.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (!form.querySelector("#quantidade-sessoes").value) {
    alert("A quantidade de sessões é obrigatória.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (!form.querySelector("#pagamento-contribuicao").value) {
    alert("Informe se o pagamento foi efetuado.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (
    form.querySelector("#pagamento-contribuicao").value === "nao" &&
    !form.querySelector("#motivo-nao-pagamento").value
  ) {
    alert("Informe o motivo do não pagamento.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (!form.querySelector("#relato-encerramento").value) {
    alert("O breve relato é obrigatório.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }
  if (!form.querySelector("#manter-disponibilidade").value) {
    alert("Informe sobre a disponibilidade do paciente.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  let novoStatus = encaminhamentos.includes("Alta")
    ? "alta"
    : encaminhamentos.includes("Desistência")
    ? "desistencia"
    : "encaminhar_para_pb";

  const encerramentoData = {
    responsavelId: user.uid,
    responsavelNome: userData.nome,
    encaminhamento: encaminhamentos,
    dataEncerramento: form.querySelector("#data-encerramento").value,
    sessoesRealizadas: form.querySelector("#quantidade-sessoes").value,
    pagamentoEfetuado: form.querySelector("#pagamento-contribuicao").value,
    motivoNaoPagamento:
      form.querySelector("#motivo-nao-pagamento").value || null,
    relato: form.querySelector("#relato-encerramento").value,
    encerradoEm: serverTimestamp(),
  };

  let dadosParaAtualizar = {
    status: novoStatus,
    "plantaoInfo.encerramento": encerramentoData,
    lastUpdate: serverTimestamp(),
  };

  const manterDisp = form.querySelector("#manter-disponibilidade").value;
  if (manterDisp === "nao") {
    const checkboxes = form.querySelectorAll(
      '#nova-disponibilidade-container input[type="checkbox"]:checked'
    );
    // Validação: Se selecionou 'Não', deve marcar novas disponibilidades
    if (checkboxes.length === 0) {
      alert(
        "Se a disponibilidade mudou, por favor, selecione os novos horários disponíveis."
      );
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
      return;
    }
    dadosParaAtualizar.disponibilidadeEspecifica = Array.from(checkboxes).map(
      (cb) => cb.value
    );
  } else if (
    manterDisp === "sim" &&
    !dadosDoPacienteAtual?.disponibilidadeEspecifica
  ) {
    // Usa dadosDoPacienteAtual
    console.warn(
      "Manter disponibilidade selecionado, mas não há dados anteriores."
    );
  } else if (manterDisp === "sim") {
    // Se selecionou 'Sim', explicitamente mantém a disponibilidade existente
    dadosParaAtualizar.disponibilidadeEspecifica =
      dadosDoPacienteAtual.disponibilidadeEspecifica || [];
  }

  try {
    await updateDoc(doc(db, "trilhaPaciente", pacienteId), dadosParaAtualizar);
    alert("Encerramento salvo com sucesso!");
    document.getElementById("encerramento-modal").style.display = "none";
    location.reload();
  } catch (error) {
    console.error("Erro ao salvar encerramento:", error);
    alert(`Erro ao salvar: ${error.message}`); // Mensagem mais específica
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar"; // Reset button text
  }
}

// *** FUNÇÃO REINCLUÍDA *** (Submit do início PB / Horários)
export async function handleHorariosPbSubmit(evento, user, userData) {
  // Esta função MODIFICA A TRILHA DIRETAMENTE E CRIA SOLICITAÇÃO GRADE - Mantida como está.
  evento.preventDefault();
  const formulario = evento.target;
  const botaoSalvar = formulario
    .closest(".modal")
    .querySelector('button[type="submit"]');
  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...';

  const pacienteId = formulario.querySelector(
    "#paciente-id-horarios-modal"
  ).value;
  const atendimentoId = formulario.querySelector(
    "#atendimento-id-horarios-modal"
  ).value;
  const docRef = doc(db, "trilhaPaciente", pacienteId);

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error("Paciente não encontrado!");
    }

    const dadosDoPaciente = docSnap.data();
    const atendimentos = dadosDoPaciente.atendimentosPB || [];
    const indiceDoAtendimento = atendimentos.findIndex(
      (at) => at.atendimentoId === atendimentoId
    );

    if (indiceDoAtendimento === -1) {
      throw new Error("Atendimento não encontrado para este paciente!");
    }

    const iniciou = formulario.querySelector(
      'input[name="iniciou-pb"]:checked'
    )?.value;
    if (!iniciou) {
      throw new Error(
        "Por favor, selecione se o paciente iniciou o atendimento."
      );
    }

    let dadosParaAtualizar = {};
    let novoStatusPaciente = dadosDoPaciente.status;

    if (iniciou === "sim") {
      const horarioSessaoData = {
        responsavelId: user.uid,
        responsavelNome: userData.nome,
        diaSemana: formulario.querySelector("#dia-semana-pb").value,
        horario: formulario.querySelector("#horario-pb").value,
        tipoAtendimento: formulario.querySelector(
          "#tipo-atendimento-pb-voluntario"
        ).value,
        alterarGrade: formulario.querySelector("#alterar-grade-pb").value,
        frequencia: formulario.querySelector("#frequencia-atendimento-pb")
          .value,
        salaAtendimento: formulario.querySelector("#sala-atendimento-pb").value,
        dataInicio: formulario.querySelector("#data-inicio-sessoes").value,
        observacoes:
          formulario.querySelector("#observacoes-pb-horarios").value || "",
        definidoEm: serverTimestamp(),
      };

      if (
        !horarioSessaoData.diaSemana ||
        !horarioSessaoData.horario ||
        !horarioSessaoData.tipoAtendimento ||
        !horarioSessaoData.alterarGrade ||
        !horarioSessaoData.frequencia ||
        !horarioSessaoData.salaAtendimento ||
        !horarioSessaoData.dataInicio
      ) {
        throw new Error(
          "Preencha todos os detalhes do horário (dia, hora, tipo, grade, frequência, sala, data início)."
        );
      }

      atendimentos[indiceDoAtendimento].horarioSessoes = horarioSessaoData; // **CORREÇÃO: Usar horarioSessoes**
      atendimentos[indiceDoAtendimento].statusAtendimento = "ativo"; // **CORREÇÃO: Usar statusAtendimento**

      novoStatusPaciente = "em_atendimento_pb";

      dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: novoStatusPaciente,
        lastUpdate: serverTimestamp(),
      };

      if (horarioSessaoData.alterarGrade === "Sim") {
        const solicitacaoGradeData = {
          tipo: "inclusao_alteracao_grade",
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: user.uid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: { ...horarioSessaoData },
          adminFeedback: null,
        };
        try {
          await addDoc(collection(db, "solicitacoes"), solicitacaoGradeData);
          console.log("Solicitação para inclusão/alteração na grade criada.");
        } catch (gradeError) {
          console.error("Erro ao criar solicitação para grade:", gradeError);
          alert(
            "Atenção: Houve um erro ao gerar a solicitação para alteração da grade, por favor, notifique o administrativo manualmente."
          );
        }
      }
    } else {
      // iniciou === "nao"
      const motivoNaoInicio = formulario.querySelector(
        'input[name="motivo-nao-inicio"]:checked'
      )?.value;
      if (!motivoNaoInicio) {
        throw new Error("Por favor, selecione o motivo do não início.");
      }

      if (motivoNaoInicio === "desistiu") {
        const motivoDescricao = formulario.querySelector(
          "#motivo-desistencia-pb"
        ).value;
        if (!motivoDescricao) {
          throw new Error("Por favor, descreva o motivo da desistência.");
        }
        atendimentos[indiceDoAtendimento].statusAtendimento =
          "desistencia_antes_inicio"; // **CORREÇÃO: Usar statusAtendimento**
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao;
        atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp();
        novoStatusPaciente = "desistencia";
      } else {
        const detalhesSolicitacao = formulario.querySelector(
          "#detalhes-solicitacao-pb"
        ).value;
        if (!detalhesSolicitacao) {
          throw new Error("Por favor, detalhe a solicitação do paciente.");
        }
        atendimentos[indiceDoAtendimento].statusAtendimento =
          "solicitado_reencaminhamento"; // **CORREÇÃO: Usar statusAtendimento**
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoNaoInicio;
        atendimentos[indiceDoAtendimento].solicitacaoReencaminhamento =
          detalhesSolicitacao;
        atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp();
        novoStatusPaciente = "reavaliar_encaminhamento";
      }
      dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: novoStatusPaciente,
        lastUpdate: serverTimestamp(),
      };
    }

    await updateDoc(docRef, dadosParaAtualizar);

    alert("Informações salvas com sucesso!");
    document.getElementById("horarios-pb-modal").style.display = "none";
    location.reload();
  } catch (error) {
    console.error("Erro ao salvar informações de Horários PB:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar"; // Reset button text
  }
}

// --- Fechamento de Modais ---
// Listener genérico movido para events.js, mas manter funções pode ser útil se chamadas de outro lugar.
// function fecharModal(modalId) {
//   const modal = document.getElementById(modalId);
//   if (modal) {
//     modal.style.display = "none";
//   }
// }

// Adiciona listeners para fechar modais específicos (se o listener genérico não pegar)
document.addEventListener("DOMContentLoaded", () => {
  // Exemplo: se houver botões específicos não cobertos pelo genérico
  // document.getElementById('botao-fechar-especifico')?.addEventListener('click', () => fecharModal('meu-modal-especifico'));
});
