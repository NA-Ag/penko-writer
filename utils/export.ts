import { DocumentData } from '../types';
import { PAGE_MARGINS, PAGE_SIZES } from '../constants';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import JSZip from 'jszip';
import { htmlToMarkdown } from './markdownConverter';

export const exportToDoc = (doc: DocumentData) => {
  const config = doc.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal' };
  
  let width = PAGE_SIZES[config.size].width;
  let height = PAGE_SIZES[config.size].height;
  if(config.orientation === 'landscape') {
      [width, height] = [height, width];
  }
  
  const marginVal = PAGE_MARGINS[config.margins] || '2.54cm';

  const preHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset='utf-8'>
        <title>${doc.title}</title>
        <style>
            @page {
                size: ${width} ${height};
                margin: ${marginVal};
            }
            body { 
                font-family: 'Times New Roman', serif; 
                font-size: 11pt; 
                line-height: 1.15;
            }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid black; padding: 5px; }
            /* Hide print UI elements if any exist in content */
            .no-print { display: none; }
        </style>
    </head>
    <body>
  `;
  const postHtml = "</body></html>";
  
  const html = preHtml + doc.content + postHtml;

  const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
  });
  
  const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
  
  const downloadLink = document.createElement("a");
  document.body.appendChild(downloadLink);
  
  if(navigator.userAgent.indexOf("Chrome") !== -1) {
      downloadLink.href = URL.createObjectURL(blob);
  } else {
      downloadLink.href = url;
  }
  
  downloadLink.download = `${doc.title || 'Document'}.doc`;
  downloadLink.click();

  document.body.removeChild(downloadLink);
};

export const exportToDocx = async (doc: DocumentData) => {
  try {
    // Parse HTML content to extract text and basic formatting
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(doc.content, 'text/html');
    const paragraphs: Paragraph[] = [];

    // Convert HTML elements to DOCX paragraphs
    const processNode = (node: Node) => {
      if (node.nodeName === 'H1') {
        paragraphs.push(new Paragraph({
          text: node.textContent || '',
          heading: HeadingLevel.HEADING_1,
        }));
      } else if (node.nodeName === 'H2') {
        paragraphs.push(new Paragraph({
          text: node.textContent || '',
          heading: HeadingLevel.HEADING_2,
        }));
      } else if (node.nodeName === 'H3') {
        paragraphs.push(new Paragraph({
          text: node.textContent || '',
          heading: HeadingLevel.HEADING_3,
        }));
      } else if (node.nodeName === 'H4') {
        paragraphs.push(new Paragraph({
          text: node.textContent || '',
          heading: HeadingLevel.HEADING_4,
        }));
      } else if (node.nodeName === 'P') {
        const element = node as HTMLElement;
        const children: TextRun[] = [];

        // Process inline formatting
        element.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            children.push(new TextRun({ text: child.textContent || '' }));
          } else if (child.nodeName === 'STRONG' || child.nodeName === 'B') {
            children.push(new TextRun({ text: child.textContent || '', bold: true }));
          } else if (child.nodeName === 'EM' || child.nodeName === 'I') {
            children.push(new TextRun({ text: child.textContent || '', italics: true }));
          } else if (child.nodeName === 'U') {
            children.push(new TextRun({ text: child.textContent || '', underline: {} }));
          } else {
            children.push(new TextRun({ text: child.textContent || '' }));
          }
        });

        // Handle text alignment
        let alignment = AlignmentType.LEFT;
        const textAlign = element.style.textAlign;
        if (textAlign === 'center') alignment = AlignmentType.CENTER;
        else if (textAlign === 'right') alignment = AlignmentType.RIGHT;
        else if (textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

        paragraphs.push(new Paragraph({
          children: children.length > 0 ? children : [new TextRun({ text: element.textContent || '' })],
          alignment,
        }));
      } else if (node.nodeName === 'BR') {
        paragraphs.push(new Paragraph({ text: '' }));
      }
    };

    // Process all body elements
    htmlDoc.body.childNodes.forEach(processNode);

    // If no paragraphs were created, add at least one empty paragraph
    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({ text: '' }));
    }

    // Create DOCX document
    const docxDocument = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,  // 1 inch in twips (1440 twips = 1 inch)
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      }],
    });

    // Generate and download the DOCX file
    const blob = await Packer.toBlob(docxDocument);
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${doc.title || 'Document'}.docx`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('DOCX export error:', error);
    alert('Failed to export DOCX. Please try again.');
  }
};

/**
 * Export screenplay to PDF with industry-standard formatting
 * - Courier 12pt font
 * - Letter size, portrait
 * - Margins: Left 1.5", Right 1.0", Top 1.0", Bottom 1.0"
 */
