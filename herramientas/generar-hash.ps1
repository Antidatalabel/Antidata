# Genera los secretos del admin de noticias (ver README).
#   ADMIN_PASSWORD_HASH: hash PBKDF2-SHA256 de la contraseña, con sal aleatoria
#   SESSION_SECRET:      clave aleatoria para firmar las sesiones
# Uso: clic derecho > "Ejecutar con PowerShell", o en una terminal:
#   powershell -ExecutionPolicy Bypass -File herramientas\generar-hash.ps1
# La contraseña no se guarda en ningún lado ni se envía a ninguna parte.

param([string]$Clave)

$iteraciones = 100000   # máximo que admite Cloudflare Workers

if (-not $Clave) {
    $segura = Read-Host -AsSecureString "Nueva contraseña del admin"
    $repetida = Read-Host -AsSecureString "Repítela"
    $Clave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))
    $Clave2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($repetida))
    if ($Clave -ne $Clave2) { Write-Host "Las contraseñas no coinciden." -ForegroundColor Red; exit 1 }
}
if ($Clave.Length -lt 12) { Write-Host "Usa al menos 12 caracteres." -ForegroundColor Red; exit 1 }

$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$sal = New-Object byte[] 16
$rng.GetBytes($sal)
$pbkdf2 = New-Object Security.Cryptography.Rfc2898DeriveBytes($Clave, $sal, $iteraciones, [Security.Cryptography.HashAlgorithmName]::SHA256)
$hash = $pbkdf2.GetBytes(32)
$secreto = New-Object byte[] 48
$rng.GetBytes($secreto)

Write-Host ""
Write-Host "ADMIN_PASSWORD_HASH =" -ForegroundColor Yellow
Write-Host ("pbkdf2`$" + $iteraciones + "`$" + [Convert]::ToBase64String($sal) + "`$" + [Convert]::ToBase64String($hash))
Write-Host ""
Write-Host "SESSION_SECRET (solo la primera vez, o para cerrar todas las sesiones) =" -ForegroundColor Yellow
Write-Host ([Convert]::ToBase64String($secreto))
Write-Host ""
