import { Button, Popconfirm, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FsItem } from '../api/fs';
import { buildStaticUrl } from '../utils/staticUrl';

interface Props {
  items: FsItem[];
  loading: boolean;
  selected: string[];
  onSelect: (paths: string[]) => void;
  onEnter: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  disabled?: boolean;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileTable(props: Props) {
  const { items, loading, selected, onSelect, onEnter, onDeleteFile, onDeleteFolder, disabled } =
    props;

  const columns: ColumnsType<FsItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_v, r) =>
        r.type === 'dir' ? (
          <a
            onClick={(e) => {
              e.preventDefault();
              if (!disabled) onEnter(r.path);
            }}
          >
            <Tag color="blue">DIR</Tag> {r.name}
          </a>
        ) : (
          <span>
            <Tag>FILE</Tag> {r.name}
          </span>
        ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 120,
      render: (v, r) => (r.type === 'dir' ? '-' : fmtSize(v)),
    },
    {
      title: 'Modified',
      dataIndex: 'mtime',
      width: 200,
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: 'Visit',
      width: 80,
      render: (_v, r) =>
        r.type === 'file' ? (
          <a
            href={buildStaticUrl(r.path)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`访问 ${r.name}`}
          >
            Open
          </a>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: 'Actions',
      width: 140,
      render: (_v, r) => (
        <Space>
          {r.type === 'file' ? (
            <Popconfirm
              title="Delete this file?"
              onConfirm={() => onDeleteFile(r.path)}
              disabled={disabled}
            >
              <Button danger size="small" disabled={disabled}>
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Delete folder? Must be empty."
              onConfirm={() => onDeleteFolder(r.path)}
              disabled={disabled}
            >
              <Button danger size="small" disabled={disabled}>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey={(r) => r.path}
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={false}
      size="middle"
      rowSelection={{
        selectedRowKeys: selected,
        onChange: (keys) => onSelect(keys as string[]),
        getCheckboxProps: (r) => ({ disabled: r.type !== 'file' || disabled }),
      }}
    />
  );
}
