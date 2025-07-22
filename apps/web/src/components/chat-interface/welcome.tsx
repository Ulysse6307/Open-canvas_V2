import { ProgrammingLanguageOptions } from "@opencanvas/shared/types";
import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { FC, useMemo, ChangeEvent } from "react";
import { NotebookPen, FileText } from "lucide-react";
import { Button } from "../ui/button";

const QUICK_START_PROMPTS_SEARCH = [
  "Write a market analysis of AI chip manufacturers in 2025",
  "Create a blog post about the latest climate change policies and their impact",
  "Draft an investor update on renewable energy trends this quarter",
  "Write a report on current cybersecurity threats in cloud computing",
  "Analyze the latest developments in quantum computing for a tech newsletter",
  "Create a summary of emerging medical breakthroughs in cancer treatment",
  "Write about the impact of current interest rates on the housing market",
  "Draft an article about breakthroughs in battery technology this year",
  "Analyze current supply chain disruptions in semiconductor manufacturing",
  "Write about how recent AI regulations affect business innovation",
];

const QUICK_START_PROMPTS = [
  "Write a bedtime story about a brave little robot",
  "Create a function to calculate Fibonacci numbers in TypeScript",
  "Draft a resignation letter for a position I've had for 2 years",
  "Build a simple weather dashboard using React and Tailwind",
  "Write a poem about artificial intelligence",
  "Create a basic Express.js REST API with two endpoints",
  "Draft a congratulatory speech for my sister's graduation",
  "Build a command-line calculator in Python",
  "Write instructions for making perfect scrambled eggs",
  "Create a simple snake game using HTML canvas",
  "Write me a TODO app in React",
  "Explain why the sky is blue in a short essay",
  "Help me draft an email to my professor Craig",
  "Write a web scraping program in Python",
];

function getRandomPrompts(prompts: string[], count: number = 4): string[] {
  return [...prompts].sort(() => Math.random() - 0.5).slice(0, count);
}

interface QuickStartButtonsProps {
  handleQuickStart: (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => void;
  handleFileImport: (file: File) => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

interface QuickStartPromptsProps {
  searchEnabled: boolean;
}

const QuickStartPrompts = ({ searchEnabled }: QuickStartPromptsProps) => {
  const threadRuntime = useThreadRuntime();

  const handleClick = (text: string) => {
    threadRuntime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  const selectedPrompts = useMemo(
    () =>
      getRandomPrompts(
        searchEnabled ? QUICK_START_PROMPTS_SEARCH : QUICK_START_PROMPTS
      ),
    [searchEnabled]
  );

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {selectedPrompts.map((prompt, index) => (
          <Button
            key={`quick-start-prompt-${index}`}
            onClick={() => handleClick(prompt)}
            variant="outline"
            className="min-h-[60px] w-full flex items-center justify-center p-6 whitespace-normal text-tamar-gray bg-white border border-input rounded-2xl shadow-sm transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.02] hover:bg-gradient-to-r hover:from-tamar-violet hover:to-[#A259FF] hover:text-white"
          >
            <p className="text-center break-words text-sm font-normal">
              {prompt}
            </p>
          </Button>
        ))}
      </div>
    </div>
  );
};

const QuickStartButtons = (props: QuickStartButtonsProps) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      props.handleFileImport(selectedFile);
    }
  };

  return (
    <div className="flex flex-col gap-8 items-center justify-center w-full">
      <div className="flex flex-col gap-6">
        <p className="text-tamar-gray text-sm">Start with a blank canvas</p>
        <div className="flex flex-row gap-4 items-center justify-center w-full">
          <Button
            onClick={() => props.handleQuickStart("text")}
            className="rounded-xl h-[64px] w-[250px] flex items-center justify-center gap-2 bg-gradient-to-r from-tamar-violet to-[#A259FF] text-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          >
            <NotebookPen className="w-5 h-5" />
            New Markdown
          </Button>
          <label className="rounded-xl h-[64px] w-[250px] flex items-center justify-center gap-2 bg-gradient-to-r from-tamar-violet to-[#A259FF] text-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
              accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.xml,.csv,.doc,.docx"
            />
            <FileText className="w-5 h-5" />
            Edit document
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-6 mt-2 w-full">
        <p className="text-tamar-gray text-sm">or with a message</p>
        {props.composer}
        <QuickStartPrompts searchEnabled={props.searchEnabled} />
      </div>
    </div>
  );
};

interface ThreadWelcomeProps {
  handleQuickStart: (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => void;
  handleFileImport: (file: File) => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

export const ThreadWelcome: FC<ThreadWelcomeProps> = (
  props: ThreadWelcomeProps
) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height))] bg-white">
        <div className="text-center max-w-3xl w-full py-12 px-4">
          {/* Titre premium avec Tamar.ai mis en valeur */}
          <h1 className="mt-6 text-3xl font-bold">
         
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-tamar-violet to-[#A259FF]">Tamar.ai</span>
          </h1>
          <p className="mt-2 text-tamar-gray text-sm">
            Commencez un nouveau document ou choisissez une suggestion.
          </p>
          <div className="mt-8 w-full">
            <QuickStartButtons
              composer={props.composer}
              handleQuickStart={props.handleQuickStart}
              handleFileImport={props.handleFileImport}
              searchEnabled={props.searchEnabled}
            />
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};
