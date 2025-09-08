(function() {
    if (!db) {
        console.error("Instância do Firestore (db) não encontrada.");
        return;
    }
    const appContent = document.querySelector('#grade-horarios-view #app-content');
    if (!appContent) return;

    let listaProfissionais = [];
    const coresProfissionais = new Map(); // Mapa para armazenar as cores de cada profissional

    let dadosDasGrades = {};
    const horarios = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
    const diasDaSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diasDaSemanaNomes = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const colunasPresencial = ['Leila Tardivo', 'Leonardo Abrahão', 'Karina Okajima Fukumitsu', 'Maria Júlia Kovacs', 'Christian Dunker', 'Maria Célia Malaquias (Grupo)'];
    
    // --- FUNÇÕES PARA GERENCIAR CORES ---

    /**
     * Gera uma cor hexadecimal a partir de uma string (ex: nome do profissional).
     * Garante que a cor seja sempre a mesma para a mesma string.
     * @param {string} str A string de entrada.
     * @returns {string} Uma cor no formato #RRGGBB.
     */
    function generateColorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            // Gera cores mais claras e agradáveis (tons pastel)
            let value = (hash >> (i * 8)) & 0xFF;
            value = 100 + (value % 156); // Garante que o valor do RGB esteja entre 100 e 255
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    /**
     * Verifica se uma cor é escura, para decidir a cor do texto (preto ou branco).
     * @param {string} hexColor A cor em hexadecimal.
     * @returns {boolean} True se a cor for escura.
     */
    function isColorDark(hexColor) {
        if (!hexColor) return false;
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }

    /**
     * Aplica a cor de fundo e do texto a um elemento <select>.
     * @param {HTMLElement} selectElement O elemento <select> a ser estilizado.
     */
    function aplicarCor(selectElement) {
        const nomeProfissional = selectElement.value;
        const cor = coresProfissionais.get(nomeProfissional);
        if (cor) {
            selectElement.style.backgroundColor = cor;
            selectElement.style.color = isColorDark(cor) ? 'white' : 'black';
        } else {
            selectElement.style.backgroundColor = ''; // Reseta para a cor padrão
            selectElement.style.color = '';       // Reseta para a cor padrão
        }
    }
    
    function createDropdownOptions() {
        return '<option value=""></option>' + listaProfissionais.map(prof => `<option value="${prof.username}">${prof.username}</option>`).join('');
    }

    function renderGrade(tipo, dia) {
        if (!appContent) return;
        appContent.innerHTML = '';
        const weekTabsNav = document.createElement('div');
        weekTabsNav.className = 'tab-nav';
        diasDaSemanaNomes.forEach((nomeDia, index) => {
            const diaKey = diasDaSemana[index];
            weekTabsNav.innerHTML += `<button class="${dia === diaKey ? 'active' : ''}" data-day="${diaKey}">${nomeDia}</button>`;
        });
        appContent.appendChild(weekTabsNav);
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        let headers = ['Período', 'Horário'];
        headers = headers.concat(tipo === 'online' ? Array(6).fill('Online') : colunasPresencial);
        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        horarios.forEach((hora, index) => {
            const row = tbody.insertRow();
            if (index < 5) row.className = 'periodo-manha';
            else if (index < 11) row.className = 'periodo-tarde';
            else row.className = 'periodo-noite';
            if (index === 0) row.innerHTML += `<td class="period-cell" rowspan="5">Manhã</td>`;
            if (index === 5) row.innerHTML += `<td class="period-cell" rowspan="6">Tarde</td>`;
            if (index === 11) row.innerHTML += `<td class="period-cell" rowspan="5">Noite</td>`;
            row.innerHTML += `<td class="hour-cell">${hora}</td>`;
            for(let i=0; i < (tipo === 'online' ? 6 : colunasPresencial.length); i++) {
                const cell = row.insertCell();
                const dropdown = document.createElement('select');
                dropdown.innerHTML = createDropdownOptions();
                const horaFormatadaParaBusca = hora.replace(":", "-");
                const fullPath = `${tipo}.${dia}.${horaFormatadaParaBusca}.col${i}`;
                const savedValue = dadosDasGrades[fullPath] || '';
                dropdown.value = savedValue;
                aplicarCor(dropdown);
                cell.appendChild(dropdown);
            }
        });
        table.append(thead, tbody);
        tableWrapper.appendChild(table);
        appContent.appendChild(tableWrapper);
    }

    async function init() {
        try {
            const q = db.collection("usuarios").where("fazAtendimento", "==", true).orderBy("nome");
            const querySnapshot = await q.get();
            
            listaProfissionais = querySnapshot.docs.map(doc => doc.data());

            listaProfissionais.forEach(prof => {
                const color = prof.cor || generateColorFromString(prof.username);
                coresProfissionais.set(prof.username, color);
            });

            const gradesDocRef = db.collection('administrativo').doc('grades');
            gradesDocRef.onSnapshot((doc) => {
                dadosDasGrades = doc.exists ? doc.data() : {};
                const mainTabsContainer = document.querySelector('#grade-horarios-view #main-tabs');
                if (!mainTabsContainer) return;
                const activeMainTabEl = mainTabsContainer.querySelector('button.active');
                const activeDayTabEl = appContent.querySelector('.tab-nav button.active');
                if (activeMainTabEl && activeDayTabEl) {
                    const activeMainTab = activeMainTabEl.dataset.tab;
                    const activeDayTab = activeDayTabEl.dataset.day;
                    renderGrade(activeMainTab, activeDayTab);
                }
            });
            renderGrade('online', 'segunda');
        } catch (error) {
            console.error("Erro ao inicializar:", error);
            appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados.</p>`;
        }
    }

    async function autoSaveChange(selectElement) {
        const row = selectElement.closest('tr');
        const horaCell = row.querySelector('.hour-cell');
        if (!horaCell) return;
        const hora = horaCell.textContent.replace(":", "-");
        const colIndex = selectElement.closest('td').cellIndex - (row.querySelector('.period-cell') ? 2 : 1);
        const newValue = selectElement.value;
        const mainTabsContainer = document.querySelector('#grade-horarios-view #main-tabs');
        if (!mainTabsContainer) return;
        const activeMainTab = mainTabsContainer.querySelector('button.active').dataset.tab;
        const activeDayTab = appContent.querySelector('.tab-nav button.active').dataset.day;
        const fieldPath = `${activeMainTab}.${activeDayTab}.${hora}.col${colIndex}`;
        selectElement.classList.add('is-saving');
        selectElement.classList.remove('is-saved', 'is-error');
        try {
            const gradesDocRef = db.collection('administrativo').doc('grades');
            await gradesDocRef.set({ [fieldPath]: newValue }, { merge: true });
            selectElement.classList.remove('is-saving');
            selectElement.classList.add('is-saved');
            setTimeout(() => selectElement.classList.remove('is-saved'), 1500);
        } catch (err) {
            console.error("Erro ao salvar:", err);
            selectElement.classList.remove('is-saving');
            selectElement.classList.add('is-error');
            setTimeout(() => selectElement.classList.remove('is-error'), 2000);
        }
    }
    
    const mainTabsContainer = document.querySelector('#grade-horarios-view #main-tabs');
    if (mainTabsContainer) {
        mainTabsContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                mainTabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderGrade(e.target.dataset.tab, 'segunda');
            }
        });
    }

    appContent.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.closest('.tab-nav')) {
            if (!mainTabsContainer) return;
            const activeMainTab = mainTabsContainer.querySelector('button.active').dataset.tab;
            if(e.target.dataset.day){
                 appContent.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
                 e.target.classList.add('active');
                 renderGrade(activeMainTab, e.target.dataset.day);
            }
        }
    });
    
    appContent.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            aplicarCor(e.target);
            autoSaveChange(e.target);
        }
    });

    appContent.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName === 'SELECT') {
            e.preventDefault();
            if (e.target.value !== '') {
                e.target.value = '';
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
    
    init();
})();
