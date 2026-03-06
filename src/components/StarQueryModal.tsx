'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star, X } from 'lucide-react';

interface StarQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryText: string;
  sql: string;
  intent: string;
  onSave: (name: string, tags: string[]) => void;
}

export default function StarQueryModal({
  isOpen,
  onClose,
  queryText,
  sql,
  intent,
  onSave
}: StarQueryModalProps) {
  const [queryName, setQueryName] = useState(queryText.slice(0, 100));
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSave = () => {
    if (!queryName.trim()) {
      setError('쿼리 이름을 입력해주세요');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSave(queryName.trim(), tags);
    handleClose();
  };

  const handleClose = () => {
    setQueryName(queryText.slice(0, 100));
    setTagsInput('');
    setError('');
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-zinc-100">
              즐겨찾기 추가
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Query Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              쿼리 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={queryName}
              onChange={(e) => {
                setQueryName(e.target.value);
                setError('');
              }}
              placeholder="예: 창원 일일 매출"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500">
              {queryName.length}/100
            </p>
          </div>

          {/* Tags Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              태그 (선택사항)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="예: 매출, 일일, 창원"
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500">
              쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-xs font-medium text-zinc-400 mb-1">
              원본 쿼리
            </p>
            <p className="text-sm text-zinc-300">
              {queryText}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950 px-3 py-2">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Star className="w-4 h-4" />
            <span>저장</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
