<?php
/**
 * API para Buscar Agendamentos
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class AgendamentoBusca {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    /**
     * Busca agendamentos por período
     */
    public function buscarAgendamentos($year, $month = null, $day = null) {
        try {
            // Constrói a query base
            $sql = "SELECT 
                        a.id,
                        a.data_agendamento,
                        a.nome_noiva,
                        a.whatsapp_noiva,
                        a.nome_noivo,
                        a.whatsapp_noivo,
                        a.data_casamento,
                        a.horario_casamento,
                        a.local_id,
                        l.nome_local,
                        l.endereco as local_endereco,
                        a.padre_diacono_id,
                        pd.nome_completo as celebrante,
                        pd.tipo as tipo_celebrante,
                        a.transferencia_tipo,
                        a.com_efeito_civil,
                        a.observacoes,
                        a.data_entrevista,
                        a.mensagem_sistema,
                        a.status,
                        a.created_at,
                        a.updated_at,
                        p.primeiro_domingo,
                        p.segundo_domingo,
                        p.terceiro_domingo
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    LEFT JOIN proclames p ON a.id = p.agendamento_id
                    WHERE 1=1 ";
            
            $params = [];
            
            // Filtra por ano
            if ($year) {
                $sql .= " AND YEAR(a.data_casamento) = :year ";
                $params[':year'] = $year;
            }
            
            // Filtra por mês
            if ($month) {
                $sql .= " AND MONTH(a.data_casamento) = :month ";
                $params[':month'] = $month;
            }
            
            // Filtra por dia
            if ($day) {
                $sql .= " AND DAY(a.data_casamento) = :day ";
                $params[':day'] = $day;
            }
            
            // Ordena por data e horário
            $sql .= " ORDER BY a.data_casamento ASC, a.horario_casamento ASC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            $agendamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Processa os dados
            $agendamentosProcessados = $this->processarAgendamentos($agendamentos);
            
            return [
                'success' => true,
                'appointments' => $agendamentosProcessados,
                'total' => count($agendamentosProcessados),
                'period' => $this->getPeriodDescription($year, $month, $day)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar agendamentos: ' . $e->getMessage(),
                'appointments' => []
            ];
        }
    }
    
    /**
     * Busca agendamento específico por ID
     */
    public function buscarAgendamentoPorId($id) {
        try {
            $sql = "SELECT 
                        a.*,
                        l.nome_local,
                        l.endereco as local_endereco,
                        l.capacidade as local_capacidade,
                        pd.nome_completo as celebrante,
                        pd.tipo as tipo_celebrante,
                        pd.telefone as celebrante_telefone,
                        pd.email as celebrante_email,
                        p.primeiro_domingo,
                        p.segundo_domingo,
                        p.terceiro_domingo
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    LEFT JOIN proclames p ON a.id = p.agendamento_id
                    WHERE a.id = :id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            $agendamento = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$agendamento) {
                return [
                    'success' => false,
                    'message' => 'Agendamento não encontrado'
                ];
            }
            
            // Busca lembretes do agendamento
            $agendamento['lembretes'] = $this->buscarLembretes($id);
            
            // Busca histórico
            $agendamento['historico'] = $this->buscarHistorico($id);
            
            return [
                'success' => true,
                'appointment' => $this->processarAgendamentoUnico($agendamento)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar agendamento: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca agendamentos do dia para verificação de disponibilidade
     */
    public function verificarDisponibilidade($data, $horario, $localId) {
        try {
            // Configurações do sistema
            $duracaoCerimonia = $this->getConfiguracao('duracao_cerimonia_minutos', 60);
            $intervaloMinimo = $this->getConfiguracao('intervalo_entre_cerimonias', 30);
            
            // Calcula intervalo de tempo
            $horaInicio = new DateTime("{$data} {$horario}");
            $horaFim = clone $horaInicio;
            $horaFim->add(new DateInterval("PT{$duracaoCerimonia}M"));
            
            $horaInicioComIntervalo = clone $horaInicio;
            $horaInicioComIntervalo->sub(new DateInterval("PT{$intervaloMinimo}M"));
            
            $horaFimComIntervalo = clone $horaFim;
            $horaFimComIntervalo->add(new DateInterval("PT{$intervaloMinimo}M"));
            
            // Busca agendamentos conflitantes
            $sql = "SELECT 
                        a.id,
                        a.nome_noiva,
                        a.nome_noivo,
                        a.horario_casamento,
                        l.nome_local,
                        pd.nome_completo as celebrante
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    WHERE a.data_casamento = :data
                    AND a.local_id = :local_id
                    AND a.status = 'ATIVO'
                    AND (
                        (a.horario_casamento >= :hora_inicio1 AND a.horario_casamento < :hora_fim1)
                        OR 
                        (DATE_ADD(CONCAT(a.data_casamento, ' ', a.horario_casamento), INTERVAL :duracao MINUTE) > :hora_inicio2 
                         AND a.horario_casamento < :hora_fim2)
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':data' => $data,
                ':local_id' => $localId,
                ':hora_inicio1' => $horaInicioComIntervalo->format('H:i'),
                ':hora_fim1' => $horaFimComIntervalo->format('H:i'),
                ':duracao' => $duracaoCerimonia,
                ':hora_inicio2' => $horaInicio->format('Y-m-d H:i:s'),
                ':hora_fim2' => $horaFim->format('Y-m-d H:i:s')
            ]);
            
            $conflitos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (count($conflitos) > 0) {
                return [
                    'success' => true,
                    'available' => false,
                    'conflicts' => $conflitos,
                    'message' => 'Horário não disponível devido a conflitos'
                ];
            }
            
            return [
                'success' => true,
                'available' => true,
                'message' => 'Horário disponível'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao verificar disponibilidade: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca estatísticas dos agendamentos
     */
    public function buscarEstatisticas($year = null, $month = null) {
        try {
            $params = [];
            $whereClause = " WHERE a.status = 'ATIVO' ";
            
            if ($year) {
                $whereClause .= " AND YEAR(a.data_casamento) = :year ";
                $params[':year'] = $year;
            }
            
            if ($month) {
                $whereClause .= " AND MONTH(a.data_casamento) = :month ";
                $params[':month'] = $month;
            }
            
            // Total de agendamentos
            $sql = "SELECT COUNT(*) as total FROM agendamentos a " . $whereClause;
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $totalAgendamentos = $stmt->fetchColumn();
            
            // Agendamentos por local
            $sql = "SELECT 
                        l.nome_local,
                        COUNT(*) as total
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    {$whereClause}
                    GROUP BY a.local_id
                    ORDER BY total DESC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $porLocal = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Agendamentos por celebrante
            $sql = "SELECT 
                        pd.nome_completo as celebrante,
                        pd.tipo,
                        COUNT(*) as total
                    FROM agendamentos a
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    {$whereClause}
                    GROUP BY a.padre_diacono_id
                    ORDER BY total DESC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $porCelebrante = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Agendamentos por dia da semana
            $sql = "SELECT 
                        DAYNAME(a.data_casamento) as dia_semana,
                        DAYOFWEEK(a.data_casamento) as dia_numero,
                        COUNT(*) as total
                    FROM agendamentos a
                    {$whereClause}
                    GROUP BY DAYOFWEEK(a.data_casamento)
                    ORDER BY dia_numero";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $porDiaSemana = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Horários mais populares
            $sql = "SELECT 
                        a.horario_casamento,
                        COUNT(*) as total
                    FROM agendamentos a
                    {$whereClause}
                    GROUP BY a.horario_casamento
                    ORDER BY total DESC
                    LIMIT 10";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $horariosMaisPopulares = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Com efeito civil
            $sql = "SELECT 
                        SUM(CASE WHEN a.com_efeito_civil = 1 THEN 1 ELSE 0 END) as com_efeito_civil,
                        SUM(CASE WHEN a.com_efeito_civil = 0 THEN 1 ELSE 0 END) as sem_efeito_civil
                    FROM agendamentos a
                    {$whereClause}";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $efeitoCivil = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Transferências
            $sql = "SELECT 
                        a.transferencia_tipo,
                        COUNT(*) as total
                    FROM agendamentos a
                    {$whereClause}
                    AND a.transferencia_tipo != 'NAO'
                    GROUP BY a.transferencia_tipo";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $transferencias = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'statistics' => [
                    'total_agendamentos' => (int)$totalAgendamentos,
                    'por_local' => $porLocal,
                    'por_celebrante' => $porCelebrante,
                    'por_dia_semana' => $this->traduzirDiasSemana($porDiaSemana),
                    'horarios_populares' => $horariosMaisPopulares,
                    'efeito_civil' => $efeitoCivil,
                    'transferencias' => $transferencias,
                    'periodo' => $this->getPeriodDescription($year, $month)
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar estatísticas: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca próximos agendamentos
     */
    public function buscarProximosAgendamentos($limite = 10) {
        try {
            $sql = "SELECT 
                        a.id,
                        a.nome_noiva,
                        a.nome_noivo,
                        a.data_casamento,
                        a.horario_casamento,
                        l.nome_local,
                        pd.nome_completo as celebrante,
                        a.whatsapp_noiva,
                        a.whatsapp_noivo,
                        DATEDIFF(a.data_casamento, CURDATE()) as dias_restantes
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    WHERE a.data_casamento >= CURDATE()
                    AND a.status = 'ATIVO'
                    ORDER BY a.data_casamento ASC, a.horario_casamento ASC
                    LIMIT :limite";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
            $stmt->execute();
            
            $agendamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'appointments' => $this->processarAgendamentos($agendamentos)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar próximos agendamentos: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca agendamentos para proclames
     */
    public function buscarProclames($domingo) {
        try {
            $sql = "SELECT 
                        a.id,
                        a.nome_noiva,
                        a.nome_noivo,
                        a.data_casamento,
                        a.horario_casamento,
                        l.nome_local,
                        pd.nome_completo as celebrante,
                        CASE 
                            WHEN p.primeiro_domingo = :domingo THEN 'PRIMEIRO'
                            WHEN p.segundo_domingo = :domingo2 THEN 'SEGUNDO'
                            WHEN p.terceiro_domingo = :domingo3 THEN 'TERCEIRO'
                        END as proclame_numero
                    FROM agendamentos a
                    INNER JOIN locais_cerimonias l ON a.local_id = l.id
                    INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                    INNER JOIN proclames p ON a.id = p.agendamento_id
                    WHERE (p.primeiro_domingo = :domingo4
                        OR p.segundo_domingo = :domingo5
                        OR p.terceiro_domingo = :domingo6)
                    AND a.status = 'ATIVO'
                    ORDER BY proclame_numero, a.nome_noiva";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':domingo' => $domingo,
                ':domingo2' => $domingo,
                ':domingo3' => $domingo,
                ':domingo4' => $domingo,
                ':domingo5' => $domingo,
                ':domingo6' => $domingo
            ]);
            
            $proclames = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'proclames' => $proclames,
                'date' => $domingo,
                'total' => count($proclames)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar proclames: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Processa os agendamentos para retorno
     */
    private function processarAgendamentos($agendamentos) {
        $processados = [];
        
        foreach ($agendamentos as $agendamento) {
            $processados[] = $this->processarAgendamentoUnico($agendamento);
        }
        
        return $processados;
    }
    
    /**
     * Processa um único agendamento
     */
    private function processarAgendamentoUnico($agendamento) {
        // Formata datas
        if (isset($agendamento['data_casamento'])) {
            $agendamento['data_casamento_formatada'] = date('d/m/Y', strtotime($agendamento['data_casamento']));
        }
        
        if (isset($agendamento['data_entrevista']) && $agendamento['data_entrevista']) {
            $agendamento['data_entrevista_formatada'] = date('d/m/Y', strtotime($agendamento['data_entrevista']));
        }
        
        if (isset($agendamento['horario_casamento'])) {
            $agendamento['horario_casamento_formatado'] = substr($agendamento['horario_casamento'], 0, 5);
        }
        
        // Formata telefones
        if (isset($agendamento['whatsapp_noiva'])) {
            $agendamento['whatsapp_noiva_formatado'] = $this->formatarTelefone($agendamento['whatsapp_noiva']);
        }
        
        if (isset($agendamento['whatsapp_noivo'])) {
            $agendamento['whatsapp_noivo_formatado'] = $this->formatarTelefone($agendamento['whatsapp_noivo']);
        }
        
        // Formata tipo de transferência
        if (isset($agendamento['transferencia_tipo'])) {
            $agendamento['transferencia_descricao'] = $this->getDescricaoTransferencia($agendamento['transferencia_tipo']);
        }
        
        // Adiciona informações calculadas
        if (isset($agendamento['data_casamento'])) {
            $dataCasamento = new DateTime($agendamento['data_casamento']);
            $hoje = new DateTime();
            $hoje->setTime(0, 0, 0);
            
            if ($dataCasamento >= $hoje) {
                $diff = $hoje->diff($dataCasamento);
                $agendamento['dias_restantes'] = $diff->days;
                $agendamento['status_tempo'] = 'FUTURO';
            } else {
                $agendamento['dias_restantes'] = 0;
                $agendamento['status_tempo'] = 'PASSADO';
            }
        }
        
        return $agendamento;
    }
    
    /**
     * Busca lembretes de um agendamento
     */
    private function buscarLembretes($agendamentoId) {
        $sql = "SELECT * FROM lembretes 
                WHERE agendamento_id = :id 
                ORDER BY data_lembrete ASC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $agendamentoId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Busca histórico de um agendamento
     */
    private function buscarHistorico($agendamentoId) {
        $sql = "SELECT * FROM log_atividades 
                WHERE agendamento_id = :id 
                ORDER BY created_at DESC 
                LIMIT 20";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $agendamentoId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Obtém descrição do período
     */
    private function getPeriodDescription($year, $month = null, $day = null) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março',
            4 => 'Abril', 5 => 'Maio', 6 => 'Junho',
            7 => 'Julho', 8 => 'Agosto', 9 => 'Setembro',
            10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        
        if ($day && $month) {
            return sprintf("%02d de %s de %d", $day, $meses[$month], $year);
        } elseif ($month) {
            return sprintf("%s de %d", $meses[$month], $year);
        } else {
            return "Ano de $year";
        }
    }
    
    /**
     * Traduz dias da semana
     */
    private function traduzirDiasSemana($dias) {
        $traducao = [
            'Sunday' => 'Domingo',
            'Monday' => 'Segunda-feira',
            'Tuesday' => 'Terça-feira',
            'Wednesday' => 'Quarta-feira',
            'Thursday' => 'Quinta-feira',
            'Friday' => 'Sexta-feira',
            'Saturday' => 'Sábado'
        ];
        
        foreach ($dias as &$dia) {
            if (isset($traducao[$dia['dia_semana']])) {
                $dia['dia_semana_pt'] = $traducao[$dia['dia_semana']];
            }
        }
        
        return $dias;
    }
    
    /**
     * Formata telefone para exibição
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
     * Obtém descrição do tipo de transferência
     */
    private function getDescricaoTransferencia($tipo) {
        $descricoes = [
            'NAO' => 'Sem transferência',
            'ENTRADA_PAROQUIA' => 'Vem de outra paróquia',
            'SAIDA_PAROQUIA' => 'Irá para outra paróquia',
            'ENTRADA_DIOCESE' => 'Vem de outra diocese',
            'SAIDA_DIOCESE' => 'Irá para outra diocese'
        ];
        
        return $descricoes[$tipo] ?? $tipo;
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
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $busca = new AgendamentoBusca();
    
    // Determina o tipo de busca
    $action = $_GET['action'] ?? 'calendar';
    
    switch ($action) {
        case 'calendar':
            // Busca para o calendário
            $year = isset($_GET['year']) ? intval($_GET['year']) : date('Y');
            $month = isset($_GET['month']) ? intval($_GET['month']) : null;
            $day = isset($_GET['day']) ? intval($_GET['day']) : null;
            
            $resultado = $busca->buscarAgendamentos($year, $month, $day);
            break;
            
        case 'byId':
            // Busca por ID
            $id = $_GET['id'] ?? null;
            if (!$id) {
                $resultado = ['success' => false, 'message' => 'ID não fornecido'];
            } else {
                $resultado = $busca->buscarAgendamentoPorId($id);
            }
            break;
            
        case 'availability':
            // Verifica disponibilidade
            $data = $_GET['date'] ?? null;
            $horario = $_GET['time'] ?? null;
            $localId = $_GET['location_id'] ?? null;
            
            if (!$data || !$horario || !$localId) {
                $resultado = ['success' => false, 'message' => 'Parâmetros incompletos'];
            } else {
                $resultado = $busca->verificarDisponibilidade($data, $horario, $localId);
            }
            break;
            
        case 'statistics':
            // Busca estatísticas
            $year = isset($_GET['year']) ? intval($_GET['year']) : date('Y');
            $month = isset($_GET['month']) ? intval($_GET['month']) : null;
            
            $resultado = $busca->buscarEstatisticas($year, $month);
            break;
            
        case 'upcoming':
            // Próximos agendamentos
            $limite = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
            $resultado = $busca->buscarProximosAgendamentos($limite);
            break;
            
        case 'proclames':
            // Busca proclames de um domingo
            $domingo = $_GET['sunday'] ?? null;
            if (!$domingo) {
                $resultado = ['success' => false, 'message' => 'Data do domingo não fornecida'];
            } else {
                $resultado = $busca->buscarProclames($domingo);
            }
            break;
            
        default:
            $resultado = ['success' => false, 'message' => 'Ação inválida'];
    }
    
    // Retorna resposta JSON
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido'
    ]);
}
?>
