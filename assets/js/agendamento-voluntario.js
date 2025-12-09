// assets/js/agendamento-voluntario.js
// VERSÃO 5.1 - Atualizado para coleção 'eventos' (Unificada)

import {
  db as firestoreDb,
  auth,
  runTransaction,
  doc,
  getDoc,
  updateDoc,
  onAuthStateChanged,
  getFunctions,
  httpsCallable,
} from "./firebase-init.js";

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
    // CORREÇÃO: Alterado de 'agendamentos_voluntarios' para 'eventos'
    const agendamentoDoc = await getDoc(
      doc(firestoreDb, "eventos", agendamentoId)
    );

    if (!agendamentoDoc.exists()) {
      mostrarErro("Agendamento não encontrado ou link expirado.");
      return;
    }

    agendamentoData = agendamentoDoc.data();
    renderizarFormulario();
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao carregar agendamento:", error);
    mostrarErro("Erro ao carregar informações da reunião: " + error.message);
  }
}

function renderizarFormulario() {
  const container = document.getElementById("main-container");

  const nomeExibicao =
    usuarioLogado.dadosCompletos?.nome || usuarioLogado.email;
  const voluntarioInfo = `<div class="voluntario-info"><strong>Olá, ${nomeExibicao}!</strong></div>`;

  // Configuração de Limite de Vagas
  const ehLimitado =
    agendamentoData.vagasLimitadas !== undefined
      ? agendamentoData.vagasLimitadas
      : agendamentoData.tipo === "Reunião com Voluntário";

  // Informação do Gestor (se único)
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

  // --- ORDENAÇÃO ---
  const slotsParaExibir = [...(agendamentoData.slots || [])];
  slotsParaExibir.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  const agora = new Date();

  // --- FILTRAGEM ---
  const slotsFiltrados = slotsParaExibir.filter((slot) => {
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

    // Ajuste: Permitir visualizar se já estiver inscrito, mesmo se faltar menos de 12h
    const souEu = (slot.vagas || []).some(
      (v) => v.profissionalId === usuarioLogado.uid
    );

    if (diferencaHoras < 12 && !souEu) return false;

    // 2. Filtro de Capacidade
    if (ehLimitado) {
      if (!souEu && slot.vagas && slot.vagas.length >= 1) {
        return false;
      }
    }
    return true;
  });

  if (slotsFiltrados.length === 0) {
    container.innerHTML = `
        <div class="header"><h1>${
          agendamentoData.tipo || "Agendamento"
        }</h1></div>
        <div>${voluntarioInfo}</div>
        <div class="error-message">Desculpe, todos os horários já foram preenchidos ou o prazo de inscrição encerrou.</div>
      `;
    return;
  }

  // Renderiza HTML
  const slotsHTML = slotsFiltrados
    .map((slot) => {
      // Recupera o índice ORIGINAL no array do banco
      const originalIndex = agendamentoData.slots.indexOf(slot);

      let gestorTexto = "";
      if (agendamentoData.exibirGestor && slot.gestorNome) {
        gestorTexto = `<span class="slot-gestor">com ${slot.gestorNome}</span>`;
      }

      // Verifica se é o agendamento atual do usuário
      const jaInscritoNesteSlot = (slot.vagas || []).some(
        (v) => v.profissionalId === usuarioLogado.uid
      );

      // Card Confirmado (Verde)
      if (jaInscritoNesteSlot) {
        return `
            <label class="slot-option disabled" style="background-color: #d1e7dd; border-color: #badbcc; cursor: pointer;">
                <input type="radio" name="slot" value="${originalIndex}" checked 
                       data-data="${slot.data}" 
                       data-hora-inicio="${slot.horaInicio}">
                <div class="slot-info">
                    <span class="slot-date">${formatarData(slot.data)}</span>
                    <span class="slot-time">${slot.horaInicio} - ${
          slot.horaFim
        }</span>
                    <span style="color: #0f5132; font-weight: bold; display: block; margin-top: 5px;">✓ Seu Agendamento Atual</span>
                </div>
            </label>
          `;
      }

      // Info extra para reuniões ilimitadas
      let infoExtra = "";
      if (!ehLimitado) {
        const count = slot.vagas ? slot.vagas.length : 0;
        if (count > 0)
          infoExtra = `<span style="font-size:0.8em; color:#666; margin-left:10px;">(${count} inscritos)</span>`;
      }

      // Card Disponível
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

  // Lógica de seleção visual
  document
    .querySelectorAll('.slot-option input[type="radio"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        document
          .querySelectorAll(".slot-option")
          .forEach((opt) => opt.classList.remove("selected"));

        const parent = radio.closest(".slot-option");
        if (!parent.classList.contains("disabled")) {
          parent.classList.add("selected");
        }
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

  const parentLabel = slotSelecionado.closest(".slot-option");
  if (parentLabel && parentLabel.classList.contains("disabled")) {
    alert("Você já está confirmado neste horário.");
    return;
  }

  const slotIndexNovo = parseInt(slotSelecionado.value);
  const dataNova = slotSelecionado.dataset.data;
  const horaInicioNova = slotSelecionado.dataset.horaInicio;
  const horaFimNova = slotSelecionado.dataset.horaFim;
  const gestorNomeNova = slotSelecionado.dataset.gestorNome;

  const slotAntigo = agendamentoData.slots.find((s) =>
    (s.vagas || []).some((v) => v.profissionalId === usuarioLogado.uid)
  );

  let confirmacaoTroca = true;

  if (slotAntigo) {
    const dataAntigaF = formatarData(slotAntigo.data);
    const horaAntigaF = slotAntigo.horaInicio;
    const dataNovaF = formatarData(dataNova);

    const mensagem = `Você já possui um agendamento para ${dataAntigaF} às ${horaAntigaF}.\n\nDeseja TROCAR para o dia ${dataNovaF} às ${horaInicioNova}?`;

    confirmacaoTroca = confirm(mensagem);
  }

  if (!confirmacaoTroca) return;

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Processando...";

  try {
    // CORREÇÃO: Alterado de 'agendamentos_voluntarios' para 'eventos'
    const docRef = doc(firestoreDb, "eventos", agendamentoId);

    await runTransaction(firestoreDb, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw "O agendamento não existe mais.";

      const dadosAtuais = docSnap.data();
      const slotAlvo = dadosAtuais.slots[slotIndexNovo];

      if (!slotAlvo) throw "O novo horário selecionado não existe mais.";

      const ehLimitado =
        dadosAtuais.vagasLimitadas !== undefined
          ? dadosAtuais.vagasLimitadas
          : dadosAtuais.tipo === "Reunião com Voluntário";

      if (ehLimitado && slotAlvo.vagas && slotAlvo.vagas.length >= 1) {
        throw "Desculpe, a vaga foi preenchida por outra pessoa neste exato momento.";
      }

      // 1. REMOVE do slot antigo
      dadosAtuais.slots.forEach((s) => {
        if (s.vagas) {
          const idx = s.vagas.findIndex(
            (v) => v.profissionalId === usuarioLogado.uid
          );
          if (idx !== -1) {
            s.vagas.splice(idx, 1);
          }
        }
      });

      // 2. ADICIONA no novo slot
      if (!slotAlvo.vagas) slotAlvo.vagas = [];

      const telefoneUsuario =
        usuarioLogado.dadosCompletos?.contato || "Não informado";
      const nomeUsuario =
        usuarioLogado.dadosCompletos?.nome || usuarioLogado.email;

      slotAlvo.vagas.push({
        id: Date.now().toString(),
        profissionalId: usuarioLogado.uid,
        profissionalNome: nomeUsuario,
        nome: nomeUsuario, // Manter compatibilidade com ambos os campos
        email: usuarioLogado.email || "Não informado",
        telefone: telefoneUsuario,
        presente: false,
        inscritoEm: new Date().toISOString(),
      });

      transaction.update(docRef, { slots: dadosAtuais.slots });
    });

    mostrarSucesso(dataNova, horaInicioNova, horaFimNova, gestorNomeNova);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro:", error);
    const msg =
      typeof error === "string" ? error : "Erro ao confirmar agendamento.";
    alert(msg);
    if (msg.includes("preenchida")) window.location.reload();
    btn.disabled = false;
    btn.textContent = "Confirmar Inscrição";
  }
}

function mostrarSucesso(data, horaInicio, horaFim, gestorNome) {
  const container = document.getElementById("main-container");
  const linkCalendar = gerarLinkGoogleCalendar(
    `${agendamentoData.tipo} - EuPsico`,
    `Inscrição confirmada.\nLink via WhatsApp.`,
    data,
    horaInicio,
    horaFim
  );

  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Agendamento Atualizado!</h2>
      <p><strong>Data:</strong> ${formatarData(data)}</p>
      <p><strong>Horário:</strong> ${horaInicio} - ${horaFim}</p>
      
      <div style="margin-top: 2rem; padding: 1rem; background: #f0f9ff; border: 2px solid #4285f4; border-radius: 8px;">
        <a href="${linkCalendar}" target="_blank" style="display: inline-block; background: #4285f4; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Adicionar ao Google Calendar
        </a>
      </div>
      <p style="margin-top: 1.5rem; color: #666;">O link da reunião será enviado no dia do encontro para o seu WhatsApp/E-mail de cadastro.</p>
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

function formatarData(dataISO) {
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}
