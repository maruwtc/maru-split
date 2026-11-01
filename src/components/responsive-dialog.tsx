"use client"

import * as React from "react"
import { useIsDesktop } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

/** Bottom-sheet drawer on phones, centered dialog on desktop. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  flush = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  /** No bottom padding — for content with its own sticky footer. */
  flush?: boolean
}) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-lg", flush && "pb-0")}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="min-w-0">{children}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[94dvh] overflow-x-hidden">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className={cn("min-w-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-4", !flush && "pb-safe")}>{children}</div>
      </DrawerContent>
    </Drawer>
  )
}
