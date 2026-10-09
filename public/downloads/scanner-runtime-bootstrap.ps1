[CmdletBinding()]
param(
    [string]$ManifestPath = '',
    [string]$TestAssetPath = '',
    [string]$InstallRoot = '',
    [string]$PublicOrigin = '',
    [ValidateSet('none', 'copy', 'target_health', 'pointer')]
    [string]$FaultInjection = 'none'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'scanner-runtime-pointer-store.ps1')

function Get-SodaRuntimeSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $hasher.Dispose()
        $stream.Dispose()
    }
}

function Read-SodaRuntimeManifest {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "release_manifest_missing:$Path" }
    $manifest = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or [string]::IsNullOrWhiteSpace($manifest.runtimeVersion)) {
        throw 'release_manifest_invalid'
    }
    $pinnedAssets = @(
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.2/soda-scanner-runtime-18-rc8-2-win-x64.zip',
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.3/soda-scanner-runtime-18-rc8-3-win-x64.zip',
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.5/soda-scanner-runtime-18-rc8-5-win-x64.zip'
    )
    $sameOrigin = $manifest.assetUrl -ceq ('/downloads/' + $manifest.assetName)
    $pinnedGitHub = ($manifest.assetUrl -ceq $pinnedAssets[0] -and
        $manifest.assetName -ceq 'soda-scanner-runtime-18-rc8-2-win-x64.zip' -and
        $manifest.releaseTag -ceq 'scanner-runtime-v18.0.0-rc.8.2') -or
        ($manifest.assetUrl -ceq $pinnedAssets[1] -and
        $manifest.assetName -ceq 'soda-scanner-runtime-18-rc8-3-win-x64.zip' -and
        $manifest.releaseTag -ceq 'scanner-runtime-v18.0.0-rc.8.3') -or
        ($manifest.assetUrl -ceq $pinnedAssets[2] -and
        $manifest.assetName -ceq 'soda-scanner-runtime-18-rc8-5-win-x64.zip' -and
        $manifest.releaseTag -ceq 'scanner-runtime-v18.0.0-rc.8.5')
    if ($manifest.assetName -notmatch '^[a-zA-Z0-9._-]+\.zip$' -or
        -not ($sameOrigin -or $pinnedGitHub)) {
        throw 'release_manifest_asset_url_invalid'
    }
    if ($manifest.assetUrl -match '/latest/' -or $manifest.releaseTag -eq 'latest') {
        throw 'release_manifest_mutable_url_forbidden'
    }
    if ($manifest.size -le 0 -or $manifest.sha256 -notmatch '^[a-f0-9]{64}$') {
        throw 'release_manifest_identity_invalid'
    }
    if ($manifest.accountWriteEnabled -ne $false -or $manifest.importAccess -ne $false) {
        throw 'release_manifest_permission_boundary_invalid'
    }
    return $manifest
}

function Assert-SodaRuntimeTrustedDownloadUri {
    param([Parameter(Mandatory = $true)][System.Uri]$Uri)
    $pinnedAssets = @(
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.2/soda-scanner-runtime-18-rc8-2-win-x64.zip',
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.3/soda-scanner-runtime-18-rc8-3-win-x64.zip',
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.5/soda-scanner-runtime-18-rc8-5-win-x64.zip'
    )
    if ($Uri.Scheme -cne 'https' -or -not $Uri.IsDefaultPort -or $Uri.UserInfo -ne '' -or
        $Uri.Fragment -ne '' -or
        ($Uri.Host -cne 'github.com' -and $Uri.Host -cne 'release-assets.githubusercontent.com')) {
        throw 'scanner_asset_redirect_untrusted'
    }
    if ($Uri.Host -ceq 'github.com' -and ($Uri.AbsoluteUri -cnotin $pinnedAssets)) {
        throw 'scanner_asset_redirect_untrusted'
    }
}

function Resolve-SodaRuntimeRedirectUri {
    param([Parameter(Mandatory = $true)][System.Uri]$Current, [Parameter(Mandatory = $true)][string]$Location)
    $next = [System.Uri]::new($Current, $Location)
    Assert-SodaRuntimeTrustedDownloadUri -Uri $next
    return $next
}

