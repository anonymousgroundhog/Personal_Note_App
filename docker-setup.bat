@echo off
REM Generates docker-compose.override.yml with hardcoded host paths, then starts Docker.

REM Detect Android SDK
SET SDK=%LOCALAPPDATA%\Android\Sdk
IF NOT EXIST "%SDK%" SET SDK=%USERPROFILE%\AppData\Local\Android\Sdk
IF NOT EXIST "%SDK%" (
  echo Warning: Android SDK not found. APK analysis may not work.
  SET SDK=%USERPROFILE%\Android\Sdk
)

REM Detect notes directory
SET NOTES=%USERPROFILE%\Notes
IF NOT EXIST "%NOTES%" (
  SET NOTES=%USERPROFILE%\Documents\Notes
  mkdir "%NOTES%" 2>NUL
)

REM Convert backslashes to forward slashes for Docker volume syntax
SET HOME_FWD=%USERPROFILE:\=/%
SET NOTES_FWD=%NOTES:\=/%
SET SDK_FWD=%SDK:\=/%

echo Host paths:
echo   HOME:        %HOME_FWD%
echo   Notes:       %NOTES_FWD%
echo   Android SDK: %SDK_FWD%
echo.

REM Write override file with literal paths
(
  echo services:
  echo   app:
  echo     volumes:
  echo       - %HOME_FWD%:/root/host-home
  echo       - %NOTES_FWD%:/root/Notes
  echo       - %SDK_FWD%/platforms:/root/Android/Sdk/platforms
) > docker-compose.override.yml

echo Generated docker-compose.override.yml:
type docker-compose.override.yml
echo.
echo Starting Docker...
docker compose up --build
