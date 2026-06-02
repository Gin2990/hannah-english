import fs from 'fs';

let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
  if (keyMatch) supabaseKey = keyMatch[1].trim().replace(/['"]/g, '');
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env!");
  process.exit(1);
}

const specUrl = `${supabaseUrl}/rest/v1/`;

async function getSpec() {
  try {
    const res = await fetch(specUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const spec = await res.json();
    console.log("Raw response keys:", Object.keys(spec));
    console.log(JSON.stringify(spec, null, 2).slice(0, 1000));
  } catch (err) {
    console.error("Error fetching spec:", err.message);
  }
}

getSpec();
