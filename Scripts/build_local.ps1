param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,

    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$')]
    [string]$PackageName,

    [string]$VersionName = "1.0.0",

    [ValidateSet("generated", "url")]
    [string]$IconMode = "generated",

    [string]$IconUrl = "",

    [ValidatePattern('^#?[0-9a-fA-F]{6}$')]
    [string]$IconColor = "#BF3EFF",

    [ValidateSet("auto", "android", "iphone", "harmonyos", "android_pad", "ipad")]
    [string]$UaMode = "auto",

    [switch]$NoScreenshot,

    [switch]$WindowMode,

    [switch]$ShowDisclaimer,

    [switch]$Install
)

$ErrorActionPreference = "Stop"

function Replace-InFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Old,
        [Parameter(Mandatory = $true)][string]$New
    )
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $text = $text.Replace($Old, $New)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
}

function Escape-XmlText {
    param([string]$Value)
    return $Value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;").Replace("'", "&apos;")
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$buildId = Get-Date -Format "yyyyMMdd-HHmmss"
$workDir = Join-Path $root "build\local-work\$buildId"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

$excludedNames = @(
    ".git", "build", ".gradle", ".gradle-user-home", ".wrangler", ".deploy-pages", ".codex-inspect", ".compare-repos",
    "PakrPre-clean", "PakrPre-api-clean", "clean-work-test", "git-init-test", "git-write-test",
    "local.properties"
)
$excludedExtensions = @(".jks", ".keystore", ".p12", ".pem", ".key", ".lnk")

Get-ChildItem -LiteralPath $root -Force |
    Where-Object {
        $_.Name -notin $excludedNames -and
        -not $_.Name.StartsWith("codex-build-check-") -and
        -not $_.Name.StartsWith(".codex-build-check-") -and
        -not $_.Name.StartsWith("remote-pakrpre-") -and
        -not $_.Name.StartsWith(".env") -and
        $_.Extension -notin $excludedExtensions
    } |
    ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $workDir -Recurse -Force
    }

$appBuild = Join-Path $workDir "app\build.gradle"
$manifest = Join-Path $workDir "app\src\main\AndroidManifest.xml"
$strings = Join-Path $workDir "app\src\main\res\values\strings.xml"
$mainActivity = Join-Path $workDir "app\src\main\java\com\webviewapp\MainActivity.kt"
$splashActivity = Join-Path $workDir "app\src\main\java\com\webviewapp\SplashActivity.kt"
$disclaimerActivity = Join-Path $workDir "app\src\main\java\com\webviewapp\DisclaimerActivity.kt"

$versionCode = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$noScreenshotValue = if ($NoScreenshot) { "true" } else { "false" }
$windowModeValue = if ($WindowMode) { "true" } else { "false" }
$showDisclaimerValue = if ($ShowDisclaimer) { "true" } else { "false" }
$appNameXml = Escape-XmlText $AppName

Replace-InFile $mainActivity "{{APP_URL}}" $AppUrl
Replace-InFile $mainActivity "{{NO_SCREENSHOT}}" $noScreenshotValue
Replace-InFile $mainActivity "{{UA_MODE}}" $UaMode
Replace-InFile $mainActivity "{{WINDOW_MODE}}" $windowModeValue
Replace-InFile $splashActivity "{{WINDOW_MODE}}" $windowModeValue
Replace-InFile $disclaimerActivity "{{WINDOW_MODE}}" $windowModeValue
Replace-InFile $splashActivity "{{SHOW_DISCLAIMER}}" $showDisclaimerValue
Replace-InFile $appBuild "{{APP_PACKAGE}}" $PackageName
Replace-InFile $strings "{{APP_NAME}}" $appNameXml
Replace-InFile $manifest "{{APP_NAME}}" $appNameXml
Replace-InFile $appBuild "{{VERSION_NAME}}" $VersionName
Replace-InFile $appBuild "{{VERSION_CODE}}" ([string]$versionCode)

$env:ICON_MODE = $IconMode
$env:ICON_URL = $IconUrl
$env:ICON_COLOR = $IconColor
$env:APP_NAME = $AppName
$env:PACKAGE_NAME = $PackageName

Push-Location $workDir
try {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        throw "Python was not found in PATH. Install Python 3 and Pillow before building locally."
    }
    & python Scripts\process_icon.py
    if ($LASTEXITCODE -ne 0) { throw "Icon processing failed." }

    & .\gradlew.bat clean assembleDebug --no-daemon --rerun-tasks
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed." }

    $apks = Get-ChildItem -Path "app\build\outputs\apk" -Recurse -Filter "*.apk"
    if (-not $apks) { throw "Build finished but no APK was found." }

    Write-Host ""
    Write-Host "APK output:"
    $apks | ForEach-Object { Write-Host "  $($_.FullName)" }

    if ($Install) {
        $adb = Get-Command adb -ErrorAction SilentlyContinue
        if (-not $adb) { throw "adb was not found in PATH. Install Android Platform Tools or open Android Studio first." }
        $abi = (& adb shell getprop ro.product.cpu.abi).Trim()
        $targetApk = $apks | Where-Object { $_.Name -like "*$abi*" } | Select-Object -First 1
        if (-not $targetApk) { $targetApk = $apks | Select-Object -First 1 }
        & adb install -r $targetApk.FullName
    }
}
finally {
    Pop-Location
}
