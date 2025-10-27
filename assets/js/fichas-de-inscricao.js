// Arquivo: /assets/js/fichas-de-inscricao.js
// Versão: 3.3 (Restaura a lógica de criação de CPF temporário para menores)

import {
  db,
  functions,
  addDoc,
  updateDoc,
  doc,
  collection,
  serverTimestamp,
} from "./firebase-init.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";

// --- Ponto de Entrada ---
document.addEventListener("DOMContentLoaded", init);

let pacienteExistenteData = null;
const verificarCpfExistente = httpsCallable(functions, "verificarCpfExistente");

/**
 * Função principal que inicializa a página.
 */
function init() {
  document.getElementById("form-content").style.display = "block";
  inicializarEventListeners();
}

/**
 * Configura todos os event listeners do formulário.
 */
function inicializarEventListeners() {
  const form = document.getElementById("inscricao-form");
  const cpfInput = document.getElementById("cpf");
  const dataNascimentoInput = document.getElementById("data-nascimento");
  const cepInput = document.getElementById("cep");
  const btnAlterarEndereco = document.getElementById("btn-alterar-endereco");
  const parentescoSelect = document.getElementById("responsavel-parentesco");
  const responsavelCpfInput = document.getElementById("responsavel-cpf");

  form.addEventListener("submit", handleFormSubmit);
  cpfInput.addEventListener("blur", handleCpfBlur);
  dataNascimentoInput.addEventListener("change", handleDataNascimentoChange);
  cepInput.addEventListener("blur", handleCepBlur);
  btnAlterarEndereco.addEventListener("click", handleAlterarEndereco);
  parentescoSelect.addEventListener("change", handleParentescoChange);
  responsavelCpfInput.addEventListener("blur", () =>
    handleResponsavelCpfBlur(cpfInput, responsavelCpfInput)
  );

  // Listeners de formatação
  document
    .querySelectorAll(
      "#update-valor-aluguel, #update-renda-mensal, #update-renda-familiar, #valor-aluguel, #renda-mensal, #renda-familiar"
    )
    .forEach((input) =>
      input.addEventListener("input", () => formatarMoeda(input))
    );
  document
    .querySelectorAll("#telefone-celular, #telefone-fixo, #responsavel-contato")
    .forEach((input) =>
      input.addEventListener("input", () => formatarTelefone(input))
    );

  document.querySelectorAll('input[name="horario"]').forEach((checkbox) => {
    checkbox.addEventListener("change", handleHorarioChange);
  });
}

// --- Funções Handler de Eventos ---

async function handleCpfBlur(event) {
  const cpfInput = event.target;
  const cpf = cpfInput.value.replace(/\D/g, "");
  const cpfError = document.getElementById("cpf-error");

  resetFormState();
  cpfError.style.display = "none";

  if (!validarCPF(cpf)) {
    if (cpf.length > 0) cpfError.style.display = "block";
    return;
  }

  try {
    const result = await verificarCpfExistente({ cpf });
    if (result.data && result.data.exists) {
      pacienteExistenteData = { ...result.data.dados, id: result.data.docId };
      mostrarSecaoAtualizacao(pacienteExistenteData);
    } else {
      pacienteExistenteData = null;
    }
  } catch (error) {
    console.error("Erro ao verificar CPF:", error);
    alert("Não foi possível verificar o CPF. Tente novamente.");
  }
}

function handleDataNascimentoChange() {
  if (pacienteExistenteData) return;

  const dataNascimentoInput = document.getElementById("data-nascimento");
  if (!dataNascimentoInput.value) return;

  document.getElementById("form-body").classList.remove("hidden-section");
  document
    .getElementById("new-register-section")
    .classList.remove("hidden-section");
  document
    .getElementById("full-form-fields")
    .classList.remove("hidden-section");

  const idade = calcularIdade(dataNascimentoInput.value);
  const responsavelSection = document.getElementById(
    "responsavel-legal-section"
  );
  const isMenor = idade < 18;

  responsavelSection.classList.toggle("hidden-section", !isMenor);
  setRequired(responsavelSection, isMenor);
}

async function handleCepBlur(event) {
  const cep = event.target.value.replace(/\D/g, "");
  if (cep.length !== 8) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (!data.erro) {
      document.getElementById("rua").value = data.logradouro;
      document.getElementById("bairro").value = data.bairro;
      document.getElementById("cidade").value = data.localidade;
      document.getElementById("numero-casa").focus();
    }
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
  }
}

