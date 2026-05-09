import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, message } from 'antd';
import { login } from '../api/auth';
import { useAuth } from '../store/auth';
import { ApiError } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const r = await login(values.username, values.password);
      setSession(r.token, r.username);
      navigate('/', { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Login failed';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card title="Static Server Admin" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onSubmit} disabled={loading}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please enter username' }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter password' }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
