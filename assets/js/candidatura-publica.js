// candidatura-publica.js
import { firebaseInit } from './firebase-init.js';

const form = document.getElementById('form-candidatura');
const selectVaga = document.getElementById('select-vaga');
const vagaGroup = document.getElementById('vaga-select-group');
const loadingVagas = document.getElementById('loading-vagas');
const mensagemFeedback = document.getElementById('mensagem-feedback');
const inputCEP = document.getElementById('cep-candidato');
const inputRua = document.getElementById('endereco-rua');
const inputCidade = document.getElementById('cidade-endereco');
const inputEstado = document.getElementById('estado-endereco');

// URL do Apps Script que retorna vagas
const VAGAS_URL = 'https://script.google.com/macros/s/SEU_SCRIPT_ID/exec?action=vagas';
const ENVIO_URL = 'https://script.google.com/macros/s/SEU_SCRIPT_ID/exec?action=enviar';

// Função para buscar vagas ativas
async function carregarVagas() {
  try {
    const res = await fetch(VAGAS_URL);
    const vagas = await res.json();

    if (vagas.length) {
      selectVaga.innerHTML = '<option value="">Selecione a vaga...</option>';
      vagas.forEach(v => {
        const option = document.createElement('option');
        option.value = v.id;
        option.textContent = v.titulo;
        selectVaga.appendChild(option);
      });
      vagaGroup.style.display = 'block';
    } else {
      selectVaga.innerHTML = '<option value="">Nenhuma vaga disponível</option>';
    }
  } catch (err) {
    console.error('Erro ao carregar vagas:', err);
    selectVaga.innerHTML = '<option value="">Erro ao carregar vagas</option>';
  } finally {
    loadingVagas.style.display = 'none';
  }
}

// Função para preencher endereço pelo CEP
async function buscarEndereco(cep) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
    const data = await res.json();
    if (!data.erro) {
      inputRua.value = data.logradouro;
      inputCidade.value = data.localidade;
      inputEstado.value = data.uf;
    }
  } catch (err) {
    console.error('Erro ao buscar CEP:', err);
  }
}

// Evento ao digitar o CEP
inputCEP.addEventListener('blur', () => {
  const cep = inputCEP.value;
  if (cep.length >= 8) buscarEndereco(cep);
});

// Envio do formulário
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  mensagemFeedback.innerHTML = 'Enviando...';

  try {
    const res = await fetch(ENVIO_URL, {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.status === 'success') {
      mensagemFeedback.innerHTML = `<div class="mensagem-sucesso">Candidatura enviada com sucesso!</div>`;
      form.reset();
    } else {
      mensagemFeedback.innerHTML = `<div class="mensagem-erro">${result.message || 'Erro ao enviar candidatura.'}</div>`;
    }
  } catch (err) {
    mensagemFeedback.innerHTML = `<div class="mensagem-erro">Erro ao enviar candidatura.</div>`;
    console.error(err);
  }
});

// Inicialização
carregarVagas();
