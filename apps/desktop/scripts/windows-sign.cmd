@echo off
setlocal DisableDelayedExpansion
set "signTool=%NOMIX_DESKTOP_WINDOWS_SIGNTOOL%"
set "certificateFile=%NOMIX_DESKTOP_WINDOWS_CER_FILE%"
set "tokenPin=%NOMIX_DESKTOP_WINDOWS_TOKEN_PIN%"
set "keyContainer=%NOMIX_DESKTOP_WINDOWS_KEY_CONTAINER%"
set "targetFile=%NOMIX_DESKTOP_WINDOWS_SIGN_TARGET%"
set "appendSignature="
if "%NOMIX_DESKTOP_WINDOWS_SIGN_APPEND%"=="1" set "appendSignature=/as"
set "NOMIX_DESKTOP_WINDOWS_SIGNTOOL="
set "NOMIX_DESKTOP_WINDOWS_CER_FILE="
set "NOMIX_DESKTOP_WINDOWS_TOKEN_PIN="
set "NOMIX_DESKTOP_WINDOWS_KEY_CONTAINER="
set "NOMIX_DESKTOP_WINDOWS_SIGN_TARGET="
set "NOMIX_DESKTOP_WINDOWS_SIGN_APPEND="
set "signTool=" & set "certificateFile=" & set "tokenPin=" & set "keyContainer=" & set "targetFile=" & set "appendSignature=" & "%signTool%" sign /v /fd sha256 /f "%certificateFile%" /kc "[{{%tokenPin%}}]=%keyContainer%" /csp "eToken Base Cryptographic Provider" %appendSignature% "%targetFile%"
exit /b %errorlevel%
