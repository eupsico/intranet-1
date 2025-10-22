// Arquivo: /modulos/voluntario/js/meus-pacientes/modals.js
// Alterado para criar solicitações na coleção 'solicitacoes'

import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  httpsCallable,
  functions,
  collection, // Importado
  query,
  where,
  getDocs,
  addDoc, // Importado
  Timestamp,
} from "../../../../assets/js/firebase-init.js";

// Variáveis de escopo do módulo para armazenar dados necessários nos submits
let currentUserData = null; // Para armazenar userData (nome, uid)
let currentPacienteData = null; // Para armazenar dados do paciente atual do modal
let currentAtendimentoData = null; // Para armazenar dados do atendimento atual do modal

// --- Lógica do Modal de Mensagens (Sem alterações na lógica de salvar) ---
// ... (código existente de abrirModalMensagens, preencherFormularioMensagem, formatarData, atualizarPreviewMensagem, handleMensagemSubmit) ...
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

  // Não precisamos mais guardar IDs no form se vamos pegar de current...Data
  // document.getElementById("solicitar-paciente-id").value = paciente.id;
  // document.getElementById("solicitar-atendimento-id").value = atendimento?.atendimentoId || "";

  const horarioSelect = document.getElementById("solicitar-horario");
  horarioSelect.innerHTML = "";
  for (let i = 7; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    // horarioSelect.innerHTML += `<option value="${i}">${hora}</option>`; // Usa i como value
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

// *** ALTERADO: handleSolicitarSessoesSubmit para criar na coleção 'solicitacoes' ***
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
      tipo: "novas_sessoes", // Tipo da solicitação
      status: "Pendente", // Status inicial
      dataSolicitacao: serverTimestamp(), // Data/Hora atual
      // Dados do solicitante (Voluntário)
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      // Dados do Paciente
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      // ID do atendimento PB atual (se houver)
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      // Detalhes específicos da solicitação de Novas Sessões
      detalhes: {
        diaSemana: form.querySelector("#solicitar-dia-semana").value,
        horario: form.querySelector("#solicitar-horario").value,
        modalidade: form.querySelector("#solicitar-tipo-atendimento").value,
        sala: form.querySelector("#solicitar-sala").value,
        dataInicioPreferencial: form.querySelector("#solicitar-data-inicio")
          .value,
        // Adicionar justificativa se houver campo no formulário HTML
        // justificativa: form.querySelector("#solicitar-justificativa")?.value || ""
      },
      adminFeedback: null, // Campo para resposta do admin
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
// *** FIM DA ALTERAÇÃO ***

function validarHorarioNaGrade(dadosDaGrade, salasPresenciais) {
  const dia = document.getElementById("solicitar-dia-semana").value;
  // **CORREÇÃO: Pegar a hora formatada 'HH:MM' do value**
  const horarioCompleto = document.getElementById("solicitar-horario").value;
  const tipo = document.getElementById("solicitar-tipo-atendimento").value;
  const sala = document.getElementById("solicitar-sala").value;
  const feedbackDiv = document.getElementById("validacao-grade-feedback");

  // **CORREÇÃO: Usar a hora completa 'HH:MM' como chave**
  // A chave na grade parece ser HH-MM (ex: 08-00)
  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;
  let isOcupado = false;

  if (!horaKey) {
    feedbackDiv.style.display = "none"; // Esconde se não tem hora selecionada
    return;
  }

  if (tipo === "online") {
    // **CORREÇÃO: usar 'online' minúsculo**
    for (let i = 0; i < 6; i++) {
      // Acessa a grade usando as chaves corretas
      if (dadosDaGrade?.online?.[dia]?.[horaKey]?.[`col${i}`]) {
        isOcupado = true;
        break;
      }
    }
  } else {
    // Presencial
    const salaIndex = salasPresenciais?.indexOf(sala);
    if (
      salaIndex !== undefined &&
      salaIndex !== -1 && // Verifica se salaIndex é válido
      // Acessa a grade usando as chaves corretas
      dadosDaGrade?.presencial?.[dia]?.[horaKey]?.[`col${salaIndex}`]
    ) {
      isOcupado = true;
    }
  }

  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "info-note exists"; // Mantém a classe 'exists'
    feedbackDiv.innerHTML =
      "<strong>Atenção:</strong> Este horário já está preenchido na grade. <br>Sua solicitação será enviada mesmo assim para análise do administrativo."; // Mensagem ajustada
  } else {
    feedbackDiv.className = "info-note success";
    feedbackDiv.innerHTML =
      "<strong>Disponível:</strong> O horário selecionado parece livre na grade. A solicitação será enviada para análise do administrativo."; // Mensagem ajustada
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
        // salaSelect.value = salasPresenciais[0]; // Remove seleção automática
        salaSelect.value = ""; // Deixa vazio para forçar seleção
      } else {
        salaSelect.value = "";
      }
    }
  };
  tipoAtendimentoSelect.dispatchEvent(new Event("change"));

  modal.style.display = "flex"; // Mostra o modal
}

