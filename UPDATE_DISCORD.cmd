@echo off
setlocal
chcp 65001 >nul

echo ===================================================
echo   BetterDiscord vac34 plugins - Updater
echo ===================================================
echo.

set "DEST=%APPDATA%\BetterDiscord\plugins"
set "SRC_DIR=%~dp0"
set "SRC=%SRC_DIR%MediaFilter.plugin.js"

if not exist "%DEST%" (
    echo [ERROR] Папка BetterDiscord не найдена:
    echo   "%DEST%"
    echo Убедитесь, что BetterDiscord установлен.
    echo.
    pause
    exit /b 1
)

if not exist "%SRC%" (
    echo [ERROR] Исходный файл плагина не найден:
    echo   "%SRC%"
    echo.
    pause
    exit /b 1
)

echo Копирование MediaFilter.plugin.js в рабочую папку Discord...
copy /Y "%SRC%" "%DEST%\MediaFilter.plugin.js" >nul

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Не удалось скопировать файл.
    pause
    exit /b 1
)

echo.
echo [OK] MediaFilter.plugin.js успешно обновлен!
echo Путь назначения: "%DEST%\MediaFilter.plugin.js"
echo.
echo Теперь в Discord нажмите Ctrl + R (перезагрузка интерфейса),
echo чтобы BetterDiscord применил обновленную версию.
echo.
pause
