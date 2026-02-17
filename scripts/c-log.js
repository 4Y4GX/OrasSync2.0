const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'system.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Get command to run
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node scripts/c-log.js <command> [args...]');
    process.exit(1);
}

const command = args[0];
const commandArgs = args.slice(1);

console.log(`[Logger] Starting: ${command} ${commandArgs.join(' ')}`);
console.log(`[Logger] Outputting to: ${logFile}`);

const child = spawn(command, commandArgs, {
    stdio: ['inherit', 'pipe', 'pipe'], // Inherit stdin, pipe stdout/stderr
    shell: true // Required for npm/next commands on Windows
});

child.stdout.on('data', (data) => {
    process.stdout.write(data);
    logStream.write(data);
});

child.stderr.on('data', (data) => {
    process.stderr.write(data);
    logStream.write(data);
});

child.on('close', (code) => {
    console.log(`[Logger] Process exited with code ${code}`);
    logStream.end();
    process.exit(code);
});

// Handle termination signals to kill child process
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
        if (!child.killed) {
            child.kill(signal);
        }
    });
});
