#include "satellite_os.hpp"

void satellite_main();

int main(int argc, char** argv) {
  satellite::emulator::configure_from_argv(argc, argv);
  satellite_main();
  return satellite::emulator::report() ? 0 : 1;
}
