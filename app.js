import express from 'express';
import archiver from 'archiver';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { GridFsStorage } from 'multer-gridfs-storage';
import bodyParser from 'body-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel Static Folder
app.set('views', path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")));

// CORS Setup
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// Multer Storage Setup
const storage = new GridFsStorage({
  url: process.env.MongoDbUrl,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename,
          metadata: {
            originalname: file.originalname,
          },
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

const upload = multer({ storage });

// MongoDB Setup
let bucket;
mongoose.connect(process.env.MongoDbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  const db = mongoose.connection.db;
  bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'uploads'
  });
}).catch(err => {});

// Schema
const shareSchema = new mongoose.Schema({
  shareId: String,
  fileIds: [mongoose.Types.ObjectId],
  createdAt: { type: Date, default: Date.now, expires: '1d' }
});
const filedb = mongoose.model('Share', shareSchema);

// Routes
app.get('/', (req, res) => {
  res.render("home", { fileIds: [] });
});

app.post('/upload/file', upload.array("files"), async (req, res) => {
  try {
    const fileIds = req.files.map(file => file.id);
    const shareId = crypto.randomBytes(3).toString("hex");
    await filedb.create({ shareId, fileIds });
    res.send(shareId);
  } catch (err) {
    
    res.status(500).send("Upload Failed");
  }
});

app.get("/download/:id", async (req, res) => {
  try {
    const shareId = req.params.id;
    const isShare = await filedb.findOne({ shareId });
    if (!isShare) return res.status(404).send("No Files Shared");

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`DropLaa-${shareId}.zip`);
    archive.pipe(res);

    for (const fileId of isShare.fileIds) {
      const file = await bucket.find({ _id: fileId }).toArray();
      if (!file || file.length === 0) continue;
      const fileName = file[0].metadata.originalname;
      const downloadStream = bucket.openDownloadStream(fileId);
      archive.append(downloadStream, { name: fileName });
    }

    archive.finalize();
  } catch (err) {
    res.status(500).send("Internal Server Error!! Download Failed");
  }
});

//  Export the handler for Vercel
export default app;