function Get-SodaRuntimeDownloadResponse {
    param([Parameter(Mandatory = $true)][System.Uri]$AssetUri, [long]$Offset = 0)

    $uri = $AssetUri
    for ($hop = 0; $hop -le 3; $hop += 1) {
        Assert-SodaRuntimeTrustedDownloadUri -Uri $uri
        $request = [System.Net.HttpWebRequest]::Create($uri)
        $request.AllowAutoRedirect = $false
        $request.UseDefaultCredentials = $false
        $request.Credentials = $null
        $request.PreAuthenticate = $false
        if ($Offset -gt 0) { $request.AddRange($Offset) }
        try { $response = $request.GetResponse() }
        catch [System.Net.WebException] {
            if ($null -eq $_.Exception.Response) { throw }
            $response = $_.Exception.Response
        }
        if ([int]$response.StatusCode -in @(301, 302, 303, 307, 308)) {
            try {
                if ($hop -eq 3 -or [string]::IsNullOrWhiteSpace($response.Headers['Location'])) {
                    throw 'scanner_asset_redirect_limit'
                }
                $uri = Resolve-SodaRuntimeRedirectUri -Current $uri -Location $response.Headers['Location']
            }
            finally { $response.Close() }
            continue
        }
        if ([int]$response.StatusCode -notin @(200, 206)) {
            $response.Close()
            throw 'scanner_asset_http_status_invalid'
        }
        return $response
    }
    throw 'scanner_asset_redirect_limit'
}

function Copy-SodaRuntimeAsset {
    param(
        [Parameter(Mandatory = $true)][object]$Manifest,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string]$TestAssetPath = '',
        [string]$PublicOrigin = ''
    )

    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        $existing = Get-Item -LiteralPath $Destination
        if ($existing.Length -eq $Manifest.size -and (Get-SodaRuntimeSha256 $Destination) -eq $Manifest.sha256) {
            return
        }
        [System.IO.File]::Delete($Destination)
    }

    $partial = "$Destination.download"
    if (-not [string]::IsNullOrWhiteSpace($TestAssetPath)) {
        if ($env:SODA_SCANNER_TEST_MODE -ne '1') { throw 'test_asset_override_forbidden' }
        [System.IO.File]::Copy($TestAssetPath, $partial, $true)
    }
    else {
        $origin = $null
        if (-not [System.Uri]::TryCreate($PublicOrigin, [System.UriKind]::Absolute, [ref]$origin) -or
            $origin.Scheme -cne 'https' -or -not $origin.IsDefaultPort -or
            $origin.AbsolutePath -cne '/' -or $origin.Query -ne '' -or $origin.Fragment -ne '' -or
            $origin.UserInfo -ne '' -or $PublicOrigin.TrimEnd('/') -cne $origin.GetLeftPart([System.UriPartial]::Authority)) {
            throw 'scanner_public_origin_invalid'
        }
        $pinnedAssets = @(
            'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.2/soda-scanner-runtime-18-rc8-2-win-x64.zip',
            'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.3/soda-scanner-runtime-18-rc8-3-win-x64.zip',
        'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.5/soda-scanner-runtime-18-rc8-5-win-x64.zip'
        )
        $externalAsset = $pinnedAssets -ccontains $Manifest.assetUrl
        $assetUri = if ($externalAsset) { [System.Uri]::new($Manifest.assetUrl) } else { [System.Uri]::new($origin, $Manifest.assetUrl) }
        if (-not $externalAsset -and $assetUri.GetLeftPart([System.UriPartial]::Authority) -cne $origin.GetLeftPart([System.UriPartial]::Authority)) {
            throw 'scanner_asset_cross_origin'
        }
        $offset = if (Test-Path -LiteralPath $partial -PathType Leaf) { (Get-Item -LiteralPath $partial).Length } else { 0 }
        if ($offset -gt $Manifest.size) { [System.IO.File]::Delete($partial); $offset = 0 }
        if ($externalAsset) {
            $response = Get-SodaRuntimeDownloadResponse -AssetUri $assetUri -Offset $offset
        }
        else {
            $request = [System.Net.HttpWebRequest]::Create($assetUri)
            $request.AllowAutoRedirect = $false
            $request.UseDefaultCredentials = $false
            $request.Credentials = $null
            if ($offset -gt 0) { $request.AddRange($offset) }
            $response = $request.GetResponse()
        }
        try {
            if ($offset -gt 0 -and $response.StatusCode -ne [System.Net.HttpStatusCode]::PartialContent) {
                $response.Close()
                [System.IO.File]::Delete($partial)
                return Copy-SodaRuntimeAsset -Manifest $Manifest -Destination $Destination -PublicOrigin $PublicOrigin
            }
            if ($offset -gt 0 -and $response.Headers['Content-Range'] -notmatch ('^bytes ' + $offset + '-[0-9]+/[0-9]+$')) {
                throw 'runtime_asset_range_mismatch'
            }
            $mode = if ($offset -gt 0) { [System.IO.FileMode]::Append } else { [System.IO.FileMode]::Create }
            $output = [System.IO.File]::Open($partial, $mode, [System.IO.FileAccess]::Write)
            try {
                $input = $response.GetResponseStream()
                try { $input.CopyTo($output) } finally { $input.Dispose() }
            }
            finally { $output.Dispose() }
        }
        finally { $response.Close() }
    }

    $partialInfo = Get-Item -LiteralPath $partial
    if ($partialInfo.Length -ne $Manifest.size) { throw 'runtime_asset_size_mismatch' }
    if ((Get-SodaRuntimeSha256 $partial) -ne $Manifest.sha256) { throw 'runtime_asset_hash_mismatch' }
    [System.IO.File]::Move($partial, $Destination)
}

