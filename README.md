# PIT

**PIT** is an [Electron](https://electron.atom.io/)
app for performing picture identification experiments.

## Building

**PIT** has been built and tested on Linux (Xubuntu 16.04),
Mac OS (10.12 Sierra) and Windows 10.

### Prerequisits

All platforms should install [node](https://nodejs.org/en/) using your favoured method.

Mac users will require [xcode](https://developer.apple.com/xcode/download/).

Windows users should install the [Windows build tools](https://github.com/felixrieseberg/windows-build-tools)
which can be done via Powershell:

```
npm install --global --production windows-build-tools
```

### Building

1. Clone or download this repository
2. Open a terminal (or Powershell) and navigate to the project root
3. Install the dependencies
```
npm install
```
4. Install `electron` globally if you want to launch from the command line:
```
npm install --global electron
```
5. Build the package using the command appropriate for your platform
    - Linux
    ```
    npm run electron:linux
    ```
    - Mac os
    ```
    npm run electron:mac
    ```
    - Windows
    ```
    npm run electron:windows
    ```
This last step will create a folder `app-builds` with the compiled application inside

## Acknowledgements

This project would never have got off the ground without
[angular-electron](https://github.com/maximegris/angular-electron).
