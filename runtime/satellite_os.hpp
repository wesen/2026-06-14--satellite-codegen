#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
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
  Value(std::string_view value) : Base(std::string(value)) {}
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

  explicit Error(std::string message) : std::runtime_error(std::move(message)) {}
};

namespace task {
struct Context {
  int iteration{};
  bool stopped{};

  void stop() { stopped = true; }
};
}  // namespace task

namespace fault {
struct Context {
  std::string name;
  int count{};
  std::string status{"WARN"};
};
}  // namespace fault

namespace emulator {

struct TelemetryFrame {
  std::uint64_t ts{};
  std::string metric;
  Value value;
};

struct Watcher {
  std::string metric;
  Object criteria;
  std::function<void(const Object&)> callback;
};

struct TaskRegistration {
  std::string name;
  std::string period;
  std::function<void(task::Context&)> callback;
  bool stopped{};
};

struct EventRegistration {
  std::string pattern;
  std::function<void(const Object&)> callback;
};

struct State {
  std::string demo_name{"default"};
  std::uint64_t now_ms{1'718'320'000'000ULL};
  int recurring_iterations{3};
  bool shutdown_requested{};
  bool inject_bus_timeout{};
  bool bus_timeout_consumed{};
  double panel_temp_c{42.7};
  double eps_voltage{3.31};

  std::map<std::string, bool> bus_locks;
  std::map<std::string, Object> registered_devices;
  std::map<std::string, bool> acquired_devices;
  std::map<std::string, bool> outputs;
  std::map<std::string, int> fault_counts;
  std::map<std::string, std::function<void(fault::Context&)>> fault_handlers;

