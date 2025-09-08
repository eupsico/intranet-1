// assets/js/relatorios.js
(function() {
    if (!db) { return; }

    const appContent = document.getElementById('relatorios-content');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    let DB = { profissionais: [], cobranca: {}, repasses: {}, grades: {} };

    const sanitizeKey = (key) => !key ? '' : key.replace(/\.|\$|\[|\]|#|\//g, '_');
    const downloadFile = (content, fileName, mimeType) => {
        const blob = new Blob(["\uFEFF" + content], { type: mimeType });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    async function fetchData() {
        try {
            const [usuariosSnap, configSnap] = await Promise.all([
                db.collection('usuarios').get(),
                db.collection('financeiro').doc('configuracoes').get()
            ]);

            DB.profissionais = usuariosSnap.docs.map(doc => doc.data());
            const configData = configSnap.exists ? configSnap.data() : {};
            DB.cobranca = configData.cobranca || {};
            DB.repasses = configData.repasses || {};
            DB.grades = configData.grades || {};
            
            renderPage();
        } catch (error) {
            appContent.innerHTML = `<p style="color:red;">Erro ao carregar dados: ${error.message}</p>`;
            console.error(error);
        }
    }
    
    function renderPage() {
        const currentYear = new Date().getFullYear();
        let years = [];
        for (let i = currentYear - 2; i <= currentYear + 5; i++) { years.push(i); }
        const profissionaisAtivos = DB.profissionais.filter(p => p.nome && !p.primeiraFase).sort((a, b) => a.nome.localeCompare(b.nome));

        appContent.innerHTML = `
            <div class="report-section">
                <h2>Relatório de Inadimplentes</h2>
                <p>Gere uma lista de todos os profissionais com pagamentos pendentes ou filtre por um profissional específico.</p>
                <div class="selector-container">
                    <label for="debtor-professional-selector">Selecionar Profissional:</label>
                    <select id="debtor-professional-selector">
                        <option value="todos">Todos os Profissionais</option>
                        ${profissionaisAtivos.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('')}
                    </select>
                </div>
                <button id="btn-debtors-csv" class="action-button btn-excel">Gerar Excel (CSV)</button>
                <button id="btn-debtors-pdf" class="action-button btn-pdf">Gerar PDF</button>
            </div>
            <div class="report-section">
                <h2>Relatório de Horas Trabalhadas</h2>
                <p>Gere um relatório com a quantidade de horas por profissional para um período específico, com base na grade de horários.</p>
                <div class="period-selector">
                    <label>Selecionar Período:</label>
                    <select id="hours-mes-selector">${meses.map((m, i) => `<option value="${i}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}</select>
                    <select id="hours-ano-selector">${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
                </div>
                <button id="btn-hours-csv" class="action-button btn-excel">Gerar Excel (CSV)</button>
                <button id="btn-hours-pdf" class="action-button btn-pdf">Gerar PDF</button>
            </div>
            <div class="report-section">
                <h2>Backup Mensal</h2>
                <p>Gere um relatório em PDF com o resumo financeiro (cobranças e pagamentos) de um período específico.</p>
                <div class="period-selector">
                    <label>Selecionar Período:</label>
                    <select id="backup-mes-selector">${meses.map((m, i) => `<option value="${i}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}</select>
                    <select id="backup-ano-selector">${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
                </div>
                <button id="btn-backup-pdf" class="action-button btn-backup">Gerar Backup em PDF</button>
            </div>
        `;
        
        document.getElementById('btn-debtors-csv').addEventListener('click', () => generateDebtorsReport('csv'));
        document.getElementById('btn-debtors-pdf').addEventListener('click', () => generateDebtorsReport('pdf'));
        document.getElementById('btn-hours-csv').addEventListener('click', () => generateHoursReport('csv'));
        document.getElementById('btn-hours-pdf').addEventListener('click', () => generateHoursReport('pdf'));
        document.getElementById('btn-backup-pdf').addEventListener('click', generateMonthlyBackup);
    }

    function getDebtorsData(selectedProfessionalName = 'todos') {
        const debtors = [];
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonthIndex = today.getMonth();
        let profissionaisAChecar = (selectedProfessionalName === 'todos')
            ? DB.profissionais.filter(p => p.nome && !p.primeiraFase)
            : DB.profissionais.filter(p => p.nome === selectedProfessionalName);

        profissionaisAChecar.forEach(prof => {
            let totalDebt = 0;
            let pendingMonths = [];
            for (const year in DB.cobranca) {
                if (parseInt(year) > currentYear) continue;
                const profKey = sanitizeKey(prof.nome);
                if (DB.cobranca[year] && DB.cobranca[year][profKey]) {
                    for (const month in DB.cobranca[year][profKey]) {
                        const monthIndex = meses.indexOf(month);
                        if (parseInt(year) === currentYear && monthIndex > currentMonthIndex) continue;
                        const cobranca = DB.cobranca[year][profKey][month] || 0;
                        const repasse = DB.repasses[year]?.[month]?.[profKey];
                        if (cobranca > 0 && !repasse) {
                            totalDebt += cobranca;
                            pendingMonths.push(`${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`);
                        }
                    }
                }
            }
            if (totalDebt > 0) {
                debtors.push({ nome: prof.nome, contato: prof.contato || 'N/A', valor: totalDebt, meses: pendingMonths.join(', ') });
            }
        });
        return debtors.sort((a,b) => b.valor - a.valor);
    }
    
    function generateDebtorsReport(format) {
        const selectedProf = document.getElementById('debtor-professional-selector').value;
        const data = getDebtorsData(selectedProf);
        if (data.length === 0) {
            window.showToast('Nenhum inadimplente encontrado.', 'info');
            return;
        }
        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        let fileNameBase = selectedProf === 'todos' ? 'relatorio_inadimplentes' : `inadimplencia_${selectedProf.replace(/\s/g, '_')}`;

        if (format === 'csv') {
            let csvContent = "Profissional;Contato;Valor Devido (R$);Meses Pendentes\n";
            data.forEach(d => { csvContent += `"${d.nome}";"${d.contato}";"${d.valor.toFixed(2).replace('.', ',')}";"${d.meses}"\n`; });
            downloadFile(csvContent, `${fileNameBase}_${dateStr}.csv`, 'text/csv;charset=utf-8;');
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(selectedProf === 'todos' ? "Relatório de Inadimplentes" : `Inadimplência: ${selectedProf}`, 14, 22);
            const head = [['Profissional', 'Contato', 'Valor Devido (R$)', 'Meses Pendentes']];
            const body = data.map(d => [d.nome, d.contato, d.valor.toFixed(2), d.meses]);
            doc.autoTable({ head, body, startY: 35 });
            doc.save(`${fileNameBase}_${dateStr}.pdf`);
        }
    }

    function generateHoursReport(format) {
        const profissionaisAtivos = DB.profissionais.filter(p => p.nome && !p.primeiraFase);
        let hoursData = [];
        profissionaisAtivos.forEach(prof => {
            let horasOnline = 0, horasPresencial = 0;
            if (DB.grades.online) { Object.values(DB.grades.online).forEach(dia => Object.values(dia).forEach(hora => Object.values(hora).forEach(nome => { if (nome === prof.nome) horasOnline++; }))); }
            if (DB.grades.presencial) { Object.values(DB.grades.presencial).forEach(dia => Object.values(dia).forEach(hora => Object.values(hora).forEach(nome => { if (nome === prof.nome) horasPresencial++; }))); }
            if (horasOnline > 0 || horasPresencial > 0) {
                hoursData.push({ nome: prof.nome, online: horasOnline, presencial: horasPresencial, total: horasOnline + horasPresencial });
            }
        });

        if (hoursData.length === 0) {
            window.showToast('Nenhum profissional com horas na grade atual.', 'info');
            return;
        }
        hoursData.sort((a, b) => b.total - a.total);
        
        const mes = meses[document.getElementById('hours-mes-selector').value];
        const ano = document.getElementById('hours-ano-selector').value;
        const fileNameBase = `relatorio_horas_${mes}_${ano}`;

        if (format === 'csv') {
            let csvContent = "Profissional;Horas Online;Horas Presencial;Total de Horas\n";
            hoursData.forEach(d => { csvContent += `"${d.nome}";${d.online};${d.presencial};${d.total}\n`; });
            downloadFile(csvContent, `${fileNameBase}.csv`, 'text/csv;charset=utf-8;');
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Relatório de Horas - ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}`, 14, 22);
            const head = [['Profissional', 'Horas Online', 'Horas Presencial', 'Total']];
            const body = hoursData.map(d => [d.nome, d.online, d.presencial, d.total]);
            doc.autoTable({ head, body, startY: 35 });
            doc.save(`${fileNameBase}.pdf`);
        }
    }

    function generateMonthlyBackup() {
        const mesIndex = document.getElementById('backup-mes-selector').value;
        const ano = document.getElementById('backup-ano-selector').value;
        const mes = meses[mesIndex];
        const profissionaisAtivos = DB.profissionais.filter(p => p.nome && !p.primeiraFase);
        let backupData = [];
        let totalCobrado = 0, totalRecebido = 0;

        profissionaisAtivos.forEach(prof => {
            const profKey = sanitizeKey(prof.nome);
            const valorCobrado = DB.cobranca[ano]?.[profKey]?.[mes] || 0;
            if(valorCobrado > 0) {
                const dataPagamento = DB.repasses[ano]?.[mes]?.[profKey] || 'Pendente';
                let status = (dataPagamento !== 'Pendente') ? 'Pago' : 'Pendente';
                if (status === 'Pago') totalRecebido += valorCobrado;
                backupData.push({ nome: prof.nome, valor: valorCobrado, status: status, dataPg: dataPagamento === 'Pendente' ? '---' : formatDate(dataPagamento) });
                totalCobrado += valorCobrado;
            }
        });

        if (backupData.length === 0) {
            window.showToast(`Nenhum dado para o backup de ${mes}/${ano}.`, 'info');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Backup Financeiro - ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}`, 14, 22);
        const head = [['Profissional', 'Valor Cobrado (R$)', 'Status', 'Data Pag.']];
        const body = backupData.map(d => [d.nome, d.valor.toFixed(2), d.status, d.dataPg]);
        doc.autoTable({ head, body, startY: 35 });
        const finalY = doc.autoTable.previous.finalY;
        doc.autoTable({
            startY: finalY + 10, theme: 'plain',
            body: [
                ['Total Cobrado:', formatCurrency(totalCobrado)],
                ['Total Recebido:', formatCurrency(totalRecebido)],
                ['Balanço (Pendente):', formatCurrency(totalCobrado - totalRecebido)]
            ]
        });
        doc.save(`backup_${mes}_${ano}.pdf`);
    }

    fetchData();
})();
