// Arquivo: /modulos/voluntario/js/detalhes-paciente/estado.js
// Gerencia as variáveis de estado globais para a página de detalhes do paciente.

// --- Variáveis de Estado Exportadas ---
export let pacienteIdGlobal = null;
export let pacienteDataGlobal = null;
export let userDataGlobal = null; // Informações do usuário logado
export let systemConfigsGlobal = null; // Configurações do sistema (textos, listas)
export let salasPresenciaisGlobal = []; // Lista de salas (derivada de systemConfigs)
export let dadosDaGradeGlobal = {}; // Dados da grade geral
export let sessoesCarregadas = []; // Armazena sessões carregadas da subcoleção

// --- Funções Setters para Atualizar o Estado ---

/**
 * Define o ID do paciente globalmente.
 * @param {string} id - O ID do paciente.
 */
export function setPacienteIdGlobal(id) {
  pacienteIdGlobal = id;
}

/**
 * Define os dados do paciente globalmente.
 * @param {object | null} data - O objeto com os dados do paciente ou null.
 */
export function setPacienteDataGlobal(data) {
  pacienteDataGlobal = data;
}

/**
 * Define os dados do usuário logado globalmente.
 * @param {object | null} data - O objeto com os dados do usuário ou null.
 */
export function setUserDataGlobal(data) {
  userDataGlobal = data;
}

/**
 * Define as configurações do sistema e deriva a lista de salas.
 * @param {object | null} config - O objeto de configurações ou null.
 */
export function setSystemConfigsGlobal(config) {
  systemConfigsGlobal = config; // Atualiza a lista de salas sempre que as configs são definidas
  salasPresenciaisGlobal = config?.listas?.salasPresenciais || [];
}

/**
 * Define os dados da grade administrativa globalmente.
 * @param {object} grade - O objeto com os dados da grade.
 */
export function setDadosDaGradeGlobal(grade) {
  dadosDaGradeGlobal = grade;
}

/**
 * Define a lista de sessões carregadas globalmente.
 * @param {Array<object>} sessoes - Array de objetos de sessão.
 */
export function setSessoesCarregadas(sessoes) {
  sessoesCarregadas = sessoes;
}

// Nota: Não é necessário um setter para salasPresenciaisGlobal isoladamente,
// pois ela é derivada diretamente de systemConfigsGlobal.
