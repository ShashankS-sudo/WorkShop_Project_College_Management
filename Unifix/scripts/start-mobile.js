const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Resolve the path to apps/mobile properly
let mobileDir = path.resolve(process.cwd(), 'apps', 'mobile');
if (!fs.existsSync(mobileDir) && fs.existsSync(path.resolve(process.cwd(), 'App.tsx'))) {
  mobileDir = process.cwd();
}

console.log('\n======================================================');
console.log('       📱 UNIFIX Mobile Application Launcher');
console.log('======================================================\n');
console.log('Choose how you want to run the application:\n');
console.log('  [1] Web Browser (http://localhost:8081)');
console.log('  [2] Physical Phone - Tunnel Mode (Recommended: Bypasses Firewall & Wi-Fi issues)');
console.log('  [3] Physical Phone - Local Wi-Fi (Same Wi-Fi network)');
console.log('  [4] Android Emulator / Device');
console.log('  [5] iOS Simulator (macOS)\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Select option (1-5) [Default: 1 - Web]: ', (answer) => {
  rl.close();
  const choice = answer.trim() || '1';

  let expoArgs = ['start'];
  let modeLabel = '';

  switch (choice) {
    case '2':
      expoArgs.push('--tunnel');
      modeLabel = 'Physical Phone via Cloud Tunnel (Bypasses Firewall & Router limits)';
      break;
    case '3':
      expoArgs.push('--lan');
      modeLabel = 'Physical Phone via Local Wi-Fi (Same Wi-Fi)';
      break;
    case '4':
      expoArgs.push('--android');
      modeLabel = 'Android Emulator / Device';
      break;
    case '5':
      expoArgs.push('--ios');
      modeLabel = 'iOS Simulator';
      break;
    case '1':
    default:
      expoArgs.push('--web');
      modeLabel = 'Web Browser (http://localhost:8081)';
      break;
  }

  console.log(`\n🚀 Launching: ${modeLabel}...\n`);

  const isWindows = process.platform === 'win32';
  const expoCliPath = path.resolve(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
  const useDirectCli = fs.existsSync(expoCliPath);

  const cmd = useDirectCli ? process.execPath : (isWindows ? 'npx.cmd' : 'npx');
  const args = useDirectCli ? [expoCliPath, ...expoArgs] : ['expo', ...expoArgs];

  const child = spawn(cmd, args, {
    cwd: mobileDir,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error('Failed to start Expo:', err);
  });
});
