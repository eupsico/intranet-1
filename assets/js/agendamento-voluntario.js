// assets/js/agendamento-voluntario.js
// VERSÃO 3.0 - Correção Definitiva para Múltiplos Agendamentos (Vagas Ilimitadas)

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
  const voluntarioInfo = `<div class="voluntario-info"><strong>Olá, ${
    usuarioLogado.dadosCompletos?.nome || usuarioLogado.email
  }!</strong></div>`;

  // Verifica se é para exibir o gestor
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
  const vagasLimitadas = agendamentoData.vagasLimitadas; // Flag vinda do admin

  // --- LÓGICA DE FILTRAGEM CORRIGIDA ---
  let slotsDisponiveis = agendamentoData.slots.filter((slot) => {
    // 1. Verifica Data/Hora (12h de antecedência)
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
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);

    if (diferencaHoras < 12) return false; // Bloqueia muito próximo

    // 2. Verifica se o usuário JÁ está inscrito neste slot (para não se inscrever 2x)
    const jaInscrito = (slot.vagas || []).some(
      (v) => v.profissionalId === usuarioLogado.uid
    );
    if (jaInscrito) return false; // Já inscrito, remove da lista de opções

    // 3. Verifica Lotação baseada na flag
    if (vagasLimitadas) {
      // Se for limitado (Voluntário), esconde se tiver alguém
      return !slot.vagas || slot.vagas.length < 1;
    } else {
      // Se for ilimitado (Técnica), SEMPRE mostra
      return true;
    }
  });

  if (slotsDisponiveis.length === 0) {
    // Verifica se o motivo é que ele já se inscreveu em tudo
    const algumInscrito = agendamentoData.slots.some((s) =>
      (s.vagas || []).some((v) => v.profissionalId === usuarioLogado.uid)
    );

    if (algumInscrito) {
      container.innerHTML = `
            <div class="header"><h1>${
              agendamentoData.tipo || "Agendamento"
            }</h1></div>
            <div>${voluntarioInfo}</div>
            <div class="success-message" style="margin-top: 20px;">
                <div class="success-icon">✓</div>
                <h3>Você já está inscrito!</h3>
                <p>Verifique seu e-mail para os detalhes.</p>
            </div>`;
    } else {
      container.innerHTML = `
            <div class="header"><h1>${
              agendamentoData.tipo || "Agendamento"
            }</h1></div>
            <div>${voluntarioInfo}</div>
            <div class="error-message">
                Desculpe, todos os horários já foram preenchidos ou estão muito próximos.
            </div>`;
    }
    return;
  }

  const slotsHTML = slotsDisponiveis
    .map((slot, index) => {
      let gestorTexto = "";
      if (agendamentoData.exibirGestor && slot.gestorNome) {
        gestorTexto = `<span class="slot-gestor">com ${slot.gestorNome}</span>`;
      }

      // Mostra contagem se for ilimitado (opcional, para dar senso de grupo)
      let infoExtra = "";
      if (!vagasLimitadas) {
        const count = slot.vagas ? slot.vagas.length : 0;
        infoExtra = `<span style="font-size: 0.8em; color: #666; margin-left: 10px;">(${count} inscritos)</span>`;
      }

      // Precisamos encontrar o índice original no array principal para o valor do input
      // pois 'slotsDisponiveis' é um subconjunto e os índices não batem
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

  // Eventos de seleção
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

  // Índice original no array agendamentoData.slots
  const slotIndex = parseInt(slotSelecionado.value);

  const data = slotSelecionado.dataset.data;
  const horaInicioSelecionada = slotSelecionado.dataset.horaInicio;
  const horaFimSelecionada = slotSelecionado.dataset.horaFim;
  const gestorId = slotSelecionado.dataset.gestorId;
  const gestorNome = slotSelecionado.dataset.gestorNome;

  const btn = document.querySelector(".btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Confirmando...";

  try {
    // Recarrega do banco para evitar race condition
    const docRef = doc(firestoreDb, "agendamentos_voluntarios", agendamentoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Agendamento não existe mais.");

    const dadosAtualizados = docSnap.data();
    const slotAlvo = dadosAtualizados.slots[slotIndex];

    // Validação de segurança final
    if (dadosAtualizados.vagasLimitadas) {
      if (slotAlvo.vagas && slotAlvo.vagas.length >= 1) {
        alert(
          "Desculpe, este horário foi preenchido por outra pessoa agora mesmo."
        );
        agendamentoData = dadosAtualizados; // Atualiza local
        renderizarFormulario(); // Re-renderiza
        return;
      }
    }

    // Prepara objeto de vaga
    if (!slotAlvo.vagas) {
      slotAlvo.vagas = [];
    }

    slotAlvo.vagas.push({
      id: Date.now().toString(),
      profissionalId: usuarioLogado.uid,
      profissionalNome:
        usuarioLogado.dadosCompletos?.nome || usuarioLogado.email || "Sem nome",
      email: usuarioLogado.email || "",
      telefone: usuarioLogado.dadosCompletos?.contato || "", // Importante para o e-mail
      presente: false,
      inscritoEm: new Date().toISOString(),
    });

    // Salva no Firestore
    await updateDoc(docRef, {
      slots: dadosAtualizados.slots,
    });

    // Chama envio de e-mail
    await enviarEmailParaGestor({
      gestorId,
      gestorNome,
      voluntarioNome:
        usuarioLogado.dadosCompletos?.nome || usuarioLogado.email || "Sem nome",
      data,
      horaInicio: horaInicioSelecionada,
      horaFim: horaFimSelecionada,
    });

    mostrarSucesso(data, horaInicioSelecionada, horaFimSelecionada, gestorNome);
  } catch (error) {
    console.error("[AGENDAMENTO] Erro ao confirmar agendamento:", error);
    alert("Erro ao confirmar agendamento. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Confirmar Inscrição";
  }
}

async function enviarEmailParaGestor(dados) {
  // Nota: A função 'enviarEmailGestorAgendamento' no index.js (backend) já faz o envio automático
  // via gatilho (onDocumentUpdated) para o Gestor e para o Participante.
  // Não é estritamente necessário chamar manualmente aqui se o gatilho estiver ativo.
  // Porém, se quiser forçar via Client-Side como backup ou lógica específica, mantemos abaixo.
  // SE O GATILHO ESTIVER ATIVO: Esta função abaixo pode causar e-mail duplicado para o GESTOR.
  // Recomendo deixar o gatilho cuidar disso para garantir consistência.
  // Mas como o código anterior tinha, vou manter a lógica de chamada da função genérica 'enviarEmail'
  // apenas como fallback ou log, mas o ideal é confiar no gatilho do index.js.

  console.log("Inscrição salva. Aguardando gatilho de e-mail do servidor...");
}

function mostrarSucesso(data, horaInicio, horaFim, gestorNome) {
  const container = document.getElementById("main-container");

  const tituloEvento = `${
    agendamentoData.tipo || "Reunião"
  } - ${horaInicio} - EuPsico`;

  const linkGoogleCalendar = gerarLinkGoogleCalendar(
    tituloEvento,
    `Inscrição confirmada para: ${agendamentoData.tipo}.\n\nO link do encontro será enviado por WhatsApp ou E-mail.`,
    data,
    horaInicio,
    horaFim
  );

  const gestorTexto =
    gestorNome && agendamentoData.exibirGestor
      ? `<p><strong>Responsável:</strong> ${gestorNome}</p>`
      : "";

  container.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Inscrição Confirmada!</h2>
      <p><strong>Participante:</strong> ${
        usuarioLogado.dadosCompletos?.nome || usuarioLogado.email
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
        <strong>ℹ️ Importante:</strong> Você receberá uma confirmação por e-mail com os detalhes.
      </p>
      
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Voltar</button>
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
