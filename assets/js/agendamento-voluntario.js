// assets/js/agendamento-voluntario.js
// VERSÃO 3.2 - Correção: Múltiplos Agendamentos + Transação Segura + Dados de Contato

import { db as firestoreDb, auth } from "./firebase-init.js";
import {
  doc,
  getDoc,
  updateDoc,
  onAuthStateChanged,
  runTransaction,
} from "./firebase-init.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

let agendamentoId = null;
let agendamentoData = null;
let usuarioLogado = null;

// Aguardar autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioLogado = user;
    await carregarDadosUsuario();
    await inicializar();
  } else {
    salvarUrlERedirecionarParaLogin();
  }
});

function salvarUrlERedirecionarParaLogin() {
  const urlAtual = window.location.href;
  sessionStorage.setItem("redirectAfterLogin", urlAtual);

  const container = document.getElementById("main-container");
  container.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <h3 style="color: #003d7a; margin-bottom: 1rem;">Acesso Restrito</h3>
      <p style="margin-bottom: 1.5rem;">Você precisa estar logado para agendar uma reunião.</p>
      <button onclick="window.location.href='/index.html'" style="padding: 0.75rem 1.5rem; background: #003d7a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        Fazer Login
      </button>
    </div>
  `;
}

async function carregarDadosUsuario() {
  try {
    const userDoc = await getDoc(
      doc(firestoreDb, "usuarios", usuarioLogado.uid)
    );
    if (userDoc.exists()) {
      usuarioLogado.dadosCompletos = userDoc.data();
      console.log(
        "[AGENDAMENTO] Usuário identificado:",
        usuarioLogado.dadosCompletos.nome
      );
    } else {
      usuarioLogado.dadosCompletos = {};
    }
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar dados do usuário:", error);
    usuarioLogado.dadosCompletos = {};
  }
}

async function inicializar() {
  const urlParams = new URLSearchParams(window.location.search);
  agendamentoId = urlParams.get("agendamentoId");

  if (!agendamentoId) {
    mostrarErro("Link inválido. Nenhum agendamento foi especificado.");
    return;
  }

  await carregarAgendamento();
}

async function carregarAgendamento() {
  try {
    const agendamentoDoc = await getDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId)
    );

    if (!agendamentoDoc.exists()) {
      mostrarErro("Agendamento não encontrado.");
      return;
    }

    agendamentoData = agendamentoDoc.data();
    renderizarFormulario();
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar agendamento:", error);
    mostrarErro("Erro ao carregar informações da reunião.");
  }
}

function renderizarFormulario() {
  const container = document.getElementById("main-container");

  // Dados do usuário para exibição
  const nomeExibicao =
    usuarioLogado.dadosCompletos?.nome || usuarioLogado.email;
  const voluntarioInfo = `<div class="voluntario-info"><strong>Olá, ${nomeExibicao}!</strong></div>`;

  // Define se é limitado (Voluntário) ou ilimitado (Técnica)
  // Se a flag não existir (reunião antiga), assume limitado APENAS se for "Reunião com Voluntário"
  const ehLimitado =
    agendamentoData.vagasLimitadas !== undefined
      ? agendamentoData.vagasLimitadas
      : agendamentoData.tipo === "Reunião com Voluntário";

  let gestorInfo = "";
  if (
    agendamentoData.exibirGestor &&
    agendamentoData.slots &&
    agendamentoData.slots.length > 0
  ) {
    const gestoresUnicos = [
      ...new Set(
        agendamentoData.slots.map((s) => s.gestorNome).filter(Boolean)
      ),
    ];
    if (gestoresUnicos.length === 1) {
      gestorInfo = `<div class="gestor-info"><strong>Responsável: ${gestoresUnicos[0]}</strong></div>`;
    }
  }

  // Ordenar slots por data e hora
  agendamentoData.slots.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  const agora = new Date();

  // --- LÓGICA DE FILTRAGEM CORRIGIDA ---
  let slotsDisponiveis = agendamentoData.slots.filter((slot) => {
    // 1. Filtro de Tempo (12h antecedência)
    const [ano, mes, dia] = slot.data.split("-");
    const [horaIni, minIni] = slot.horaInicio.split(":");
    const dataInicioSlot = new Date(
      ano,
      mes - 1,
      parseInt(dia),
      parseInt(horaIni),
      parseInt(minIni)
    );
    const diferencaHoras = (dataInicioSlot - agora) / (1000 * 60 * 60);

    if (diferencaHoras < 12) return false;

    // 2. Filtro de Duplicidade (Usuário já inscrito neste slot específico)
    const jaInscrito = (slot.vagas || []).some(
      (v) => v.profissionalId === usuarioLogado.uid
    );
    if (jaInscrito) return false;

    // 3. Filtro de Capacidade (CORREÇÃO PRINCIPAL)
    if (ehLimitado) {
      // Se for limitado (1:1), esconde se tiver >= 1 inscrito
      return !slot.vagas || slot.vagas.length < 1;
    } else {
      // Se for ilimitado (Reunião Técnica), SEMPRE mostra, independente de quantos tem
      return true;
    }
  });

  // Mensagens de erro/sucesso caso não haja slots
  if (slotsDisponiveis.length === 0) {
    // Verifica se o usuário já se inscreveu em algum slot desta reunião
    const jaInscritoGeral = agendamentoData.slots.some((s) =>
      (s.vagas || []).some((v) => v.profissionalId === usuarioLogado.uid)
    );

    if (jaInscritoGeral) {
      container.innerHTML = `
            <div class="header"><h1>${
              agendamentoData.tipo || "Agendamento"
            }</h1></div>
            <div>${voluntarioInfo}</div>
            <div class="success-message" style="margin-top:20px;">
                <h3>Você já está inscrito!</h3>
                <p>Sua inscrição foi confirmada. Verifique seu e-mail.</p>
            </div>
        `;
    } else {
      container.innerHTML = `
            <div class="header"><h1>${
              agendamentoData.tipo || "Agendamento"
            }</h1></div>
            <div>${voluntarioInfo}</div>
            <div class="error-message">
                Desculpe, todos os horários já foram preenchidos ou estão muito próximos.
            </div>
        `;
    }
    return;
  }

  // Renderiza slots
  const slotsHTML = slotsDisponiveis
    .map((slot, index) => {
      let gestorTexto = "";
      if (agendamentoData.exibirGestor && slot.gestorNome) {
        gestorTexto = `<span class="slot-gestor">com ${slot.gestorNome}</span>`;
      }

      // Se for ilimitado, mostra quantos já vão (opcional, mas bom para grupos)
      let infoExtra = "";
      if (!ehLimitado) {
        const count = slot.vagas ? slot.vagas.length : 0;
        if (count > 0)
          infoExtra = `<span style="font-size:0.8em; color:#666; margin-left:10px;">(${count} participantes confirmados)</span>`;
      }

      // Encontrar índice original para referência correta
      const originalIndex = agendamentoData.slots.indexOf(slot);

      return `
            <label class="slot-option">
                <input type="radio" name="slot" value="${originalIndex}" 
                       data-data="${slot.data}" 
                       data-hora-inicio="${slot.horaInicio}" 
                       data-hora-fim="${slot.horaFim}" 
                       data-gestor-id="${slot.gestorId}" 
                       data-gestor-nome="${slot.gestorNome}">
                <div class="slot-info">
                    <span class="slot-date">${formatarData(slot.data)}</span>
                    <span class="slot-time">${slot.horaInicio} - ${
        slot.horaFim
      }</span>
                    ${gestorTexto}
                    ${infoExtra}
                </div>
            </label>
        `;
    })
    .join("");

  container.innerHTML = `
        <div class="header">
            <h1>${agendamentoData.tipo || "Agendamento"}</h1>
        </div>
        <div>${voluntarioInfo}</div>
        ${gestorInfo}
        <div class="descricao" style="white-space: pre-line;">${
          agendamentoData.descricao || ""
        }</div>
        <div class="slots-section">
            <h3>Escolha o melhor horário para você</h3>
            <div class="slots-grid">
                ${slotsHTML}
            </div>
        </div>
        <div>
            <form id="form-agendamento">
                <button type="submit" class="btn-confirmar">Confirmar Inscrição</button>
            </form>
        </div>
    `;

  document
    .querySelectorAll('.slot-option input[type="radio"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        document
          .querySelectorAll(".slot-option")
          .forEach((opt) => opt.classList.remove("selected"));
        radio.closest(".slot-option").classList.add("selected");
      });
    });

  document
    .getElementById("form-agendamento")
    .addEventListener("submit", confirmarAgendamento);
}

async function confirmarAgendamento(e) {
  e.preventDefault();

  const slotSelecionado = document.querySelector('input[name="slot"]:checked');
  if (!slotSelecionado) {
    alert("Por favor, selecione um horário.");
    return;
  }

  const slotIndex = parseInt(slotSelecionado.value);
  const dataEvento = slotSelecionado.dataset.data;
  const horaInicio = slotSelecionado.dataset.horaInicio;
  const horaFim = slotSelecionado.dataset.horaFim;
  const gestorNome = slotSelecionado.dataset.gestorNome;
  const gestorId = slotSelecionado.dataset.gestorId; // Importante para o e-mail

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Processando...";

  try {
    const docRef = doc(firestoreDb, "agendamentos_voluntarios", agendamentoId);

    // --- TRANSAÇÃO SEGURA PARA CONCORRÊNCIA ---
    await runTransaction(firestoreDb, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw "O agendamento não existe mais.";
      }

      const dadosAtuais = docSnap.data();
      const slotAlvo = dadosAtuais.slots[slotIndex];

      if (!slotAlvo) {
        throw "O horário selecionado não está mais disponível.";
      }

      // Verifica capacidade novamente dentro da transação
      const ehLimitado =
        dadosAtuais.vagasLimitadas !== undefined
          ? dadosAtuais.vagasLimitadas
          : dadosAtuais.tipo === "Reunião com Voluntário";

      if (ehLimitado && slotAlvo.vagas && slotAlvo.vagas.length >= 1) {
        throw "Desculpe, a vaga foi preenchida por outra pessoa neste exato momento.";
      }

      // Prepara dados do inscrito
      if (!slotAlvo.vagas) slotAlvo.vagas = [];

      // Garante que o contato está preenchido
      const telefoneUsuario =
        usuarioLogado.dadosCompletos?.contato || "Não informado";
      const nomeUsuario =
        usuarioLogado.dadosCompletos?.nome || usuarioLogado.email;

      slotAlvo.vagas.push({
        id: Date.now().toString(),
        profissionalId: usuarioLogado.uid,
        profissionalNome: nomeUsuario,
        nome: nomeUsuario,
        email: usuarioLogado.email || "Não informado",
        telefone: telefoneUsuario, // Campo crucial para o e-mail
        presente: false,
        inscritoEm: new Date().toISOString(),
      });

      // Salva a alteração
      transaction.update(docRef, { slots: dadosAtuais.slots });
    });

    // Se chegou aqui, a transação funcionou. Envia o e-mail manual (fallback/gestor)
    await enviarEmailParaGestor({
      gestorId,
      gestorNome,
      voluntarioNome: usuarioLogado.dadosCompletos?.nome || "Sem nome",
      data: dataEvento,
      horaInicio,
      horaFim,
    });

    mostrarSucesso(dataEvento, horaInicio, horaFim, gestorNome);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro:", error);
    // Se o erro for uma string (nossa validação), mostra alerta amigável
    const msg =
      typeof error === "string"
        ? error
        : "Erro ao confirmar agendamento. Tente novamente.";
    alert(msg);
    if (msg.includes("vaga foi preenchida")) {
      window.location.reload(); // Recarrega para atualizar a lista
    }
    btn.disabled = false;
    btn.textContent = "Confirmar Inscrição";
  }
}

// Envio de e-mail Client-Side (Fallback/Gestor)
async function enviarEmailParaGestor(dados) {
  // Nota: O Cloud Function (index.js) também dispara e-mails automáticos ao detectar mudança no banco.
  // Esta função garante que o processo de UI não trave, apenas loga ou dispara backup se necessário.
  try {
    if (!dados.gestorId) return;
    const userSnap = await getDoc(doc(firestoreDb, "usuarios", dados.gestorId));
    if (userSnap.exists()) {
      const emailGestor = userSnap.data().email;
      if (emailGestor) {
        const functions = getFunctions();
        const enviarEmail = httpsCallable(functions, "enviarEmail");
        // Dispara sem await para não travar a tela de sucesso
        enviarEmail({
          destinatario: emailGestor,
          assunto: `📅 Novo Agendamento: ${dados.voluntarioNome}`,
          html: `<p>Novo inscrito: <strong>${
            dados.voluntarioNome
          }</strong><br>Data: ${formatarData(dados.data)}<br>Hora: ${
            dados.horaInicio
          }</p>`,
        }).catch((err) => console.error("Erro email fallback:", err));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function mostrarSucesso(data, horaInicio, horaFim, gestorNome) {
  const container = document.getElementById("main-container");

  const linkCalendar = gerarLinkGoogleCalendar(
    `${agendamentoData.tipo} - EuPsico`,
    `Inscrição confirmada para ${agendamentoData.tipo}.\n\nO link será enviado por WhatsApp.`,
    data,
    horaInicio,
    horaFim
  );

  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Inscrição Confirmada!</h2>
      <p><strong>Data:</strong> ${formatarData(data)}</p>
      <p><strong>Horário:</strong> ${horaInicio} - ${horaFim}</p>
      ${gestorNome ? `<p><strong>Responsável:</strong> ${gestorNome}</p>` : ""}
      
      <div style="margin-top: 2rem; padding: 1rem; background: #f0f9ff; border: 2px solid #4285f4; border-radius: 8px;">
        <a href="${linkCalendar}" target="_blank" style="display: inline-block; background: #4285f4; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Adicionar ao Google Calendar
        </a>
      </div>
      <p style="margin-top: 1.5rem; color: #666;">Você receberá um e-mail de confirmação em breve.</p>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px;">Voltar</button>
    </div>
  `;
}

function mostrarErro(mensagem) {
  const container = document.getElementById("main-container");
  container.innerHTML = `<div class="error-message"><h2>Erro</h2><p>${mensagem}</p></div>`;
}

function gerarLinkGoogleCalendar(titulo, descricao, data, horaInicio, horaFim) {
  if (!data) return "#";
  const [ano, mes, dia] = data.split("-");
  const [horaIni, minIni] = horaInicio.split(":");
  const [horaFimStr, minFim] = horaFim.split(":");
  const dataInicio = `${ano}${mes}${dia}T${horaIni}${minIni}00`;
  const dataFimFormatada = `${ano}${mes}${dia}T${horaFimStr}${minFim}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${dataInicio}/${dataFimFormatada}`,
    details: descricao,
    location: "Online",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function obterDiaSemana(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  const data = new Date(ano, mes - 1, dia);
  const diasSemana = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  return diasSemana[data.getDay()];
}

function formatarData(dataISO) {
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  const diaSemana = obterDiaSemana(dataISO);
  return `${diaSemana}, ${dia}/${mes}/${ano}`;
}
