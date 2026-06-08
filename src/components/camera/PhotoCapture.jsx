import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

export default function PhotoCapture({ slot, onCapture, onClose }) {
  const [preview, setPreview] = useState(null);

  const handleFile = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      if (onCapture) onCapture({ file_url: reader.result });
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  return (
    <div className="p-4">
      <h3 className="font-heading text-lg">Capture photo for {slot?.position || 'player'}</h3>
      <input type="file" accept="image/*" onChange={handleFile} />
      {preview && (
        <div className="mt-3">
          <img src={preview} alt="preview" className="max-w-full h-auto rounded" />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button onClick={onClose} variant="secondary">Close</Button>
      </div>
    </div>
  );
}