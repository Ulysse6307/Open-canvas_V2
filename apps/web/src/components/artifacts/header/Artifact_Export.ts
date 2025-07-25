
import { saveAs } from "file-saver";
import { marked } from "marked";
import { Document, Paragraph, TextRun, SectionType, Packer, HeadingLevel, AlignmentType } from "docx";
import { ArtifactCodeV3, ArtifactMarkdownV3 } from "@opencanvas/shared/types";

/**
 * Parses a Markdown string into TextRun[] with support for **bold**, *italic*, links, and code.
 * Simplified: supports bold, italic, and code. For full HTML-style conversion (links, images), consider markdown-it.
 */
function parseMarkdownInlinesToTextRuns(text: string, defaultColor: string = "#000000", defaultFont: string = "Cambria", bold2 : boolean = false): TextRun[] {
  // Normalize line breaks to avoid issues
  text = text.replace(/\\n/g, "\n");

  // Pattern for **bold**, *italic*, `code` (simplified, does not handle nesting)
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[[^\]]+\]\([^)]+\))/g;
  let currentIndex = 0;
  const runs: TextRun[] = [];
  let match;

  while ((match = re.exec(text)) !== null) {
    // Add plain text before the style
    if (match.index > currentIndex) {
      runs.push(new TextRun({ text: text.substring(currentIndex, match.index), color: defaultColor, font: defaultFont, bold : bold2 }));
    }
    // Add styled run
    const [_full, _bold, boldContent, _italic, italicContent, _code, codeContent, linkBlock] = match;
    if (boldContent) {
      runs.push(new TextRun({ text: boldContent, bold: true, color: defaultColor, font: defaultFont }));
    } else if (italicContent) {
      runs.push(new TextRun({ text: italicContent, italics: true, color: defaultColor, font: defaultFont }));
    } else if (codeContent) {
      runs.push(new TextRun({ text: codeContent, font: "Consolas", color: defaultColor }));
    } else if (linkBlock) {
      // Handle links as text (Word does not support interactive links, but you could extract the label)
      const label = linkBlock.match(/\[([^\]]+)\]/)?.[1] || "";
      runs.push(new TextRun({ text: label, color: defaultColor, underline: { type: "single" }, font: defaultFont }));
    }
    currentIndex = re.lastIndex;
  }
  // Add remaining plain text
  if (currentIndex < text.length) {
    runs.push(new TextRun({ text: text.substring(currentIndex), color: defaultColor, font: defaultFont, bold : bold2 }));
  }
  return runs;
}

