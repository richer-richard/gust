use gust_types::{
    ObstacleBox, ScenarioConfig, Vec3, Waypoint, WorldBuilding, WorldLandmark, WorldLayout,
};

const DEFAULT_WORLD_SEED: u32 = 42;
const DRONE_SPAWN_RADIUS_M: f64 = 0.26;
const PLAZA_TOP_Z: f64 = 10.0;

pub fn resolve_world_layout(_scenario_id: &str) -> WorldLayout {
    generate_world_layout(DEFAULT_WORLD_SEED)
}

pub fn apply_world_to_scenario(base: &ScenarioConfig, world: &WorldLayout) -> ScenarioConfig {
    let mut resolved = base.clone();
    resolved.start_position = if is_zero_vec(resolved.start_position) {
        world.spawn_position
    } else {
        resolved.start_position
    };
    resolved.obstacles = collect_world_colliders(world);
    resolved.waypoints = base
        .waypoints
        .iter()
        .map(|waypoint| Waypoint {
            position: Vec3 {
                x: waypoint.position.x,
                y: waypoint.position.y,
                z: waypoint.position.z + world.launch_surface_z,
            },
            hold_s: waypoint.hold_s,
        })
        .collect();

    resolved
}

pub fn collect_world_colliders(world: &WorldLayout) -> Vec<ObstacleBox> {
    let mut colliders = Vec::with_capacity(
        world.plaza_platforms.len() + world.landmark.collision_boxes.len() + world.buildings.len() + 1,
    );
    colliders.extend(world.plaza_platforms.iter().cloned());
    colliders.push(world.landmark.pedestal.clone());
    colliders.extend(world.landmark.collision_boxes.iter().cloned());
    colliders.extend(
        world
            .buildings
            .iter()
            .map(|building| building.collider.clone()),
    );
    colliders
}

