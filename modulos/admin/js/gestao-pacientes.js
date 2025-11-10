// ========================================
// ARQUIVO: gestao-pacientes.js (COMPLETO)
// ========================================

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

function calcularIdade(dataNascimento) {
  if (!dataNascimento || !dataNascimento.includes("-")) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento + "T00:00:00Z");
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const m = hoje.getUTCMonth() - nascimento.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < nascimento.getUTCDate())) {
    idade--;
  }
  return idade;
}

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
    listContainer.innerHTML = "";

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
      listContainer.innerHTML = "Não foi possível carregar os pacientes.";
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
        "Nenhum paciente encontrado com os filtros aplicados.";
      return;
    }

    let html = "";

    for (const p of filteredPacientes) {
      const statusDisplay = ALL_STATUS[p.status] || p.status || "Não definido";
      const idade = calcularIdade(p.dataNascimento);
      const idadeDisplay = idade !== null ? `${idade} anos` : "Não informado";

      html += `
        <div class="paciente-card">
          <strong>${p.nomeCompleto || "Não informado"}</strong>
          <br />
          <strong>CPF:</strong> ${p.cpf || "Não informado"}
          <br />
          <strong>Status:</strong> ${statusDisplay}
          <br />
          <strong>Idade:</strong> ${idadeDisplay}
          <br />
          <button class="edit-btn" data-id="${p.id}">✏️ Editar</button>
          <button class="delete-btn" data-id="${p.id}">🗑️ Deletar</button>
        </div>
      `;
    }

    listContainer.innerHTML = html;

    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deletarPaciente(btn.dataset.id));
    });
  }

  function popularFiltroStatus() {
    const statusUnicos = [...new Set(allPacientes.map((p) => p.status))];
    statusFilter.innerHTML = '<option value="">Todos os Status</option>';
    for (const status of statusUnicos) {
      statusFilter.innerHTML += `<option value="${status}">${
        ALL_STATUS[status] || status
      }</option>`;
    }
  }

  function gerarHorariosHTML(periodo, paciente) {
    const horarios = {
      manha_semana: ["08:00", "09:00", "10:00", "11:00"],
      tarde_semana: ["13:00", "14:00", "15:00", "16:00", "17:00"],
      noite_semana: ["18:00", "19:00", "20:00", "21:00"],
      manha_sabado: ["08:00", "09:00", "10:00", "11:00"],
    };

    const disponibilidadeEspecifica = paciente.disponibilidadeEspecifica || [];

    return horarios[periodo]
      .map((hora) => {
        const isChecked = disponibilidadeEspecifica.includes(
          `${periodo}_${hora}`
        );
        return `
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: ${
            isChecked ? "#d4edda" : "#fff"
          };">
            <input 
              type="checkbox" 
              class="horario-${periodo}" 
              value="${hora}"
              ${isChecked ? "checked" : ""}
              style="width: 16px; height: 16px; cursor: pointer;"
            />
            <span style="font-size: 12px;">${hora}</span>
          </label>
        `;
      })
      .join("");
  }

  function setupDisponibilidadeListeners(modalBody) {
    const horarioCheckboxes = modalBody.querySelectorAll(".horario-option");

    horarioCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const periodo = e.target.value;
        const container = modalBody.querySelector(`#container-${periodo}`);

        if (e.target.checked) {
          container.style.display = "block";
          container.classList.remove("hidden-section");
        } else {
          container.style.display = "none";
          container.classList.add("hidden-section");
          const horarioCheckboxes = container.querySelectorAll(
            `.horario-${periodo}`
          );
          horarioCheckboxes.forEach((cb) => (cb.checked = false));
        }
      });
    });
  }

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
          `<option value="${key}" ${
            paciente.status === key ? "selected" : ""
          }>${ALL_STATUS[key]}</option>`
      )
      .join("");

    const idade = calcularIdade(paciente.dataNascimento);
    let htmlResponsavel = "";

    if (idade !== null && idade < 18) {
      htmlResponsavel = `
        <fieldset>
          <legend>Responsável Legal</legend>
          <input
            type="text"
            id="responsavelNome"
            value="${p("responsavelNome", "")}" 
            placeholder="Nome do responsável"
          />
          <input
            type="text"
            id="responsavelCpf"
            value="${p("responsavelCpf", "")}" 
            placeholder="CPF do responsável"
          />
          <input
            type="text"
            id="responsavelParentesco"
            value="${p("responsavelParentesco", "")}" 
            placeholder="Parentesco"
          />
          <input
            type="tel"
            id="responsavelContato"
            value="${p("responsavelContato", "")}" 
            placeholder="Contato do responsável"
          />
        </fieldset>
      `;
    }

    const disponibilidadeGeral = paciente.disponibilidadeGeral || [];
    const disponibilidade = {
      manha_semana: disponibilidadeGeral.includes("Manhã (Durante a semana)"),
      tarde_semana: disponibilidadeGeral.includes("Tarde (Durante a semana)"),
      noite_semana: disponibilidadeGeral.includes("Noite (Durante a semana)"),
      manha_sabado: disponibilidadeGeral.includes("Manhã (Sábado)"),
    };

    const htmlDisponibilidade = `
      <fieldset style="margin: 20px 0; padding: 20px; border: 2px solid #3498db; border-radius: 5px; background-color: #ecf0f1;">
        <legend style="font-weight: bold; font-size: 15px; color: #2c3e50; padding: 0 10px;">📅 EDITAR DISPONIBILIDADE DE HORÁRIO</legend>
        
        <div style="margin-top: 15px;">
          <label style="font-weight: bold; font-size: 13px; display: block; margin-bottom: 10px;">Opção de horário(s) para atendimento: *</label>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input 
                type="checkbox" 
                class="horario-option" 
                value="manha_semana" 
                ${disponibilidade.manha_semana ? "checked" : ""} 
                style="width: 18px; height: 18px; cursor: pointer;"
              />
              <span style="font-size: 13px;">🌅 Manhã (Durante a semana)</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input 
                type="checkbox" 
                class="horario-option" 
                value="tarde_semana" 
                ${disponibilidade.tarde_semana ? "checked" : ""} 
                style="width: 18px; height: 18px; cursor: pointer;"
              />
              <span style="font-size: 13px;">🌤️ Tarde (Durante a semana)</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input 
                type="checkbox" 
                class="horario-option" 
                value="noite_semana" 
                ${disponibilidade.noite_semana ? "checked" : ""} 
                style="width: 18px; height: 18px; cursor: pointer;"
              />
              <span style="font-size: 13px;">🌙 Noite (Durante a semana)</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input 
                type="checkbox" 
                class="horario-option" 
                value="manha_sabado" 
                ${disponibilidade.manha_sabado ? "checked" : ""} 
                style="width: 18px; height: 18px; cursor: pointer;"
              />
              <span style="font-size: 13px;">📅 Manhã (Sábado)</span>
            </label>

          </div>

          <div id="container-manha_semana" class="horario-container" style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 4px; display: ${
            disponibilidade.manha_semana ? "block" : "none"
          };">
            <h4 style="margin-top: 0; color: #2c3e50;">🌅 Manhã (Seg-Sex):</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              ${gerarHorariosHTML("manha_semana", paciente)}
            </div>
          </div>

          <div id="container-tarde_semana" class="horario-container" style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 4px; display: ${
            disponibilidade.tarde_semana ? "block" : "none"
          };">
            <h4 style="margin-top: 0; color: #2c3e50;">🌤️ Tarde (Seg-Sex):</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              ${gerarHorariosHTML("tarde_semana", paciente)}
            </div>
          </div>

          <div id="container-noite_semana" class="horario-container" style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 4px; display: ${
            disponibilidade.noite_semana ? "block" : "none"
          };">
            <h4 style="margin-top: 0; color: #2c3e50;">🌙 Noite (Seg-Sex):</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              ${gerarHorariosHTML("noite_semana", paciente)}
            </div>
          </div>

          <div id="container-manha_sabado" class="horario-container" style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 4px; display: ${
            disponibilidade.manha_sabado ? "block" : "none"
          };">
            <h4 style="margin-top: 0; color: #2c3e50;">📅 Manhã (Sábado):</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              ${gerarHorariosHTML("manha_sabado", paciente)}
            </div>
          </div>

        </div>
      </fieldset>
    `;

    const form = `
      <form id="edit-paciente-form">
        <fieldset>
          <legend>Informações Pessoais</legend>
          <input
            type="text"
            id="nomeCompleto"
            value="${p("nomeCompleto", "")}"
            placeholder="Nome Completo"
          />
          <input
            type="text"
            id="cpf"
            value="${p("cpf", "")}"
            placeholder="CPF"
          />
          <input
            type="date"
            id="dataNascimento"
            value="${p("dataNascimento", "")}"
          />
          <select id="genero">
            <option value="">-- Gênero --</option>
            <option value="Masculino" ${
              p("genero") === "Masculino" ? "selected" : ""
            }>Masculino</option>
            <option value="Feminino" ${
              p("genero") === "Feminino" ? "selected" : ""
            }>Feminino</option>
            <option value="Outro" ${
              p("genero") === "Outro" ? "selected" : ""
            }>Outro</option>
          </select>
          <input
            type="text"
            id="rg"
            value="${p("rg", "")}"
            placeholder="RG"
          />
          <select id="estadoCivil">
            <option value="">-- Estado Civil --</option>
            <option value="Solteiro" ${
              p("estadoCivil") === "Solteiro" ? "selected" : ""
            }>Solteiro</option>
            <option value="Casado" ${
              p("estadoCivil") === "Casado" ? "selected" : ""
            }>Casado</option>
            <option value="Divorciado" ${
              p("estadoCivil") === "Divorciado" ? "selected" : ""
            }>Divorciado</option>
            <option value="Viúvo" ${
              p("estadoCivil") === "Viúvo" ? "selected" : ""
            }>Viúvo</option>
          </select>
          <select id="escolaridade">
            <option value="">-- Escolaridade --</option>
            <option value="Ensino Fundamental" ${
              p("escolaridade") === "Ensino Fundamental" ? "selected" : ""
            }>Ensino Fundamental</option>
            <option value="Ensino Médio" ${
              p("escolaridade") === "Ensino Médio" ? "selected" : ""
            }>Ensino Médio</option>
            <option value="Ensino Superior" ${
              p("escolaridade") === "Ensino Superior" ? "selected" : ""
            }>Ensino Superior</option>
            <option value="Pós-Graduação" ${
              p("escolaridade") === "Pós-Graduação" ? "selected" : ""
            }>Pós-Graduação</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Contato</legend>
          <input
            type="tel"
            id="telefoneCelular"
            value="${p("telefoneCelular", "")}"
            placeholder="Telefone Celular"
          />
          <input
            type="tel"
            id="telefoneFixo"
            value="${p("telefoneFixo", "")}"
            placeholder="Telefone Fixo"
          />
          <input
            type="email"
            id="email"
            value="${p("email", "")}"
            placeholder="E-mail"
          />
        </fieldset>

        <fieldset>
          <legend>Endereço</legend>
          <input
            type="text"
            id="cep"
            value="${p("cep", "")}"
            placeholder="CEP"
          />
          <input
            type="text"
            id="cidade"
            value="${p("cidade", "")}"
            placeholder="Cidade"
          />
          <input
            type="text"
            id="rua"
            value="${p("rua", "")}"
            placeholder="Rua"
          />
          <input
            type="text"
            id="numeroCasa"
            value="${p("numeroCasa", "")}"
            placeholder="Número"
          />
          <input
            type="text"
            id="bairro"
            value="${p("bairro", "")}"
            placeholder="Bairro"
          />
          <input
            type="text"
            id="complemento"
            value="${p("complemento", "")}"
            placeholder="Complemento"
          />
        </fieldset>

        <fieldset>
          <legend>Moradia</legend>
          <select id="tipoMoradia">
            <option value="">-- Tipo de Moradia --</option>
            <option value="Casa" ${
              p("tipoMoradia") === "Casa" ? "selected" : ""
            }>Casa</option>
            <option value="Apartamento" ${
              p("tipoMoradia") === "Apartamento" ? "selected" : ""
            }>Apartamento</option>
            <option value="Outra" ${
              p("tipoMoradia") === "Outra" ? "selected" : ""
            }>Outra</option>
          </select>
          <input
            type="number"
            id="pessoasMoradia"
            value="${p("pessoasMoradia", "")}"
            placeholder="Quantidade de pessoas"
          />
          <input
            type="checkbox"
            id="casaPropria"
            ${p("casaPropria") ? "checked" : ""}
          />
          <label for="casaPropria">Casa própria</label>
          <input
            type="number"
            id="valorAluguel"
            value="${p("valorAluguel", "")}"
            placeholder="Valor do aluguel"
          />
        </fieldset>

        <fieldset>
          <legend>Renda</legend>
          <input
            type="number"
            id="rendaMensal"
            value="${p("rendaMensal", "")}"
            placeholder="Renda Mensal"
          />
          <input
            type="number"
            id="rendaFamiliar"
            value="${p("rendaFamiliar", "")}"
            placeholder="Renda Familiar"
          />
        </fieldset>

        ${htmlResponsavel}

        <fieldset>
          <legend>Triagem</legend>
          <input
            type="date"
            id="dataTriagem"
            value="${p("dataTriagem", "")}"
          />
          <input
            type="time"
            id="horaTriagem"
            value="${p("horaTriagem", "")}"
          />
          <select id="tipoTriagem">
            <option value="">-- Tipo de Triagem --</option>
            <option value="On-line" ${
              p("tipoTriagem") === "On-line" ? "selected" : ""
            }>On-line</option>
            <option value="Presencial" ${
              p("tipoTriagem") === "Presencial" ? "selected" : ""
            }>Presencial</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Atendimento</legend>
          <input
            type="number"
            id="valorContribuicao"
            value="${p("valorContribuicao", "")}"
            placeholder="Valor Contribuição"
          />
          <textarea
            id="queixaPaciente"
            placeholder="Queixa do Paciente"
          >${p("queixaPaciente", "")}</textarea>
          <textarea
            id="motivoBusca"
            placeholder="Motivo de Busca"
          >${p("motivoBusca", "")}</textarea>
          <textarea
            id="tratamentoAnterior"
            placeholder="Tratamento Anterior"
          >${p("tratamentoAnterior", "")}</textarea>
        </fieldset>

        ${htmlDisponibilidade}

        <fieldset>
          <legend>Assistente Social</legend>
          <input
            type="text"
            id="assistenteSocial"
            value="${p("assistenteSocial", "")}"
            placeholder="Assistente Social"
          />
        </fieldset>

        <fieldset>
          <legend>Status</legend>
          <select id="status">${statusOptions}</select>
        </fieldset>

        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
          <button type="button" id="form-cancel-btn">Cancelar</button>
          <button type="submit">💾 Salvar Alterações</button>
        </div>
      </form>
    `;

    return form;
  }

  async function abrirModalEdicao(pacienteId) {
    currentEditingId = pacienteId;
    const paciente = allPacientes.find((p) => p.id === pacienteId);

    if (!paciente) {
      alert("Paciente não encontrado.");
      return;
    }

    modalTitle.textContent = `✏️ Editar: ${paciente.nomeCompleto}`;
    const formulario = gerarFormularioEdicao(paciente);
    modalBody.innerHTML = formulario;

    setupDisponibilidadeListeners(modalBody);

    modal.style.display = "flex";

    const formCancelBtn = document.getElementById("form-cancel-btn");
    if (formCancelBtn) {
      formCancelBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    const form = document.getElementById("edit-paciente-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await salvarEdicao();
      });
    }
  }

  async function salvarEdicao() {
    try {
      const pacientesRef = doc(db, "trilhaPaciente", currentEditingId);

      const disponibilidadeEspecifica = [];
      const disponibilidadeGeral = [];

      const periodos = [
        { id: "manha_semana", label: "Manhã (Durante a semana)" },
        { id: "tarde_semana", label: "Tarde (Durante a semana)" },
        { id: "noite_semana", label: "Noite (Durante a semana)" },
        { id: "manha_sabado", label: "Manhã (Sábado)" },
      ];

      periodos.forEach((periodo) => {
        const checkbox = document.querySelector(
          `.horario-option[value="${periodo.id}"]`
        );

        if (checkbox && checkbox.checked) {
          disponibilidadeGeral.push(periodo.label);

          const horarios = document.querySelectorAll(
            `.horario-${periodo.id}:checked`
          );
          horarios.forEach((horario) => {
            disponibilidadeEspecifica.push(`${periodo.id}_${horario.value}`);
          });
        }
      });

      const dadosAtualizados = {
        nomeCompleto: document.getElementById("nomeCompleto")?.value || "",
        cpf: document.getElementById("cpf")?.value || "",
        dataNascimento: document.getElementById("dataNascimento")?.value || "",
        genero: document.getElementById("genero")?.value || "",
        rg: document.getElementById("rg")?.value || "",
        estadoCivil: document.getElementById("estadoCivil")?.value || "",
        escolaridade: document.getElementById("escolaridade")?.value || "",
        telefoneCelular:
          document.getElementById("telefoneCelular")?.value || "",
        telefoneFixo: document.getElementById("telefoneFixo")?.value || "",
        email: document.getElementById("email")?.value || "",
        cep: document.getElementById("cep")?.value || "",
        cidade: document.getElementById("cidade")?.value || "",
        rua: document.getElementById("rua")?.value || "",
        numeroCasa: document.getElementById("numeroCasa")?.value || "",
        bairro: document.getElementById("bairro")?.value || "",
        complemento: document.getElementById("complemento")?.value || "",
        tipoMoradia: document.getElementById("tipoMoradia")?.value || "",
        pessoasMoradia: parseInt(
          document.getElementById("pessoasMoradia")?.value || 0
        ),
        casaPropria: document.getElementById("casaPropria")?.checked || false,
        valorAluguel: parseFloat(
          document.getElementById("valorAluguel")?.value || 0
        ),
        rendaMensal: parseFloat(
          document.getElementById("rendaMensal")?.value || 0
        ),
        rendaFamiliar: parseFloat(
          document.getElementById("rendaFamiliar")?.value || 0
        ),
        responsavelNome:
          document.getElementById("responsavelNome")?.value || "",
        responsavelCpf: document.getElementById("responsavelCpf")?.value || "",
        responsavelParentesco:
          document.getElementById("responsavelParentesco")?.value || "",
        responsavelContato:
          document.getElementById("responsavelContato")?.value || "",
        dataTriagem: document.getElementById("dataTriagem")?.value || "",
        horaTriagem: document.getElementById("horaTriagem")?.value || "",
        tipoTriagem: document.getElementById("tipoTriagem")?.value || "",
        valorContribuicao: parseFloat(
          document.getElementById("valorContribuicao")?.value || 0
        ),
        queixaPaciente: document.getElementById("queixaPaciente")?.value || "",
        motivoBusca: document.getElementById("motivoBusca")?.value || "",
        tratamentoAnterior:
          document.getElementById("tratamentoAnterior")?.value || "",
        disponibilidadeEspecifica: disponibilidadeEspecifica,
        disponibilidadeGeral: disponibilidadeGeral,
        assistenteSocial:
          document.getElementById("assistenteSocial")?.value || "",
        status: document.getElementById("status")?.value || "",
        lastUpdate: serverTimestamp(),
        lastUpdatedBy: currentUserData.nome,
      };

      await updateDoc(pacientesRef, dadosAtualizados);

      console.log("✅ Paciente atualizado com sucesso!");
      console.log("✅ disponibilidadeEspecifica:", disponibilidadeEspecifica);
      console.log("✅ disponibilidadeGeral:", disponibilidadeGeral);
      alert("✅ Dados do paciente atualizados com sucesso!");

      modal.style.display = "none";
      await carregarPacientes();
    } catch (error) {
      console.error("❌ Erro ao salvar alterações:", error);
      alert("❌ Erro ao salvar alterações: " + error.message);
    }
  }

  async function deletarPaciente(pacienteId) {
    const paciente = allPacientes.find((p) => p.id === pacienteId);
    const nome = paciente ? paciente.nomeCompleto : "Paciente";

    if (
      confirm(
        `⚠️ Tem certeza que deseja excluir permanentemente o paciente "${nome}"?\nEsta ação não pode ser desfeita.`
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

  closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  cancelModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  searchInput.addEventListener("input", renderizarLista);
  statusFilter.addEventListener("change", renderizarLista);

  carregarPacientes();
}
