import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  cafeId: string;
  folder?: string; // sub-folder under <cafeId>/
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
  accept?: string;
};

const BUCKET = "cafe-gallery";

export function ImageUploader({ cafeId, folder = "misc", onUploaded, label = "Upload image", className, accept = "image/*" }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8 MB");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${cafeId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span className="ml-2">{busy ? "Uploading…" : label}</span>
      </Button>
    </>
  );
}
