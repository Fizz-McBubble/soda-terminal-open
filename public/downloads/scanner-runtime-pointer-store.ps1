Set-StrictMode -Version Latest

function ConvertTo-SodaScannerPointerJson {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Pointer
    )

    return ($Pointer | ConvertTo-Json -Depth 16 -Compress)
}
function Write-SodaScannerPointerAtomic {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [object]$Pointer,

        [ValidateSet('none', 'before_swap')]
        [string]$FaultInjection = 'none'
    )

    $destination = [System.IO.Path]::GetFullPath($Path)
    $directory = [System.IO.Path]::GetDirectoryName($destination)
    if ([string]::IsNullOrWhiteSpace($directory) -or -not (Test-Path -LiteralPath $directory -PathType Container)) {
        throw "pointer_directory_missing:$directory"
    }

    $fileName = [System.IO.Path]::GetFileName($destination)
    $nonce = [Guid]::NewGuid().ToString('N')
    $temporary = Join-Path $directory ('.{0}.{1}.tmp' -f $fileName, $nonce)
    $backup = Join-Path $directory ('.{0}.{1}.bak' -f $fileName, $nonce)
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

    try {
        $json = ConvertTo-SodaScannerPointerJson -Pointer $Pointer
        [System.IO.File]::WriteAllText($temporary, $json, $utf8WithoutBom)

        if ($FaultInjection -eq 'before_swap') {
            throw 'pointer_fault_before_swap'
        }

        if (Test-Path -LiteralPath $destination -PathType Leaf) {
            [System.IO.File]::Replace($temporary, $destination, $backup)
        }
        else {
            [System.IO.File]::Move($temporary, $destination)
        }

        return [pscustomobject]@{
            path = $destination
            updated = $true
        }
    }
    finally {
        foreach ($candidate in @($temporary, $backup)) {
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                [System.IO.File]::Delete($candidate)
            }
        }
    }
}
