# Agente de impresion local. Escucha en http://127.0.0.1:9847 y manda los tickets
# directo a la impresora en RAW (sin dialogo, sin instalar nada: usa PowerShell y el
# driver de Windows que la impresora ya tiene instalado).
#
# EDITAR ANTES DE USAR: poner el nombre exacto de la impresora tal como figura en
# Windows (Configuracion > Impresoras y escaneres, o corriendo Get-Printer en PowerShell).
$PrinterName = "NOMBRE_DE_TU_IMPRESORA"

$Puerto = 9847
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
      [RawPrinterHelper.Native]::StartPagePrinter($hPrinter) | Out-Null
      $unmanagedBytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($Bytes.Length)
      [System.Runtime.InteropServices.Marshal]::Copy($Bytes, 0, $unmanagedBytes, $Bytes.Length)
      $written = 0
      [RawPrinterHelper.Native]::WritePrinter($hPrinter, $unmanagedBytes, $Bytes.Length, [ref]$written) | Out-Null
      [System.Runtime.InteropServices.Marshal]::FreeHGlobal($unmanagedBytes)
      [RawPrinterHelper.Native]::EndPagePrinter($hPrinter) | Out-Null
    } finally {
      [RawPrinterHelper.Native]::EndDocPrinter($hPrinter) | Out-Null
    }
  } finally {
    [RawPrinterHelper.Native]::ClosePrinter($hPrinter) | Out-Null
  }
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

    if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/imprimir") {
      $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $reader.Close()

      $json = $body | ConvertFrom-Json
      $contenido = $json.contenido

      if (-not $contenido) {
        $response.StatusCode = 400
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Falta contenido"}')
        $response.ContentType = "application/json"
        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        $response.Close()
        continue
      }

      try {
        # CP437 es la tabla de caracteres que casi todas las impresoras termicas ESC/POS
        # traen por defecto. Si los acentos/enies salen mal, probar cambiando 437 por 850.
        $codepage = [System.Text.Encoding]::GetEncoding(437)
        $textoBytes = $codepage.GetBytes("$contenido`r`n`r`n`r`n")
        $reset = [byte[]](0x1B, 0x40)        # ESC @ -> reset impresora
        $corte = [byte[]](0x1D, 0x56, 0x00)  # GS V 0 -> corte total de papel
        $todosBytes = $reset + $textoBytes + $corte

        Send-RawDataToPrinter -PrinterName $PrinterName -Bytes $todosBytes

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
