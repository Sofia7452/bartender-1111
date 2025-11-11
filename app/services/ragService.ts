// @ts-nocheck
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import path from "path";
import { cwd } from "process";
import { existsSync, readdirSync } from "fs";

// Define paths and constants
const PDFS_PATH = path.resolve(cwd(), "pdfs");

// In-memory state for the current RAG session
let memoryStore: MemoryVectorStore | null = null;
let lastDocsCount = 0;
let lastChunksCount = 0;
let loadingProgress = {
  totalFiles: 0,
  processedFiles: 0,
  currentFile: '',
  status: 'idle' // idle, loading, processing, completed, error
};

/**
 * Enhanced PDF document loader with better error handling and metadata extraction.
 * Based on LangChain PDFLoader documentation best practices.
 */
async function loadDocuments() {
  console.log(`[RAG] Loading documents from: ${PDFS_PATH}`);

  // Check if PDFs directory exists
  if (!existsSync(PDFS_PATH)) {
    console.warn(`[RAG] PDFs directory not found: ${PDFS_PATH}`);
    return [];
  }

  // Get list of PDF files for progress tracking
  const pdfFiles = readdirSync(PDFS_PATH).filter((f: string) => f.toLowerCase().endsWith(".pdf"));
  loadingProgress.totalFiles = pdfFiles.length;
  loadingProgress.processedFiles = 0;
  loadingProgress.status = 'loading';

  if (pdfFiles.length === 0) {
    console.warn(`[RAG] No PDF files found in: ${PDFS_PATH}`);
    loadingProgress.status = 'completed';
    return [];
  }

  console.log(`[RAG] Found ${pdfFiles.length} PDF files to process`);

  try {
    // Enhanced DirectoryLoader with better error handling
    const loader = new DirectoryLoader(PDFS_PATH, {
      ".pdf": (filePath: string) => {
        loadingProgress.currentFile = path.basename(filePath);
        console.log(`[RAG] Loading PDF: ${loadingProgress.currentFile}`);

        // Create PDFLoader with enhanced configuration
        return new PDFLoader(filePath, {
          // Optional: Add custom PDF parsing options here
          // pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"), // Custom PDF.js build if needed
        });
      },
    });

    const docs = await loader.load();

    // Process and enhance document metadata
    const enhancedDocs = docs.map((doc, index) => {
      // Extract additional metadata from PDF info
      const pdfInfo = doc.metadata?.pdf;
      const enhancedMetadata = {
        ...doc.metadata,
        documentId: `doc_${index}`,
        fileName: path.basename(doc.metadata?.source || 'unknown'),
        totalPages: pdfInfo?.totalPages || 0,
        pdfVersion: pdfInfo?.version || 'unknown',
        processedAt: new Date().toISOString(),
        // Add recipe-specific metadata if available
        recipeName: extractRecipeName(doc.pageContent),
        ingredients: extractIngredients(doc.pageContent),
        category: extractCategory(doc.pageContent)
      };

      return {
        ...doc,
        metadata: enhancedMetadata
      };
    });

    loadingProgress.status = 'completed';
    console.log(`[RAG] Successfully loaded ${enhancedDocs.length} documents with enhanced metadata`);
    return enhancedDocs;

  } catch (error) {
    loadingProgress.status = 'error';
    console.error(`[RAG] Error loading documents:`, error);
    throw error;
  }
}

/**
 * Extract recipe name from document content
 */
function extractRecipeName(content: string): string | null {
  const lines = content.split('\n');
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    const trimmed = line.trim();
    if (trimmed && !trimmed.includes('原料') && !trimmed.includes('制作') && !trimmed.includes('步骤')) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Extract ingredients from document content
 */
function extractIngredients(content: string): string[] {
  const ingredients: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.includes('原料') || line.includes('材料')) {
      const nextLines = lines.slice(lines.indexOf(line) + 1, lines.indexOf(line) + 10);
      for (const nextLine of nextLines) {
        if (nextLine.trim().startsWith('-') || nextLine.trim().match(/^\d+\./)) {
          const ingredient = nextLine.replace(/^[-•\d.\s]+/, '').trim();
          if (ingredient && !ingredient.includes('制作') && !ingredient.includes('步骤')) {
            ingredients.push(ingredient);
          }
        }
      }
      break;
    }
  }

  return ingredients;
}

/**
 * Extract category from document content
 */
function extractCategory(content: string): string | null {
  const categories = ['经典', '现代', '热带', '烈酒', '清爽', '甜味', '酸味', '苦味'];
  for (const category of categories) {
    if (content.toLowerCase().includes(category.toLowerCase())) {
      return category;
    }
  }
  return '其他';
}

/**
 * Enhanced text splitting with recipe-specific chunking strategy.
 * Based on LangChain RecursiveCharacterTextSplitter best practices.
 * @param docs - An array of Document objects loaded by loadDocuments.
 */