function handleAlterarEndereco() {
  [
    "update-rua",
    "update-numero",
    "update-bairro",
    "update-cidade",
    "update-cep",
  ].forEach((id) => (document.getElementById(id).disabled = false));
  alert("Os campos de endereço foram desbloqueados para alteração.");
}

function handleParentescoChange(event) {
  const outroParentescoInput = document.getElementById(
    "responsavel-parentesco-outro"
  );
  const isOutro = event.target.value === "Outro";
  document
    .getElementById("outro-parentesco-container")
    .classList.toggle("hidden-section", !isOutro);
  outroParentescoInput.required = isOutro;
}

// ####################################################################
// ## FUNÇÃO CORRIGIDA ##
// ####################################################################
function handleResponsavelCpfBlur(cpfInput, responsavelCpfInput) {
  // A condição só é válida se ambos os campos estiverem preenchidos e forem iguais
  if (
    responsavelCpfInput.value &&
    responsavelCpfInput.value === cpfInput.value
  ) {
    alert(
      "Atenção: O CPF do responsável é o mesmo do paciente. Será gerado um código temporário para o paciente."
    );
    const tempId = `99${Date.now()}`;
    cpfInput.value = tempId;
    cpfInput.readOnly = true;
    alert(
      `O CPF do paciente foi substituído por um código de identificação: ${tempId}. Guarde este código para futuras consultas.`
    );
  }
}
// ####################################################################

