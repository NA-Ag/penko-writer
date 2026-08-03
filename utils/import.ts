// Document import utilities for various file formats
import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ImportResult {
  success: boolean;
  title: string;
  content: string;
  error?: string;
}

/**
 * Import a .docx file and convert to HTML
 */
export async function importDocx(file: File): Promise<ImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          // Map Word styles to HTML/CSS
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Title'] => h1.title:fresh",
          "p[style-name='Subtitle'] => h2.subtitle:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
        ],
        convertImage: mammoth.images.imgElement(async (image) => {
          // Convert images to base64 data URLs
          const buffer = await image.read();
          const base64 = arrayBufferToBase64(buffer);
          const contentType = image.contentType || 'image/png';
          return {
            src: `data:${contentType};base64,${base64}`,
          };
        }),
      }
    );

    // Log any conversion messages/warnings
    if (result.messages.length > 0) {
      console.log('[Import] Docx conversion messages:', result.messages);
    }

    return {
      success: true,
      title: file.name.replace(/\.docx$/i, ''),
      content: result.value,
    };
  } catch (error) {
    console.error('[Import] Docx import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: error instanceof Error ? error.message : 'Failed to import DOCX file',
    };
  }
}

/**
 * Import a .doc file (legacy Word format)
 * Note: Full .doc support requires complex parsing. This is a basic implementation.
 */
export async function importDoc(file: File): Promise<ImportResult> {
  try {
    // Legacy .doc format is binary and complex
    // For basic text extraction, we'll try to parse as plain text
    const text = await file.text();

    // Remove binary garbage and extract readable text
    const cleaned = text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII
      .trim();

    // Wrap in paragraphs
    const paragraphs = cleaned
      .split(/\n+/)
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');

    return {
      success: true,
      title: file.name.replace(/\.doc$/i, ''),
      content: paragraphs || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] Doc import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: 'Legacy .doc format has limited support. Please convert to .docx for best results.',
    };
  }
}

/**
 * Import a .txt file
 */
export async function importTxt(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();

    // Convert plain text to HTML paragraphs
    const paragraphs = text
      .split(/\n\n+/) // Double newlines = paragraph breaks
      .map(paragraph => {
        const lines = paragraph
          .split('\n')
          .map(line => escapeHtml(line))
          .join('<br>');
        return `<p>${lines}</p>`;
      })
      .join('');

    return {
      success: true,
      title: file.name.replace(/\.txt$/i, ''),
      content: paragraphs || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] Txt import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: error instanceof Error ? error.message : 'Failed to import text file',
    };
  }
}

/**
 * Import an .html file
 */
export async function importHtml(file: File): Promise<ImportResult> {
  try {
    const html = await file.text();

    // Extract content from body tag if present
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : html;

    // Sanitize (basic - remove script tags)
    const sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    return {
      success: true,
      title: file.name.replace(/\.html?$/i, ''),
      content: sanitized.trim() || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] HTML import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: error instanceof Error ? error.message : 'Failed to import HTML file',
    };
  }
}

/**
 * Import a .odt file (OpenDocument Text)
 */
export async function importOdt(file: File): Promise<ImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // ODT files are ZIP archives containing XML
    const contentXml = await zip.file('content.xml')?.async('text');
    if (!contentXml) {
      throw new Error('Invalid ODT file: content.xml not found');
    }

    // Parse XML and extract text content
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

    // Extract all text:p (paragraph) elements
    const paragraphs = xmlDoc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'p');
    const html: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const text = p.textContent?.trim() || '';
      if (text) {
        // Check if it's a heading
        const styleName = p.getAttribute('text:style-name') || '';
        if (styleName.toLowerCase().includes('heading')) {
          html.push(`<h2>${escapeHtml(text)}</h2>`);
        } else {
          html.push(`<p>${escapeHtml(text)}</p>`);
        }
      }
    }

    return {
      success: true,
      title: file.name.replace(/\.odt$/i, ''),
      content: html.join('') || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] ODT import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: error instanceof Error ? error.message : 'Failed to import ODT file',
    };
  }
}

/**
 * Import a .rtf file (Rich Text Format)
 */