async function splitDocuments(docs: any[]) {
  console.log("[RAG] Splitting documents into chunks...");

  // Enhanced text splitter configuration for cocktail recipes
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800, // Smaller chunks for better recipe matching
    chunkOverlap: 150, // Increased overlap for recipe continuity
    separators: [
      "\n\n", // Paragraph breaks
      "\n",   // Line breaks
      "。",    // Chinese sentence endings
      "！",    // Chinese exclamation
      "？",    // Chinese question mark
      "；",    // Chinese semicolon
      "，",    // Chinese comma
      " ",     // Space
      ""       // Character level
    ],
    // Custom chunking function for recipe-specific content
    chunkingFunction: async (text: string) => {
      const chunks: string[] = [];
      const lines = text.split('\n');
      let currentChunk = '';

      for (const line of lines) {
        // If line contains recipe name, start a new chunk
        if (line.trim() && !line.includes('原料') && !line.includes('制作') && !line.includes('步骤') && line.length < 50) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
        }

        currentChunk += (currentChunk ? '\n' : '') + line;

        // If chunk gets too large, split it
        if (currentChunk.length > 800) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      return chunks;
    }
  });

  const chunks = await textSplitter.splitDocuments(docs);

  // Enhance chunks with recipe-specific metadata
  const enhancedChunks = chunks.map((chunk, index) => {
    const content = chunk.pageContent;
    const metadata = chunk.metadata;

    // Extract recipe information from chunk content
    const recipeName = extractRecipeName(content);
    const ingredients = extractIngredients(content);
    const category = extractCategory(content);

    return {
      ...chunk,
      metadata: {
        ...metadata,
        chunkId: `chunk_${index}`,
        chunkIndex: index,
        recipeName: recipeName || metadata.recipeName,
        ingredients: ingredients.length > 0 ? ingredients : metadata.ingredients,
        category: category || metadata.category,
        chunkType: determineChunkType(content),
        wordCount: content.split(/\s+/).length,
        hasIngredients: content.includes('原料') || content.includes('材料'),
        hasSteps: content.includes('制作') || content.includes('步骤'),
        processedAt: new Date().toISOString()
      }
    };
  });

  console.log(`[RAG] Split into ${enhancedChunks.length} enhanced chunks`);
  return enhancedChunks;
}

/**
 * Determine the type of chunk based on content
 */
function determineChunkType(content: string): string {
  if (content.includes('原料') || content.includes('材料')) {
    return 'ingredients';
  } else if (content.includes('制作') || content.includes('步骤')) {
    return 'instructions';
  } else if (content.includes('技巧') || content.includes('注意')) {
    return 'tips';
  } else if (content.length < 100 && !content.includes('原料') && !content.includes('制作')) {
    return 'title';
  } else {
    return 'description';
  }
}

/**
 * Initializes embeddings model with multiple provider options.
 * Priority: OpenAI > HuggingFace > Local Xenova
 */
function getEmbeddings() {
  console.log("[RAG] Initializing embeddings model...");

  // 1. 优先使用 OpenAI Embeddings（最稳定）
  if (process.env.OPENAI_API_KEY) {
    console.log("[RAG] Using OpenAI embeddings (text-embedding-3-small)...");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small", // 更小、更快、更便宜
      maxRetries: 3,
      timeout: 30000,
    });
    console.log('[RAG] OpenAI embeddings initialized successfully');
    return embeddings;
  }

  // 2. 备选：HuggingFace API
  if (process.env.HUGGINGFACE_API_KEY) {
    console.log("[RAG] Using HuggingFace API embeddings (sentence-transformers/all-MiniLM-L6-v2)...");
    const { HuggingFaceInferenceEmbeddings } = require("@langchain/community/embeddings/hf");
    const embeddings = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey: process.env.HUGGINGFACE_API_KEY,
      maxRetries: 3,
      timeout: 30000,
    });
    console.log('[RAG] HuggingFace embeddings initialized successfully');
    return embeddings;
  }

  // 3. 最后备选：本地 Xenova 模型
  console.log("[RAG] No API keys found, using local Xenova embeddings...");
  const { HuggingFaceInferenceEmbeddings } = require("@langchain/community/embeddings/hf");
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: "Xenova/all-MiniLM-L6-v2", // 本地模型
  });
  console.log('[RAG] Local Xenova embeddings initialized successfully');
  return embeddings;
}

/**
 * Creates a local in-memory vector store from the document chunks with retry mechanism.
 * @param chunks - The document chunks from splitDocuments
 * @param embeddings - The initialized embeddings model
 */
