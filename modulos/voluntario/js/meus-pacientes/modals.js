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

// --- Lógica do Modal de Mensagens ---

// Guarda os dados temporariamente enquanto o modal está aberto
let dadosParaMensagem = {};

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

  // Salva os dados para serem usados pelas outras funções do modal
  dadosParaMensagem = { paciente, atendimento, systemConfigs, userData };

  nomePacienteSpan.textContent = paciente.nomeCompleto;
  listaModelos.innerHTML = ""; // Limpa a lista anterior

  // Garante que a view de seleção esteja visível e o formulário oculto
  selecaoView.style.display = "block";
  formularioView.style.display = "none";

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
      // Altera o onclick para chamar a função que preenche o formulário
      btn.onclick = () => preencherFormularioMensagem(key, title);
      listaModelos.appendChild(btn);
    }
  }
  modal.style.display = "flex";

  // Adiciona o listener para o botão de voltar
  document.getElementById("btn-voltar-selecao").onclick = () => {
    selecaoView.style.display = "block";
    formularioView.style.display = "none";
  };
}

function preencherFormularioMensagem(templateKey, templateTitle) {
  const { paciente, atendimento, systemConfigs, userData } = dadosParaMensagem;

  const selecaoView = document.getElementById("mensagem-selecao-view");
  const formularioView = document.getElementById("mensagem-formulario-view");
  const formTitle = document.getElementById("mensagem-form-title");
  const previewTextarea = document.getElementById("output-mensagem-preview");

  formTitle.textContent = templateTitle;

  let msgTemplate = systemConfigs.textos[templateKey] || "";

  // Substituições padrão
  msgTemplate = msgTemplate
    .replace(/{p}/g, paciente.nomeCompleto)
    .replace(/{nomePaciente}/g, paciente.nomeCompleto)
    .replace(/{t}/g, userData.nome)
    .replace(/{saudacao}/g, "Olá");

  // Substituição específica para o contrato
  if (templateKey === "envioContrato" && atendimento) {
    const contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${paciente.id}&atendimentoId=${atendimento.atendimentoId}`;
    msgTemplate = msgTemplate.replace(/{contractUrl}/g, contractUrl);
  }

  previewTextarea.value = msgTemplate;

  // Alterna as views
  selecaoView.style.display = "none";
  formularioView.style.display = "block";
}

// **NOVA FUNÇÃO:** Lida com o envio da mensagem
export function handleMensagemSubmit() {
  const { paciente } = dadosParaMensagem;
  const telefone = paciente.telefoneCelular?.replace(/\D/g, "");
  const mensagem = document.getElementById("output-mensagem-preview").value;
  const modal = document.getElementById("enviar-mensagem-modal");

  if (telefone && mensagem) {
    window.open(
      `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
    modal.style.display = "none";
  } else {
    alert(
      "Não foi possível gerar o link. Verifique o telefone do paciente e a mensagem."
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
  document.getElementById("solicitar-sessoes-form").reset();

  document.getElementById("solicitar-profissional-nome").value = userData.nome;
  document.getElementById("solicitar-paciente-nome").value =
    paciente.nomeCompleto;
  document.getElementById("solicitar-paciente-id").value = paciente.id;
  document.getElementById("solicitar-atendimento-id").value =
    atendimento.atendimentoId;

  const horarioSelect = document.getElementById("solicitar-horario");
  horarioSelect.innerHTML = "";
  for (let i = 7; i <= 21; i++) {
    const hora = `${String(i).padStart(2, "0")}:00`;
    horarioSelect.innerHTML += `<option value="${i}">${hora}</option>`;
  }

  const salaSelect = document.getElementById("solicitar-sala");
  salaSelect.innerHTML = '<option value="Online">Online</option>';
  salasPresenciais.forEach((sala) => {
    salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
  });

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

// **NOVA FUNÇÃO:** Lida com o submit da solicitação de novas sessões
export function handleSolicitarSessoesSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("solicitar-sessoes-form");
  const modal = document.getElementById("solicitar-sessoes-modal");

  // Validação do formulário
  if (form.checkValidity() === false) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    // Adiciona uma classe para destacar campos inválidos, se desejar.
    form.classList.add("was-validated");
    return;
  }

  // Se o formulário for válido
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
    const salaIndex = salasPresenciais.indexOf(sala);
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

// --- Lógica dos Modais Originais (sem alterações) ---

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

  return `<div class="form-group"><label>Nome Profissional:</label><input type="text" value="${nomeProfissional}" class="form-control" readonly></div>
    <div class="form-group"><label for="dia-semana-pb">Dia da semana:</label><select id="dia-semana-pb" class="form-control" required><option value="">Selecione...</option><option>Segunda-feira</option><option>Terça-feira</option><option>Quarta-feira</option><option>Quinta-feira</option><option>Sexta-feira</option><option>Sábado</option></select></div>
    <div class="form-group"><label for="horario-pb">Horário:</label><select id="horario-pb" class="form-control" required><option value="">Selecione...</option>${horasOptions}</select></div>
    <div class="form-group"><label for="tipo-atendimento-pb-voluntario">Tipo de atendimento:</label><select id="tipo-atendimento-pb-voluntario" class="form-control" required><option value="">Selecione...</option><option>Presencial</option><option>Online</option></select></div>
    <div class="form-group"><label for="alterar-grade-pb">Alterar/Incluir na grade?</label><select id="alterar-grade-pb" class="form-control" required><option value="">Selecione...</option><option>Sim</option><option>Não</option></select></div>
    <div class="form-group"><label for="frequencia-atendimento-pb">Frequência:</label><select id="frequencia-atendimento-pb" class="form-control" required><option value="">Selecione...</option><option>Semanal</option><option>Quinzenal</option><option>Mensal</option></select></div>
    <div class="form-group"><label for="sala-atendimento-pb">Sala:</label><select id="sala-atendimento-pb" class="form-control" required><option value="">Selecione...</option>${salasOptions}</select></div>
    <div class="form-group"><label for="data-inicio-sessoes">Data de início:</label><input type="date" id="data-inicio-sessoes" class="form-control" required></div>
    <div class="form-group"><label for="observacoes-pb-horarios">Observações:</label><textarea id="observacoes-pb-horarios" rows="3" class="form-control"></textarea></div>`;
}

export async function abrirModalDesfechoPb(
  pacienteId,
  atendimentoId,
  dadosDoPaciente
) {
  const modal = document.getElementById("desfecho-pb-modal");
  const body = document.getElementById("desfecho-pb-modal-body");
  body.innerHTML = '<div class="loading-spinner"></div>';
  modal.style.display = "block";

  try {
    const response = await fetch("../page/form-atendimento-pb.html");
    if (!response.ok)
      throw new Error("HTML do formulário de desfecho não encontrado.");
    body.innerHTML = await response.text();

    const form = body.querySelector("#form-atendimento-pb");
    form.dataset.pacienteId = pacienteId;
    form.dataset.atendimentoId = atendimentoId;

    const meuAtendimento = dadosDoPaciente.atendimentosPB.find(
      (at) => at.atendimentoId === atendimentoId
    );

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
    body.innerHTML = `<p class="alert alert-error">${error.message}</p>`;
    console.error(error);
  }
}

// --- Funções de Submit dos Formulários (sem alterações) ---

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
    location.reload(); // Recarrega a página para atualizar a lista
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
    // ... (lógica de não início completa)
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
