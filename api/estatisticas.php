<?php
/**
 * API para Estatísticas do Sistema
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $db = getDB();
    
    // Total de agendamentos
    $sql = "SELECT COUNT(*) FROM agendamentos WHERE status = 'ATIVO'";
    $totalAgendamentos = $db->query($sql)->fetchColumn();
    
    // Agendamentos futuros
    $sql = "SELECT COUNT(*) FROM agendamentos 
            WHERE status = 'ATIVO' AND data_casamento >= CURDATE()";
    $agendamentosFuturos = $db->query($sql)->fetchColumn();
    
    // Total de casais
    $sql = "SELECT COUNT(*) FROM agendamentos WHERE status IN ('ATIVO', 'REALIZADO')";
    $totalCasais = $db->query($sql)->fetchColumn();
    
    // Taxa de ocupação (casamentos este mês / dias úteis)
    $sql = "SELECT COUNT(*) FROM agendamentos 
            WHERE YEAR(data_casamento) = YEAR(CURDATE()) 
            AND MONTH(data_casamento) = MONTH(CURDATE())
            AND status = 'ATIVO'";
    $casamentosMes = $db->query($sql)->fetchColumn();
    $diasUteisMes = 22; // Aproximado
    $taxaOcupacao = round(($casamentosMes / $diasUteisMes) * 100, 1);
    
    echo json_encode([
        'success' => true,
        'statistics' => [
            'total_agendamentos' => (int)$totalAgendamentos,
            'agendamentos_futuros' => (int)$agendamentosFuturos,
            'total_casais' => (int)$totalCasais,
            'taxa_ocupacao' => $taxaOcupacao
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar estatísticas: ' . $e->getMessage()
    ]);
}
?>
