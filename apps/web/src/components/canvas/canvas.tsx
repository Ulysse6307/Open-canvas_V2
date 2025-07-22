"use client";

import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { WebSearchResults } from "@/components/web-search-results";
import {
  ALL_MODEL_NAMES,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODEL_NAME,
} from "@opencanvas/shared/models";
import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { getLanguageTemplate } from "@/lib/get_language_template";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ArtifactV3,
  CustomModelConfig,
  ProgrammingLanguageOptions,
} from "@opencanvas/shared/types";
import React, { useEffect, useRef, useState } from "react";
import { ContentComposerChatInterface } from "./content-composer";
import NoSSRWrapper from "../NoSSRWrapper";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { arrayToFileList, convertDocuments } from "@/lib/attachments";
import { useThreadContext } from "@/contexts/ThreadProvider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CHAT_COLLAPSED_QUERY_PARAM } from "@/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserContext } from "@/contexts/UserContext";


export function CanvasComponent() {
  const { graphData } = useGraphContext();
  const { setModelName, setModelConfig } = useThreadContext();
  const { setArtifact, chatStarted, setChatStarted, setUpdateRenderedArtifactRequired, streamMessage } = graphData;
  const { toast } = useToast();
  const userData = useUserContext();
  const [isEditing, setIsEditing] = useState(false);
  const [webSearchResultsOpen, setWebSearchResultsOpen] = useState(false);
  const [pendingWelcomeMessage, setPendingWelcomeMessage] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Effect to send welcome message when artifact is ready
  useEffect(() => {
    if (pendingWelcomeMessage && 
        chatStarted && 
        graphData.artifact && 
        !graphData.updateRenderedArtifactRequired && 
        !graphData.isStreaming) {
      
      const sendWelcomeMessage = async () => {
        try {
          console.log("Artifact is ready, sending welcome message:", pendingWelcomeMessage);
          await streamMessage({
            messages: [
              {
                type: "human",
                content: pendingWelcomeMessage,
              }
            ],
          });
          setPendingWelcomeMessage(null); // Clear the pending message
        } catch (error) {
          console.error("Failed to send welcome message:", error);
          setPendingWelcomeMessage(null); // Clear even on error to avoid infinite retries
        }
      };

      // Small delay to ensure everything is completely ready
      const timer = setTimeout(sendWelcomeMessage, 500);
      return () => clearTimeout(timer);
    }
  }, [pendingWelcomeMessage, chatStarted, graphData.artifact, graphData.updateRenderedArtifactRequired, graphData.isStreaming, streamMessage]);

  // Initialize FFmpeg only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ffmpegRef.current = new FFmpeg();
    }
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const chatCollapsedSearchParam = searchParams.get(CHAT_COLLAPSED_QUERY_PARAM);
  useEffect(() => {
    try {
      if (chatCollapsedSearchParam) {
        setChatCollapsed(JSON.parse(chatCollapsedSearchParam));
      }
    } catch (e) {
      setChatCollapsed(false);
      const queryParams = new URLSearchParams(searchParams.toString());
      queryParams.delete(CHAT_COLLAPSED_QUERY_PARAM);
      router.replace(`?${queryParams.toString()}`, { scroll: false });
    }
  }, [chatCollapsedSearchParam]);

  const handleQuickStart = (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => {
    if (type === "code" && !language) {
      toast({
        title: "Language not selected",
        description: "Please select a language to continue",
        duration: 5000,
      });
      return;
    }
    setChatStarted(true);

    let artifactContent: ArtifactCodeV3 | ArtifactMarkdownV3;
    if (type === "code" && language) {
      artifactContent = {
        index: 1,
        type: "code",
        title: `Quick start ${type}`,
        code: getLanguageTemplate(language),
        language,
      };
    } else {
      artifactContent = {
        index: 1,
        type: "text",
        title: `Quick start ${type}`,
        fullMarkdown: "",
      };
    }

    const newArtifact: ArtifactV3 = {
      currentIndex: 1,
      contents: [artifactContent],
    };
    // Do not worry about existing items in state. This should
    // never occur since this action can only be invoked if
    // there are no messages/artifacts in the thread.
    setArtifact(newArtifact);
    setIsEditing(true);
  };

  const handleFileImport = async (file: File) => {
    if (!userData.user) {
      toast({
        title: "User not found",
        description: "Please log in to import files",
        duration: 5000,
        variant: "destructive",
      });
      return;
    }

    // No need to create thread manually - streamMessage() will handle it automatically

    // Extract filename without extension for the welcome message
    const fileName = file.name;
    const fileNameWithoutExt = fileName.lastIndexOf('.') > 0 
      ? fileName.substring(0, fileName.lastIndexOf('.'))
      : fileName;

    try {
      let content: string;
      
      // Handle text-based files directly
      if (file.type === "text/plain" || 
          file.type === "text/markdown" ||
          file.name.endsWith(".md") ||
          file.name.endsWith(".txt") ||
          file.name.endsWith(".js") ||
          file.name.endsWith(".ts") ||
          file.name.endsWith(".tsx") ||
          file.name.endsWith(".jsx") ||
          file.name.endsWith(".html") ||
          file.name.endsWith(".css") ||
          file.name.endsWith(".json") ||
          file.name.endsWith(".xml") ||
          file.name.endsWith(".csv")) {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Handle DOCX files with Mammoth.js + Turndown
        try {
          // Dynamic imports to avoid bundle size impact
          const [mammothModule, turndownModule] = await Promise.all([
            import("mammoth"),
            import("turndown")
          ]);
          
          const mammoth = mammothModule.default || mammothModule;
          const TurndownService = turndownModule.default;

          // Read file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // Convert Word to HTML using Mammoth
          const { value: html } = await mammoth.convertToHtml({
            arrayBuffer,
          });

          // Convert HTML to Markdown using Turndown
          const turndown = new TurndownService({
            headingStyle: "atx",
            codeBlockStyle: "fenced",
            bulletListMarker: "-",
          });
          content = turndown.turndown(html);

        } catch (err) {
          console.error("DOCX conversion error:", err);
          throw new Error(`Failed to convert DOCX file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        // For complex documents (.pdf, etc.), use the existing conversion system
        const fileList = arrayToFileList([file]);
        if (!fileList) {
          throw new Error("Failed to create file list");
        }

        const documents = await convertDocuments({
          ffmpeg: ffmpegRef.current!,
          messageRef,
          documents: fileList,
          userId: userData.user.id,
          toast,
        });

        if (documents.length === 0) {
          throw new Error("No documents were processed");
        }

        const document = documents[0];
        
        if (document.data.startsWith("data:") && document.data.includes("base64")) {
          content = `# ${file.name}

This document type (.${file.name.split('.').pop()}) requires special processing to extract text content. 

The document has been received but the text extraction feature for this file type is not yet fully implemented. 

You can:
1. Try copying the text content from the original document
2. Convert the document to a plain text file (.txt) or markdown (.md) format
3. Ask questions about the document, and I'll help you work with it

Document details:
- Filename: ${file.name}
- Type: ${file.type || 'Unknown'}
- Size: ${(file.size / 1024).toFixed(1)} KB`;
        } else {
          content = document.data;
        }
      }

      const newArtifact: ArtifactV3 = {
        currentIndex: 1,
        contents: [
          {
            index: 1,
            type: "text",
            title: file.name.endsWith(".docx") ? file.name.replace(/\.docx$/i, "") : file.name,
            fullMarkdown: content,
          },
        ],
      };


      setArtifact(newArtifact);
      setUpdateRenderedArtifactRequired(true);
      setIsEditing(false);
      setChatStarted(true);

      // Store the welcome message to trigger thread save
      const welcomeMessage = `Le document "${fileNameWithoutExt}" a été importé. Réponds seulement par un message de bienvenue sans générer d'artifact.`;
      setPendingWelcomeMessage(welcomeMessage);

      // Reset updateRenderedArtifactRequired after a short delay to allow rendering
      setTimeout(() => {
        setUpdateRenderedArtifactRequired(false);
      }, 200);

      toast({
        title: "File imported successfully",
        description: file.name.endsWith(".docx") ? `${file.name} has been converted to Markdown` : `${file.name} has been loaded as a new artifact`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: "File import failed",
        description: error instanceof Error ? error.message : "There was an error processing the file",
        duration: 5000,
        variant: "destructive",
      });
    }
    setChatStarted(true);
  };




  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen">
      {!chatStarted && (
        <NoSSRWrapper>
          <ContentComposerChatInterface
            chatCollapsed={chatCollapsed}
            setChatCollapsed={(c) => {
              setChatCollapsed(c);
              const queryParams = new URLSearchParams(searchParams.toString());
              queryParams.set(CHAT_COLLAPSED_QUERY_PARAM, JSON.stringify(c));
              router.replace(`?${queryParams.toString()}`, { scroll: false });
            }}
            switchSelectedThreadCallback={(thread) => {
              // Chat should only be "started" if there are messages present
              if ((thread.values as Record<string, any>)?.messages?.length) {
                setChatStarted(true);
                if (thread?.metadata?.customModelName) {
                  setModelName(
                    thread.metadata.customModelName as ALL_MODEL_NAMES
                  );
                } else {
                  setModelName(DEFAULT_MODEL_NAME);
                }

                if (thread?.metadata?.modelConfig) {
                  setModelConfig(
                    (thread?.metadata?.customModelName ??
                      DEFAULT_MODEL_NAME) as ALL_MODEL_NAMES,
                    (thread.metadata?.modelConfig ??
                      DEFAULT_MODEL_CONFIG) as CustomModelConfig
                  );
                } else {
                  setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
                }
              } else {
                setChatStarted(false);
              }
            }}
            setChatStarted={setChatStarted}
            hasChatStarted={chatStarted}
            handleQuickStart={handleQuickStart}
            handleFileImport={handleFileImport}
          />
        </NoSSRWrapper>
      )}
      {!chatCollapsed && chatStarted && (
        <ResizablePanel
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="transition-all duration-700 h-screen mr-auto bg-gray-50/70 shadow-inner-right"
          id="chat-panel-main"
          order={1}
        >
          <NoSSRWrapper>
            <ContentComposerChatInterface
              chatCollapsed={chatCollapsed}
              setChatCollapsed={(c) => {
                setChatCollapsed(c);
                const queryParams = new URLSearchParams(
                  searchParams.toString()
                );
                queryParams.set(CHAT_COLLAPSED_QUERY_PARAM, JSON.stringify(c));
                router.replace(`?${queryParams.toString()}`, { scroll: false });
              }}
              switchSelectedThreadCallback={(thread) => {
                // Chat should only be "started" if there are messages present
                if ((thread.values as Record<string, any>)?.messages?.length) {
                  setChatStarted(true);
                  if (thread?.metadata?.customModelName) {
                    setModelName(
                      thread.metadata.customModelName as ALL_MODEL_NAMES
                    );
                  } else {
                    setModelName(DEFAULT_MODEL_NAME);
                  }

                  if (thread?.metadata?.modelConfig) {
                    setModelConfig(
                      (thread?.metadata.customModelName ??
                        DEFAULT_MODEL_NAME) as ALL_MODEL_NAMES,
                      (thread.metadata.modelConfig ??
                        DEFAULT_MODEL_CONFIG) as CustomModelConfig
                    );
                  } else {
                    setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
                  }
                } else {
                  setChatStarted(false);
                }
              }}
              setChatStarted={setChatStarted}
              hasChatStarted={chatStarted}
              handleQuickStart={handleQuickStart}
              handleFileImport={handleFileImport}
            />
          </NoSSRWrapper>
        </ResizablePanel>
      )}

      {chatStarted && (
        <>
          <ResizableHandle />
          <ResizablePanel
            defaultSize={chatCollapsed ? 100 : 75}
            maxSize={85}
            minSize={50}
            id="canvas-panel"
            order={2}
            className="flex flex-row w-full"
          >
            <div className="w-full ml-auto">
              <ArtifactRenderer
                chatCollapsed={chatCollapsed}
                setChatCollapsed={(c) => {
                  setChatCollapsed(c);
                  const queryParams = new URLSearchParams(
                    searchParams.toString()
                  );
                  queryParams.set(
                    CHAT_COLLAPSED_QUERY_PARAM,
                    JSON.stringify(c)
                  );
                  router.replace(`?${queryParams.toString()}`, {
                    scroll: false,
                  });
                }}
                setIsEditing={setIsEditing}
                isEditing={isEditing}
              />
            </div>
            <WebSearchResults
              open={webSearchResultsOpen}
              setOpen={setWebSearchResultsOpen}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

export const Canvas = React.memo(CanvasComponent);
