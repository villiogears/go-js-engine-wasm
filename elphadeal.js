#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { WASI } = require('node:wasi');

async function run() {
    const wasmPath = path.join(__dirname, 'main.wasm');

    // Handle internal commands
    if (process.argv[2] === 'help') {
        process.stdout.write(`
ELPHADEAL JavaScript Runtime v${require('./package.json').version || '1.0.0'}
==================================================

Usage:
  ./elphadeal.js [command|file] [options]

Commands:
  create <name>      Create a new project folder with boilerplate
  init               Initialize a new package.json in current folder
  install <package>  Install a package from npm (alias: add)
  uninstall <pkg>    Remove a package from node_modules (alias: remove)
  help               Show this help message

Options:
  -e 'code'          Execute a JavaScript string directly
  [file.js]         Execute a JavaScript file

Capabilities:
  [✓] WASI (wasip1) Native execution via main.wasm
  [✓] CommonJS require() with npm-style node_modules resolution
  [✓] DOM-like Tree API (document.createElement, appendChild)
  [✓] GPU-like Graphic Engine (createCanvas, getContext('2d'), flush)
  [✓] Event Loop (setTimeout, Promises, Async processing)
  [✓] Web APIs (performance, console, atob/btoa)
  [✓] File System Access (read/write files via WASI)

Example:
  ./elphadeal.js install lodash
  ./elphadeal.js -e "console.log(require('lodash').VERSION)"
  ./elphadeal.js example.js

--------------------------------------------------
Built with Goja (Go) and Node.js WASI.
`);
        return;
    }

    if (process.argv[2] === 'install' || process.argv[2] === 'add' || process.argv[2] === 'i') {
        const pkg = process.argv[3];
        if (!pkg) {
            console.log("Usage: ./elphadeal.js install <package-name>");
            return;
        }
        console.log(`[ELPHADEAL] Installing ${pkg} via npm-shim...`);
        const { execSync } = require('child_process');
        try {
            // Ensure package.json exists to avoid npm errors
            if (!fs.existsSync('package.json')) {
                fs.writeFileSync('package.json', JSON.stringify({ 
                    name: path.basename(process.cwd()), 
                    version: "1.0.0",
                    main: "index.js"
                }, null, 2));
            }
            execSync(`npm install ${pkg}`, { stdio: 'inherit' });
            console.log(`\n[ELPHADEAL] Package ${pkg} is ready.`);
        } catch (e) {
            console.error("Installation failed.");
        }
        return;
    }

    if (process.argv[2] === 'uninstall' || process.argv[2] === 'remove' || process.argv[2] === 'rm' || process.argv[2] === 'un') {
        const pkg = process.argv[3];
        if (!pkg) {
            console.log("Usage: ./elphadeal.js uninstall <package-name>");
            return;
        }
        console.log(`[ELPHADEAL] Removing ${pkg}...`);
        const { execSync } = require('child_process');
        try {
            execSync(`npm uninstall ${pkg}`, { stdio: 'inherit' });
            console.log(`\n[ELPHADEAL] Package ${pkg} removed.`);
        } catch (e) {
            console.error("Uninstallation failed.");
        }
        return;
    }

    if (process.argv[2] === 'init') {
        if (fs.existsSync('package.json')) {
            console.log("package.json already exists.");
            return;
        }
        const defaultPkg = {
            name: path.basename(process.cwd()),
            version: "1.0.0",
            description: "An Elphadeal Project",
            main: "index.js",
            scripts: {
                start: "elphadeal index.js"
            },
            dependencies: {}
        };
        fs.writeFileSync('package.json', JSON.stringify(defaultPkg, null, 2));
        console.log("[ELPHADEAL] Initialized package.json");
        return;
    }

    if (process.argv[2] === 'create') {
        const projectName = process.argv[3];
        if (!projectName) {
            console.log("Usage: ./elphadeal.js create <project-name>");
            return;
        }

        if (fs.existsSync(projectName)) {
            console.error(`Error: Directory "${projectName}" already exists.`);
            return;
        }

        console.log(`[ELPHADEAL] Scaffolding new browser app in ./${projectName}...`);

        try {
            fs.mkdirSync(projectName);
            const projectPath = (file) => path.join(projectName, file);

            // 1. package.json
            fs.writeFileSync(projectPath('package.json'), JSON.stringify({
                name: projectName,
                version: "0.1.0",
                main: "index.js",
                dependencies: {}
            }, null, 2));

            // 2. index.js
            fs.writeFileSync(projectPath('index.js'), `
const App = require('./App');
console.log('--- ELPHADEAL APP STARTING ---');

// UI Render
document.body.appendChild(App());
renderToConsole(document.body);

// Graphic Engine Demo
const canvas = createCanvas(80, 10);
const ctx = canvas.getContext('2d');
ctx.fillRect(0, 0, 80, 10, ' ', '44');
ctx.fillText('WELCOME TO ' + '${projectName.toUpperCase()}', 5, 4, '37;1');
canvas.flush();
`.trim());

            // 3. App.js
            fs.writeFileSync(projectPath('App.js'), `
function App() {
  const div = document.createElement('div');
  div.id = 'root';
  div.innerHTML = 'Hello from Elphadeal Component!';
  
  const span = document.createElement('span');
  span.innerHTML = ' (Dynamic Rendering Active)';
  div.appendChild(span);
  
  return div;
}
module.exports = App;
`.trim());

            console.log(`\n[ELPHADEAL] Successfully created ${projectName}!`);
            console.log(`To run your app:\n  cd ${projectName}\n  ../elphadeal.js index.js`);

        } catch (e) {
            console.error("Failed to create project:", e.message);
        }
        return;
    }
    
    const wasi = new WASI({
        version: 'preview1',
        args: [wasmPath, ...process.argv.slice(2)],
        env: {
            ...process.env,
            PWD: process.cwd(),
        },
        preopens: {
            '.': '.',
            '/': '/'
        }
    });

    const wasmBuffer = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
        wasi_snapshot_preview1: wasi.wasiImport
    });

    try {
        wasi.start(instance);
    } catch (e) {
        if (e.code !== 'process.exit') throw e;
    }
}

run().catch(err => {
    if (err.code !== 'ERR_WASI_NOT_FOUND') {
        console.error(err);
    }
    process.exit(1);
});
