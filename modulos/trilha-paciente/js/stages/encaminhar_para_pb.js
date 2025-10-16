// Arquivo: /modulos/trilha-paciente/js/stages/encaminhar_para_pb.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  deleteField,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";
import { carregarProfissionais } from "../../../../assets/js/app.js";

/**
 * Renderiza o conteúdo do modal para a etapa 'Encaminhar para PB'.
 * AGORA INCLUI LÓGICA PARA ADICIONAR OU SUBSTITUIR PROFISSIONAIS.
 * @param {string} cardId - O ID do documento do paciente na coleção 'trilhaPaciente'.
 * @returns {HTMLElement} O elemento HTML com o formulário.
 */
export async function render(cardId, cardTitle) {
  // 1. Busca os dados mais recentes do paciente
  const docRef = doc(db, "trilhaPaciente", cardId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    console.error("Documento do paciente não encontrado!");
    const errorEl = document.createElement("div");
    errorEl.textContent = "Erro: Paciente não encontrado.";
    return errorEl;
  }
  const data = docSnap.data();

  // NOVO: Verifica se já existe um atendimento ativo para mostrar a nova opção
  const atendimentoAtivoExistente = data.atendimentosPB?.find(
    (at) => at.statusAtendimento === "ativo"
  );
  let acaoEncaminhamentoHtml = "";

  if (atendimentoAtivoExistente) {
    acaoEncaminhamentoHtml = `
        <div id="acao-encaminhamento-section" class="form-group hidden" style="background-color: #fffbe6; padding: 15px; border-radius: 5px; border: 1px solid #ffe58f;">
            <p>Este paciente já possui um atendimento ativo com <strong>${atendimentoAtivoExistente.profissionalNome}</strong>. O que você deseja fazer?</p>
            <div class="radio-group-vertical">
                <label><input type="radio" name="acao-encaminhamento" value="substituir" required> Substituir o atendimento atual</label>
                <label><input type="radio" name="acao-encaminhamento" value="adicionar" required> Adicionar como um novo atendimento (ambos ficarão ativos)</label>
            </div>
        </div>
    `;
  }

  // 2. Monta o HTML do formulário, incluindo a nova seção (se aplicável)
  const content = `
        <div class="patient-info-box">
            <h4>Adicionar Atendimento de Psicoterapia Breve (PB)</h4>
            <p><strong>Nome:</strong> ${
              data.nomeCompleto || "Não informado"
            }</p>
        </div>
        <form id="pb-form">
            <div class="form-group">
                <label for="continua-terapia-pb">Paciente deseja iniciar/continuar com a terapia?</label>
                <select id="continua-terapia-pb" class="form-control" required>
                    <option value="">Selecione...</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não (Desistência)</option>
                </select>
            </div>
            <div id="motivo-desistencia-pb-container" class="form-group hidden">
                <label for="motivo-desistencia-pb">Motivo da desistência:</label>
                <textarea id="motivo-desistencia-pb" class="form-control" rows="3"></textarea>
            </div>
            <div id="continuacao-pb-container" class="hidden">
                ${acaoEncaminhamentoHtml}

                <div class="form-group">
                    <label for="profissional-pb">Selecione o nome profissional do PB:</label>
                    <select id="profissional-pb" class="form-control" required></select>
                </div>
                <div class="form-group">
                    <label for="tipo-profissional-pb">O profissional que irá atender o paciente é:</label>
                    <select id="tipo-profissional-pb" class="form-control" required>
                        <option value="">Selecione...</option>
                        <option value="Estagiária(o)">Estagiária(o)</option>
                        <option value="Voluntária(o)">Voluntária(o)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="data-encaminhamento-pb">Data do encaminhamento para PB:</label>
                    <input type="date" id="data-encaminhamento-pb" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="data-primeira-sessao-pb">Data da Primeira sessão de PB agendada para:</label>
                    <input type="date" id="data-primeira-sessao-pb" class="form-control" required>
                </div>
                 <div class="form-group">
                    <label for="hora-primeira-sessao-pb">Horário da Primeira sessão de PB agendada para:</label>
                    <input type="time" id="hora-primeira-sessao-pb" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="tipo-atendimento-pb">O atendimento será:</label>
                    <select id="tipo-atendimento-pb" class="form-control" required>
                        <option value="">Selecione...</option>
                        <option value="Online">Online</option>
                        <option value="Presencial">Presencial</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="observacoes-pb">Observações:</label>
                    <textarea id="observacoes-pb" class="form-control" rows="3"></textarea>
                </div>
            </div>
        </form>
    `;

  const element = document.createElement("div");
  element.innerHTML = content;

  // 3. Adiciona a lógica interna do formulário
  const continuaTerapiaSelect = element.querySelector("#continua-terapia-pb");
  const motivoContainer = element.querySelector(
    "#motivo-desistencia-pb-container"
  );
  const continuacaoContainer = element.querySelector(
    "#continuacao-pb-container"
  );
  const acaoEncaminhamentoSection = element.querySelector(
    "#acao-encaminhamento-section"
  );

  continuaTerapiaSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    motivoContainer.classList.toggle("hidden", value !== "nao");
    continuacaoContainer.classList.toggle("hidden", value !== "sim");

    // Mostra a seção de escolha apenas se o valor for "sim" e a seção existir
    if (acaoEncaminhamentoSection) {
      acaoEncaminhamentoSection.classList.toggle("hidden", value !== "sim");
    }

    const continuacaoInputs = continuacaoContainer.querySelectorAll(
      "select, input, textarea"
    );
    continuacaoInputs.forEach((input) => (input.required = value === "sim"));

    const motivoInput = motivoContainer.querySelector("textarea");
    motivoInput.required = value === "nao";
  });

  carregarProfissionais(
    db,
    "atendimento",
    element.querySelector("#profissional-pb")
  );
  return element;
}

