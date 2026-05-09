import { useRef, useState } from 'react';
import { Button, Progress, Spin } from 'antd';
import { uploadFiles } from '../api/fs';

interface Props {
  currentPath: string;
  onUploaded: () => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}

export function UploadArea({ currentPath, onUploaded, onUploadingChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => {
    if (uploading || disabled) return;
    inputRef.current?.click();
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      await uploadFiles(currentPath, files, setProgress);
      onUploaded();
    } finally {
      setUploading(false);
      setProgress(0);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      data-testid="upload-area"
      style={{
        position: 'relative',
        border: '1px dashed #d9d9d9',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        background: '#fafafa',
        pointerEvents: uploading || disabled ? 'none' : 'auto',
        opacity: uploading || disabled ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={onChange}
        data-testid="file-input"
      />
      <Button onClick={onPick} disabled={uploading || disabled} type="primary">
        Upload files to {currentPath}
      </Button>
      {uploading && (
        <div style={{ marginTop: 16 }}>
          <Spin /> <span data-testid="upload-progress">Uploading {progress}%</span>
          <Progress percent={progress} status="active" />
        </div>
      )}
    </div>
  );
}
