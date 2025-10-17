// Arquivo: /modulos/voluntario/js/meus-pacientes/modals.js

import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  httpsCallable,
  functions,
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

  // CORREÇÃO: Busca o botão dentro do modal para garantir que o contexto está correto
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
    // CORREÇÃO: Esconde o botão ao voltar
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

  // CORREÇÃO: Busca o botão novamente no contexto correto
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
    label.textContent = `Preencha o campo "${labelText}":`;
    label.htmlFor = `var-${nomeVariavel}`;
    const input = document.createElement("input");

    if (nomeVariavel.toLowerCase().includes("data")) {
      input.type = "date";
    } else if (nomeVariavel.toLowerCase().includes("profissao")) {
      input.type = "text";
      if (userData.profissao) {
        input.value = userData.profissao;
      }
    } else {
      input.type = "text";
    }

    input.className = "form-control dynamic-var";
    input.id = `var-${nomeVariavel}`;
    input.dataset.variavel = variavel;
    input.oninput = () => atualizarPreviewMensagem();

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    formContainer.appendChild(formGroup);
  });

  atualizarPreviewMensagem();

  selecaoView.style.display = "none";
  formularioView.style.display = "block";

  // CORREÇÃO: Adiciona uma verificação para evitar erros e mostra o botão
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
    horarioSelect.innerHTML += `<option value="${i}">${hora}</option>`;
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
  const horario = document.getElementById("solicitar-horario").value;
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
  const footer = document.getElementById("desfecho-pb-modal-footer"); // Pega o rodapé

  body.innerHTML = '<div class="loading-spinner"></div>';
  footer.style.display = "none"; // Garante que o rodapé esteja escondido inicialmente
  modal.style.display = "block"; // Usa 'block' para modais antigos

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
    footer.style.display = "flex"; // Exibe o rodapé junto com o formulário

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

    // O evento de submit agora é ligado ao botão no rodapé do modal principal
    form.addEventListener("submit", handleDesfechoPbSubmit);
  } catch (error) {
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
    footer.style.display = "flex"; // Mostra o rodapé mesmo em caso de erro para poder fechar
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
    // --- CÓDIGO COMPLETO ---
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
      // motivoNaoInicio === "outra_modalidade"
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
  const botaoSalvar = form.querySelector("#btn-salvar-desfecho");
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
      if (!payload.motivo) {
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
    botaoSalvar.textContent = "Salvar";
  }
}
