import { useEffect, useRef, type ReactNode } from "react";

interface FilePreviewDialogProps {
  assetName: string;
  children: ReactNode;
  onClose: () => void;
}

export function FilePreviewDialog({ assetName, children, onClose }: FilePreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="file-preview-dialog"
      aria-label={`文件预览：${assetName}`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerStartedOutside.current = event.target === event.currentTarget
          && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
      }}
      onPointerCancel={() => { pointerStartedOutside.current = false; }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (event.target === event.currentTarget && pointerStartedOutside.current && outside) onClose();
        pointerStartedOutside.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
