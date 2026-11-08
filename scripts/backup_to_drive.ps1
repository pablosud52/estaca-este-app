# Backup script: Syncs local development folder to Google Drive excluding node_modules, build output, etc.
$source = "C:\Proyectos\Estaca_App"
$destination = "G:\Mi unidad\GitHub\Estaca_App"

Write-Host "Iniciando respaldo hacia Google Drive..."
Write-Host "Origen:  $source"
Write-Host "Destino: $destination"

$excludeDirs = @("node_modules", "dist", ".cache", ".next", ".turbo")

# Robocopy options:
# /MIR: Mirror directory tree (includes subdirectories, even empty ones, and purges destination files not in source)
# /XD: Exclude directories
# /R:1 /W:1: Retry 1 time, wait 1 sec on locked files
# /NFL /NDL: Do not log file names and directory names (keep console clean)
# /NP: No progress percentage
& robocopy $source $destination /MIR /XD $excludeDirs /R:1 /W:1 /NFL /NDL /NP

$exitCode = $LASTEXITCODE
# Robocopy exit codes 0-7 mean success/files copied
if ($exitCode -le 7) {
    Write-Host "Respaldo en Google Drive completado con exito. (Robocopy Code: $exitCode)" -ForegroundColor Green
} else {
    Write-Host "Advertencia o error en Robocopy: $exitCode" -ForegroundColor Yellow
}
