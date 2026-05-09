import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Layout, Modal, Popconfirm, Space, Typography, message } from 'antd';
import { PathBreadcrumb } from '../components/Breadcrumb';
import { FileTable } from '../components/FileTable';
import { UploadArea } from '../components/UploadArea';
import {
  batchDeleteFiles,
  createFolder,
  deleteFile,
  deleteFolder,
  listDir,
  type FsItem,
} from '../api/fs';
import { useAuth } from '../store/auth';
import { ApiError } from '../api/client';
import { useHashPath } from '../hooks/useHashPath';

const { Header, Content } = Layout;

export function ManagerPage() {
  const username = useAuth((s) => s.username);
  const logout = useAuth((s) => s.logout);
  const [path, setPath] = useHashPath();
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [newDirOpen, setNewDirOpen] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  const refresh = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const r = await listDir(p);
      setItems(r.items);
      setSelected([]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to list';
      message.error(msg);
      if (
        e instanceof ApiError &&
        p !== '/' &&
        (e.code === 'DIR_NOT_FOUND' ||
          e.code === 'BAD_PATH' ||
          e.code === 'PATH_OUT_OF_ROOT')
      ) {
        setPath('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [setPath]);

  useEffect(() => {
    refresh(path);
  }, [path, refresh]);

  const onCreateFolder = async () => {
    if (!newDirName.trim()) return;
    try {
      await createFolder(path, newDirName.trim());
      message.success('Folder created');
      setNewDirOpen(false);
      setNewDirName('');
      await refresh(path);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed';
      message.error(msg);
    }
  };

  const onBatchDelete = async () => {
    try {
      const results = await batchDeleteFiles(selected);
      const ok = results.filter((r) => r.success).length;
      const fail = results.length - ok;
      if (fail === 0) message.success(`Deleted ${ok} file(s)`);
      else message.warning(`Deleted ${ok}, failed ${fail}`);
      await refresh(path);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed';
      message.error(msg);
    }
  };

  const disabled = uploading;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Static Server Admin
        </Typography.Title>
        <Space>
          <span>{username}</span>
          <Button onClick={logout}>Logout</Button>
        </Space>
      </Header>
      <Content style={{ padding: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <PathBreadcrumb path={path} onNavigate={setPath} disabled={disabled} />

          <Space>
            <Button onClick={() => setNewDirOpen(true)} disabled={disabled}>
              New Folder
            </Button>
            <Popconfirm
              title={`Delete ${selected.length} file(s)?`}
              onConfirm={onBatchDelete}
              disabled={disabled || selected.length === 0}
            >
              <Button danger disabled={disabled || selected.length === 0}>
                Batch Delete ({selected.length})
              </Button>
            </Popconfirm>
          </Space>

          <UploadArea
            currentPath={path}
            onUploaded={() => refresh(path)}
            onUploadingChange={setUploading}
          />

          <FileTable
            items={items}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            onEnter={setPath}
            disabled={disabled}
            onDeleteFile={async (p) => {
              try {
                await deleteFile(p);
                await refresh(path);
                message.success('Deleted');
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed';
                message.error(msg);
              }
            }}
            onDeleteFolder={async (p) => {
              try {
                await deleteFolder(p);
                await refresh(path);
                message.success('Deleted');
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed';
                message.error(msg);
              }
            }}
          />
        </Space>
      </Content>

      <Modal
        open={newDirOpen}
        title="New Folder"
        onOk={onCreateFolder}
        onCancel={() => {
          setNewDirOpen(false);
          setNewDirName('');
        }}
      >
        <Input
          placeholder="Folder name"
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          onPressEnter={onCreateFolder}
        />
      </Modal>
    </Layout>
  );
}
