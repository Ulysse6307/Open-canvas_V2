import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { ArtifactMarkdownV3 } from "@opencanvas/shared/types";
import "@blocknote/core/fonts/inter.css";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { isArtifactMarkdownContent } from "@opencanvas/shared/utils/artifacts";
import { CopyText } from "./components/CopyText";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { useGraphContext } from "@/contexts/GraphContext";
import React from "react";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import styles from "./TextRenderer.module.css";

const cleanText = (text: string) => {
  return text
    .replaceAll("\\\n", "\n")
    // Fix list formatting issues that can confuse BlockNote
    .replace(/^\s*\*\s{2,}/gm, '* ')  // Fix asterisk lists with multiple spaces
    .replace(/^\s*-\s{2,}/gm, '- ')   // Fix dash lists with multiple spaces
    .replace(/^\s*\*\s+/gm, '* ')     // Normalize asterisk lists
    .replace(/^\s*-\s+/gm, '- ')      // Normalize dash lists
    .replace(/^\s*(\d+)\.\s{2,}/gm, '$1. ') // Fix numbered lists with multiple spaces
    .replace(/^\s*(\d+)\.\s+/gm, '$1. ')    // Normalize numbered lists
    .replace(/\n\s*\n\s*\*/gm, '\n\n*') // Fix spacing before list items
    .replace(/\n\s*\n\s*-/gm, '\n\n-') // Fix spacing before dash list items
    .replace(/\n\s*\n\s*(\d+)\./gm, '\n\n$1.'); // Fix spacing before numbered list items
};

// Function to flatten nested bulletListItem and numberedListItem structures
const flattenListBlocks = (blocks: any[]): any[] => {
  const flattenedBlocks: any[] = [];
  const UNUSED_numberedListCounter = 1;
  
  for (const block of blocks) {
    if (block.type === 'bulletListItem' || block.type === 'numberedListItem') {
      // Add the current list item
      flattenedBlocks.push({
        ...block,
        children: [] // Remove nested children
      });
      
      // Recursively flatten any nested list items in children
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          if (child.type === 'bulletListItem' || child.type === 'numberedListItem') {
            // Add nested list items as top-level items
            flattenedBlocks.push(...flattenListBlocks([child]));
          } else if (child.type === 'paragraph' && child.content) {
            // Convert paragraph content to a new list item
            flattenedBlocks.push({
              id: `flattened-${Date.now()}-${Math.random()}`,
              type: block.type, // Keep the same list type as parent
              props: {
                textColor: 'default',
                backgroundColor: 'default',
                textAlignment: 'left'
              },
              content: child.content,
              children: []
            });
          }
        }
      }
    } else {
      // For non-list items, keep as is but recursively process children
      flattenedBlocks.push({
        ...block,
        children: block.children ? flattenListBlocks(block.children) : []
      });
    }
  }
  
  return flattenedBlocks;
};

function ViewRawText({
  isRawView,
  setIsRawView,
}: {
  isRawView: boolean;
  setIsRawView: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <TooltipIconButton
        tooltip={`View ${isRawView ? "rendered" : "raw"} markdown`}
        variant="ghost"
        className="hover:bg-transparent"
        delayDuration={400}
        onClick={() => setIsRawView((p) => !p)}
      >
        {isRawView ? (
          <EyeOff className="w-5 h-5 text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
        ) : (
          <Eye className="w-5 h-5 text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
        )}
      </TooltipIconButton>
    </motion.div>
  );
}


export interface TextRendererProps {
  isEditing: boolean;
  isHovering: boolean;
  isInputVisible: boolean;
}

