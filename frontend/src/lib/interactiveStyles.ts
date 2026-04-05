import { cn } from "@/lib/utils";

export const interactivePointerClassName = "cursor-pointer disabled:cursor-not-allowed";
export const interactiveFormControlPointerClassName = interactivePointerClassName;

export function getInteractivePointerClassName(className?: string): string {
  return cn(interactivePointerClassName, className);
}

export function getInteractiveFormControlClassName(className?: string): string {
  return cn(interactiveFormControlPointerClassName, className);
}
