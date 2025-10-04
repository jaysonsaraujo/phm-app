/**
 * Sistema de Calendário para Agendamento de Casamentos
 * Gerenciamento completo do calendário e suas funcionalidades
 */

class WeddingCalendar {
    constructor() {
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.selectedDate = null;
        this.appointments = [];
        this.isReadOnly = false;
        
        this.monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        this.dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.populateYearSelector();
        this.renderCalendar();
        this.loadAppointments();
    }
    
    setupEventListeners() {
        const prevMonth = document.getElementById('prevMonth');
        const nextMonth = document.getElementById('nextMonth');
        const prevYear = document.getElementById('prevYear');
        const nextYear = document.getElementById('nextYear');
        const yearSelect = document.getElementById('yearSelect');
        
        if (prevMonth) {
            prevMonth.addEventListener('click', () => this.previousMonth());
        }
        if (nextMonth) {
            nextMonth.addEventListener('click', () => this.nextMonth());
        }
        if (prevYear) {
            prevYear.addEventListener('click', () => this.previousYear());
        }
        if (nextYear) {
            nextYear.addEventListener('click', () => this.nextYear());
        }
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => this.changeYear(e.target.value));
        }
    }
    
    populateYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        if (!yearSelect) return;
        
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 2;
        const endYear = currentYear + 3;
        
        yearSelect.innerHTML = '';
        
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === this.currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }
    
    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
            this.updateYearSelector();
        }
        this.renderCalendar();
        this.loadAppointments();
    }
    
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
            this.updateYearSelector();
        }
        this.renderCalendar();
        this.loadAppointments();
    }
    
    previousYear() {
        this.currentYear--;
        this.updateYearSelector();
        this.renderCalendar();
        this.loadAppointments();
    }
    
    nextYear() {
        this.currentYear++;
        this.updateYearSelector();
        this.renderCalendar();
        this.loadAppointments();
    }
    
    changeYear(year) {
        this.currentYear = parseInt(year);
        this.renderCalendar();
        this.loadAppointments();
    }
    
    updateYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        if (!yearSelect) return;
        
        let hasYear = false;
        
        for (let option of yearSelect.options) {
            if (parseInt(option.value) === this.currentYear) {
                hasYear = true;
                option.selected = true;
                break;
            }
        }
        
        if (!hasYear) {
            const option = document.createElement('option');
            option.value = this.currentYear;
            option.textContent = this.currentYear;
            option.selected = true;
            
            if (this.currentYear < parseInt(yearSelect.options[0].value)) {
                yearSelect.insertBefore(option, yearSelect.options[0]);
            } else {
                yearSelect.appendChild(option);
            }
        }
    }
    
    async loadAppointments() {
        try {
            const response = await fetch(`/api/buscar-agendamentos.php?year=${this.currentYear}&month=${this.currentMonth + 1}`);
            const data = await response.json();
            
            if (data.success) {
                this.appointments = data.appointments || [];
                this.markAppointments();
            }
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            this.appointments = [];
        }
    }
    
    renderCalendar() {
        const currentMonthElement = document.getElementById('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = `${this.monthNames[this.currentMonth]} ${this.currentYear}`;
        }
        
        const today = new Date();
        this.isReadOnly = this.currentYear < today.getFullYear();
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
        
        const calendarDays = document.getElementById('calendarDays');
        if (!calendarDays) {
            console.error('Elemento calendarDays não encontrado!');
            return;
        }
        
        calendarDays.innerHTML = '';
        
        // Dias do mês anterior
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const date = new Date(this.currentYear, this.currentMonth - 1, day);
            const dayDiv = this.createDayElement(day, 'other-month', date);
            calendarDays.appendChild(dayDiv);
        }
        
        // Dias do mês atual
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dayDiv = this.createDayElement(day, '', date);
            calendarDays.appendChild(dayDiv);
        }
        
        // Dias do próximo mês
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells;
        
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(this.currentYear, this.currentMonth + 1, day);
            const dayDiv = this.createDayElement(day, 'other-month', date);
            calendarDays.appendChild(dayDiv);
        }
    }
    
    createDayElement(day, additionalClass, date) {
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-day ${additionalClass}`;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        
        if (compareDate.getTime() === today.getTime()) {
            dayDiv.classList.add('today');
        }
        
        if (compareDate < today || this.isReadOnly) {
            dayDiv.classList.add('disabled');
        }
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayDiv.appendChild(dayNumber);
        
        const dayEvents = document.createElement('div');
        dayEvents.className = 'day-events';
        dayEvents.id = `events-${date.toISOString().split('T')[0]}`;
        dayDiv.appendChild(dayEvents);
        
        if (!dayDiv.classList.contains('disabled') && !additionalClass.includes('other-month')) {
            dayDiv.addEventListener('click', () => this.selectDate(date));
            dayDiv.style.cursor = 'pointer';
        }
        
        return dayDiv;
    }
    
    markAppointments() {
        if (!this.appointments || this.appointments.length === 0) return;
        
        this.appointments.forEach(appointment => {
            const eventDate = new Date(appointment.data_casamento + 'T00:00:00');
            const dateString = eventDate.toISOString().split('T')[0];
            const eventsContainer = document.getElementById(`events-${dateString}`);
            
            if (eventsContainer) {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                
                const horario = appointment.horario_casamento ? appointment.horario_casamento.substring(0, 5) : '';
                const noiva = appointment.nome_noiva ? appointment.nome_noiva.split(' ')[0] : '';
                const noivo = appointment.nome_noivo ? appointment.nome_noivo.split(' ')[0] : '';
                
                eventItem.textContent = `${horario} - ${noiva} & ${noivo}`;
                eventItem.title = `${appointment.nome_noiva} & ${appointment.nome_noivo}\nLocal: ${appointment.nome_local}\nCelebrante: ${appointment.celebrante}`;
                
                eventsContainer.appendChild(eventItem);
                eventsContainer.parentElement.classList.add('has-event');
            }
        });
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.openBookingModal(date);
    }
    
    openBookingModal(date) {
        const modal = document.getElementById('bookingModal');
        if (!modal) return;
        
        modal.classList.add('active');
        
        const bookingId = this.generateBookingId();
        const bookingIdInput = document.getElementById('bookingId');
        if (bookingIdInput) bookingIdInput.value = bookingId;
        
        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const bookingDateInput = document.getElementById('bookingDate');
        if (bookingDateInput) bookingDateInput.value = todayFormatted;
        
        const weddingDateInput = document.getElementById('weddingDate');
        if (weddingDateInput) {
            weddingDateInput.value = date.toISOString().split('T')[0];
        }
        
        const form = document.getElementById('bookingForm');
        if (form) {
            form.reset();
            if (bookingIdInput) bookingIdInput.value = bookingId;
            if (bookingDateInput) bookingDateInput.value = todayFormatted;
            if (weddingDateInput) weddingDateInput.value = date.toISOString().split('T')[0];
        }
        
        this.loadLocations();
        this.loadCelebrants();
        this.updateProclames(date);
        
        // Focus no primeiro campo: Data da Entrevista
        setTimeout(() => {
            const interviewDate = document.getElementById('interviewDate');
            if (interviewDate) interviewDate.focus();
        }, 300);
    }
    
    generateBookingId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `AG${timestamp}${random}`;
    }
    
    async loadLocations() {
        try {
            const response = await fetch('/api/buscar-locais.php');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('ceremonyLocation');
                if (select) {
                    select.innerHTML = '<option value="">Selecione o local...</option>';
                    
                    data.locations.forEach(location => {
                        if (location.ativo) {
                            const option = document.createElement('option');
                            option.value = location.id;
                            option.textContent = location.nome_local.toUpperCase();
                            select.appendChild(option);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
        }
    }
    
    async loadCelebrants() {
        try {
            const response = await fetch('/api/buscar-padres.php');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('celebrant');
                if (select) {
                    select.innerHTML = '<option value="">Selecione o celebrante...</option>';
                    
                    data.celebrants.forEach(celebrant => {
                        if (celebrant.ativo) {
                            const option = document.createElement('option');
                            option.value = celebrant.id;
                            option.textContent = celebrant.nome_completo.toUpperCase();
                            select.appendChild(option);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
        }
    }
    
    updateProclames(weddingDate) {
        const sundays = this.calculateSundays(weddingDate);
        
        const firstSunday = document.getElementById('firstSunday');
        const secondSunday = document.getElementById('secondSunday');
        const thirdSunday = document.getElementById('thirdSunday');
        const weddingDateDisplay = document.getElementById('weddingDateDisplay');
        
        if (firstSunday) firstSunday.textContent = this.formatDate(sundays[0]);
        if (secondSunday) secondSunday.textContent = this.formatDate(sundays[1]);
        if (thirdSunday) thirdSunday.textContent = this.formatDate(sundays[2]);
        if (weddingDateDisplay) weddingDateDisplay.textContent = this.formatDate(weddingDate);
    }
    
    calculateSundays(weddingDate) {
        const sundays = [];
        
        for (let i = 3; i >= 1; i--) {
            let sunday = new Date(weddingDate);
            sunday.setDate(sunday.getDate() - (i * 7));
            
            while (sunday.getDay() !== 0) {
                sunday.setDate(sunday.getDate() - 1);
            }
            
            sundays.push(sunday);
        }
        
        return sundays;
    }
    
    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    refresh() {
        this.renderCalendar();
        this.loadAppointments();
    }
}

// Funções globais para os modais
function closeModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.classList.remove('active');
}

function closeAlert() {
    const modal = document.getElementById('alertModal');
    if (modal) modal.classList.remove('active');
}

// Instancia o calendário quando o DOM carregar
let weddingCalendar;

document.addEventListener('DOMContentLoaded', () => {
    weddingCalendar = new WeddingCalendar();
    
    // Adiciona listener para mudança de data do casamento
    const weddingDateInput = document.getElementById('weddingDate');
    if (weddingDateInput) {
        weddingDateInput.addEventListener('change', function() {
            if (this.value && weddingCalendar) {
                const date = new Date(this.value + 'T00:00:00');
                weddingCalendar.updateProclames(date);
            }
        });
    }
});

// Exporta para uso em outros módulos
window.WeddingCalendar = WeddingCalendar;
