import { NextResponse } from 'next/server';
import { getLoadingProgress } from '../../../services/ragService';

export async function GET() {
  try {
    const progress = getLoadingProgress();

    return NextResponse.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error getting RAG progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get RAG progress',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