fn generate_world_layout(seed: u32) -> WorldLayout {
    let grid_size = 7600.0;
    let block_size = 60.0;
    let road_width = 16.0;
    let plaza_half_extent = 170.0;
    let cell_size = block_size + road_width;
    let half_grid = grid_size * 0.5;
    let max_cell_index = (half_grid / cell_size) as i32;

    let plaza_base = ObstacleBox {
        center: Vec3 {
            x: 0.0,
            y: 0.0,
            z: -0.35,
        },
        size: Vec3 {
            x: plaza_half_extent * 2.0,
            y: plaza_half_extent * 2.0,
            z: 0.7,
        },
    };
    let plaza_platforms = vec![
        platform_box(0.0, 0.0, 116.0, 116.0, 3.0),
        platform_box(0.0, 0.0, 72.0, 72.0, 6.0),
        platform_box(0.0, 0.0, 42.0, 42.0, PLAZA_TOP_Z),
    ];
    let landmark = build_landmark(0.0, 0.0, PLAZA_TOP_Z);

    let mut buildings = Vec::new();
    let anchors = supertall_anchors();

    for anchor in anchors {
        let mut tower_rand = mulberry32(
            ((seed as i64 * 1009) ^ (anchor.x as i64 * 31) ^ (anchor.y as i64 * 17)) as u32,
        );
        let height = anchor.height * (0.9 + tower_rand.next() * 0.18);
        buildings.push(make_building(
            &mut tower_rand,
            anchor.x,
            anchor.y,
            anchor.width,
            anchor.depth,
            height,
        ));
    }

    for xi in -max_cell_index..=max_cell_index {
        let center_x = xi as f64 * cell_size;
        if center_x.abs() > half_grid - block_size * 0.5 {
            continue;
        }

        for yi in -max_cell_index..=max_cell_index {
            let center_y = yi as f64 * cell_size;
            if center_y.abs() > half_grid - block_size * 0.5 {
                continue;
            }

            if center_x.abs() < plaza_half_extent && center_y.abs() < plaza_half_extent {
                continue;
            }

            if anchors.iter().any(|anchor| {
                (center_x - anchor.x).abs() < 72.0 && (center_y - anchor.y).abs() < 72.0
            }) {
                continue;
            }

            let dist = center_x.hypot(center_y);
            let angle = center_y.atan2(center_x);
            let cell_seed = ((xi + 4096) as u32).wrapping_mul(73_856_093)
                ^ ((yi + 4096) as u32).wrapping_mul(19_349_663)
                ^ seed.wrapping_mul(83_492_791);
            let mut rand = mulberry32(cell_seed);

            let sector_density = clamp(
                0.9 + angle.sin() * 0.06 + (dist * 0.00035).cos() * 0.05 + rand.next() * 0.08,
                0.88,
                1.08,
            );

            let zone = if dist < plaza_half_extent + 420.0 {
                Zone::Downtown
            } else if dist < 1900.0 {
                Zone::Inner
            } else if dist < 3000.0 {
                Zone::Midrise
            } else {
                Zone::Boundary
            };

            let occupancy = match zone {
                Zone::Downtown => 0.995,
                Zone::Inner => 0.985,
                Zone::Midrise => 0.975,
                Zone::Boundary => 0.965,
            };
            if rand.next() > occupancy {
                continue;
            }

            let mut slots = build_slots(center_x, center_y, block_size, 2, 2);
            shuffle(&mut slots, &mut rand);

            let target_count = match zone {
                Zone::Downtown => 4,
                Zone::Inner => 4,
                Zone::Midrise => 3,
                Zone::Boundary => 3,
            };

            for slot in slots.into_iter().take(target_count) {
                let width_base = match zone {
                    Zone::Downtown => 12.0 + rand.next() * 8.0,
                    Zone::Inner => 13.0 + rand.next() * 10.0,
                    Zone::Midrise => 14.0 + rand.next() * 11.0,
                    Zone::Boundary => 15.0 + rand.next() * 12.0,
                };
                let depth_base = match zone {
                    Zone::Downtown => 12.0 + rand.next() * 8.0,
                    Zone::Inner => 13.0 + rand.next() * 10.0,
                    Zone::Midrise => 14.0 + rand.next() * 11.0,
                    Zone::Boundary => 15.0 + rand.next() * 12.0,
                };
                let width = clamp(width_base, 10.0, slot.max_width);
                let depth = clamp(depth_base, 10.0, slot.max_depth);
                let jitter_x = (rand.next() - 0.5) * slot.max_width * 0.16;
                let jitter_y = (rand.next() - 0.5) * slot.max_depth * 0.16;

                let mut height = match zone {
                    Zone::Downtown => 200.0 + rand.next() * 280.0 * sector_density,
                    Zone::Inner => 110.0 + rand.next() * 220.0 * sector_density,
                    Zone::Midrise => 70.0 + rand.next() * 150.0 * sector_density,
                    Zone::Boundary => 48.0 + rand.next() * 120.0 * sector_density,
                };
                if matches!(zone, Zone::Downtown) && rand.next() < 0.2 {
                    height += 120.0 + rand.next() * 200.0;
                }

                buildings.push(make_building(
                    &mut rand,
                    slot.x + jitter_x,
                    slot.y + jitter_y,
                    width,
                    depth,
                    height,
                ));
            }
        }
    }

    WorldLayout {
        seed,
        grid_size,
        block_size,
        road_width,
        plaza_half_extent,
        plaza_base,
        plaza_platforms,
        launch_surface_z: PLAZA_TOP_Z,
        spawn_position: Vec3 {
            x: -13.5,
            y: 0.0,
            z: PLAZA_TOP_Z + DRONE_SPAWN_RADIUS_M,
        },
        preview_yaw: 0.28,
        landmark,
        buildings,
    }
}

fn platform_box(x: f64, y: f64, width: f64, depth: f64, top_z: f64) -> ObstacleBox {
    ObstacleBox {
        center: Vec3 {
            x,
            y,
            z: top_z * 0.5,
        },
        size: Vec3 {
            x: width,
            y: depth,
            z: top_z,
        },
    }
}

