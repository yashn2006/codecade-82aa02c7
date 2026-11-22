"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    variant?: "default" | "compact-center";
  }
>(({ className, children, variant = "default", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "dashboard-dialog fixed z-50 grid gap-4 overflow-x-hidden overflow-y-auto overscroll-contain border border-primary/20 bg-card shadow-pop backdrop-blur-[24px] duration-200 min-w-0",
        variant === "compact-center"
          ? "left-[50%] top-[50%] w-[calc(100vw-2rem)] max-w-[440px] translate-x-[-50%] translate-y-[-50%] rounded-2xl p-5 sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          : cn(
              "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:rounded-t-[26px] max-sm:rounded-b-none max-sm:px-4 max-sm:pt-5 max-sm:pb-[max(env(safe-area-inset-bottom),1.25rem)] max-sm:data-[state=open]:animate-in max-sm:data-[state=closed]:animate-out max-sm:data-[state=closed]:fade-out-0 max-sm:data-[state=open]:fade-in-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom",
              "sm:left-[50%] sm:top-[50%] sm:w-[calc(100%-1.5rem)] sm:max-w-[480px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-7 sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            ),
        className,
      )}
      {...props}
    >
      {variant !== "compact-center" && (
        <span
          aria-hidden
          className="pointer-events-none mx-auto -mt-2 mb-1 block h-1 w-10 rounded-full bg-white/25 sm:hidden"
        />
      )}
      {children}
      <DialogPrimitive.Close className="absolute right-2.5 top-2.5 grid h-11 w-11 place-items-center rounded-full text-foreground/65 ring-offset-background cursor-pointer transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;


const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex min-w-0 flex-col space-y-1.5 border-b border-border pb-4 pr-10 text-left",
      className,
    )}
    {...props}
  />
);

/** Magenta icon chip for modal headers. */
const DialogIcon = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={cn(
      "mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary",
      className,
    )}
  >
    {children}
  </div>
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-[20px] font-bold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogIcon,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
