use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct AgenteImpresion(Mutex<Option<Child>>);

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
            }
        }
    });
}