export async function importRtf(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();

    // Basic RTF to HTML conversion
    // Remove RTF control words and convert to HTML
    let html = text
      // Remove RTF header
      .replace(/\{\\rtf1[^}]*\}/g, '')
      // Convert bold (\b text\b0)
      .replace(/\\b\s+([^\\]+?)\\b0/g, '<strong>$1</strong>')
      // Convert italic (\i text\i0)
      .replace(/\\i\s+([^\\]+?)\\i0/g, '<em>$1</em>')
      // Convert underline (\ul text\ul0)
      .replace(/\\ul\s+([^\\]+?)\\ul0/g, '<u>$1</u>')
      // Convert paragraphs (\par)
      .replace(/\\par\s*/g, '</p><p>')
      // Remove remaining RTF control words
      .replace(/\\[a-z]+(-?\d+)?[ ]?/g, '')
      // Remove curly braces
      .replace(/[{}]/g, '')
      // Clean up whitespace
      .trim();

    // Wrap in paragraph tags
    if (!html.startsWith('<p>')) {
      html = '<p>' + html + '</p>';
    }

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '<p><br></p>');

    return {
      success: true,
      title: file.name.replace(/\.rtf$/i, ''),
      content: html || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] RTF import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: 'RTF import has basic support. Some formatting may be lost.',
    };
  }
}

/**
 * Import a .md (Markdown) file
 */
export async function importMarkdown(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();

    // Basic Markdown to HTML conversion
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Line breaks -> paragraphs
      .split('\n\n')
      .map(p => {
        if (p.trim().startsWith('<h') || p.trim() === '') {
          return p;
        }
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    return {
      success: true,
      title: file.name.replace(/\.md$/i, ''),
      content: html || '<p><br></p>',
    };
  } catch (error) {
    console.error('[Import] Markdown import error:', error);
    return {
      success: false,
      title: file.name,
      content: '',
      error: error instanceof Error ? error.message : 'Failed to import Markdown file',
    };
  }
}

/**
 * Main import function - detects file type and routes to appropriate importer
 */
export async function importDocument(file: File): Promise<ImportResult> {
  const extension = file.name.toLowerCase().split('.').pop();

  switch (extension) {
    case 'docx':
      return importDocx(file);
    case 'doc':
      return importDoc(file);
    case 'txt':
      return importTxt(file);
    case 'html':
    case 'htm':
      return importHtml(file);
    case 'odt':
      return importOdt(file);
    case 'rtf':
      return importRtf(file);
    case 'md':
      return importMarkdown(file);
    default:
      return {
        success: false,
        title: file.name,
        content: '',
        error: `Unsupported file format: .${extension}. Supported formats: .docx, .doc, .txt, .html, .odt, .rtf, .md`,
      };
  }
}

/**
 * Helper: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Escape HTML entities
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validate file size (max 50MB)
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['docx', 'doc', 'txt', 'html', 'htm', 'odt', 'rtf', 'md'];
}

/**
 * Get file accept string for input element
 */
export function getFileAcceptString(): string {
  return '.docx,.doc,.txt,.html,.htm,.odt,.rtf,.md';
}

/**
 * Import documents from a ZIP archive
 */
export async function importArchive(file: File): Promise<{
  success: boolean;
  documents: any[];
  error?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const documents: any[] = [];
    const errors: string[] = [];

    // Find all JSON files in the archive
    const jsonFiles = Object.keys(zip.files).filter(filename =>
      filename.endsWith('.json') && filename !== 'metadata.json' && !filename.startsWith('__MACOSX')
    );

    if (jsonFiles.length === 0) {
      return {
        success: false,
        documents: [],
        error: 'No document files found in archive',
      };
    }

    // Parse each JSON file
    for (const filename of jsonFiles) {
      try {
        const content = await zip.file(filename)?.async('text');
        if (content) {
          const docData = JSON.parse(content);

          // Validate required fields
          if (!docData.title || !docData.content) {
            errors.push(`Invalid document in ${filename}: missing title or content`);
            continue;
          }

          // Generate new ID to avoid conflicts
          const importedDoc = {
            id: crypto.randomUUID(),
            title: docData.title + ' (imported)',
            content: docData.content,
            createdAt: Date.now(),
            lastModified: Date.now(),
            pageConfig: docData.pageConfig,
            language: docData.language,
            header: docData.header,
            footer: docData.footer,
            showPageNumbers: docData.showPageNumbers,
            pageNumberPosition: docData.pageNumberPosition,
            comments: docData.comments || [],
            trackChanges: docData.trackChanges || [],
            trackingEnabled: docData.trackingEnabled || false,
            currentUser: docData.currentUser,
          };

          documents.push(importedDoc);
        }
      } catch (err) {
        errors.push(`Failed to parse ${filename}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (documents.length === 0) {
      return {
        success: false,
        documents: [],
        error: errors.length > 0 ? errors.join('\n') : 'No valid documents found in archive',
      };
    }

    console.log(`[Import] Successfully imported ${documents.length} documents from archive`);

    return {
      success: true,
      documents,
      error: errors.length > 0 ? `Imported ${documents.length} documents with ${errors.length} errors` : undefined,
    };
  } catch (error) {
    console.error('[Import] Archive import error:', error);
    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : 'Failed to import archive',
    };
  }
}
