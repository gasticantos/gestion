# Agente de impresion local. Escucha en http://127.0.0.1:9847 y manda los tickets
# directo a la impresora en RAW (sin dialogo, sin instalar nada: usa PowerShell y el
# driver de Windows que la impresora ya tiene instalado).
param([int]$Puerto = 9847)
#
# Impresora de respaldo para instalaciones antiguas. La app envia en cada impresion
# la impresora elegida y guardada en ese dispositivo.
$PrinterName = "NOMBRE_DE_TU_IMPRESORA"

$OrigenesPermitidos = @("https://gestion-nexusgestion.vercel.app", "http://localhost:3000")

Add-Type -Namespace RawPrinterHelper -Name Native -MemberDefinition @"
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public struct DOCINFOA {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}

[DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

[DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool ClosePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOA di);

[DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool EndDocPrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool StartPagePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool EndPagePrinter(IntPtr hPrinter);

[DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
"@

function Send-RawDataToPrinter {
  param([string]$PrinterName, [byte[]]$Bytes)

  $hPrinter = [IntPtr]::Zero
  if (-not [RawPrinterHelper.Native]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "No se pudo abrir la impresora '$PrinterName'. Revisa que el nombre coincida exactamente con el de Windows."
  }
  try {
    $di = New-Object RawPrinterHelper.Native+DOCINFOA
    $di.pDocName = "Ticket"
    $di.pDataType = "RAW"
    if (-not [RawPrinterHelper.Native]::StartDocPrinter($hPrinter, 1, [ref]$di)) {
      throw "No se pudo iniciar el documento de impresion"
    }
    try {
      if (-not [RawPrinterHelper.Native]::StartPagePrinter($hPrinter)) {
        throw "Windows no pudo iniciar la pagina de impresion (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
      }
      $unmanagedBytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($Bytes.Length)
      try {
        [System.Runtime.InteropServices.Marshal]::Copy($Bytes, 0, $unmanagedBytes, $Bytes.Length)
        $written = 0
        $ok = [RawPrinterHelper.Native]::WritePrinter($hPrinter, $unmanagedBytes, $Bytes.Length, [ref]$written)
        if (-not $ok -or $written -ne $Bytes.Length) {
          throw "Windows rechazo los datos RAW (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()), enviados $written de $($Bytes.Length) bytes)"
        }
      } finally {
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($unmanagedBytes)
      }
      if (-not [RawPrinterHelper.Native]::EndPagePrinter($hPrinter)) {
        throw "Windows no pudo finalizar la pagina de impresion"
      }
    } finally {
      [RawPrinterHelper.Native]::EndDocPrinter($hPrinter) | Out-Null
    }
  } finally {
    [RawPrinterHelper.Native]::ClosePrinter($hPrinter) | Out-Null
  }
}

function Send-TextWithWindowsDriver {
  param([string]$PrinterName, [string]$Text)

  $impresora = Get-CimInstance Win32_Printer |
    Where-Object { $_.Name -eq $PrinterName } |
    Select-Object -First 1
  if (-not $impresora) {
    throw "La impresora '$PrinterName' no esta disponible en Windows"
  }

  # Out-Printer utiliza la misma cola y el mismo controlador que la pagina de prueba
  # de Windows. No abre dialogos y evita generar una pagina grafica vacia.
  [string]$Text | Out-Printer -Name $PrinterName -ErrorAction Stop
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Puerto/")
$listener.Start()
Write-Host "Agente de impresion escuchando en http://127.0.0.1:$Puerto"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $origin = $request.Headers["Origin"]
  if ($origin -and ($OrigenesPermitidos -contains $origin)) {
    $response.Headers.Add("Access-Control-Allow-Origin", $origin)
  }
  $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
  # Chrome/Edge exigen esto para dejar que una pagina publica (https://...vercel.app)
  # le hable a una IP privada/local (127.0.0.1) - Private Network Access.
  if ($request.Headers["Access-Control-Request-Private-Network"] -eq "true") {
    $response.Headers.Add("Access-Control-Allow-Private-Network", "true")
  }

  try {
    if ($request.HttpMethod -eq "OPTIONS") {
      $response.StatusCode = 204
      $response.Close()
      continue
    }

    if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/health") {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("ok")
      $response.ContentType = "text/plain"
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
      continue
    }

    if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/impresoras") {
      try {
        $impresoras = @(Get-CimInstance Win32_Printer | Sort-Object Name | ForEach-Object {
          [PSCustomObject]@{
            nombre = $_.Name
            predeterminada = [bool]$_.Default
            desconectada = [bool]$_.WorkOffline
            estado = switch ([int]$_.PrinterStatus) {
              1 { "Otro" }
              2 { "Desconocido" }
              3 { "Lista" }
              4 { "Imprimiendo" }
              5 { "Calentando" }
              default { "Disponible" }
            }
          }
        })
        $jsonImpresoras = @{ impresoras = $impresoras } | ConvertTo-Json -Depth 4 -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonImpresoras)
        $response.StatusCode = 200
        $response.ContentType = "application/json; charset=utf-8"
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } catch {
        $response.StatusCode = 500
        $msg = ($_.Exception.Message -replace '"', "'")
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("{`"error`":`"$msg`"}")
        $response.ContentType = "application/json; charset=utf-8"
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      $response.Close()
      continue
    }

    if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/imprimir") {
      $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $reader.Close()

      $json = $body | ConvertFrom-Json
      $contenido = $json.contenido
      $impresoraElegida = [string]$json.impresora
      if ([string]::IsNullOrWhiteSpace($impresoraElegida)) {
        $impresoraElegida = $PrinterName
      }

      if (-not $contenido) {
        $response.StatusCode = 400
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Falta contenido"}')
        $response.ContentType = "application/json"
        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        $response.Close()
        continue
      }

      try {
        # Se imprime por el controlador de Windows. Esto funciona tanto con impresoras
        # termicas ESC/POS como con colas que no aceptan correctamente trabajos RAW.
        Send-TextWithWindowsDriver -PrinterName $impresoraElegida -Text "$contenido`r`n`r`n"

        $response.StatusCode = 200
        $okBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
        $response.ContentType = "application/json"
        $response.OutputStream.Write($okBytes, 0, $okBytes.Length)
      } catch {
        Write-Host "Error al imprimir: $_"
        $response.StatusCode = 500
        $msg = ($_.Exception.Message -replace '"', "'")
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"error`":`"$msg`"}")
        $response.ContentType = "application/json"
        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
      }
      $response.Close()
      continue
    }

    $response.StatusCode = 404
    $response.Close()
  } catch {
    Write-Host "Error manejando el pedido: $_"
    try { $response.Close() } catch {}
  }
}
