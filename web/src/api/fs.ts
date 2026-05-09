import { http } from './client';

export interface FsItem {
  name: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  path: string;
}

export interface ListResult {
  path: string;
  items: FsItem[];
}

export interface BatchDeleteResult {
  path: string;
  success: boolean;
  error?: string;
}

export interface UploadResult {
  name: string;
  originalName?: string;
  size?: number;
  success: boolean;
  error?: string;
  path?: string;
}

export async function listDir(path: string): Promise<ListResult> {
  const res = await http.get('/admin/list', { params: { path } });
  return res.data.data;
}

export async function createFolder(parent: string, name: string): Promise<{ path: string }> {
  const res = await http.post('/admin/folder', { path: parent, name });
  return res.data.data;
}

export async function deleteFolder(path: string): Promise<void> {
  await http.delete('/admin/folder', { data: { path } });
}

export async function deleteFile(path: string): Promise<void> {
  await http.delete('/admin/file', { data: { path } });
}

export async function batchDeleteFiles(paths: string[]): Promise<BatchDeleteResult[]> {
  const res = await http.post('/admin/files/batch-delete', { paths });
  return res.data.data.results;
}

export async function uploadFiles(
  path: string,
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<UploadResult[]> {
  const form = new FormData();
  form.append('path', path);
  for (const f of files) form.append('files', f);
  const res = await http.post('/admin/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return res.data.data.results;
}
