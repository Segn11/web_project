$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node "$scriptDir\node_modules\next\dist\bin\next" dev