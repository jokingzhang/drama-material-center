import { Clock3 } from "lucide-react";
import { formatDate } from "../lib/materials";

export function AssetModifiedTime({ updatedAt }: { updatedAt?: string }) {
  const modifiedAt = updatedAt ? new Date(updatedAt) : undefined;
  const available = modifiedAt !== undefined && !Number.isNaN(modifiedAt.getTime());
  const label = available && updatedAt ? `修改于 ${formatDate(updatedAt)}` : "修改时间不可用";

  return (
    <time
      className="asset-modified-time"
      dateTime={available ? updatedAt : undefined}
      title={available ? modifiedAt.toLocaleString("zh-CN") : label}
    >
      <Clock3 size={12} aria-hidden="true" />
      {label}
    </time>
  );
}
