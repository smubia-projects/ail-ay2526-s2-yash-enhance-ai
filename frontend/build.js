// Build script to inject API base URL from environment
const fs = require('fs');
const path = require('path');

const apiBase = process.env.VITE_API_BASE || 'http://localhost:8001';

const configContent = `// Auto-generated config - do not edit
window.VITE_API_BASE = '${apiBase}';
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
console.log(`✓ Generated config.js with API_BASE: ${apiBase}`);

// Copy Vercel Analytics module for browser use
const analyticsSource = path.join(__dirname, 'node_modules', '@vercel', 'analytics', 'dist', 'index.mjs');
const analyticsTarget = path.join(__dirname, 'analytics-module.js');

try {
  fs.copyFileSync(analyticsSource, analyticsTarget);
  console.log('✓ Copied Vercel Analytics module');
} catch (error) {
  console.warn('⚠ Warning: Could not copy Vercel Analytics module. Run npm install if not done yet.');
}
