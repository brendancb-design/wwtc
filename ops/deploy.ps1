param(
  [string]$FnName = "wwtc-mumbai-MainFunction-oLfQ4l6FedRA",
  [string]$Region = "ap-south-1",
  [string]$Profile = "default"
)

# robust script dir: works when invoked from anywhere
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }        # fallback for consoles
$Root = (Resolve-Path "$ScriptDir\..").Path

$Src  = Join-Path $Root "src"
$App  = Join-Path $Src "app.js"
$Zip  = Join-Path $Root "build.zip"

# 1) Syntax check
node (Join-Path $Root 'syntax_check.js') $App

# 2) Build & deploy
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $Src '*') -DestinationPath $Zip -Force
aws lambda update-function-code --function-name $FnName --zip-file fileb://$Zip --region $Region --profile $Profile | Out-Null

# 3) Force cold start
$envFile = Join-Path $env:TEMP 'lambda-env.json'
$varsJson = aws lambda get-function-configuration --function-name $FnName --region $Region --profile $Profile --query 'Environment.Variables' --output json
$varsObj  = $varsJson | ConvertFrom-Json
$ht=@{}; if ($varsObj){ $varsObj.psobject.Properties | % { $ht[$_.Name]=$_.Value } }
$ht['CONFIG_BUMP'] = (Get-Date -Format o)
@{ Variables = $ht } | ConvertTo-Json -Depth 5 | Out-File $envFile -Encoding ascii -NoNewline
aws lambda update-function-configuration --function-name $FnName --region $Region --profile $Profile --environment file://$envFile | Out-Null

# 4) Smoke test
$payload = Join-Path $Root 'invoke_event_body.json'
$out     = Join-Path $Root 'invoke_out_body.json'
$logB64 = aws lambda invoke --function-name $FnName --region $Region --profile $Profile --cli-binary-format raw-in-base64-out --log-type Tail --payload file://$payload $out --query LogResult --output text
$resp = Get-Content $out | ConvertFrom-Json
if ($resp.statusCode -ne 200) { throw "Smoke test failed: $($resp | ConvertTo-Json -Depth 5)" }

"Deploy OK. Result: $(Get-Content $out)"
