require('dotenv').config({ path: '../game-diary-web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Env variables are missing.");
  process.exit(1);
}

async function inspectSchema() {
  console.log(`🔍 Fetching OpenAPI schema from PostgREST at ${supabaseUrl}...`);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`);
    }

    const schema = await res.json();
    console.log("✅ OpenAPI schema loaded successfully!");

    // Print tables and their columns with types
    const definitions = schema.definitions || {};
    for (const [tableName, definition] of Object.entries(definitions)) {
      console.log(`\n📋 Table: ${tableName}`);
      const properties = definition.properties || {};
      for (const [colName, colProp] of Object.entries(properties)) {
        const type = colProp.type;
        const format = colProp.format || '';
        const description = colProp.description || '';
        console.log(`  - ${colName}: ${type} (${format}) ${description}`);
      }
    }
  } catch (e) {
    console.error("❌ Error:", e.message);
  }
}

inspectSchema();
