import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session.error) return session.error;

  try {
    const body = await req.json();
    const { type, makeModel, plateNumber, isEv } = body;

    if (!type || !makeModel || !plateNumber) {
      return NextResponse.json(
        { success: false, error: 'Vehicle type, model, and plate number are required.' },
        { status: 400 }
      );
    }

    const updatedUser = db.addVehicle(session.user.id, {
      type,
      makeModel,
      plateNumber: String(plateNumber).toUpperCase().trim(),
      isEv: Boolean(isEv),
      isDefault: false,
    });

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Vehicle added to your profile.',
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add vehicle' }, { status: 500 });
  }
}
