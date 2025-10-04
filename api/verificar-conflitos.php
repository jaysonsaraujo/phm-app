<?php
/**
 * API para Verificar Conflitos de Agendamento
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class ConflictChecker {
    private $db;
    private $config;
    
    public function __construct() {
        $this->db = getDB();
        $this->loadConfig();
    }
    
    /**
     * Carrega configurações do sistema
     */
    private function loadConfig() {
        $this->config = [
            'duracao_cerimonia_minutos' => $this->getConfiguracao('duracao_cerimonia_minutos', 60),
            'intervalo_entre_cerimonias' => $this->getConfiguracao('intervalo_entre_cerimonias', 30),
            'horario_inicio_agendamento' => $this->getConfiguracao('horario_inicio_agendamento', '08:00'),
            'horario_fim_agendamento' => $this->getConfiguracao('horario_fim_agendamento', '20:00'),
            'dias_antecedencia_minima' => $this->getConfiguracao('dias_antecedencia_minima', 90),
            'dias_antecedencia_maxima' => $this->getConfiguracao('dias_antecedencia_maxima', 365)
        ];
    }
    
    /**
     * Verifica todos os conflitos possíveis
     */
    public function verificarConflitos($dados) {
        try {
            $conflitos = [
                'has_conflicts' => false,
                'conflicts' => [],
                'warnings' => [],
                'suggestions' => []
            ];
            
            // Validações básicas de data e hora
            $validacaoTempo = $this->validarDataHora($dados);
            if (!$validacaoTempo['valid']) {
                $conflitos['has_conflicts'] = true;
                $conflitos['conflicts']['time_validation'] = $validacaoTempo['errors'];
                return $conflitos;
            }
            
            // Verifica conflitos de local
            $conflitoLocal = $this->verificarConflitoLocal(
                $dados['date'], 
                $dados['time'], 
                $dados['location_id'],
                $dados['booking_id'] ?? null
            );
            
            if ($conflitoLocal['has_conflict']) {
                $conflitos['has_conflicts'] = true;
                $conflitos['conflicts']['location'] = $conflitoLocal;
            }
            
            // Verifica conflitos de celebrante
            $conflitoCelebrante = $this->verificarConflitoCelebrante(
                $dados['date'], 
                $dados['time'], 
                $dados['celebrant_id'],
                $dados['booking_id'] ?? null
            );
            
            if ($conflitoCelebrante['has_conflict']) {
                $conflitos['has_conflicts'] = true;
                $conflitos['conflicts']['celebrant'] = $conflitoCelebrante;
            }
            
            // Verifica conflitos de pessoas (noivos)
            if (isset($dados['bride_name']) && isset($dados['groom_name'])) {
                $conflitoPessoas = $this->verificarConflitoPessoas(
                    $dados['bride_name'],
                    $dados['groom_name'],
                    $dados['date'],
                    $dados['booking_id'] ?? null
                );
                
                if ($conflitoPessoas['has_conflict']) {
                    $conflitos['has_conflicts'] = true;
                    $conflitos['conflicts']['people'] = $conflitoPessoas;
                }
            }
            
            // Verifica proximidade com outros eventos
            $proximidade = $this->verificarProximidade(
                $dados['date'],
                $dados['time'],
                $dados['location_id']
            );
            
            if ($proximidade['has_warning']) {
                $conflitos['warnings'][] = $proximidade;
            }
            
            // Gera sugestões se houver conflitos
            if ($conflitos['has_conflicts']) {
                $conflitos['suggestions'] = $this->gerarSugestoes(
                    $dados['date'],
                    $dados['time'],
                    $dados['location_id'],
                    $dados['celebrant_id']
                );
            }
            
            // Adiciona análise de disponibilidade geral
            $conflitos['availability_analysis'] = $this->analisarDisponibilidadeGeral(
                $dados['date'],
                $dados['location_id'],
                $dados['celebrant_id']
            );
            
            return $conflitos;
            
        } catch (Exception $e) {
            return [
                'has_conflicts' => true,
                'error' => $e->getMessage(),
                'conflicts' => ['system' => 'Erro ao verificar conflitos']
            ];
        }
    }
    
    /**
     * Valida data e hora do agendamento
     */
    private function validarDataHora($dados) {
        $errors = [];
        $valid = true;
        
        // Valida formato da data
        $data = DateTime::createFromFormat('Y-m-d', $dados['date']);
        if (!$data) {
            $errors[] = 'Data em formato inválido';
            $valid = false;
        } else {
            $hoje = new DateTime();
            $hoje->setTime(0, 0, 0);
            
            // Verifica se é data passada
            if ($data < $hoje) {
                $errors[] = 'Não é permitido agendar em datas passadas';
                $valid = false;
            }
            
            // Verifica antecedência mínima
            $dataMinima = clone $hoje;
            $dataMinima->add(new DateInterval("P{$this->config['dias_antecedencia_minima']}D"));
            
            if ($data < $dataMinima) {
                $errors[] = "É necessário agendar com no mínimo {$this->config['dias_antecedencia_minima']} dias de antecedência";
                $valid = false;
            }
            
            // Verifica antecedência máxima
            $dataMaxima = clone $hoje;
            $dataMaxima->add(new DateInterval("P{$this->config['dias_antecedencia_maxima']}D"));
            
            if ($data > $dataMaxima) {
                $errors[] = "Não é permitido agendar com mais de {$this->config['dias_antecedencia_maxima']} dias de antecedência";
                $valid = false;
            }
        }
        
        // Valida formato da hora
        if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $dados['time'])) {
            $errors[] = 'Horário em formato inválido';
            $valid = false;
        } else {
            // Verifica se está dentro do horário permitido
            $hora = $dados['time'];
            if ($hora < $this->config['horario_inicio_agendamento'] || 
                $hora > $this->config['horario_fim_agendamento']) {
                $errors[] = "Horário deve estar entre {$this->config['horario_inicio_agendamento']} e {$this->config['horario_fim_agendamento']}";
                $valid = false;
            }
        }
        
        return ['valid' => $valid, 'errors' => $errors];
    }
    
    /**
     * Verifica conflito de local
     */
    private function verificarConflitoLocal($data, $horario, $localId, $bookingId = null) {
        $tempoInicio = new DateTime("{$data} {$horario}");
        $tempoFim = clone $tempoInicio;
        $tempoFim->add(new DateInterval("PT{$this->config['duracao_cerimonia_minutos']}M"));
        
        // Adiciona intervalo de segurança
        $tempoInicioComIntervalo = clone $tempoInicio;
        $tempoInicioComIntervalo->sub(new DateInterval("PT{$this->config['intervalo_entre_cerimonias']}M"));
        
        $tempoFimComIntervalo = clone $tempoFim;
        $tempoFimComIntervalo->add(new DateInterval("PT{$this->config['intervalo_entre_cerimonias']}M"));
        
        $sql = "SELECT 
                    a.id,
                    a.nome_noiva,
                    a.nome_noivo,
                    a.horario_casamento,
                    TIME_FORMAT(a.horario_casamento, '%H:%i') as hora_formatada,
                    pd.nome_completo as celebrante
                FROM agendamentos a
                INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                WHERE a.data_casamento = :data
                AND a.local_id = :local_id
                AND a.status = 'ATIVO'";
        
        $params = [
            ':data' => $data,
            ':local_id' => $localId
        ];
        
        // Exclui o próprio agendamento se estiver editando
        if ($bookingId) {
            $sql .= " AND a.id != :booking_id";
            $params[':booking_id'] = $bookingId;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        $agendamentosConflitantes = [];
        
        while ($agendamento = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $horaAgendamento = new DateTime("{$data} {$agendamento['horario_casamento']}");
            $horaFimAgendamento = clone $horaAgendamento;
            $horaFimAgendamento->add(new DateInterval("PT{$this->config['duracao_cerimonia_minutos']}M"));
            
            // Verifica sobreposição
            if (!(($tempoFimComIntervalo <= $horaAgendamento) || 
                  ($tempoInicioComIntervalo >= $horaFimAgendamento))) {
                $agendamentosConflitantes[] = [
                    'id' => $agendamento['id'],
                    'couple' => "{$agendamento['nome_noiva']} & {$agendamento['nome_noivo']}",
                    'time' => $agendamento['hora_formatada'],
                    'celebrant' => $agendamento['celebrante']
                ];
            }
        }
        
        if (count($agendamentosConflitantes) > 0) {
            return [
                'has_conflict' => true,
                'message' => 'Local já reservado neste horário',
                'conflicting_bookings' => $agendamentosConflitantes,
                'suggestion' => 'Considere escolher outro horário com pelo menos ' . 
                               ($this->config['duracao_cerimonia_minutos'] + $this->config['intervalo_entre_cerimonias']) . 
                               ' minutos de diferença'
            ];
        }
        
        return ['has_conflict' => false];
    }
    
    /**
     * Verifica conflito de celebrante
     */
    private function verificarConflitoCelebrante($data, $horario, $celebranteId, $bookingId = null) {
        $tempoInicio = new DateTime("{$data} {$horario}");
        $tempoFim = clone $tempoInicio;
        $tempoFim->add(new DateInterval("PT{$this->config['duracao_cerimonia_minutos']}M"));
        
        // Adiciona tempo de deslocamento (30 minutos antes e depois)
        $tempoInicioComDeslocamento = clone $tempoInicio;
        $tempoInicioComDeslocamento->sub(new DateInterval("PT30M"));
        
        $tempoFimComDeslocamento = clone $tempoFim;
        $tempoFimComDeslocamento->add(new DateInterval("PT30M"));
        
        $sql = "SELECT 
                    a.id,
                    a.nome_noiva,
                    a.nome_noivo,
                    a.horario_casamento,
                    TIME_FORMAT(a.horario_casamento, '%H:%i') as hora_formatada,
                    l.nome_local
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE a.data_casamento = :data
                AND a.padre_diacono_id = :celebrante_id
                AND a.status = 'ATIVO'";
        
        $params = [
            ':data' => $data,
            ':celebrante_id' => $celebranteId
        ];
        
        if ($bookingId) {
            $sql .= " AND a.id != :booking_id";
            $params[':booking_id'] = $bookingId;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        $compromissosConflitantes = [];
        
        while ($compromisso = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $horaCompromisso = new DateTime("{$data} {$compromisso['horario_casamento']}");
            $horaFimCompromisso = clone $horaCompromisso;
            $horaFimCompromisso->add(new DateInterval("PT{$this->config['duracao_cerimonia_minutos']}M"));
            
            // Verifica sobreposição considerando deslocamento
            if (!(($tempoFimComDeslocamento <= $horaCompromisso) || 
                  ($tempoInicioComDeslocamento >= $horaFimCompromisso))) {
                
                // Calcula tempo de deslocamento necessário
                $diffMinutos = abs(($tempoInicio->getTimestamp() - $horaCompromisso->getTimestamp()) / 60);
                
                $compromissosConflitantes[] = [
                    'id' => $compromisso['id'],
                    'couple' => "{$compromisso['nome_noiva']} & {$compromisso['nome_noivo']}",
                    'time' => $compromisso['hora_formatada'],
                    'location' => $compromisso['nome_local'],
                    'time_difference_minutes' => $diffMinutos
                ];
            }
        }
        
        if (count($compromissosConflitantes) > 0) {
            return [
                'has_conflict' => true,
                'message' => 'Celebrante já tem compromisso neste horário',
                'conflicting_commitments' => $compromissosConflitantes,
                'suggestion' => 'O celebrante precisa de pelo menos 30 minutos entre celebrações para deslocamento'
            ];
        }
        
        return ['has_conflict' => false];
    }
    
    /**
     * Verifica conflito de pessoas (noivos)
     */
    private function verificarConflitoPessoas($nomeNoiva, $nomeNoivo, $data, $bookingId = null) {
        // Busca agendamentos da noiva
        $sql = "SELECT 
                    a.id,
                    a.nome_noiva,
                    a.nome_noivo,
                    a.data_casamento,
                    a.horario_casamento,
                    l.nome_local
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE (UPPER(a.nome_noiva) = UPPER(:nome_noiva) 
                       OR UPPER(a.nome_noivo) = UPPER(:nome_noiva))
                AND a.data_casamento >= CURDATE()
                AND a.status = 'ATIVO'";
        
        $params = [':nome_noiva' => $nomeNoiva];
        
        if ($bookingId) {
            $sql .= " AND a.id != :booking_id";
            $params[':booking_id'] = $bookingId;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        $conflitosNoiva = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Busca agendamentos do noivo
        $sql = str_replace(':nome_noiva', ':nome_noivo', $sql);
        $params = [':nome_noivo' => $nomeNoivo];
        if ($bookingId) {
            $params[':booking_id'] = $bookingId;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        $conflitosNoivo = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $todosConflitos = [];
        
        if (count($conflitosNoiva) > 0) {
            foreach ($conflitosNoiva as $conflito) {
                $todosConflitos[] = [
                    'person' => $nomeNoiva,
                    'role' => 'Noiva',
                    'existing_booking' => [
                        'couple' => "{$conflito['nome_noiva']} & {$conflito['nome_noivo']}",
                        'date' => date('d/m/Y', strtotime($conflito['data_casamento'])),
                        'time' => substr($conflito['horario_casamento'], 0, 5),
                        'location' => $conflito['nome_local']
                    ]
                ];
            }
        }
        
        if (count($conflitosNoivo) > 0) {
            foreach ($conflitosNoivo as $conflito) {
                $todosConflitos[] = [
                    'person' => $nomeNoivo,
                    'role' => 'Noivo',
                    'existing_booking' => [
                        'couple' => "{$conflito['nome_noiva']} & {$conflito['nome_noivo']}",
                        'date' => date('d/m/Y', strtotime($conflito['data_casamento'])),
                        'time' => substr($conflito['horario_casamento'], 0, 5),
                        'location' => $conflito['nome_local']
                    ]
                ];
            }
        }
        
        if (count($todosConflitos) > 0) {
            return [
                'has_conflict' => true,
                'message' => 'Uma ou ambas as pessoas já possuem casamento agendado',
                'conflicts' => $todosConflitos
            ];
        }
        
        return ['has_conflict' => false];
    }
    
    /**
     * Verifica proximidade com outros eventos
     */
    private function verificarProximidade($data, $horario, $localId) {
        // Verifica se há muitos eventos no mesmo dia
        $sql = "SELECT COUNT(*) as total
                FROM agendamentos
                WHERE data_casamento = :data
                AND local_id = :local_id
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $data,
            ':local_id' => $localId
        ]);
        
        $totalEventosDia = $stmt->fetchColumn();
        
        $warnings = [];
        
        if ($totalEventosDia >= 3) {
            $warnings[] = "Já existem {$totalEventosDia} casamentos agendados neste local para esta data";
        }
        
        // Verifica se é véspera de feriado ou data especial
        $diaSemana = date('w', strtotime($data));
        if ($diaSemana == 5) { // Sexta-feira
            $warnings[] = "Sexta-feira costuma ter maior demanda e pode haver atrasos";
        } elseif ($diaSemana == 6) { // Sábado
            $warnings[] = "Sábado é o dia mais concorrido para casamentos";
        }
        
        // Verifica horário de pico
        $hora = (int)substr($horario, 0, 2);
        if ($hora >= 17 && $hora <= 20) {
            $warnings[] = "Horário de pico - considere possíveis atrasos no trânsito";
        }
        
        if (count($warnings) > 0) {
            return [
                'has_warning' => true,
                'type' => 'proximity',
                'warnings' => $warnings
            ];
        }
        
        return ['has_warning' => false];
    }
    
    /**
     * Gera sugestões de horários alternativos
     */
    private function gerarSugestoes($data, $horarioOriginal, $localId, $celebranteId) {
        $sugestoes = [];
        
        // Busca horários disponíveis no mesmo dia
        $horariosLivres = $this->buscarHorariosLivres($data, $localId, $celebranteId);
        
        if (count($horariosLivres) > 0) {
            // Encontra os 3 horários mais próximos
            $horaOriginal = strtotime("1970-01-01 {$horarioOriginal}");
            
            usort($horariosLivres, function($a, $b) use ($horaOriginal) {
                $diffA = abs(strtotime("1970-01-01 {$a}") - $horaOriginal);
                $diffB = abs(strtotime("1970-01-01 {$b}") - $horaOriginal);
                return $diffA - $diffB;
            });
            
            $horariosProximos = array_slice($horariosLivres, 0, 3);
            
            foreach ($horariosProximos as $horario) {
                $sugestoes[] = [
                    'date' => $data,
                    'time' => $horario,
                    'type' => 'same_day',
                    'description' => "Mesmo dia às {$horario}"
                ];
            }
        }
        
        // Busca dias alternativos próximos
        $diasAlternativos = $this->buscarDiasAlternativos($data, $horarioOriginal, $localId, $celebranteId);
        
        foreach ($diasAlternativos as $dia) {
            $sugestoes[] = [
                'date' => $dia['date'],
                'time' => $dia['time'],
                'type' => 'alternative_day',
                'description' => $dia['description']
            ];
        }
        
        return $sugestoes;
    }
    
    /**
     * Busca horários livres em um dia
     */
    private function buscarHorariosLivres($data, $localId, $celebranteId) {
        $horariosOcupados = [];
        
        // Busca horários ocupados do local
        $sql = "SELECT horario_casamento
                FROM agendamentos
                WHERE data_casamento = :data
                AND local_id = :local_id
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $data,
            ':local_id' => $localId
        ]);
        
        while ($row = $stmt->fetch()) {
            $hora = new DateTime("{$data} {$row['horario_casamento']}");
            $horaInicio = clone $hora;
            $horaInicio->sub(new DateInterval("PT{$this->config['intervalo_entre_cerimonias']}M"));
            $horaFim = clone $hora;
            $horaFim->add(new DateInterval("PT" . 
                ($this->config['duracao_cerimonia_minutos'] + $this->config['intervalo_entre_cerimonias']) . "M"));
            
            $horariosOcupados[] = [
                'inicio' => $horaInicio->format('H:i'),
                'fim' => $horaFim->format('H:i')
            ];
        }
        
        // Busca horários ocupados do celebrante
        $sql = "SELECT horario_casamento
                FROM agendamentos
                WHERE data_casamento = :data
                AND padre_diacono_id = :celebrante_id
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $data,
            ':celebrante_id' => $celebranteId
        ]);
        
        while ($row = $stmt->fetch()) {
            $hora = new DateTime("{$data} {$row['horario_casamento']}");
            $horaInicio = clone $hora;
            $horaInicio->sub(new DateInterval("PT30M")); // Tempo de deslocamento
            $horaFim = clone $hora;
            $horaFim->add(new DateInterval("PT" . 
                ($this->config['duracao_cerimonia_minutos'] + 30) . "M"));
            
            $horariosOcupados[] = [
                'inicio' => $horaInicio->format('H:i'),
                'fim' => $horaFim->format('H:i')
            ];
        }
        
        // Gera lista de horários disponíveis
        $horariosLivres = [];
        $horaAtual = new DateTime("{$data} {$this->config['horario_inicio_agendamento']}");
        $horaLimite = new DateTime("{$data} {$this->config['horario_fim_agendamento']}");
        
        while ($horaAtual < $horaLimite) {
            $horarioStr = $horaAtual->format('H:i');
            $livre = true;
            
            foreach ($horariosOcupados as $ocupado) {
                if ($horarioStr >= $ocupado['inicio'] && $horarioStr < $ocupado['fim']) {
                    $livre = false;
                    break;
                }
            }
            
            if ($livre) {
                $horariosLivres[] = $horarioStr;
            }
            
            $horaAtual->add(new DateInterval('PT30M'));
        }
        
        return $horariosLivres;
    }
    
    /**
     * Busca dias alternativos
     */
    private function buscarDiasAlternativos($dataOriginal, $horario, $localId, $celebranteId) {
        $alternativas = [];
        $data = new DateTime($dataOriginal);
        
        // Verifica 7 dias antes e depois
        for ($i = -7; $i <= 7; $i++) {
            if ($i == 0) continue; // Pula o dia original
            
            $dataAlternativa = clone $data;
            $dataAlternativa->add(new DateInterval('P' . abs($i) . 'D'));
            
            if ($i < 0) {
                $dataAlternativa->sub(new DateInterval('P' . (abs($i) * 2) . 'D'));
            }
            
            $dataStr = $dataAlternativa->format('Y-m-d');
            
            // Verifica se o horário está disponível neste dia
            $conflitoLocal = $this->verificarConflitoLocal($dataStr, $horario, $localId);
            $conflitoCelebrante = $this->verificarConflitoCelebrante($dataStr, $horario, $celebranteId);
            
            if (!$conflitoLocal['has_conflict'] && !$conflitoCelebrante['has_conflict']) {
                $diaSemana = $this->getDiaSemanaPortugues($dataAlternativa->format('w'));
                $alternativas[] = [
                    'date' => $dataStr,
                    'time' => $horario,
                    'description' => sprintf(
                        "%s, %s às %s",
                        $diaSemana,
                        $dataAlternativa->format('d/m/Y'),
                        $horario
                    )
                ];
                
                if (count($alternativas) >= 3) break;
            }
        }
        
        return $alternativas;
    }
    
    /**
     * Analisa disponibilidade geral
     */
    private function analisarDisponibilidadeGeral($data, $localId, $celebranteId) {
        $analise = [];
        
        // Taxa de ocupação do local no dia
        $sql = "SELECT COUNT(*) as total FROM agendamentos
                WHERE data_casamento = :data
                AND local_id = :local_id
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':data' => $data, ':local_id' => $localId]);
        $ocupacaoLocal = $stmt->fetchColumn();
        
        $capacidadeDiaria = 8; // Máximo de 8 casamentos por dia
        $taxaOcupacaoLocal = ($ocupacaoLocal / $capacidadeDiaria) * 100;
        
        $analise['location_occupancy'] = [
            'bookings' => $ocupacaoLocal,
            'capacity' => $capacidadeDiaria,
            'rate' => round($taxaOcupacaoLocal, 1)
        ];
        
        // Carga do celebrante no dia
        $sql = "SELECT COUNT(*) as total FROM agendamentos
                WHERE data_casamento = :data
                AND padre_diacono_id = :celebrante_id
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':data' => $data, ':celebrante_id' => $celebranteId]);
        $cargaCelebrante = $stmt->fetchColumn();
        
        $capacidadeCelebrante = 4; // Máximo de 4 celebrações por dia
        $taxaCargaCelebrante = ($cargaCelebrante / $capacidadeCelebrante) * 100;
        
        $analise['celebrant_workload'] = [
            'bookings' => $cargaCelebrante,
            'capacity' => $capacidadeCelebrante,
            'rate' => round($taxaCargaCelebrante, 1)
        ];
        
        // Recomendação geral
        if ($taxaOcupacaoLocal > 75 || $taxaCargaCelebrante > 75) {
            $analise['recommendation'] = 'Alta demanda - considere datas alternativas';
            $analise['status'] = 'busy';
        } elseif ($taxaOcupacaoLocal > 50 || $taxaCargaCelebrante > 50) {
            $analise['recommendation'] = 'Demanda moderada - reserve com antecedência';
            $analise['status'] = 'moderate';
        } else {
            $analise['recommendation'] = 'Boa disponibilidade';
            $analise['status'] = 'available';
        }
        
        return $analise;
    }
    
    /**
     * Obtém dia da semana em português
     */
    private function getDiaSemanaPortugues($numero) {
        $dias = [
            0 => 'Domingo',
            1 => 'Segunda-feira',
            2 => 'Terça-feira',
            3 => 'Quarta-feira',
            4 => 'Quinta-feira',
            5 => 'Sexta-feira',
            6 => 'Sábado'
        ];
        
        return $dias[$numero] ?? '';
    }
    
    /**
     * Obtém configuração do sistema
     */
    private function getConfiguracao($chave, $padrao = null) {
        $sql = "SELECT valor FROM configuracoes WHERE chave = :chave";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':chave' => $chave]);
        
        $resultado = $stmt->fetch();
        return $resultado ? $resultado['valor'] : $padrao;
    }
}

// Processa a requisição
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Obtém dados JSON do corpo da requisição
    $json = file_get_contents('php://input');
    $dados = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode([
            'success' => false,
            'message' => 'Dados inválidos recebidos'
        ]);
        exit;
    }
    
    // Valida dados mínimos necessários
    if (!isset($dados['date']) || !isset($dados['time']) || 
        !isset($dados['location_id']) || !isset($dados['celebrant_id'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Dados incompletos. São necessários: date, time, location_id, celebrant_id'
        ]);
        exit;
    }
    
    // Verifica conflitos
    $checker = new ConflictChecker();
    $resultado = $checker->verificarConflitos($dados);
    
    // Adiciona flag de sucesso
    $resultado['success'] = true;
    
    // Retorna resposta
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido. Use POST'
    ]);
}
?>
