import { Breadcrumb as AntdBreadcrumb, Button, Space } from 'antd';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
  disabled?: boolean;
}

export function PathBreadcrumb({ path, onNavigate, disabled }: Props) {
  const segments = path.split('/').filter(Boolean);
  const items = [
    {
      title: (
        <a
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) onNavigate('/');
          }}
        >
          /
        </a>
      ),
    },
    ...segments.map((seg, i) => {
      const target = '/' + segments.slice(0, i + 1).join('/');
      return {
        title: (
          <a
            onClick={(e) => {
              e.preventDefault();
              if (!disabled) onNavigate(target);
            }}
          >
            {seg}
          </a>
        ),
      };
    }),
  ];

  const onUp = () => {
    if (disabled) return;
    if (segments.length === 0) return;
    const parent = '/' + segments.slice(0, -1).join('/');
    onNavigate(parent === '/' ? '/' : parent);
  };

  return (
    <Space>
      <Button onClick={onUp} disabled={disabled || segments.length === 0} aria-label="up">
        Up
      </Button>
      <AntdBreadcrumb items={items} />
    </Space>
  );
}
