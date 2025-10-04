/**
 * Sistema Principal - Coordenação e Funcionalidades Gerais
 * Gerenciamento central de todas as funcionalidades
 */

class WeddingSystem {
    constructor() {
        this.config = {
            nome_sistema: 'Sistema de Agendamento de Casamentos',
            nome_paroquia: 'Paróquia São José',
            dias_antecedencia_minima: 90,
            dias_antecedencia_maxima: 365,
            horario_inicio_agendamento: '08:00',
            horario_fim_agendamento: '20:00',
            duracao_cerimonia_minutos: 60,
            intervalo_entre_cerimonias: 30,
            dias_lembrete_entrevista: 7,
            dias_lembrete_casamento: 3,
            enviar_lembretes_whatsapp: true,
            enviar_lembretes_email: false,
            cor_tema_principal: '#8B4513',
            cor_tema_secundaria: '#D2691E'
        };
        
        this.notifications = [];
        this.reminders = [];
        this.init();
    }
    
    async init() {
        await this.loadConfiguration();
        this.setupTheme();
        this.setupKeyboardShortcuts();
        this.setupAutoSave();
        this.checkReminders();
        this.setupPeriodicTasks();
        this.initializeTooltips();
        this.setupPrintFunctionality();
        this.checkBrowserCompatibility();
    }
    
    async loadConfiguration() {
        try {
            const response = await fetch('api/carregar-configuracoes.php');
            const data = await response.json();
            
            if (data.success && data.config) {
                // Mescla configurações do banco com as padrões
                this.config = { ...this.config, ...data.config };
                
                // Atualiza elementos da interface
                this.updateUIWithConfig();
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }
    
    updateUIWithConfig() {
        // Atualiza título do sistema
        const titleElement = document.getElementById('system-title');
        if (titleElement) {
            titleElement.textContent = this.config.nome_sistema;
        }
        
        // Atualiza título da página
        document.title = `${this.config.nome_sistema} - ${this.config.nome_paroquia}`;
        
        // Atualiza cores do tema
        this.setupTheme();
    }
    
    setupTheme() {
        // Aplica cores personalizadas do tema
        const root = document.documentElement;
        root.style.setProperty('--primary-color', this.config.cor_tema_principal);
        root.style.setProperty('--secondary-color', this.config.cor_tema_secundaria);
        
        // Ajusta cores derivadas
        this.adjustThemeColors();
    }
    
    adjustThemeColors() {
        const primaryColor = this.config.cor_tema_principal;
        
        // Função para clarear/escurecer cores
        const adjustColor = (color, amount) => {
            const num = parseInt(color.replace('#', ''), 16);
            const r = Math.min(255, Math.max(0, (num >> 16) + amount));
            const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
            const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
            return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        };
        
        const root = document.documentElement;
        root.style.setProperty('--primary-dark', adjustColor(primaryColor, -30));
        root.style.setProperty('--primary-light', adjustColor(primaryColor, 30));
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl + S: Salvar formulário ativo
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveActiveForm();
            }
            
            // Ctrl + N: Novo agendamento (abre modal com data de hoje)
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.openNewBooking();
            }
            
            // Ctrl + P: Imprimir calendário
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.printCalendar();
            }
            
            // ESC: Fechar modal ativo
            if (e.key === 'Escape') {
                this.closeActiveModal();
            }
            
            // F1: Ajuda
            if (e.key === 'F1') {
                e.preventDefault();
                this.showHelp();
            }
            
            // Alt + C: Ir para configurações
            if (e.altKey && e.key === 'c') {
                e.preventDefault();
                window.location.href = 'configuracoes.html';
            }
            
