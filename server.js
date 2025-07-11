import express from 'express';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import https from 'https';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json()); // ✅ Body parser for JSON

const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 4000;

if (!process.env.MONDAY_API_KEY) {
  console.error('❌ Missing MONDAY_API_KEY in .env');
  process.exit(1);
}

// Route: /upload
app.post('/upload', upload.single('file'), (req, res) => {
  const { item_id, column_id } = req.query;

  if (!item_id || !column_id) {
    return res.status(400).json({ error: 'Missing item_id or column_id in query params' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileContent = fs.readFileSync(req.file.path);

  const query = `
    mutation addFile($file: File!, $item_id: ID!, $column_id: String!) {
      add_file_to_column(item_id: $item_id, column_id: $column_id, file: $file) {
        id
      }
    }
  `;

  const variables = {
    item_id: item_id,
    column_id: column_id,
    file: null,
  };

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  let formData = '';

  formData += `--${boundary}\r\n`;
  formData += 'Content-Disposition: form-data; name="query"\r\n\r\n';
  formData += query + '\r\n';

  formData += `--${boundary}\r\n`;
  formData += 'Content-Disposition: form-data; name="variables"\r\n\r\n';
  formData += JSON.stringify(variables) + '\r\n';

  formData += `--${boundary}\r\n`;
  formData += 'Content-Disposition: form-data; name="map"\r\n\r\n';
  formData += `{"fileField": ["variables.file"]}\r\n`;

  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="fileField"; filename="${req.file.originalname}"\r\n`;
  formData += 'Content-Type: application/octet-stream\r\n\r\n';

  const payload = Buffer.concat([
    Buffer.from(formData, 'utf8'),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);

  const options = {
    method: 'POST',
    hostname: 'api.monday.com',
    path: '/v2/file',
    headers: {
      Authorization: process.env.MONDAY_API_KEY,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
    },
  };

  const request = https.request(options, (response) => {
    let rawData = '';
    response.on('data', (chunk) => { rawData += chunk; });
    response.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        res.status(200).json(parsedData);
      } catch (e) {
        console.error('Parse error:', e);
        res.status(500).send('Invalid JSON response');
      }
    });
  });

  request.on('error', (error) => {
    console.error('Request error:', error);
    res.status(500).send('Upload failed');
  });

  request.write(payload);
  request.end();

  fs.unlink(req.file.path, (err) => {
    if (err) {
      console.error('Failed to delete temp file:', err);
    }
  });
});

// ✅ Route: /create-item
app.post('/create-item', (req, res) => {
  const { boardId, itemName } = req.body;

  if (!boardId || !itemName) {
    return res.status(400).json({ error: 'Missing boardId or itemName in request body' });
  }

  const query = `
    mutation {
      create_item(board_id: ${boardId}, item_name: "${itemName}") {
        id
      }
    }
  `;

  const options = {
    method: 'POST',
    hostname: 'api.monday.com',
    path: '/v2',
    headers: {
      Authorization: process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  const request = https.request(options, (response) => {
    let rawData = '';
    response.on('data', (chunk) => { rawData += chunk; });
    response.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        res.status(200).json(parsedData);
      } catch (e) {
        console.error('Parse error:', e);
        res.status(500).send('Invalid JSON response');
      }
    });
  });

  request.on('error', (error) => {
    console.error('Request error:', error);
    res.status(500).send('Create item failed');
  });

  request.write(JSON.stringify({ query }));
  request.end();
});

// ✅ Route: /create-subitem
app.post('/create-subitem', (req, res) => {
  const { parentItemId, itemName } = req.body;

  if (!parentItemId || !itemName) {
    return res.status(400).json({ error: 'Missing parentItemId or itemName in request body' });
  }

  const query = `
    mutation {
      create_subitem(parent_item_id: ${parentItemId}, item_name: "${itemName}") {
        id
      }
    }
  `;

  const options = {
    method: 'POST',
    hostname: 'api.monday.com',
    path: '/v2',
    headers: {
      Authorization: process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  const request = https.request(options, (response) => {
    let rawData = '';
    response.on('data', (chunk) => { rawData += chunk; });
    response.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        res.status(200).json(parsedData);
      } catch (e) {
        console.error('Parse error:', e);
        res.status(500).send('Invalid JSON response');
      }
    });
  });

  request.on('error', (error) => {
    console.error('Request error:', error);
    res.status(500).send('Create subitem failed');
  });

  request.write(JSON.stringify({ query }));
  request.end();
});

// Server start
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
