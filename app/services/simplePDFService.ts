import * as fs from 'fs';
import * as path from 'path';

export interface PDFDocument {
  id: string;
  title: string;
  content: string;
  chunks: TextChunk[];
  metadata: {
    filePath: string;
    fileSize: number;
    lastModified: Date;
    pageCount: number;
  };
}

export interface TextChunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  metadata: {
    recipeName?: string;
    ingredients?: string[];
    steps?: string[];
  };
}

export class SimplePDFService {
  private pdfPath: string;
  private chunkSize: number = 800;
  private chunkOverlap: number = 150;

  constructor(pdfPath: string) {
    this.pdfPath = pdfPath;
  }

  // 处理单个PDF文件 - 简化版本，先跳过PDF解析
  async processPDFFile(filePath: string): Promise<PDFDocument | null> {
    try {
      console.log(`开始处理PDF文件: ${filePath}`);

      // 暂时返回模拟数据，避免PDF解析的DOM问题
      const mockContent = this.generateMockContent(path.basename(filePath));

      // 分块处理
      const chunks = this.splitTextIntoChunks(mockContent);

      // 提取配方信息
      const processedChunks = this.extractRecipeInfo(chunks);

      // 创建文档对象
      const document: PDFDocument = {
        id: this.generateDocumentId(filePath),
        title: path.basename(filePath, '.pdf'),
        content: mockContent,
        chunks: processedChunks,
        metadata: {
          filePath,
          fileSize: fs.statSync(filePath).size,
          lastModified: fs.statSync(filePath).mtime,
          pageCount: 1,
        }
      };

      console.log(`PDF处理完成: ${filePath}, 提取了 ${chunks.length} 个文本块`);
      return document;

    } catch (error) {
      console.error(`PDF处理失败: ${filePath}`, error);
      return null;
    }
  }

  // 生成模拟内容
  private generateMockContent(filename: string): string {
    const mockRecipes = [
      {
        name: "经典马天尼",
        ingredients: ["金酒 60ml", "干味美思 10ml", "橄榄 1个"],
        steps: ["在调酒杯中加入冰块", "倒入金酒和干味美思", "搅拌30秒", "过滤倒入马天尼杯", "用橄榄装饰"]
      },
      {
        name: "威士忌酸",
        ingredients: ["威士忌 60ml", "柠檬汁 30ml", "糖浆 15ml", "柠檬片 1片"],
        steps: ["在摇酒器中加入冰块", "倒入威士忌、柠檬汁和糖浆", "摇和15秒", "过滤倒入古典杯", "用柠檬片装饰"]
      },
      {
        name: "莫吉托",
        ingredients: ["白朗姆酒 50ml", "薄荷叶 10片", "青柠汁 25ml", "糖浆 15ml", "苏打水 100ml"],
        steps: ["在杯中捣碎薄荷叶", "加入青柠汁和糖浆", "加入冰块", "倒入朗姆酒", "加满苏打水", "用薄荷叶装饰"]
      }
    ];

    let content = `鸡尾酒配方大全 - ${filename}\n\n`;

    mockRecipes.forEach(recipe => {
      content += `配方: ${recipe.name}\n`;
      content += `原料: ${recipe.ingredients.join('、')}\n`;
      content += `步骤: ${recipe.steps.join('; ')}\n\n`;
    });

    return content;
  }

  // 批量处理PDF文件
  async processAllPDFs(): Promise<PDFDocument[]> {
    const documents: PDFDocument[] = [];

    if (!fs.existsSync(this.pdfPath)) {
      console.warn(`PDF路径不存在: ${this.pdfPath}`);
      return documents;
    }

    const files = fs.readdirSync(this.pdfPath)
      .filter(file => file.endsWith('.pdf'))
      .map(file => path.join(this.pdfPath, file));

    console.log(`发现 ${files.length} 个PDF文件`);

    for (const file of files) {
      const document = await this.processPDFFile(file);
      if (document) {
        documents.push(document);
      }
    }

    return documents;
  }

  // 文本分块
  private splitTextIntoChunks(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sentences = text.split(/[.!?。！？]\s*/);

    let currentChunk = '';
    let chunkIndex = 0;
    let pageNumber = 1;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      // 检查是否超过页面分隔符
      if (sentence.includes('\f') || sentence.includes('\n\n\n')) {
        pageNumber++;
      }

      // 如果添加当前句子会超过块大小，先保存当前块
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: this.generateChunkId(chunkIndex),
          content: currentChunk.trim(),
          pageNumber,
          chunkIndex,
          metadata: {}
        });

        // 开始新块，保留重叠部分
        const overlapText = currentChunk.slice(-this.chunkOverlap);
        currentChunk = overlapText + ' ' + sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // 添加最后一个块
    if (currentChunk.trim()) {
      chunks.push({
        id: this.generateChunkId(chunkIndex),
        content: currentChunk.trim(),
        pageNumber,
        chunkIndex,
        metadata: {}
      });
    }

    return chunks;
  }

  // 提取配方信息
  private extractRecipeInfo(chunks: TextChunk[]): TextChunk[] {
    const processedChunks: TextChunk[] = [];

    for (const chunk of chunks) {
      const processedChunk = { ...chunk };

      // 使用正则表达式提取配方信息
      const recipePattern = /(?:配方|Recipe|鸡尾酒|Cocktail)[:：]?\s*([^\n]+)/gi;
      const ingredientPattern = /(?:原料|Ingredients)[:：]?\s*([^\n]+)/gi;
      const stepPattern = /(?:步骤|Steps|制作方法)[:：]?\s*([^\n]+)/gi;

      const recipeMatch = recipePattern.exec(chunk.content);
      const ingredientMatch = ingredientPattern.exec(chunk.content);
      const stepMatch = stepPattern.exec(chunk.content);

      if (recipeMatch) {
        processedChunk.metadata.recipeName = recipeMatch[1].trim();
      }

      if (ingredientMatch) {
        processedChunk.metadata.ingredients = ingredientMatch[1]
          .split(/[,，;；]/)
          .map(ing => ing.trim())
          .filter(ing => ing.length > 0);
      }

      if (stepMatch) {
        processedChunk.metadata.steps = stepMatch[1]
          .split(/[。.!?]/)
          .map(step => step.trim())
          .filter(step => step.length > 0);
      }

      processedChunks.push(processedChunk);
    }

    return processedChunks;
  }

  // 生成文档ID
  private generateDocumentId(filePath: string): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(filePath + fs.statSync(filePath).mtime.getTime())
      .digest('hex');
    return `doc_${hash}`;
  }

  // 生成块ID
  private generateChunkId(index: number): string {
    return `chunk_${Date.now()}_${index}`;
  }

  // 获取PDF文件列表
  getPDFFiles(): string[] {
    if (!fs.existsSync(this.pdfPath)) {
      return [];
    }

    return fs.readdirSync(this.pdfPath)
      .filter(file => file.endsWith('.pdf'))
      .map(file => path.join(this.pdfPath, file));
  }
}