export const exportScreenplayToPdf = async (doc: DocumentData) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter',
      compress: true
    });

    // Industry-standard screenplay margins
    const margins = {
      left: 1.5,   // 1.5 inches
      right: 1.0,  // 1.0 inch
      top: 1.0,    // 1.0 inch
      bottom: 1.0  // 1.0 inch
    };

    const pageWidth = 8.5;  // Letter width in inches
    const pageHeight = 11;  // Letter height in inches
    const contentWidth = pageWidth - margins.left - margins.right;

    // Set Courier font (standard for screenplays)
    pdf.setFont('courier');
    pdf.setFontSize(12);

    // Parse HTML content
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(doc.content, 'text/html');

    let yPosition = margins.top;
    const lineHeight = 12 / 72; // 12pt to inches (72 points per inch)

    // Check if we need a new page
    const checkPageBreak = () => {
      if (yPosition + lineHeight > pageHeight - margins.bottom) {
        pdf.addPage();
        yPosition = margins.top;
        return true;
      }
      return false;
    };

    // Process each paragraph in the screenplay
    const processParagraph = (element: HTMLElement) => {
      const screenplayType = element.getAttribute('data-screenplay-type');
      const text = element.textContent?.trim() || '';

      if (!text && !screenplayType) return;

      checkPageBreak();

      // Calculate indentation based on screenplay element type
      let leftIndent = 0;
      let maxWidth = contentWidth;
      let alignment: 'left' | 'center' | 'right' = 'left';
      let addSpaceBefore = 0;
      let addSpaceAfter = 0;

      switch (screenplayType) {
        case 'scene-heading':
          // Scene headings: left-aligned, all caps, extra space before
          leftIndent = 0;
          maxWidth = contentWidth;
          addSpaceBefore = lineHeight * 2;
          addSpaceAfter = lineHeight;
          pdf.setFont('courier', 'bold');
          break;

        case 'action':
          // Action: left-aligned, normal spacing
          leftIndent = 0;
          maxWidth = contentWidth;
          addSpaceAfter = lineHeight;
          pdf.setFont('courier', 'normal');
          break;

        case 'character':
          // Character: indented 3.7" from left edge
          leftIndent = 3.7 - margins.left;
          maxWidth = contentWidth - leftIndent;
          addSpaceBefore = lineHeight;
          pdf.setFont('courier', 'normal');
          break;

        case 'parenthetical':
          // Parenthetical: indented 3.1" from left edge
          leftIndent = 3.1 - margins.left;
          maxWidth = contentWidth - leftIndent;
          pdf.setFont('courier', 'normal');
          break;

        case 'dialogue':
          // Dialogue: indented 2.5" from left, max width 3.5"
          leftIndent = 2.5 - margins.left;
          maxWidth = 3.5;
          addSpaceAfter = lineHeight;
          pdf.setFont('courier', 'normal');
          break;

        case 'transition':
          // Transition: right-aligned, all caps
          leftIndent = 0;
          maxWidth = contentWidth;
          alignment = 'right';
          addSpaceBefore = lineHeight;
          addSpaceAfter = lineHeight;
          pdf.setFont('courier', 'normal');
          break;

        default:
          // Default to action formatting
          leftIndent = 0;
          maxWidth = contentWidth;
          pdf.setFont('courier', 'normal');
      }

      // Add space before if needed
      if (addSpaceBefore > 0) {
        yPosition += addSpaceBefore;
        checkPageBreak();
      }

      // Split text into lines that fit the width
      const lines = pdf.splitTextToSize(text, maxWidth);

      // Render each line
      lines.forEach((line: string, index: number) => {
        if (index > 0) checkPageBreak();

        let xPos = margins.left + leftIndent;

        if (alignment === 'right') {
          xPos = pageWidth - margins.right;
          pdf.text(line, xPos, yPosition, { align: 'right' });
        } else if (alignment === 'center') {
          xPos = margins.left + (contentWidth / 2);
          pdf.text(line, xPos, yPosition, { align: 'center' });
        } else {
          pdf.text(line, xPos, yPosition);
        }

        yPosition += lineHeight;
      });

      // Add space after if needed
      if (addSpaceAfter > 0) {
        yPosition += addSpaceAfter;
      }

      // Reset font to normal
      pdf.setFont('courier', 'normal');
    };

    // Process all paragraphs
    const paragraphs = htmlDoc.querySelectorAll('p');
    paragraphs.forEach(p => {
      processParagraph(p as HTMLElement);
    });

    // Add page numbers (optional, centered at bottom)
    const pageCount = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(12);
      pdf.setFont('courier', 'normal');
      pdf.text(`${i}.`, pageWidth / 2, pageHeight - 0.5, { align: 'center' });
    }

    pdf.save(`${doc.title || 'Screenplay'}.pdf`);
  } catch (error) {
    console.error('Screenplay PDF export error:', error);
    alert('Failed to export screenplay PDF. Please try again.');
  }
};

