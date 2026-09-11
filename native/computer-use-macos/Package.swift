// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NightshiftComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "NightshiftComputerUseMacOSCore",
            targets: ["NightshiftComputerUseMacOSCore"]
        ),
        .executable(
            name: "nightshift-computer-use-macos",
            targets: ["NightshiftComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "NightshiftComputerUseMacOSCore",
            path: "Sources/NightshiftComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "NightshiftComputerUseMacOS",
            dependencies: ["NightshiftComputerUseMacOSCore"],
            path: "Sources/NightshiftComputerUseMacOS"
        ),
        .testTarget(
            name: "NightshiftComputerUseMacOSTests",
            dependencies: ["NightshiftComputerUseMacOSCore"],
            path: "Tests/NightshiftComputerUseMacOSTests"
        )
    ]
)
