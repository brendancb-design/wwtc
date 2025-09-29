param([string]$FnName="wwtc-mumbai-MainFunction-oLfQ4l6FedRA",[string]$Region="ap-south-1",[string]$Profile="default")
$Root = (Get-Location).Path
$payload = Join-Path $Root 'invoke_event_body.json'
$out     = Join-Path $Root 'invoke_out_body.json'
$logB64 = aws lambda invoke --function-name $FnName --region $Region --profile $Profile --cli-binary-format raw-in-base64-out --log-type Tail --payload file://$payload $out --query LogResult --output text
$resp = Get-Content $out | ConvertFrom-Json
if ($resp.statusCode -ne 200) { throw "Health failed: $($resp | ConvertTo-Json -Depth 5)" }
"OK: $(Get-Content $out)"
