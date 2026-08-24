const { execSync } = require('child_process');

const entries = ['desktop', 'mobile', 'config'];

entries.forEach(entry => {
  console.log(`Building ${entry}...`);
  execSync(`npx vite build`, {
    env: { ...process.env, VITE_ENTRY: entry },
    stdio: 'inherit',
  });
});

console.log('All entries built successfully.');
