// /modulos/gestao/js/ata-de-reuniao.js
// VERSÃO 3.0 (Unificada com Eventos e Suporte a Slots)

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

export async function init() {
  console.log("[ATA] Módulo Registar Ata iniciado (v3.0 - Eventos).");
  await fetchTodosUsuarios();
  await carregarReunioesAgendadas();
}

/**
 * Carrega todos os usuários para montar a lista de presença.
 */
async function fetchTodosUsuarios() {
  if (usuariosCache.length > 0) return;
  try {
    const q = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
    const snapshot = await getDocs(q);
    usuariosCache = snapshot.docs.map((doc) => doc.data().nome);
    console.log(
      `[ATA] ${usuariosCache.length} usuários carregados para lista de presença.`
    );
  } catch (error) {
    console.error("[ATA] Erro ao buscar usuários:", error);
  }
}

/**
 * Busca reuniões pendentes na coleção 'eventos'.
 * Ouve em tempo real para atualizar a lista assim que uma ata for salva.
 */
async function carregarReunioesAgendadas() {
  const container = document.getElementById("lista-reunioes-agendadas");
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // Busca na coleção unificada 'eventos'
    const q = query(
      collection(firestoreDb, "eventos"),
      orderBy("criadoEm", "desc")
    );

    // Listener realtime
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML =
          '<h3>Nenhuma reunião pendente.</h3><p>Agende uma nova reunião na aba "Agendar Reunião".</p>';
        return;
      }

      let listHtml =
        '<h3>Selecione uma Reunião para Registar a Ata</h3><ul class="item-list">';
      let encontrouPendencia = false;

      snapshot.forEach((docSnap) => {
        const evento = docSnap.data();
        const slots = evento.slots || [];

        // CASO 1: Evento Simples (sem slots ou legado)
        if (slots.length === 0) {
          if (evento.status === "Agendada") {
            encontrouPendencia = true;
            const data = evento.dataReuniao
              ? new Date(evento.dataReuniao + "T00:00:00").toLocaleDateString(
                  "pt-BR"
                )
              : "Data indefinida";

            listHtml += `
                <li data-id="${docSnap.id}" data-slot-index="-1">
                    <strong>${evento.tipo}</strong> - ${data} 
                    <br><small class="text-muted">(${
                      evento.pauta || evento.descricao || "Sem pauta"
                    })</small>
                </li>`;
          }
        }
        // CASO 2: Evento com Múltiplos Horários (Slots)
        else {
          slots.forEach((slot, index) => {
            // Verifica se o slot específico está pendente
            // Consideramos pendente se não tiver status ou se for "Agendada"
            if (
              !slot.status ||
              slot.status === "Agendada" ||
              slot.status === "Pendente"
            ) {
              encontrouPendencia = true;
              const dataSlot = new Date(
                slot.data + "T00:00:00"
              ).toLocaleDateString("pt-BR");
              const gestorInfo = slot.gestorNome
                ? `| Resp: ${slot.gestorNome}`
                : "";

              listHtml += `
                <li data-id="${docSnap.id}" data-slot-index="${index}">
                    <strong>${evento.tipo}</strong> - ${dataSlot} às ${slot.horaInicio}
                    <br><small class="text-muted">${gestorInfo}</small>
                </li>`;
            }
          });
        }
      });

      listHtml += "</ul>";

      if (!encontrouPendencia) {
        container.innerHTML = `
            <div class="alert alert-success text-center">
                <span class="material-symbols-outlined" style="font-size: 48px;">task_alt</span>
                <h4 class="mt-2">Tudo em dia!</h4>
                <p>Todas as reuniões agendadas já possuem ata registrada.</p>
            </div>`;
      } else {
        container.innerHTML = listHtml;
        attachClickEvents(container);
      }
    });
  } catch (error) {
    console.error("[ATA] Erro ao carregar reuniões:", error);
    container.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar lista de reuniões.</p>';
  }
}

/**
 * Adiciona eventos de clique nos itens da lista
 */
function attachClickEvents(container) {
  container.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", async () => {
      // Esconde a lista e mostra loading
      container.style.display = "none";
      const formContainer = document.getElementById("form-ata-container");
      formContainer.innerHTML = '<div class="loading-spinner"></div>';
      formContainer.style.display = "block";

      const docId = li.dataset.id;
      const slotIndex = parseInt(li.dataset.slotIndex);

      try {
        const docSnap = await getDoc(doc(firestoreDb, "eventos", docId));
        if (!docSnap.exists()) {
          alert("Evento não encontrado!");
          location.reload();
          return;
        }

        const data = docSnap.data();

        // Normaliza os dados para o formulário dependendo se é Slot ou Raiz
        let dadosForm = {};

        if (slotIndex === -1) {
          // Dados da Raiz
          dadosForm = {
            tipo: data.tipo,
            dataReuniao: data.dataReuniao, // Formato YYYY-MM-DD esperado
            pauta: data.pauta || data.descricao || data.tipo,
            participantesSugestao: data.participantes
              ? typeof data.participantes === "string"
                ? data.participantes.split(", ")
                : data.participantes
              : [],
            docId: docId,
            slotIndex: -1,
          };
        } else {
          // Dados do Slot
          const slot = data.slots[slotIndex];
          dadosForm = {
            tipo: data.tipo,
            dataReuniao: slot.data,
            pauta: data.descricao || data.tipo,
            // Tenta pegar inscritos no slot para sugerir na chamada
            participantesSugestao: (slot.vagas || []).map(
              (v) => v.nome || v.profissionalNome
            ),
            docId: docId,
            slotIndex: slotIndex,
            horaInicio: slot.horaInicio,
          };
        }

        renderizarFormularioAta(dadosForm);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar detalhes da reunião.");
        location.reload();
      }
    });
  });
}

