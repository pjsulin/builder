//! Check that a `.builder` file loads: `cargo run -p builder-kernel --example validate -- FILE`.
//! Prints the definition, instance and tag counts, or the error and exits 1.
use builder_kernel::*;
use std::process::ExitCode;

fn main() -> ExitCode {
    let Some(path) = std::env::args().nth(1) else {
        eprintln!("usage: validate FILE");
        return ExitCode::FAILURE;
    };
    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("{path}: {e}");
            return ExitCode::FAILURE;
        }
    };
    match Document::from_json(&text) {
        Ok(d) => {
            println!(
                "{} definitions, {} instances, {} tags: ok",
                d.definitions.count(),
                d.instances.count(),
                d.tags.count()
            );
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{path}: {e}");
            ExitCode::FAILURE
        }
    }
}
