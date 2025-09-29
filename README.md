# WWTC Lambda (Mumbai)

## Deploy
pwsh -ExecutionPolicy Bypass -File .\ops\deploy.ps1

## Expected smoke result
200 + body.translated_text == "hola mundo"
