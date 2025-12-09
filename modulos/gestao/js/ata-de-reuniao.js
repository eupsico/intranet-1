// /modulos/gestao/js/ata-de-reuniao.js
// VERSÃO 4.2 (Correção de Loop e Filtro de Data Robusto)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let usuariosCache = [];
let unsubscribeListener = null;

const TIPOS_PERMITIDOS = [
  "reuniao_gestor",
  "reuniao_conselho",
  "Reunião com Gestor",
  "Reunião Conselho Administrativo",
];

export async function init() {
  console.log("[ATA] Iniciando v4.2...");

  // Define mês atual no filtro se estiver vazio
  const inputMes = document.getElementById("filtro-mes-ata");
  if (inputMes && !inputMes.value) {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();
    inputMes.value = `${ano}-${mes}`;
  }

  configurarListeners();
  await fetchTodosUsuarios();
  await carregarReunioesAgendadas();
}

function configurarListeners() {
  const btnUpdate = document.getElementById("btn-atualizar-lista");
  const filtroMes = document.getElementById("filtro-mes-ata");
  const filtroStatus = document.getElementById("filtro-status-ata");

  if (btnUpdate) btnUpdate.addEventListener("click", carregarReunioesAgendadas);
  if (filtroMes)
    filtroMes.addEventListener("change", carregarReunioesAgendadas);
  if (filtroStatus)
    filtroStatus.addEventListener("change", carregarReunioesAgendadas);
}

async function fetchTodosUsuarios() {
  if (usuariosCache.length > 0) return;
  try {
    const q = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
    const snapshot = await getDocs(q);
    usuariosCache = snapshot.docs.map((doc) => doc.data().nome);
  } catch (error) {
    console.error("[ATA] Erro usuarios:", error);
  }
}

