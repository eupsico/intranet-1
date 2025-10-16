// Arquivo: /modulos/voluntario/js/meu-perfil.js
// Versão 2.0 (Atualizado para a sintaxe modular do Firebase v9)

import {
  db,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const container = document.getElementById("perfil-container");
  const actionsContainer = document.getElementById("perfil-actions");

  if (!container || !actionsContainer) return;

  let userDocRef;
  let originalData = {}; // Armazena os dados originais para o botão "Cancelar"

  // --- FUNÇÕES UTILITÁRIAS (sem alteração de lógica) ---

  function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, "");
    if (cpf === "" || cpf.length !== 11 || /^(.)\1+$/.test(cpf)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    return true;
  }

  function formatarTelefone(value) {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    value = value.substring(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{5})(\d)/, "$1-$2");
    return value;
  }

  // --- LÓGICA DO FORMULÁRIO ---

  function toggleFormState(enabled) {
    const inputs = container.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      if (!input.classList.contains("always-readonly")) {
        if (input.tagName.toLowerCase() === "select") {
          input.disabled = !enabled;
        } else {
          input.readOnly = !enabled;
        }
      }
    });

    actionsContainer.innerHTML = enabled
      ? `<button id="btn-cancelar-edicao" class="action-button secondary-button">Cancelar</button>
               <button id="btn-salvar-perfil" class="action-button">Salvar Alterações</button>`
      : `<button id="btn-editar-perfil" class="action-button">Editar Perfil</button>`;

    attachActionListeners();
  }

  async function renderForm(data) {
    const profissoes = [
      "Psicologia",
      "Psicopedagogia",
      "Musicoterapia",
      "Nutrição",
      "Advogado",
      "Estágiario",
      "Outros",
    ];
    const conselhos = ["Nenhum", "CRP", "CRM", "CRESS", "OAB", "CFN", "Outro"];

    const profissaoSalva = data.profissao || "";
    const profissaoPadrao = profissoes.includes(profissaoSalva)
      ? profissaoSalva
      : "Outros";
    const outraProfissaoValor =
      profissaoPadrao === "Outros" ? profissaoSalva : "";

    container.innerHTML = `
            <div class="form-row-flex">
                <div class="form-group flex-grow-2">
                    <label for="nome-completo">Nome Completo *</label>
                    <input type="text" id="nome-completo" class="form-control" value="${
                      data.nome || ""
                    }" readonly>
                </div>
                <div class="form-group flex-grow-1">
                    <label for="telefone">Telefone *</label>
                    <input type="tel" id="telefone" class="form-control" value="${formatarTelefone(
                      data.contato || data.telefone || ""
                    )}" maxlength="15" readonly>
                </div>
            </div>
            <div class="form-group">
                <label for="endereco">Endereço</label>
                <input type="text" id="endereco" class="form-control" value="${
                  data.endereco || ""
                }" readonly>
            </div>
            <div class="form-row-flex">
                <div class="form-group">
                    <label for="profissao">Profissão</label>
                    <select id="profissao" class="form-control" disabled></select>
                </div>
                <div class="form-group" id="outra-profissao-container" style="display: none;">
                    <label for="outra-profissao">Qual?</label>
                    <input type="text" id="outra-profissao" class="form-control" value="${outraProfissaoValor}" readonly>
                </div>
                <div class="form-group">
                    <label for="conselho-profissional">Conselho Profissional</label>
                    <select id="conselho-profissional" class="form-control" disabled></select>
                </div>
                <div class="form-group">
                    <label for="registro-profissional">Nº de Registro</label>
                    <input type="text" id="registro-profissional" class="form-control" value="${
                      data.registroProfissional || ""
                    }" readonly>
                </div>
            </div>
            <div class="form-row-flex">
                <div class="form-group">
                    <label for="cpf">CPF</label>
                    <input type="text" id="cpf" class="form-control" value="${
                      data.cpf || ""
                    }" readonly>
                </div>
                <div class="form-group">
                    <label for="rg">RG</label>
                    <input type="text" id="rg" class="form-control" value="${
                      data.rg || ""
                    }" readonly>
                </div>
            </div>
            <div class="form-group">
                <label for="especializacoes">Especializações (separadas por vírgula)</label>
                <textarea id="especializacoes" class="form-control" readonly>${
                  Array.isArray(data.especializacoes)
                    ? data.especializacoes.join(", ")
                    : ""
                }</textarea>
            </div>
            <div class="form-row-flex">
                <div class="form-group">
                    <label for="data-inicio">Data de Início na EuPsico</label>
                    <input type="date" id="data-inicio" class="form-control" value="${
                      data.dataInicio || ""
                    }" readonly>
                </div>
                <div class="form-group">
                    <label for="funcao">Função na EuPsico</label>
                    <input type="text" id="funcao" class="form-control always-readonly" value="${
                      Array.isArray(data.funcoes)
                        ? data.funcoes.join(", ")
                        : "Não informado"
                    }" readonly>
                </div>
            </div>
        `;

    const profissaoSelect = document.getElementById("profissao");
    profissaoSelect.innerHTML = profissoes
      .map(
        (p) =>
          `<option value="${p}" ${
            p === profissaoPadrao ? "selected" : ""
          }>${p}</option>`
      )
      .join("");

    const conselhoSelect = document.getElementById("conselho-profissional");
    conselhoSelect.innerHTML = conselhos
      .map(
        (c) =>
          `<option value="${c}" ${
            c === (data.conselhoProfissional || "Nenhum") ? "selected" : ""
          }>${c}</option>`
      )
      .join("");

    attachDynamicFieldListeners();
  }

  /**
   * Anexa listeners de eventos a campos que têm comportamento dinâmico.
   */
  function attachDynamicFieldListeners() {
    const profissaoSelect = document.getElementById("profissao");
    const outraProfissaoContainer = document.getElementById(
      "outra-profissao-container"
    );

    const toggleOutraProfissao = () => {
      outraProfissaoContainer.style.display =
        profissaoSelect.value === "Outros" ? "flex" : "none";
    };

    toggleOutraProfissao();
    profissaoSelect.addEventListener("change", toggleOutraProfissao);

    document.getElementById("telefone").addEventListener("input", (e) => {
      e.target.value = formatarTelefone(e.target.value);
    });
  }

  /**
   * Anexa os listeners de eventos aos botões de ação (Editar, Salvar, Cancelar).
   */
  function attachActionListeners() {
    const editButton = document.getElementById("btn-editar-perfil");
    const saveButton = document.getElementById("btn-salvar-perfil");
    const cancelButton = document.getElementById("btn-cancelar-edicao");

    if (editButton)
      editButton.addEventListener("click", () => toggleFormState(true));
    if (saveButton) saveButton.addEventListener("click", salvarPerfil);
    if (cancelButton) {
      cancelButton.addEventListener("click", async () => {
        await renderForm(originalData);
        toggleFormState(false);
      });
    }
  }

  // --- FUNÇÕES DE INTERAÇÃO COM O FIREBASE (ATUALIZADAS) ---

  async function carregarPerfil() {
    try {
      container.innerHTML = '<div class="loading-spinner"></div>';
      if (!user || !user.uid) throw new Error("UID do usuário não encontrado.");

      // SINTAXE V9: Cria a referência ao documento
      userDocRef = doc(db, "usuarios", user.uid);

      // SINTAXE V9: Busca os dados do documento
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists())
        throw new Error("Dados do usuário não encontrados no Firestore.");

      originalData = docSnap.data();
      await renderForm(originalData);
      toggleFormState(false);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      container.innerHTML = `<p class="alert alert-error">Não foi possível carregar os dados do seu perfil.</p>`;
    }
  }

  async function salvarPerfil() {
    if (!userDocRef) return;

    const nome = document.getElementById("nome-completo").value;
    const telefone = document
      .getElementById("telefone")
      .value.replace(/\D/g, "");
    const cpf = document.getElementById("cpf").value;

    if (!nome || !telefone) {
      alert("Nome Completo e Telefone são obrigatórios.");
      return;
    }

    if (cpf && !validarCPF(cpf)) {
      alert("O CPF digitado é inválido. Por favor, verifique.");
      return;
    }

    const profissaoSelecionada = document.getElementById("profissao").value;
    const profissaoFinal =
      profissaoSelecionada === "Outros"
        ? document.getElementById("outra-profissao").value.trim()
        : profissaoSelecionada;

    const dadosParaAtualizar = {
      nome,
      contato: telefone, // Campo 'contato' parece ser o correto para telefone
      telefone, // Adiciona 'telefone' também para consistência
      endereco: document.getElementById("endereco").value,
      profissao: profissaoFinal,
      conselhoProfissional: document.getElementById("conselho-profissional")
        .value,
      registroProfissional: document.getElementById("registro-profissional")
        .value,
      cpf,
      rg: document.getElementById("rg").value,
      dataInicio: document.getElementById("data-inicio").value,
      especializacoes: document
        .getElementById("especializacoes")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const saveButton = document.getElementById("btn-salvar-perfil");
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    try {
      // SINTAXE V9: Atualiza o documento
      await updateDoc(userDocRef, dadosParaAtualizar);

      originalData = { ...originalData, ...dadosParaAtualizar }; // Atualiza os dados locais
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar o perfil:", error);
      alert("Ocorreu um erro ao salvar seu perfil. Tente novamente.");
    } finally {
      toggleFormState(false);
    }
  }

  // --- PONTO DE ENTRADA ---
  carregarPerfil();
}
