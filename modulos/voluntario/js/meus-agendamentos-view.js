// Arquivo: /modulos/voluntario/js/meus-agendamentos-view.js
// Versão 2.0 (Atualizado para a sintaxe modular do Firebase v9)

import {
  db,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const container = document.getElementById("painel-supervisor-content");
  if (!container) {
    console.error(
      "Container principal '#painel-supervisor-content' não encontrado."
    );
    return;
  }

  // Carrega o HTML da aba
  container.innerHTML = `
        <div id="meus-agendamentos-view">
            <div class="list-header">
                <h3>Seus Agendamentos de Supervisão</h3>
                <p>Aqui estão listadas todas as solicitações de agendamento recebidas.</p>
            </div>
            <div id="agendamentos-lista" class="agendamentos-lista-grid">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;

  const listaContainer = container.querySelector("#agendamentos-lista");
  if (!listaContainer) {
    console.error("Elemento da lista de agendamentos não encontrado.");
    return;
  }

  try {
    // SINTAXE V9: Criação da consulta
    const q = query(
      collection(db, "agendamentos"),
      where("supervisorUid", "==", user.uid),
      orderBy("dataAgendamento", "desc")
    );

    const querySnapshot = await getDocs(q); // SINTAXE V9

    const agendamentos = [];
    querySnapshot.forEach((doc) => {
      agendamentos.push(doc.data());
    });

    displayAgendamentos(agendamentos, listaContainer);
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    listaContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar agendamentos.</p>`;
  }
}

function formatCurrency(value) {
  if (typeof value !== "number") {
    return "R$ 0,00";
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function displayAgendamentos(agendamentos, listaContainer) {
  if (agendamentos.length === 0) {
    listaContainer.innerHTML =
      '<p class="no-fichas-message">Nenhum agendamento encontrado.</p>';
    return;
  }

  let html = "";
  agendamentos.forEach((agendamento) => {
    const data = agendamento.dataAgendamento.toDate();
    const dataFormatada = data.toLocaleDateString("pt-BR");
    const horaFormatada = data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const numPacientes = agendamento.pacientes
      ? agendamento.pacientes.length
      : 0;
    const totalRecebido = formatCurrency(agendamento.valorTotalContribuicao);
    const valorSupervisao = formatCurrency(agendamento.valorSupervisao);

    html += `
            <div class="agendamento-card-supervisor">
                <div class="card-header">
                    <h4>${agendamento.profissionalNome}</h4>
                    <span class="data-agendamento">${dataFormatada} às ${horaFormatada}</span>
                </div>
                <div class="card-body">
                    <p><strong>E-mail:</strong> ${
                      agendamento.profissionalEmail || "Não informado"
                    }</p>
                    <p><strong>Telefone:</strong> ${
                      agendamento.profissionalTelefone || "Não informado"
                    }</p>
                </div>
                <div class="card-footer-details">
                    <div class="info-item">
                        <span class="label">Pacientes</span>
                        <span class="value">${numPacientes}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Total Recebido</span>
                        <span class="value">${totalRecebido}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Valor da Supervisão</span>
                        <span class="value">${valorSupervisao}</span>
                    </div>
                </div>
            </div>
        `;
  });
  listaContainer.innerHTML = html;
}
