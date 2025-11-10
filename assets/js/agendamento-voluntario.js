// assets/js/agendamento-voluntario.js
// VERSÃO 2.3 - Com envio de e-mail via Cloud Function e Google Calendar

import { db as firestoreDb, auth } from "./firebase-init.js";
import { doc, getDoc, updateDoc, onAuthStateChanged } from "./firebase-init.js";
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
        "[AGENDAMENTO] Usuário logado:",
        usuarioLogado.dadosCompletos.nome
      );
    }
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar dados do usuário:", error);
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
    console.log("[AGENDAMENTO] Dados carregados:", agendamentoData);

    renderizarFormulario();
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar agendamento:", error);
    mostrarErro("Erro ao carregar informações da reunião.");
  }
}

function renderizarFormulario() {
  const container = document.getElementById("main-container");
  const voluntarioInfo = `<div class="voluntario-info"><strong>Olá, ${usuarioLogado.dadosCompletos?.nome} (Voluntário)!</strong></div>`;

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
      gestorInfo = `<div class="gestor-info"><strong>Reunião com ${gestoresUnicos[0]}</strong></div>`;
    }
  }

  // Ordenar slots por data e hora
  agendamentoData.slots.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  // Filtrar slots com vagas disponíveis
  let slotsDisponiveis = agendamentoData.slots.filter(
    (slot) => !slot.vagas || slot.vagas.length < 1
  );

  // NOVA FILTRAGEM: Excluir slots com menos de 12 horas restantes
  const agora = new Date(); // Data/hora atual
  slotsDisponiveis = slotsDisponiveis.filter((slot) => {
    const [ano, mes, dia] = slot.data.split("-");
    const [horaIni, minIni] = slot.horaInicio.split(":");
    const dataInicioSlot = new Date(
      ano,
      mes - 1,
      parseInt(dia),
      parseInt(horaIni),
      parseInt(minIni)
    );

    const diferencaMs = dataInicioSlot - agora;
    const diferencaHoras = diferencaMs / (1000 * 60 * 60); // Converte para horas

    return diferencaHoras >= 12;
  });

  if (slotsDisponiveis.length === 0) {
    container.innerHTML = `
            <div class="header">
                <h1>Reunião Online com Voluntários</h1>
            </div>
            <div>${voluntarioInfo}</div>
            <div class="error-message">
                Desculpe, todos os horários já foram preenchidos ou estão muito próximos (menos de 12 horas).
            </div>
        `;
    return;
  }

  const slotsHTML = slotsDisponiveis
    .map((slot, index) => {
      let gestorTexto = "";
      if (agendamentoData.exibirGestor && slot.gestorNome) {
        gestorTexto = `<span class="slot-gestor">com ${slot.gestorNome}</span>`;
      }
      return `
            <label class="slot-option">
                <input type="radio" name="slot" value="${index}" 
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
                </div>
            </label>
        `;
    })
    .join("");

  container.innerHTML = `
        <div class="header">
            <h1>Reunião Online com Voluntários</h1>
        </div>
        <div>${voluntarioInfo}</div>
        ${gestorInfo}
        <div class="descricao">${agendamentoData.descricao}</div>
        <div class="slots-section">
            <h3>Escolha o melhor horário para você</h3>
            <div class="slots-grid">
                ${slotsHTML}
            </div>
        </div>
        <div>
            <form id="form-agendamento">
                <button type="submit" class="btn-confirmar">Confirmar Agendamento</button>
            </form>
        </div>
    `;

  // Adicionar eventos para seleção de slot
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

  const data = slotSelecionado.dataset.data;
  const horaInicioSelecionada = slotSelecionado.dataset.horaInicio;
  const horaFimSelecionada = slotSelecionado.dataset.horaFim;
  const gestorId = slotSelecionado.dataset.gestorId;
  const gestorNome = slotSelecionado.dataset.gestorNome;

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Confirmando...";

  try {
    const slotIndex = agendamentoData.slots.findIndex(
      (s) =>
        s.data === data &&
        s.horaInicio === horaInicioSelecionada &&
        s.horaFim === horaFimSelecionada
    );

    if (slotIndex === -1) {
      throw new Error("Slot não encontrado.");
    }

    const slot = agendamentoData.slots[slotIndex];

    if (!slot.vagas) {
      slot.vagas = [];
    }

    slot.vagas.push({
      id: Date.now().toString(),
      profissionalId: usuarioLogado.uid,
      profissionalNome: usuarioLogado.dadosCompletos?.nome || "Sem nome",
      presente: false,
      inscritoEm: new Date().toISOString(),
    });

    await updateDoc(
      doc(firestoreDb, "agendamentos_voluntarios", agendamentoId),
      {
        slots: agendamentoData.slots,
      }
    );

    // ✅ Enviar e-mail para o gestor
    await enviarEmailParaGestor({
      gestorId,
      gestorNome,
      voluntarioNome: usuarioLogado.dadosCompletos?.nome || "Sem nome",
      data,
      horaInicio: horaInicioSelecionada,
      horaFim: horaFimSelecionada,
    });

    mostrarSucesso(data, horaInicioSelecionada, horaFimSelecionada, gestorNome);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao confirmar agendamento:", error);
    alert("Erro ao confirmar agendamento. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Confirmar Agendamento";
  }
}

