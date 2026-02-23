import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { Body } = body

    // Payment failed
    if (Body.stkCallback.ResultCode !== 0) {
      console.log('Payment failed:', Body.stkCallback.ResultDesc)
      return NextResponse.json({ success: false })
    }

    // Extract payment details
    const items = Body.stkCallback.CallbackMetadata.Item
    const amount = items.find((i: any) => i.Name === 'Amount')?.Value
    const mpesaCode = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value
    const phone = items.find((i: any) => i.Name === 'PhoneNumber')?.Value?.toString()

    // Find member by phone
    const formattedPhone = `0${phone?.slice(3)}`
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name, phone')
      .eq('phone', formattedPhone)
      .single()

    if (!member) {
      console.log('Member not found:', formattedPhone)
      return NextResponse.json({ success: false })
    }

    // Save contribution
    const month = new Date().toLocaleString('en-KE', {
      month: 'long',
      year: 'numeric'
    })

    const { error } = await supabase.from('contributions').insert([{
      member_id: member.id,
      amount,
      mpesa_code: mpesaCode,
      month,
      status: 'confirmed',
      payment_date: new Date().toISOString()
    }])

    if (error) {
      console.error('DB error:', error)
      return NextResponse.json({ success: false })
    }

    // 🔔 Send WhatsApp to member
    await sendWhatsApp({
      phone: member.phone,
      message: ` *Chama Payment Confirmed!*\n\nHi ${member.full_name},\n\nYour contribution of *KES ${amount}* has been received.\n\nM-Pesa Code: *${mpesaCode}*\nMonth: ${month}\n\nThank you! 🙏`
    })

    // 🔔 Send WhatsApp to treasurer
    const treasurerPhone = process.env.TREASURER_PHONE!
    await sendWhatsApp({
      phone: treasurerPhone,
      message: ` *New Chama Payment!*\n\n${member.full_name} has paid *KES ${amount}*\n\nM-Pesa Code: *${mpesaCode}*\nMonth: ${month}`
    })

    console.log(`Payment saved and WhatsApp sent: KES ${amount} from ${member.full_name}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
