import { Archive, RotateCcw } from "lucide-react";
import type { Card } from "@/lib/model";

export default function CardArchiveButton({
  card,
  onChange,
  identifyCard = false,
}: {
  card: Card;
  onChange: (id: string, status: Card["status"]) => void;
  identifyCard?: boolean;
}) {
  const archived = card.status === "archived";
  const label = archived ? "Restore" : "Archive";
  return (
    <button
      className="text-button card-archive-button"
      aria-label={identifyCard ? `${label} ${card.text}` : label}
      title={
        archived
          ? "Include in future daily reviews"
          : "Exclude from future daily reviews"
      }
      onClick={() => onChange(card.id, archived ? "active" : "archived")}
    >
      {archived ? <RotateCcw size={16} /> : <Archive size={16} />}
      {label}
    </button>
  );
}
