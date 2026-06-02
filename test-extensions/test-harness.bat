@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "TEST_EXTENSIONS_DIR=%SCRIPT_DIR%"
set "VSCODE_EXTENSIONS_DIR=%USERPROFILE%\.vscode\extensions"

echo.
echo AuditExt Testing Harness
echo ==========================================
echo.

if not exist "%VSCODE_EXTENSIONS_DIR%" goto :no_vscode
goto :have_vscode

:no_vscode
echo Error: VS Code extensions directory not found at %VSCODE_EXTENSIONS_DIR%
exit /b 1

:have_vscode
echo [OK] VS Code extensions directory found
echo      Location: %VSCODE_EXTENSIONS_DIR%
echo.

set "command=%~1"
if "%command%"=="" set "command=menu"

if /i "%command%"=="install-all" goto :install_all
if /i "%command%"=="remove-all"  goto :remove_all
if /i "%command%"=="list"        goto :list_cmd
goto :show_help

:install_all
echo Installing all test extensions...
if not exist "%TEST_EXTENSIONS_DIR%\malicious-mock" goto :skip_malicious
echo Installing: malicious-mock
xcopy "%TEST_EXTENSIONS_DIR%\malicious-mock" "%VSCODE_EXTENSIONS_DIR%\auditex-test-malicious-mock" /E /I /Y /Q >nul
if errorlevel 1 goto :install_malicious_failed
echo [OK] Installed: malicious-mock
goto :skip_malicious
:install_malicious_failed
echo [FAIL] Could not install malicious-mock (xcopy error %errorlevel%)
:skip_malicious
if not exist "%TEST_EXTENSIONS_DIR%\clean-mock" goto :skip_clean
echo Installing: clean-mock
xcopy "%TEST_EXTENSIONS_DIR%\clean-mock" "%VSCODE_EXTENSIONS_DIR%\auditex-test-clean-mock" /E /I /Y /Q >nul
if errorlevel 1 goto :install_clean_failed
echo [OK] Installed: clean-mock
goto :skip_clean
:install_clean_failed
echo [FAIL] Could not install clean-mock (xcopy error %errorlevel%)
:skip_clean
echo.
echo All test extensions installed!
echo.
echo Next steps:
echo   1. Open VS Code
echo   2. Press F5 to debug AuditExt
echo   3. Command Palette (Ctrl+Shift+P) - AuditExt: Check Integrity
echo   4. You should see the test extensions in the report
goto :eof

:remove_all
echo Removing all test extensions...
if exist "%VSCODE_EXTENSIONS_DIR%\auditex-test-malicious-mock" goto :rm_malicious
goto :skip_rm_malicious
:rm_malicious
rmdir /s /q "%VSCODE_EXTENSIONS_DIR%\auditex-test-malicious-mock"
echo [OK] Removed: malicious-mock
:skip_rm_malicious
if exist "%VSCODE_EXTENSIONS_DIR%\auditex-test-clean-mock" goto :rm_clean
goto :skip_rm_clean
:rm_clean
rmdir /s /q "%VSCODE_EXTENSIONS_DIR%\auditex-test-clean-mock"
echo [OK] Removed: clean-mock
:skip_rm_clean
echo All test extensions removed!
goto :eof

:list_cmd
echo Available test extensions:
echo   - malicious-mock: Contains suspicious code patterns
echo   - clean-mock: Safe extension that follows best practices
echo.
echo Installed test extensions:
dir "%VSCODE_EXTENSIONS_DIR%\auditex-test-*" /b 2>nul
if errorlevel 1 echo   (none)
goto :eof

:show_help
echo Usage: test-harness.bat [command]
echo.
echo Commands:
echo   install-all  - Install all mock test extensions
echo   remove-all   - Remove all mock test extensions
echo   list         - List available and installed test extensions
echo   help, menu   - Show this help message
echo.
echo Testing Workflow:
echo   1. Run: test-harness.bat install-all
echo   2. Open VS Code
echo   3. Press F5 to debug AuditExt
echo   4. Command Palette (Ctrl+Shift+P) - AuditExt: Check Integrity
echo   5. Run: test-harness.bat remove-all
echo.
goto :eof
