#pragma once

#include <cstdint>
#include <initializer_list>
#include <cstddef>
#include <map>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace satellite {

struct Value;
using Array = std::vector<Value>;
using Bytes = std::vector<std::uint8_t>;
using Object = std::map<std::string, Value>;

struct Value : std::variant<std::nullptr_t, bool, std::int64_t, double, std::string, Array, Bytes, Object> {
  using Base = std::variant<std::nullptr_t, bool, std::int64_t, double, std::string, Array, Bytes, Object>;
  using Base::Base;

  Value(const char* value) : Base(std::string(value)) {}
  Value(int value) : Base(static_cast<std::int64_t>(value)) {}
  Value(long value) : Base(static_cast<std::int64_t>(value)) {}
  Value(long long value) : Base(static_cast<std::int64_t>(value)) {}
  Value(unsigned int value) : Base(static_cast<std::int64_t>(value)) {}
  Value(unsigned long value) : Base(static_cast<std::int64_t>(value)) {}
  Value(unsigned long long value) : Base(static_cast<std::int64_t>(value)) {}
};

struct Error : std::runtime_error {
  std::string code;
  std::string source;
  std::string task;
  std::uint64_t ts{};

  explicit Error(std::string message) : std::runtime_error(message) {}
};

namespace clock {
inline std::uint64_t now_ms() { return 0; }
}

namespace bus {
struct Handle {
  Object transact(const Object&) { return {}; }
  void close() {}
};

inline Handle open(std::string_view, const Object&) { return {}; }
}

namespace device {
struct DeviceHandle {
  Object getBusVoltage(std::string_view) { return {}; }
  void setOutput(std::string_view, bool) {}
};

template <typename Driver>
inline void register_driver(std::string_view, const Object&) {}

inline DeviceHandle acquire(std::string_view) { return {}; }
inline void release(std::string_view) {}
}

namespace telemetry {
inline void emit(std::string_view, const Value&) {}
inline Object snapshot(const Object&) { return {}; }

template <typename Callback>
inline void watch(std::string_view, const Object&, Callback&&) {}
}

namespace fault {
struct Context {
  int count{};
};

inline void raise(std::string_view, const Object&) {}

template <typename Handler>
inline void handle(std::string_view, Handler&&) {}

inline std::vector<Object> list() { return {}; }
inline void escalate(const Context&) {}
}

namespace task {
struct Context {
  int iteration{};
  void stop() {}
};

template <typename Callback>
inline void once(std::string_view, Callback&&) {}

template <typename Callback>
inline void every(std::string_view, std::string_view, Callback&&) {}

template <typename Callback>
inline void on(std::string_view, Callback&&) {}

inline void start() {}
inline void shutdown(const Object&) {}
inline void pause(std::string_view, std::string_view) {}
}

}  // namespace satellite
