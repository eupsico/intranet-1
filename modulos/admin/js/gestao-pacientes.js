import {
  db,
  getDocs,
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

// Lista completa de status para o dropdown de mover paciente
const ALL_STATUS = {
  inscricao_documentos: "Inscrição e Documentos",
  triagem_agendada: "Triagem Agendada",
  encaminhar_para_plantao: "Encaminhar para Plantão",
  em_atendimento_plantao: "Em Atendimento (Plantão)",
  agendamento_confirmado_plantao: "Agendamento Confirmado (Plantão)",
  encaminhar_para_pb: "Encaminhar para PB",
  aguardando_info_horarios: "Aguardando Info Horários",
  cadastrar_horario_psicomanager: "Cadastrar Horário Psicomanager",
  em_atendimento_pb: "Em Atendimento (PB)",
  pacientes_parcerias: "Pacientes Parcerias",
  grupos: "Grupos",
  desistencia: "Desistência",
  alta: "Alta",
};

// --- INÍCIO DA ALTERAÇÃO 1: Função para calcular a idade ---
function calcularIdade(dataNascimento) {
  if (!dataNascimento || !dataNascimento.includes("-")) return null;
  const hoje = new Date();
  // Garante que a data seja interpretada corretamente como UTC para evitar problemas de fuso horário
  const nascimento = new Date(dataNascimento + "T00:00:00Z");
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const m = hoje.getUTCMonth() - nascimento.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < nascimento.getUTCDate())) {
    idade--;
  }
  return idade;
}
// --- FIM DA ALTERAÇÃO 1 ---