  std::vector<TelemetryFrame> telemetry;
  std::vector<Watcher> watchers;
  std::vector<TaskRegistration> once_tasks;
  std::vector<TaskRegistration> recurring_tasks;
  std::vector<EventRegistration> event_handlers;
  std::vector<std::pair<std::string, Object>> command_events;
  std::vector<std::string> log;
  std::vector<std::string> errors;
};

inline State& state() {
  static State s;
  return s;
}

inline const Value::Base& base(const Value& value) {
  return static_cast<const Value::Base&>(value);
}

inline Value::Base& base(Value& value) {
  return static_cast<Value::Base&>(value);
}

inline const Value* find(const Object& object, std::string_view key) {
  auto it = object.find(std::string(key));
  return it == object.end() ? nullptr : &it->second;
}

inline std::int64_t as_int(const Value* value, std::int64_t fallback = 0) {
  if (!value) return fallback;
  if (const auto* v = std::get_if<std::int64_t>(&base(*value))) return *v;
  if (const auto* v = std::get_if<double>(&base(*value))) return static_cast<std::int64_t>(*v);
  return fallback;
}

inline double as_double(const Value* value, double fallback = 0.0) {
  if (!value) return fallback;
  if (const auto* v = std::get_if<double>(&base(*value))) return *v;
  if (const auto* v = std::get_if<std::int64_t>(&base(*value))) return static_cast<double>(*v);
  return fallback;
}

inline std::string as_string(const Value* value, std::string fallback = {}) {
  if (!value) return fallback;
  if (const auto* v = std::get_if<std::string>(&base(*value))) return *v;
  return fallback;
}

inline std::int64_t object_int(const Object& object, std::string_view key, std::int64_t fallback = 0) {
  return as_int(find(object, key), fallback);
}

inline double object_double(const Object& object, std::string_view key, double fallback = 0.0) {
  return as_double(find(object, key), fallback);
}

inline std::string format_value(const Value& value);

inline std::string format_object(const Object& object) {
  std::ostringstream out;
  out << "{";
  bool first = true;
  for (const auto& [key, value] : object) {
    if (!first) out << ", ";
    first = false;
    out << key << ": " << format_value(value);
  }
  out << "}";
  return out.str();
}

inline std::string format_value(const Value& value) {
  const auto& v = base(value);
  return std::visit([](const auto& item) -> std::string {
    using T = std::decay_t<decltype(item)>;
    if constexpr (std::is_same_v<T, std::nullptr_t>) {
      return "null";
    } else if constexpr (std::is_same_v<T, bool>) {
      return item ? "true" : "false";
    } else if constexpr (std::is_same_v<T, std::int64_t>) {
      return std::to_string(item);
    } else if constexpr (std::is_same_v<T, double>) {
      std::ostringstream out;
      out << item;
      return out.str();
    } else if constexpr (std::is_same_v<T, std::string>) {
      return '"' + item + '"';
    } else if constexpr (std::is_same_v<T, Bytes>) {
      std::ostringstream out;
      out << "bytes[";
      for (std::size_t i = 0; i < item.size(); ++i) {
        if (i) out << ' ';
        out << static_cast<int>(item[i]);
      }
      out << "]";
      return out.str();
    } else if constexpr (std::is_same_v<T, Array>) {
      std::ostringstream out;
      out << "[";
      for (std::size_t i = 0; i < item.size(); ++i) {
        if (i) out << ", ";
        out << format_value(item[i]);
      }
      out << "]";
      return out.str();
    } else if constexpr (std::is_same_v<T, Object>) {
      return format_object(item);
    }
  }, v);
}

inline void log(std::string message) {
  state().log.push_back(std::move(message));
}

inline void reset() {
  state() = State{};
}

inline bool contains(std::string_view haystack, std::string_view needle) {
  return haystack.find(needle) != std::string_view::npos;
}

inline void configure_demo(std::string_view demo_name) {
  State& s = state();
  s.demo_name = std::string(demo_name);
  if (const char* env = std::getenv("SATELLITE_EMU_ITERATIONS")) {
    s.recurring_iterations = std::max(1, std::atoi(env));
  }
  if (contains(demo_name, "fault")) {
    s.inject_bus_timeout = true;
  }
  if (contains(demo_name, "thermal") || contains(demo_name, "realistic")) {
    s.panel_temp_c = 91.5;
  }
  if (contains(demo_name, "command") || contains(demo_name, "realistic")) {
    s.command_events.push_back({"cmd:reboot", Object{{"source", "ground"}, {"timestamp", static_cast<long long>(s.now_ms)}}});
  }
  if (contains(demo_name, "realistic")) {
    s.recurring_iterations = std::max(s.recurring_iterations, 4);
    s.eps_voltage = 2.82;
  }
  log("configured demo " + s.demo_name);
}

inline void configure_from_argv(int argc, char** argv) {
  reset();
  configure_demo(argc > 1 ? std::string_view(argv[1]) : std::string_view("default"));
}

inline bool report(std::ostream& out = std::cout) {
  State& s = state();
  bool ok = s.errors.empty();
  out << "[emu] demo=" << s.demo_name << " telemetry=" << s.telemetry.size()
      << " faults=" << s.fault_counts.size() << " log=" << s.log.size() << "\n";

  for (const auto& frame : s.telemetry) {
    out << "[tlm] t=" << frame.ts << " " << frame.metric << "=" << format_value(frame.value) << "\n";
  }
  for (const auto& [name, count] : s.fault_counts) {
    out << "[fault] " << name << " count=" << count << "\n";
  }
  for (const auto& [bus, locked] : s.bus_locks) {
    if (locked) {
      ok = false;
      out << "[emu:error] bus still locked: " << bus << "\n";
    }
  }
  for (const auto& [device, acquired] : s.acquired_devices) {
    if (acquired) {
      ok = false;
      out << "[emu:error] device still acquired: " << device << "\n";
    }
  }
  for (const auto& error : s.errors) {
    out << "[emu:error] " << error << "\n";
  }
  for (const auto& entry : s.log) {
    out << "[log] " << entry << "\n";
  }
  return ok;
}

}  // namespace emulator