/**
 * Renderiza o formulário de preenchimento da Ata
 */
function renderizarFormularioAta(dados) {
  const container = document.getElementById("form-ata-container");

  // Prepara checkboxes de participantes
  // Marca automaticamente quem já estava inscrito/previsto
  const participantesCheckboxes = usuariosCache
    .map((nome) => {
      const isPresente = dados.participantesSugestao?.includes(nome)
        ? "checked"
        : "";
      return `
        <div>
            <label style="cursor: pointer;">
                <input type="checkbox" class="participante-check" value="${nome}" ${isPresente}> 
                ${nome}
            </label>
        </div>`;
    })
    .join("");

  const dataDisplay = dados.dataReuniao
    ? new Date(dados.dataReuniao + "T00:00:00").toLocaleDateString("pt-BR")
    : "Data n/a";
  const horaDisplay = dados.horaInicio ? ` às ${dados.horaInicio}` : "";

  container.innerHTML = `
        <form id="form-ata-registro">
            <h3 style="margin-top: 0; color: var(--primary-color-dark);">Registo da Ata</h3>
            
            <div class="alert alert-info py-2">
                <strong>${dados.tipo}</strong><br>
                ${dataDisplay}${horaDisplay} | ${dados.pauta.substring(
    0,
    100
  )}...
            </div>
            
            <div class="form-group participantes-field">
                <label>Lista de Presença (Selecione os presentes)</label>
                <div class="participantes-checkbox-container" style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; background: #fff; border-radius: 4px;">
                    ${participantesCheckboxes}
                </div>
                <small class="text-muted">Usuários pré-inscritos já vêm marcados.</small>
            </div>

            <div class="form-group">
                <label>Pontos Discutidos *</label>
                <textarea class="form-control" id="ata-pontos" rows="4" required placeholder="Resumo dos assuntos abordados..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Decisões Tomadas *</label>
                <textarea class="form-control" id="ata-decisoes" rows="4" required placeholder="O que foi decidido..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Temas para Próxima Reunião</label>
                <textarea class="form-control" id="ata-temas-proxima" rows="2" placeholder="Opcional..."></textarea>
            </div>

            <div class="button-bar" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="action-button secondary-button" onclick="cancelarEdicao()">Cancelar</button>
                <button type="submit" class="action-button save-btn">Salvar e Concluir Ata</button>
            </div>
        </form>
    `;

  // Função global para o botão cancelar funcionar no onclick inline
  window.cancelarEdicao = () => {
    container.style.display = "none";
    document.getElementById("lista-reunioes-agendadas").style.display = "block";
  };

  document
    .getElementById("form-ata-registro")
    .addEventListener("submit", (e) => salvarAta(e, dados));
}

/**
 * Salva a Ata no Firestore (Atualiza o documento ou slot específico)
 */
async function salvarAta(e, dadosContexto) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    // Coleta participantes marcados
    const participantes = Array.from(
      document.querySelectorAll(".participante-check:checked")
    )
      .map((cb) => cb.value)
      .join(", ");

    // Objeto com os dados da Ata
    const dadosAta = {
      pontos: document.getElementById("ata-pontos").value,
      decisoes: document.getElementById("ata-decisoes").value,
      temasProximaReuniao: document.getElementById("ata-temas-proxima").value,
      participantesConfirmados: participantes, // Salva string separada por vírgula
      ataRegistradaEm: new Date().toISOString(),
      status: "Concluída",
    };

    const docRef = doc(firestoreDb, "eventos", dadosContexto.docId);

    // LÓGICA DE SALVAMENTO: RAIZ vs SLOT
    if (dadosContexto.slotIndex === -1) {
      // Atualiza direto na raiz do documento
      await updateDoc(docRef, dadosAta);
    } else {
      // Atualiza um item específico dentro do array 'slots'
      // Firestore não permite atualizar index de array diretamente sem ler o array todo
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const slots = docSnap.data().slots || [];

        // Verifica se o slot ainda existe
        if (slots[dadosContexto.slotIndex]) {
          // Mescla os dados existentes do slot com os novos dados da ata
          slots[dadosContexto.slotIndex] = {
            ...slots[dadosContexto.slotIndex],
            ...dadosAta,
          };

          // Salva o array atualizado
          await updateDoc(docRef, { slots: slots });
        } else {
          throw new Error("O horário selecionado não existe mais no sistema.");
        }
      }
    }

    // Sucesso
    alert("Ata registrada com sucesso!");
    document.getElementById("form-ata-container").style.display = "none";
    document.getElementById("lista-reunioes-agendadas").style.display = "block";
    // A lista será atualizada automaticamente pelo onSnapshot em carregarReunioesAgendadas
  } catch (error) {
    console.error("Erro ao salvar ata:", error);
    alert("Erro ao salvar a ata: " + error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
