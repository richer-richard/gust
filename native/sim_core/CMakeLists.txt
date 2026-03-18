cmake_minimum_required(VERSION 3.20)
project(gust_sim_core LANGUAGES CXX)

add_library(gust_sim_core STATIC
  src/sim.cpp
  src/sim_c_api.cpp
)

target_include_directories(gust_sim_core
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_features(gust_sim_core PUBLIC cxx_std_20)
set_target_properties(gust_sim_core PROPERTIES POSITION_INDEPENDENT_CODE ON)

install(TARGETS gust_sim_core DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)
