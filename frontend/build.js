// Build script to inject API base URL from environment
const fs = require('fs');
const path = require('path');

const apiBase = process.env.VITE_API_BASE || 'http://localhost:8001';

const configContent = `// Auto-generated config - do not edit
window.VITE_API_BASE = '${apiBase}';
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
console.log(`✓ Generated config.js with API_BASE: ${apiBase}`);
