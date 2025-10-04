<?php
/**
 * API para Criar Backup do Banco de Dados
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $db = getDB();
    
    // Cria diretório de backups se não existir
    $backupDir = '../backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $filename = 'backup_' . date('Y-m-d_His') . '.sql';
    $filepath = $backupDir . '/' . $filename;
    
    // Configurações do banco
    $host = 'phmpsj_mysql-phm-app';
    $database = 'db-phm-app';
    $user = 'userphm';
    $password = 'twU7oGKjs9M33fox76Fr9AnLBFgppTMb3MeWif37Zo8cXw55QYKqcZrV8k24pset';
    
    // Comando mysqldump
    $command = "mysqldump -h {$host} -u {$user} -p{$password} {$database} > {$filepath}";
    exec($command, $output, $result);
    
    if ($result !== 0 || !file_exists($filepath)) {
        throw new Exception('Erro ao criar backup');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Backup criado com sucesso',
        'filename' => $filename,
        'download_url' => 'api/download-backup.php?file=' . $filename
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao criar backup: ' . $e->getMessage()
    ]);
}
?>
