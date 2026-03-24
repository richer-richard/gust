#include "sim.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>

namespace gust::sim {

namespace {

constexpr double kGravity = 9.81;
constexpr double kMassKg = 1.55;
constexpr double kArmLengthM = 0.22;
constexpr double kMaxThrustPerRotorN = 15.0;
constexpr double kYawTorqueCoeff = 0.07;
constexpr double kAngularDamping = 0.16;
constexpr double kLinearDrag = 1.18;
constexpr double kDroneRadius = 0.26;
constexpr double kMaxRpm = 10000.0;
constexpr std::array<double, 3> kInertia = {0.028, 0.028, 0.052};

Vec3 make_vec(double x, double y, double z) {
  return Vec3{x, y, z};
}

Vec3 operator+(const Vec3 &lhs, const Vec3 &rhs) {
  return {lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z};
}

Vec3 operator-(const Vec3 &lhs, const Vec3 &rhs) {
  return {lhs.x - rhs.x, lhs.y - rhs.y, lhs.z - rhs.z};
}

Vec3 operator*(const Vec3 &lhs, double scalar) {
  return {lhs.x * scalar, lhs.y * scalar, lhs.z * scalar};
}

Vec3 operator*(double scalar, const Vec3 &rhs) {
  return rhs * scalar;
}

Vec3 operator/(const Vec3 &lhs, double scalar) {
  return {lhs.x / scalar, lhs.y / scalar, lhs.z / scalar};
}

Vec3 &operator+=(Vec3 &lhs, const Vec3 &rhs) {
  lhs = lhs + rhs;
  return lhs;
}

Vec3 &operator-=(Vec3 &lhs, const Vec3 &rhs) {
  lhs = lhs - rhs;
  return lhs;
}

Vec3 &operator*=(Vec3 &lhs, double scalar) {
  lhs = lhs * scalar;
  return lhs;
}

double dot(const Vec3 &lhs, const Vec3 &rhs) {
  return lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z;
}

double length(const Vec3 &value) {
  return std::sqrt(dot(value, value));
}

Vec3 normalized(const Vec3 &value) {
  const auto magnitude = length(value);
  if (magnitude < 1e-8) {
    return {};
  }
  return value / magnitude;
}

Vec3 clamp_components(const Vec3 &value, double low, double high) {
  return {
      std::clamp(value.x, low, high),
      std::clamp(value.y, low, high),
      std::clamp(value.z, low, high),
  };
}

Vec3 rotate_body_to_world(const Vec3 &body, const Vec3 &euler) {
  const auto cr = std::cos(euler.x);
  const auto sr = std::sin(euler.x);
  const auto cp = std::cos(euler.y);
  const auto sp = std::sin(euler.y);
  const auto cy = std::cos(euler.z);
  const auto sy = std::sin(euler.z);

  return {
      body.x * (cy * cp) +
          body.y * (cy * sp * sr - sy * cr) +
          body.z * (cy * sp * cr + sy * sr),
      body.x * (sy * cp) +
          body.y * (sy * sp * sr + cy * cr) +
          body.z * (sy * sp * cr - cy * sr),
      body.x * (-sp) + body.y * (cp * sr) + body.z * (cp * cr),
  };
}

Vec3 euler_rate_from_body_rate(const Vec3 &euler, const Vec3 &body_rate) {
  const auto phi = euler.x;
  const auto theta = std::clamp(euler.y, -1.4, 1.4);
  const auto p = body_rate.x;
  const auto q = body_rate.y;
  const auto r = body_rate.z;
  const auto tan_theta = std::tan(theta);
  const auto sec_theta = 1.0 / std::cos(theta);

  return {
      p + q * std::sin(phi) * tan_theta + r * std::cos(phi) * tan_theta,
      q * std::cos(phi) - r * std::sin(phi),
      q * std::sin(phi) * sec_theta + r * std::cos(phi) * sec_theta,
  };
}

Vec3 closest_point_on_box(const Vec3 &point, const Obstacle &obstacle) {
  const auto half = obstacle.size * 0.5;
  return {
      std::clamp(point.x, obstacle.center.x - half.x, obstacle.center.x + half.x),
      std::clamp(point.y, obstacle.center.y - half.y, obstacle.center.y + half.y),
      std::clamp(point.z, obstacle.center.z - half.z, obstacle.center.z + half.z),
  };
}

double sphere_to_box_distance(const Vec3 &center, const Obstacle &obstacle) {
  const auto closest = closest_point_on_box(center, obstacle);
  return length(center - closest) - kDroneRadius;
}

double wrap_angle(double angle) {
  constexpr double kPi = 3.14159265358979323846;
  constexpr double kTwoPi = 2.0 * kPi;
  angle = std::fmod(angle + kPi, kTwoPi);
  if (angle < 0.0) {
    angle += kTwoPi;
  }
  return angle - kPi;
}

}  // namespace

Simulator::Simulator(Scenario scenario) {
  reset(std::move(scenario));
}

void Simulator::reset(Scenario scenario) {
  scenario_ = std::move(scenario);
  tick_ = 0;
  sim_time_s_ = 0.0;
  position_ = {0.0, 0.0, 0.0};
  velocity_ = {};
  euler_ = {};
  angular_velocity_ = {};
  last_world_accel_ = {};
  last_gps_position_ = position_;
  current_wind_ = scenario_.base_wind;
  rotor_command_ = {0.0, 0.0, 0.0, 0.0};
  rotor_rpm_ = {0.0, 0.0, 0.0, 0.0};
  collision_ = false;
  closest_obstacle_distance_ = 50.0;
  recovery_margin_ = 1.0;
  gust_strength_ = 0.0;
  turbulence_index_ = 0.0;
  health_ = 1.0;
  sensor_packet_ = build_sensor_packet(last_world_accel_);
}

void Simulator::set_rotor_command(const std::array<double, 4> &command) {
  for (std::size_t i = 0; i < rotor_command_.size(); ++i) {
    rotor_command_[i] = std::clamp(command[i], 0.0, 1.0);
  }
}

Vec3 Simulator::sample_wind() const {
  const auto cell = std::max(2.0, scenario_.gust_cell_size);
  const auto gust = make_vec(
      scenario_.gust_amplitude *
          std::sin(0.63 * sim_time_s_ + position_.x / cell + position_.z * 0.1),
      scenario_.gust_amplitude * 0.8 *
          std::cos(0.37 * sim_time_s_ + position_.y / cell),
      scenario_.gust_amplitude * 0.25 *
          std::sin(0.81 * sim_time_s_ + (position_.x + position_.y) / cell));

  return scenario_.base_wind + gust;
}

void Simulator::step(double dt) {
  if (dt <= 0.0) {
    return;
  }

  tick_ += 1;
  sim_time_s_ += dt;
  collision_ = false;

  current_wind_ = sample_wind();
  const auto gust = current_wind_ - scenario_.base_wind;
  gust_strength_ = length(gust);
  turbulence_index_ =
      std::clamp(gust_strength_ / std::max(0.5, scenario_.gust_amplitude * 1.6), 0.0, 1.0);

  // Health-based throttle cap: at low health rotors are limited
  const auto health_cap = (health_ > 0.0) ? ((health_ < 0.2) ? 0.6 : 1.0) : 0.0;

  std::array<double, 4> thrust{};
  double total_thrust = 0.0;
  for (std::size_t i = 0; i < rotor_command_.size(); ++i) {
    const auto cmd = std::clamp(rotor_command_[i] * health_cap, 0.0, 1.0);
    thrust[i] = cmd * kMaxThrustPerRotorN;
    total_thrust += thrust[i];
    rotor_rpm_[i] = cmd < 1e-4 ? 0.0 : 2400.0 + std::sqrt(cmd) * (kMaxRpm - 2400.0);
  }

  const bool grounded_idle =
      position_.z <= 0.02 &&
      total_thrust < (kMassKg * kGravity * 0.95) &&
      velocity_.z <= 0.25;

  Vec3 torque{
      kArmLengthM * ((thrust[1] + thrust[2]) - (thrust[0] + thrust[3])) * 0.5,
      kArmLengthM * ((thrust[2] + thrust[3]) - (thrust[0] + thrust[1])) * 0.5,
      kYawTorqueCoeff * ((thrust[0] + thrust[2]) - (thrust[1] + thrust[3])),
  };
  torque -= angular_velocity_ * kAngularDamping;

  Vec3 angular_accel{
      torque.x / kInertia[0],
      torque.y / kInertia[1],
      torque.z / kInertia[2],
  };
  angular_velocity_ += angular_accel * dt;
  angular_velocity_ = clamp_components(angular_velocity_, -4.5, 4.5);

  euler_ += euler_rate_from_body_rate(euler_, angular_velocity_) * dt;
  euler_.x = std::clamp(euler_.x, -1.1, 1.1);
  euler_.y = std::clamp(euler_.y, -1.1, 1.1);
  euler_.z = wrap_angle(euler_.z);

  const auto thrust_world = rotate_body_to_world(make_vec(0.0, 0.0, total_thrust), euler_);
  const auto gravity = make_vec(0.0, 0.0, -kGravity);
  const auto air_relative = current_wind_ - velocity_;
  const auto drag_accel = air_relative * (kLinearDrag / kMassKg);
  const auto world_accel = gravity + (thrust_world / kMassKg) + drag_accel;

  if (grounded_idle) {
    velocity_.x *= 0.72;
    velocity_.y *= 0.72;
    velocity_.z = 0.0;
    position_.z = 0.0;
    angular_velocity_ *= 0.72;
    last_world_accel_ = {};
    resolve_collisions();
    update_recovery_margin();
    sensor_packet_ = build_sensor_packet(last_world_accel_);
    return;
  }

  velocity_ += world_accel * dt;
  position_ += velocity_ * dt;
  last_world_accel_ = world_accel;

  resolve_collisions();
  update_recovery_margin();
  sensor_packet_ = build_sensor_packet(last_world_accel_);
}

void Simulator::resolve_collisions() {
  closest_obstacle_distance_ = std::numeric_limits<double>::max();

  if (position_.z < 0.0) {
    position_.z = 0.0;
    velocity_.x *= 0.82;
    velocity_.y *= 0.82;
    velocity_.z = std::max(0.0, velocity_.z);
    angular_velocity_ *= 0.84;
    collision_ = true;
  }

  for (const auto &obstacle : scenario_.obstacles) {
    const auto signed_distance = sphere_to_box_distance(position_, obstacle);
    closest_obstacle_distance_ = std::min(closest_obstacle_distance_, signed_distance);

    if (signed_distance >= 0.0) {
      continue;
    }

    const auto closest = closest_point_on_box(position_, obstacle);
    auto normal = normalized(position_ - closest);
    if (length(normal) < 1e-6) {
      const auto delta = position_ - obstacle.center;
      const auto half = obstacle.size * 0.5;
      const auto px = half.x - std::abs(delta.x);
      const auto py = half.y - std::abs(delta.y);
      const auto pz = half.z - std::abs(delta.z);

      if (px <= py && px <= pz) {
        normal = make_vec(delta.x >= 0.0 ? 1.0 : -1.0, 0.0, 0.0);
      } else if (py <= px && py <= pz) {
        normal = make_vec(0.0, delta.y >= 0.0 ? 1.0 : -1.0, 0.0);
      } else {
        normal = make_vec(0.0, 0.0, delta.z >= 0.0 ? 1.0 : -1.0);
      }
    }

    position_ += normal * (-signed_distance + 1e-3);
    const auto normal_speed = dot(velocity_, normal);
    if (normal_speed < 0.0) {
      // Velocity-scaled restitution: harder hits bounce more
      const auto restitution = 1.25 + std::clamp(std::abs(normal_speed) * 0.04, 0.0, 0.5);
      velocity_ -= normal * (restitution * normal_speed);
      velocity_ *= 0.82;

      // Apply damage proportional to impact speed
      const auto impact_damage = std::clamp(std::abs(normal_speed) * 0.04, 0.0, 0.25);
      health_ = std::max(0.0, health_ - impact_damage);
    }

    angular_velocity_ *= 0.88;
    collision_ = true;
  }

  if (closest_obstacle_distance_ == std::numeric_limits<double>::max()) {
    closest_obstacle_distance_ = 50.0;
  }
}

void Simulator::update_recovery_margin() {
  const auto altitude_margin = std::clamp(position_.z / 3.0, 0.0, 1.0);
  const auto attitude_margin =
      1.0 - std::clamp(std::max(std::abs(euler_.x), std::abs(euler_.y)) / 0.95, 0.0, 1.0);
  const auto obstacle_margin =
      std::clamp(closest_obstacle_distance_ / 4.0, 0.0, 1.0);
  recovery_margin_ = std::min({altitude_margin, attitude_margin, obstacle_margin});
}

SensorPacket Simulator::build_sensor_packet(const Vec3 &world_accel) {
  const auto noise = [this](double scale) {
    return unit_noise_(rng_) * scale;
  };

  SensorPacket packet;
  packet.gps_valid = true;

  if (scenario_.faults.gps_dropout_enabled) {
    const auto cycle = std::fmod(sim_time_s_, 6.5);
    packet.gps_valid = !(cycle > 2.4 && cycle < 4.1) && turbulence_index_ < 0.92;
  }

  if (packet.gps_valid) {
    packet.gps_position = position_ +
        make_vec(noise(0.08), noise(0.08), noise(0.05));
    last_gps_position_ = packet.gps_position;
  } else {
    packet.gps_position = last_gps_position_;
  }

  packet.altimeter_valid = true;
  if (std::abs(scenario_.faults.altimeter_bias_m) > 0.45) {
    const auto cycle = std::fmod(sim_time_s_, 9.0);
    packet.altimeter_valid = cycle < 7.4;
  }
  packet.altimeter_altitude =
      position_.z + scenario_.faults.altimeter_bias_m + noise(0.03);

  packet.imu_accel =
      world_accel + make_vec(noise(0.18), noise(0.18), noise(0.12)) *
          (1.0 + scenario_.faults.imu_noise_scale);
  packet.imu_gyro =
      angular_velocity_ +
      make_vec(noise(0.012), noise(0.012), noise(0.01)) *
          (1.0 + scenario_.faults.imu_noise_scale);

  return packet;
}

StateFrame Simulator::snapshot() const {
  StateFrame frame;
  frame.tick = tick_;
  frame.sim_time_s = sim_time_s_;
  frame.drone.position = position_;
  frame.drone.velocity = velocity_;
  frame.drone.euler = euler_;
  frame.drone.angular_velocity = angular_velocity_;
  frame.drone.rotor_rpm = rotor_rpm_;
  frame.drone.collision = collision_;
  frame.drone.closest_obstacle_distance = closest_obstacle_distance_;
  frame.drone.recovery_margin = recovery_margin_;
  frame.drone.health = health_;
  frame.environment.wind_world = current_wind_;
  frame.environment.gust_strength = gust_strength_;
  frame.environment.turbulence_index = turbulence_index_;
  frame.obstacles = scenario_.obstacles;
  frame.waypoints = scenario_.waypoints;
  frame.sensors = sensor_packet_;
  return frame;
}

void Simulator::take_damage(double amount) {
  health_ = std::max(0.0, health_ - std::clamp(amount, 0.0, 1.0));
}

}  // namespace gust::sim
