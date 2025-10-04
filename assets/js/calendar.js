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
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.populateYearSelector();
        this.loadAppointments();
        this.renderCalendar();
    }
    
    setupEventListeners() {
        // Navegação por mês
        document.getElementById('prevMonth').addEventListener('click', () => this.previousMonth());
        document.getElementById('nextMonth').addEventListener('click', () => this.nextMonth());
        
        // Navegação por ano
        document.getElementById('prevYear').addEventListener('click', () => this.previousYear());
        document.getElementById('nextYear').addEventListener('click', () => this.nextYear());
        document.getElementById('yearSelect').addEventListener('change', (e) => this.changeYear(e.target.value));
    }
    
    populateYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
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
    }
    
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
            this.updateYearSelector();
        }
        this.renderCalendar();
    }
    
    previousYear() {
        this.currentYear--;
        this.updateYearSelector();
        this.renderCalendar();
    }
    
    nextYear() {
        this.currentYear++;
        this.updateYearSelector();
        this.renderCalendar();
    }
    
    changeYear(year) {
        this.currentYear = parseInt(year);
        this.renderCalendar();
    }
    
    updateYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        let hasYear = false;
        
        // Verifica se o ano existe no select
        for (let option of yearSelect.options) {
            if (parseInt(option.value) === this.currentYear) {
                hasYear = true;
                option.selected = true;
                break;
            }
        }
        
        // Se não existir, adiciona o ano
        if (!hasYear) {
            const option = document.createElement('option');
            option.value = this.currentYear;
            option.textContent = this.currentYear;
            option.selected = true;
            
            // Adiciona na posição correta
            if (this.currentYear < parseInt(yearSelect.options[0].value)) {
                yearSelect.insertBefore(option, yearSelect.options[0]);
            } else {
                yearSelect.appendChild(option);
            }
        }
    }
    
    async loadAppointments() {
        try {
            const response = await fetch(`api/buscar-agendamentos.php?year=${this.currentYear}&month=${this.currentMonth + 1}`);
            const data = await response.json();
            
            if (data.success) {
                this.appointments = data.appointments;
            }
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            this.appointments = [];
        }
    }
    
    renderCalendar() {
        // Atualiza o título do mês
        document.getElementById('currentMonth').textContent = 
            `${this.monthNames[this.currentMonth]} ${this.currentYear}`;
        
        // Verifica se o calendário é somente leitura (anos anteriores)
        const today = new Date();
        this.isReadOnly = this.currentYear < today.getFullYear();
        
        // Primeiro dia do mês
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        
        // Número de dias no mês
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        // Número de dias do mês anterior
        const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
        
        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';
        
        // Dias do mês anterior
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayDiv = this.createDayElement(
                daysInPrevMonth - i,
                'other-month',
                new Date(this.currentYear, this.currentMonth - 1, daysInPrevMonth - i)
            );
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
        const remainingCells = 42 - totalCells; // 6 semanas x 7 dias
        
        for (let day = 1; day <= remainingCells; day++) {
            const dayDiv = this.createDayElement(
                day,
                'other-month',
                new Date(this.currentYear, this.currentMonth + 1, day)
            );
            calendarDays.appendChild(dayDiv);
        }
        
        // Recarrega os agendamentos
        this.loadAppointments().then(() => this.markAppointments());
    }
    
    createDayElement(day, additionalClass, date) {
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-day ${additionalClass}`;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        
        // Marca o dia de hoje
        if (compareDate.getTime() === today.getTime()) {
            dayDiv.classList.add('today');
        }
        
        // Marca dias passados como desabilitados
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
        
        // Adiciona evento de clique se não for desabilitado
        if (!dayDiv.classList.contains('disabled') && !additionalClass.includes('other-month')) {
            dayDiv.addEventListener('click', () => this.selectDate(date));
        }
        
        return dayDiv;
    }
    
    markAppointments() {
        this.appointments.forEach(appointment => {
            const eventDate = new Date(appointment.data_casamento);
            const dateString = eventDate.toISOString().split('T')[0];
            const eventsContainer = document.getElementById(`events-${dateString}`);
            
            if (eventsContainer) {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.textContent = `${appointment.horario_casamento.substring(0, 5)} - ${appointment.nome_noiva.split(' ')[0]} & ${appointment.nome_noivo.split(' ')[0]}`;
                eventItem.title = `${appointment.nome_noiva} & ${appointment.nome_noivo}\nLocal: ${appointment.nome_local}\nCelebrante: ${appointment.celebrante}`;
                eventsContainer.appendChild(eventItem);
                
                // Marca o dia como tendo evento
                eventsContainer.parentElement.classList.add('has-event');
            }
        });
    }
    
    selectDate(date) {
        this.selectedDate = date;
        
        // Formata a data para o padrão brasileiro
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        // Abre o modal de agendamento
        this.openBookingModal(date);
    }
    
    openBookingModal(date) {
        const modal = document.getElementById('bookingModal');
        modal.classList.add('active');
        
        // Gera um ID único para o agendamento
        const bookingId = this.generateBookingId();
        document.getElementById('bookingId').value = bookingId;
        
        // Define a data de agendamento (hoje)
        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        document.getElementById('bookingDate').value = todayFormatted;
        
        // Define a data do casamento selecionada
        const weddingDateInput = document.getElementById('weddingDate');
        weddingDateInput.value = date.toISOString().split('T')[0];
        
        // Limpa o formulário
        document.getElementById('bookingForm').reset();
        document.getElementById('bookingId').value = bookingId;
        document.getElementById('bookingDate').value = todayFormatted;
        weddingDateInput.value = date.toISOString().split('T')[0];
        
        // Carrega os locais e celebrantes
        this.loadLocations();
        this.loadCelebrants();
        
        // Atualiza as datas dos proclames
        this.updateProclames(date);
        
        // Foca no primeiro campo
        setTimeout(() => {
            document.getElementById('brideName').focus();
        }, 300);
    }
    
    generateBookingId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `AG${timestamp}${random}`;
    }
    
    async loadLocations() {
        try {
            const response = await fetch('api/buscar-locais.php');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('ceremonyLocation');
                select.innerHTML = '<option value="">Selecione o local...</option>';
                
                data.locations.forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.id;
                    option.textContent = location.nome_local.toUpperCase();
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
        }
    }
    
    async loadCelebrants() {
        try {
            const response = await fetch('api/buscar-padres.php');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('celebrant');
                select.innerHTML = '<option value="">Selecione o celebrante...</option>';
                
                data.celebrants.forEach(celebrant => {
                    const option = document.createElement('option');
                    option.value = celebrant.id;
                    option.textContent = celebrant.nome_completo.toUpperCase();
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
        }
    }
    
    updateProclames(weddingDate) {
        // Calcula os três domingos anteriores
        const sundays = this.calculateSundays(weddingDate);
        
        // Atualiza a tabela de proclames
        document.getElementById('firstSunday').textContent = this.formatDate(sundays[0]);
        document.getElementById('secondSunday').textContent = this.formatDate(sundays[1]);
        document.getElementById('thirdSunday').textContent = this.formatDate(sundays[2]);
        document.getElementById('weddingDateDisplay').textContent = this.formatDate(weddingDate);
    }
    
    calculateSundays(weddingDate) {
        const sundays = [];
        
        for (let i = 3; i >= 1; i--) {
            let sunday = new Date(weddingDate);
            sunday.setDate(sunday.getDate() - (i * 7));
            
            // Ajusta para o domingo anterior se não for domingo
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
    
    async checkAvailability(date, time, locationId) {
        try {
            const response = await fetch('api/verificar-disponibilidade.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    date: date,
                    time: time,
                    location_id: locationId
                })
            });
            
            const data = await response.json();
            return data.available;
        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
            return false;
        }
    }
    
    refresh() {
        this.loadAppointments().then(() => {
            this.renderCalendar();
        });
    }
}

// Funções globais para os modais
function closeModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

function addNewLocation() {
    document.getElementById('newLocationModal').classList.add('active');
}

function closeLocationModal() {
    document.getElementById('newLocationModal').classList.remove('active');
}

function addNewCelebrant() {
    document.getElementById('newCelebrantModal').classList.add('active');
}

function closeCelebrantModal() {
    document.getElementById('newCelebrantModal').classList.remove('active');
}

function closeAlert() {
    document.getElementById('alertModal').classList.remove('active');
}

// Instancia o calendário quando o DOM carregar
let weddingCalendar;

document.addEventListener('DOMContentLoaded', () => {
    weddingCalendar = new WeddingCalendar();
    
    // Adiciona listener para mudança de data do casamento
    document.getElementById('weddingDate').addEventListener('change', function() {
        if (this.value) {
            const date = new Date(this.value + 'T00:00:00');
            weddingCalendar.updateProclames(date);
        }
    });
});

// Exporta para uso em outros módulos
window.WeddingCalendar = WeddingCalendar;
window.weddingCalendar = null;