fn build_landmark(x: f64, y: f64, platform_top_z: f64) -> WorldLandmark {
    let pedestal_height = 3.4;
    let pedestal_top = platform_top_z + pedestal_height;
    let pedestal = ObstacleBox {
        center: Vec3 {
            x,
            y,
            z: platform_top_z + pedestal_height * 0.5,
        },
        size: Vec3 {
            x: 10.0,
            y: 10.0,
            z: pedestal_height,
        },
    };

    let collision_boxes = vec![
        ObstacleBox {
            center: Vec3 {
                x,
                y,
                z: pedestal_top + 5.6,
            },
            size: Vec3 {
                x: 2.8,
                y: 2.8,
                z: 11.2,
            },
        },
        ObstacleBox {
            center: Vec3 {
                x,
                y,
                z: pedestal_top + 7.6,
            },
            size: Vec3 {
                x: 15.0,
                y: 2.4,
                z: 2.4,
            },
        },
        ObstacleBox {
            center: Vec3 {
                x,
                y,
                z: pedestal_top + 7.6,
            },
            size: Vec3 {
                x: 2.4,
                y: 15.0,
                z: 2.4,
            },
        },
    ];

    WorldLandmark {
        center: Vec3 {
            x,
            y,
            z: pedestal_top + 7.6,
        },
        pedestal,
        collision_boxes,
        scale: 1.0,
    }
}

fn make_building(
    rand: &mut Mulberry32,
    x: f64,
    y: f64,
    width: f64,
    depth: f64,
    height: f64,
) -> WorldBuilding {
    let color_variant = rand.next();
    let (color_r, color_g, color_b) = if color_variant < 0.3 {
        (
            0.12 + rand.next() * 0.08,
            0.14 + rand.next() * 0.1,
            0.18 + rand.next() * 0.12,
        )
    } else if color_variant < 0.6 {
        (
            0.35 + rand.next() * 0.15,
            0.33 + rand.next() * 0.15,
            0.32 + rand.next() * 0.12,
        )
    } else if color_variant < 0.85 {
        (
            0.4 + rand.next() * 0.15,
            0.35 + rand.next() * 0.12,
            0.28 + rand.next() * 0.1,
        )
    } else {
        (
            0.15 + rand.next() * 0.08,
            0.2 + rand.next() * 0.1,
            0.3 + rand.next() * 0.15,
        )
    };

    let floor_height = 3.5;
    let window_bay_width = 2.0;
    let floors = (height / floor_height).floor().max(1.0) as u32;
    let windows_per_floor = (width / window_bay_width).floor().max(1.0) as u32;
    let side_windows_per_floor = (depth / window_bay_width).floor().max(1.0) as u32;

    WorldBuilding {
        collider: ObstacleBox {
            center: Vec3 {
                x,
                y,
                z: height * 0.5,
            },
            size: Vec3 {
                x: width,
                y: depth,
                z: height,
            },
        },
        color_r,
        color_g,
        color_b,
        window_seed: rand.next() * 1000.0,
        floors,
        windows_per_floor,
        side_windows_per_floor,
        lit_percentage: 0.4 + rand.next() * 0.4,
    }
}

fn build_slots(
    center_x: f64,
    center_y: f64,
    block_size: f64,
    columns: usize,
    rows: usize,
) -> Vec<Slot> {
    let inset = if columns > 1 || rows > 1 { 4.0 } else { 6.0 };
    let usable = block_size - inset * 2.0;
    let cell_width = usable / columns as f64;
    let cell_depth = usable / rows as f64;
    let mut slots = Vec::with_capacity(columns * rows);

    for row in 0..rows {
        for col in 0..columns {
            slots.push(Slot {
                x: center_x - usable * 0.5 + cell_width * (col as f64 + 0.5),
                y: center_y - usable * 0.5 + cell_depth * (row as f64 + 0.5),
                max_width: cell_width - 3.0,
                max_depth: cell_depth - 3.0,
            });
        }
    }

    slots
}

