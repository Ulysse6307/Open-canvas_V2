import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CustomModelConfig,
  ModelConfigurationParams,
} from "@opencanvas/shared/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ALL_MODEL_NAMES,
  TEMPERATURE_EXCLUDED_MODELS,
} from "@opencanvas/shared/models";
import { cn } from "@/lib/utils";
import { GearIcon, ResetIcon } from "@radix-ui/react-icons";
import { useCallback } from "react";

interface ModelConfigPanelProps {
  model: ModelConfigurationParams;
  modelConfig: CustomModelConfig;
  className?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClick: (e: any) => any;
  setModelConfig: (
    modelName: ALL_MODEL_NAMES,
    config: CustomModelConfig
  ) => void;
}

export function ModelConfigPanel({
  model,
  modelConfig,
  className,
  isOpen,
  onOpenChange,
  onClick,
  setModelConfig,
}: ModelConfigPanelProps) {
  const handleTemperatureChange = useCallback(
    (value: number[]) => {
      setModelConfig(model.name, {
        ...modelConfig,
        temperatureRange: {
          ...modelConfig.temperatureRange,
          current: value[0],
        },
      });
    },
    [setModelConfig, modelConfig, model]
  );

  const handleMaxTokensChange = useCallback(
    (value: number[]) => {
      setModelConfig(model.name, {
        ...modelConfig,
        maxTokens: {
          ...modelConfig.maxTokens,
          current: value[0],
        },
      });
    },
    [setModelConfig, modelConfig, model]
  );

  const handleReset = useCallback(() => {
    setModelConfig(model.name, {
      ...modelConfig,
      temperatureRange: {
        ...modelConfig.temperatureRange,
        current: modelConfig.temperatureRange.default,
      },
      maxTokens: {
        ...modelConfig.maxTokens,
        current: modelConfig.maxTokens.default,
      },
    });
  }, [setModelConfig, modelConfig, model]);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger onClick={onClick} asChild>
        <button className="flex-shrink-0 flex size-6 items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 group">
          <GearIcon className="size-4 text-tamar-gray group-hover:text-tamar-violet transition-colors duration-200" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className={cn(
          "w-80 p-6 rounded-xl shadow-sm bg-white border border-tamar-gray/10",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-4">
          <ModelSettingSlider
            title="Temperature"
            description="Controls creativity - lower for focused outputs, higher for more variety and imagination."
            value={modelConfig.temperatureRange.current}
            range={{
              min: modelConfig.temperatureRange.min,
              max: modelConfig.temperatureRange.max,
              step: 0.1,
            }}
            onChange={handleTemperatureChange}
            disabled={TEMPERATURE_EXCLUDED_MODELS.some((m) => m === model.name)}
          />
          <ModelSettingSlider
            title="Max tokens"
            description="Set how long the AI's response can be - more tokens mean longer, more detailed responses."
            value={modelConfig.maxTokens.current}
            range={{
              min: modelConfig.maxTokens.min,
              max: modelConfig.maxTokens.max,
              step: 1,
            }}
            onChange={handleMaxTokensChange}
          />
          <Button
            onClick={handleReset}
            variant="outline"
            className="mt-2 border-tamar-gray/20 hover:bg-tamar-violet/10 hover:border-tamar-violet/20 text-tamar-gray hover:text-tamar-violet transition-colors duration-200"
          >
            <ResetIcon className="mr-2 h-4 w-4 text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
            Reset to Defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ModelSettingSlider = ({
  title,
  description,
  value,
  range,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (value: number[]) => void;
  disabled?: boolean;
}) => (
  <div className="space-y-2">
    <h4
      className={cn(
        "font-semibold leading-none text-base text-tamar-gray",
        disabled && "opacity-50"
      )}
    >
      {title}
      {disabled && " (disabled)"}
    </h4>
    <p
      className={cn(
        "text-sm text-tamar-gray/80",
        disabled && "opacity-50"
      )}
    >
      {description}
    </p>
    <Slider
      min={range.min}
      max={range.max}
      step={range.step}
      value={disabled ? [range.min] : [value]}
      onValueChange={onChange}
      disabled={disabled}
      className={cn(
        "[&_.slider-track]:bg-tamar-gray/10 [&_.slider-track]:h-1",
        "[&_.slider-range]:bg-tamar-violet [&_.slider-range]:h-1",
        "[&_.slider-thumb]:border-tamar-violet [&_.slider-thumb]:bg-white [&_.slider-thumb]:border-2 [&_.slider-thumb]:w-4 [&_.slider-thumb]:h-4",
        "[&_.slider-thumb]:hover:bg-tamar-violet/10 [&_.slider-thumb]:hover:border-tamar-violet/80",
        "[&_.slider-thumb]:focus:ring-tamar-violet/20 [&_.slider-thumb]:focus:ring-2 [&_.slider-thumb]:focus:ring-offset-2"
      )}
    />
    <div className={cn("text-right text-sm text-tamar-gray/80", disabled && "opacity-50")}>
      {disabled ? range.min : value}
    </div>
  </div>
);
