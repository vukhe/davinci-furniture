#!/usr/bin/env node
/**
 * 🚀 DAVINCI FURNITURE – Master Setup Script
 * 
 * This script orchestrates the complete setup:
 * 1. Check prerequisites
 * 2. Setup environment
 * 3. Initialize database
 * 4. Install dependencies
 * 5. Verify installation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...msg) {
  console.log(colors[color], ...msg, colors.reset);
}

function error(msg) {
  console.error(colors.red, '❌', msg, colors.reset);
}

function success(msg) {
  console.log(colors.green, '✅', msg, colors.reset);
}

function info(msg) {
  console.log(colors.blue, 'ℹ️ ', msg, colors.reset);
}

function warn(msg) {
  console.log(colors.yellow, '⚠️ ', msg, colors.reset);
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function checkCommand(cmd, name) {
  try {
    execSync(`${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkPrerequisites() {
  log('cyan', '\n╔════════════════════════════════════════╗');
  log('cyan', '║  📋 Checking Prerequisites            ║');
  log('cyan', '╚════════════════════════════════════════╝\n');

  const checks = [
    { name: 'Node.js', cmd: 'node --version', req: true },
    { name: 'npm', cmd: 'npm --version', req: true },
    { name: 'Python 3', cmd: 'python --version', req: true },
    { name: 'Git', cmd: 'git --version', req: false },
  ];

  let allPass = true;

  for (const check of checks) {
    const pass = checkCommand(check.cmd, check.name);
    if (pass) {
      const version = execSync(check.cmd, { encoding: 'utf-8' }).trim();
      success(`${check.name}: ${version}`);
    } else {
      if (check.req) {
        error(`${check.name}: NOT FOUND (required)`);
        allPass = false;
      } else {
        warn(`${check.name}: NOT FOUND (optional)`);
      }
    }
  }

  if (!allPass) {
    error('Missing required prerequisites. Install them and try again.');
    process.exit(1);
  }

  info('All prerequisites installed!\n');
}

async function setupEnvironment() {
  log('cyan', '╔════════════════════════════════════════╗');
  log('cyan', '║  ⚙️  Setting Up Environment            ║');
  log('cyan', '╚════════════════════════════════════════╝\n');

  const envPath = path.join(ROOT, '.env');
  const envExamplePath = path.join(ROOT, '.env.example');

  if (fs.existsSync(envPath)) {
    info('.env file already exists');
    const overwrite = await prompt('Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      info('Skipping .env setup');
      return;
    }
  }

  // Copy .env.example to .env if example exists
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    success('.env file created from template');
  } else {
    error('.env.example not found');
    return;
  }

  // Prompt for critical settings
  log('yellow', '\n📝 Configure critical settings:');
  
  const dbServer = await prompt('Database Server (default: localhost): ') || 'localhost';
  const dbUser = await prompt('Database User (default: sa): ') || 'sa';
  const dbPassword = await prompt('Database Password: ');
  const jwtSecret = await prompt('JWT Secret (default: auto-generate): ') || 
    require('crypto').randomBytes(32).toString('hex');

  // Update .env with provided values
  let envContent = fs.readFileSync(envPath, 'utf-8');
  envContent = envContent.replace(/DB_SERVER=.*/g, `DB_SERVER=${dbServer}`);
  envContent = envContent.replace(/DB_USER=.*/g, `DB_USER=${dbUser}`);
  envContent = envContent.replace(/DB_PASSWORD=.*/g, `DB_PASSWORD=${dbPassword}`);
  envContent = envContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`);
  
  fs.writeFileSync(envPath, envContent);
  success('Environment configured\n');
}

async function setupDatabase() {
  log('cyan', '╔════════════════════════════════════════╗');
  log('cyan', '║  🗄️  Initializing Database            ║');
  log('cyan', '╚════════════════════════════════════════╝\n');

  const setupDbPath = path.join(ROOT, 'setup-db.js');
  if (!fs.existsSync(setupDbPath)) {
    error('setup-db.js not found');
    return;
  }

  try {
    execSync(`node "${setupDbPath}"`, { stdio: 'inherit' });
    success('Database initialized\n');
  } catch (err) {
    error('Database initialization failed');
    warn('Check your database credentials in .env');
    warn('You can run: node setup-db.js later to retry\n');
  }
}

async function installDependencies() {
  log('cyan', '╔════════════════════════════════════════╗');
  log('cyan', '║  📦 Installing Dependencies           ║');
  log('cyan', '╚════════════════════════════════════════╝\n');

  const dirs = ['backend', 'frontend', 'ai-service'];

  for (const dir of dirs) {
    const dirPath = path.join(ROOT, dir);
    const packageFile = path.join(dirPath, 'package.json');
    const reqFile = path.join(dirPath, 'requirements.txt');

    if (fs.existsSync(packageFile)) {
      info(`Installing npm dependencies in ${dir}...`);
      try {
        execSync(`cd "${dirPath}" && npm install`, { stdio: 'inherit' });
        success(`${dir} dependencies installed\n`);
      } catch (err) {
        warn(`Failed to install ${dir} dependencies - you can retry manually\n`);
      }
    } else if (fs.existsSync(reqFile) && dir === 'ai-service') {
      info(`Setting up Python venv in ${dir}...`);
      try {
        const venvPath = path.join(dirPath, 'venv');
        if (!fs.existsSync(venvPath)) {
          execSync(`cd "${dirPath}" && python -m venv venv`, { stdio: 'inherit' });
        }
        success(`Python venv created\n`);
      } catch (err) {
        warn(`Failed to setup Python venv - you can retry manually\n`);
      }
    }
  }
}

async function showSummary() {
  log('cyan', '\n╔════════════════════════════════════════╗');
  log('cyan', '║  ✨ Setup Complete!                   ║');
  log('cyan', '╚════════════════════════════════════════╝\n');

  log('green', 'Next Steps:\n');
  log('cyan', '1️⃣  Backend:');
  log('white', '   cd backend && npm run dev\n');
  
  log('cyan', '2️⃣  Frontend (new terminal):');
  log('white', '   cd frontend && npm run dev\n');
  
  log('cyan', '3️⃣  AI Service (new terminal):');
  log('white', '   cd ai-service');
  if (process.platform === 'win32') {
    log('white', '   .\\venv\\Scripts\\activate');
  } else {
    log('white', '   source venv/bin/activate');
  }
  log('white', '   python main.py\n');

  log('green', 'Access:');
  log('white', '  • Frontend:  http://localhost:3000');
  log('white', '  • Backend:   http://localhost:5000');
  log('white', '  • AI API:    http://localhost:8000/docs\n');

  log('yellow', '📖 See SETUP.md for detailed documentation\n');
}

async function main() {
  log('cyan', '\n╔════════════════════════════════════════╗');
  log('cyan', '║  🚀 DAVINCI FURNITURE SETUP            ║');
  log('cyan', '╚════════════════════════════════════════╝');

  try {
    await checkPrerequisites();
    await setupEnvironment();
    await setupDatabase();
    await installDependencies();
    await showSummary();
  } catch (err) {
    error('Setup failed:', err.message);
    process.exit(1);
  }
}

main();
