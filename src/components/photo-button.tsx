"use client";

import { ImagePlusIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

// Opens the photo picker (the camera roll on phones) and hands back the chosen files.
export function PhotoButton({
  onPick,
  disabled,
  size,
  children,
}: {
  onPick: (files: File[]) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPick([...(e.target.files ?? [])]);
          e.target.value = ""; // so picking the same photo again still fires
        }}
      />
      <Button type="button" variant="outline" size={size} disabled={disabled} onClick={() => input.current?.click()}>
        <ImagePlusIcon /> {children}
      </Button>
    </>
  );
}
