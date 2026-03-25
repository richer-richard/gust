use anyhow::{Context, Result};
use gust_types::ScenarioConfig;

pub fn load_built_in_scenarios() -> Result<Vec<ScenarioConfig>> {
    let raw = [
        include_str!("../scenarios/city_flyover_sunny.json"),
        include_str!("../scenarios/city_flyover_cloudy.json"),
        include_str!("../scenarios/city_flyover_night.json"),
        include_str!("../scenarios/turbulence_lab.json"),
        include_str!("../scenarios/canyon_recovery.json"),
        include_str!("../scenarios/faulted_sensor_run.json"),
    ];

    raw.into_iter()
        .map(|entry| {
            serde_json::from_str::<ScenarioConfig>(entry)
                .context("failed to parse built-in scenario")
        })
        .collect()
}
