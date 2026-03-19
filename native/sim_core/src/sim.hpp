#pragma once

#include <array>
#include <cstdint>
#include <random>
#include <vector>

namespace gust::sim {

struct Vec3 {
  double x = 0.0;
  double y = 0.0;
  double z = 0.0;
};

struct Obstacle {
  Vec3 center;
  Vec3 size;
};

struct Waypoint {
  Vec3 position;
  double hold_s = 0.0;
};

struct FaultProfile {
  bool gps_dropout_enabled = false;
  double altimeter_bias_m = 0.0;
  double imu_noise_scale = 0.0;
};

struct Scenario {
  Vec3 base_wind;
  double gust_amplitude = 0.0;
  double gust_cell_size = 6.0;
  double duration_s = 30.0;
  FaultProfile faults;
  std::vector<Obstacle> obstacles;
  std::vector<Waypoint> waypoints;
};

struct SensorPacket {
  Vec3 gps_position;
  bool gps_valid = true;
  Vec3 imu_accel;
  Vec3 imu_gyro;
  double altimeter_altitude = 0.0;
  bool altimeter_valid = true;
};

struct DroneFrame {
  Vec3 position;
  Vec3 velocity;
  Vec3 euler;
  Vec3 angular_velocity;
  std::array<double, 4> rotor_rpm{};
  bool collision = false;
  double closest_obstacle_distance = 0.0;
  double recovery_margin = 0.0;
  double health = 1.0;
};

struct EnvironmentFrame {
  Vec3 wind_world;
  double gust_strength = 0.0;
  double turbulence_index = 0.0;
};

struct StateFrame {
  std::uint64_t tick = 0;
  double sim_time_s = 0.0;
  DroneFrame drone;
  SensorPacket sensors;
  EnvironmentFrame environment;
  std::vector<Obstacle> obstacles;
  std::vector<Waypoint> waypoints;
};

class Simulator {
 public:
  explicit Simulator(Scenario scenario);

  void reset(Scenario scenario);
  void set_rotor_command(const std::array<double, 4> &command);
  void step(double dt);
  void take_damage(double amount);
  [[nodiscard]] StateFrame snapshot() const;

 private:
  [[nodiscard]] Vec3 sample_wind() const;
  [[nodiscard]] SensorPacket build_sensor_packet(const Vec3 &world_accel);
  void resolve_collisions();
  void update_recovery_margin();

  Scenario scenario_;
  std::mt19937 rng_{7};
  std::normal_distribution<double> unit_noise_{0.0, 1.0};

  std::uint64_t tick_ = 0;
  double sim_time_s_ = 0.0;

  Vec3 position_{0.0, 0.0, 25.0};
  Vec3 velocity_{};
  Vec3 euler_{};
  Vec3 angular_velocity_{};
  Vec3 last_world_accel_{};
  Vec3 last_gps_position_{0.0, 0.0, 25.0};
  Vec3 current_wind_{};
  std::array<double, 4> rotor_command_{0.62, 0.62, 0.62, 0.62};
  std::array<double, 4> rotor_rpm_{};
  bool collision_ = false;
  double closest_obstacle_distance_ = 50.0;
  double recovery_margin_ = 1.0;
  double gust_strength_ = 0.0;
  double turbulence_index_ = 0.0;
  double health_ = 1.0;
};

}  // namespace gust::sim