function Invoke-SodaRuntimeProbe {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Path,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [int]$ExpectedExitCode = 0
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "runtime_health_probe_missing:$Id" }
    $stdout = Join-Path $WorkingDirectory (".health-{0}-{1}.stdout" -f $Id, $PID)
    $stderr = Join-Path $WorkingDirectory (".health-{0}-{1}.stderr" -f $Id, $PID)
    $process = $null
    try {
        $start = @{
            FilePath = $Path
            WorkingDirectory = $WorkingDirectory
            WindowStyle = 'Hidden'
            RedirectStandardOutput = $stdout
            RedirectStandardError = $stderr
            Wait = $true
            PassThru = $true
        }
        if ($Arguments.Count -gt 0) { $start.ArgumentList = $Arguments }
        $process = Start-Process @start
        if ($process.ExitCode -ne $ExpectedExitCode) { throw "runtime_health_probe_failed:$Id" }
    }
    finally {
        if ($null -ne $process) { $process.Dispose() }
        [IO.File]::Delete($stdout)
        [IO.File]::Delete($stderr)
    }
}

function Remove-SodaRuntimeTree {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return }
    for ($attempt = 1; $attempt -le 5; $attempt += 1) {
        try {
            [System.IO.Directory]::Delete($Path, $true)
            return
        }
        catch {
            if ($attempt -eq 5) { throw }
            Start-Sleep -Milliseconds 100
        }
    }
}

