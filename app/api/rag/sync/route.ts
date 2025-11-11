import { runRagPipeline, queryVectorStore } from '../../../services/ragService';
import { NextResponse } from 'next/server';

/**
 * POST /api/rag/sync
 * Triggers the RAG pipeline to load, split, and vectorize documents from the ./pdfs directory.
 */
export async function POST() {
  try {
    console.log('🔄 [API] Starting knowledge base synchronization...');

    const result = await runRagPipeline();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Knowledge base synchronized successfully.',
        data: result,
      });
    } else {
      // Forward the error from the pipeline
      throw new Error(result.message || 'Unknown error during pipeline execution.');
    }

  } catch (error) {
    console.error('❌ [API] Knowledge base synchronization failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Knowledge base synchronization failed.',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/sync?query=<string>
 * Queries the vector store with the provided query string.
 * Note: This is for demonstration. In a real app, this might be a separate /api/rag/query endpoint.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Query parameter is required." },
        { status: 400 }
      );
    }

    const result = await queryVectorStore(query);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.results,
      });
    } else {
      throw new Error('Failed to query vector store.');
    }

  } catch (error) {
    console.error('❌ [API] Failed to query RAG status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query RAG status.',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
