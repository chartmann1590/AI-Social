# One-off helper to capture Pixel screenshots into play-store/screenshots/phone/.
# Usage: powershell -File scripts\capture-screens.ps1 <step-number> <name>
param(
    [Parameter(Mandatory = $true)] [string] $Step,
    [Parameter(Mandatory = $true)] [string] $Name
)
$pixel = "37220DLJG001ML"
$out = "play-store\screenshots\phone\$Step-$Name.png"
& adb -s $pixel exec-out screencap -p | Set-Content -Path $out -Encoding Byte
$len = (Get-Item $out).Length
Write-Host ("{0}  ({1} bytes)" -f $out, $len)
