const { neon } = require('@neondatabase/serverless')

exports.handler = async (event) => {
  const connectionString = process.env.NETLIFY_DATABASE_URL
  if (!connectionString) return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) }

  try {
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

    const rows = await sql`
      SELECT week_of, report, updated_at
      FROM weekly_reports
      ORDER BY week_of DESC
      LIMIT 52
    `

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: rows }),
    }
  } catch (err) {
    console.error('Get reports error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
