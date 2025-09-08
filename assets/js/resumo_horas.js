// assets/js/resumo_horas.js (Versão 2 - Com Filtros)
(function() {
    if (!db) {
        console.error("Instância do Firestore (db) não encontrada.");
        return;
    }

    const appContent = document.getElementById('resumo-horas-content');

    async function init() {
        if (!appContent) return;
        appContent.innerHTML = '<div class="loading-spinner"></div>';

        try {
            // ALTERAÇÃO 1: A busca agora filtra por 'fazAtendimento'.
            // Isso requer o índice composto (fazAtendimento, nome) que já criamos.
            const usuariosQuery = db.collection('usuarios')
                .where("fazAtendimento", "==", true)
                .orderBy('nome');

            const [usuariosSnapshot, gradesSnapshot, configSnapshot] = await Promise.all([
                usuariosQuery.get(),
                db.collection('administrativo').doc('grades').get(),
                db.collection('financeiro').doc('configuracoes').get()
            ]);

            const usuarios = usuariosSnapshot.docs.map(doc => doc.data());
            const gradesData = gradesSnapshot.exists ? gradesSnapshot.data() : {};
            const configData = configSnapshot.exists ? configSnapshot.data() : {};
            const valores = configData.valores || { online: 0, presencial: 0 };

            let resumoCalculado = [];
            
            usuarios.forEach(prof => {
                // ALTERAÇÃO 2: Adicionado filtro para pular profissionais na 'primeiraFase'.
                if (!prof.username || prof.inativo || prof.primeiraFase === true) {
                    return;
                }
                
                let horasOnline = 0;
                let horasPresencial = 0;

                for (const key in gradesData) {
                    const profissionalNaGrade = gradesData[key];
                    if (profissionalNaGrade === prof.username) {
                        if (key.startsWith('online.')) {
                            horasOnline++;
                        } else if (key.startsWith('presencial.')) {
                            horasPresencial++;
                        }
                    }
                }
                
                const dividaOnline = horasOnline * (valores.online || 0);
                const dividaPresencial = horasPresencial * (valores.presencial || 0);

                resumoCalculado.push({
                    nome: prof.nome,
                    totalDivida: dividaOnline + dividaPresencial,
                    horasOnline,
                    horasPresencial,
                    dividaOnline,
                    dividaPresencial,
                    totalHoras: horasOnline + horasPresencial
                });
            });

            let tableHtml = `
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Profissional</th>
                                <th>Horas Presencial</th>
                                <th>Horas Online</th>
                                <th>Total Horas</th>
                                <th>Dívida Presencial (R$)</th>
                                <th>Dívida Online (R$)</th>
                                <th>Total Dívida (R$)</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            resumoCalculado.forEach(resumo => {
                tableHtml += `
                    <tr>
                        <td>${resumo.nome}</td>
                        <td>${resumo.horasPresencial}</td>
                        <td>${resumo.horasOnline}</td>
                        <td><strong>${resumo.totalHoras}</strong></td>
                        <td>R$ ${resumo.dividaPresencial.toFixed(2).replace('.', ',')}</td>
                        <td>R$ ${resumo.dividaOnline.toFixed(2).replace('.', ',')}</td>
                        <td><strong>R$ ${resumo.totalDivida.toFixed(2).replace('.', ',')}</strong></td>
                    </tr>`;
            });

            appContent.innerHTML = tableHtml + `</tbody></table></div>`;

        } catch (error) {
            console.error("Erro ao carregar dados para o resumo de horas:", error);
            appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados do Firestore. Verifique o console para mais detalhes.</p>`;
        }
    }

    init();
})();
