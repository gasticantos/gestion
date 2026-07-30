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

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Text;
using System.Drawing.Printing;
using System.Text;

public static class GestionWindowsPrinter {
  private static void AppendBoxedText(StringBuilder output, string text) {
    const int innerWidth = 30;
    string border = "+" + new string('-', innerWidth + 2) + "+";
    output.AppendLine(border);

    string remaining = (text ?? "").Trim();
    while (remaining.Length > 0) {
      int take = Math.Min(innerWidth, remaining.Length);
      if (take < remaining.Length) {
        int lastSpace = remaining.LastIndexOf(' ', take - 1, take);
        if (lastSpace > 0) take = lastSpace;
      }
      string part = remaining.Substring(0, take).Trim();
      output.AppendLine("| " + part.PadRight(innerWidth) + " |");
      remaining = remaining.Substring(take).TrimStart();
    }
    if (String.IsNullOrWhiteSpace(text))
      output.AppendLine("| " + new string(' ', innerWidth) + " |");

    output.AppendLine(border);
  }

  private static string StableTicketText(string text) {
    var output = new StringBuilder();
    string normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
    foreach (string rawLine in normalized.Split('\n')) {
      string line = rawLine;
      string style = "BODY";
      int markerEnd = rawLine.IndexOf("]]");
      if (rawLine.StartsWith("[[") && markerEnd > 2) {
        style = rawLine.Substring(2, markerEnd - 2).ToUpperInvariant();
        line = rawLine.Substring(markerEnd + 2).TrimStart();
      }

      switch (style) {
        case "HR":
          output.AppendLine("--------------------------------");
          break;
        case "TITLE":
          output.AppendLine(line.ToUpperInvariant());
          break;
        case "SUBTITLE":
          output.AppendLine("=== " + line.ToUpperInvariant() + " ===");
          break;
        case "SECTION":
          output.AppendLine("-- " + line.ToUpperInvariant() + " --");
          break;
        case "NOTE":
          output.AppendLine();
          AppendBoxedText(output, line.ToUpperInvariant());
          output.AppendLine();
          break;
        default:
          output.AppendLine(line);
          break;
      }
    }
    return output.ToString();
  }

  public static void Print(string printerName, string text) {
    if (String.IsNullOrWhiteSpace(printerName))
      throw new ArgumentException("Falta el nombre de la impresora");
    if (String.IsNullOrWhiteSpace(text))
      throw new ArgumentException("El ticket llego sin contenido");

    using (var document = new PrintDocument()) {
      document.PrinterSettings.PrinterName = printerName;
      if (!document.PrinterSettings.IsValid)
        throw new InvalidOperationException("La impresora no esta disponible en Windows: " + printerName);

      document.DocumentName = "Ticket Gestion";
      document.PrintController = new StandardPrintController();
      // Margen superior mínimo para no desperdiciar papel antes del encabezado.
      document.DefaultPageSettings.Margins = new Margins(10, 10, 3, 10);

      document.PrintPage += delegate(object sender, PrintPageEventArgs e) {
        e.Graphics.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
        Rectangle bounds = e.MarginBounds;
        if (bounds.Width <= 0 || bounds.Height <= 0)
          bounds = new Rectangle(10, 3, Math.Max(100, e.PageBounds.Width - 20), Math.Max(100, e.PageBounds.Height - 13));

        // Un único DrawString genera un trabajo de spool pequeño y estable. Algunos drivers
        // térmicos aceptaban el trabajo con muchos bloques gráficos pero luego lo descartaban.
        using (var font = new Font(FontFamily.GenericMonospace, 10, FontStyle.Bold, GraphicsUnit.Point)) {
          e.Graphics.DrawString(
            StableTicketText(text),
            font,
            Brushes.Black,
            new RectangleF(bounds.X, bounds.Y, bounds.Width, bounds.Height),
            StringFormat.GenericTypographic
          );
        }
        e.HasMorePages = false;
      };

      document.Print();
    }
  }
}
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

  [GestionWindowsPrinter]::Print($PrinterName, $Text)
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
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"agente":"1.1.2"}')
      $response.ContentType = "application/json"
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
