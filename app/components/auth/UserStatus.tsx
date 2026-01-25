'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string | null;
}

/**
 * 用户状态组件
 * 显示当前登录状态，提供登录/登出功能
 */
export default function UserStatus() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取当前用户状态
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (data.success && data.isAuthenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // 登出
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.refresh();
    } catch (err) {
      console.error('登出失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  if (user) {
    // 已登录状态
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-semibold">
            {user.name?.[0] || user.email[0].toUpperCase()}
          </div>
          <span className="text-gray-700 font-medium">
            {user.name || user.email.split('@')[0]}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
        >
          登出
        </button>
      </div>
    );
  }

  // 未登录状态
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="px-4 py-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
      >
        登录
      </Link>
      <Link
        href="/register"
        className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition font-medium"
      >
        注册
      </Link>
    </div>
  );
}
