mod app;
mod document;
mod geometry;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_title("CONCOSTCAD")
            .with_inner_size([1440.0, 900.0])
            .with_min_inner_size([1024.0, 680.0]),
        ..Default::default()
    };

    eframe::run_native(
        "CONCOSTCAD",
        options,
        Box::new(|context| Ok(Box::new(app::CadApp::new(context)))),
    )
}
