/**
 * Sistema de Validação de Formulários - CORREÇÃO
 * Corrige validação de telefones
 */

class FormValidator {
    constructor() {
        this.forms = {
            booking: document.getElementById('bookingForm'),
            newLocation: document.getElementById('newLocationForm'),
            newCelebrant: document.getElementById('newCelebrantForm')
        };
        
        this.validators = {
            required: (value) => value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            // CORREÇÃO: Regex atualizada para aceitar formato com ou sem espaço
            phone: (value) => {
                // Remove todos os caracteres não numéricos para validação
                const cleanPhone = value.replace(/\D/g, '');
                // Verifica se tem 10 ou 11 dígitos
                if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                    // Verifica o formato com máscara
                    return /^KATEX_INLINE_OPEN\d{2}KATEX_INLINE_CLOSE\s?\d{4,5}-\d{4}$/.test(value);
                }
                return false;
            },
            date: (value) => !isNaN(Date.parse(value)),
            time: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
            minLength: (value, length) => value.trim().length >= length,
            maxLength: (value, length) => value.trim().length <= length
        };
        
        this.init();
    }
    
    init() {
        this.setupFormListeners();
        this.setupInputMasks();
        this.setupUppercaseInputs();
        this.setupRealTimeValidation();
    }
    
    setupInputMasks() {
        // CORREÇÃO: Máscara melhorada para telefone/WhatsApp
        const phoneInputs = document.querySelectorAll('input[type="tel"]');
        phoneInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                
                // Limita a 11 dígitos
                if (value.length > 11) {
                    value = value.substring(0, 11);
                }
                
                // Aplica a máscara
                if (value.length === 0) {
                    e.target.value = '';
                } else if (value.length <= 2) {
                    e.target.value = `(${value}`;
                } else if (value.length <= 6) {
                    e.target.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
                } else if (value.length <= 10) {
                    e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
                } else {
                    // Formato para 11 dígitos (celular)
                    e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
                }
            });
            
            // Adiciona evento de blur para validação final
            input.addEventListener('blur', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                
                // Se tiver menos de 10 dígitos, limpa o campo
                if (value.length > 0 && value.length < 10) {
                    this.showFieldError(input, 'Telefone incompleto. Digite DDD + número');
                } else if (value.length === 10) {
                    // Formata telefone fixo: (00) 0000-0000
                    e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
                } else if (value.length === 11) {
                    // Formata celular: (00) 00000-0000
                    e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
                }
            });
            
            // Adiciona placeholder dinâmico
            input.addEventListener('focus', (e) => {
                if (!e.target.value) {
                    e.target.placeholder = '(00) 00000-0000';
                }
            });
        });
    }
    
    validateField(field) {
        const value = field.value;
        let isValid = true;
        let errorMessage = '';
        
        // Validação de campo obrigatório
        if (field.hasAttribute('required') && !this.validators.required(value)) {
            isValid = false;
            errorMessage = 'Este campo é obrigatório';
        }
        
        // Validação específica por tipo
        if (isValid && value) {
            switch (field.type) {
                case 'email':
                    if (!this.validators.email(value)) {
                        isValid = false;
                        errorMessage = 'Email inválido';
                    }
                    break;
                    
                case 'tel':
                    // CORREÇÃO: Validação melhorada para telefone
                    if (!this.validators.phone(value)) {
                        isValid = false;
                        const cleanPhone = value.replace(/\D/g, '');
                        if (cleanPhone.length === 0) {
                            errorMessage = 'Digite o telefone';
                        } else if (cleanPhone.length < 10) {
                            errorMessage = 'Telefone incompleto. Mínimo 10 dígitos (com DDD)';
                        } else if (cleanPhone.length > 11) {
                            errorMessage = 'Telefone inválido. Máximo 11 dígitos';
                        } else {
                            errorMessage = 'Formato inválido. Use: (00) 00000-0000 ou (00) 0000-0000';
                        }
                    }
                    break;
                    
                case 'date':
                    if (!this.validators.date(value)) {
                        isValid = false;
                        errorMessage = 'Data inválida';
                    } else {
                        // Validação adicional para data do casamento
                        if (field.id === 'weddingDate') {
                            const selectedDate = new Date(value);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            if (selectedDate < today) {
                                isValid = false;
                                errorMessage = 'A data do casamento não pode ser no passado';
                            }
                            
                            // Verifica antecedência mínima (90 dias por padrão)
                            const minDate = new Date();
                            minDate.setDate(minDate.getDate() + 90);
                            
                            if (selectedDate < minDate) {
                                isValid = false;
                                errorMessage = 'O casamento deve ser agendado com no mínimo 90 dias de antecedência';
                            }
                            
                            // Verifica antecedência máxima (365 dias por padrão)
                            const maxDate = new Date();
                            maxDate.setDate(maxDate.getDate() + 365);
                            
                            if (selectedDate > maxDate) {
                                isValid = false;
                                errorMessage = 'O casamento pode ser agendado com no máximo 365 dias de antecedência';
                            }
                        }
                    }
                    break;
                    
                case 'time':
                    if (!this.validators.time(value)) {
                        isValid = false;
                        errorMessage = 'Horário inválido';
                    } else {
                        // Validação de horário permitido
                        const [hours, minutes] = value.split(':').map(Number);
                        const totalMinutes = hours * 60 + minutes;
                        
                        // Horário mínimo: 8:00, máximo: 20:00
                        if (totalMinutes < 480 || totalMinutes > 1200) {
                            isValid = false;
                            errorMessage = 'Horário deve estar entre 08:00 e 20:00';
                        }
                    }
                    break;
            }
        }
        
        // Validação de nome completo
        if (field.id === 'brideName' || field.id === 'groomName') {
            const names = value.trim().split(' ');
            if (names.length < 2 || names.some(name => name.length < 2)) {
                isValid = false;
                errorMessage = 'Digite o nome completo';
            }
        }
        
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    // Resto do código permanece igual...
}