async function carregarReunioesAgendadas() {
  const container = document.getElementById("lista-reunioes-content"); // ALTERADO: ID Específico do conteúdo
  const formContainer = document.getElementById("form-ata-container");

  if (!container) return console.error("Container da lista não encontrado!");

  // Reseta visualização
  document.getElementById("lista-reunioes-wrapper").style.display = "block"; // Mostra o wrapper da lista
  formContainer.style.display = "none";
  container.innerHTML = '<div class="loading-spinner"></div>';

  const mesFiltro = document.getElementById("filtro-mes-ata").value; // YYYY-MM
  const statusFiltro = document.getElementById("filtro-status-ata").value;

  console.log(`[ATA] Filtrando por: Mês=${mesFiltro}, Status=${statusFiltro}`);

  try {
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );

    if (unsubscribeListener) unsubscribeListener();

    unsubscribeListener = onSnapshot(q, (snapshot) => {
      let html = "";
      let count = 0;

      if (snapshot.empty) {
        container.innerHTML =
          '<div class="alert alert-info">Nenhum evento registrado no sistema.</div>';
        return;
      }

      snapshot.forEach((docSnap) => {
        try {
          const evento = docSnap.data();
          const slots = evento.slots || [];

          // 1. Filtro de Tipo (Gestor ou Conselho)
          if (!TIPOS_PERMITIDOS.includes(evento.tipo)) return;

          const processarItem = (itemData, slotIndex) => {
            const dataRaw = itemData.data || evento.dataReuniao;
            if (!dataRaw) return;

            // 2. Filtro de Data (Robusto)
            // Converte string '2025-12-08' ou '2025-12' para comparação
            if (mesFiltro) {
              const [anoFiltro, mesFiltroNum] = mesFiltro
                .split("-")
                .map(Number);
              // Cria data evitando problemas de timezone (apenas data string)
              const dataEvt = new Date(dataRaw + "T12:00:00");

              const evtAno = dataEvt.getFullYear();
              const evtMes = dataEvt.getMonth() + 1;

              if (evtAno !== anoFiltro || evtMes !== mesFiltroNum) {
                return; // Data não bate
              }
            }

            // 3. Filtro de Status
            const statusItem = itemData.status || "Agendada";
            const isConcluida = statusItem === "Concluída";

            if (statusFiltro === "pendente" && isConcluida) return;
            if (statusFiltro === "concluida" && !isConcluida) return;

            // Renderização
            const nomeTipo = formatarNomeTipo(evento.tipo);
            const classeTipo = getClassePorTipo(evento.tipo);

            // Formatação visual da data
            const dataObj = new Date(dataRaw + "T12:00:00");
            const dataFormatada = dataObj.toLocaleDateString("pt-BR");

            const hora = itemData.horaInicio || "N/A";
            const responsavel =
              itemData.gestorNome || evento.responsavel || "N/A";
            const badgeLabel = isConcluida ? "Ata Salva" : "Pendente";
            const badgeClass = isConcluida ? "concluida" : "pendente";

            html += `
                    <div class="reuniao-card-item ${classeTipo}" onclick="abrirFormulario('${docSnap.id}', ${slotIndex})">
                        <div class="reuniao-card-header">
                            <div>
                                <h4 class="reuniao-card-title">${nomeTipo}</h4>
                                <div class="reuniao-card-date">
                                    <span class="material-symbols-outlined" style="font-size:18px">calendar_month</span>
                                    ${dataFormatada} às ${hora}
                                </div>
                            </div>
                            <span class="badge-status ${badgeClass}">${badgeLabel}</span>
                        </div>
                        <div class="reuniao-card-meta">
                            <strong>Resp:</strong> ${responsavel}
                        </div>
                    </div>
                `;
            count++;
          };

          if (slots.length > 0) {
            slots.forEach((slot, idx) => processarItem(slot, idx));
          } else {
            processarItem(evento, -1);
          }
        } catch (errLoop) {
          console.error("Erro ao processar item individual:", errLoop);
        }
      });

      if (count === 0) {
        container.innerHTML = `
            <div class="alert alert-light text-center border" style="padding: 30px;">
                <span class="material-symbols-outlined" style="font-size: 48px; color: #ccc;">filter_list_off</span>
                <p class="mt-3 text-muted">
                    Nenhuma Ata de <strong>Gestor</strong> ou <strong>Conselho</strong> encontrada.<br>
                    <small>Verifique se o mês selecionado está correto.</small>
                </p>
            </div>`;
      } else {
        container.innerHTML = html;
        window.abrirFormulario = abrirFormulario;
      }
    });
  } catch (error) {
    console.error("Erro fatal ao carregar lista:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro técnico ao buscar dados.</div>`;
  }
}

async function abrirFormulario(docId, slotIndex) {
  const wrapperLista = document.getElementById("lista-reunioes-wrapper");
  const containerForm = document.getElementById("form-ata-container");

  wrapperLista.style.display = "none";
  containerForm.style.display = "block";
  containerForm.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const docSnap = await getDoc(doc(firestoreDb, "eventos", docId));
    if (!docSnap.exists()) throw new Error("Evento não encontrado");

    const data = docSnap.data();
    let dadosItem = {};

    if (slotIndex === -1) {
      dadosItem = { ...data, slotIndex: -1, docId };
    } else {
      dadosItem = {
        ...data.slots[slotIndex],
        tipo: data.tipo,
        pauta: data.descricao,
        slotIndex,
        docId,
      };
    }

    renderizarFormulario(dadosItem);
  } catch (e) {
    alert("Erro: " + e.message);
    location.reload();
  }
}

