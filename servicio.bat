@echo off
setlocal enabledelayedexpansion
title Estaca Este - Servicio Local (Puerto 8095)

REM Asegurar que estamos en la carpeta del proyecto
cd /d "%~dp0"

cls
echo ================================================================
echo           ESTACA ESTE - INICIANDO SERVICIO LOCAL
echo ================================================================
echo.

REM 1. Limpieza preventiva: si el puerto 8095 ya estaba ocupado, liberarlo
echo [1/3] Verificando puerto 8095...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8095" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 > nul

REM 2. Iniciar el servidor en segundo plano
echo [2/3] Levantando servidor local en http://localhost:8095/...
start /b "" node server.mjs > "%TEMP%\estaca_servicio.log" 2>&1

REM 3. Comprobar que el servicio este activo antes de abrir el navegador
echo [3/3] Esperando confirmacion del servicio...
set "ACTIVO=0"
for /L %%i in (1,1,20) do (
    if !ACTIVO! equ 0 (
        netstat -aon | findstr ":8095" | findstr "LISTENING" >nul 2>&1
        if !errorlevel! equ 0 (
            set "ACTIVO=1"
        ) else (
            <nul set /p=". "
            ping 127.0.0.1 -n 2 > nul
        )
    )
)

echo.
if !ACTIVO! equ 0 (
    echo [ERROR] No se pudo confirmar el inicio del servicio en el puerto 8095.
    echo Registro del error:
    echo ----------------------------------------------------
    if exist "%TEMP%\estaca_servicio.log" type "%TEMP%\estaca_servicio.log"
    echo ----------------------------------------------------
    pause
    goto DETENER_Y_SALIR
)

REM 4. Servicio confirmado: abrir automaticamente el navegador predeterminado
echo [OK] Servicio confirmado y activo en http://localhost:8095/
echo [i] Abriendo navegador predeterminado...
start http://localhost:8095/
ping 127.0.0.1 -n 2 > nul

:PANEL_ACTIVO
cls
REM Obtener el PID actual en escucha
set "PID_ACTIVO="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8095" ^| findstr "LISTENING"') do (
    set "PID_ACTIVO=%%a"
)

echo ================================================================
echo           ESTACA ESTE - SERVICIO EN LINEA (ACTIVO)
echo ================================================================
echo.
echo   Estado : [ EN LINEA ]
echo   Puerto : 8095  (PID: !PID_ACTIVO!)
echo   Web    : http://localhost:8095/
echo.
echo   --------------------------------------------------------------
echo   * Esta ventana mantiene el servicio en ejecucion.
echo   * NO la cierre mientras necesite usar la aplicacion.
echo   --------------------------------------------------------------
echo.
echo   Acciones disponibles:
echo     [1] Volver a abrir la aplicacion en el navegador
echo     [2] DETENER servicio y Salir
echo.
echo ================================================================

choice /c 12 /n /m "Seleccione una opcion [1 o 2]: "
if errorlevel 2 goto DETENER_Y_SALIR
if errorlevel 1 goto ABRIR_WEB
goto PANEL_ACTIVO

:ABRIR_WEB
echo.
echo [i] Abriendo http://localhost:8095/...
start http://localhost:8095/
ping 127.0.0.1 -n 2 > nul
goto PANEL_ACTIVO

:DETENER_Y_SALIR
cls
echo ================================================================
echo   DETENIENDO SERVICIO ESTACA ESTE Y LIBERANDO PUERTO 8095
echo ================================================================
echo.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8095" ^| findstr "LISTENING"') do (
    echo [i] Finalizando proceso con PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 > nul
echo.
echo [OK] El servicio ha sido dado de baja y el puerto 8095 esta libre.
echo Hasta la proxima.
ping 127.0.0.1 -n 2 > nul
exit /b 0
