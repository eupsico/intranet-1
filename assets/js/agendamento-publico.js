// Arquivo: /assets/js/agendamento-publico.js
// Versão: 9.0 (Migração completa para a sintaxe modular do Firebase v9)

// 1. Importa as funções necessárias do nosso arquivo de configuração central
import { functions, httpsCallable } from "./firebase-init.js";

document.addEventListener("DOMContentLoaded", () => {
  const horariosContainer = document.getElementById("horarios-container");
  const agendamentoSection = document.getElementById("agendamento-section");
  const confirmacaoSection = document.getElementById("confirmacao-section");

  const modal = document.getElementById("agendamento-modal");
  const cpfInput = document.getElementById("paciente-cpf");
  const nomeInput = document.getElementById("paciente-nome");
  const telefoneInput = document.getElementById("paciente-telefone");
  const cpfFeedback = document.getElementById("cpf-feedback");

  let horarioSelecionado = null;
  let pacienteExistenteId = null;

  function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, "");
    if (cpf.startsWith("99")) return true; // Aceita CPF temporário
    if (cpf === "" || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    return true;
  }

  async function carregarHorarios() {
    try {
      // Usa a sintaxe v9 para chamar a Cloud Function
      const getHorarios = httpsCallable(functions, "getHorariosPublicos");
      const result = await getHorarios();
      const horarios = result.data.horarios;

      if (!horarios || horarios.length === 0) {
        horariosContainer.innerHTML =
          "<p>Não há horários disponíveis no momento. Por favor, tente novamente mais tarde.</p>";
        return;
      }

      renderizarHorarios(horarios);
    } catch (error) {
      console.error("Erro ao carregar horários:", error);
      horariosContainer.innerHTML = `<p style="color: red;"><strong>Erro ao carregar horários:</strong> ${error.message}</p><p>Tente recarregar a página.</p>`;
    }
  }

  function renderizarHorarios(horarios) {
    const horariosAgrupados = horarios.reduce((acc, horario) => {
      const modalidade = horario.modalidade || "Online";
      const dataFormatada = new Date(
        horario.data + "T03:00:00"
      ).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });

      if (!acc[modalidade]) acc[modalidade] = {};
      if (!acc[modalidade][dataFormatada]) acc[modalidade][dataFormatada] = [];

      acc[modalidade][dataFormatada].push(horario);
      return acc;
    }, {});

    let html = "";
    for (const modalidade in horariosAgrupados) {
      html += `<h3 class="modalidade-titulo">${modalidade}</h3>`;
      for (const data in horariosAgrupados[modalidade]) {
        html += `<div class="data-grupo"><h4>${data}</h4><div class="horarios-botoes">`;
        horariosAgrupados[modalidade][data].forEach((horario) => {
          const horarioCompleto = {
            id: horario.id,
            data: horario.data,
            hora: horario.hora,
            modalidade: horario.modalidade,
            unidade: horario.unidade,
            assistenteId: horario.assistenteId,
            assistenteNome: horario.assistenteNome,
          };
          const horarioDataString = JSON.stringify(horarioCompleto);
          html += `<button type="button" class="horario-btn" data-horario='${horarioDataString}'>${horario.hora}</button>`;
        });
        html += `</div></div>`;
      }
    }
    horariosContainer.innerHTML = html;

    horariosContainer.querySelectorAll(".horario-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        abrirModalConfirmacao(JSON.parse(btn.dataset.horario))
      );
    });
  }

  function abrirModalConfirmacao(horario) {
    horarioSelecionado = horario;
    pacienteExistenteId = null;

    cpfInput.value = "";
    nomeInput.value = "";
    telefoneInput.value = "";
    cpfFeedback.textContent = "";
    cpfFeedback.className = "";
    nomeInput.disabled = true; // Mantém desabilitado até o CPF ser validado
    telefoneInput.disabled = true;

    document.getElementById("modal-horario-selecionado").textContent =
      horario.hora;
    modal.style.display = "flex";
  }

  async function buscarPacientePorCPF() {
    const cpf = cpfInput.value.replace(/\D/g, "");

    cpfFeedback.textContent = "Verificando...";
    cpfFeedback.className = "";

    if (!validarCPF(cpf)) {
      cpfFeedback.textContent = "CPF inválido.";
      cpfFeedback.className = "error";
      return;
    }

    try {
      // Usa a sintaxe v9 para chamar a Cloud Function
      const verificarCpfExistente = httpsCallable(
        functions,
        "verificarCpfExistente"
      );
      const result = await verificarCpfExistente({ cpf: cpf });
      const data = result.data;

      if (data.exists) {
        nomeInput.value = data.dados.nomeCompleto;
        telefoneInput.value = data.dados.telefoneCelular;
        cpfFeedback.textContent = "Paciente encontrado.";
        cpfFeedback.className = "success";
        pacienteExistenteId = data.docId;
      } else {
        cpfFeedback.textContent =
          "CPF não encontrado. Preencha os dados para novo cadastro.";
        cpfFeedback.className = "warning"; // Um aviso em vez de erro
        nomeInput.disabled = false; // Habilita para novo cadastro
        telefoneInput.disabled = false; // Habilita para novo cadastro
        pacienteExistenteId = null;
      }
    } catch (error) {
      console.error("Erro ao buscar paciente:", error);
      cpfFeedback.textContent = "Erro ao buscar. Tente novamente.";
      cpfFeedback.className = "error";
    }
  }

  async function handleAgendamento() {
    const agendamentoButton = document.getElementById(
      "modal-confirm-agendamento-btn"
    );
    agendamentoButton.disabled = true;
    agendamentoButton.textContent = "Agendando...";

    try {
      const cpf = cpfInput.value.replace(/\D/g, "");
      const nome = nomeInput.value.trim();
      const telefone = telefoneInput.value.trim();

      if (!validarCPF(cpf) || !nome || !telefone) {
        throw new Error(
          "Por favor, preencha todos os campos obrigatórios com dados válidos."
        );
      }
      if (!horarioSelecionado?.assistenteId) {
        throw new Error(
          "Erro: dados do horário incompletos. Selecione novamente."
        );
      }

      const payload = {
        cpf: cpf,
        assistenteSocialId: horarioSelecionado.assistenteId,
        assistenteSocialNome: horarioSelecionado.assistenteNome,
        data: horarioSelecionado.data,
        hora: horarioSelecionado.hora,
        nomeCompleto: nome,
        telefone: telefone,
      };

      // Usa a sintaxe v9 para chamar a Cloud Function
      const agendarTriagem = httpsCallable(functions, "agendarTriagemPublico");
      const result = await agendarTriagem(payload);

      if (result.data.success) {
        exibirConfirmacaoFinal(nome);
      } else {
        throw new Error(
          result.data.message || "Erro desconhecido retornado pela função."
        );
      }
    } catch (error) {
      console.error("Erro no processo de agendamento:", error);
      alert(`Falha no agendamento: ${error.message}`);
    } finally {
      agendamentoButton.disabled = false;
      agendamentoButton.textContent = "Confirmar Agendamento";
    }
  }

  function exibirConfirmacaoFinal(nomePaciente) {
    modal.style.display = "none";
    document.getElementById("confirm-paciente-nome").textContent = nomePaciente;
    document.getElementById("confirm-assistente").textContent =
      horarioSelecionado.assistenteNome;
    document.getElementById("confirm-data").textContent = new Date(
      horarioSelecionado.data + "T03:00:00"
    ).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    document.getElementById("confirm-horario").textContent =
      horarioSelecionado.hora;

    agendamentoSection.style.display = "none";
    confirmacaoSection.style.display = "block";
  }

  // Configuração dos Event Listeners
  cpfInput.addEventListener("blur", buscarPacientePorCPF);
  modal
    .querySelector(".close-modal-btn")
    .addEventListener("click", () => (modal.style.display = "none"));
  document
    .getElementById("modal-cancel-btn")
    .addEventListener("click", () => (modal.style.display = "none"));
  document
    .getElementById("modal-confirm-agendamento-btn")
    .addEventListener("click", handleAgendamento);

  carregarHorarios();
});
