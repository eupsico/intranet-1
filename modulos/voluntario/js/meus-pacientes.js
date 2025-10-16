// Arquivo: /modulos/voluntario/js/meus-pacientes.js
// Versão: 7.0 (Integrado com as Configurações do Sistema para Mensagens)

import {
  db,
  functions,
  doc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  httpsCallable,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const container = document.getElementById("pacientes-cards-container");
  if (!container) {
    console.error("Container de pacientes não encontrado.");
    return;
  }

  let systemConfigs = null;

  async function loadSystemConfigs() {
    if (systemConfigs) return systemConfigs;
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        systemConfigs = docSnap.data();
        return systemConfigs;
      } else {
        console.warn("Documento de configurações não encontrado.");
        systemConfigs = { textos: {} };
        return systemConfigs;
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      systemConfigs = { textos: {} };
      return systemConfigs;
    }
  }

  const encerramentoModal = document.getElementById("encerramento-modal");
  const horariosPbModal = document.getElementById("horarios-pb-modal");
  const desfechoPbModal = document.getElementById("desfecho-pb-modal");

  const todosOsModais = [encerramentoModal, horariosPbModal, desfechoPbModal];
  document
    .querySelectorAll(
      ".modal .close-button, #modal-cancel-btn, [data-close-modal]"
    )
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        todosOsModais.forEach((modal) => {
          if (modal) modal.style.display = "none";
        });
      });
    });

  window.addEventListener("click", (evento) => {
    todosOsModais.forEach((modal) => {
      if (modal && evento.target === modal) {
        modal.style.display = "none";
      }
    });
  });

  async function carregarMeusPacientes() {
    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const queryPlantao = query(
        collection(db, "trilhaPaciente"),
        where("plantaoInfo.profissionalId", "==", user.uid),
        where("status", "==", "em_atendimento_plantao")
      );
      const queryPb = query(
        collection(db, "trilhaPaciente"),
        where("profissionaisPB_ids", "array-contains", user.uid)
      );

      const [plantaoSnapshot, pbSnapshot] = await Promise.all([
        getDocs(queryPlantao),
        getDocs(queryPb),
      ]);

      let cardsHtml = "";
      const pacientesProcessados = new Set();

      plantaoSnapshot.forEach((doc) => {
        const paciente = { id: doc.id, ...doc.data() };
        if (!pacientesProcessados.has(paciente.id)) {
          cardsHtml += criarCardPaciente(paciente);
          pacientesProcessados.add(paciente.id);
        }
      });

      pbSnapshot.forEach((doc) => {
        const paciente = { id: doc.id, ...doc.data() };
        const meuAtendimento = paciente.atendimentosPB?.find(
          (at) => at.profissionalId === user.uid
        );

        if (meuAtendimento && meuAtendimento.statusAtendimento === "ativo") {
          cardsHtml += criarCardPaciente(paciente, meuAtendimento);
        }
      });

      if (cardsHtml === "") {
        container.innerHTML =
          "<p>Você não tem pacientes designados nos estágios de atendimento ativo no momento.</p>";
        return;
      }

      container.innerHTML = cardsHtml;
      const cards = Array.from(container.querySelectorAll(".paciente-card"));
      cards.sort((a, b) =>
        a
          .querySelector("h4")
          .textContent.localeCompare(b.querySelector("h4").textContent)
      );
      cards.forEach((card) => container.appendChild(card));

      adicionarEventListeners();
    } catch (error) {
      console.error("Erro crítico em carregarMeusPacientes:", error);
      container.innerHTML = `<p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes.</p>`;
    }
  }

  function criarCardPaciente(dadosDoPaciente, atendimentoPB = null) {
    const isPlantao = !atendimentoPB;
    let statusKey = "em_atendimento_plantao";

    if (!isPlantao) {
      if (dadosDoPaciente.status === "aguardando_info_horarios") {
        statusKey = "aguardando_info_horarios";
      } else if (!atendimentoPB.contratoAssinado) {
        statusKey = "aguardando_contrato";
      } else {
        statusKey = "em_atendimento_pb";
      }
    }

    const mapaDeStatus = {
      em_atendimento_plantao: {
        label: "Em Atendimento (Plantão)",
        acao: "Encerrar Plantão",
        tipo: "plantao",
        ativo: true,
      },
      aguardando_info_horarios: {
        label: "Aguardando Info Horários (PB)",
        acao: "Informar Horários",
        tipo: "pb_horarios",
        ativo: true,
      },
      aguardando_contrato: {
        label: "Aguardando Contrato (PB)",
        acao: "Enviar Contrato",
        tipo: "contrato",
        ativo: true,
      },
      em_atendimento_pb: {
        label: "Em Atendimento (PB)",
        acao: "Registrar Desfecho",
        tipo: "desfecho_pb",
        ativo: true,
      },
    };

    const infoStatus = mapaDeStatus[statusKey] || {
      label: "Status Desconhecido",
      acao: "-",
      tipo: "info",
      ativo: false,
    };
    const dataEncaminhamento =
      atendimentoPB?.dataEncaminhamento ||
      dadosDoPaciente.plantaoInfo?.dataEncaminhamento
        ? new Date(
            (atendimentoPB?.dataEncaminhamento ||
              dadosDoPaciente.plantaoInfo?.dataEncaminhamento) + "T03:00:00"
          ).toLocaleDateString("pt-BR")
        : "N/A";

    const contratoAssinadoHtml = atendimentoPB?.contratoAssinado
      ? `<p class="contrato-assinado">✓ Contrato Assinado</p>`
      : "";

    const pdfButtonHtml =
      atendimentoPB && atendimentoPB.contratoAssinado
        ? `<button class="action-button secondary-button" data-id="${dadosDoPaciente.id}" data-atendimento-id="${atendimentoPB.atendimentoId}" data-tipo="pdf_contrato">PDF Contrato</button>`
        : "";
    const atendimentoIdAttr = atendimentoPB
      ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
      : "";

    return `
            <div class="paciente-card" data-id="${
              dadosDoPaciente.id
            }" data-telefone="${dadosDoPaciente.telefoneCelular || ""}">
                <h4>${dadosDoPaciente.nomeCompleto}</h4>
                <p><strong>Status:</strong> ${infoStatus.label}</p>
                <p><strong>Telefone:</strong> ${
                  dadosDoPaciente.telefoneCelular || "Não informado"
                }</p>
                <p><strong>Data Encaminhamento:</strong> ${dataEncaminhamento}</p>
                ${contratoAssinadoHtml}
                <div class="card-actions">
                    <button class="action-button" data-id="${
                      dadosDoPaciente.id
                    }" data-tipo="${infoStatus.tipo}" ${atendimentoIdAttr} ${
      !infoStatus.ativo ? "disabled" : ""
    }>${infoStatus.acao}</button>
                    ${pdfButtonHtml}
                </div>
            </div>`;
  }

  function adicionarEventListeners() {
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener("click", async (evento) => {
      const botao = evento.target.closest(".action-button:not([disabled])");
      if (!botao) return;

      const pacienteId = botao.dataset.id;
      const atendimentoId = botao.dataset.atendimentoId;
      const tipoDeAcao = botao.dataset.tipo;

      try {
        const docRef = doc(db, "trilhaPaciente", pacienteId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          alert("Paciente não encontrado!");
          return;
        }

        const dadosDoPaciente = { id: docSnap.id, ...docSnap.data() };
        const meuAtendimento = dadosDoPaciente.atendimentosPB?.find(
          (at) => at.atendimentoId === atendimentoId
        );

        switch (tipoDeAcao) {
          case "plantao":
            abrirModalEncerramento(pacienteId, dadosDoPaciente);
            break;
          case "pb_horarios":
            abrirModalHorariosPb(pacienteId, atendimentoId);
            break;
          case "contrato":
            const telefone = botao.closest(".paciente-card").dataset.telefone;
            handleEnviarContrato(
              pacienteId,
              atendimentoId,
              telefone,
              dadosDoPaciente.nomeCompleto
            );
            break;
          case "desfecho_pb":
            abrirModalDesfechoPb(pacienteId, atendimentoId, dadosDoPaciente);
            break;
          case "pdf_contrato":
            gerarPdfContrato(dadosDoPaciente, meuAtendimento);
            break;
        }
      } catch (error) {
        console.error("Erro ao processar ação do card:", error);
        alert("Ocorreu um erro ao buscar os dados do paciente.");
      }
    });
  }

  function handleEnviarContrato(
    pacienteId,
    atendimentoId,
    telefone,
    nomePaciente
  ) {
    const numeroLimpo = telefone ? telefone.replace(/\D/g, "") : "";
    if (!numeroLimpo || numeroLimpo.length < 10) {
      alert("O número de telefone do paciente não é válido.");
      return;
    }
    const contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${pacienteId}&atendimentoId=${atendimentoId}`;

    let template =
      systemConfigs.textos?.envioContrato ||
      `(Modelo 'envioContrato' não encontrado nas configurações)`;

    const mensagem = template
      .replace(/{nomePaciente}/g, nomePaciente)
      .replace(/{contractUrl}/g, contractUrl);

    const whatsappUrl = `https://api.whatsapp.com/send?phone=55${numeroLimpo}&text=${encodeURIComponent(
      mensagem
    )}`;
    window.open(whatsappUrl, "_blank");
  }

  document
    .getElementById("encerramento-form")
    .addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const form = evento.target;
      const botaoSalvar = encerramentoModal.querySelector(
        'button[type="submit"]'
      );
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
          pagamentoEfetuado: form.querySelector("#pagamento-contribuicao")
            .value,
          motivoNaoPagamento: form.querySelector("#motivo-nao-pagamento").value,
          relato: form.querySelector("#relato-encerramento").value,
        },
        lastUpdate: serverTimestamp(),
      };

      try {
        await updateDoc(
          doc(db, "trilhaPaciente", pacienteId),
          dadosParaAtualizar
        );
        alert("Encerramento salvo com sucesso!");
        encerramentoModal.style.display = "none";
        carregarMeusPacientes();
      } catch (error) {
        console.error("Erro ao salvar encerramento:", error);
        alert("Erro ao salvar.");
      } finally {
        botaoSalvar.disabled = false;
      }
    });

  document
    .getElementById("horarios-pb-form")
    .addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const formulario = evento.target;
      const botaoSalvar = horariosPbModal.querySelector(
        'button[type="submit"]'
      );
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
          frequencia: formulario.querySelector("#frequencia-atendimento-pb")
            .value,
          salaAtendimento: formulario.querySelector("#sala-atendimento-pb")
            .value,
          dataInicio: formulario.querySelector("#data-inicio-sessoes").value,
          observacoes: formulario.querySelector("#observacoes-pb-horarios")
            .value,
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

        atendimentos[indiceDoAtendimento].statusAtendimento = "encerrado";

        if (motivoNaoInicio === "desistiu") {
          const motivoTexto = formulario.querySelector(
            "#motivo-desistencia-pb"
          ).value;
          if (!motivoTexto) {
            alert("Por favor, descreva o motivo da desistência.");
            botaoSalvar.disabled = false;
            return;
          }
          atendimentos[
            indiceDoAtendimento
          ].motivoDesistencia = `Desistiu antes de iniciar PB. Motivo: ${motivoTexto}`;
          dadosParaAtualizar = {
            atendimentosPB: atendimentos,
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
          atendimentos[
            indiceDoAtendimento
          ].motivoDesistencia = `Retornou ao plantão por preferência do paciente.`;
          dadosParaAtualizar = {
            atendimentosPB: atendimentos,
            status: "encaminhar_para_plantao",
            logRetornoPlantao: {
              motivo: detalhesSolicitacao,
              data: serverTimestamp(),
              profissionalAnterior: userData.nome,
              tipo:
                motivoNaoInicio === "outro_horario"
                  ? "Preferência de Horário"
                  : "Preferência de Modalidade",
            },
            lastUpdate: serverTimestamp(),
          };
        }
      }

      try {
        await updateDoc(docRef, dadosParaAtualizar);
        alert("Informações salvas com sucesso!");
        horariosPbModal.style.display = "none";
        carregarMeusPacientes();
      } catch (error) {
        console.error("Erro ao salvar informações:", error);
        alert("Erro ao salvar. Tente novamente.");
      } finally {
        botaoSalvar.disabled = false;
      }
    });

  async function abrirModalEncerramento(pacienteId, dadosDoPaciente) {
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
          addDisponibilidadeListeners(novaDisponibilidadeContainer);
        } catch (error) {
          console.error("Erro ao carregar HTML da disponibilidade:", error);
          novaDisponibilidadeContainer.innerHTML =
            '<p class="alert alert-error">Erro ao carregar opções.</p>';
        }
      }
    };

    encerramentoModal.style.display = "block";
  }

  function addDisponibilidadeListeners(container) {
    const horariosCheckboxes = container.querySelectorAll(
      'input[name="horario"]'
    );
    horariosCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const periodo = e.target.value;
        const detalheContainer = container.querySelector(
          `#container-${periodo}`
        );
        if (e.target.checked) {
          gerarHorarios(periodo, detalheContainer);
          detalheContainer.classList.remove("hidden-section");
        } else {
          detalheContainer.innerHTML = "";
          detalheContainer.classList.add("hidden-section");
        }
      });
    });
  }

  function gerarHorarios(periodo, container) {
    let horarios = [],
      label = "";
    switch (periodo) {
      case "manha-semana":
        label = "Manhã (Seg-Sex):";
        for (let i = 8; i < 12; i++) horarios.push(`${i}:00`);
        break;
      case "tarde-semana":
        label = "Tarde (Seg-Sex):";
        for (let i = 12; i < 18; i++) horarios.push(`${i}:00`);
        break;
      case "noite-semana":
        label = "Noite (Seg-Sex):";
        for (let i = 18; i < 21; i++) horarios.push(`${i}:00`);
        break;
      case "manha-sabado":
        label = "Manhã (Sábado):";
        for (let i = 8; i < 13; i++) horarios.push(`${i}:00`);
        break;
    }
    let html = `<label class="horario-detalhe-label">${label}</label><div class="horario-detalhe-grid">`;
    horarios.forEach((hora) => {
      html += `<div><label><input type="checkbox" name="horario-especifico" value="${periodo}_${hora}"> ${hora}</label></div>`;
    });
    container.innerHTML = html + `</div>`;
  }

  function abrirModalHorariosPb(pacienteId, atendimentoId) {
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
            if (elemento.id !== "observacoes-pb-horarios") {
              elemento.required = mostrarFormulario;
            }
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

    horariosPbModal.style.display = "block";
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
    return `<div class="form-group">
  <label for="nome-profissional-pb">Nome Profissional:</label>
    <input type="text" id="nome-profissional-pb" class="form-control" value="${nomeProfissional}" readonly></div>
  <div class="form-group"><label for="dia-semana-pb">Informe o dia da semana:</label>
    <select id="dia-semana-pb" class="form-control" required>
    <option value="">Selecione...</option>
    <option value="Segunda-feira">Segunda-feira</option>
    <option value="Terça-feira">Terça-feira</option>
    <option value="Quarta-feira">Quarta-feira</option>
    <option value="Quinta-feira">Quinta-feira</option>
    <option value="Sexta-feira">Sexta-feira</option>
    <option value="Sábado">Sábado</option></select>
  </div>
  <div class="form-group">
    <label for="horario-pb">Selecione o horário:</label>
      <select id="horario-pb" class="form-control" required>
        <option value="">Selecione...</option>${horasOptions}</select>
  </div>
  <div class="form-group">
    <label for="tipo-atendimento-pb-voluntario">Tipo de atendimento:</label>
    <select id="tipo-atendimento-pb-voluntario" class="form-control" required>
      <option value="">Selecione...</option>
        <option value="Presencial">Presencial</option>
        <option value="Online">Online</option>
    </select>
  </div>
  <div class="form-group">
    <label for="alterar-grade-pb">Será preciso alterar ou incluir o novo horário na grade?</label>
    <select id="alterar-grade-pb" class="form-control" required>
      <option value="">Selecione...</option>
      <option value="Sim">Sim</option>
      <option value="Não">Não</option>
    </select>
  </div>
  <div class="form-group">
    <label for="frequencia-atendimento-pb">Frequência:</label>
    <select id="frequencia-atendimento-pb" class="form-control" required>
      <option value="">Selecione...</option>
      <option value="Semanal">Semanal</option>
      <option value="Quinzenal">Quinzenal</option>
      <option value="Mensal">Mensal</option>
    </select>
  </div>
  <div class="form-group">
  <label for="sala-atendimento-pb">Sala de atendimento:</label> <small style="display: block; margin-left: 25px; color: #666;">Selecione a opção  <strong>Online</strong> em salas para atendimento online.</small>
    <select id="sala-atendimento-pb" class="form-control" required>
      <option value="">Selecione...</option>
        ${salasOptions}</select>
      </div>
  <div class="form-group">
      <label for="data-inicio-sessoes">Data de início das sessões:</label>
      <input type="date" id="data-inicio-sessoes" class="form-control" required>
  </div>
  <div class="form-group">
  <label for="observacoes-pb-horarios">Observações:</label><textarea id="observacoes-pb-horarios" rows="3" class="form-control"></textarea></div>`;
  }

  async function abrirModalDesfechoPb(
    pacienteId,
    atendimentoId,
    dadosDoPaciente
  ) {
    const modal = document.getElementById("desfecho-pb-modal");
    const body = document.getElementById("desfecho-pb-modal-body");
    body.innerHTML = '<div class="loading-spinner"></div>';
    modal.style.display = "block";

    const response = await fetch("../page/form-atendimento-pb.html");
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
          continuaAtendimento: form.querySelector("#continua-atendimento")
            .value,
          relatoCaso: form.querySelector("#relato-caso").value,
        };
        if (!payload.encaminhamento.servico || !payload.encaminhamento.motivo) {
          throw new Error(
            "Para encaminhamento, preencha o serviço e o motivo."
          );
        }
      } else {
        payload.motivo = form.querySelector("#motivo-alta-desistencia").value;
        if (!payload.motivo) {
          throw new Error("O motivo é obrigatório para Alta ou Desistência.");
        }
      }

      const registrarDesfechoPb = httpsCallable(
        functions,
        "registrarDesfechoPb"
      );
      const result = await registrarDesfechoPb(payload);

      if (!result.data.success) {
        throw new Error(result.data.message || "Ocorreu um erro no servidor.");
      }

      alert("Desfecho registrado com sucesso!");
      document.getElementById("desfecho-pb-modal").style.display = "none";
      carregarMeusPacientes();
    } catch (error) {
      console.error("Erro ao salvar desfecho:", error);
      alert(`Falha ao salvar: ${error.message}`);
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
  }

  async function gerarPdfContrato(pacienteData, meuAtendimento) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - margin * 2;
      let cursorY = 15;

      const loadImageAsBase64 = async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(
        "CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS",
        pageWidth / 2,
        cursorY + 15,
        { align: "center" }
      );
      cursorY += 35;

      const addTextSection = (text, options = {}) => {
        const {
          size = 10,
          style = "normal",
          spaceBefore = 0,
          spaceAfter = 5,
        } = options;
        cursorY += spaceBefore;
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
        const lines = doc.splitTextToSize(text, usableWidth);
        const textHeight = doc.getTextDimensions(lines).h;
        if (cursorY + textHeight > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(lines, margin, cursorY);
        cursorY += textHeight + spaceAfter;
      };

      const response = await fetch("../../../public/contrato-terapeutico.html");
      const htmlString = await response.text();
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlString, "text/html");
      const contractContent = htmlDoc.getElementById("contract-content");

      contractContent.querySelectorAll("h2, h3, p, li, ol").forEach((el) => {
        if (el.closest(".data-section")) return;
        let text = el.textContent.trim();
        if (!text) return;
        const tagName = el.tagName.toLowerCase();
        if (tagName === "h2")
          addTextSection(text, {
            size: 12,
            style: "bold",
            spaceBefore: 5,
            spaceAfter: 4,
          });
        else if (tagName === "li" || tagName === "ol")
          addTextSection(`• ${text}`, { size: 10, spaceAfter: 3 });
        else addTextSection(text, { size: 10, spaceAfter: 5 });
      });

      const horarioInfo = meuAtendimento?.horarioSessao || {};
      const formatDate = (dateString) =>
        dateString
          ? new Date(dateString + "T03:00:00").toLocaleDateString("pt-BR")
          : "A definir";
      const formatCurrency = (value) =>
        value
          ? parseFloat(
              value.replace(/[^\d,]/g, "").replace(",", ".")
            ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "A definir";

      const addDataBox = (title, data) => {
        addTextSection(title, { size: 11, style: "bold", spaceBefore: 8 });
        const boxStartY = cursorY;
        data.forEach(([label, value]) =>
          addTextSection(`${label} ${value}`, { size: 10, spaceAfter: 2 })
        );
        doc.rect(
          margin - 2,
          boxStartY - 4,
          usableWidth + 4,
          cursorY - boxStartY,
          "S"
        );
        cursorY += 5;
      };

      addDataBox("Dados do Terapeuta e Paciente", [
        ["Terapeuta:", meuAtendimento?.profissionalNome || "A definir"],
        [
          "Nome completo do PACIENTE:",
          pacienteData.nomeCompleto || "Não informado",
        ],
        [
          "Nome do Responsável:",
          pacienteData.responsavel?.nome || "Não aplicável",
        ],
        [
          "Data de nascimento do PACIENTE:",
          formatDate(pacienteData.dataNascimento),
        ],
        [
          "Valor da contribuição mensal:",
          formatCurrency(pacienteData.valorContribuicao),
        ],
      ]);

      addDataBox("Dados da Sessão", [
        ["Dia da sessão:", horarioInfo.diaSemana || "A definir"],
        ["Horário do atendimento:", horarioInfo.horario || "A definir"],
        ["Tipo de atendimento:", horarioInfo.tipoAtendimento || "A definir"],
      ]);

      if (
        pacienteData.contratoAssinado &&
        pacienteData.contratoAssinado.assinadoEm
      ) {
        const assinatura = pacienteData.contratoAssinado;
        const dataAssinatura = assinatura.assinadoEm.toDate();
        const textoAssinatura = `Assinado digitalmente por ${
          assinatura.nomeSignatario
        } (CPF: ${
          assinatura.cpfSignatario
        }) em ${dataAssinatura.toLocaleDateString(
          "pt-BR"
        )} às ${dataAssinatura.toLocaleTimeString("pt-BR")}.`;
        const pageCount = doc.internal.getNumberOfPages();
        doc.setPage(pageCount);
        cursorY = pageHeight - 35;
        addTextSection("Contrato Assinado", {
          size: 12,
          style: "bold",
          spaceAfter: 4,
        });
        addTextSection(textoAssinatura, { size: 10, spaceAfter: 0 });
      }

      const logoUrl = "../../../assets/img/logo-eupsico.png";
      const logoBase64 = await loadImageAsBase64(logoUrl);
      if (logoBase64) {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setGState(
            new doc.GState({ opacity: 0.1, "stroke-opacity": 0.1 })
          );
          const imgWidth = 90;
          const x = (pageWidth - imgWidth) / 2;
          const y = (pageHeight - imgWidth) / 2;
          doc.addImage(
            logoBase64,
            "PNG",
            x,
            y,
            imgWidth,
            imgWidth,
            undefined,
            "FAST"
          );
          doc.setGState(new doc.GState({ opacity: 1, "stroke-opacity": 1 }));
        }
      }
      doc.save(`Contrato_${pacienteData.nomeCompleto.replace(/ /g, "_")}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF.");
    }
  }

  // Ponto de entrada
  await loadSystemConfigs();
  carregarMeusPacientes();
}