async function createVectorStore(chunks: any[], embeddings: any) {
  console.log("[RAG] Building in-memory vector store...");
  loadingProgress.status = 'processing';

  const vectorStore = new MemoryVectorStore(embeddings);

  // 添加重试机制
  let retries = 3;
  let lastError: any;

  while (retries > 0) {
    try {
      console.log(`[RAG] Adding ${chunks.length} chunks to vector store (attempt ${4 - retries}/3)...`);
      await vectorStore.addDocuments(chunks);
      console.log("[RAG] Vector store ready (in-memory).");
      return vectorStore;
    } catch (error) {
      lastError = error;
      retries--;
      console.warn(`[RAG] Failed to add documents to vector store. Retries left: ${retries}`, error);

      if (retries > 0) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // 如果所有重试都失败了，抛出错误
  throw new Error(`Failed to create vector store after 3 attempts. Last error: ${lastError?.message || lastError}`);
}

/**
 * The main function to orchestrate the RAG data processing pipeline.
 * It loads PDFs from the ./pdfs directory, splits them into chunks,
 * generates embeddings, and stores them in a Chroma vector store.
 */
export async function runRagPipeline() {
  try {
    console.log("--- Starting RAG Pipeline ---");
    const docs = await loadDocuments();

    // If no documents are found, exit gracefully.
    if (docs.length === 0) {
      console.log("No documents found in the 'pdfs' directory. RAG pipeline finished.");
      return { success: true, message: "No documents to process." };
    }

    const chunks = await splitDocuments(docs);
    const embeddings = getEmbeddings();
    memoryStore = await createVectorStore(chunks, embeddings);
    console.log('memoryStore', memoryStore);

    lastDocsCount = docs.length;
    lastChunksCount = chunks.length;
    console.log("--- RAG Pipeline Completed Successfully ---");
    return { success: true, message: `Successfully processed ${docs.length} documents and created ${chunks.length} chunks.` };
  } catch (error) {
    console.error("--- RAG Pipeline Failed ---", error);
    return { success: false, message: "An error occurred during the RAG pipeline.", error };
  }
}

/**
 * Queries the vector store to find relevant documents for a given query.
 * @param query - The user's query string.
 * @param k - The number of top results to retrieve.
 * @returns A list of relevant documents with their scores.
 */
export async function queryVectorStore(query: string, k: number = 5) {
  try {
    console.log(`[RAG] Querying vector store for: "${query}"`);
    if (!memoryStore) {
      console.warn("[RAG] Vector store not initialized. Running pipeline first...");
      const init = await runRagPipeline();
      if (!init.success || !memoryStore) {
        return { success: false, error: "Vector store not available" };
      }
    }

    const results = await memoryStore.similaritySearchWithScore(query, k);

    console.log(`[RAG] Found ${results.length} relevant documents.`);
    return { success: true, results };
  } catch (error) {
    console.error(`[RAG] Error querying vector store:`, error);
    return { success: false, error };
  }
}

/**
 * Returns current RAG status for diagnostics with enhanced information.
 */
export async function getRagStatus() {
  const pdfCount = existsSync(PDFS_PATH)
    ? readdirSync(PDFS_PATH).filter((f: string) => f.toLowerCase().endsWith(".pdf")).length
    : 0;

  return {
    initialized: Boolean(memoryStore),
    docs: lastDocsCount,
    chunks: lastChunksCount,
    loadingProgress: {
      ...loadingProgress,
      percentage: loadingProgress.totalFiles > 0
        ? Math.round((loadingProgress.processedFiles / loadingProgress.totalFiles) * 100)
        : 0
    },
    vectorStore: {
      type: memoryStore ? "memory" : "none",
      connected: Boolean(memoryStore),
    },
    embeddings: {
      model: "Xenova/all-MiniLM-L6-v2",
      provider: "@huggingface/inference",
    },
    pdf: {
      path: PDFS_PATH,
      files: pdfCount,
      exists: existsSync(PDFS_PATH)
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get detailed loading progress information
 */
export function getLoadingProgress() {
  return {
    ...loadingProgress,
    percentage: loadingProgress.totalFiles > 0
      ? Math.round((loadingProgress.processedFiles / loadingProgress.totalFiles) * 100)
      : 0,
    estimatedTimeRemaining: calculateEstimatedTime(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Calculate estimated time remaining based on current progress
 */
function calculateEstimatedTime(): string | null {
  if (loadingProgress.status !== 'loading' || loadingProgress.processedFiles === 0) {
    return null;
  }

  const avgTimePerFile = 2000; // 2 seconds per file (rough estimate)
  const remainingFiles = loadingProgress.totalFiles - loadingProgress.processedFiles;
  const estimatedMs = remainingFiles * avgTimePerFile;

  if (estimatedMs < 1000) {
    return '< 1 second';
  } else if (estimatedMs < 60000) {
    return `${Math.round(estimatedMs / 1000)} seconds`;
  } else {
    return `${Math.round(estimatedMs / 60000)} minutes`;
  }
}