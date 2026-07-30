use std::process::Child;
#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct AgenteImpresion(Mutex<Option<Child>>);

#[tauri::command]
fn version_actual() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
fn instalar_actualizacion(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const SCRIPT: &str = r#"
$destino = Join-Path $env:TEMP ("Gestion-Update-" + [guid]::NewGuid().ToString() + ".exe")
(New-Object System.Net.WebClient).DownloadFile("https://github.com/gasticantos/gestion/raw/refs/heads/main/public/downloads/Gestion-Windows-Setup.exe", $destino)
Start-Sleep -Seconds 2
Start-Process -FilePath $destino -ArgumentList "/S"
"#;

        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                SCRIPT,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| format!("No se pudo iniciar la actualización: {error}"))?;

        app.exit(0);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("La actualización automática solo está disponible en Windows".into())
    }
}

#[cfg(target_os = "windows")]
fn iniciar_agente(app: &tauri::App) -> Option<Child> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let script = app
        .path()
        .resource_dir()
        .ok()?
        .join("agente-impresion.ps1");

    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ])
        .arg(script)
        .args(["-Puerto", "9848"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .ok()
}

#[cfg(not(target_os = "windows"))]
fn iniciar_agente(_app: &tauri::App) -> Option<Child> {
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            version_actual,
            instalar_actualizacion
        ])
        .setup(|app| {
            app.manage(AgenteImpresion(Mutex::new(iniciar_agente(app))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar Gestión");

    app.run(|app_handle, evento| {
        if matches!(evento, RunEvent::Exit) {
            let estado = app_handle.state::<AgenteImpresion>();
            if let Ok(mut agente) = estado.0.lock() {
                if let Some(proceso) = agente.as_mut() {
                    let _ = proceso.kill();
                }
            };
        }
    });
}