namespace clock {
inline std::uint64_t now_ms() {
  return emulator::state().now_ms;
}
}  // namespace clock

namespace bus {
struct Handle {
  std::string name;
  bool closed{};

  Object transact(const Object& request) {
    if (closed) {
      Error e("bus handle is closed");
      e.code = "BUS_CLOSED";
      e.source = name;
      e.ts = clock::now_ms();
      throw e;
    }

    auto& s = emulator::state();
    const auto address = emulator::object_int(request, "address", 0);
    const auto read_length = emulator::object_int(request, "readLength", 0);
    emulator::log("bus.transact " + name + " addr=" + std::to_string(address));

    if (s.inject_bus_timeout && !s.bus_timeout_consumed) {
      s.bus_timeout_consumed = true;
      Error e("emulated bus timeout");
      e.code = "BUS_TIMEOUT";
      e.source = name;
      e.ts = clock::now_ms();
      throw e;
    }

    Bytes bytes;
    for (std::int64_t i = 0; i < read_length; ++i) {
      bytes.push_back(static_cast<std::uint8_t>((address + i + s.telemetry.size()) & 0xff));
    }

    return Object{
      {"address", address},
      {"bytes", bytes},
      {"temperature_c", s.panel_temp_c},
      {"timestamp", static_cast<long long>(s.now_ms)},
    };
  }

  void close() {
    if (!closed) {
      emulator::state().bus_locks[name] = false;
      emulator::log("bus.close " + name);
      closed = true;
    }
  }
};

inline Handle open(std::string_view name, const Object& options) {
  auto& s = emulator::state();
  const std::string bus_name(name);
  if (s.bus_locks[bus_name]) {
    Error e("bus already locked");
    e.code = "BUS_LOCKED";
    e.source = bus_name;
    e.ts = clock::now_ms();
    throw e;
  }
  s.bus_locks[bus_name] = true;
  emulator::log("bus.open " + bus_name + " options=" + emulator::format_object(options));
  return Handle{bus_name};
}
}  // namespace bus

namespace device {
struct DeviceHandle {
  std::string name;

  Object getBusVoltage(std::string_view rail) {
    emulator::log("device.getBusVoltage " + name + ":" + std::string(rail));
    return Object{
      {"rail", std::string(rail)},
      {"volts", emulator::state().eps_voltage},
      {"timestamp", static_cast<long long>(clock::now_ms())},
    };
  }

  void setOutput(std::string_view output, bool enabled) {
    emulator::state().outputs[name + ":" + std::string(output)] = enabled;
    emulator::log("device.setOutput " + name + ":" + std::string(output) + "=" + (enabled ? "true" : "false"));
  }
};

template <typename Driver>
inline void register_driver(std::string_view name, const Object& options) {
  emulator::state().registered_devices[std::string(name)] = options;
  emulator::log("device.register " + std::string(name) + " options=" + emulator::format_object(options));
}

inline DeviceHandle acquire(std::string_view name) {
  auto& s = emulator::state();
  const std::string device_name(name);
  if (s.acquired_devices[device_name]) {
    Error e("device already acquired");
    e.code = "DEVICE_LOCKED";
    e.source = device_name;
    e.ts = clock::now_ms();
    throw e;
  }
  s.acquired_devices[device_name] = true;
  emulator::log("device.acquire " + device_name);
  return DeviceHandle{device_name};
}

inline void release(std::string_view name) {
  emulator::state().acquired_devices[std::string(name)] = false;
  emulator::log("device.release " + std::string(name));
}
}  // namespace device

