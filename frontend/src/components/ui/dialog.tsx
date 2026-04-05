import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby="dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      role="dialog"
    >
      <div
        className={cn(
          "border-border/70 bg-card relative w-full max-w-lg overflow-hidden rounded-2xl border px-4 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="custom-scrollbar max-h-[90vh] overflow-auto px-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight" id="dialog-title">
                {title}
              </h2>
              {description ? (
                <p className="text-muted-foreground mt-2 text-sm">{description}</p>
              ) : null}
            </div>
            <Button
              aria-label="Close dialog"
              onClick={() => onOpenChange(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
