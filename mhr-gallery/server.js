const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { Octokit } = require('@octokit/rest');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'daudt';
const GITHUB_REPO = process.env.GITHUB_REPO || 'mhr-website';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH || '1024', 10);
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '80', 10);

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Mobile-friendly upload page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>MHR Gallery</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 24px;
      margin-bottom: 30px;
      font-weight: 600;
    }
    .upload-area {
      border: 3px dashed #4a5568;
      border-radius: 16px;
      padding: 40px 20px;
      text-align: center;
      margin-bottom: 20px;
      transition: all 0.3s ease;
      background: rgba(255,255,255,0.05);
    }
    .upload-area.drag-over {
      border-color: #4ade80;
      background: rgba(74, 222, 128, 0.1);
    }
    .upload-area.has-files {
      border-color: #4ade80;
      border-style: solid;
    }
    #fileInput {
      display: none;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      font-size: 18px;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-select {
      background: #3b82f6;
      color: white;
      margin-bottom: 12px;
    }
    .btn-select:active {
      background: #2563eb;
      transform: scale(0.98);
    }
    .btn-upload {
      background: #22c55e;
      color: white;
    }
    .btn-upload:disabled {
      background: #4a5568;
      cursor: not-allowed;
    }
    .btn-upload:not(:disabled):active {
      background: #16a34a;
      transform: scale(0.98);
    }
    .preview-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 20px 0;
      justify-content: center;
    }
    .preview-item {
      position: relative;
      width: 80px;
      height: 80px;
    }
    .preview-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    .preview-item .remove {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      background: #ef4444;
      border-radius: 50%;
      border: none;
      color: white;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .status {
      text-align: center;
      padding: 12px;
      border-radius: 8px;
      margin-top: 20px;
      font-weight: 500;
    }
    .status.success {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .status.error {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .status.uploading {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }
    .file-count {
      color: #9ca3af;
      font-size: 14px;
      margin-top: 10px;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>MHR Gallery</h1>

    <div class="upload-area" id="dropZone">
      <button class="btn btn-select" onclick="document.getElementById('fileInput').click()">
        Select Photos
      </button>
      <input type="file" id="fileInput" accept="image/*" multiple>
      <div class="preview-container" id="previews"></div>
      <div class="file-count" id="fileCount"></div>
    </div>

    <button class="btn btn-upload" id="uploadBtn" disabled onclick="uploadFiles()">
      Upload to Gallery
    </button>

    <div class="status" id="status" style="display: none;"></div>
  </div>

  <script>
    let selectedFiles = [];
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previews = document.getElementById('previews');
    const fileCount = document.getElementById('fileCount');
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');

    // Drag and drop
    ['dragenter', 'dragover'].forEach(e => {
      dropZone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(e => {
      dropZone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });
    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      addFiles(files);
    });

    fileInput.addEventListener('change', () => {
      addFiles(Array.from(fileInput.files));
      fileInput.value = '';
    });

    function addFiles(files) {
      selectedFiles = [...selectedFiles, ...files];
      updatePreviews();
    }

    function removeFile(index) {
      selectedFiles.splice(index, 1);
      updatePreviews();
    }

    function updatePreviews() {
      previews.innerHTML = '';
      selectedFiles.forEach((file, i) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        const btn = document.createElement('button');
        btn.className = 'remove';
        btn.innerHTML = '&times;';
        btn.onclick = () => removeFile(i);
        div.appendChild(img);
        div.appendChild(btn);
        previews.appendChild(div);
      });

      fileCount.textContent = selectedFiles.length ?
        selectedFiles.length + ' photo' + (selectedFiles.length > 1 ? 's' : '') + ' selected' : '';
      uploadBtn.disabled = selectedFiles.length === 0;
      dropZone.classList.toggle('has-files', selectedFiles.length > 0);
      status.style.display = 'none';
    }

    async function uploadFiles() {
      if (selectedFiles.length === 0) return;

      uploadBtn.disabled = true;
      status.className = 'status uploading';
      status.innerHTML = '<span class="spinner"></span>Uploading...';
      status.style.display = 'block';

      let successCount = 0;
      let errorCount = 0;

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('photo', file);

        try {
          const res = await fetch('/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success) {
            successCount++;
          } else {
            errorCount++;
            console.error('Upload failed:', data.error);
          }
        } catch (err) {
          errorCount++;
          console.error('Upload error:', err);
        }

        // Update progress
        status.innerHTML = '<span class="spinner"></span>Uploading ' +
          (successCount + errorCount) + '/' + selectedFiles.length + '...';
      }

      selectedFiles = [];
      updatePreviews();

      if (errorCount === 0) {
        status.className = 'status success';
        status.textContent = successCount + ' photo' + (successCount > 1 ? 's' : '') + ' uploaded!';
      } else {
        status.className = 'status error';
        status.textContent = successCount + ' uploaded, ' + errorCount + ' failed';
      }
    }
  </script>
</body>
</html>
  `);
});

// Handle upload
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Resize and convert to JPEG (rotate based on EXIF orientation)
    const resizedBuffer = await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(IMAGE_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    // Generate filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const filename = `gallery-${timestamp}.jpg`;
    const filepath = `images/gallery/${filename}`;

    // Upload to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filepath,
      message: `Add gallery photo: ${filename}`,
      content: resizedBuffer.toString('base64'),
      branch: GITHUB_BRANCH,
    });

    console.log(`Uploaded: ${filename}`);
    res.json({ success: true, filename });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MHR Gallery running on port ${PORT}`);
});