export function init(user, userData) {
  console.log(
    "🚀 Módulo de Gestão de Pacientes v3.0 (Formulário Completo) iniciado."
  );

  const searchInput = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");
  const listContainer = document.getElementById("pacientes-list-container");
  const modal = document.getElementById("edit-paciente-modal");
  const modalBody = document.getElementById("modal-body-content");
  const modalTitle = document.getElementById("modal-title");
  const closeModalBtn = document.querySelector(".close-modal-btn");
  const cancelModalBtn = document.getElementById("modal-cancel-btn");
  const saveModalBtn = document.getElementById("modal-save-btn");

  let allPacientes = [];
  let currentEditingId = null;
  let currentUserData = userData;

  async function carregarPacientes() {
    listContainer.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const q = query(
        collection(db, "trilhaPaciente"),
        orderBy("nomeCompleto")
      );
      const querySnapshot = await getDocs(q);
      allPacientes = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      popularFiltroStatus();
      renderizarLista();
    } catch (error) {
      console.error("Erro ao carregar pacientes: ", error);
      listContainer.innerHTML =
        "<p class='error-text'>Não foi possível carregar os pacientes.</p>";
    }
  }

  function renderizarLista() {
    const searchTerm = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const filteredPacientes = allPacientes.filter((p) => {
      const matchSearch =
        searchTerm === "" ||
        (p.nomeCompleto && p.nomeCompleto.toLowerCase().includes(searchTerm)) ||
        (p.cpf && p.cpf.includes(searchTerm));
      const matchStatus = status === "" || p.status === status;
      return matchSearch && matchStatus;
    });
    if (filteredPacientes.length === 0) {
      listContainer.innerHTML =
        "<p>Nenhum paciente encontrado com os filtros aplicados.</p>";
      return;
    }
    let html = '<div class="pacientes-list">';
    filteredPacientes.forEach((p) => {
      html += `
                <div class="paciente-card">
                    <div class="paciente-info">
                        <h4>${p.nomeCompleto || "Paciente sem nome"}</h4>
                        <p><strong>CPF:</strong> ${p.cpf || "Não informado"}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${
                          p.status || "default"
                        }">${
        ALL_STATUS[p.status] || p.status || "Não definido"
      }</span></p>
                    </div>
                    <div class="paciente-actions">
                        <button class="action-button secondary btn-edit" data-id="${
                          p.id
                        }">Editar</button>
                        <button class="action-button danger btn-delete" data-id="${
                          p.id
                        }">Excluir</button>
                    </div>
                </div>`;
    });
    html += "</div>";
    listContainer.innerHTML = html;
    addEventListenersAcoes();
  }

  function popularFiltroStatus() {
    const statuses = [
      ...new Set(allPacientes.map((p) => p.status).filter(Boolean)),
    ];
    statuses.sort();
    statusFilter.innerHTML = '<option value="">Todos os Status</option>';
    statuses.forEach((s) => {
      statusFilter.innerHTML += `<option value="${s}">${
        ALL_STATUS[s] || s
      }</option>`;
    });
  }

  searchInput.addEventListener("input", renderizarLista);
  statusFilter.addEventListener("change", renderizarLista);

  function addEventListenersAcoes() {
    document
      .querySelectorAll(".btn-edit")
      .forEach((btn) =>
        btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id))
      );
    document
      .querySelectorAll(".btn-delete")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          deletarPaciente(
            btn.dataset.id,
            btn.closest(".paciente-card").querySelector("h4").textContent
          )
        )
      );
  }

  const closeModalFunction = () => (modal.style.display = "none");
  closeModalBtn.addEventListener("click", closeModalFunction);
  cancelModalBtn.addEventListener("click", closeModalFunction);

  async function abrirModalEdicao(pacienteId) {
    currentEditingId = pacienteId;
    modalTitle.textContent = "Carregando dados do paciente...";
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.style.display = "flex";
    try {
      const docRef = doc(db, "trilhaPaciente", pacienteId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Paciente não encontrado.");
      const paciente = docSnap.data();
      modalTitle.textContent = `Editando: ${paciente.nomeCompleto}`;
      gerarFormularioEdicao(paciente);
    } catch (error) {
      console.error("Erro ao buscar dados para edição:", error);
      modalBody.innerHTML = `<p class="error-text">Erro ao carregar dados do paciente.</p>`;
    }
  }

  // --- INÍCIO DA ALTERAÇÃO 2: Gerar o formulário condicionalmente ---
  function gerarFormularioEdicao(paciente) {
    const p = (path, defaultValue = "") =>
      path.split(".").reduce((acc, part) => acc && acc[part], paciente) ||
      defaultValue;
    const ativoPB =
      paciente.atendimentosPB?.find((at) => at.statusAtendimento === "ativo") ||
      {};

    let statusOptions = Object.keys(ALL_STATUS)
      .map(
        (key) =>
          `<option value="${key}" ${p("status") === key ? "selected" : ""}>${
            ALL_STATUS[key]
          }</option>`
      )
      .join("");

    // Calcula a idade e gera o HTML do responsável, se necessário
    const idade = calcularIdade(paciente.dataNascimento);
    let htmlResponsavel = "";
    if (idade !== null && idade < 18) {
      htmlResponsavel = `
            <div class="form-section">
                <h3>Dados do Responsável (Menor de Idade)</h3>
                <div class="form-group"><label>Nome do Responsável</label><input type="text" id="edit-responsavelNome" class="form-control" value="${p(
                  "responsavel.nome",
                  ""
                )}"></div>
                <div class="form-group"><label>CPF do Responsável</label><input type="text" id="edit-responsavelCpf" class="form-control" value="${p(
                  "responsavel.cpf",
                  ""
                )}"></div>
                <div class="form-group"><label>Telefone do Responsável</label><input type="tel" id="edit-responsavelTelefone" class="form-control" value="${p(
                  "responsavel.telefone",
                  ""
                )}"></div>
            </div>
            `;
    }

    modalBody.innerHTML = `
            <form id="edit-paciente-form" class="edit-form">
                <div class="form-section">
                    <h3>Status e Movimentação</h3>
                    <div class="form-group form-group-full"><label for="edit-status">Status (Mover Paciente)</label><select id="edit-status" class="form-control">${statusOptions}</select></div>
                </div>

                <div class="form-section">
                    <h3>Dados de Inscrição</h3>
                    <div class="form-group"><label>Nome Completo</label><input type="text" id="edit-nomeCompleto" class="form-control" value="${p(
                      "nomeCompleto"
                    )}"></div>
                    <div class="form-group"><label>CPF</label><input type="text" id="edit-cpf" class="form-control" value="${p(
                      "cpf"
                    )}"></div>
                    <div class="form-group"><label>Data de Nasc.</label><input type="date" id="edit-dataNascimento" class="form-control" value="${
                      p("dataNascimento").split("T")[0] // Garante o formato AAAA-MM-DD
                    }"></div>
                    <div class="form-group"><label>Email</label><input type="email" id="edit-email" class="form-control" value="${p(
                      "email"
                    )}"></div>
                    <div class="form-group"><label>Telefone</label><input type="tel" id="edit-telefoneCelular" class="form-control" value="${p(
                      "telefoneCelular"
                    )}"></div>
                    <div class="form-group"><label>Como Conheceu</label><input type="text" id="edit-comoConheceu" class="form-control" value="${p(
                      "comoConheceu"
                    )}"></div>
                    <div class="form-group form-group-full"><label>Motivo da Busca</label><textarea id="edit-motivoBusca" class="form-control" rows="3">${p(
                      "motivoBusca"
                    )}</textarea></div>
                </div>
                
                ${htmlResponsavel}

                <div class="form-section">
                    <h3>Dados da Triagem</h3>
                    <div class="form-group"><label>Queixa Principal</label><input type="text" id="edit-queixaPrincipal" class="form-control" value="${p(
                      "queixaPrincipal"
                    )}"></div>
                    <div class="form-group"><label>Valor Contribuição</label><input type="text" id="edit-valorContribuicao" class="form-control" value="${p(
                      "valorContribuicao"
                    )}"></div>
                    <div class="form-group"><label>Critérios do Valor</label><textarea id="edit-criteriosValor" class="form-control" rows="2">${p(
                      "criteriosValor"
                    )}</textarea></div>
                    <div class="form-group"><label>Assistente Social</label><input type="text" id="edit-assistenteSocialTriagemNome" class="form-control" value="${p(
                      "assistenteSocialTriagem.nome"
                    )}"></div>
                    <div class="form-group"><label>Modalidade</label><input type="text" id="edit-modalidadeAtendimento" class="form-control" value="${p(
                      "modalidadeAtendimento"
                    )}"></div>
                    <div class="form-group"><label>Preferência Gênero</label><input type="text" id="edit-preferenciaAtendimento" class="form-control" value="${p(
                      "preferenciaAtendimento"
                    )}"></div>
                </div>

                <div class="form-section">
                    <h3>Informações do Plantão</h3>
                    <div class="form-group"><label>Profissional</label><input type="text" id="edit-plantaoProfissionalNome" class="form-control" value="${p(
                      "plantaoInfo.profissionalNome"
                    )}"></div>
                    <div class="form-group"><label>Data 1ª Sessão</label><input type="date" id="edit-plantaoDataSessao" class="form-control" value="${
                      p("plantaoInfo.dataPrimeiraSessao").split("T")[0]
                    }"></div>
                    <div class="form-group"><label>Hora 1ª Sessão</label><input type="time" id="edit-plantaoHoraSessao" class="form-control" value="${p(
                      "plantaoInfo.horaPrimeiraSessao"
                    )}"></div>
                </div>

                <div class="form-section">
                    <h3>Atendimento Ativo (PB)</h3>
                    <div class="form-group"><label>Profissional</label><input type="text" id="edit-pb-profissionalNome" class="form-control" value="${
                      ativoPB.profissionalNome || ""
                    }"></div>
                    <div class="form-group"><label>Dia da Semana</label><input type="text" id="edit-pb-diaSemana" class="form-control" value="${
                      ativoPB.horarioSessao?.diaSemana || ""
                    }"></div>
                    <div class="form-group"><label>Horário</label><input type="time" id="edit-pb-horario" class="form-control" value="${
                      ativoPB.horarioSessao?.horario || ""
                    }"></div>
                    <div class="form-group"><label>Data de Início</label><input type="date" id="edit-pb-dataInicio" class="form-control" value="${
                      (ativoPB.horarioSessao?.dataInicio || "").split("T")[0]
                    }"></div>
                    <div class="form-group form-group-full">
                        <label>Atendimentos (JSON - Edição Avançada)</label>
                        <textarea id="edit-atendimentosPB" class="form-control" rows="6">${JSON.stringify(
                          p("atendimentosPB", []),
                          null,
                          2
                        )}</textarea>
                        <small>Para adicionar/remover múltiplos atendimentos, modifique o JSON acima com cuidado.</small>
                    </div>
                </div>
            </form>
        `;
  }
  // --- FIM DA ALTERAÇÃO 2 ---

  // --- INÍCIO DA ALTERAÇÃO 3: Salvar os dados do responsável ---
  saveModalBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    saveModalBtn.disabled = true;
    saveModalBtn.textContent = "Salvando...";

    try {
      const get = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : null; // Função get mais segura
      };

      const docRef = doc(db, "trilhaPaciente", currentEditingId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists())
        throw new Error("Paciente não encontrado para salvar.");

      let originalData = docSnap.data();

      const updatedData = {
        nomeCompleto: get("edit-nomeCompleto"),
        cpf: get("edit-cpf"),
        dataNascimento: get("edit-dataNascimento"),
        email: get("edit-email"),
        telefoneCelular: get("edit-telefoneCelular"),
        comoConheceu: get("edit-comoConheceu"),
        motivoBusca: get("edit-motivoBusca"),
        queixaPrincipal: get("edit-queixaPrincipal"),
        valorContribuicao: get("edit-valorContribuicao"),
        criteriosValor: get("edit-criteriosValor"),
        modalidadeAtendimento: get("edit-modalidadeAtendimento"),
        preferenciaAtendimento: get("edit-preferenciaAtendimento"),
        status: get("edit-status"),
        assistenteSocialTriagem: {
          ...(originalData.assistenteSocialTriagem || {}),
          nome: get("edit-assistenteSocialTriagemNome"),
        },
        plantaoInfo: {
          ...(originalData.plantaoInfo || {}),
          profissionalNome: get("edit-plantaoProfissionalNome"),
          dataPrimeiraSessao: get("edit-plantaoDataSessao"),
          horaPrimeiraSessao: get("edit-plantaoHoraSessao"),
        },
        lastUpdate: serverTimestamp(),
        lastUpdatedBy: currentUserData.nome || "Admin",
      };

      // Adiciona os dados do responsável se for menor de idade
      const idade = calcularIdade(updatedData.dataNascimento);
      if (idade !== null && idade < 18) {
        updatedData.responsavel = {
          nome: get("edit-responsavelNome"),
          cpf: get("edit-responsavelCpf"),
          telefone: get("edit-responsavelTelefone"),
        };
      } else {
        // Opcional: remove os dados do responsável se a pessoa não for mais menor
        updatedData.responsavel = originalData.responsavel || null;
      }

      let atendimentosPB = JSON.parse(
        document.getElementById("edit-atendimentosPB").value
      );
      const ativoIndex = atendimentosPB.findIndex(
        (at) => at.statusAtendimento === "ativo"
      );

      if (ativoIndex > -1) {
        const horarioSessaoOriginal =
          atendimentosPB[ativoIndex].horarioSessao || {};
        atendimentosPB[ativoIndex] = {
          ...atendimentosPB[ativoIndex],
          profissionalNome: get("edit-pb-profissionalNome"),
          horarioSessao: {
            ...horarioSessaoOriginal,
            diaSemana: get("edit-pb-diaSemana"),
            horario: get("edit-pb-horario"),
            dataInicio: get("edit-pb-dataInicio"),
          },
        };
      }
      updatedData.atendimentosPB = atendimentosPB;

      await updateDoc(docRef, updatedData);

      const updatedDoc = await getDoc(docRef);
      if (updatedDoc.exists()) {
        const index = allPacientes.findIndex((p) => p.id === currentEditingId);
        if (index > -1) {
          allPacientes[index] = { id: updatedDoc.id, ...updatedDoc.data() };
        }
      }

      renderizarLista();
      closeModalFunction();
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      alert(
        `Falha ao salvar. Verifique o console para mais detalhes. Erro: ${error.message}`
      );
    } finally {
      saveModalBtn.disabled = false;
      saveModalBtn.textContent = "Salvar Alterações";
    }
  });
  // --- FIM DA ALTERAÇÃO 3 ---

  async function deletarPaciente(pacienteId, nome) {
    if (
      confirm(
        `Tem certeza que deseja excluir permanentemente o paciente "${nome}"?\nEsta ação não pode ser desfeita.`
      )
    ) {
      try {
        await deleteDoc(doc(db, "trilhaPaciente", pacienteId));
        allPacientes = allPacientes.filter((p) => p.id !== pacienteId);
        renderizarLista();
        alert("Paciente excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir paciente:", error);
        alert("Falha ao excluir o paciente.");
      }
    }
  }

  carregarPacientes();
}
