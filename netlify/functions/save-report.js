const { neon } = require('@neondatabase/serverless')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const connectionString = process.env.NETLIFY_DATABASE_URL
  if (!connectionString) return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) }

  try {
    const { weekOf, report } = JSON.parse(event.body)
    const sql = neon(connectionString)

    await sql`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id SERIAL PRIMARY KEY,
        week_of TEXT NOT NULL UNIQUE,
        report JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    await sql`
      INSERT INTO weekly_reports (week_of, report, updated_at)
      VALUES (${weekOf}, ${JSON.stringify(report)}, NOW())
      ON CONFLICT (week_of) DO UPDATE
        SET report = EXCLUDED.report,
            updated_at = NOW()
    `

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, weekOf }),
    }
  } catch (err) {
    console.error('Save report error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
