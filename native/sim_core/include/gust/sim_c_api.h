#ifndef GUST_SIM_C_API_H
#define GUST_SIM_C_API_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define GUST_MAX_OBSTACLES 16
#define GUST_MAX_WAYPOINTS 16

typedef struct GustVec3 {
  double x;
  double y;
  double z;
} GustVec3;

typedef struct GustObstacleBox {
  GustVec3 center;
  GustVec3 size;
} GustObstacleBox;

typedef struct GustWaypoint {
  GustVec3 position;
  double hold_s;
} GustWaypoint;

typedef struct GustFaultProfile {
  uint32_t gps_dropout_enabled;
  double altimeter_bias_m;
  double imu_noise_scale;
} GustFaultProfile;

typedef struct GustScenarioConfig {
  GustVec3 base_wind;
  double gust_amplitude;
  double gust_cell_size;
  double duration_s;
  GustFaultProfile faults;
  uint32_t obstacle_count;
  GustObstacleBox obstacles[GUST_MAX_OBSTACLES];
  uint32_t waypoint_count;
  GustWaypoint waypoints[GUST_MAX_WAYPOINTS];
} GustScenarioConfig;

typedef struct GustRotorCommand {
  double normalized[4];
} GustRotorCommand;

typedef struct GustSensorPacket {
  GustVec3 gps_position;
  uint32_t gps_valid;
  GustVec3 imu_accel;
  GustVec3 imu_gyro;
  double altimeter_altitude;
  uint32_t altimeter_valid;
} GustSensorPacket;

typedef struct GustDroneFrame {
  GustVec3 position;
  GustVec3 velocity;
  GustVec3 euler;
  GustVec3 angular_velocity;
  double rotor_rpm[4];
  uint32_t collision;
  double closest_obstacle_distance;
  double recovery_margin;
} GustDroneFrame;

typedef struct GustEnvironmentFrame {
  GustVec3 wind_world;
  double gust_strength;
  double turbulence_index;
} GustEnvironmentFrame;

typedef struct GustStateFrame {
  uint64_t tick;
  double sim_time_s;
  GustDroneFrame drone;
  GustSensorPacket sensors;
  GustEnvironmentFrame environment;
  uint32_t obstacle_count;
  GustObstacleBox obstacles[GUST_MAX_OBSTACLES];
  uint32_t waypoint_count;
  GustWaypoint waypoints[GUST_MAX_WAYPOINTS];
} GustStateFrame;

typedef struct GustSimHandle GustSimHandle;

GustSimHandle *gust_sim_create(const GustScenarioConfig *config);
void gust_sim_destroy(GustSimHandle *handle);
void gust_sim_reset(GustSimHandle *handle, const GustScenarioConfig *config);
void gust_sim_set_rotor_command(GustSimHandle *handle, GustRotorCommand command);
void gust_sim_step(GustSimHandle *handle, double dt);
GustStateFrame gust_sim_get_frame(const GustSimHandle *handle);

#ifdef __cplusplus
}
#endif

#endif

