import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  LinearProgress,
  Chip,
  Alert,
  Fade,
} from '@mui/material';
import {
  CloudUploadRounded,
  AttachFileRounded,
  DeleteRounded,
  CloseRounded,
  InsertDriveFileRounded,
  ImageRounded,
  PictureAsPdfRounded,
  DescriptionRounded,
  VideoFileRounded,
  AudioFileRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
// import { useThemeStore } from '@store/themeStore'; // Removed unused import

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  onClose: () => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
  multiple?: boolean;
}

interface FileWithPreview extends File {
  id: string;
  preview?: string;
  error?: string;
}

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/*',
  'text/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export function FileUpload({
  onUpload,
  onClose,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  multiple = true,
}: FileUploadProps) {
  const { t } = useTranslation();
  // const { reducedMotion } = useThemeStore(); // Removed unused variable
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageRounded />;
    if (type === 'application/pdf') return <PictureAsPdfRounded />;
    if (type.startsWith('video/')) return <VideoFileRounded />;
    if (type.startsWith('audio/')) return <AudioFileRounded />;
    if (type.startsWith('text/') || type.includes('document') || type.includes('sheet')) {
      return <DescriptionRounded />;
    }
    return <InsertDriveFileRounded />;
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return t('fileUpload.errors.fileTooLarge', {
        name: file.name,
        max: formatFileSize(maxFileSize),
      });
    }

    // Check file type
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return t('fileUpload.errors.fileTypeNotAllowed', { name: file.name });
    }

    return null;
  };

  const createFilePreview = async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    // Check total file count
    if (files.length + fileArray.length > maxFiles) {
      newErrors.push(t('fileUpload.errors.tooManyFiles', { max: maxFiles }));
      setErrors(newErrors);
      return;
    }

    for (const file of fileArray) {
      // Check if file already exists
      const exists = files.some(f => f.name === file.name && f.size === file.size);
      if (exists) {
        newErrors.push(t('fileUpload.errors.fileAlreadyExists', { name: file.name }));
        continue;
      }

      // Validate file
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
        continue;
      }

      // Create file with preview
      const fileWithPreview: FileWithPreview = {
        ...file,
        id: `${file.name}-${file.size}-${Date.now()}`,
        preview: await createFilePreview(file),
      };

      validFiles.push(fileWithPreview);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }
  }, [files, maxFiles, maxFileSize, t]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, []);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addFiles(files);
    }
    // Reset input value
    event.target.value = '';
  }, [addFiles]);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current++;
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles) {
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  const handleUpload = useCallback(() => {
    if (files.length > 0) {
      onUpload(files);
    }
  }, [files, onUpload]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 400,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachFileRounded />
          <Typography variant="h6">
            {t('fileUpload.title')}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {/* Error Messages */}
        {errors.length > 0 && (
          <Fade in={true}>
            <Alert
              severity="error"
              onClose={clearErrors}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" component="div">
                {errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </Typography>
            </Alert>
          </Fade>
        )}

        {/* Upload Area */}
        <Paper
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          sx={{
            p: 4,
            mb: 2,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            backgroundColor: isDragging ? 'primary.light' : 'background.default',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'primary.light',
            },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <CloudUploadRounded
            sx={{
              fontSize: 48,
              color: isDragging ? 'primary.main' : 'text.secondary',
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragging
              ? t('fileUpload.dropFiles')
              : t('fileUpload.dragOrClick')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fileUpload.supportedFormats')}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${t('fileUpload.maxFiles')}: ${maxFiles}`} size="small" />
            <Chip label={`${t('fileUpload.maxSize')}: ${formatFileSize(maxFileSize)}`} size="small" />
          </Box>
        </Paper>

        {/* File List */}
        {files.length > 0 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {t('fileUpload.selectedFiles')} ({files.length}/{maxFiles})
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {files.map((file) => (
                <ListItem
                  key={file.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    {file.preview ? (
                      <Box
                        component="img"
                        src={file.preview}
                        sx={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      getFileIcon(file)
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)} • {file.type || t('fileUpload.unknownType')}
                        </Typography>
                        {uploadProgress[file.id] !== undefined && (
                          <LinearProgress
                            variant="determinate"
                            value={uploadProgress[file.id]}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => removeFile(file.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteRounded />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={allowedTypes.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={files.length === 0}
          startIcon={<CloudUploadRounded />}
        >
          {t('fileUpload.upload')} ({files.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
}