// ✅ NOVA FUNÇÃO: Enviar e-mail para o gestor
async function enviarEmailParaGestor(dados) {
  try {
    const gestorDoc = await getDoc(
      doc(firestoreDb, "usuarios", dados.gestorId)
    );

    if (!gestorDoc.exists()) {
      console.log("[AGENDAMENTO] Gestor não encontrado no Firestore");
      return;
    }

    const gestorEmail = gestorDoc.data().email;

    if (!gestorEmail) {
      console.log("[AGENDAMENTO] Gestor não tem e-mail cadastrado");
      return;
    }

    const linkCalendar = gerarLinkGoogleCalendar(
      `Reunião com ${dados.voluntarioNome}`,
      "Reunião individual com voluntário - EuPsico",
      dados.data,
      dados.horaInicio,
      dados.horaFim
    );

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #003d7a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #003d7a; border-radius: 4px; }
          .button { display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎉 Novo Agendamento Confirmado!</h2>
          </div>
          <div class="content">
            <p>Olá, <strong>${dados.gestorNome}</strong>!</p>
            <p>Um voluntário acaba de agendar uma reunião individual com você.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #003d7a;">📋 Detalhes da Reunião</h3>
              <p><strong>Voluntário:</strong> ${dados.voluntarioNome}</p>
              <p><strong>Data:</strong> ${formatarData(dados.data)}</p>
              <p><strong>Horário:</strong> ${dados.horaInicio} - ${
      dados.horaFim
    }</p>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${linkCalendar}" class="button" target="_blank">
                📅 Adicionar ao Google Calendar
              </a>
            </div>
            
            <p style="background: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
              <strong>📝 Lembrete:</strong> O link do encontro online deve ser enviado por WhatsApp para o voluntário no dia agendado.
            </p>
          </div>
          <div class="footer">
            <p>Este é um e-mail automático da EuPsico.<br/>
            Para mais informações, acesse a intranet.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const functions = getFunctions();
    const enviarEmail = httpsCallable(functions, "enviarEmail");

    const resultado = await enviarEmail({
      destinatario: gestorEmail,
      assunto: `📅 Novo Agendamento - ${dados.voluntarioNome}`,
      html: htmlEmail,
    });

    console.log("[AGENDAMENTO] E-mail enviado com sucesso:", resultado.data);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao enviar e-mail:", error);
  }
}

function mostrarSucesso(data, horaInicio, horaFim, gestorNome) {
  const container = document.getElementById("main-container");

  const tituloEvento = gestorNome
    ? `Reunião Individual com ${gestorNome} - EuPsico`
    : "Reunião Individual - EuPsico";

  const linkGoogleCalendar = gerarLinkGoogleCalendar(
    tituloEvento,
    "Reunião individual com a gestão EuPsico. Link do encontro será enviado por WhatsApp.",
    data,
    horaInicio,
    horaFim
  );

  const gestorTexto = gestorNome
    ? `<p><strong>Gestor:</strong> ${gestorNome}</p>`
    : "";

  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Agendamento Confirmado!</h2>
      <p><strong>Voluntário:</strong> ${
        usuarioLogado.dadosCompletos?.nome || "Sem nome"
      }</p>
      <p><strong>Data:</strong> ${formatarData(data)}</p>
      <p><strong>Horário:</strong> ${horaInicio} - ${horaFim}</p>
      ${gestorTexto}
      
      <div style="margin-top: 2rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border: 2px solid #4285f4;">
        <p style="margin: 0 0 1rem 0; font-weight: 600; color: #003d7a;">
          📅 Adicione este compromisso à sua agenda:
        </p>
        <a href="${linkGoogleCalendar}" target="_blank" style="display: inline-block; background: #4285f4; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 600; transition: background 0.3s;">
          Adicionar ao Google Calendar
        </a>
      </div>
      
      <p style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107; color: #856404;">
        <strong>📝 Observação:</strong> O link para o encontro online será enviado por WhatsApp no dia agendado pelo gestor responsável.
      </p>
    </div>
  `;
}

function mostrarErro(mensagem) {
  const container = document.getElementById("main-container");
  container.innerHTML = `
    <div class="error-message">
      <h2>Erro</h2>
      <p>${mensagem}</p>
    </div>
  `;
}

// ✅ Função para gerar link do Google Calendar
function gerarLinkGoogleCalendar(titulo, descricao, data, horaInicio, horaFim) {
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
    location: "Online (Link será enviado por WhatsApp)",
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
