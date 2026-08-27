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

    string[] paragraphs = (text ?? "").Split(new string[] { "<<BR>>" }, StringSplitOptions.None);
    foreach (string paragraph in paragraphs) {
      string remaining = paragraph.Trim();
      if (remaining.Length == 0) {
        output.AppendLine("| " + new string(' ', innerWidth) + " |");
        continue;
      }
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
    }

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

  private static Font TicketFont(float size, FontStyle style, bool mono) {
    return new Font(mono ? FontFamily.GenericMonospace : FontFamily.GenericSansSerif, size, style, GraphicsUnit.Point);
  }

  private static void DrawStyledTicket(Graphics graphics, Rectangle bounds, string text) {
    float y = bounds.Y;
    string normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
    foreach (string rawLine in normalized.Split('\n')) {
      string line = rawLine;
      string style = "BODY";
      int markerEnd = rawLine.IndexOf("]]");
      if (rawLine.StartsWith("[[") && markerEnd > 2) {
        style = rawLine.Substring(2, markerEnd - 2).ToUpperInvariant();
        line = rawLine.Substring(markerEnd + 2).TrimStart();
      }

      if (style == "HR") {
        y += 4;
        graphics.DrawLine(Pens.Black, bounds.Left, y, bounds.Right, y);
        y += 7;
        continue;
      }
      if (String.IsNullOrWhiteSpace(line)) {
        y += 6;
        continue;
      }

      float size = 10;
      FontStyle fontStyle = FontStyle.Regular;
      bool mono = false;
      bool center = false;
      bool boxed = false;
      float before = 0;
      float after = 2;

      switch (style) {
        case "TITLE": size = 17; fontStyle = FontStyle.Bold; center = true; after = 4; break;
        case "HERO": size = 22; fontStyle = FontStyle.Bold; center = true; before = 4; after = 7; break;
        case "SUBTITLE": size = 13; fontStyle = FontStyle.Bold; center = true; after = 3; break;
        case "CENTER": size = 9; center = true; break;
        case "SECTION": size = 11; fontStyle = FontStyle.Bold; before = 3; after = 3; break;
        case "ITEM": size = 15; fontStyle = FontStyle.Bold; before = 2; after = 3; break;
        case "RECEIPT_ITEM": size = 10; fontStyle = FontStyle.Bold; before = 4; after = 0; break;
        case "DETAIL": size = 9; fontStyle = FontStyle.Bold; mono = true; after = 3; break;
        case "ROW": size = 10; fontStyle = FontStyle.Bold; mono = true; break;
        case "TOTAL": size = 15; fontStyle = FontStyle.Bold; mono = true; before = 3; after = 4; break;
        case "NOTE":
          size = 14;
          fontStyle = FontStyle.Bold;
          boxed = true;
          before = 5;
          after = 7;
          line = line.Replace("<<BR>>", "\n");
          break;
        case "FOOTER": size = 9; fontStyle = FontStyle.Italic; center = true; before = 4; break;
      }

      y += before;
      using (var font = TicketFont(size, fontStyle, mono))
      using (var format = new StringFormat(StringFormat.GenericTypographic)) {
        format.Alignment = center ? StringAlignment.Center : StringAlignment.Near;
        format.Trimming = StringTrimming.Word;
        float inset = boxed ? 7 : 0;
        float availableWidth = bounds.Width - inset * 2;
        SizeF measured = graphics.MeasureString(line, font, new SizeF(availableWidth, 3000), format);
        float height = Math.Max(font.GetHeight(graphics), measured.Height) + (boxed ? 12 : 2);
        if (boxed) {
          using (var pen = new Pen(Color.Black, 2)) {
            graphics.DrawRectangle(pen, bounds.Left, y, bounds.Width - 1, height);
          }
        }
        graphics.DrawString(
          line,
          font,
          Brushes.Black,
          new RectangleF(bounds.Left + inset, y + (boxed ? 6 : 0), availableWidth, height),
          format
        );
        y += height + after;
      }
    }
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
        // MarginBounds incluye el margen físico del controlador, aunque Graphics ya parte
        // desde el área imprimible. Compensarlo evita que todo el ticket quede corrido a la derecha.
        int hardMarginX = (int)Math.Round(e.PageSettings.HardMarginX);
        int hardMarginY = (int)Math.Round(e.PageSettings.HardMarginY);
        bounds = new Rectangle(
          Math.Max(0, bounds.X - hardMarginX),
          Math.Max(0, bounds.Y - hardMarginY),
          bounds.Width,
          bounds.Height
        );

        DrawStyledTicket(e.Graphics, bounds, text);
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

function ConvertTo-EscPosTicket {
  param([string]$Text)

  $stream = New-Object System.IO.MemoryStream
  $encoding = [System.Text.Encoding]::GetEncoding(858)

  function Write-Bytes([byte[]]$value) { $stream.Write($value, 0, $value.Length) }
  function Write-Text([string]$value) {
    $bytes = $encoding.GetBytes($value)
    $stream.Write($bytes, 0, $bytes.Length)
  }
  function Set-Style([bool]$center, [bool]$bold, [byte]$size) {
    Write-Bytes ([byte[]](0x1B, 0x61, $(if ($center) { 1 } else { 0 })))
    Write-Bytes ([byte[]](0x1B, 0x45, $(if ($bold) { 1 } else { 0 })))
    Write-Bytes ([byte[]](0x1D, 0x21, $size))
  }

  # Inicializar, seleccionar PC858 (acentos + símbolo de moneda) y espaciado normal.
  Write-Bytes ([byte[]](0x1B, 0x40))
  Write-Bytes ([byte[]](0x1B, 0x74, 19))
  $normalizado = $Text.Replace("`r`n", "`n").Replace("`r", "`n")
  foreach ($lineaOriginal in $normalizado.Split("`n")) {
    $linea = $lineaOriginal
    $estilo = "BODY"
    if ($lineaOriginal -match '^\[\[([^\]]+)\]\]\s?(.*)$') {
      $estilo = $Matches[1].ToUpperInvariant()
      $linea = $Matches[2]
    }

    switch ($estilo) {
      "HR" {
        Set-Style $false $false 0
        Write-Text ("-" * 42 + "`n")
      }
      "TITLE" {
        Set-Style $true $true 0x11
        Write-Text ($linea.ToUpperInvariant() + "`n")
      }
      "HERO" {
        Set-Style $true $true 0x22
        Write-Text ($linea.ToUpperInvariant() + "`n")
      }
      "SUBTITLE" {
        Set-Style $true $true 0x01
        Write-Text ($linea.ToUpperInvariant() + "`n")
      }
      "CENTER" {
        Set-Style $true $false 0
        Write-Text ($linea + "`n")
      }
      "SECTION" {
        Set-Style $false $true 0
        Write-Text ($linea.ToUpperInvariant() + "`n")
      }
      "ITEM" {
        Set-Style $false $true 0x01
        Write-Text ($linea + "`n")
      }
      "RECEIPT_ITEM" {
        Set-Style $false $true 0
        Write-Text ($linea + "`n")
      }
      "DETAIL" {
        Set-Style $false $true 0
        Write-Text ($linea + "`n")
      }
      "ROW" {
        Set-Style $false $true 0
        Write-Text ($linea + "`n")
      }
      "TOTAL" {
        Set-Style $false $true 0x11
        Write-Text ($linea + "`n")
      }
      "NOTE" {
        Set-Style $false $true 0x01
        Write-Text ("*** " + $linea.Replace("<<BR>>", "`n") + " ***`n")
      }
      "FOOTER" {
        Set-Style $true $false 0
        Write-Text ($linea + "`n")
      }
      default {
        Set-Style $false $false 0
        Write-Text ($linea + "`n")
      }
    }
  }

  Set-Style $false $false 0
  Write-Bytes ([byte[]](0x0A, 0x0A, 0x0A, 0x0A))
  Write-Bytes ([byte[]](0x1D, 0x56, 0))
  $resultado = $stream.ToArray()
  $stream.Dispose()
  return $resultado
}

function Test-ImpresoraEscPos {
  param([string]$PrinterName)
  return $PrinterName -match '(?i)(EPSON|TM[-_ ]|ESC.?POS|POS[-_ ]|THERMAL|TERMICA|TICKET)'
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
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"agente":"1.2.0"}')
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
      # El navegador siempre envía JSON en UTF-8. Usar explícitamente esa codificación evita
      # mojibake en textos como "Dueño", "Gestión" o nombres con acentos.
      $reader = New-Object System.IO.StreamReader(
        $request.InputStream,
        [System.Text.Encoding]::UTF8,
        $true
      )
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
        $cronometro = [System.Diagnostics.Stopwatch]::StartNew()
        $modoPedido = [string]$json.modo
        $usarRapido = $modoPedido -eq "escpos" -or ($modoPedido -eq "auto" -and (Test-ImpresoraEscPos $impresoraElegida))
        $modoUsado = "windows"
        if ($usarRapido) {
          try {
            $datos = ConvertTo-EscPosTicket -Text "$contenido"
            Send-RawDataToPrinter -PrinterName $impresoraElegida -Bytes $datos
            $modoUsado = "escpos"
          } catch {
            Write-Host "ESC/POS rapido fallo; usando controlador Windows: $_"
            Send-TextWithWindowsDriver -PrinterName $impresoraElegida -Text "$contenido`r`n`r`n"
          }
        } else {
          Send-TextWithWindowsDriver -PrinterName $impresoraElegida -Text "$contenido`r`n`r`n"
        }

        $cronometro.Stop()

        $response.StatusCode = 200
        $okBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"success`":true,`"modo`":`"$modoUsado`",`"duracionMs`":$($cronometro.ElapsedMilliseconds)}")
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
