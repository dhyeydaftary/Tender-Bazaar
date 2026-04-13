import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../middleware/error-handler';

// ─── Configuration ──────────────────────────────────────
// Using local disk storage for development.
// For production, migrate to S3 using @aws-sdk/client-s3:
//
//   import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
//
//   const s3 = new S3Client({
//     region: process.env.AWS_REGION,
//     credentials: {
//       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//     },
//   });
//
//   // Upload: use multer memoryStorage + s3.send(new PutObjectCommand({ ... }))
//   // Delete: s3.send(new DeleteObjectCommand({ Bucket, Key }))
//   // URL: `https://${bucket}.s3.${region}.amazonaws.com/${key}`

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// ─── Local Disk Storage ─────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = (req as any).user?.id || 'unknown';
    const dir = path.join(UPLOAD_DIR, 'users', userId, 'documents');

    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname).slice(1);
    const uniqueId = crypto.randomUUID();
    cb(null, `${uniqueId}.${ext}`);
  },
});

// ─── File Filter ────────────────────────────────────────

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(new AppError(
      'Invalid file type. Only PDF, JPG, PNG, DOC, and DOCX files are allowed.',
      400,
      'INVALID_FILE_TYPE',
    ));
    return;
  }
  cb(null, true);
};

// ─── Multer Instance ────────────────────────────────────

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// ─── Delete File Helper ─────────────────────────────────
// For S3 migration, replace with:
//   export async function deleteFile(key: string) {
//     await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
//   }

export async function deleteFile(filePath: string): Promise<void> {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(UPLOAD_DIR, filePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // Log but don't throw - file cleanup failure shouldn't break the request
    console.error('Failed to delete file:', filePath, error);
  }
}

// ─── Build File URL ─────────────────────────────────────
// For S3, return the S3 URL instead:
//   return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

export function buildFileUrl(userId: string, filename: string): string {
  return `uploads/users/${userId}/documents/${filename}`;
}
