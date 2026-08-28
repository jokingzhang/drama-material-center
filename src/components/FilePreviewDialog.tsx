import { useEffect, useRef, type ReactNode } from "react";

interface FilePreviewDialogProps {
  assetName: string;
  children: ReactNode;
  onClose: () => void;
}

export function FilePreviewDialog({ assetName, children, onClose }: FilePreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