export const exportToPdf = async (doc: DocumentData) => {
  // Use screenplay-specific export if this is a screenplay
  if (doc.isScreenplay) {
    return exportScreenplayToPdf(doc);
  }

  try {
    const config = doc.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal' };
    const orientation = config.orientation === 'landscape' ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: config.size === 'A4' ? 'a4' : 'letter',
      compress: true
    });

    // Get page dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate margins
    const marginMap = {
      normal: 25.4,    // 1 inch
      narrow: 12.7,    // 0.5 inch
      wide: 50.8,      // 2 inches
      none: 0
    };
    const margin = marginMap[config.margins || 'normal'];
    const contentWidth = pageWidth - (2 * margin);

    // Parse HTML content
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(doc.content, 'text/html');

    let yPosition = margin;
    const lineHeight = 7; // mm

    // Process each node in the document
    const processNode = (node: Node, indent: number = 0) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (!text) return;

        const lines = pdf.splitTextToSize(text, contentWidth - indent);
        lines.forEach((line: string) => {
          if (yPosition + lineHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin + indent, yPosition);
          yPosition += lineHeight;
        });
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Handle headings
      if (tagName.match(/^h[1-6]$/)) {
        const level = parseInt(tagName[1]);
        const fontSize = Math.max(24 - (level * 3), 12);

        if (yPosition + lineHeight * 2 > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');

        const text = element.textContent || '';
        const lines = pdf.splitTextToSize(text, contentWidth);
        lines.forEach((line: string) => {
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight * 1.5;
        });

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        yPosition += lineHeight * 0.5;
        return;
      }

      // Handle paragraphs
      if (tagName === 'p') {
        if (yPosition > margin + lineHeight) {
          yPosition += lineHeight * 0.3; // Small gap before paragraph
        }

        let textIndent = 0;
        const align = element.style.textAlign;

        // Process inline formatting
        element.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim();
            if (!text) return;

            const lines = pdf.splitTextToSize(text, contentWidth - textIndent);
            lines.forEach((line: string) => {
              if (yPosition + lineHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
              }

              let xPos = margin + textIndent;
              if (align === 'center') {
                xPos = pageWidth / 2;
                pdf.text(line, xPos, yPosition, { align: 'center' });
              } else if (align === 'right') {
                xPos = pageWidth - margin;
                pdf.text(line, xPos, yPosition, { align: 'right' });
              } else if (align === 'justify') {
                pdf.text(line, xPos, yPosition, { align: 'justify', maxWidth: contentWidth });
              } else {
                pdf.text(line, xPos, yPosition);
              }

              yPosition += lineHeight;
            });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as HTMLElement;
            const childTag = childEl.tagName.toLowerCase();
            const text = childEl.textContent?.trim() || '';

            // Handle bold, italic, underline
            if (childTag === 'strong' || childTag === 'b') {
              pdf.setFont('helvetica', 'bold');
            } else if (childTag === 'em' || childTag === 'i') {
              pdf.setFont('helvetica', 'italic');
            }

            const lines = pdf.splitTextToSize(text, contentWidth - textIndent);
            lines.forEach((line: string) => {
              if (yPosition + lineHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
              }
              pdf.text(line, margin + textIndent, yPosition);
              yPosition += lineHeight;
            });

            pdf.setFont('helvetica', 'normal');
          }
        });

        yPosition += lineHeight * 0.3; // Small gap after paragraph
        return;
      }

      // Handle lists
      if (tagName === 'ul' || tagName === 'ol') {
        yPosition += lineHeight * 0.5;
        let counter = 1;

        element.querySelectorAll('li').forEach(li => {
          if (yPosition + lineHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          const bullet = tagName === 'ul' ? '•' : `${counter}.`;
          const text = li.textContent?.trim() || '';

          pdf.text(bullet, margin + 5, yPosition);

          const lines = pdf.splitTextToSize(text, contentWidth - 15);
          lines.forEach((line: string, idx: number) => {
            if (idx > 0 && yPosition + lineHeight > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 15, yPosition);
            yPosition += lineHeight;
          });

          counter++;
        });

        yPosition += lineHeight * 0.5;
        return;
      }

      // Handle tables
      if (tagName === 'table') {
        const rows: any[][] = [];
        element.querySelectorAll('tr').forEach(tr => {
          const row: string[] = [];
          tr.querySelectorAll('td, th').forEach(cell => {
            row.push(cell.textContent?.trim() || '');
          });
          if (row.length > 0) rows.push(row);
        });

        if (rows.length > 0) {
          (pdf as any).autoTable({
            startY: yPosition,
            head: rows.length > 0 ? [rows[0]] : [],
            body: rows.slice(1),
            margin: { left: margin, right: margin },
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 2 },
            headStyles: { fillColor: [66, 139, 202], fontStyle: 'bold' }
          });

          yPosition = (pdf as any).lastAutoTable.finalY + lineHeight;
        }
        return;
      }

      // Handle horizontal rule
      if (tagName === 'hr') {
        if (yPosition + lineHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight;
        return;
      }

      // Recursively process children for other elements
      element.childNodes.forEach(child => processNode(child, indent));
    };

    // Start processing
    htmlDoc.body.childNodes.forEach(node => processNode(node));

    // Add header and footer if present
    if (doc.header || doc.footer || doc.showPageNumbers) {
      const pageCount = (pdf as any).internal.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(128, 128, 128);

        // Header
        if (doc.header) {
          pdf.text(doc.header, pageWidth / 2, 15, { align: 'center' });
        }

        // Footer / Page numbers
        if (doc.footer || doc.showPageNumbers) {
          const footerY = pageHeight - 10;

          if (doc.footer) {
            pdf.text(doc.footer, pageWidth / 2, footerY, { align: 'center' });
          }

          if (doc.showPageNumbers) {
            const pageNumText = `Page ${i} of ${pageCount}`;
            const position = doc.pageNumberPosition || 'footer-center';

            if (position.includes('footer')) {
              const footerPageY = doc.footer ? footerY + 5 : footerY;
              if (position.includes('left')) {
                pdf.text(pageNumText, margin, footerPageY);
              } else if (position.includes('right')) {
                pdf.text(pageNumText, pageWidth - margin, footerPageY, { align: 'right' });
              } else {
                pdf.text(pageNumText, pageWidth / 2, footerPageY, { align: 'center' });
              }
            }
          }
        }

        pdf.setTextColor(0, 0, 0);
      }
    }

    pdf.save(`${doc.title || 'Document'}.pdf`);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Failed to export PDF. Please try again.');
  }
};

