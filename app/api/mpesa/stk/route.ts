import { NextRequest, NextResponse } from 'next/server'
import { stkPush } from '@/lib/mpesa'

export async function POST(req: NextRequest) {
  try {
    const { phone, amount, memberId, month } = await req.json()

    if (!phone || !amount || !memberId) {
      return NextResponse.json(
        { error: 'Phone, amount and memberId are required' },
        { status: 400 }
      )
    }

    const result = await stkPush({
      phone,
      amount: Number(amount),
      accountReference: `CHAMA-${memberId.slice(0, 8).toUpperCase()}`,
    })

    if (result.ResponseCode === '0') {
      return NextResponse.json({
        success: true,
        checkoutRequestId: result.CheckoutRequestID,
        message: 'STK push sent. Ask member to enter M-Pesa PIN.'
      })
    } else {
      return NextResponse.json(
        { error: result.errorMessage || 'STK push failed' },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}