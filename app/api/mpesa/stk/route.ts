import { NextRequest, NextResponse } from 'next/server'
import { stkPush } from '@/lib/mpesa'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, amount, memberId, month } = body

    if (!phone || !amount || !memberId) {
      return NextResponse.json(
        { error: 'Phone, amount and memberId are required' },
        { status: 400 }
      )
    }

    // memberId might be full UUID — slice safely
    const reference = memberId.length >= 8 
      ? `CHAMA-${memberId.slice(0, 8).toUpperCase()}`
      : `CHAMA-${memberId.toUpperCase()}`

    const result = await stkPush({
      phone,
      amount: Number(amount),
      accountReference: reference,
    })

    console.log('Daraja response:', JSON.stringify(result))

    // Daraja success returns ResponseCode "0"
    if (result?.ResponseCode === '0') {
      return NextResponse.json({
        success: true,
        checkoutRequestId: result.CheckoutRequestID,
        message: 'STK push sent. Ask member to enter M-Pesa PIN.'
      })
    }

    // Handle specific Daraja errors
    const errorMsg = result?.errorMessage 
      || result?.ResponseDescription 
      || result?.ResultDesc
      || 'STK push failed'

    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('STK error:', error)
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    )
  }
}