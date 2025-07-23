import express from 'express'
import archiver  from 'archiver'
import dotenv, { config } from 'dotenv'
import mongoose from 'mongoose'
import multer from 'multer'
import path  from 'path'
import crypto, { randomBytes } from 'crypto'
import { GridFsStorage } from 'multer-gridfs-storage'
import bodyParser from 'body-parser'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { METHODS } from 'http'



dotenv.config()
const app = express()
app.use(bodyParser.json())
app.set("view engine", "ejs")
app.use(express.urlencoded({extended:true}))
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.join(__filename)

//For Vercel Deployment
app.use(express.static(path.join(__dirname , "public")))
//app.set('views', path.join(__dirname , "views"))
const corsConfig = {
  origin : "*",
  Credential : true,
  methods : ["GET","POST","PUT","DELETE"]
};
app.use(cors(corsConfig))

//For Local
app.use(express.static("public"))
let bucket;

//ConnectDB();
const storage = new GridFsStorage({
  url  : process.env.MongoDbUrl,
  file : (req,file)=>{
    return new Promise((resolve,reject)=>{
      crypto.randomBytes(16,(err,buf)=>{
        if(err){
          console.log("Error Catch in app.js in storage Multer")
          return reject(err);
        }
        const original = file.originalname
        console.log("Original Name --- " + original)
        const filename = buf.toString('hex') + path.extname(file.originalname)
        const fileInfo = {
          filename : filename,
          metadata : {
            originalname : original,
          },
          
          bucketName : 'uploads'
        };
        resolve(fileInfo);
      })
    })
  }
});

const upload = multer({ storage })

console.log(process.env.MongoDbUrl)
const url = process.env.MongoDbUrl;
const connect = await mongoose.createConnection(url,{
  useNewurlParser : true,
  useUnifiedTopology : true
})
const shareSchema = new mongoose.Schema({
  shareId: String,
  fileIds: [mongoose.Types.ObjectId],
  createdAt: { type: Date, default: Date.now, expires: '1d' } // auto delete after 1 day
});

const filedb = connect.model('Share', shareSchema);

connect.once("open",()=>{
  bucket = new mongoose.mongo.GridFSBucket(connect.db,{
    bucketName : 'uploads'
  })
  console.log("Connected and Bucket Created")
})


app.listen(3000,'0.0.0.0',()=>{
  console.log("Listening on 3000");
})
// Routes
app.get('/', (req, res) => {
  res.render("home", {fileIds : []})
})

app.post('/upload/file', upload.array("files"), async (req, res) => {
  const fileIds = req.files.map(file => file.id);

  const shareId = randomBytes(3).toString("hex"); // e.g. "a3b2c1"

  await filedb.create({ shareId, fileIds });

  res.send(shareId)
});

app.get("/download", (req,res)=>{
  res.render("download.ejs")
})
app.get("/download/:id", async (req, res) => {
 try{
    const shareId = req.params.id;
    const isShare = await filedb.findOne({shareId})
    if(!isShare) return res.status(404).send(("No Files Shared"))
    const archive = archiver('zip',{zlib:{level:9}})
    res.attachment(`shared-files-${shareId}.zip`);
    archive.pipe(res);

    for(const fileId of isShare.fileIds){
      const file = await bucket.find({_id : fileId}).toArray();
      if(!file || file.length == 0)continue;
      const fileName = file[0].metadata.originalname;
      const downloadStream = bucket.openDownloadStream(fileId)
      archive.append(downloadStream , {name : fileName});
    }
    archive.finalize();
 }
 catch(err){
    console.log("Error Catched" , err);
    res.status(500).send("Internal Server Error!! DownLoad Filed")
 }
});


