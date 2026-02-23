import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export const sendWhatsApp = async ({
  phone,
  message,
}: {
  phone: string
  message: string
}) => {
  try {
    // Format to international
    const formattedPhone = phone.startsWith('0')
      ? `+254${phone.slice(1)}`
      : phone.startsWith('254')
      ? `+${phone}`
      : phone

    const result = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${formattedPhone}`,
      body: message,
    })

    console.log('WhatsApp sent:', result.sid)
    return { success: true, sid: result.sid }
  } catch (error: any) {
    console.error('WhatsApp error:', error.message)
    return { success: false, error: error.message }
  }
}
