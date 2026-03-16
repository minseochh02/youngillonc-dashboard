import React, { useState } from 'react';
import { Download } from 'lucide-react';

export interface ExcelDownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
  label?: string;
}

/**
 * Reusable Excel download button component
 * Provides consistent styling and loading states across all dashboard pages
 */
export const ExcelDownloadButton: React.FC<ExcelDownloadButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  label = '엑셀 다운로드'
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onClick();
    } catch (error) {
      console.error('Excel download error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses = 'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = variant === 'primary'
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : 'bg-gray-200 hover:bg-gray-300 text-gray-700';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      <Download className="w-4 h-4" />
      <span>{isLoading ? '다운로드 중...' : label}</span>
    </button>
  );
};

export default ExcelDownloadButton;
