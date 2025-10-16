// Importa as funções 'doc' e 'getDoc' do seu arquivo de inicialização do Firebase.
// É importante garantir que seu firebase-init.js exporte essas funções.
import { db, doc, getDoc } from "../../../../assets/js/firebase-init.js";

/**
 * Busca configurações no Firestore e calcula os slots válidos de supervisão
 * usando a sintaxe moderna do Firebase v9.
 * @param {Array} diasHorarios Lista de objetos com dia, inicio e fim.
 * @returns {Promise<Array>} Lista de objetos { date, horario } válidos.
 */
export async function obterSlotsValidos(diasHorarios) {
  // Valores padrão que serão usados caso a busca no banco falhe
  let minimoAgendaSupervisao = 24;
  let quantidadeDiasSupervisao = 15;

  try {
    // --- ATUALIZAÇÃO PARA SINTAXE V9 ---
    // Cria as referências para os documentos de configuração
    const docMinimoRef = doc(
      db,
      "configuracoesSistema",
      "minimoAgendaSupervisao"
    );
    const docDiasRef = doc(
      db,
      "configuracoesSistema",
      "quantidadeDiasSupervisao"
    );

    // Busca os documentos em paralelo para mais eficiência
    const [docMinimoSnap, docDiasSnap] = await Promise.all([
      getDoc(docMinimoRef),
      getDoc(docDiasRef),
    ]);

    if (docMinimoSnap.exists()) {
      const dataMinimo = docMinimoSnap.data();
      if (dataMinimo?.valor !== undefined) {
        minimoAgendaSupervisao = parseInt(dataMinimo.valor, 10);
      }
    }

    if (docDiasSnap.exists()) {
      const dataDias = docDiasSnap.data();
      if (dataDias?.valor !== undefined) {
        quantidadeDiasSupervisao = parseInt(dataDias.valor, 10);
      }
    }
  } catch (e) {
    console.warn(
      "Erro ao buscar configuração de agendamento. Usando valores padrão.",
      e
    );
  }

  const diasDaSemana = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];

  const agora = new Date();
  const slots = [];

  // O restante da lógica para calcular os slots permanece inalterado
  for (let i = 0; i < quantidadeDiasSupervisao; i++) {
    const diaAtual = new Date();
    diaAtual.setDate(agora.getDate() + i);
    // Zera o horário para evitar problemas com fuso
    diaAtual.setHours(0, 0, 0, 0);

    const nomeDiaSemana = diasDaSemana[diaAtual.getDay()];

    diasHorarios.forEach((horario) => {
      if (horario.dia && horario.dia.toLowerCase() === nomeDiaSemana) {
        // Validação para garantir que o formato de hora está correto
        if (
          typeof horario.inicio !== "string" ||
          !horario.inicio.includes(":")
        ) {
          console.warn("Formato de horário de início inválido:", horario);
          return; // Pula este horário se o formato for incorreto
        }

        const [h, m] = horario.inicio.split(":").map(Number);
        const slotDate = new Date(diaAtual);
        slotDate.setHours(h, m, 0, 0);

        const diffMs = slotDate - agora;
        const diffHoras = diffMs / (1000 * 60 * 60);

        if (diffHoras >= minimoAgendaSupervisao) {
          slots.push({ date: slotDate, horario });
        }
      }
    });
  }

  return slots;
}