function handleHorarioChange(e) {
  const periodo = e.target.value;
  const container = document.getElementById(`container-${periodo}`);
  if (e.target.checked) {
    gerarHorarios(periodo, container);
    container.classList.remove("hidden-section");
  } else {
    container.innerHTML = "";
    container.classList.add("hidden-section");
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = document.getElementById("inscricao-form");
  const cpfInput = document.getElementById("cpf");
  const cpf = cpfInput.value.replace(/\D/g, "");
  const cpfError = document.getElementById("cpf-error"); // 1. Garante que a mensagem de erro do CPF seja limpa inicialmente

  cpfError.style.display = "none"; // 2. Verifica a validade do CPF, que é um requisito crítico

  if (!validarCPF(cpf)) {
    cpfInput.setCustomValidity("CPF inválido ou incompleto.");
    cpfError.style.display = "block"; // Mostra a mensagem de erro
    form.reportValidity(); // Força a exibição da dica de erro do navegador
    alert(
      "Atenção: O CPF informado é inválido. Por favor, corrija para prosseguir."
    );
    cpfInput.setCustomValidity(""); // Limpa a validade para permitir correções futuras
    return;
  } // 3. Verifica a validade de TODOS os outros campos obrigatórios

  if (!form.checkValidity()) {
    form.reportValidity(); // Força o navegador a mostrar a dica de erro no primeiro campo faltante // --- ALTERAÇÃO AQUI: Mensagem clara para campos faltantes ---
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para enviar a inscrição."
    ); // ------------------------------------------------------------
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  try {
    if (pacienteExistenteData) {
      const dadosParaAtualizar = {
        rua: document.getElementById("update-rua").value,
        numeroCasa: document.getElementById("update-numero").value,
        bairro: document.getElementById("update-bairro").value,
        cidade: document.getElementById("update-cidade").value,
        cep: document.getElementById("update-cep").value,
        pessoasMoradia: document.getElementById("update-pessoas-moradia").value,
        casaPropria: document.getElementById("update-casa-propria").value,
        valorAluguel: document.getElementById("update-valor-aluguel").value,
        rendaMensal: document.getElementById("update-renda-mensal").value,
        rendaFamiliar: document.getElementById("update-renda-familiar").value,
        lastUpdated: serverTimestamp(),
        status: "inscricao_documentos",
      };

      const docRef = doc(db, "trilhaPaciente", pacienteExistenteData.id);
      await updateDoc(docRef, dadosParaAtualizar);
    } else {
      const novoCadastro = coletarDadosFormularioNovo();
      novoCadastro.timestamp = serverTimestamp();
      novoCadastro.status = "inscricao_documentos";

      await addDoc(collection(db, "trilhaPaciente"), novoCadastro);
    }

    form.innerHTML = `<div style="text-align: center; padding: 30px;"><h2>Inscrição Enviada com Sucesso!</h2><p>Recebemos seus dados. Em breve, nossa equipe entrará em contato.</p></div>`;
  } catch (error) {
    console.error("Erro ao salvar inscrição:", error);
    alert("Ocorreu um erro ao enviar sua inscrição. Tente novamente.");
    submitButton.disabled = false;
    submitButton.textContent = "Enviar Inscrição";
  }
}
// --- Funções Auxiliares (sem alterações) ---

function mostrarSecaoAtualizacao(dados) {
  document.getElementById("initial-fields").classList.add("hidden-section");
  document.getElementById("form-body").classList.remove("hidden-section");
  document.getElementById("update-section").classList.remove("hidden-section");
  document
    .getElementById("new-register-section")
    .classList.add("hidden-section");

  document.getElementById("update-nome-completo").value =
    dados.nomeCompleto || "";
  document.getElementById("update-rua").value = dados.rua || "";
  document.getElementById("update-numero").value = dados.numeroCasa || "";
  document.getElementById("update-bairro").value = dados.bairro || "";
  document.getElementById("update-cidade").value = dados.cidade || "";
  document.getElementById("update-cep").value = dados.cep || "";
}

function coletarDadosFormularioNovo() {
  const form = document.getElementById("inscricao-form");
  const formData = new FormData(form);
  const dados = {};
  for (let [key, value] of formData.entries()) {
    dados[key] = value;
  }

  dados.responsavel = {
    nome: dados.responsavelNome,
    cpf: dados.responsavelCpf,
    parentesco:
      dados.responsavelParentesco === "Outro"
        ? dados.responsavelParentescoOutro
        : dados.responsavelParentesco,
    contato: dados.responsavelContato,
  };
  delete dados.responsavelNome;
  delete dados.responsavelCpf;
  delete dados.responsavelParentesco;
  delete dados.responsavelParentescoOutro;
  delete dados.responsavelContato;

  dados.disponibilidadeGeral = Array.from(
    document.querySelectorAll('input[name="horario"]:checked')
  ).map((cb) => cb.parentElement.textContent.trim());
  dados.disponibilidadeEspecifica = Array.from(
    document.querySelectorAll('input[name="horario-especifico"]:checked')
  ).map((cb) => cb.value);
  delete dados["horario-especifico"];

  return dados;
}

function resetFormState() {
  pacienteExistenteData = null;
  document.getElementById("form-body").classList.add("hidden-section");
  document.getElementById("update-section").classList.add("hidden-section");
  document
    .getElementById("new-register-section")
    .classList.add("hidden-section");
}

function setRequired(section, isRequired) {
  section.querySelectorAll("input, select").forEach((input) => {
    if (input.id !== "responsavel-parentesco-outro") {
      input.required = isRequired;
    }
  });
}

function gerarHorarios(periodo, container) {
  let horarios = [],
    label = "";
  switch (periodo) {
    case "manha-semana":
      label = "Manhã (Seg-Sex):";
      for (let i = 8; i < 12; i++) horarios.push(`${i}:00`);
      break;
    case "tarde-semana":
      label = "Tarde (Seg-Sex):";
      for (let i = 12; i < 18; i++) horarios.push(`${i}:00`);
      break;
    case "noite-semana":
      label = "Noite (Seg-Sex):";
      for (let i = 18; i < 21; i++) horarios.push(`${i}:00`);
      break;
    case "manha-sabado":
      label = "Manhã (Sábado):";
      for (let i = 8; i < 13; i++) horarios.push(`${i}:00`);
      break;
  }
  let html = `<label>${label}</label><div class="horario-detalhe-grid">`;
  horarios.forEach((hora) => {
    html += `<div><label><input type="checkbox" name="horario-especifico" value="${periodo}_${hora}"> ${hora}</label></div>`;
  });
  container.innerHTML = html + `</div>`;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.startsWith("99")) return true; // Permite o CPF temporário
  if (cpf === "" || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
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

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return 99;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() <= nasc.getDate())) {
    idade--;
  }
  return idade;
}

function formatarMoeda(input) {
  let value = input.value.replace(/\D/g, "");
  if (value === "") {
    input.value = "";
    return;
  }
  value = (parseInt(value) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  input.value = value;
}

function formatarTelefone(input) {
  let value = input.value.replace(/\D/g, "").substring(0, 11);
  if (value.length > 10) {
    value = value.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (value.length > 5) {
    value = value.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
  } else {
    value = value.replace(/^(\d*)/, "($1");
  }
  input.value = value;
}