namespace fault {

template <typename Handler>
inline void invoke_handler(Handler& handler, Context& ctx) {
  if constexpr (std::is_invocable_v<Handler&, Context&>) {
    (void)handler(ctx);
  } else if constexpr (std::is_invocable_v<Handler&>) {
    (void)handler();
  } else {
    static_assert(std::is_invocable_v<Handler&, Context&>, "fault handler is not invocable");
  }
}

inline void raise(std::string_view name, const Object& evidence) {
  auto& s = emulator::state();
  const std::string fault_name(name);
  const int count = ++s.fault_counts[fault_name];
  emulator::log("fault.raise " + fault_name + " evidence=" + emulator::format_object(evidence));
  auto it = s.fault_handlers.find(fault_name);
  if (it != s.fault_handlers.end()) {
    Context ctx{fault_name, count, count > 3 ? "ERROR" : "WARN"};
    it->second(ctx);
  }
}

template <typename Handler>
inline void handle(std::string_view name, Handler&& handler) {
  std::string fault_name(name);
  auto callback = std::forward<Handler>(handler);
  emulator::state().fault_handlers[fault_name] = [callback = std::move(callback)](Context& ctx) mutable {
    invoke_handler(callback, ctx);
  };
  emulator::log("fault.handle " + fault_name);
}

inline std::vector<Object> list() {
  std::vector<Object> result;
  for (const auto& [name, count] : emulator::state().fault_counts) {
    result.push_back(Object{{"name", name}, {"count", count}, {"status", count > 3 ? "ERROR" : "WARN"}});
  }
  return result;
}

inline void escalate(const Context& ctx) {
  emulator::log("fault.escalate " + ctx.name + " count=" + std::to_string(ctx.count));
}
}  // namespace fault

namespace telemetry {

inline bool threshold_matches(const Object& criteria, const Value& value) {
  const double numeric = emulator::as_double(&value, 0.0);
  if (const auto* above = emulator::find(criteria, "above")) {
    if (!(numeric > emulator::as_double(above))) return false;
  }
  if (const auto* below = emulator::find(criteria, "below")) {
    if (!(numeric < emulator::as_double(below))) return false;
  }
  return true;
}

inline void emit(std::string_view metric, const Value& value) {
  auto& s = emulator::state();
  s.telemetry.push_back(emulator::TelemetryFrame{s.now_ms, std::string(metric), value});
  emulator::log("telemetry.emit " + std::string(metric) + "=" + emulator::format_value(value));
  for (auto& watcher : s.watchers) {
    if (watcher.metric == metric && threshold_matches(watcher.criteria, value)) {
      Object reading{{"metric", std::string(metric)}, {"value", value}, {"timestamp", static_cast<long long>(s.now_ms)}};
      watcher.callback(reading);
    }
  }
}

inline Object snapshot(const Object& options) {
  return Object{
    {"count", static_cast<long long>(emulator::state().telemetry.size())},
    {"since", emulator::object_int(options, "since", 0)},
    {"timestamp", static_cast<long long>(clock::now_ms())},
  };
}

template <typename Callback>
inline void invoke_watcher(Callback& callback, const Object& reading) {
  if constexpr (std::is_invocable_v<Callback&, const Object&>) {
    (void)callback(reading);
  } else if constexpr (std::is_invocable_v<Callback&, Object>) {
    (void)callback(reading);
  } else if constexpr (std::is_invocable_v<Callback&>) {
    (void)callback();
  } else {
    static_assert(std::is_invocable_v<Callback&, const Object&>, "telemetry watcher is not invocable");
  }
}

template <typename Callback>
inline void watch(std::string_view metric, const Object& criteria, Callback&& callback) {
  auto cb = std::forward<Callback>(callback);
  emulator::state().watchers.push_back(emulator::Watcher{
    std::string(metric),
    criteria,
    [cb = std::move(cb)](const Object& reading) mutable { invoke_watcher(cb, reading); },
  });
  emulator::log("telemetry.watch " + std::string(metric) + " criteria=" + emulator::format_object(criteria));
}
}  // namespace telemetry

