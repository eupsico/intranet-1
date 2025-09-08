(function() {
    if (!window.firebase || !firebase.apps.length) {
        console.error("Firebase não inicializado.");
        return;
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    const listaContainer = document.getElementById('lista-agendamentos-container');

    if (!listaContainer) {
        console.error("Container da lista de agendamentos não encontrado.");
        return;
    }

    // Função principal para carregar e exibir os agendamentos
    async function carregarAgendamentos() {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            listaContainer.innerHTML = '<p style="color: red;">Você precisa estar logado para ver seus agendamentos.</p>';
            return;
        }

        listaContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            // Query para buscar agendamentos do supervisor logado, ordenados por data
            const querySnapshot = await db.collection('agendamentos')
                .where('supervisorUid', '==', currentUser.uid)
                .orderBy('dataAgendamento', 'desc')
                .get();

            if (querySnapshot.empty) {
                listaContainer.innerHTML = '<p>Nenhum agendamento encontrado para você.</p>';
                return;
            }

            listaContainer.innerHTML = ''; // Limpa o spinner

            querySnapshot.forEach(doc => {
                const agendamento = doc.data();

                // Formata a data para um formato legível
                const dataFormatada = new Date(agendamento.dataAgendamento).toLocaleString('pt-BR', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                });

                const agendamentoElement = document.createElement('div');
                agendamentoElement.className = 'agendamento-item'; // Classe para estilização futura
                agendamentoElement.style.cssText = "border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;";

                agendamentoElement.innerHTML = `
                    <div>
                        <strong>Profissional:</strong><br>
                        ${agendamento.profissionalNome || 'Não informado'}
                    </div>
                    <div>
                        <strong>Email:</strong><br>
                        ${agendamento.profissionalEmail || 'Não informado'}
                    </div>
                    <div>
                        <strong>Telefone:</strong><br>
                        ${agendamento.profissionalTelefone || 'Não informado'}
                    </div>
                    <div>
                        <strong>Data da Supervisão:</strong><br>
                        ${dataFormatada}
                    </div>
                `;

                listaContainer.appendChild(agendamentoElement);
            });

        } catch (error) {
            console.error("Erro ao buscar agendamentos:", error);
            listaContainer.innerHTML = '<p style="color: red;">Ocorreu um erro ao carregar seus agendamentos.</p>';
        }
    }

    carregarAgendamentos();
})();