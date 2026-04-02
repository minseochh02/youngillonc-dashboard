import { NextRequest, NextResponse } from 'next/server';
import { queryTable, executeSQL } from '../../../../../egdesk-helpers';
import { processEMLFile, updateDeletionStatus } from '../../../../lib/eml-processor';
import { createDriveClient, deleteFileFromDrive } from '../../../../lib/google-drive-client';
import * as fs from 'fs';

/**
 * POST /api/eml/retry
 *
 * Retry failed EML processing
 *
 * Body:
 *  - fileId (optional): Specific file ID to retry
 *  - retryAll (optional): If true, retry all failed files
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, retryAll } = body;

    if (!fileId && !retryAll) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must provide either fileId or retryAll=true'
        },
        { status: 400 }
      );
    }

    const drive = createDriveClient();
    const results: Array<{ fileId: string; fileName: string; success: boolean; error?: string }> = [];

    if (fileId) {
      // Retry specific file
      const fileResult = await queryTable('eml_processing_log', {
        filters: { file_id: fileId },
        limit: 1
      });

      if (!fileResult.rows || fileResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `File ${fileId} not found in processing log`
          },
          { status: 404 }
        );
      }

      const fileEntry = fileResult.rows[0];
      const result = await retryEMLFile(drive, fileEntry);
      results.push(result);
    } else if (retryAll) {
      // Retry all failed files
      const failedFiles = await queryTable('eml_processing_log', {
        filters: { status: 'failed' },
        limit: 100
      });

      if (!failedFiles.rows || failedFiles.rows.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No failed files to retry',
          results: []
        });
      }

      for (const fileEntry of failedFiles.rows) {
        const result = await retryEMLFile(drive, fileEntry);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Retry complete: ${successCount} succeeded, ${failCount} failed`,
      results
    });
  } catch (error: any) {
    console.error('❌ Error retrying EML files:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Retry processing a single EML file
 */
async function retryEMLFile(
  drive: any,
  fileEntry: any
): Promise<{ fileId: string; fileName: string; success: boolean; error?: string }> {
  const fileId = fileEntry.file_id;
  const fileName = fileEntry.file_name;
  const downloadPath = fileEntry.download_path;

  console.log(`🔄 Retrying EML file: ${fileName}`);

  try {
    // Check if local file still exists
    if (!fs.existsSync(downloadPath)) {
      throw new Error(`Local file not found: ${downloadPath}. Cannot retry.`);
    }

    // Process the EML file
    await processEMLFile(fileId, downloadPath, fileName);

    let deletedLocal = false;
    let deletedDrive = false;

    // Delete local file
    try {
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
        deletedLocal = true;
        console.log(`🗑️  Deleted local file: ${fileName}`);
      }
    } catch (error: any) {
      console.error(`⚠️  Failed to delete local file: ${error.message}`);
    }

    // Delete from Google Drive
    try {
      await deleteFileFromDrive(drive, fileId);
      deletedDrive = true;
      console.log(`🗑️  Deleted from Drive: ${fileName}`);
    } catch (error: any) {
      console.error(`⚠️  Failed to delete from Drive: ${error.message}`);
    }

    // Update deletion status
    await updateDeletionStatus(fileId, deletedDrive, deletedLocal);

    console.log(`✅ Retry successful: ${fileName}`);
    return { fileId, fileName, success: true };
  } catch (error: any) {
    console.error(`❌ Retry failed for ${fileName}: ${error.message}`);
    return { fileId, fileName, success: false, error: error.message };
  }
}