namespace task {

template <typename Callback>
inline void invoke_task_callback(Callback& callback, Context& ctx) {
  if constexpr (std::is_invocable_v<Callback&, Context&>) {
    (void)callback(ctx);
  } else if constexpr (std::is_invocable_v<Callback&>) {
    (void)callback();
  } else {
    static_assert(std::is_invocable_v<Callback&, Context&>, "task callback is not invocable");
  }
}

template <typename Callback>
inline void invoke_event_callback(Callback& callback, const Object& payload) {
  if constexpr (std::is_invocable_v<Callback&, const Object&>) {
    (void)callback(payload);
  } else if constexpr (std::is_invocable_v<Callback&, Object>) {
    (void)callback(payload);
  } else if constexpr (std::is_invocable_v<Callback&>) {
    (void)callback();
  } else {
    static_assert(std::is_invocable_v<Callback&, const Object&>, "event callback is not invocable");
  }
}

template <typename Callback>
inline void once(std::string_view name, Callback&& callback) {
  auto cb = std::forward<Callback>(callback);
  emulator::state().once_tasks.push_back(emulator::TaskRegistration{
    std::string(name),
    {},
    [cb = std::move(cb)](Context& ctx) mutable { invoke_task_callback(cb, ctx); },
    false,
  });
  emulator::log("task.once " + std::string(name));
}

template <typename Callback>
inline void every(std::string_view name, std::string_view period, Callback&& callback) {
  auto cb = std::forward<Callback>(callback);
  emulator::state().recurring_tasks.push_back(emulator::TaskRegistration{
    std::string(name),
    std::string(period),
    [cb = std::move(cb)](Context& ctx) mutable { invoke_task_callback(cb, ctx); },
    false,
  });
  emulator::log("task.every " + std::string(name) + " period=" + std::string(period));
}

template <typename Callback>
inline void on(std::string_view pattern, Callback&& callback) {
  auto cb = std::forward<Callback>(callback);
  emulator::state().event_handlers.push_back(emulator::EventRegistration{
    std::string(pattern),
    [cb = std::move(cb)](const Object& payload) mutable { invoke_event_callback(cb, payload); },
  });
  emulator::log("task.on " + std::string(pattern));
}

inline bool matches(std::string_view pattern, std::string_view event_name) {
  if (!pattern.empty() && pattern.back() == '*') {
    const auto prefix = pattern.substr(0, pattern.size() - 1);
    return event_name.substr(0, prefix.size()) == prefix;
  }
  return pattern == event_name;
}

inline void start() {
  auto& s = emulator::state();
  emulator::log("task.start");

  for (auto& task : s.once_tasks) {
    Context ctx{1};
    try {
      task.callback(ctx);
    } catch (const Error& e) {
      s.errors.push_back("task.once " + task.name + " failed: " + e.code + " " + e.what());
    }
    if (s.shutdown_requested) return;
  }

  for (int iteration = 1; iteration <= s.recurring_iterations && !s.shutdown_requested; ++iteration) {
    s.now_ms += 30'000;
    for (auto& task : s.recurring_tasks) {
      if (task.stopped) continue;
      Context ctx{iteration};
      try {
        task.callback(ctx);
      } catch (const Error& e) {
        s.errors.push_back("task.every " + task.name + " failed: " + e.code + " " + e.what());
      }
      if (ctx.stopped) task.stopped = true;
      if (s.shutdown_requested) return;
    }
  }

  for (const auto& [event_name, payload] : s.command_events) {
    for (auto& handler : s.event_handlers) {
      if (matches(handler.pattern, event_name)) {
        handler.callback(payload);
        if (s.shutdown_requested) return;
      }
    }
  }
}

inline void shutdown(const Object& options) {
  emulator::state().shutdown_requested = true;
  emulator::log("task.shutdown options=" + emulator::format_object(options));
}

inline void pause(std::string_view name, std::string_view duration) {
  emulator::log("task.pause " + std::string(name) + " duration=" + std::string(duration));
}
}  // namespace task

}  // namespace satellite
