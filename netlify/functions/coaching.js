const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { driver, cdfRow, concessions, safety, feedback } = JSON.parse(event.body)

    const name = driver['Delivery Associate'] || driver['Name'] || 'this driver'
    const standing = driver['Overall Standing'] || ''
    const score = driver['Overall Score'] || ''

    const prompt = `You are an Amazon DSP coaching manager at JBCO LLC. Write coaching talking points for a one-on-one session with ${name}.

Driver data:
- Overall standing: ${standing} (score: ${score})
- DCR: ${driver['DCR'] || 'N/A'}
- CDF DPMO: ${driver['CDF DPMO'] || 'N/A'}
- POD: ${driver['POD'] || 'N/A'}
- DSB: ${driver['DSB'] || 'N/A'}
- Speeding events: ${driver['Speeding Event Rate'] || 'N/A'}
- Seatbelt-off rate: ${driver['Seatbelt-Off Rate'] || 'N/A'}
- Distractions: ${driver['Distractions Rate'] || 'N/A'}
- Concessions: ${concessions.length} total
- Safety events on scorecard: ${safety.length}
- Customer complaints: ${feedback.length}

Write 3-5 sentences of specific, empathetic, actionable coaching talking points. Address the driver by first name. Start with something positive, then address the most important improvement area with specific data, then close with an action plan. Use a conversational manager-to-driver tone. Do not use bullet points or headers — write as a single paragraph.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: message.content[0]?.text || '' }),
    }
  } catch (err) {
    console.error('Coaching error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
