import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key here — bypasses RLS for server-side writes
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
    const formattedPhone = `0${phone?.slice(3)}`  // 254712... → 0712...
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('phone', formattedPhone)
      .single()

    if (!member) {
      console.log('Member not found for phone:', formattedPhone)
      return NextResponse.json({ success: false, error: 'Member not found' })
    }

    // Save contribution automatically
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
      console.error('DB insert error:', error)
      return NextResponse.json({ success: false })
    }

    console.log(`✅ Payment saved: KES ${amount} from ${formattedPhone} — ${mpesaCode}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}