export function TextRendererComponent(props: TextRendererProps) {
  const editor = useCreateBlockNote({
    // Default configuration without includeKeyboardShortcuts
  });
  const { graphData } = useGraphContext();
  const {
    artifact,
    isStreaming,
    updateRenderedArtifactRequired,
    firstTokenReceived,
    setArtifact,
    setSelectedBlocks,
    setUpdateRenderedArtifactRequired,
  } = graphData;

  const [rawMarkdown, setRawMarkdown] = useState("");
  const [isRawView, setIsRawView] = useState(false);
  const [manuallyUpdatingArtifact, setManuallyUpdatingArtifact] =
    useState(false);

  useEffect(() => {
    const selectedText = editor.getSelectedText();
    const selection = editor.getSelection();

    if (selectedText && selection) {
      // Validate that selectedText is not empty or just whitespace
      const cleanedSelectedText = cleanText(selectedText);
      if (!cleanedSelectedText.trim()) {
        return;
      }

      if (!artifact) {
        console.error("Artifact not found");
        return;
      }

      const currentBlockIdx = artifact.currentIndex;
      const currentContent = artifact.contents.find(
        (c) => c.index === currentBlockIdx
      );
      if (!currentContent) {
        console.error("Current content not found");
        return;
      }
      if (!isArtifactMarkdownContent(currentContent)) {
        console.error("Current content is not markdown");
        return;
      }

      (async () => {
        const [markdownBlock, fullMarkdown] = await Promise.all([
          editor.blocksToMarkdownLossy(selection.blocks),
          editor.blocksToMarkdownLossy(editor.document),
        ]);
        setSelectedBlocks({
          fullMarkdown: cleanText(fullMarkdown),
          markdownBlock: cleanText(markdownBlock),
          selectedText: cleanedSelectedText,
        });
      })();
    }
  }, [editor.getSelectedText()]);

  useEffect(() => {
    if (!props.isInputVisible) {
      setSelectedBlocks(undefined);
    }
  }, [props.isInputVisible]);

  // Add minimal paste handler to prevent BlockNote paste errors while preserving formatting
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Only handle paste if it's within our BlockNote editor
      if (!target.closest('.bn-editor') && !target.closest('[data-testid="blocknote-editor"]')) {
        return; // Let browser handle normally
      }
      
      e.preventDefault();
      
      // Get clipboard data
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;
      
      const plainData = clipboardData.getData('text/plain');
      if (plainData) {
        // Clean markdown formatting from pasted text to prevent formatting inheritance
        let cleanText = plainData;
        
        // Remove markdown bold/italic markers
        cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold** -> bold
        cleanText = cleanText.replace(/\*(.*?)\*/g, '$1');     // *italic* -> italic
        
        // Simple text insertion using execCommand (works reliably)
        document.execCommand('insertText', false, cleanText);
      }
    };

    // Add paste listener
    document.addEventListener('paste', handlePaste, true);
    
    return () => {
      document.removeEventListener('paste', handlePaste, true);
    };
  }, []);



  useEffect(() => {
    if (!artifact) {
      return;
    }
    if (
      !isStreaming &&
      !manuallyUpdatingArtifact &&
      !updateRenderedArtifactRequired
    ) {
      return;
    }

    try {

      const currentIndex = artifact.currentIndex;
      const currentContent = artifact.contents.find(
        (c) => c.index === currentIndex && c.type === "text"
      ) as ArtifactMarkdownV3 | undefined;
      if (!currentContent) return;

      // Blocks are not found in the artifact, so once streaming is done we should update the artifact state with the blocks
      (async () => {
        const cleanedMarkdown = cleanText(currentContent.fullMarkdown);
        const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(
          cleanedMarkdown
        );
        
        // Flatten nested list structures
        const flattenedBlocks = flattenListBlocks(markdownAsBlocks);  

        editor.replaceBlocks(editor.document, flattenedBlocks);
        setUpdateRenderedArtifactRequired(false);
        setManuallyUpdatingArtifact(false);
      })();
    } finally {
      setManuallyUpdatingArtifact(false);
      setUpdateRenderedArtifactRequired(false);
    }
  }, [artifact, updateRenderedArtifactRequired]);

  useEffect(() => {
    if (isRawView) {
      editor.blocksToMarkdownLossy(editor.document).then(setRawMarkdown);
    } else if (!isRawView && rawMarkdown) {
      try {
        (async () => {
          setManuallyUpdatingArtifact(true);
          const markdownAsBlocks =
            await editor.tryParseMarkdownToBlocks(cleanText(rawMarkdown));
          editor.replaceBlocks(editor.document, markdownAsBlocks);
          setManuallyUpdatingArtifact(false);
        })();
      } catch (_) {
        setManuallyUpdatingArtifact(false);
      }
    }
  }, [isRawView, editor]);

  const isComposition = useRef(false);

  const onChange = async () => {
    if (
      isStreaming ||
      manuallyUpdatingArtifact ||
      updateRenderedArtifactRequired
    )
      return;

    const fullMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    setArtifact((prev) => {
      if (!prev) {
        return {
          currentIndex: 1,
          contents: [
            {
              index: 1,
              fullMarkdown: fullMarkdown,
              title: artifact?.contents?.find(c => c.index === artifact.currentIndex)?.title || "Untitled",
              type: "text",
            },
          ],
        };
      } else {
        return {
          ...prev,
          contents: prev.contents.map((c) => {
            if (c.index === prev.currentIndex) {
              return {
                ...c,
                fullMarkdown: fullMarkdown,
              };
            }
            return c;
          }),
        };
      }
    });
  };

  const onChangeRawMarkdown = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newRawMarkdown = e.target.value;
    setRawMarkdown(newRawMarkdown);
    setArtifact((prev) => {
      if (!prev) {
        return {
          currentIndex: 1,
          contents: [
            {
              index: 1,
              fullMarkdown: newRawMarkdown,
              title: artifact?.contents?.find(c => c.index === artifact.currentIndex)?.title || "Untitled",
              type: "text",
            },
          ],
        };
      } else {
        return {
          ...prev,
          contents: prev.contents.map((c) => {
            if (c.index === prev.currentIndex) {
              return {
                ...c,
                fullMarkdown: newRawMarkdown,
              };
            }
            return c;
          }),
        };
      }
    });
  };

  return (
    <div className={cn("w-full h-full mt-2 flex flex-col border-t-[1px] border-gray-200 overflow-y-auto py-5 relative", styles.lightModeOnly)}>
      {props.isHovering && artifact && (
        <div className="absolute flex gap-2 top-2 right-4 z-10">
          <CopyText currentArtifactContent={getArtifactContent(artifact)} />
          <ViewRawText isRawView={isRawView} setIsRawView={setIsRawView} />
        </div>
      )}
      {isRawView ? (
        <Textarea
          className="whitespace-pre-wrap font-mono text-sm px-[54px] border-0 shadow-none h-full outline-none ring-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={rawMarkdown}
          onChange={onChangeRawMarkdown}
        />
      ) : (
        <>
          <style jsx global>{`
            .pulse-text .bn-block-group {
              animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.3;
              }
            }

          `}</style>
          <BlockNoteView
            theme="light"
            formattingToolbar={props.isEditing}
            slashMenu={false}
            onCompositionStartCapture={() => (isComposition.current = true)}
            onCompositionEndCapture={() => (isComposition.current = false)}
            onChange={onChange}
            editable={true}
            editor={editor}
            className={cn(
              isStreaming && !firstTokenReceived ? "pulse-text" : "",
              "custom-blocknote-theme"
            )}
          >
            <SuggestionMenuController
              getItems={async () =>
                getDefaultReactSlashMenuItems(editor).filter(
                  (z) => z.group !== "Media"
                )
              }
              triggerCharacter={"/"}
            />
          </BlockNoteView>
        </>
      )}
    </div>
  );
}

export const TextRenderer = React.memo(TextRendererComponent);