// *** ALTERADO: handleAlterarHorarioSubmit para criar na coleção 'solicitacoes' ***
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
    // Coleta dados antigos (já preenchidos no modal e armazenados em currentAtendimentoData)
    const horarioAntigo = currentAtendimentoData?.horarioSessao || {};
    const dadosAntigos = {
      dia: horarioAntigo.diaSemana || "N/A",
      horario: horarioAntigo.horario || "N/A",
      modalidade: horarioAntigo.tipoAtendimento || "N/A",
      sala: horarioAntigo.salaAtendimento || "N/A", // Adicionar se existir
      frequencia: horarioAntigo.frequencia || "N/A", // Adicionar se existir
    };

    // Coleta dados novos do formulário
    const dadosNovos = {
      dia: form.querySelector("#alterar-dia-semana").value,
      horario: form.querySelector("#alterar-horario").value,
      modalidade: form.querySelector("#alterar-tipo-atendimento").value,
      frequencia: form.querySelector("#alterar-frequencia").value,
      sala: form.querySelector("#alterar-sala").value,
      dataInicio: form.querySelector("#alterar-data-inicio").value, // Data de início da alteração
      alterarGrade: form.querySelector("#alterar-grade").value, // Solicita alteração na grade
    };

    // Prepara o objeto da solicitação
    const solicitacaoData = {
      tipo: "alteracao_horario", // Tipo da solicitação
      status: "Pendente", // Status inicial
      dataSolicitacao: serverTimestamp(), // Data/Hora atual
      // Dados do solicitante (Voluntário)
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      // Dados do Paciente
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      // ID do atendimento PB atual
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      // Detalhes específicos da solicitação de alteração
      detalhes: {
        dadosAntigos: dadosAntigos,
        dadosNovos: dadosNovos,
        justificativa: form.querySelector("#alterar-justificativa").value || "", // Justificativa opcional
      },
      adminFeedback: null, // Campo para resposta do admin
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
// *** FIM DA ALTERAÇÃO ***

// --- Lógica do Modal de Reavaliação ---

// Variável para guardar a configuração da agenda e dados
let currentReavaliacaoConfig = {};

export async function abrirModalReavaliacao(
  paciente,
  atendimento, // atendimento pode ser null, mas recebemos para consistência
  { user, userData, systemConfigs } // Recebe user e userData
) {
  // Armazena dados no escopo do módulo
  currentUserData = userData; // user já está em userData? Se sim, ok. Senão, salvar user também.
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento; // Pode ser null

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

  // Preencher dados fixos (usa currentUserData)
  document.getElementById("reavaliacao-paciente-id").value = paciente.id; // Mantém ID no form por segurança
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
    btnConfirmar.style.display = "block"; // Botão de submit agora é para a *solicitação*

    let agendasConfig = [];
    agendaSnapshot.forEach((doc) =>
      agendasConfig.push({ id: doc.id, ...doc.data() })
    );

    // Salva configs (mantém, pode ser útil para preencher preferências no detalhes)
    currentReavaliacaoConfig = {
      agendas: agendasConfig,
      paciente: paciente,
      // user: user, // Se user tiver mais dados que userData.uid
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

    // Listeners (mantidos para seleção de preferência)
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
        carregarHorariosReavaliacao(); // Carrega horários para seleção de preferência
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

// Renderizar Datas (mantida, útil para preferência)
function renderizarDatasDisponiveis(modalidade) {
  // ... (código igual) ...
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

// Carregar Horários (mantida, útil para preferência)
async function carregarHorariosReavaliacao() {
  // ... (código igual) ...
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

  horariosContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // 1. Encontrar as configurações de agenda para esta data/modalidade
    const agendasDoDia = currentReavaliacaoConfig.agendas.filter(
      (a) => a.modalidade === modalidade && a.data === dataISO
    );

    if (agendasDoDia.length === 0) {
      // Não lança erro, apenas informa que não há slots configurados
      horariosContainer.innerHTML =
        "<p>Nenhum horário configurado para este dia/modalidade.</p>";
      // throw new Error("Configuração de agenda não encontrada para esta data.");
      return;
    }

    // 2. Pegar todos os slots disponíveis de todas as assistentes
    let slotsDoDia = new Set();
    agendasDoDia.forEach((agenda) => {
      // Lógica de 'inicio' e 'fim'
      const [hInicio, mInicio] = agenda.inicio.split(":").map(Number);
      const [hFim, mFim] = agenda.fim.split(":").map(Number);
      const inicioEmMinutos = hInicio * 60 + mInicio;
      const fimEmMinutos = hFim * 60 + mFim;

      for (
        let minutos = inicioEmMinutos;
        minutos < fimEmMinutos;
        minutos += 30 // Assumindo slots de 30 min
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

    // 3. Buscar agendamentos existentes para marcar como ocupados
    const agendamentosQuery = query(
      collection(db, "agendamentos"), // Coleção correta
      where("data", "==", dataISO),
      where("tipo", "==", "reavaliacao"), // Filtra por tipo
      where("modalidade", "==", modalidade), // Filtra por modalidade
      where("status", "in", ["agendado", "confirmado"]) // Considera agendado ou confirmado como ocupado
    );
    const agendamentosSnapshot = await getDocs(agendamentosQuery);
    const horariosOcupados = new Set(
      agendamentosSnapshot.docs.map((doc) => doc.data().hora)
    ); // Usa Set para busca rápida

    // 4. Renderizar os slots
    let slotsHtml = "";
    slotsOrdenados.forEach((hora) => {
      if (horariosOcupados.has(hora)) {
        // Verifica se está no Set
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

// *** ALTERADO: handleReavaliacaoSubmit para criar na coleção 'solicitacoes' ***
export async function handleReavaliacaoSubmit(evento) {
  evento.preventDefault();
  const modal = document.getElementById("reavaliacao-modal");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Enviando...";

  try {
    // 1. Coletar dados do formulário e contexto
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

    // 2. Validação Mínima (Motivo é obrigatório)
    if (!motivo) {
      throw new Error("Por favor, preencha o motivo da reavaliação.");
    }

    // 3. Preparar objeto para salvar em "solicitacoes"
    const solicitacaoData = {
      tipo: "reavaliacao", // Tipo da solicitação
      status: "Pendente", // Status inicial
      dataSolicitacao: serverTimestamp(), // Data/Hora atual
      // Dados do solicitante (Voluntário)
      solicitanteId: currentUserData.uid, // Usa o UID do usuário logado
      solicitanteNome: currentUserData.nome,
      // Dados do Paciente
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      // ID do atendimento PB atual (se houver)
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      // Detalhes específicos da solicitação de reavaliação
      detalhes: {
        motivo: motivo,
        valorContribuicaoAtual: valorAtual,
        // Informações de preferência de agendamento (opcional, mas útil para o admin)
        preferenciaAgendamento: {
          modalidade: modalidadePref || null,
          data: dataPref || null,
          hora: horaPref || null,
        },
      },
      adminFeedback: null, // Campo para resposta do admin
    };

    // 4. Salvar na coleção "solicitacoes"
    await addDoc(collection(db, "solicitacoes"), solicitacaoData);

    console.log("Solicitação de reavaliação criada:", solicitacaoData);

    // 5. Sucesso - NÃO altera mais o status do paciente aqui
    alert(
      "Solicitação de reavaliação enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none";
    // location.reload(); // Não precisa recarregar a página aqui
  } catch (error) {
    console.error("Erro ao enviar solicitação de reavaliação:", error);
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // 6. Resetar botão
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Enviar Solicitação";
  }
}
// *** FIM DA ALTERAÇÃO ***

// --- Lógica do Modal de Desfecho PB ---

export async function abrirModalDesfechoPb(
  paciente,
  atendimento,
  { userData }
) {
  // Recebe userData
  // Armazena dados no escopo do módulo
  currentUserData = userData;
  currentPacienteData = paciente;
  currentAtendimentoData = atendimento; // Garante que temos o atendimento PB aqui

  const modal = document.getElementById("desfecho-pb-modal");
  const body = document.getElementById("desfecho-pb-modal-body");
  const footer = document.getElementById("desfecho-pb-modal-footer");

  body.innerHTML = '<div class="loading-spinner"></div>';
  footer.style.display = "none";
  modal.style.display = "block";

  try {
    // Usa currentAtendimentoData
    if (!currentAtendimentoData) {
      throw new Error(
        "Dados do atendimento específico (PB) não foram encontrados. Não é possível registrar o desfecho."
      );
    }

    const response = await fetch("../page/form-atendimento-pb.html"); // Mantém o fetch do HTML
    if (!response.ok)
      throw new Error(
        "Arquivo do formulário de desfecho (form-atendimento-pb.html) não encontrado."
      );

    body.innerHTML = await response.text();
    footer.style.display = "flex";

    const form = body.querySelector("#form-atendimento-pb");
    // Remove os data attributes se não forem mais necessários diretamente no form
    // form.dataset.pacienteId = currentPacienteData.id;
    // form.dataset.atendimentoId = currentAtendimentoData.atendimentoId;

    // Preenche o formulário usando current...Data
    form.querySelector("#profissional-nome").value =
      currentAtendimentoData.profissionalNome || currentUserData.nome; // Fallback para nome do user logado
    form.querySelector("#paciente-nome").value =
      currentPacienteData.nomeCompleto;
    form.querySelector("#valor-contribuicao").value =
      currentPacienteData.valorContribuicao || "Não definido";
    form.querySelector("#data-inicio-atendimento").value =
      currentAtendimentoData.horarioSessao?.dataInicio
        ? new Date(
            currentAtendimentoData.horarioSessao.dataInicio + "T03:00:00"
          ).toLocaleDateString("pt-BR")
        : "N/A";

    // Lógica dos campos condicionais (mantida)
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
      // Torna campos required/not required dinamicamente
      form.querySelector("#motivo-alta-desistencia").required = [
        "Alta",
        "Desistencia",
      ].includes(desfechoSelect.value);
      form.querySelector("#encaminhado-para").required =
        desfechoSelect.value === "Encaminhamento";
      form.querySelector("#motivo-encaminhamento").required =
        desfechoSelect.value === "Encaminhamento";
    });
    // Dispara o change inicial para garantir o estado correto
    desfechoSelect.dispatchEvent(new Event("change"));

    form.addEventListener("submit", handleDesfechoPbSubmit); // Mantém o listener
  } catch (error) {
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
    footer.style.display = "flex"; // Mostra footer mesmo com erro para botão Cancelar
    console.error(error);
  }
}

// *** ALTERADO: handleDesfechoPbSubmit para criar na coleção 'solicitacoes' ***
async function handleDesfechoPbSubmit(evento) {
  evento.preventDefault();
  const form = evento.target;
  const modal = form.closest(".modal-overlay"); // Encontra o modal pai
  const botaoSalvar = modal.querySelector("#btn-salvar-desfecho-submit");

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Enviando...";

  try {
    const desfechoTipo = form.querySelector("#desfecho-acompanhamento").value;
    if (!desfechoTipo) throw new Error("Selecione um tipo de desfecho.");

    // Coleta detalhes com base no tipo
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
      // Validação específica de encaminhamento
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
      // Validação específica de alta/desistência
      if (!detalhesDesfecho.motivo) {
        throw new Error(`O motivo é obrigatório para ${desfechoTipo}.`);
      }
    }
    // Adiciona data do desfecho (importante!)
    const dataDesfechoInput = form.querySelector("#data-desfecho"); // Assumindo que existe um input com id="data-desfecho"
    if (!dataDesfechoInput || !dataDesfechoInput.value) {
      throw new Error("A data do desfecho é obrigatória.");
    }
    detalhesDesfecho.dataDesfecho = dataDesfechoInput.value;

    // Prepara o objeto da solicitação
    const solicitacaoData = {
      tipo: "desfecho", // Tipo da solicitação
      status: "Pendente", // Status inicial - Admin precisa confirmar/processar
      dataSolicitacao: serverTimestamp(), // Data/Hora da submissão
      // Dados do solicitante (Voluntário)
      solicitanteId: currentUserData.uid,
      solicitanteNome: currentUserData.nome,
      // Dados do Paciente
      pacienteId: currentPacienteData.id,
      pacienteNome: currentPacienteData.nomeCompleto,
      // ID do atendimento PB
      atendimentoId: currentAtendimentoData?.atendimentoId || null,
      // Detalhes específicos da solicitação de desfecho
      detalhes: {
        tipoDesfecho: desfechoTipo,
        ...detalhesDesfecho, // Inclui os detalhes coletados (motivo ou dados de encaminhamento)
        sessoesRealizadas:
          form.querySelector("#quantidade-sessoes-realizadas")?.value || "N/A", // Adiciona qtd sessões se houver o campo
        observacoesGerais:
          form.querySelector("#observacoes-gerais")?.value || "", // Adiciona obs gerais se houver
      },
      adminFeedback: null, // Campo para resposta do admin
    };

    // Salva na coleção 'solicitacoes'
    await addDoc(collection(db, "solicitacoes"), solicitacaoData);

    console.log("Solicitação de desfecho criada:", solicitacaoData);
    alert("Registro de desfecho enviado com sucesso para o administrativo!");
    modal.style.display = "none";
    // location.reload(); // Recarregar pode não ser necessário imediatamente
  } catch (error) {
    console.error("Erro ao enviar solicitação de desfecho:", error);
    alert(`Falha ao enviar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar Desfecho";
  }
}
// *** FIM DA ALTERAÇÃO ***

// --- Funções Submit Originais (Encerramento Plantão, Horários PB) ---
// Mantidas caso ainda sejam usadas em algum fluxo, mas a lógica principal
// de solicitação foi movida para as funções acima.

export async function handleEncerramentoSubmit(evento, user, userData) {
  // Esta função parece ser do Plantão, não PB. Mantida como está por enquanto.
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
    : "encaminhar_para_pb"; // Ou outro status dependendo do encaminhamento

  // Coleta dados do formulário para o objeto 'encerramento'
  const encerramentoData = {
    responsavelId: user.uid,
    responsavelNome: userData.nome,
    encaminhamento: encaminhamentos,
    dataEncerramento: form.querySelector("#data-encerramento").value,
    sessoesRealizadas: form.querySelector("#quantidade-sessoes").value,
    pagamentoEfetuado: form.querySelector("#pagamento-contribuicao").value,
    motivoNaoPagamento:
      form.querySelector("#motivo-nao-pagamento").value || null, // Garante null se vazio
    relato: form.querySelector("#relato-encerramento").value,
    encerradoEm: serverTimestamp(), // Adiciona timestamp do encerramento
  };

  // Prepara a atualização do documento do paciente
  let dadosParaAtualizar = {
    status: novoStatus,
    "plantaoInfo.encerramento": encerramentoData, // Salva dentro de plantaoInfo
    lastUpdate: serverTimestamp(),
  };

  // Lógica da disponibilidade (mantida)
  const manterDisp = form.querySelector("#manter-disponibilidade").value;
  if (manterDisp === "nao") {
    const checkboxes = form.querySelectorAll(
      '#nova-disponibilidade-container input[type="checkbox"]:checked'
    );
    dadosParaAtualizar.disponibilidadeEspecifica = Array.from(checkboxes).map(
      (cb) => cb.value
    );
  } else if (
    manterDisp === "sim" &&
    !dadosDoPaciente.disponibilidadeEspecifica
  ) {
    // Se era pra manter e não tinha nada, pode ser necessário buscar do cadastro original
    console.warn(
      "Manter disponibilidade selecionado, mas não há dados anteriores."
    );
    // Poderia buscar do 'users' ou 'inscricoes' se necessário, mas complexifica.
    // Por ora, não faremos nada se for 'sim'.
  }

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
  // Esta função parece ser para *confirmar* o início do PB e definir o horário,
  // não para *solicitar* uma alteração posterior.
  // A lógica de updateDoc para 'trilhaPaciente' parece correta para este fluxo.
  // Mantida como está.

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

  try {
    // Adicionado try/catch em volta de getDoc
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error("Paciente não encontrado!");
    }

    const dadosDoPaciente = docSnap.data();
    // Usar || {} para segurança caso atendimentosPB não exista
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
    let novoStatusPaciente = dadosDoPaciente.status; // Mantém o status atual por padrão

    if (iniciou === "sim") {
      // Coleta os dados do horário definido
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
        definidoEm: serverTimestamp(), // Adiciona timestamp da definição do horário
      };

      // Validação dos campos obrigatórios do horário
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

      // Atualiza o objeto do atendimento específico
      atendimentos[indiceDoAtendimento].horarioSessao = horarioSessaoData;
      atendimentos[indiceDoAtendimento].status = "ativo"; // Marca o atendimento como ativo

      // Define o novo status do paciente
      novoStatusPaciente = "em_atendimento_pb"; // Paciente agora está em atendimento PB

      // Prepara a atualização
      dadosParaAtualizar = {
        atendimentosPB: atendimentos, // Array atualizado
        status: novoStatusPaciente, // Novo status geral do paciente
        lastUpdate: serverTimestamp(),
      };

      // --- ADICIONAL: Criar solicitação para Alterar/Incluir na Grade? ---
      // Se o voluntário pediu para alterar/incluir na grade, criamos uma solicitação para o admin
      if (horarioSessaoData.alterarGrade === "Sim") {
        const solicitacaoGradeData = {
          tipo: "inclusao_alteracao_grade", // Novo tipo específico
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: user.uid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: {
            ...horarioSessaoData, // Inclui todos os detalhes do horário definido
          },
          adminFeedback: null,
        };
        try {
          await addDoc(collection(db, "solicitacoes"), solicitacaoGradeData);
          console.log("Solicitação para inclusão/alteração na grade criada.");
        } catch (gradeError) {
          console.error("Erro ao criar solicitação para grade:", gradeError);
          // Não impede o fluxo principal, mas loga o erro.
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
        atendimentos[indiceDoAtendimento].status = "desistencia_antes_inicio"; // Status específico
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao;
        atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp(); // Data da informação
        novoStatusPaciente = "desistencia"; // Status geral do paciente
      } else {
        // "outra_modalidade" ou outro motivo que necessite reavaliação
        const detalhesSolicitacao = formulario.querySelector(
          "#detalhes-solicitacao-pb"
        ).value;
        if (!detalhesSolicitacao) {
          throw new Error("Por favor, detalhe a solicitação do paciente.");
        }
        atendimentos[indiceDoAtendimento].status =
          "solicitado_reencaminhamento"; // Status específico do atendimento
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoNaoInicio; // Guarda o motivo selecionado
        atendimentos[indiceDoAtendimento].solicitacaoReencaminhamento =
          detalhesSolicitacao; // Detalhes da solicitação
        atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp(); // Data da informação
        novoStatusPaciente = "reavaliar_encaminhamento"; // Status geral do paciente
      }
      dadosParaAtualizar = {
        atendimentosPB: atendimentos,
        status: novoStatusPaciente,
        lastUpdate: serverTimestamp(),
      };
    }

    // Atualiza o documento trilhaPaciente
    await updateDoc(docRef, dadosParaAtualizar);

    alert("Informações salvas com sucesso!");
    document.getElementById("horarios-pb-modal").style.display = "none";
    location.reload();
  } catch (error) {
    // Captura erros do getDoc e das validações
    console.error("Erro ao salvar informações de Horários PB:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    // Resetar texto do botão pode ser feito aqui se necessário
  }
}

// --- Funções Auxiliares e Fechamento de Modais (sem alterações) ---
// ... (código existente para construirFormularioHorarios, fechar modais, etc.) ...

// Adiciona listeners genéricos para fechar modais
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(
      ".modal-overlay .modal-cancel-btn, .modal .close-button, [data-close-modal]"
    )
    .forEach((button) => {
      button.addEventListener("click", () => {
        const modal = button.closest(".modal-overlay, .modal");
        if (modal) {
          modal.style.display = "none";
        }
      });
    });

  // Fechar ao clicar fora (para overlays)
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.style.display = "none";
      }
    });
  });

  // Adiciona listeners aos botões de submit dos modais que foram alterados
  const btnConfirmarSolicitacao = document.getElementById(
    "btn-confirmar-solicitacao"
  );
  if (btnConfirmarSolicitacao) {
    btnConfirmarSolicitacao.addEventListener(
      "click",
      handleSolicitarSessoesSubmit
    );
  }

  const btnConfirmarAlteracao = document.getElementById(
    "btn-confirmar-alteracao-horario"
  );
  if (btnConfirmarAlteracao) {
    btnConfirmarAlteracao.addEventListener("click", handleAlterarHorarioSubmit);
  }

  const btnConfirmarReavaliacao = document.getElementById(
    "btn-confirmar-reavaliacao"
  );
  if (btnConfirmarReavaliacao) {
    btnConfirmarReavaliacao.addEventListener("click", handleReavaliacaoSubmit);
  }

  // Listener para o submit do desfecho já está no form dentro de abrirModalDesfechoPb
  // Listener para o submit do encerramento plantão (form="encerramento-form")
  const formEncerramento = document.getElementById("encerramento-form");
  if (formEncerramento) {
    // Precisamos garantir que 'user' e 'userData' estejam disponíveis aqui
    // Isso pode exigir buscar do auth state no momento do submit ou
    // armazená-los globalmente/no módulo quando o usuário faz login.
    // Assumindo que estão disponíveis via uma função `getCurrentAuthData()`:
    // formEncerramento.addEventListener('submit', (e) => {
    //    const { user, userData } = getCurrentAuthData(); // Função hipotética
    //    handleEncerramentoSubmit(e, user, userData);
    // });
    // **COMENTADO POR ENQUANTO** - A chamada original pode estar em outro lugar (ex: events.js)
  }

  // Listener para o submit dos horários PB (form="horarios-pb-form")
  const formHorariosPb = document.getElementById("horarios-pb-form");
  if (formHorariosPb) {
    // Mesma questão do 'user' e 'userData' que acima
    // formHorariosPb.addEventListener('submit', (e) => {
    //    const { user, userData } = getCurrentAuthData(); // Função hipotética
    //    handleHorariosPbSubmit(e, user, userData);
    // });
    // **COMENTADO POR ENQUANTO** - A chamada original pode estar em outro lugar (ex: events.js)
  }
});