fn supertall_anchors() -> [Anchor; 6] {
    [
        Anchor {
            x: -520.0,
            y: -280.0,
            width: 42.0,
            depth: 38.0,
            height: 760.0,
        },
        Anchor {
            x: 520.0,
            y: -220.0,
            width: 40.0,
            depth: 36.0,
            height: 700.0,
        },
        Anchor {
            x: -640.0,
            y: 120.0,
            width: 46.0,
            depth: 42.0,
            height: 980.0,
        },
        Anchor {
            x: 360.0,
            y: 560.0,
            width: 34.0,
            depth: 34.0,
            height: 560.0,
        },
        Anchor {
            x: 760.0,
            y: 420.0,
            width: 48.0,
            depth: 44.0,
            height: 1100.0,
        },
        Anchor {
            x: -860.0,
            y: 520.0,
            width: 40.0,
            depth: 36.0,
            height: 840.0,
        },
    ]
}

fn is_zero_vec(value: Vec3) -> bool {
    value.x.abs() < f64::EPSILON && value.y.abs() < f64::EPSILON && value.z.abs() < f64::EPSILON
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn shuffle<T>(items: &mut [T], rand: &mut Mulberry32) {
    for index in (1..items.len()).rev() {
        let swap_index = (rand.next() * (index as f64 + 1.0)).floor() as usize;
        items.swap(index, swap_index);
    }
}

#[derive(Clone, Copy)]
struct Anchor {
    x: f64,
    y: f64,
    width: f64,
    depth: f64,
    height: f64,
}

#[derive(Clone, Copy)]
struct Slot {
    x: f64,
    y: f64,
    max_width: f64,
    max_depth: f64,
}

#[derive(Clone, Copy)]
enum Zone {
    Downtown,
    Inner,
    Midrise,
    Boundary,
}

struct Mulberry32 {
    state: u32,
}

fn mulberry32(seed: u32) -> Mulberry32 {
    Mulberry32 { state: seed }
}

impl Mulberry32 {
    fn next(&mut self) -> f64 {
        self.state |= 0;
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = (self.state ^ (self.state >> 15)).wrapping_mul(1 | self.state);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

#[cfg(test)]
mod tests {
    use super::{PLAZA_TOP_Z, apply_world_to_scenario, generate_world_layout};
    use gust_types::{FaultProfile, ScenarioConfig, Vec3, Waypoint};

    #[test]
    fn world_layout_is_deterministic() {
        let first = generate_world_layout(42);
        let second = generate_world_layout(42);

        assert_eq!(first.seed, second.seed);
        assert_eq!(first.plaza_base, second.plaza_base);
        assert_eq!(first.plaza_platforms, second.plaza_platforms);
        assert_eq!(first.landmark.pedestal, second.landmark.pedestal);
        assert_eq!(first.buildings.len(), second.buildings.len());
        assert_eq!(first.buildings.first(), second.buildings.first());
        assert_eq!(first.buildings.last(), second.buildings.last());
    }

    #[test]
    fn plaza_void_stays_clear() {
        let world = generate_world_layout(42);
        let plaza_half_extent = world.plaza_half_extent;

        assert!(world.buildings.iter().all(|building| {
            let center = &building.collider.center;
            center.x.abs() >= plaza_half_extent || center.y.abs() >= plaza_half_extent
        }));
    }

    #[test]
    fn world_application_replaces_obstacles_and_lifts_waypoints() {
        let world = generate_world_layout(42);
        let base = ScenarioConfig {
            id: "city_flyover_sunny".into(),
            name: "City".into(),
            description: "City".into(),
            base_wind: Vec3::default(),
            gust_amplitude: 0.0,
            gust_cell_size: 1.0,
            duration_s: 1.0,
            faults: FaultProfile::default(),
            start_position: Vec3::default(),
            obstacles: Vec::new(),
            waypoints: vec![Waypoint {
                position: Vec3 {
                    x: 0.0,
                    y: 0.0,
                    z: 10.0,
                },
                hold_s: 1.0,
            }],
        };

        let resolved = apply_world_to_scenario(&base, &world);

        assert_eq!(resolved.start_position, world.spawn_position);
        assert_eq!(
            resolved.obstacles.len(),
            world.plaza_platforms.len() + world.landmark.collision_boxes.len() + world.buildings.len() + 1
        );
        assert_eq!(world.launch_surface_z, PLAZA_TOP_Z);
        assert!(resolved.waypoints[0].position.z > base.waypoints[0].position.z);
    }
}
