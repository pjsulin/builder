//! Check that a `.builder` file loads and is clean:
//! `cargo run -p builder-kernel --example validate -- FILE`.
//! Prints the definition, instance and tag counts, then one line per problem
//! `check::check` finds (overlapping edges, non-planar faces, faceless edges,
//! duplicate vertices). Exits 1 when the file does not load or has a problem.
use builder_kernel::check::check;
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
            let findings = check(&d);
            let verdict = match findings.len() {
                0 => "ok".to_string(),
                1 => "1 problem".to_string(),
                n => format!("{n} problems"),
            };
            println!(
                "{} definitions, {} instances, {} tags: {verdict}",
                d.definitions.count(),
                d.instances.count(),
                d.tags.count()
            );
            for f in &findings {
                println!("{f}");
            }
            if findings.is_empty() {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(e) => {
            eprintln!("{path}: {e}");
            ExitCode::FAILURE
        }
    }
}
