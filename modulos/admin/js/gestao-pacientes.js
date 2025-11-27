import {
  db,
  getDocs,
  collection,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

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

// Variável para armazenar as listas carregadas do sistema
let systemLists = { parcerias: [], grupos: [] };

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
  console.log("🚀 Módulo de Gestão de Pacientes iniciado.");

  // Elementos do DOM
  const searchInput = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");
  const listContainer = document.getElementById("pacientes-list-container");

  // Elementos do Modal
  const modal = document.getElementById("edit-paciente-modal");
  const modalBody = document.getElementById("modal-body-content");
  const modalTitle = document.getElementById("modal-title");

  // Botões fixos do Modal
  const closeModalBtn = document.querySelector(".close-modal-btn");
  const cancelModalBtn = document.getElementById("modal-cancel-btn");
  const saveModalBtn = document.getElementById("modal-save-btn");

  let allPacientes = [];
  let allProfissionais = [];
  let currentEditingId = null;
  let currentUserData = userData;

  // --- Função Auxiliar: Gerar ID Único ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // --- Carregar Configurações (Listas) ---
  async function carregarConfiguracoes() {
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data();
        systemLists.parcerias = data.listas?.parcerias || [];
        systemLists.grupos = data.listas?.grupos || [];
        console.log("✅ Listas do sistema carregadas:", systemLists);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  }

  // --- Carregar Lista de Profissionais Ativos ---
  async function carregarProfissionais() {
    try {
      const q = query(
        collection(db, "usuarios"),
        where("inativo", "==", false),
        orderBy("nome")
      );
      const querySnapshot = await getDocs(q);
      allProfissionais = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        nome: doc.data().nome,
      }));
      console.log(`✅ ${allProfissionais.length} profissionais carregados.`);
    } catch (error) {
      console.error("Erro ao carregar profissionais:", error);
    }
  }

  // --- Carregar Pacientes ---
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
      listContainer.innerHTML = "Não foi possível carregar os pacientes.";
    }
  }

  // --- Renderizar Lista de Cards ---
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
          <div class="paciente-info">
            <strong>${p.nomeCompleto || "Não informado"}</strong>
            <br />
            <strong>CPF:</strong> ${p.cpf || "Não informado"}
            <br />
            <strong>Status:</strong> ${statusDisplay}
            <br />
            <strong>Idade:</strong> ${idadeDisplay}
          </div>
          <div class="paciente-actions">
            <button class="edit-btn action-button secondary" data-id="${
              p.id
            }">✏️ Editar</button>
            <button class="delete-btn action-button danger" data-id="${
              p.id
            }">🗑️ Deletar</button>
          </div>
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
      "manha-semana": ["08:00", "09:00", "10:00", "11:00"],
      "tarde-semana": ["13:00", "14:00", "15:00", "16:00", "17:00"],
      "noite-semana": ["18:00", "19:00", "20:00", "21:00"],
      "manha-sabado": ["08:00", "09:00", "10:00", "11:00"],
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

  // --- Helper para Extrair Nomes ---
  function extrairNomesProfissionais(paciente, tipo) {
    if (tipo === "atendimentosPB") {
      const arrayAtendimentos = paciente.atendimentosPB;
      if (Array.isArray(arrayAtendimentos) && arrayAtendimentos.length > 0) {
        const nomes = arrayAtendimentos
          .filter((at) => at.statusAtendimento === "ativo")
          .map((item) => item.profissionalNome)
          .filter((nome) => nome && nome.trim() !== "");

        if (nomes.length > 0) return nomes.join(", ");
      }
      return paciente.profissionalPB || "";
    }

    if (tipo === "atendimentosPlantao") {
      if (paciente.plantaoInfo && paciente.plantaoInfo.profissionalNome) {
        return paciente.plantaoInfo.profissionalNome;
      }
      return paciente.profissionalPlantao || "";
    }
    return "";
  }

  // --- Gerar Formulário HTML ---
  function gerarFormularioEdicao(paciente) {
    const p = (path, defaultValue = "") =>
      path.split(".").reduce((acc, part) => acc && acc[part], paciente) ||
      defaultValue;

    let statusOptions = Object.keys(ALL_STATUS)
      .map(
        (key) =>
          `<option value="${key}" ${
            paciente.status === key ? "selected" : ""
          }>${ALL_STATUS[key]}</option>`
      )
      .join("");

    // Opções de Parceria
    let parceriaOptions = '<option value="">Selecione...</option>';
    systemLists.parcerias.forEach((parc) => {
      parceriaOptions += `<option value="${parc}" ${
        p("parceria") === parc ? "selected" : ""
      }>${parc}</option>`;
    });

    const idade = calcularIdade(paciente.dataNascimento);
    let htmlResponsavel = "";

    if (idade !== null && idade < 18) {
      htmlResponsavel = `
        <fieldset>
          <legend>Responsável Legal</legend>
          <input type="text" id="responsavelNome" value="${p(
            "responsavelNome",
            ""
          )}" placeholder="Nome do responsável" />
          <input type="text" id="responsavelCpf" value="${p(
            "responsavelCpf",
            ""
          )}" placeholder="CPF do responsável" />
          <input type="text" id="responsavelParentesco" value="${p(
            "responsavelParentesco",
            ""
          )}" placeholder="Parentesco" />
          <input type="tel" id="responsavelContato" value="${p(
            "responsavelContato",
            ""
          )}" placeholder="Contato do responsável" />
        </fieldset>
      `;
    }

    const disponibilidadeGeral = paciente.disponibilidadeGeral || [];
    const disponibilidade = {
      "manha-semana": disponibilidadeGeral.includes("Manhã (Durante a semana)"),
      "tarde-semana": disponibilidadeGeral.includes("Tarde (Durante a semana)"),
      "noite-semana": disponibilidadeGeral.includes("Noite (Durante a semana)"),
      "manha-sabado": disponibilidadeGeral.includes("Manhã (Sábado)"),
    };

    let optionsProfissionais =
      '<option value="">+ Selecionar Profissional...</option>';
    allProfissionais.forEach((prof) => {
      optionsProfissionais += `<option value="${prof.nome}">${prof.nome}</option>`;
    });

    const nomesProfissionaisPB = extrairNomesProfissionais(
      paciente,
      "atendimentosPB"
    );
    const nomesProfissionaisPlantao = extrairNomesProfissionais(
      paciente,
      "atendimentosPlantao"
    );

    const htmlDisponibilidade = `
      <fieldset>
        <legend>Disponibilidade de Horário</legend>
        <div>
          <label><input type="checkbox" class="horario-option" value="manha-semana" ${
            disponibilidade["manha-semana"] ? "checked" : ""
          } /> 🌅 Manhã (Durante a semana)</label>
          <label><input type="checkbox" class="horario-option" value="tarde-semana" ${
            disponibilidade["tarde-semana"] ? "checked" : ""
          } /> 🌤️ Tarde (Durante a semana)</label>
          <label><input type="checkbox" class="horario-option" value="noite-semana" ${
            disponibilidade["noite-semana"] ? "checked" : ""
          } /> 🌙 Noite (Durante a semana)</label>
          <label><input type="checkbox" class="horario-option" value="manha-sabado" ${
            disponibilidade["manha-sabado"] ? "checked" : ""
          } /> 📅 Manhã (Sábado)</label>
        </div>

        <div id="container-manha-semana" style="display: ${
          disponibilidade["manha-semana"] ? "block" : "none"
        };">
          <h4>🌅 Manhã (Seg-Sex):</h4>
          <div>${gerarHorariosHTML("manha-semana", paciente)}</div>
        </div>
        <div id="container-tarde-semana" style="display: ${
          disponibilidade["tarde-semana"] ? "block" : "none"
        };">
          <h4>🌤️ Tarde (Seg-Sex):</h4>
          <div>${gerarHorariosHTML("tarde-semana", paciente)}</div>
        </div>
        <div id="container-noite-semana" style="display: ${
          disponibilidade["noite-semana"] ? "block" : "none"
        };">
          <h4>🌙 Noite (Seg-Sex):</h4>
          <div>${gerarHorariosHTML("noite-semana", paciente)}</div>
        </div>
        <div id="container-manha-sabado" style="display: ${
          disponibilidade["manha-sabado"] ? "block" : "none"
        };">
          <h4>📅 Manhã (Sábado):</h4>
          <div>${gerarHorariosHTML("manha-sabado", paciente)}</div>
        </div>
      </fieldset>
    `;

    const form = `
      <form id="edit-paciente-form">
        <fieldset>
          <legend>Status</legend>
          <select id="status">${statusOptions}</select>
          
          <div id="parceria-container" style="display: ${
            paciente.status === "pacientes_parcerias" ? "block" : "none"
          }; margin-top: 15px;">
            <label for="parceria">Selecione a Parceria:</label>
            <select id="parceria" class="form-control">
                ${parceriaOptions}
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend>Informações Pessoais</legend>
          <input type="text" id="nomeCompleto" value="${p(
            "nomeCompleto",
            ""
          )}" placeholder="Nome Completo" />
          <input type="text" id="cpf" value="${p(
            "cpf",
            ""
          )}" placeholder="CPF" />
          <input type="date" id="dataNascimento" value="${p(
            "dataNascimento",
            ""
          )}" />
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
          <input type="text" id="rg" value="${p("rg", "")}" placeholder="RG" />
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
          <input type="tel" id="telefoneCelular" value="${p(
            "telefoneCelular",
            ""
          )}" placeholder="Telefone Celular" />
          <input type="tel" id="telefoneFixo" value="${p(
            "telefoneFixo",
            ""
          )}" placeholder="Telefone Fixo" />
          <input type="email" id="email" value="${p(
            "email",
            ""
          )}" placeholder="E-mail" />
        </fieldset>

        <fieldset>
          <legend>Endereço</legend>
          <input type="text" id="cep" value="${p(
            "cep",
            ""
          )}" placeholder="CEP" />
          <input type="text" id="cidade" value="${p(
            "cidade",
            ""
          )}" placeholder="Cidade" />
          <input type="text" id="rua" value="${p(
            "rua",
            ""
          )}" placeholder="Rua" />
          <input type="text" id="numeroCasa" value="${p(
            "numeroCasa",
            ""
          )}" placeholder="Número" />
          <input type="text" id="bairro" value="${p(
            "bairro",
            ""
          )}" placeholder="Bairro" />
          <input type="text" id="complemento" value="${p(
            "complemento",
            ""
          )}" placeholder="Complemento" />
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
          <input type="number" id="pessoasMoradia" value="${p(
            "pessoasMoradia",
            ""
          )}" placeholder="Quantidade de pessoas" />
          <select id="casaPropria">
            <option value="">-- Casa Própria? --</option>
            <option value="Sim" ${
              p("casaPropria") === "Sim" ? "selected" : ""
            }>Sim</option>
            <option value="Não" ${
              p("casaPropria") === "Não" ? "selected" : ""
            }>Não</option>
          </select>
          <input type="number" id="valorAluguel" value="${p(
            "valorAluguel",
            ""
          )}" placeholder="Valor do aluguel" />
        </fieldset>

        <fieldset>
          <legend>Renda</legend>
          <input type="number" id="rendaMensal" value="${p(
            "rendaMensal",
            ""
          )}" placeholder="Renda Mensal" />
          <input type="number" id="rendaFamiliar" value="${p(
            "rendaFamiliar",
            ""
          )}" placeholder="Renda Familiar" />
        </fieldset>

        ${htmlResponsavel}

        <fieldset>
          <legend>Triagem</legend>
          <input type="date" id="dataTriagem" value="${p("dataTriagem", "")}" />
          <input type="time" id="horaTriagem" value="${p("horaTriagem", "")}" />
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
          <input type="number" id="valorContribuicao" value="${p(
            "valorContribuicao",
            ""
          )}" placeholder="Valor Contribuição" />
          <textarea id="queixaPaciente" placeholder="Queixa do Paciente">${p(
            "queixaPaciente",
            ""
          )}</textarea>
          <textarea id="motivoBusca" placeholder="Motivo de Busca">${p(
            "motivoBusca",
            ""
          )}</textarea>
          <textarea id="tratamentoAnterior" placeholder="Tratamento Anterior">${p(
            "tratamentoAnterior",
            ""
          )}</textarea>
        </fieldset>

        ${htmlDisponibilidade}

        <fieldset>
          <legend>Modalidade e Preferências de Atendimento</legend>
          <label>
            <span>Modalidade de Atendimento:</span>
            <select id="modalidadeAtendimento">
              <option value="">-- Selecione --</option>
              <option value="Presencial" ${
                p("modalidadeAtendimento") === "Presencial" ? "selected" : ""
              }>🏢 Presencial</option>
              <option value="On-line" ${
                p("modalidadeAtendimento") === "On-line" ? "selected" : ""
              }>💻 On-line</option>
              <option value="Qualquer" ${
                p("modalidadeAtendimento") === "Qualquer" ? "selected" : ""
              }>🔄 Qualquer um</option>
            </select>
          </label>

          <label>
            <span>Preferência de Atendimento (Gênero):</span>
            <select id="preferenciaGenero">
              <option value="">-- Selecione --</option>
              <option value="Homem" ${
                p("preferenciaGenero") === "Homem" ? "selected" : ""
              }>👨 Homem</option>
              <option value="Mulher" ${
                p("preferenciaGenero") === "Mulher" ? "selected" : ""
              }>👩 Mulher</option>
              <option value="Qualquer" ${
                p("preferenciaGenero") === "Qualquer" ? "selected" : ""
              }>🔄 Qualquer um</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Profissionais Responsáveis</legend>
          <p style="font-size: 0.8em; color: #666; margin-bottom: 10px;">
            Os campos abaixo refletem os profissionais cadastrados nos arrays de atendimento. Ao adicionar nomes aqui, a estrutura correta será atualizada.
          </p>
          
          <label for="assistenteSocial" style="display:block; margin-top:10px;">Assistente Social:</label>
          <input type="text" id="assistenteSocial" value="${p(
            "assistenteSocial",
            ""
          )}" placeholder="Ex: Maria Silva" />

          <label for="profissionalPB" style="display:block; margin-top:10px;">Profissional PB:</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="profissionalPB" value="${nomesProfissionaisPB}" placeholder="Ex: Dr. João, Dra. Ana" style="flex: 1;" />
            <select class="quick-add-prof" data-target="profissionalPB" style="width: 180px;">
                ${optionsProfissionais}
            </select>
          </div>

          <label for="profissionalPlantao" style="display:block; margin-top:10px;">Profissional Plantão:</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="profissionalPlantao" value="${nomesProfissionaisPlantao}" placeholder="Ex: Psicólogo Pedro" style="flex: 1;" />
            <select class="quick-add-prof" data-target="profissionalPlantao" style="width: 180px;">
                ${optionsProfissionais}
            </select>
          </div>
        </fieldset>
      </form>
    `;

    return form;
  }

  // --- Abrir Modal ---
  async function abrirModalEdicao(pacienteId) {
    currentEditingId = pacienteId;
    const paciente = allPacientes.find((p) => p.id === pacienteId);

    if (!paciente) {
      alert("Paciente não encontrado.");
      return;
    }

    modalTitle.textContent = `✏️ Editar: ${paciente.nomeCompleto}`;

    // Injeta APENAS o corpo
    const formulario = gerarFormularioEdicao(paciente);
    modalBody.innerHTML = formulario;

    // Listeners internos
    setupDisponibilidadeListeners(modalBody);

    // Listener para troca de status (Exibir Parceria)
    const statusSelect = document.getElementById("status");
    const parceriaContainer = document.getElementById("parceria-container");
    if (statusSelect && parceriaContainer) {
      statusSelect.addEventListener("change", (e) => {
        if (e.target.value === "pacientes_parcerias") {
          parceriaContainer.style.display = "block";
        } else {
          parceriaContainer.style.display = "none";
          document.getElementById("parceria").value = ""; // Limpa se mudar status
        }
      });
    }

    const quickAddSelects = modalBody.querySelectorAll(".quick-add-prof");
    quickAddSelects.forEach((select) => {
      select.addEventListener("change", (e) => {
        const selectedName = e.target.value;
        if (!selectedName) return;

        const targetId = e.target.getAttribute("data-target");
        const inputField = document.getElementById(targetId);

        if (inputField) {
          const currentValue = inputField.value.trim();

          if (currentValue === "") {
            inputField.value = selectedName;
          } else {
            if (!currentValue.includes(selectedName)) {
              inputField.value = currentValue + ", " + selectedName;
            }
          }
        }
        e.target.value = "";
      });
    });

    modal.style.display = "flex";
  }

  // --- LÓGICA DE SALVAMENTO ATUALIZADA ---
  async function salvarEdicao() {
    try {
      const pacientesRef = doc(db, "trilhaPaciente", currentEditingId);
      const pacienteAtualSnap = await getDoc(pacientesRef);
      const pacienteAtual = pacienteAtualSnap.data() || {};

      let disponibilidadeEspecifica = [];
      let disponibilidadeGeral = [];

      const periodos = [
        { id: "manha-semana", label: "Manhã (Durante a semana)" },
        { id: "tarde-semana", label: "Tarde (Durante a semana)" },
        { id: "noite-semana", label: "Noite (Durante a semana)" },
        { id: "manha-sabado", label: "Manhã (Sábado)" },
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
      if (
        disponibilidadeEspecifica.length === 0 &&
        pacienteAtual.disponibilidadeEspecifica
      ) {
        disponibilidadeEspecifica = pacienteAtual.disponibilidadeEspecifica;
      }
      if (
        disponibilidadeGeral.length === 0 &&
        pacienteAtual.disponibilidadeGeral
      ) {
        disponibilidadeGeral = pacienteAtual.disponibilidadeGeral;
      }

      // --- TRATAMENTO DOS PROFISSIONAIS PB (ARRAY) ---
      const inputPB = document.getElementById("profissionalPB")?.value || "";
      const nomesNoInputPB = inputPB
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n);

      const atendimentosPBAtuais = pacienteAtual.atendimentosPB || [];
      const novosAtendimentosPB = [...atendimentosPBAtuais];
      const ativosAtuais = novosAtendimentosPB.filter(
        (at) => at.statusAtendimento === "ativo"
      );

      ativosAtuais.forEach((at) => {
        if (!nomesNoInputPB.includes(at.profissionalNome)) {
          const index = novosAtendimentosPB.findIndex(
            (x) => x.atendimentoId === at.atendimentoId
          );
          if (index !== -1) {
            novosAtendimentosPB[index].statusAtendimento = "encerrado";
            novosAtendimentosPB[index].motivoDesistencia =
              "Removido via Gestão de Pacientes";
          }
        }
      });

      nomesNoInputPB.forEach((nome) => {
        const jaTemAtivo = ativosAtuais.some(
          (at) => at.profissionalNome === nome
        );
        if (!jaTemAtivo) {
          const profEncontrado = allProfissionais.find(
            (p) => p.nome.toLowerCase() === nome.toLowerCase()
          );
          const profId = profEncontrado ? profEncontrado.id : "";

          novosAtendimentosPB.push({
            atendimentoId: generateId(),
            profissionalNome: nome,
            profissionalId: profId,
            statusAtendimento: "ativo",
            tipoProfissional: "Voluntária(o)",
            dataEncaminhamento: new Date().toISOString().split("T")[0],
            dataPrimeiraSessao: "",
            horaPrimeiraSessao: "",
            tipoAtendimento: "",
            observacoes: "",
          });
        }
      });

      // --- TRATAMENTO DO PROFISSIONAL PLANTÃO (OBJETO) ---
      const inputPlantao =
        document.getElementById("profissionalPlantao")?.value || "";
      const plantaoInfo = pacienteAtual.plantaoInfo || {};

      if (plantaoInfo.profissionalNome !== inputPlantao) {
        plantaoInfo.profissionalNome = inputPlantao;
        const primeiroNome = inputPlantao.split(",")[0].trim();
        const profEncontrado = allProfissionais.find(
          (p) => p.nome.toLowerCase() === primeiroNome.toLowerCase()
        );
        plantaoInfo.profissionalId = profEncontrado
          ? profEncontrado.id
          : plantaoInfo.profissionalId || "";
      }

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
        casaPropria: document.getElementById("casaPropria")?.value || "",
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
        modalidadeAtendimento:
          document.getElementById("modalidadeAtendimento")?.value || "",
        preferenciaGenero:
          document.getElementById("preferenciaGenero")?.value || "",
        assistenteSocial:
          document.getElementById("assistenteSocial")?.value || "",

        atendimentosPB: novosAtendimentosPB,
        plantaoInfo: plantaoInfo,

        profissionalPB: inputPB,
        profissionalPlantao: inputPlantao,

        status: document.getElementById("status")?.value || "",
        // Salva a parceria
        parceria: document.getElementById("parceria")?.value || "",

        lastUpdate: serverTimestamp(),
        lastUpdatedBy: currentUserData.nome,
      };

      await updateDoc(pacientesRef, dadosAtualizados);

      console.log("✅ Paciente atualizado com sucesso!");
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

  // --- Listeners Globais ---
  closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  cancelModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  saveModalBtn.addEventListener("click", async () => {
    if (currentEditingId) {
      await salvarEdicao();
    }
  });

  searchInput.addEventListener("input", renderizarLista);
  statusFilter.addEventListener("change", renderizarLista);

  carregarConfiguracoes(); // Carrega as listas de parcerias e grupos
  carregarPacientes();
  carregarProfissionais();
}