function Copy-SodaRuntimeTree {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$DestinationRoot,
        [int]$FaultAfterFiles = 0
    )

    $source = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd('\')
    $destination = [System.IO.Path]::GetFullPath($DestinationRoot).TrimEnd('\')
    foreach ($directory in [System.IO.Directory]::GetDirectories($source, '*', [System.IO.SearchOption]::AllDirectories)) {
        $relative = $directory.Substring($source.Length).TrimStart('\')
        [System.IO.Directory]::CreateDirectory((Join-Path $destination $relative)) | Out-Null
    }

    $copied = 0
    foreach ($file in [System.IO.Directory]::GetFiles($source, '*', [System.IO.SearchOption]::AllDirectories)) {
        $relative = $file.Substring($source.Length).TrimStart('\')
        $target = Join-Path $destination $relative
        $targetParent = [System.IO.Path]::GetDirectoryName($target)
        [System.IO.Directory]::CreateDirectory($targetParent) | Out-Null
        [System.IO.File]::Copy($file, $target, $false)
        $copied += 1
        if ($FaultAfterFiles -gt 0 -and $copied -ge $FaultAfterFiles) { throw 'runtime_copy_injected_failure' }
    }
}

function Test-SodaRuntimeHealth {
    param(
        [Parameter(Mandatory = $true)][string]$StageRoot,
        [Parameter(Mandatory = $true)][object]$Manifest
    )

    $runtimePath = Join-Path $StageRoot 'scanner-runtime.json'
    if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'runtime_descriptor_missing' }
    $runtime = Get-Content -LiteralPath $runtimePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $runtimeProperties = @($runtime.PSObject.Properties.Name)
    if ($runtimeProperties -contains 'runtimeVersion') { throw 'runtime_descriptor_legacy_identity_forbidden' }
    if (
        -not ($runtimeProperties -contains 'version') -or
        $runtime.schemaVersion -ne 2 -or
        $runtime.version -ne $Manifest.runtimeVersion -or
        $runtime.capture -ne $Manifest.captureVersion -or
        $runtime.ocr -ne $Manifest.ocrVersion -or
        $runtime.ocrRuntime -ne $Manifest.ocrRuntimeVersion -or
        [string]::IsNullOrWhiteSpace($runtime.orchestration) -or
        [string]::IsNullOrWhiteSpace($Manifest.helperProtocolVersion) -or
        $runtime.accountWriteEnabled -ne $false -or
        $runtime.importAccess -ne $false
    ) {
        throw 'runtime_descriptor_identity_invalid'
    }
    foreach ($entry in @($runtime.entries)) {
        $entryPath = Join-Path $StageRoot $entry.path
        if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw "runtime_entry_missing:$($entry.path)" }
        if ((Get-Item -LiteralPath $entryPath).Length -ne $entry.size) { throw "runtime_entry_size_mismatch:$($entry.path)" }
        if ((Get-SodaRuntimeSha256 $entryPath) -ne $entry.sha256) { throw "runtime_entry_hash_mismatch:$($entry.path)" }
    }
    if ($env:SODA_SCANNER_TEST_MODE -eq '1' -and $runtimeProperties -contains 'healthChecks') {
        $expectedChecks = @('capture', 'ocr', 'orchestration', 'helper')
        $checks = @($runtime.healthChecks)
        if ($checks.Count -ne 4 -or ((@($checks.id) | Sort-Object) -join ',') -ne (($expectedChecks | Sort-Object) -join ',')) {
            throw 'runtime_health_checks_invalid'
        }
        foreach ($check in $checks) {
            $probe = Join-Path $StageRoot $check.path
            Invoke-SodaRuntimeProbe -Id $check.id -Path $probe -Arguments @($check.arguments) -WorkingDirectory $StageRoot
        }
        return
    }

    $capture = Join-Path $StageRoot 'native\ZZZ-Scanner.Next.Soda.exe'
    Invoke-SodaRuntimeProbe -Id 'capture' -Path $capture -Arguments @('--probe-runtime') -WorkingDirectory $StageRoot -ExpectedExitCode 0

    $ocr = Join-Path $StageRoot 'ocr\Soda.ScannerPpOcrV6.exe'
    Invoke-SodaRuntimeProbe -Id 'ocr' -Path $ocr -WorkingDirectory $StageRoot -ExpectedExitCode 2

    Invoke-SodaRuntimeProbe -Id 'orchestration' -Path $capture -Arguments @('--probe-r4-runtime') -WorkingDirectory $StageRoot -ExpectedExitCode 0

    if (
        $runtime.version -ne $Manifest.runtimeVersion -or
        $runtime.capture -ne $Manifest.captureVersion -or
        $runtime.ocr -ne $Manifest.ocrVersion -or
        $runtime.accountWriteEnabled -ne $false -or
        $runtime.importAccess -ne $false
    ) {
        throw 'runtime_health_probe_failed:helper'
    }
}

function Test-SodaPublicOriginConfiguration {
    param([string]$Configuration, [string]$PublicOrigin)
    if ([string]::IsNullOrWhiteSpace($Configuration)) { return $false }
    $origins = @($Configuration.TrimEnd([char[]]"`r`n").Split("`n") | ForEach-Object { $_.TrimEnd("`r") })
    $allowed = @('https://app.sodaterminal.workers.dev', 'https://sodaterminal.com')
    if ($origins.Count -lt 1 -or $origins.Count -gt 2 -or
        @($origins | Sort-Object -Unique).Count -ne $origins.Count -or
        @($origins | Where-Object { $_ -cnotin $allowed }).Count -ne 0) { return $false }
    return $PublicOrigin -cin $origins
}

function Ensure-SodaProtocolRegistration {
    param(
        [Parameter(Mandatory = $true)][string]$Helper,
        [Parameter(Mandatory = $true)][string]$InstallRoot,
        [Parameter(Mandatory = $true)][string]$PublicOrigin
    )

    $originSource = Join-Path (Split-Path -Path $Helper -Parent) 'scanner-public-origin.txt'
    if (-not (Test-Path -LiteralPath $originSource -PathType Leaf)) { throw 'runtime_public_origin_mismatch' }
    $originConfiguration = Get-Content -LiteralPath $originSource -Raw -Encoding UTF8
    if (-not (Test-SodaPublicOriginConfiguration -Configuration $originConfiguration -PublicOrigin $PublicOrigin)) {
        throw 'runtime_public_origin_mismatch'
    }
    $expectedFileVersion = (Get-Item -LiteralPath $Helper).VersionInfo.FileVersion
    $expectedHash = Get-SodaRuntimeSha256 -Path $Helper
    $bootstrapRoot = Join-Path $InstallRoot 'helper-bootstrap'
    [IO.Directory]::CreateDirectory($bootstrapRoot) | Out-Null
    $bootstrapHelper = Join-Path $bootstrapRoot 'ZZZ-Scanner-Helper.exe'
    [IO.File]::Copy($Helper, $bootstrapHelper, $true)
    if ((Get-SodaRuntimeSha256 -Path $bootstrapHelper) -cne $expectedHash) {
        throw 'runtime_protocol_bootstrap_copy_mismatch'
    }
    $process = Start-Process -FilePath $bootstrapHelper -ArgumentList '--install-protocol' -PassThru -WindowStyle Hidden
    try {
        if (-not $process.WaitForExit(120000)) {
            $process.Kill()
            throw 'runtime_protocol_bootstrap_timeout'
        }
        if ($process.ExitCode -ne 0) { throw "runtime_protocol_registration_failed:$($process.ExitCode)" }
    }
    finally { $process.Dispose() }

    $managedRoot = if ([string]::IsNullOrWhiteSpace($env:ZZZ_SCANNER_DATA_ROOT)) {
        Join-Path $env:LOCALAPPDATA 'SodaTerminal\Scanner'
    } else { $env:ZZZ_SCANNER_DATA_ROOT }
    $managedHelper = [IO.Path]::GetFullPath((Join-Path $managedRoot 'helper\ZZZ-Scanner-Helper.exe'))
    $originTarget = Join-Path (Split-Path -Path $managedHelper -Parent) 'scanner-public-origin.txt'
    [IO.File]::Copy($originSource, $originTarget, $true)
    if ((Get-Content -LiteralPath $originTarget -Raw -Encoding UTF8) -cne $originConfiguration) {
        throw 'runtime_managed_origin_copy_mismatch'
    }
    $expectedCommand = '"' + $managedHelper + '" "%1"'
    $commandKey = 'Registry::HKEY_CURRENT_USER\Software\Classes\soda-terminal-scanner\shell\open\command'
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        $command = try { (Get-Item -LiteralPath $commandKey -ErrorAction Stop).GetValue('') } catch { $null }
        if ($command -ieq $expectedCommand -and
            (Test-Path -LiteralPath $managedHelper -PathType Leaf) -and
            (Get-Item -LiteralPath $managedHelper).VersionInfo.FileVersion -ceq $expectedFileVersion -and
            (Get-SodaRuntimeSha256 -Path $managedHelper) -ceq $expectedHash) { return }
        Start-Sleep -Milliseconds 250
    }
    throw 'runtime_protocol_registration_missing_or_stale'
}

