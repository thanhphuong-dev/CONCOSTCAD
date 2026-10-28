use std::backtrace::Backtrace;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

static LOG_FILE: OnceLock<Mutex<File>> = OnceLock::new();

pub fn initialize() -> Option<PathBuf> {
    let root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("CONCOSTCAD")
        .join("Logs");
    fs::create_dir_all(&root).ok()?;

    let timestamp = unix_timestamp();
    let path = root.join(format!("concostcad-{}-{timestamp}.log", std::process::id()));
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .ok()?;
    LOG_FILE.set(Mutex::new(file)).ok()?;
    Some(path)
}

pub fn install_panic_hook() {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        error(&format!(
            "panic: {panic_info}\nbacktrace:\n{}",
            Backtrace::force_capture()
        ));
        previous_hook(panic_info);
    }));
}

pub fn info(message: &str) {
    write_record("INFO", message);
}

pub fn error(message: &str) {
    write_record("ERROR", message);
}

fn write_record(level: &str, message: &str) {
    let Some(file) = LOG_FILE.get() else {
        return;
    };
    let Ok(mut file) = file.lock() else {
        return;
    };
    let one_line = message.replace(['\r', '\n'], " ");
    let _ = writeln!(file, "{} [{level}] {one_line}", unix_timestamp());
    let _ = file.flush();
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