function getHeadingLevelMap(): Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> {
  return {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
}

function getFileExtension(language?: string): string {
  if (!language) return "txt";
  const extensionMap: Record<string, string> = {
    javascript: "js", typescript: "ts", python: "py", java: "java", cpp: "cpp",
    c: "c", csharp: "cs", php: "php", ruby: "rb", go: "go", rust: "rs",
    html: "html", css: "css", sql: "sql", json: "json", xml: "xml", yaml: "yaml",
    markdown: "md",
  };
  return extensionMap[language.toLowerCase()] ?? "txt";
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'untitled';
}

// Export markdown content to DOCX, preserving basic formatting
export async function exportMarkdownToDocx(
  markdown: string,
  title: string
): Promise<void> {
  if (!markdown || !title) throw new Error("Missing markdown content or title");

  try {
    const tokens = marked.lexer(markdown);
    const children: Paragraph[] = [];

    // No title at the top - directly start with content

    // Process tokens
    for (const token of tokens) {
      switch (token.type) {
        case "heading":
          const headingLevel = Math.min(token.depth, 6) as 1 | 2 | 3 | 4 | 5 | 6;
          children.push(new Paragraph({
            children: [...parseMarkdownInlinesToTextRuns(token.text, "#000000", "Cambria", true)],
            heading: getHeadingLevelMap()[headingLevel],
            spacing: {
                before: 200,
                after: 150, // 400 twips = 1 cm ~= 28 pt
            },
          }));
          break;
        case "paragraph":
          children.push(new Paragraph({
            children: [...parseMarkdownInlinesToTextRuns(token.text, "#000000", "Cambria")],
            spacing: {
                before: 200,
                after: 150, // 400 twips = 1 cm ~= 28 pt
            },
          }));
          break;
        case "code":
          children.push(new Paragraph({
            children: [new TextRun({ text: token.text, font: "Consolas" })],
          }));
          break;
        case "list":
          if (token.items) {
            token.items.forEach((item: any, index: number) => {
              // Determine list level for nested lists (if item has nested content)
              const level = item.depth ? Math.min(item.depth - 1, 8) : 0;
              
              // Calculate indentation based on level
              // 0.07cm = 40 twips (retrait de la puce), 0.71cm = 403 twips (retrait du texte)
              const baseIndent = 40; // 0.07 cm
              const textIndent = 403; // 0.71 cm  
              const leftIndent = baseIndent + (level * textIndent); // Increment by text indent for each level
              const hangingIndent = textIndent - baseIndent; // 403 - 40 = 363 twips
              
              children.push(new Paragraph({
                children: [
                  ...parseMarkdownInlinesToTextRuns(item.text, "#000000", "Cambria"),
                ],
                numbering: {
                  reference: token.ordered ? "numbered-list" : "bullet-list",
                  level: level,
                },
                indent: { 
                  left: leftIndent, 
                  hanging: hangingIndent 
                },
                spacing: {
                  before: 100,
                  after: 100,
                },
              }));
            });
          }
          break;
        case "space":
          // Skip empty lines (or handle them if you want extra spacer paragraphs)
          break;
        default:
          if ('text' in token && token.text) {
            children.push(new Paragraph({
              children: [...parseMarkdownInlinesToTextRuns(token.text, "#000000", "Cambria")],
            }));
          }
          break;
      }
    }

    // Final document structure with numbering definitions
    const doc = new Document({
      title,
      description: "Document generated from OpenCanvas",
      numbering: {
        config: [
          {
            reference: "bullet-list",
            levels: [
              {
                level: 0,
                format: "bullet",
                text: "●",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 403, hanging: 363 }, // 0.71cm left, 0.64cm hanging
                  },
                },
              },
              {
                level: 1,
                format: "bullet",
                text: "○",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 806, hanging: 363 }, // Level 1: 403 * 2
                  },
                },
              },
              {
                level: 2,
                format: "bullet",
                text: "■",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 1209, hanging: 363 }, // Level 2: 403 * 3
                  },
                },
              },
            ],
          },
          {
            reference: "numbered-list",
            levels: [
              {
                level: 0,
                format: "decimal",
                text: "%1.",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 403, hanging: 363 }, // 0.71cm left, 0.64cm hanging
                  },
                },
              },
              {
                level: 1,
                format: "lowerLetter",
                text: "%2.",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 806, hanging: 363 }, // Level 1: 403 * 2
                  },
                },
              },
              {
                level: 2,
                format: "lowerRoman",
                text: "%3.",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 1209, hanging: 363 }, // Level 2: 403 * 3
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [{ properties: { type: SectionType.CONTINUOUS }, children }],
    });

    // Download
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${sanitizeFilename(title)}.docx`);
  } catch (err) {
    console.error("Failed to export markdown to DOCX:", err);
    throw err;
  }
}

// Export code content as plain text
export async function exportCodeToText(
  code: string,
  title: string,
  language?: string
): Promise<void> {
  if (!code || !title) throw new Error("Missing code content or title");
  try {
    const extension = getFileExtension(language);
    saveAs(new Blob([code], { type: "text/plain" }), `${sanitizeFilename(title)}.${extension}`);
  } catch (err) {
    console.error("Failed to export code to text:", err);
    throw err;
  }
}

// Universal export: handles both markdown and code artifacts
export async function exportArtifact(
  artifact: ArtifactCodeV3 | ArtifactMarkdownV3,
  title: string
): Promise<void> {
  if (!artifact || !title) throw new Error("Missing artifact or title");
  try {
    if (artifact.type === "text" && "fullMarkdown" in artifact) {
      await exportMarkdownToDocx(artifact.fullMarkdown, title);
    } else if (artifact.type === "code" && "code" in artifact) {
      await exportCodeToText(artifact.code, title, artifact.language);
    } else {
      throw new Error("Unsupported artifact type for export");
    }
  } catch (err) {
    console.error("Failed to export artifact:", err);
    throw err;
  }
}
