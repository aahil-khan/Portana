import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('FileParser');

/**
 * Extract text from PDF file
 * Uses pdfparse library to extract text
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Dynamic import to avoid loading pdf-parse unless needed
    const pdfParse = await import('pdf-parse').then((m) => m.default);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    return data.text || '';
  } catch (error) {
    logger.error('Failed to extract text from PDF', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from DOCX file
 * Uses mammoth library to extract text
 */
async function extractTextFromDOCX(filePath: string): Promise<string> {
  try {
    // Dynamic import to avoid loading mammoth unless needed
    const mammoth = await import('mammoth').then((m) => m.default);

    const result = await mammoth.extractRawText({ path: filePath });

    return result.value || '';
  } catch (error) {
    logger.error('Failed to extract text from DOCX', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from document file (PDF or DOCX)
 * Automatically detects file type by extension
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    logger.info('Extracting text from file', { filePath, extension: ext });

    switch (ext) {
      case '.pdf':
        return await extractTextFromPDF(filePath);

      case '.docx':
      case '.doc':
        return await extractTextFromDOCX(filePath);

      default:
        throw new Error(`Unsupported file type: ${ext}. Only .pdf and .docx are supported.`);
    }
  } catch (error) {
    logger.error('Error extracting text from file', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