function Install-SodaScannerRuntime {
    param(
        [string]$ManifestPath = '',
        [string]$TestAssetPath = '',
        [string]$InstallRoot = '',
        [string]$PublicOrigin = '',
        [ValidateSet('none', 'copy', 'target_health', 'pointer')]
        [string]$FaultInjection = 'none'
    )

    if ([string]::IsNullOrWhiteSpace($ManifestPath)) { $ManifestPath = Join-Path $PSScriptRoot 'scanner-runtime-release.v1.json' }
    $manifest = Read-SodaRuntimeManifest -Path $ManifestPath
    if ($env:SODA_SCANNER_TEST_MODE -eq '1') {
        if ([string]::IsNullOrWhiteSpace($InstallRoot)) { throw 'test_install_root_required' }
        $testRoot = [System.IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
        $userRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'SodaTerminal\Scanner')).TrimEnd('\')
        if ($testRoot.Equals($userRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            $testRoot.StartsWith($userRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
            $userRoot.StartsWith($testRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'test_install_root_must_be_isolated'
        }
    }
    if ([string]::IsNullOrWhiteSpace($InstallRoot)) { $InstallRoot = Join-Path $env:LOCALAPPDATA 'SodaTerminal\Scanner' }
    if ($FaultInjection -ne 'none' -and $env:SODA_SCANNER_TEST_MODE -ne '1') { throw 'runtime_fault_injection_forbidden' }

    $versionsRoot = Join-Path $InstallRoot 'versions'
    $downloadRoot = Join-Path $InstallRoot 'downloads'
    $versionRoot = Join-Path $versionsRoot $manifest.runtimeVersion
    $stageRoot = Join-Path $versionsRoot ('.{0}.installing' -f $manifest.runtimeVersion)
    [System.IO.Directory]::CreateDirectory($versionsRoot) | Out-Null
    [System.IO.Directory]::CreateDirectory($downloadRoot) | Out-Null

    $activePath = Join-Path $InstallRoot 'active.json'
    $previousPath = Join-Path $InstallRoot 'previous.json'
    $oldActive = if (Test-Path -LiteralPath $activePath -PathType Leaf) { Get-Content -LiteralPath $activePath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
    $oldPrevious = if (Test-Path -LiteralPath $previousPath -PathType Leaf) { Get-Content -LiteralPath $previousPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
    if ($oldActive -and $oldActive.version -eq $manifest.runtimeVersion -and (Test-Path -LiteralPath $oldActive.path -PathType Container)) {
        try {
            Test-SodaRuntimeHealth -StageRoot $oldActive.path -Manifest $manifest
            if ([string]::IsNullOrWhiteSpace($TestAssetPath) -and $env:SODA_SCANNER_TEST_MODE -ne '1') {
                Ensure-SodaProtocolRegistration -Helper (Join-Path $oldActive.path 'helper\ZZZ-Scanner-Helper.exe') -InstallRoot $InstallRoot -PublicOrigin $PublicOrigin
            }
            return [pscustomobject]@{ state = 'ready'; repeatedInstall = $true; runtimeVersion = $manifest.runtimeVersion }
        }
        catch { throw "active_runtime_repair_requires_distinct_version:$($_.Exception.Message)" }
    }
    if ($manifest.releaseState -ne 'published' -and [string]::IsNullOrWhiteSpace($TestAssetPath)) {
        throw 'runtime_release_not_published'
    }

    if (Test-Path -LiteralPath $stageRoot -PathType Container) { Remove-SodaRuntimeTree -Path $stageRoot }
    [System.IO.Directory]::CreateDirectory($stageRoot) | Out-Null
    $targetCreated = $false
    $activated = $false
    $previousUpdated = $false
    try {
        $archive = Join-Path $downloadRoot $manifest.assetName
        Copy-SodaRuntimeAsset -Manifest $manifest -Destination $archive -TestAssetPath $TestAssetPath -PublicOrigin $PublicOrigin
        Expand-Archive -LiteralPath $archive -DestinationPath $stageRoot -Force
        Test-SodaRuntimeHealth -StageRoot $stageRoot -Manifest $manifest

        $activeReferencesTarget = $false
        if ($oldActive -and -not [string]::IsNullOrWhiteSpace($oldActive.path)) {
            $activeReferencesTarget = [System.IO.Path]::GetFullPath($oldActive.path).Equals(
                [System.IO.Path]::GetFullPath($versionRoot),
                [System.StringComparison]::OrdinalIgnoreCase
            )
        }
        if ($activeReferencesTarget) { throw 'active_runtime_repair_requires_distinct_version' }
        if (Test-Path -LiteralPath $versionRoot -PathType Container) { Remove-SodaRuntimeTree -Path $versionRoot }
        [System.IO.Directory]::CreateDirectory($versionRoot) | Out-Null
        $targetCreated = $true
        $copyFaultAfterFiles = if ($FaultInjection -eq 'copy') { 2 } else { 0 }
        Copy-SodaRuntimeTree -SourceRoot $stageRoot -DestinationRoot $versionRoot -FaultAfterFiles $copyFaultAfterFiles

        if ($FaultInjection -eq 'target_health') {
            $targetRuntime = Get-Content -LiteralPath (Join-Path $versionRoot 'scanner-runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $faultPath = Join-Path $versionRoot @($targetRuntime.entries)[0].path
            [System.IO.File]::AppendAllText($faultPath, 'fault', (New-Object System.Text.UTF8Encoding($false)))
        }
        Test-SodaRuntimeHealth -StageRoot $versionRoot -Manifest $manifest

        $newActive = [ordered]@{ schemaVersion = 1; version = $manifest.runtimeVersion; path = $versionRoot; verifiedAt = (Get-Date).ToUniversalTime().ToString('o'); accountWriteEnabled = $false; importAccess = $false }
        if ($null -ne $oldActive) {
            Write-SodaScannerPointerAtomic -Path $previousPath -Pointer $oldActive | Out-Null
            $previousUpdated = $true
        }
        $pointerFault = if ($FaultInjection -eq 'pointer') { 'before_swap' } else { 'none' }
        Write-SodaScannerPointerAtomic -Path $activePath -Pointer $newActive -FaultInjection $pointerFault | Out-Null
        $activated = $true
        if ([string]::IsNullOrWhiteSpace($TestAssetPath) -and $env:SODA_SCANNER_TEST_MODE -ne '1') {
            $helper = Join-Path $versionRoot 'helper\ZZZ-Scanner-Helper.exe'
            if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) { throw 'runtime_helper_missing' }
            Ensure-SodaProtocolRegistration -Helper $helper -InstallRoot $InstallRoot -PublicOrigin $PublicOrigin
        }
        return [pscustomobject]@{ state = 'ready'; repeatedInstall = $false; runtimeVersion = $manifest.runtimeVersion }
    }
    catch {
        if ($previousUpdated -and -not $activated) {
            if ($null -ne $oldPrevious) { Write-SodaScannerPointerAtomic -Path $previousPath -Pointer $oldPrevious | Out-Null }
            elseif (Test-Path -LiteralPath $previousPath -PathType Leaf) { [System.IO.File]::Delete($previousPath) }
        }
        if ($targetCreated -and -not $activated) {
            $currentActive = if (Test-Path -LiteralPath $activePath -PathType Leaf) { Get-Content -LiteralPath $activePath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
            $targetIsReferenced = $currentActive -and -not [string]::IsNullOrWhiteSpace($currentActive.path) -and [System.IO.Path]::GetFullPath($currentActive.path).Equals(
                [System.IO.Path]::GetFullPath($versionRoot),
                [System.StringComparison]::OrdinalIgnoreCase
            )
            if (-not $targetIsReferenced -and (Test-Path -LiteralPath $versionRoot -PathType Container)) { Remove-SodaRuntimeTree -Path $versionRoot }
        }
        throw
    }
    finally {
        if (Test-Path -LiteralPath $stageRoot -PathType Container) { Remove-SodaRuntimeTree -Path $stageRoot }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    Install-SodaScannerRuntime -ManifestPath $ManifestPath -TestAssetPath $TestAssetPath -InstallRoot $InstallRoot -PublicOrigin $PublicOrigin -FaultInjection $FaultInjection | ConvertTo-Json -Compress
}
