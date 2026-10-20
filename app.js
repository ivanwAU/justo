const UI = {
    es: {
        tagline: 'Tus primeras 8 semanas en Australia',
        week: (n) => `Semana ${n} de 8`,
        prev: '← Anterior',
        next: 'Siguiente →',
        reminder: 'Recordatorio',
        footer: '© 2026 Justo. Tu progreso se guarda solo en tu navegador. Información general: no es asesoría legal, migratoria ni tributaria.'
    },
    en: {
        tagline: 'Your first 8 weeks in Australia',
        week: (n) => `Week ${n} of 8`,
        prev: '← Previous',
        next: 'Next →',
        reminder: 'Reminder',
        footer: '© 2026 Justo. Your progress is saved only in your browser. General information: not legal, migration or tax advice.'
    },
    pt: {
        tagline: 'Suas primeiras 8 semanas na Austrália',
        week: (n) => `Semana ${n} de 8`,
        prev: '← Anterior',
        next: 'Próxima →',
        reminder: 'Lembrete',
        footer: '© 2026 Justo. Seu progresso fica salvo apenas no seu navegador. Informação geral: não é assessoria jurídica, migratória ou tributária.'
    }
};

const TOTAL_WEEKS = 8;
let currentWeek = 1;
let currentLanguage = 'es';
let weekData = null;

function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignorar */ }
}

async function loadContent() {
    try {
        const response = await fetch('content/es.json');
        weekData = await response.json();
    } catch (e) {
        document.getElementById('content').innerHTML =
            '<p>No se pudo cargar el contenido. Recarga la página.</p>';
        return;
    }

    const savedLang = storageGet('justoLang');
    if (savedLang && UI[savedLang]) currentLanguage = savedLang;

    const savedWeek = parseInt(storageGet('justoWeek'), 10);
    if (savedWeek >= 1 && savedWeek <= TOTAL_WEEKS) currentWeek = savedWeek;

    setActiveLangButton();
    render();
}

function render() {
    const week = weekData.weeks[currentWeek - 1];
    const lang = currentLanguage;
    const t = UI[lang];

    document.documentElement.lang = lang;
    document.getElementById('tagline').textContent = t.tagline;
    document.getElementById('footerText').textContent = t.footer;
    document.getElementById('prevBtn').textContent = t.prev;
    document.getElementById('nextBtn').textContent = t.next;

    const tasksHtml = week.tasks[lang].map((task, i) => `
        <div class="checklist-item">
            <input type="checkbox" id="task-${currentWeek}-${i}">
            <label for="task-${currentWeek}-${i}">${task}</label>
        </div>
    `).join('');

    document.getElementById('content').innerHTML = `
        <h2>${week.title[lang]}</h2>
        <p>${week.intro[lang]}</p>
        <div class="checklist">${tasksHtml}</div>
        <h3>${t.reminder}</h3>
        <p class="reminder">${week.reminder[lang]}</p>
    `;

    document.querySelectorAll('.checklist-item input').forEach(cb => {
        cb.addEventListener('change', saveProgress);
    });

    restoreProgress();
    updateProgress();
    updateButtons();
    storageSet('justoWeek', String(currentWeek));
}

function updateProgress() {
    const percent = (currentWeek / TOTAL_WEEKS) * 100;
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = UI[currentLanguage].week(currentWeek);
}

function updateButtons() {
    document.getElementById('prevBtn').style.display = currentWeek > 1 ? 'inline-block' : 'none';
    document.getElementById('nextBtn').style.display = currentWeek < TOTAL_WEEKS ? 'inline-block' : 'none';
}

function loadSavedProgress() {
    try {
        return JSON.parse(storageGet('justoProgress')) || {};
    } catch (e) {
        return {};
    }
}

function saveProgress() {
    const progress = loadSavedProgress();
    document.querySelectorAll('.checklist-item input').forEach(cb => {
        progress[cb.id] = cb.checked;
    });
    storageSet('justoProgress', JSON.stringify(progress));
}

function restoreProgress() {
    const progress = loadSavedProgress();
    document.querySelectorAll('.checklist-item input').forEach(cb => {
        cb.checked = !!progress[cb.id];
    });
}

function setActiveLangButton() {
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === currentLanguage);
    });
}

document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentWeek < TOTAL_WEEKS) {
        currentWeek++;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentWeek > 1) {
        currentWeek--;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentLanguage = btn.dataset.lang;
        storageSet('justoLang', currentLanguage);
        setActiveLangButton();
        render();
    });
});

loadContent();