export const exportToTxt = (doc: DocumentData) => {
  const editorElement = document.getElementById('editor-content');
  if (!editorElement) {
    alert('Editor content not found');
    return;
  }

  const text = editorElement.innerText || '';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `${doc.title || 'Document'}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};

export const exportToHtml = (doc: DocumentData) => {
  const config = doc.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal' };

  let width = PAGE_SIZES[config.size].width;
  let height = PAGE_SIZES[config.size].height;
  if(config.orientation === 'landscape') {
      [width, height] = [height, width];
  }

  const marginVal = PAGE_MARGINS[config.margins] || '2.54cm';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${doc.title || 'Document'}</title>
    <style>
        @page {
            size: ${width} ${height};
            margin: ${marginVal};
        }
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.15;
            max-width: ${width};
            margin: 0 auto;
            padding: ${marginVal};
        }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid black; padding: 5px; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${doc.content}
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `${doc.title || 'Document'}.html`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};

/**
 * Export all documents as a ZIP archive
 */
export const exportAllDocuments = async (documents: DocumentData[]) => {
  if (documents.length === 0) {
    alert('No documents to export');
    return;
  }

  try {
    const zip = new JSZip();
    const folder = zip.folder('penko-writer-documents');

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Add each document as JSON file
    documents.forEach((doc, index) => {
      const sanitizedTitle = doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${index + 1}_${sanitizedTitle}.json`;

      const docData = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        createdAt: doc.createdAt,
        lastModified: doc.lastModified,
        pageConfig: doc.pageConfig,
        language: doc.language,
        header: doc.header,
        footer: doc.footer,
        showPageNumbers: doc.showPageNumbers,
        pageNumberPosition: doc.pageNumberPosition,
        comments: doc.comments,
        trackChanges: doc.trackChanges,
        trackingEnabled: doc.trackingEnabled,
        currentUser: doc.currentUser,
      };

      folder.file(filename, JSON.stringify(docData, null, 2));
    });

    // Add metadata file
    const metadata = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      documentCount: documents.length,
      appName: 'Penko Writer',
    };
    folder.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Generate ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `penko-writer-backup-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    console.log(`[Export] Successfully exported ${documents.length} documents`);
  } catch (error) {
    console.error('[Export] Failed to export all documents:', error);
    alert('Failed to export documents. Please try again.');
  }
};

/**
 * Export document to Markdown (.md) format
 */
export const exportToMarkdown = (doc: DocumentData) => {
  try {
    // Convert HTML content to Markdown
    const markdown = htmlToMarkdown(doc.content);

    // Create a blob with the markdown content
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Create and trigger download
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${doc.title || 'Document'}.md`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    console.log('[Export] Successfully exported to Markdown');
  } catch (error) {
    console.error('[Export] Failed to export to Markdown:', error);
    alert('Failed to export to Markdown. Please try again.');
  }
};