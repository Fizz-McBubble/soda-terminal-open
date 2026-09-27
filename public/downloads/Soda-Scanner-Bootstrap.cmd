@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ORIGIN=__SODA_PUBLIC_ORIGIN__"
if "%ORIGIN%"=="__SODA_PUBLIC_ORIGIN__" (
  echo Scanner installer has no public HTTPS origin. Installation stopped.
  exit /b 2
)
set "WORK=%TEMP%\Soda-Scanner-Bootstrap-%RANDOM%-%RANDOM%"
mkdir "%WORK%" >nul 2>nul
if errorlevel 1 exit /b 1
set "SODA_BOOTSTRAP=%WORK%\scanner-runtime-bootstrap.ps1"
set "SODA_POINTER=%WORK%\scanner-runtime-pointer-store.ps1"
set "SODA_MANIFEST=%WORK%\scanner-runtime-release.v1.json"
set "SODA_ORIGIN=%ORIGIN%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $origin=[Uri]$env:SODA_ORIGIN; if($origin.Scheme -cne 'https' -or -not $origin.IsDefaultPort -or $origin.AbsolutePath -cne '/' -or $origin.UserInfo -ne '' -or $origin.Query -ne '' -or $origin.Fragment -ne '' -or $env:SODA_ORIGIN -cne $origin.GetLeftPart([UriPartial]::Authority)){throw 'scanner_public_origin_invalid'}; $items=@(@('scanner-runtime-bootstrap.ps1',$env:SODA_BOOTSTRAP,'__SODA_BOOTSTRAP_SHA256__'),@('scanner-runtime-pointer-store.ps1',$env:SODA_POINTER,'__SODA_POINTER_SHA256__'),@('scanner-runtime-release.v1.json',$env:SODA_MANIFEST,'__SODA_MANIFEST_SHA256__')); foreach($item in $items){$uri=$env:SODA_ORIGIN+'/downloads/'+$item[0]; $request=@{Uri=$uri;OutFile=$item[1];UseBasicParsing=$true;MaximumRedirection=0;ErrorAction='Stop'}; Invoke-WebRequest @request | Out-Null; if((Get-FileHash -LiteralPath $item[1] -Algorithm SHA256).Hash.ToLowerInvariant() -cne $item[2]){throw 'scanner_bootstrap_hash_mismatch'}}; $install=@{ManifestPath=$env:SODA_MANIFEST;PublicOrigin=$env:SODA_ORIGIN}; if($env:SODA_SCANNER_TEST_MODE -eq '1' -and $env:SODA_SCANNER_TEST_INSTALL_ROOT){$install.InstallRoot=$env:SODA_SCANNER_TEST_INSTALL_ROOT}; & $env:SODA_BOOTSTRAP @install"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo Scanner installer download, SHA256 verification, or installation failed.
del /q "%SODA_BOOTSTRAP%" "%SODA_POINTER%" "%SODA_MANIFEST%" >nul 2>nul
rmdir "%WORK%" >nul 2>nul
exit /b %RESULT%
