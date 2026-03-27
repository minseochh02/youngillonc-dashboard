import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExcelUploadButtonProps {
  onUpload: (data: any[]) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const ExcelUploadButton: React.FC<ExcelUploadButtonProps> = ({
  onUpload,
  disabled = false,
  label = '엑셀 업로드',
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const allData: any[] = [];
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          allData.push({ sheetName, data: jsonData });
        });
        
        onUpload(allData);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Excel upload error:', error);
      alert('엑셀 파일 읽기 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        className="hidden"
      />
      <button
        onClick={handleButtonClick}
        disabled={disabled || isProcessing}
        className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${className}`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        <span>{isProcessing ? '처리 중...' : label}</span>
      </button>
    </>
  );
};

export default ExcelUploadButton;
