-- =====================================================
-- SISTEMA DE AGENDAMENTO DE CASAMENTOS
-- Database: db-phm-app
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------
-- Tabela: locais_cerimonias
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `locais_cerimonias` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nome_local` VARCHAR(255) NOT NULL,
  `endereco` TEXT,
  `capacidade` INT(11),
  `ativo` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nome_local` (`nome_local`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: padres_diaconos
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `padres_diaconos` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nome_completo` VARCHAR(255) NOT NULL,
  `tipo` ENUM('PADRE', 'DIÁCONO') NOT NULL,
  `telefone` VARCHAR(20),
  `email` VARCHAR(255),
  `ativo` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nome` (`nome_completo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: agendamentos
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agendamentos` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `data_agendamento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `nome_noiva` VARCHAR(255) NOT NULL,
  `whatsapp_noiva` VARCHAR(20) NOT NULL,
  `nome_noivo` VARCHAR(255) NOT NULL,
  `whatsapp_noivo` VARCHAR(20) NOT NULL,
  `data_casamento` DATE NOT NULL,
  `horario_casamento` TIME NOT NULL,
  `local_id` INT(11) NOT NULL,
  `padre_diacono_id` INT(11) NOT NULL,
  `transferencia_tipo` ENUM('NAO', 'ENTRADA_PAROQUIA', 'SAIDA_PAROQUIA', 'ENTRADA_DIOCESE', 'SAIDA_DIOCESE') DEFAULT 'NAO',
  `com_efeito_civil` TINYINT(1) DEFAULT 0,
  `observacoes` TEXT,
  `data_entrevista` DATE,
  `mensagem_sistema` TEXT,
  `status` ENUM('ATIVO', 'CANCELADO', 'REALIZADO') DEFAULT 'ATIVO',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`local_id`) REFERENCES `locais_cerimonias`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`padre_diacono_id`) REFERENCES `padres_diaconos`(`id`) ON DELETE RESTRICT,
  UNIQUE KEY `unique_datetime_local` (`data_casamento`, `horario_casamento`, `local_id`),
  INDEX `idx_data_casamento` (`data_casamento`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: proclames
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `proclames` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `agendamento_id` VARCHAR(36) NOT NULL,
  `primeiro_domingo` DATE NOT NULL,
  `segundo_domingo` DATE NOT NULL,
  `terceiro_domingo` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_agendamento` (`agendamento_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: lembretes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lembretes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `agendamento_id` VARCHAR(36) NOT NULL,
  `tipo_lembrete` ENUM('ENTREVISTA', 'PROCLAME', 'CASAMENTO', 'DOCUMENTACAO') NOT NULL,
  `data_lembrete` DATETIME NOT NULL,
  `mensagem` TEXT NOT NULL,
  `enviado` TINYINT(1) DEFAULT 0,
  `data_envio` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE,
  INDEX `idx_data_lembrete` (`data_lembrete`),
  INDEX `idx_enviado` (`enviado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: configuracoes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `configuracoes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `chave` VARCHAR(100) NOT NULL,
  `valor` TEXT NOT NULL,
  `tipo` ENUM('STRING', 'INTEGER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
  `descricao` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_chave` (`chave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Tabela: log_atividades
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `log_atividades` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `acao` VARCHAR(100) NOT NULL,
  `descricao` TEXT,
  `agendamento_id` VARCHAR(36),
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_agendamento` (`agendamento_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Inserir configurações padrão
-- -----------------------------------------------------
INSERT INTO `configuracoes` (`chave`, `valor`, `tipo`, `descricao`) VALUES
('nome_sistema', 'Sistema de Agendamento de Casamentos', 'STRING', 'Nome do sistema'),
('nome_paroquia', 'Paróquia São José', 'STRING', 'Nome da paróquia'),
('dias_antecedencia_minima', '90', 'INTEGER', 'Dias mínimos de antecedência para agendar'),
('dias_antecedencia_maxima', '365', 'INTEGER', 'Dias máximos de antecedência para agendar'),
('horario_inicio_agendamento', '08:00', 'STRING', 'Horário inicial para agendamentos'),
('horario_fim_agendamento', '20:00', 'STRING', 'Horário final para agendamentos'),
('duracao_cerimonia_minutos', '60', 'INTEGER', 'Duração padrão da cerimônia em minutos'),
('intervalo_entre_cerimonias', '30', 'INTEGER', 'Intervalo mínimo entre cerimônias em minutos'),
('dias_lembrete_entrevista', '7', 'INTEGER', 'Dias antes para lembrete de entrevista'),
('dias_lembrete_casamento', '3', 'INTEGER', 'Dias antes para lembrete do casamento'),
('enviar_lembretes_whatsapp', '1', 'BOOLEAN', 'Ativar envio de lembretes por WhatsApp'),
('enviar_lembretes_email', '0', 'BOOLEAN', 'Ativar envio de lembretes por email'),
('cor_tema_principal', '#8B4513', 'STRING', 'Cor principal do sistema'),
('cor_tema_secundaria', '#D2691E', 'STRING', 'Cor secundária do sistema');

-- -----------------------------------------------------
-- Inserir dados de exemplo
-- -----------------------------------------------------
INSERT INTO `locais_cerimonias` (`nome_local`, `endereco`, `capacidade`) VALUES
('IGREJA MATRIZ SÃO JOSÉ', 'Praça Central, 100 - Centro', 500),
('CAPELA NOSSA SENHORA APARECIDA', 'Rua das Flores, 200 - Jardim Primavera', 150),
('SALÃO PAROQUIAL', 'Rua da Igreja, 50 - Centro', 200);

INSERT INTO `padres_diaconos` (`nome_completo`, `tipo`, `telefone`, `email`) VALUES
('PE. JOÃO CARLOS SILVA', 'PADRE', '(11) 98765-4321', 'pe.joao@paroquia.com.br'),
('PE. ANTONIO FERREIRA', 'PADRE', '(11) 98765-4322', 'pe.antonio@paroquia.com.br'),
('DC. MARCOS SANTOS', 'DIÁCONO', '(11) 98765-4323', 'dc.marcos@paroquia.com.br');

-- -----------------------------------------------------
-- Criar View para calendário
-- -----------------------------------------------------
CREATE OR REPLACE VIEW `v_calendario_agendamentos` AS
SELECT 
    a.id,
    a.data_casamento,
    a.horario_casamento,
    a.nome_noiva,
    a.nome_noivo,
    l.nome_local,
    p.nome_completo as celebrante,
    a.status,
    CASE 
        WHEN a.data_casamento < CURDATE() THEN 'PASSADO'
        WHEN a.data_casamento = CURDATE() THEN 'HOJE'
        ELSE 'FUTURO'
    END as periodo
FROM agendamentos a
JOIN locais_cerimonias l ON a.local_id = l.id
JOIN padres_diaconos p ON a.padre_diacono_id = p.id
WHERE a.status = 'ATIVO';

-- -----------------------------------------------------
-- Criar função para calcular domingos dos proclames
-- -----------------------------------------------------
DELIMITER $$
CREATE FUNCTION calcular_domingo_anterior(data_casamento DATE, semanas_antes INT)
RETURNS DATE
DETERMINISTIC
BEGIN
    DECLARE domingo DATE;
    SET domingo = DATE_SUB(data_casamento, INTERVAL (semanas_antes * 7) DAY);
    
    -- Ajustar para o domingo anterior se não for domingo
    WHILE DAYOFWEEK(domingo) != 1 DO
        SET domingo = DATE_SUB(domingo, INTERVAL 1 DAY);
    END WHILE;
    
    RETURN domingo;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Trigger para criar proclames automaticamente
-- -----------------------------------------------------
DELIMITER $$
CREATE TRIGGER after_agendamento_insert
AFTER INSERT ON agendamentos
FOR EACH ROW
BEGIN
    INSERT INTO proclames (
        agendamento_id,
        primeiro_domingo,
        segundo_domingo,
        terceiro_domingo
    ) VALUES (
        NEW.id,
        calcular_domingo_anterior(NEW.data_casamento, 3),
        calcular_domingo_anterior(NEW.data_casamento, 2),
        calcular_domingo_anterior(NEW.data_casamento, 1)
    );
    
    -- Registrar no log
    INSERT INTO log_atividades (acao, descricao, agendamento_id)
    VALUES ('NOVO_AGENDAMENTO', CONCAT('Agendamento criado para ', NEW.nome_noiva, ' e ', NEW.nome_noivo), NEW.id);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Índices adicionais para performance
-- -----------------------------------------------------
CREATE INDEX idx_whatsapp_noiva ON agendamentos(whatsapp_noiva);
CREATE INDEX idx_whatsapp_noivo ON agendamentos(whatsapp_noivo);
CREATE INDEX idx_data_hora ON agendamentos(data_casamento, horario_casamento);

-- =====================================================
-- FIM DA ESTRUTURA DO BANCO DE DADOS
-- =====================================================