function renderizarFormulario(dados) {
  const container = document.getElementById("form-ata-container");

  const participantesCheckboxes = usuariosCache
    .map((nome) => {
      const listaVerificacao = dados.participantesConfirmados
        ? dados.participantesConfirmados.split(", ")
        : (dados.vagas || []).map((v) => v.nome || v.profissionalNome);

      const isPresente = listaVerificacao.includes(nome) ? "checked" : "";

      return `
        <div style="margin-bottom: 5px;">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" class="participante-check" value="${nome}" ${isPresente}> 
                ${nome}
            </label>
        </div>`;
    })
    .join("");

  const dataDisplay = dados.data || dados.dataReuniao || "";
  const horaDisplay = dados.horaInicio || "";
  const titulo = formatarNomeTipo(dados.tipo);

  container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
            <h3 style="margin:0; color: var(--cor-primaria);">
                ${dados.status === "Concluída" ? "Editar Ata" : "Registrar Ata"}
            </h3>
            <button class="btn btn-outline-secondary btn-sm" onclick="cancelarEdicao()">
                <span class="material-symbols-outlined" style="vertical-align: middle;">close</span> Fechar
            </button>
        </div>

        <form id="form-ata-registro">
            <div class="alert alert-info py-2 mb-4">
                <strong>${titulo}</strong> - ${new Date(
    dataDisplay + "T12:00:00"
  ).toLocaleDateString("pt-BR")} às ${horaDisplay}
            </div>
            
            <div class="row">
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="fw-bold mb-2">Lista de Presença</label>
                        <div class="participantes-checkbox-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--cor-borda); padding: 15px; background: #fff; border-radius: var(--borda-radius);">
                            ${participantesCheckboxes}
                        </div>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="form-group mb-3">
                        <label class="fw-bold">Pontos Discutidos *</label>
                        <textarea class="form-control" id="ata-pontos" rows="6" required placeholder="Resumo dos assuntos abordados...">${
                          dados.pontos || ""
                        }</textarea>
                    </div>
                    
                    <div class="form-group mb-3">
                        <label class="fw-bold">Decisões Tomadas *</label>
                        <textarea class="form-control" id="ata-decisoes" rows="4" required placeholder="O que foi decidido...">${
                          dados.decisoes || ""
                        }</textarea>
                    </div>
                    
                    <div class="form-group mb-3">
                        <label class="fw-bold">Temas para Próxima Reunião</label>
                        <textarea class="form-control" id="ata-temas-proxima" rows="2" placeholder="Opcional...">${
                          dados.temasProximaReuniao || ""
                        }</textarea>
                    </div>
                </div>
            </div>

            <div class="button-bar mt-4">
                <button type="button" class="action-button secondary-button" onclick="cancelarEdicao()">Cancelar</button>
                <button type="submit" class="action-button save-btn">
                    ${
                      dados.status === "Concluída"
                        ? "Atualizar Ata"
                        : "Salvar e Concluir"
                    }
                </button>
            </div>
        </form>
    `;

  window.cancelarEdicao = () => {
    container.style.display = "none";
    document.getElementById("lista-reunioes-wrapper").style.display = "block";
  };

  document
    .getElementById("form-ata-registro")
    .addEventListener("submit", (e) => salvarAta(e, dados));
}

async function salvarAta(e, dadosContexto) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    const participantes = Array.from(
      document.querySelectorAll(".participante-check:checked")
    )
      .map((cb) => cb.value)
      .join(", ");

    const dadosAta = {
      pontos: document.getElementById("ata-pontos").value,
      decisoes: document.getElementById("ata-decisoes").value,
      temasProximaReuniao: document.getElementById("ata-temas-proxima").value,
      participantesConfirmados: participantes,
      ataRegistradaEm: new Date().toISOString(),
      status: "Concluída",
    };

    const docRef = doc(firestoreDb, "eventos", dadosContexto.docId);

    if (dadosContexto.slotIndex === -1) {
      await updateDoc(docRef, dadosAta);
    } else {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const slots = docSnap.data().slots || [];
        if (slots[dadosContexto.slotIndex]) {
          slots[dadosContexto.slotIndex] = {
            ...slots[dadosContexto.slotIndex],
            ...dadosAta,
          };
          await updateDoc(docRef, { slots: slots });
        }
      }
    }

    alert("Ata salva com sucesso!");
    window.cancelarEdicao();
  } catch (error) {
    console.error("Erro ao salvar ata:", error);
    alert("Erro ao salvar: " + error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function formatarNomeTipo(t) {
  const map = {
    reuniao_gestor: "Reunião com Gestor",
    reuniao_conselho: "Reunião Conselho Administrativo",
  };
  return map[t] || t;
}

function getClassePorTipo(t) {
  if (t === "reuniao_gestor") return "tipo-gestor";
  if (t === "reuniao_conselho") return "tipo-conselho";
  return "";
}
