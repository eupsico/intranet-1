// Arquivo: /modulos/trilha-paciente/js/stages/encaminhar_para_plantao.js
// Versão: 2.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  doc,
  getDoc,
  updateDoc,
  deleteField,
} from "../../../../assets/js/firebase-init.js";
import { carregarProfissionais } from "../../../../assets/js/app.js";

/**
 * Renderiza o conteúdo do modal para a etapa "Encaminhar para Plantão".
 * @param {string} cardId - O ID do documento do paciente na coleção 'trilhaPaciente'.
 * @param {string} cardTitle - O nome do paciente.
 * @returns {HTMLElement} O elemento HTML com o formulário completo.
 */
export async function render(cardId, cardTitle) {
  // Busca os dados mais recentes do paciente com a sintaxe v9
  const docRef = doc(db, "trilhaPaciente", cardId);
  const docSnap = await getDoc(docRef);
  const cardData = docSnap.exists() ? docSnap.data() : {};

  // Monta o HTML do formulário com todos os campos restaurados
  const content = `
    <h3 class="form-section-title">Dados do Paciente (Pós-Triagem)</h3>
    <div class="form-grid">
      <div class="form-group">
        <label>Nome do Paciente</label>
        <input type="text" class="form-control" value="${
          cardData.nomeCompleto || ""
        }" disabled>
      </div>
      <div class="form-group">
        <label>Valor da Contribuição</label>
        <input type="text" class="form-control" value="${
          cardData.valorContribuicao || "Aguardando triagem"
        }" disabled>
      </div>
      <div class="form-group">
        <label>Modalidade de Atendimento</label>
        <input type="text" class="form-control" value="${
          cardData.modalidadeAtendimento || "Aguardando triagem"
        }" disabled>
      </div>
      <div class="form-group">
        <label>Prefere ser atendido</label>
        <input type="text" class="form-control" value="${
          cardData.preferenciaAtendimento || "Aguardando triagem"
        }" disabled>
      </div>
    </div>
    
    <h3 class="form-section-title">Encaminhamento</h3>
    <div class="form-group">
      <label for="continua-terapia">Paciente deseja continuar com a terapia?</label>
      <select id="continua-terapia" class="form-control">
        <option value="">Selecione...</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </div>
    
    <div id="motivo-nao-prosseguir-section" class="form-group hidden-section">
      <label for="motivo-nao-prosseguir">Motivo de não prosseguir:</label>
      <textarea id="motivo-nao-prosseguir" class="form-control"></textarea>
    </div>

    <div id="encaminhamento-plantao-section" class="hidden-section">
      <div class="form-grid">
        <div class="form-group">
          <label for="profissional-plantao">Selecione o Profissional do Plantão</label>
          <select id="profissional-plantao" class="form-control">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tipo-profissional">O profissional que irá atender é:</label>
          <select id="tipo-profissional" class="form-control">
            <option value="">Selecione...</option>
            <option value="Estagiario">Estagiário(a)</option>
            <option value="Voluntario">Voluntário(a)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="data-encaminhamento">Data do Encaminhamento</label>
          <input type="date" id="data-encaminhamento" class="form-control">
        </div>
        <div class="form-group">
          <label for="data-primeira-sessao">Data da Primeira Sessão</label>
          <input type="date" id="data-primeira-sessao" class="form-control">
        </div>
        <div class="form-group">
          <label for="hora-primeira-sessao">Horário da Primeira Sessão</label>
          <input type="time" id="hora-primeira-sessao" class="form-control">
        </div>
        <div class="form-group">
          <label for="atendimento-sera">O atendimento será:</label>
          <select id="atendimento-sera" class="form-control">
            <option value="">Selecione...</option>
            <option value="Online">Online</option>
            <option value="Presencial">Presencial</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="observacoes">Observações</label>
        <textarea id="observacoes" class="form-control" rows="3"></textarea>
      </div>
    </div>
  `;

  const element = document.createElement("div");
  element.innerHTML = content;

  const continuaSelect = element.querySelector("#continua-terapia");
  const motivoSection = element.querySelector("#motivo-nao-prosseguir-section");
  const encaminhamentoSection = element.querySelector(
    "#encaminhamento-plantao-section"
  );

  continuaSelect.addEventListener("change", () => {
    const value = continuaSelect.value;
    motivoSection.classList.toggle("hidden-section", value !== "nao");
    encaminhamentoSection.classList.toggle("hidden-section", value !== "sim");
  });

  await carregarProfissionais(
    db,
    "atendimento",
    element.querySelector("#profissional-plantao")
  );

  return element;
}

/**
 * Salva os dados do formulário "Encaminhar para Plantão".
 * @param {string} cardId - O ID do documento do paciente a ser atualizado.
 */
export async function save(cardId) {
  const continua = document.getElementById("continua-terapia").value;
  const docRef = doc(db, "trilhaPaciente", cardId);

  if (continua === "sim") {
    const profissionalSelect = document.getElementById("profissional-plantao");
    const profissionalId = profissionalSelect.value;
    const profissionalNome =
      profissionalSelect.options[profissionalSelect.selectedIndex].text;

    if (!profissionalId) {
      throw new Error("Por favor, selecione um profissional.");
    }

    const updateData = {
      status: "em_atendimento_plantao",
      profissionalAtualId: profissionalId,
      "plantaoInfo.profissionalId": profissionalId,
      "plantaoInfo.profissionalNome": profissionalNome,
      "plantaoInfo.tipoProfissional":
        document.getElementById("tipo-profissional").value,
      "plantaoInfo.dataEncaminhamento": document.getElementById(
        "data-encaminhamento"
      ).value,
      "plantaoInfo.dataPrimeiraSessao": document.getElementById(
        "data-primeira-sessao"
      ).value,
      "plantaoInfo.horaPrimeiraSessao": document.getElementById(
        "hora-primeira-sessao"
      ).value,
      "plantaoInfo.tipoAtendimento":
        document.getElementById("atendimento-sera").value,
      "plantaoInfo.observacoes": document.getElementById("observacoes").value,
      lastUpdate: new Date(),
    };
    await updateDoc(docRef, updateData);
  } else if (continua === "nao") {
    const motivo = document.getElementById("motivo-nao-prosseguir").value;
    if (!motivo) {
      throw new Error("Por favor, informe o motivo da desistência.");
    }
    const updateData = {
      status: "desistencia",
      desistenciaMotivo: `Desistiu na etapa de encaminhamento para plantão. Motivo: ${motivo}`,
      profissionalAtualId: deleteField(), // Sintaxe v9 para remover o campo
      lastUpdate: new Date(),
    };
    await updateDoc(docRef, updateData);
  } else {
    throw new Error(
      "Por favor, selecione se o paciente deseja continuar com a terapia."
    );
  }
}
