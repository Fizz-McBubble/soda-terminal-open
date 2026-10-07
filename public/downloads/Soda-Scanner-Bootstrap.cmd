@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Soda Terminal 扫描助手
set "RESULT=0"
echo Soda Terminal 扫描助手
echo 首次运行会自动下载并准备本机组件，无需另外寻找安装程序。
echo 下载可能需要几分钟，请保持此窗口打开，完成后返回网页连接。
echo.
set "ORIGIN=__SODA_PUBLIC_ORIGIN__"
if not "%ORIGIN:~0,8%"=="https://" (
  echo Scanner installer has no public HTTPS origin. Installation stopped.
  set "RESULT=2"
  goto finish
)
set "WORK=%TEMP%\Soda-Scanner-Bootstrap-%RANDOM%-%RANDOM%"
mkdir "%WORK%" >nul 2>nul
if errorlevel 1 (
  echo 无法创建临时工作目录，请检查磁盘空间和当前用户的目录权限。
  set "RESULT=1"
  goto finish
)
set "SODA_BOOTSTRAP=%WORK%\scanner-runtime-bootstrap.ps1"
set "SODA_POINTER=%WORK%\scanner-runtime-pointer-store.ps1"
set "SODA_MANIFEST=%WORK%\scanner-runtime-release.v1.json"
set "SODA_ORIGIN=%ORIGIN%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $origin=[Uri]$env:SODA_ORIGIN; if($origin.Scheme -cne 'https' -or -not $origin.IsDefaultPort -or $origin.AbsolutePath -cne '/' -or $origin.UserInfo -ne '' -or $origin.Query -ne '' -or $origin.Fragment -ne '' -or $env:SODA_ORIGIN -cne $origin.GetLeftPart([UriPartial]::Authority)){throw 'scanner_public_origin_invalid'}; $items=@(@('scanner-runtime-bootstrap.ps1',$env:SODA_BOOTSTRAP,'__SODA_BOOTSTRAP_SHA256__'),@('scanner-runtime-pointer-store.ps1',$env:SODA_POINTER,'__SODA_POINTER_SHA256__'),@('scanner-runtime-release.v1.json',$env:SODA_MANIFEST,'__SODA_MANIFEST_SHA256__')); foreach($item in $items){$uri=$env:SODA_ORIGIN+'/downloads/'+$item[0]; $request=@{Uri=$uri;OutFile=$item[1];UseBasicParsing=$true;MaximumRedirection=0;ErrorAction='Stop'}; Invoke-WebRequest @request | Out-Null; $sha=[System.Security.Cryptography.SHA256]::Create(); try{$digest=[BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($item[1]))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}; if($digest -cne $item[2]){throw 'scanner_bootstrap_hash_mismatch'}}; $install=@{ManifestPath=$env:SODA_MANIFEST;PublicOrigin=$env:SODA_ORIGIN}; if($env:SODA_SCANNER_TEST_MODE -eq '1' -and $env:SODA_SCANNER_TEST_INSTALL_ROOT){$install.InstallRoot=$env:SODA_SCANNER_TEST_INSTALL_ROOT}; & $env:SODA_BOOTSTRAP @install"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo Scanner installer download, SHA256 verification, or installation failed.
del /q "%SODA_BOOTSTRAP%" "%SODA_POINTER%" "%SODA_MANIFEST%" >nul 2>nul
rmdir "%WORK%" >nul 2>nul
:finish
echo.
if "%RESULT%"=="0" (
  echo 扫描助手已准备完成。请返回网页，点击“连接扫描助手”。
) else (
  echo 扫描助手准备未完成，退出码：%RESULT%。
  echo 请保留上方错误信息并截图反馈；仅允许网页权限不能完成本机组件准备。
)
if not "%SODA_SCANNER_TEST_MODE%"=="1" (
  echo 按任意键关闭此窗口。
  pause >nul
)
exit /b %RESULT%
