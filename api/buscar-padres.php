<?php
/**
 * API para Buscar e Gerenciar Padres/Diáconos
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class CelebranteManager {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    /**
     * Lista todos os celebrantes ativos
     */
    public function listarCelebrantes($tipo = null, $incluirInativos = false) {
        try {
            $sql = "SELECT 
                        pd.id,
                        pd.nome_completo,
                        pd.tipo,
                        pd.telefone,
                        pd.email,
                        pd.ativo,
                        pd.created_at,
                        pd.updated_at,
                        COUNT(DISTINCT a.id) as total_celebracoes,
                        COUNT(DISTINCT CASE 
                            WHEN a.data_casamento >= CURDATE() 
                            THEN a.id 
                        END) as celebracoes_futuras,
                        MIN(CASE 
                            WHEN a.data_casamento >= CURDATE() 
                            THEN a.data_casamento 
                        END) as proxima_celebracao
                    FROM padres_diaconos pd
                    LEFT JOIN agendamentos a ON pd.id = a.padre_diacono_id AND a.status = 'ATIVO'
                    WHERE 1=1";
            
            $params = [];
            
            if (!$incluirInativos) {
                $sql .= " AND pd.ativo = 1";
            }
            
            if ($tipo) {
                $sql .= " AND pd.tipo = :tipo";
                $params[':tipo'] = $tipo;
            }
            
            $sql .= " GROUP BY pd.id
                     ORDER BY pd.tipo ASC, pd.nome_completo ASC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            $celebrantes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Processa os celebrantes
            foreach ($celebrantes as &$celebrante) {
                $celebrante['nome_completo'] = strtoupper($celebrante['nome_completo']);
                
                // Formata telefone
                if ($celebrante['telefone']) {
                    $celebrante['telefone_formatado'] = $this->formatarTelefone($celebrante['telefone']);
                }
                
                // Busca agenda do celebrante
                $celebrante['agenda_proxima_semana'] = $this->buscarAgendaProximaSemana($celebrante['id']);
                
                // Verifica disponibilidade para hoje
                $celebrante['disponivel_hoje'] = $this->verificarDisponibilidadeHoje($celebrante['id']);
                
                // Calcula carga de trabalho
                $celebrante['carga_trabalho'] = $this->calcularCargaTrabalho($celebrante['id']);
            }
            
            return [
                'success' => true,
                'celebrants' => $celebrantes,
                'total' => count($celebrantes),
                'summary' => $this->gerarResumo($celebrantes)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar celebrantes: ' . $e->getMessage(),
                'celebrants' => []
            ];
        }
    }
    
    /**
     * Busca um celebrante específico
     */
    public function buscarCelebrante($id) {
        try {
            $sql = "SELECT * FROM padres_diaconos WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            $celebrante = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$celebrante) {
                return [
                    'success' => false,
                    'message' => 'Celebrante não encontrado'
                ];
            }
            
            // Formata dados
            $celebrante['nome_completo'] = strtoupper($celebrante['nome_completo']);
            
            // Busca estatísticas
            $celebrante['estatisticas'] = $this->buscarEstatisticasCelebrante($id);
            
            // Busca agenda completa
            $celebrante['agenda'] = $this->buscarAgendaCelebrante($id);
            
            // Busca histórico
            $celebrante['historico'] = $this->buscarHistoricoCelebrante($id);
            
            // Horários preferenciais
            $celebrante['horarios_preferenciais'] = $this->analisarHorariosPreferenciais($id);
            
            return [
                'success' => true,
                'celebrant' => $celebrante
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar celebrante: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Adiciona novo celebrante
     */
    public function adicionarCelebrante($dados) {
        try {
            // Valida dados
            if (empty($dados['nome_completo'])) {
                throw new Exception('Nome completo é obrigatório');
            }
            
            if (empty($dados['tipo']) || !in_array($dados['tipo'], ['PADRE', 'DIÁCONO'])) {
                throw new Exception('Tipo deve ser PADRE ou DIÁCONO');
            }
            
            // Verifica duplicidade
            $sql = "SELECT COUNT(*) FROM padres_diaconos 
                    WHERE UPPER(nome_completo) = UPPER(:nome)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':nome' => $dados['nome_completo']]);
            
            if ($stmt->fetchColumn() > 0) {
                throw new Exception('Já existe um celebrante com este nome');
            }
            
            // Valida email se fornecido
            if (!empty($dados['email']) && !filter_var($dados['email'], FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Email inválido');
            }
            
            // Insere o novo celebrante
            $sql = "INSERT INTO padres_diaconos (
                        nome_completo,
                        tipo,
                        telefone,
                        email,
                        ativo
                    ) VALUES (
                        :nome_completo,
                        :tipo,
                        :telefone,
                        :email,
                        1
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':nome_completo' => strtoupper(trim($dados['nome_completo'])),
                ':tipo' => $dados['tipo'],
                ':telefone' => !empty($dados['telefone']) ? $this->limparTelefone($dados['telefone']) : null,
                ':email' => !empty($dados['email']) ? strtolower(trim($dados['email'])) : null
            ]);
            
            $celebranteId = $this->db->lastInsertId();
            
            // Registra no log
            $this->registrarLog('NOVO_CELEBRANTE', 
                "{$dados['tipo']} '{$dados['nome_completo']}' adicionado ao sistema", 
                $celebranteId);
            
            return [
                'success' => true,
                'message' => 'Celebrante adicionado com sucesso',
                'celebrantId' => $celebranteId
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Atualiza um celebrante
     */
    public function atualizarCelebrante($id, $dados) {
        try {
            // Verifica se o celebrante existe
            $sql = "SELECT * FROM padres_diaconos WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            if (!$stmt->fetch()) {
                throw new Exception('Celebrante não encontrado');
            }
            
            // Verifica duplicidade do nome se foi alterado
            if (!empty($dados['nome_completo'])) {
                $sql = "SELECT COUNT(*) FROM padres_diaconos 
                        WHERE UPPER(nome_completo) = UPPER(:nome) 
                        AND id != :id";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([
                    ':nome' => $dados['nome_completo'],
                    ':id' => $id
                ]);
                
                if ($stmt->fetchColumn() > 0) {
                    throw new Exception('Já existe outro celebrante com este nome');
                }
            }
            
            // Valida email se fornecido
            if (isset($dados['email']) && !empty($dados['email']) && 
                !filter_var($dados['email'], FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Email inválido');
            }
            
            // Monta a query de atualização
            $campos = [];
            $valores = [':id' => $id];
            
            if (isset($dados['nome_completo'])) {
                $campos[] = "nome_completo = :nome_completo";
                $valores[':nome_completo'] = strtoupper(trim($dados['nome_completo']));
            }
            
            if (isset($dados['tipo'])) {
                if (!in_array($dados['tipo'], ['PADRE', 'DIÁCONO'])) {
                    throw new Exception('Tipo deve ser PADRE ou DIÁCONO');
                }
                $campos[] = "tipo = :tipo";
                $valores[':tipo'] = $dados['tipo'];
            }
            
            if (isset($dados['telefone'])) {
                $campos[] = "telefone = :telefone";
                $valores[':telefone'] = !empty($dados['telefone']) ? 
                    $this->limparTelefone($dados['telefone']) : null;
            }
            
            if (isset($dados['email'])) {
                $campos[] = "email = :email";
                $valores[':email'] = !empty($dados['email']) ? 
                    strtolower(trim($dados['email'])) : null;
            }
            
            if (isset($dados['ativo'])) {
                $campos[] = "ativo = :ativo";
                $valores[':ativo'] = $dados['ativo'] ? 1 : 0;
            }
            
            if (empty($campos)) {
                throw new Exception('Nenhum campo para atualizar');
            }
            
            $sql = "UPDATE padres_diaconos SET " . implode(', ', $campos) . " WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($valores);
            
            // Registra no log
            $this->registrarLog('ATUALIZAR_CELEBRANTE', 
                "Celebrante ID {$id} atualizado", 
                $id);
            
            return [
                'success' => true,
                'message' => 'Celebrante atualizado com sucesso'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Remove um celebrante (soft delete)
     */
    public function removerCelebrante($id) {
        try {
            // Verifica se o celebrante existe
            $sql = "SELECT nome_completo, tipo FROM padres_diaconos WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            $celebrante = $stmt->fetch();
            
            if (!$celebrante) {
                throw new Exception('Celebrante não encontrado');
            }
            
            // Verifica se há agendamentos futuros
            $sql = "SELECT COUNT(*) FROM agendamentos 
                    WHERE padre_diacono_id = :id 
                    AND data_casamento >= CURDATE() 
                    AND status = 'ATIVO'";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            if ($stmt->fetchColumn() > 0) {
                throw new Exception('Não é possível remover o celebrante pois existem celebrações futuras agendadas');
            }
            
            // Desativa o celebrante ao invés de deletar
            $sql = "UPDATE padres_diaconos SET ativo = 0 WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            // Registra no log
            $this->registrarLog('REMOVER_CELEBRANTE', 
                "{$celebrante['tipo']} '{$celebrante['nome_completo']}' desativado", 
                $id);
            
            return [
                'success' => true,
                'message' => 'Celebrante removido com sucesso'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca disponibilidade de um celebrante
     */
    public function buscarDisponibilidadeCelebrante($celebranteId, $data) {
        try {
            // Configurações do sistema
            $horarioInicio = $this->getConfiguracao('horario_inicio_agendamento', '08:00');
            $horarioFim = $this->getConfiguracao('horario_fim_agendamento', '20:00');
            $duracaoCerimonia = $this->getConfiguracao('duracao_cerimonia_minutos', 60);
            $intervaloMinimo = $this->getConfiguracao('intervalo_entre_cerimonias', 30);
            
            // Busca compromissos do celebrante no dia
            $sql = "SELECT 
                        a.horario_casamento,
                        a.nome_noiva,
                        a.nome_noivo,
                        l.nome_local,
                        TIME_FORMAT(a.horario_casamento, '%H:%i') as hora_formatada
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    WHERE a.padre_diacono_id = :celebrante_id
                    AND a.data_casamento = :data
                    AND a.status = 'ATIVO'
                    ORDER BY a.horario_casamento ASC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':celebrante_id' => $celebranteId,
                ':data' => $data
            ]);
            
            $compromissos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Calcula horários disponíveis
            $horariosDisponiveis = [];
            $horaAtual = new DateTime($data . ' ' . $horarioInicio);
            $horaLimite = new DateTime($data . ' ' . $horarioFim);
            
            // Verifica se é hoje e ajusta hora inicial
            $hoje = new DateTime();
            if ($data === $hoje->format('Y-m-d')) {
                $agoraMais2Horas = clone $hoje;
                $agoraMais2Horas->add(new DateInterval('PT2H'));
                if ($agoraMais2Horas > $horaAtual) {
                    $horaAtual = $agoraMais2Horas;
                    // Arredonda para próxima meia hora
                    $minutos = (int)$horaAtual->format('i');
                    if ($minutos > 0 && $minutos <= 30) {
                        $horaAtual->setTime((int)$horaAtual->format('H'), 30);
                    } elseif ($minutos > 30) {
                        $horaAtual->add(new DateInterval('PT1H'));
                        $horaAtual->setTime((int)$horaAtual->format('H'), 0);
                    }
                }
            }
            
            while ($horaAtual < $horaLimite) {
                $horarioStr = $horaAtual->format('H:i');
                $disponivel = true;
                $motivo = null;
                
                // Verifica conflitos com compromissos existentes
                foreach ($compromissos as $compromisso) {
                    $horaCompromisso = new DateTime($data . ' ' . $compromisso['horario_casamento']);
                    $horaFimCompromisso = clone $horaCompromisso;
                    $horaFimCompromisso->add(new DateInterval("PT{$duracaoCerimonia}M"));
                    
                    // Adiciona tempo de deslocamento (15 minutos antes e depois)
                    $horaInicioComDeslocamento = clone $horaCompromisso;
                    $horaInicioComDeslocamento->sub(new DateInterval('PT15M'));
                    
                    $horaFimComDeslocamento = clone $horaFimCompromisso;
                    $horaFimComDeslocamento->add(new DateInterval('PT15M'));
                    
                    $horaFimAtual = clone $horaAtual;
                    $horaFimAtual->add(new DateInterval("PT{$duracaoCerimonia}M"));
                    
                    // Verifica sobreposição considerando deslocamento
                    if (!(($horaFimAtual <= $horaInicioComDeslocamento) || 
                          ($horaAtual >= $horaFimComDeslocamento))) {
                        $disponivel = false;
                        $motivo = "Conflito com celebração às {$compromisso['hora_formatada']} em {$compromisso['nome_local']}";
                        break;
                    }
                }
                
                if ($disponivel) {
                    $horariosDisponiveis[] = [
                        'horario' => $horarioStr,
                        'disponivel' => true
                    ];
                } else {
                    $horariosDisponiveis[] = [
                        'horario' => $horarioStr,
                        'disponivel' => false,
                        'motivo' => $motivo
                    ];
                }
                
                // Avança 30 minutos
                $horaAtual->add(new DateInterval('PT30M'));
            }
            
            // Calcula estatísticas do dia
            $totalCompromissos = count($compromissos);
            $tempoOcupado = $totalCompromissos * ($duracaoCerimonia + 30); // Inclui deslocamento
            $tempoDisponivel = count(array_filter($horariosDisponiveis, function($h) { 
                return $h['disponivel']; 
            })) * 30;
            
            return [
                'success' => true,
                'date' => $data,
                'celebrant_id' => $celebranteId,
                'scheduled' => $compromissos,
                'available_slots' => $horariosDisponiveis,
                'statistics' => [
                    'total_commitments' => $totalCompromissos,
                    'busy_time_minutes' => $tempoOcupado,
                    'available_time_minutes' => $tempoDisponivel,
                    'utilization_percent' => $tempoOcupado > 0 ? 
                        round(($tempoOcupado / ($tempoOcupado + $tempoDisponivel)) * 100, 1) : 0
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar disponibilidade: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca agenda da próxima semana
     */
    private function buscarAgendaProximaSemana($celebranteId) {
        $dataInicio = new DateTime();
        $dataFim = clone $dataInicio;
        $dataFim->add(new DateInterval('P7D'));
        
        $sql = "SELECT 
                    DATE_FORMAT(a.data_casamento, '%d/%m') as data,
                    TIME_FORMAT(a.horario_casamento, '%H:%i') as hora,
                    l.nome_local
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE a.padre_diacono_id = :celebrante_id
                AND a.data_casamento BETWEEN :data_inicio AND :data_fim
                AND a.status = 'ATIVO'
                ORDER BY a.data_casamento, a.horario_casamento";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':celebrante_id' => $celebranteId,
            ':data_inicio' => $dataInicio->format('Y-m-d'),
            ':data_fim' => $dataFim->format('Y-m-d')
        ]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Verifica disponibilidade para hoje
     */
    private function verificarDisponibilidadeHoje($celebranteId) {
        $hoje = date('Y-m-d');
        $agora = date('H:i');
        
        $sql = "SELECT COUNT(*) FROM agendamentos
                WHERE padre_diacono_id = :celebrante_id
                AND data_casamento = :hoje
                AND horario_casamento > :agora
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':celebrante_id' => $celebranteId,
            ':hoje' => $hoje,
            ':agora' => $agora
        ]);
        
        $compromissosHoje = $stmt->fetchColumn();
        
        // Considera disponível se tiver menos de 3 compromissos para hoje
        return $compromissosHoje < 3;
    }
    
    /**
     * Calcula carga de trabalho do celebrante
     */
    private function calcularCargaTrabalho($celebranteId) {
        // Carga do mês atual
        $sql = "SELECT COUNT(*) FROM agendamentos
                WHERE padre_diacono_id = :celebrante_id
                AND MONTH(data_casamento) = MONTH(CURDATE())
                AND YEAR(data_casamento) = YEAR(CURDATE())
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':celebrante_id' => $celebranteId]);
        $celebracoesMesAtual = $stmt->fetchColumn();
        
        // Define nível de carga
        if ($celebracoesMesAtual <= 4) {
            return 'BAIXA';
        } elseif ($celebracoesMesAtual <= 8) {
            return 'MÉDIA';
        } else {
            return 'ALTA';
        }
    }
    
    /**
     * Busca estatísticas do celebrante
     */
    private function buscarEstatisticasCelebrante($celebranteId) {
        $stats = [];
        
        // Total de celebrações
        $sql = "SELECT COUNT(*) FROM agendamentos 
                WHERE padre_diacono_id = :id AND status = 'ATIVO'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $celebranteId]);
        $stats['total_celebracoes'] = $stmt->fetchColumn();
        
        // Celebrações este ano
        $sql = "SELECT COUNT(*) FROM agendamentos 
                WHERE padre_diacono_id = :id 
                AND YEAR(data_casamento) = YEAR(CURDATE())
                AND status = 'ATIVO'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $celebranteId]);
        $stats['celebracoes_ano_atual'] = $stmt->fetchColumn();
        
        // Média mensal
        $sql = "SELECT 
                    COUNT(*) / COUNT(DISTINCT DATE_FORMAT(data_casamento, '%Y-%m')) as media
                FROM agendamentos
                WHERE padre_diacono_id = :id
                AND status = 'ATIVO'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $celebranteId]);
        $stats['media_mensal'] = round($stmt->fetchColumn(), 1);
        
        // Local mais frequente
        $sql = "SELECT 
                    l.nome_local,
                    COUNT(*) as total
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE a.padre_diacono_id = :id
                AND a.status = 'ATIVO'
                GROUP BY a.local_id
                ORDER BY total DESC
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $celebranteId]);
        $localFrequente = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($localFrequente) {
            $stats['local_mais_frequente'] = $localFrequente['nome_local'];
            $stats['celebracoes_local_frequente'] = $localFrequente['total'];
        }
        
        // Dia da semana preferencial
        $sql = "SELECT 
                    DAYNAME(data_casamento) as dia,
                    COUNT(*) as total
                FROM agendamentos
                WHERE padre_diacono_id = :id
                AND status = 'ATIVO'
                GROUP BY DAYOFWEEK(data_casamento)
                ORDER BY total DESC
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $celebranteId]);
        $diaPreferencial = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($diaPreferencial) {
            $diasPT = [
                'Sunday' => 'Domingo',
                'Monday' => 'Segunda-feira',
                'Tuesday' => 'Terça-feira',
                'Wednesday' => 'Quarta-feira',
                'Thursday' => 'Quinta-feira',
                'Friday' => 'Sexta-feira',
                'Saturday' => 'Sábado'
            ];
            $stats['dia_preferencial'] = $diasPT[$diaPreferencial['dia']] ?? $diaPreferencial['dia'];
        }
        
        return $stats;
    }
    
    /**
     * Busca agenda completa do celebrante
     */
    private function buscarAgendaCelebrante($celebranteId) {
        $sql = "SELECT 
                    a.id,
                    a.data_casamento,
                    a.horario_casamento,
                    a.nome_noiva,
                    a.nome_noivo,
                    l.nome_local,
                    a.com_efeito_civil,
                    DATEDIFF(a.data_casamento, CURDATE()) as dias_restantes
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE a.padre_diacono_id = :celebrante_id
                AND a.data_casamento >= CURDATE()
                AND a.status = 'ATIVO'
                ORDER BY a.data_casamento, a.horario_casamento
                LIMIT 20";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':celebrante_id' => $celebranteId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Busca histórico do celebrante
     */
    private function buscarHistoricoCelebrante($celebranteId) {
        $sql = "SELECT 
                    a.data_casamento,
                    a.nome_noiva,
                    a.nome_noivo,
                    l.nome_local
                FROM agendamentos a
                INNER JOIN locais_cerimonias l ON a.local_id = l.id
                WHERE a.padre_diacono_id = :celebrante_id
                AND a.data_casamento < CURDATE()
                AND a.status IN ('ATIVO', 'REALIZADO')
                ORDER BY a.data_casamento DESC
                LIMIT 10";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':celebrante_id' => $celebranteId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Analisa horários preferenciais
     */
    private function analisarHorariosPreferenciais($celebranteId) {
        $sql = "SELECT 
                    horario_casamento,
                    COUNT(*) as frequencia
                FROM agendamentos
                WHERE padre_diacono_id = :celebrante_id
                AND status = 'ATIVO'
                GROUP BY horario_casamento
                ORDER BY frequencia DESC
                LIMIT 5";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':celebrante_id' => $celebranteId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Gera resumo dos celebrantes
     */
    private function gerarResumo($celebrantes) {
        $resumo = [
            'total_padres' => 0,
            'total_diaconos' => 0,
            'total_ativos' => 0,
            'celebracoes_mes_atual' => 0,
            'mais_ocupado' => null,
            'menos_ocupado' => null
        ];
        
        $maxCelebracoes = 0;
        $minCelebracoes = PHP_INT_MAX;
        
        foreach ($celebrantes as $celebrante) {
            if ($celebrante['tipo'] === 'PADRE') {
                $resumo['total_padres']++;
            } else {
                $resumo['total_diaconos']++;
            }
            
            if ($celebrante['ativo']) {
                $resumo['total_ativos']++;
            }
            
            if ($celebrante['celebracoes_futuras'] > $maxCelebracoes) {
                $maxCelebracoes = $celebrante['celebracoes_futuras'];
                $resumo['mais_ocupado'] = $celebrante['nome_completo'];
            }
            
            if ($celebrante['celebracoes_futuras'] < $minCelebracoes && $celebrante['ativo']) {
                $minCelebracoes = $celebrante['celebracoes_futuras'];
                $resumo['menos_ocupado'] = $celebrante['nome_completo'];
            }
        }
        
        return $resumo;
    }
    
    /**
     * Formata telefone
     */
    private function formatarTelefone($telefone) {
        $telefone = preg_replace('/\D/', '', $telefone);
        
        if (strlen($telefone) === 11) {
            return sprintf('(%s) %s-%s',
                substr($telefone, 0, 2),
                substr($telefone, 2, 5),
                substr($telefone, 7)
            );
        } elseif (strlen($telefone) === 10) {
            return sprintf('(%s) %s-%s',
                substr($telefone, 0, 2),
                substr($telefone, 2, 4),
                substr($telefone, 6)
            );
        }
        
        return $telefone;
    }
    
    /**
     * Limpa telefone
     */
    private function limparTelefone($telefone) {
        return preg_replace('/\D/', '', $telefone);
    }
    
    /**
     * Registra atividade no log
     */
    private function registrarLog($acao, $descricao, $celebranteId = null) {
        $sql = "INSERT INTO log_atividades (
                    acao,
                    descricao,
                    ip_address,
                    user_agent
                ) VALUES (
                    :acao,
                    :descricao,
                    :ip_address,
                    :user_agent
                )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':acao' => $acao,
            ':descricao' => $descricao . " (Celebrante ID: {$celebranteId})",
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
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
$manager = new CelebranteManager();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Buscar celebrante específico
            $resultado = $manager->buscarCelebrante($_GET['id']);
        } elseif (isset($_GET['availability'])) {
            // Buscar disponibilidade
            $celebranteId = $_GET['celebrant_id'] ?? null;
            $data = $_GET['date'] ?? null;
            
            if (!$celebranteId || !$data) {
                $resultado = ['success' => false, 'message' => 'Parâmetros incompletos'];
            } else {
                $resultado = $manager->buscarDisponibilidadeCelebrante($celebranteId, $data);
            }
        } else {
            // Listar todos os celebrantes
            $tipo = $_GET['type'] ?? null;
            $incluirInativos = isset($_GET['include_inactive']) && $_GET['include_inactive'] == '1';
            $resultado = $manager->listarCelebrantes($tipo, $incluirInativos);
        }
        break;
        
    case 'POST':
        // Adicionar novo celebrante
        $json = file_get_contents('php://input');
        $dados = json_decode($json, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $resultado = ['success' => false, 'message' => 'Dados inválidos'];
        } else {
            $resultado = $manager->adicionarCelebrante($dados);
        }
        break;
        
    case 'PUT':
        // Atualizar celebrante
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $resultado = ['success' => false, 'message' => 'ID não fornecido'];
        } else {
            $json = file_get_contents('php://input');
            $dados = json_decode($json, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                $resultado = ['success' => false, 'message' => 'Dados inválidos'];
            } else {
                $resultado = $manager->atualizarCelebrante($id, $dados);
            }
        }
        break;
        
    case 'DELETE':
        // Remover celebrante
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $resultado = ['success' => false, 'message' => 'ID não fornecido'];
        } else {
            $resultado = $manager->removerCelebrante($id);
        }
        break;
        
    default:
        http_response_code(405);
        $resultado = ['success' => false, 'message' => 'Método não permitido'];
}

// Retorna resposta JSON
echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
?>
