// Arquivo: /modulos/administrativo/js/cruzamento-agendas/historico.js
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "../../../../assets/js/firebase-init.js";

let firestoreDb;

export function init(dbInstance) {
  firestoreDb = dbInstance;
}

export async function refresh(tabId) {
  if (tabId === "agendados") loadAgendados();
  if (tabId === "desistencias") loadDesistencias();
}

async function loadAgendados() {
  const tbody = document.getElementById("agendados-tbody");
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

  try {
    // Busca na coleção agendamentoTentativas onde status = 'Agendado'
    const q = query(
      collection(firestoreDb, "agendamentoTentativas"),
      where("status", "==", "Agendado"),
      orderBy("arquivadoEm", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4">Nenhum agendamento recente.</td></tr>';
      return;
    }

    snap.forEach((doc) => {
      const d = doc.data();
      const data = d.arquivadoEm
        ? new Date(d.arquivadoEm.seconds * 1000).toLocaleDateString()
        : "-";
      tbody.innerHTML += `<tr><td>${d.pacienteNome}</td><td>${d.profissionalNome}</td><td>${data}</td><td>-</td></tr>`;
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>';
  }
}

async function loadDesistencias() {
  const tbody = document.getElementById("desistencias-tbody");
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

  try {
    const q = query(
      collection(firestoreDb, "agendamentoTentativas"),
      where("status", "==", "Cancelado/Sem Sucesso"),
      orderBy("arquivadoEm", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4">Nenhuma desistência recente.</td></tr>';
      return;
    }

    snap.forEach((doc) => {
      const d = doc.data();
      const data = d.arquivadoEm
        ? new Date(d.arquivadoEm.seconds * 1000).toLocaleDateString()
        : "-";
      tbody.innerHTML += `<tr><td>${d.pacienteNome}</td><td>${
        d.profissionalNome
      }</td><td>${d.motivoCancelamento || "-"}</td><td>${data}</td></tr>`;
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>';
  }
}
