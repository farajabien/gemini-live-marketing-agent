"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateNarrativeField } from "@/app/actions/marketing";
import { useAuth } from "@/hooks/use-auth";

interface NarrativeSectionProps {
  narrativeId: string;
  title: string;
  field: string;
  value: string;
  placeholder: string;
}

export function NarrativeSection({
  narrativeId,
  title,
  field,
  value,
  placeholder,
}: NarrativeSectionProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    if (!user) {
        alert("You must be logged in to edit.");
        return;
    }

    setIsSaving(true);
    try {
      await updateNarrativeField(narrativeId, field, editValue, user.id);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update narrative:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
          {title}
        </h3>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm mr-1">edit</span>
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] bg-black/30 border-white/20 text-white placeholder:text-slate-600 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              disabled={isSaving}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || editValue.length < 5}
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm mr-2">refresh</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm mr-2">check</span>
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
          {value || <span className="text-slate-500 italic">{placeholder}</span>}
        </p>
      )}
    </div>
  );
}
