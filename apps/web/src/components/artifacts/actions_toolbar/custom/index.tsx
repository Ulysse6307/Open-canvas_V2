import {
  CirclePlus,
  WandSparkles,
  Trash2,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomQuickAction } from "@opencanvas/shared/types";
import { NewCustomQuickActionDialog } from "./NewCustomQuickActionDialog";
import { useEffect, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TighterText } from "@/components/ui/header";
import { GraphInput } from "@opencanvas/shared/types";
import { User } from "@supabase/supabase-js";

export interface CustomQuickActionsProps {
  isTextSelected: boolean;
  assistantId: string | undefined;
  user: User | undefined;
  streamMessage: (params: GraphInput) => Promise<void>;
}

const DropdownMenuItemWithDelete = ({
  disabled,
  title,
  onDelete,
  onEdit,
  onClick,
}: {
  disabled: boolean;
  title: string;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onClick: () => Promise<void>;
}) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className="flex flex-row gap-0 items-center justify-between w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <DropdownMenuItem
        disabled={disabled}
        onSelect={onClick}
        className="w-full truncate text-tamar-gray hover:bg-tamar-light/10"
      >
        {title}
      </DropdownMenuItem>
      <TooltipIconButton
        disabled={disabled}
        tooltip="Edit action"
        variant="ghost"
        onClick={onEdit}
        className={cn("ml-1 hover:bg-transparent", isHovering ? "visible" : "invisible")}
      >
        <Pencil className="w-4 h-4 text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
      </TooltipIconButton>
      <TooltipIconButton
        disabled={disabled}
        tooltip="Delete action"
        variant="ghost"
        onClick={onDelete}
        className={cn("hover:bg-transparent", isHovering ? "visible" : "invisible")}
      >
        <Trash2 className="w-4 h-4 text-tamar-gray hover:text-red-500 transition-colors duration-200" />
      </TooltipIconButton>
    </div>
  );
};

export function CustomQuickActions(props: CustomQuickActionsProps) {
  const { user, assistantId, streamMessage } = props;
  const {
    getCustomQuickActions,
    deleteCustomQuickAction,
    isLoadingQuickActions,
  } = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string>();
  const [customQuickActions, setCustomQuickActions] =
    useState<CustomQuickAction[]>();

  const openEditDialog = (id: string) => {
    setIsEditing(true);
    setDialogOpen(true);
    setIsEditingId(id);
  };

  const getAndSetCustomQuickActions = async (userId: string) => {
    const actions = await getCustomQuickActions(userId);
    setCustomQuickActions(actions);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !assistantId || !user) return;
    getAndSetCustomQuickActions(user.id);
  }, [assistantId, user]);

  const handleNewActionClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(false);
    setIsEditingId(undefined);
    setDialogOpen(true);
  };

  const handleQuickActionClick = async (id: string): Promise<void> => {
    setOpen(false);
    setIsEditing(false);
    setIsEditingId(undefined);
    await streamMessage({
      customQuickActionId: id,
    });
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      toast({
        title: "Failed to delete",
        description: "User not found",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    try {
      const deletionSuccess = await deleteCustomQuickAction(
        id,
        customQuickActions || [],
        user.id
      );
      if (deletionSuccess) {
        toast({
          title: "Custom quick action deleted successfully",
        });
        setCustomQuickActions((actions) => {
          if (!actions) return actions;
          return actions.filter((action) => action.id !== id);
        });
      } else {
        toast({
          title: "Failed to delete custom quick action",
          variant: "destructive",
        });
      }
    } catch (_) {
      toast({
        title: "Failed to delete custom quick action",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        if (props.isTextSelected) return;
        setOpen(o);
      }}
    >
      <DropdownMenuTrigger className="fixed bottom-4 right-20" asChild>
        <TooltipIconButton
          tooltip={
            props.isTextSelected
              ? "Quick actions disabled while text is selected"
              : "Custom quick actions"
          }
          variant="ghost"
          className={cn(
            "w-[48px] h-[48px] p-0 rounded-full bg-white border border-tamar-gray/10 shadow-sm hover:bg-transparent focus:bg-transparent",
            props.isTextSelected
              ? "cursor-default opacity-50 text-tamar-gray"
              : "cursor-pointer"
          )}
          delayDuration={400}
        >
          <WandSparkles
            className={cn(
              "w-[26px] h-[26px]",
              props.isTextSelected
                ? "text-tamar-gray"
                : "text-tamar-gray hover:text-tamar-violet transition-colors duration-200"
            )}
          />
        </TooltipIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[600px] max-w-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 bg-white border border-tamar-gray/10 shadow-sm">
        <DropdownMenuLabel>
          <TighterText className="text-tamar-blue">Custom Quick Actions</TighterText>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="border-t border-tamar-gray/10" />
        {isLoadingQuickActions && !customQuickActions?.length ? (
          <span className="text-sm text-tamar-gray flex items-center justify-start gap-1 p-2">
            Loading
            <LoaderCircle className="w-4 h-4 animate-spin text-tamar-gray" />
          </span>
        ) : !customQuickActions?.length ? (
          <TighterText className="text-sm text-tamar-gray p-2">
            No custom quick actions found.
          </TighterText>
        ) : (
          <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {customQuickActions.map((action) => (
              <DropdownMenuItemWithDelete
                key={action.id}
                disabled={props.isTextSelected}
                onDelete={async () => await handleDelete(action.id)}
                title={action.title}
                onClick={async () => await handleQuickActionClick(action.id)}
                onEdit={() => openEditDialog(action.id)}
              />
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="border-t border-tamar-gray/10" />
        <DropdownMenuItem
          disabled={props.isTextSelected}
          onSelect={handleNewActionClick}
          className="flex items-center justify-start gap-1 text-tamar-gray hover:bg-tamar-light/10"
        >
          <CirclePlus className="w-4 h-4 text-tamar-gray" />
          <TighterText className="font-medium">New</TighterText>
        </DropdownMenuItem>
      </DropdownMenuContent>
      <NewCustomQuickActionDialog
        user={user}
        allQuickActions={customQuickActions || []}
        isEditing={isEditing}
        open={dialogOpen}
        onOpenChange={(c) => {
          setDialogOpen(c);
          if (!c) {
            setIsEditing(false);
          }
        }}
        customQuickAction={
          isEditing && isEditingId
            ? customQuickActions?.find((a) => a.id === isEditingId)
            : undefined
        }
        getAndSetCustomQuickActions={getAndSetCustomQuickActions}
      />
    </DropdownMenu>
  );
}
