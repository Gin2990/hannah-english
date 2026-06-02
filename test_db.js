import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testColumn(colName, payload) {
  const { data, error } = await supabase.from('exams').insert(payload).select();
  if (error) {
    if (error.message.includes('schema cache')) {
      console.log(`❌ Column '${colName}' DOES NOT exist.`);
    } else {
      console.log(`✅ Column '${colName}' EXISTS (Query failed with: ${error.message}).`);
    }
  } else {
    console.log(`✅ Column '${colName}' EXISTS (Insert Succeeded!).`);
  }
}

async function run() {
  await testColumn('part_code', { title: 'Test', part_code: 'toeic_part1' });
}

run();