            // Alt + H: Ir para hoje no calendário
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                this.goToToday();
            }
        });
    }
    
    setupAutoSave() {
        // Auto-save para formulários
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.saveFormState(form);
                });
            });
        });
        
        // Restaura estado dos formulários ao carregar
        this.restoreFormStates();
    }
    
    saveFormState(form) {
        const formId = form.id;
        if (!formId) return;
        
        const formData = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.id && !input.readOnly && input.type !== 'submit') {
                formData[input.id] = input.value;
            }
        });
        
        localStorage.setItem(`form_${formId}`, JSON.stringify(formData));
        
        // Mostra indicador de auto-save
        this.showAutoSaveIndicator();
    }
    
    restoreFormStates() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const formId = form.id;
            if (!formId) return;
            
            const savedData = localStorage.getItem(`form_${formId}`);
            if (savedData) {
                try {
                    const formData = JSON.parse(savedData);
                    Object.keys(formData).forEach(fieldId => {
                        const field = document.getElementById(fieldId);
                        if (field && !field.readOnly) {
                            field.value = formData[fieldId];
                        }
                    });
                } catch (error) {
                    console.error('Erro ao restaurar dados do formulário:', error);
                }
            }
        });
    }
    
    showAutoSaveIndicator() {
        const existingIndicator = document.querySelector('.autosave-indicator');
        if (existingIndicator) {
            clearTimeout(existingIndicator.timeoutId);
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'autosave-indicator';
        indicator.innerHTML = '<i class="fas fa-save"></i> Salvo automaticamente';
        document.body.appendChild(indicator);
        
        indicator.timeoutId = setTimeout(() => {
            indicator.remove();
        }, 2000);
    }
    
    async checkReminders() {
        try {
            const response = await fetch('api/verificar-lembretes.php');
            const data = await response.json();
            
            if (data.success && data.reminders && data.reminders.length > 0) {
                this.reminders = data.reminders;
                this.showRemindersNotification();
            }
        } catch (error) {
            console.error('Erro ao verificar lembretes:', error);
        }
    }
    
    showRemindersNotification() {
        const reminderCount = this.reminders.length;
        
        if (reminderCount > 0) {
            const notification = document.createElement('div');
            notification.className = 'reminder-notification';
            notification.innerHTML = `
                <div class="reminder-header">
                    <i class="fas fa-bell"></i>
                    <span>Você tem ${reminderCount} lembrete${reminderCount > 1 ? 's' : ''} pendente${reminderCount > 1 ? 's' : ''}</span>
                    <button onclick="weddingSystem.closeReminderNotification(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="reminder-list">
                    ${this.reminders.map(reminder => `
                        <div class="reminder-item">
                            <strong>${reminder.tipo}:</strong> ${reminder.mensagem}
                            <small>${this.formatDateTime(reminder.data_lembrete)}</small>
                        </div>
                    `).join('')}
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Remove após 10 segundos
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 10000);
        }
    }
    
    closeReminderNotification(button) {
        button.closest('.reminder-notification').remove();
    }
    
    setupPeriodicTasks() {
        // Verifica lembretes a cada 5 minutos
        setInterval(() => {
            this.checkReminders();
        }, 5 * 60 * 1000);
        
        // Atualiza o calendário a cada 30 minutos
        setInterval(() => {
            if (window.weddingCalendar) {
                window.weddingCalendar.refresh();
            }
        }, 30 * 60 * 1000);
        
        // Limpa localStorage antigo a cada hora
        setInterval(() => {
            this.cleanupLocalStorage();
        }, 60 * 60 * 1000);
    }
    
    cleanupLocalStorage() {
        const keysToCheck = [];
        for (let i = 0; i < localStorage.length; i++) {
            keysToCheck.push(localStorage.key(i));
        }
        
        keysToCheck.forEach(key => {
            if (key.startsWith('form_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    // Remove dados com mais de 7 dias
                    if (data.timestamp && Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    // Remove dados corrompidos
                    localStorage.removeItem(key);
                }
            }
        });
    }
    
    initializeTooltips() {
        // Adiciona tooltips para elementos com title
        const elementsWithTitle = document.querySelectorAll('[title]');
        elementsWithTitle.forEach(element => {
            const title = element.getAttribute('title');
            element.removeAttribute('title');
            
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, title);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }
    
    showTooltip(element, text) {
        this.hideTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
        
        // Ajusta se sair da tela
        if (tooltip.offsetLeft < 0) {
            tooltip.style.left = '10px';
        }
        if (tooltip.offsetLeft + tooltip.offsetWidth > window.innerWidth) {
            tooltip.style.left = (window.innerWidth - tooltip.offsetWidth - 10) + 'px';
        }
    }
    
    hideTooltip() {
        const tooltip = document.querySelector('.custom-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    setupPrintFunctionality() {
        // Adiciona estilos específicos para impressão
        const printStyles = document.createElement('style');
        printStyles.media = 'print';
        printStyles.textContent = `
            @page {
                size: A4 landscape;
                margin: 1cm;
            }
            
            .calendar-wrapper {
                page-break-inside: avoid;
            }
            
            .calendar-day {
                height: auto !important;
                min-height: 50px !important;
            }
        `;
        document.head.appendChild(printStyles);
    }
    
    printCalendar() {
        window.print();
    }
    
    checkBrowserCompatibility() {
        const issues = [];
        
        // Verifica suporte a features importantes
        if (!window.fetch) {
            issues.push('Seu navegador não suporta Fetch API');
        }
        
        if (!window.localStorage) {
            issues.push('Seu navegador não suporta localStorage');
        }
        
        if (!CSS.supports('display', 'grid')) {
            issues.push('Seu navegador não suporta CSS Grid');
        }
        
        if (issues.length > 0) {
            console.warn('Problemas de compatibilidade detectados:', issues);
            this.showCompatibilityWarning(issues);
        }
    }
    
    showCompatibilityWarning(issues) {
        const warning = document.createElement('div');
        warning.className = 'compatibility-warning';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>Alguns recursos podem não funcionar corretamente:</p>
            <ul>${issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            <button onclick="this.parentElement.remove()">Entendi</button>
        `;
        document.body.insertBefore(warning, document.body.firstChild);
    }
    
    saveActiveForm() {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const form = activeModal.querySelector('form');
            if (form) {
                const submitButton = form.querySelector('[type="submit"]');
                if (submitButton) {
                    submitButton.click();
                }
            }
        }
    }
    
    openNewBooking() {
        if (window.weddingCalendar) {
            window.weddingCalendar.selectDate(new Date());
        }
    }
    
    closeActiveModal() {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
        }
    }
    
    goToToday() {
        if (window.weddingCalendar) {
            const today = new Date();
            window.weddingCalendar.currentMonth = today.getMonth();
            window.weddingCalendar.currentYear = today.getFullYear();
            window.weddingCalendar.renderCalendar();
        }
    }
    
    showHelp() {
        const helpContent = `
            <div class="help-content">
                <h3>Atalhos do Teclado</h3>
                <ul>
                    <li><kbd>Ctrl</kbd> + <kbd>N</kbd> - Novo agendamento</li>
                    <li><kbd>Ctrl</kbd> + <kbd>S</kbd> - Salvar formulário</li>
                    <li><kbd>Ctrl</kbd> + <kbd>P</kbd> - Imprimir calendário</li>
                    <li><kbd>Alt</kbd> + <kbd>C</kbd> - Configurações</li>
                    <li><kbd>Alt</kbd> + <kbd>H</kbd> - Ir para hoje</li>
                    <li><kbd>ESC</kbd> - Fechar janela</li>
                    <li><kbd>F1</kbd> - Ajuda</li>
                </ul>
                
                <h3>Dicas de Uso</h3>
                <ul>
                    <li>Clique em qualquer dia disponível para agendar</li>
                    <li>Duplo clique nos campos de local e celebrante para adicionar novos</li>
                    <li>Os campos são automaticamente convertidos para maiúsculas</li>
                    <li>O sistema salva automaticamente seu progresso</li>
                    <li>Anos anteriores são apenas para consulta</li>
                </ul>
            </div>
        `;
        
        this.showModal('Ajuda do Sistema', helpContent);
    }
    
    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 2rem;">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleString('pt-BR', options);
    }
    
    async exportCalendarData(format = 'pdf') {
        try {
            const response = await fetch(`api/exportar-calendario.php?format=${format}&year=${window.weddingCalendar.currentYear}&month=${window.weddingCalendar.currentMonth + 1}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `calendario_${window.weddingCalendar.currentYear}_${window.weddingCalendar.currentMonth + 1}.${format}`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Erro ao exportar calendário:', error);
            this.showAlert('error', 'Erro', 'Não foi possível exportar o calendário');
        }
    }
    
    showAlert(type, title, message) {
        if (window.formValidator) {
            window.formValidator.showAlert(type, title, message);
        }
    }
}

// Estilos adicionais para o sistema principal
const systemStyles = document.createElement('style');
systemStyles.textContent = `
    .autosave-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideInRight 0.3s ease;
        z-index: 1000;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .reminder-notification {
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border: 2px solid var(--warning-color);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        max-width: 400px;
        z-index: 900;
        animation: slideInRight 0.3s ease;
    }
    
    .reminder-header {
        background: var(--warning-color);
        color: white;
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: var(--border-radius) var(--border-radius) 0 0;
    }
    
    .reminder-header button {
        margin-left: auto;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 1.2rem;
    }
    
    .reminder-list {
        padding: 1rem;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .reminder-item {
        padding: 0.75rem;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 0.5rem;
    }
    
    .reminder-item:last-child {
        border-bottom: none;
        margin-bottom: 0;
    }
    
    .reminder-item small {
        display: block;
        color: var(--text-secondary);
        margin-top: 0.25rem;
    }
    
    .custom-tooltip {
        position: absolute;
        background: var(--text-primary);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        font-size: 0.875rem;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: var(--shadow-md);
        animation: fadeIn 0.2s ease;
    }
    
    .custom-tooltip::after {
        content: '';
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid var(--text-primary);
    }
    
    .compatibility-warning {
        background: var(--warning-color);
        color: white;
        padding: 1rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    
    .compatibility-warning i {
        font-size: 2rem;
    }
    
    .compatibility-warning ul {
        text-align: left;
        max-width: 600px;
        margin: 0.5rem 0;
    }
    
    .compatibility-warning button {
        background: white;
        color: var(--warning-color);
        border: none;
        padding: 0.5rem 1.5rem;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-weight: 600;
    }
    
    .help-content {
        line-height: 1.8;
    }
    
    .help-content h3 {
        color: var(--primary-color);
        margin-top: 1.5rem;
        margin-bottom: 1rem;
    }
    
    .help-content h3:first-child {
        margin-top: 0;
    }
    
    .help-content ul {
        list-style: none;
        padding-left: 0;
    }
    
    .help-content li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--border-color);
    }
    
    .help-content kbd {
        background: #f4f4f4;
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 2px 6px;
        font-family: monospace;
        font-size: 0.9em;
        box-shadow: 0 1px 0 rgba(0,0,0,0.2);
    }
    
    @media print {
        .autosave-indicator,
        .reminder-notification,
        .custom-tooltip,
        .compatibility-warning {
            display: none !important;
        }
    }
`;
document.head.appendChild(systemStyles);

// Inicializa o sistema quando o DOM carregar
let weddingSystem;

document.addEventListener('DOMContentLoaded', () => {
    weddingSystem = new WeddingSystem();
});

// Exporta para uso global
window.WeddingSystem = WeddingSystem;
window.weddingSystem = null;
