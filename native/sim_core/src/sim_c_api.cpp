#include "gust/sim_c_api.h"

#include "sim.hpp"

#include <algorithm>
#include <array>
#include <utility>

using gust::sim::Obstacle;
using gust::sim::Scenario;
using gust::sim::Simulator;
using gust::sim::Vec3;
using gust::sim::Waypoint;

namespace {

Vec3 from_c(const GustVec3 &value) {
  return {value.x, value.y, value.z};
}

GustVec3 to_c(const Vec3 &value) {
  return {value.x, value.y, value.z};
}

Scenario from_c(const GustScenarioConfig &config) {
  Scenario scenario;
  scenario.base_wind = from_c(config.base_wind);
  scenario.gust_amplitude = config.gust_amplitude;
  scenario.gust_cell_size = config.gust_cell_size;
  scenario.duration_s = config.duration_s;
  scenario.faults = {
      config.faults.gps_dropout_enabled != 0,
      config.faults.altimeter_bias_m,
      config.faults.imu_noise_scale,
  };

  const auto obstacle_count =
      std::min<std::uint32_t>(config.obstacle_count, GUST_MAX_OBSTACLES);
  scenario.obstacles.reserve(obstacle_count);
  for (std::uint32_t i = 0; i < obstacle_count; ++i) {
    scenario.obstacles.push_back(
        {from_c(config.obstacles[i].center), from_c(config.obstacles[i].size)});
  }

  const auto waypoint_count =
      std::min<std::uint32_t>(config.waypoint_count, GUST_MAX_WAYPOINTS);
  scenario.waypoints.reserve(waypoint_count);
  for (std::uint32_t i = 0; i < waypoint_count; ++i) {
    scenario.waypoints.push_back(
        {from_c(config.waypoints[i].position), config.waypoints[i].hold_s});
  }

  return scenario;
}

GustStateFrame to_c(const gust::sim::StateFrame &frame) {
  GustStateFrame out{};
  out.tick = frame.tick;
  out.sim_time_s = frame.sim_time_s;
  out.drone.position = to_c(frame.drone.position);
  out.drone.velocity = to_c(frame.drone.velocity);
  out.drone.euler = to_c(frame.drone.euler);
  out.drone.angular_velocity = to_c(frame.drone.angular_velocity);
  std::copy(frame.drone.rotor_rpm.begin(), frame.drone.rotor_rpm.end(), out.drone.rotor_rpm);
  out.drone.collision = frame.drone.collision ? 1u : 0u;
  out.drone.closest_obstacle_distance = frame.drone.closest_obstacle_distance;
  out.drone.recovery_margin = frame.drone.recovery_margin;
  out.drone.health = frame.drone.health;
  out.sensors.gps_position = to_c(frame.sensors.gps_position);
  out.sensors.gps_valid = frame.sensors.gps_valid ? 1u : 0u;
  out.sensors.imu_accel = to_c(frame.sensors.imu_accel);
  out.sensors.imu_gyro = to_c(frame.sensors.imu_gyro);
  out.sensors.altimeter_altitude = frame.sensors.altimeter_altitude;
  out.sensors.altimeter_valid = frame.sensors.altimeter_valid ? 1u : 0u;
  out.environment.wind_world = to_c(frame.environment.wind_world);
  out.environment.gust_strength = frame.environment.gust_strength;
  out.environment.turbulence_index = frame.environment.turbulence_index;

  out.obstacle_count =
      std::min<std::uint32_t>(static_cast<std::uint32_t>(frame.obstacles.size()), GUST_MAX_OBSTACLES);
  for (std::uint32_t i = 0; i < out.obstacle_count; ++i) {
    out.obstacles[i].center = to_c(frame.obstacles[i].center);
    out.obstacles[i].size = to_c(frame.obstacles[i].size);
  }

  out.waypoint_count =
      std::min<std::uint32_t>(static_cast<std::uint32_t>(frame.waypoints.size()), GUST_MAX_WAYPOINTS);
  for (std::uint32_t i = 0; i < out.waypoint_count; ++i) {
    out.waypoints[i].position = to_c(frame.waypoints[i].position);
    out.waypoints[i].hold_s = frame.waypoints[i].hold_s;
  }

  return out;
}

}  // namespace

struct GustSimHandle {
  explicit GustSimHandle(Scenario scenario) : simulator(std::move(scenario)) {}

  Simulator simulator;
};

extern "C" GustSimHandle *gust_sim_create(const GustScenarioConfig *config) {
  try {
    if (config == nullptr) {
      return nullptr;
    }

    return new GustSimHandle(from_c(*config));
  } catch (...) {
    return nullptr;
  }
}

extern "C" void gust_sim_destroy(GustSimHandle *handle) {
  delete handle;
}

extern "C" void gust_sim_reset(GustSimHandle *handle, const GustScenarioConfig *config) {
  try {
    if (handle == nullptr || config == nullptr) {
      return;
    }

    handle->simulator.reset(from_c(*config));
  } catch (...) {
    return;
  }
}

extern "C" void gust_sim_set_rotor_command(GustSimHandle *handle, GustRotorCommand command) {
  try {
    if (handle == nullptr) {
      return;
    }

    handle->simulator.set_rotor_command({
        command.normalized[0],
        command.normalized[1],
        command.normalized[2],
        command.normalized[3],
    });
  } catch (...) {
    return;
  }
}

extern "C" void gust_sim_step(GustSimHandle *handle, double dt) {
  try {
    if (handle == nullptr) {
      return;
    }

    handle->simulator.step(dt);
  } catch (...) {
    return;
  }
}

extern "C" void gust_sim_take_damage(GustSimHandle *handle, double amount) {
  try {
    if (handle == nullptr) {
      return;
    }

    handle->simulator.take_damage(amount);
  } catch (...) {
    return;
  }
}

extern "C" GustStateFrame gust_sim_get_frame(const GustSimHandle *handle) {
  try {
    if (handle == nullptr) {
      return GustStateFrame{};
    }

    return to_c(handle->simulator.snapshot());
  } catch (...) {
    return GustStateFrame{};
  }
}
