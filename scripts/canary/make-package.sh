#!/usr/bin/env bash
# make-package.sh (2026-11-05): writes a tiny Swift package to DIR (arg 1): a C target
# (CShim, clang module -> .pcm files in the ModuleCache), a Swift library that imports it
# and Foundation, and one XCTest. Used by xctest.sh (#923) and the .pcm cache jobs (#924).
set -euo pipefail
dir="${1:?usage: make-package.sh DIR}"
mkdir -p "$dir/Sources/CShim/include" "$dir/Sources/Canary" "$dir/Tests/CanaryTests"
cat > "$dir/Package.swift" <<'SWIFT'
// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "Canary",
  products: [.library(name: "Canary", targets: ["Canary"])],
  targets: [
    .target(name: "CShim"),
    .target(name: "Canary", dependencies: ["CShim"]),
    .testTarget(name: "CanaryTests", dependencies: ["Canary"]),
  ]
)
SWIFT
cat > "$dir/Sources/CShim/include/cshim.h" <<'C'
#include <stdint.h>
static inline int32_t cshim_add(int32_t a, int32_t b) { return a + b; }
C
echo '#include "cshim.h"' > "$dir/Sources/CShim/cshim.c"
cat > "$dir/Sources/Canary/Canary.swift" <<'SWIFT'
import CShim
import Foundation

/// Adds two numbers through the C module, so the build needs clang module .pcm files.
public func canaryAdd(_ a: Int32, _ b: Int32) -> Int32 { cshim_add(a, b) }
SWIFT
cat > "$dir/Tests/CanaryTests/CanaryTests.swift" <<'SWIFT'
import Canary
import XCTest

final class CanaryTests: XCTestCase {
  func testAdd() { XCTAssertEqual(canaryAdd(2, 3), 5) }
}
SWIFT
