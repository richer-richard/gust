use std::path::PathBuf;

fn main() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let native_dir = root.join("../../native/sim_core");

    println!(
        "cargo:rerun-if-changed={}",
        native_dir.join("CMakeLists.txt").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        native_dir.join("include/gust/sim_c_api.h").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        native_dir.join("src/sim.cpp").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        native_dir.join("src/sim_c_api.cpp").display()
    );

    let dst = cmake::Config::new(&native_dir).profile("Release").build();

    println!(
        "cargo:rustc-link-search=native={}",
        dst.join("lib").display()
    );
    println!("cargo:rustc-link-lib=static=gust_sim_core");

    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-lib=c++");
    } else {
        println!("cargo:rustc-link-lib=stdc++");
    }
}