/**
 * Salva os dados do formulário, permitindo adicionar um novo atendimento
 * ou substituir um atendimento ativo existente.
 * @param {string} cardId - O ID do documento do paciente a ser atualizado.
 */
export async function save(cardId) {
  const continua = document.getElementById("continua-terapia-pb").value;
  const docRef = doc(db, "trilhaPaciente", cardId);

  if (continua === "nao") {
    // Lógica de desistência permanece a mesma
    const updateData = {
      status: "desistencia",
      desistenciaMotivo: `Desistiu antes do PB. Motivo: ${
        document.getElementById("motivo-desistencia-pb").value
      }`,
      lastUpdate: serverTimestamp(),
    };
    await updateDoc(docRef, updateData);
  } else if (continua === "sim") {
    // 1. Pega os dados do novo profissional do formulário
    const profissionalSelect = document.getElementById("profissional-pb");
    const profissionalId = profissionalSelect.value;
    const profissionalNome =
      profissionalSelect.options[profissionalSelect.selectedIndex].text;
    if (!profissionalId) {
      throw new Error(
        "Por favor, selecione um profissional para o encaminhamento."
      );
    }
    const novoAtendimento = {
      atendimentoId:
        new Date().getTime().toString() +
        Math.random().toString(36).substring(2, 9),
      statusAtendimento: "ativo",
      // ... (restante dos campos do novoAtendimento)
      profissionalId,
      profissionalNome,
      tipoProfissional: document.getElementById("tipo-profissional-pb").value,
      dataEncaminhamento: document.getElementById("data-encaminhamento-pb")
        .value,
      dataPrimeiraSessao: document.getElementById("data-primeira-sessao-pb")
        .value,
      horaPrimeiraSessao: document.getElementById("hora-primeira-sessao-pb")
        .value,
      tipoAtendimento: document.getElementById("tipo-atendimento-pb").value,
      observacoes: document.getElementById("observacoes-pb").value,
    };

    // 2. Busca os dados atuais do paciente
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error("Paciente não encontrado.");
    }
    const dadosAtuais = docSnap.data();
    let atendimentosAnteriores = dadosAtuais.atendimentosPB || [];
    const atendimentoAtivoExistente = atendimentosAnteriores.find(
      (at) => at.statusAtendimento === "ativo"
    );

    let updateData = {};

    // 3. Decide a ação com base na escolha do usuário
    if (atendimentoAtivoExistente) {
      const acao = document.querySelector(
        'input[name="acao-encaminhamento"]:checked'
      )?.value;
      if (!acao) {
        throw new Error(
          "Por favor, defina se deseja substituir ou adicionar o novo profissional."
        );
      }

      if (acao === "substituir") {
        // Desativa o atendimento anterior e adiciona o novo
        const novosAtendimentos = atendimentosAnteriores.map((at) =>
          at.statusAtendimento === "ativo"
            ? {
                ...at,
                statusAtendimento: "encerrado",
                motivoDesistencia: "Substituído por novo encaminhamento.",
              }
            : at
        );
        novosAtendimentos.push(novoAtendimento);
        updateData = {
          atendimentosPB: novosAtendimentos,
        };
      } else {
        // acao === 'adicionar'
        // Simplesmente adiciona o novo atendimento à lista existente
        updateData = {
          atendimentosPB: arrayUnion(novoAtendimento),
        };
      }
    } else {
      // Se não havia atendimento ativo, apenas adiciona o novo
      updateData = {
        atendimentosPB: arrayUnion(novoAtendimento),
      };
    }

    // 4. Prepara o objeto final para atualização no Firestore
    const finalUpdateData = {
      status: "aguardando_info_horarios",
      ...updateData, // Adiciona a lógica de 'atendimentosPB'
      profissionaisPB_ids: arrayUnion(profissionalId),
      pbInfo: deleteField(),
      lastUpdate: serverTimestamp(),
    };

    await updateDoc(docRef, finalUpdateData);
    console.log("Atendimento de PB salvo com sucesso!");
  } else {
    throw new Error(
      "Por favor, selecione se o paciente deseja continuar com a terapia."
    );
  }
}
// Export default para compatibilidade
export default { render, save };
