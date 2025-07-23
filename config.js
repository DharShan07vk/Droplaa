import mongoose  from "mongoose";
import dotenv from 'dotenv'

dotenv.config()
export const ConnectDB = async() =>{
   try {
      await  mongoose.connect(process.env.MongoDbUrl);
      console.log("Successfully Connected")
   } catch (error) {
      console.log(" Error : Not Connected")
   }
} 

const shareSchema = new mongoose.Schema({
  shareId : String,
  fileIds : [mongoose.Types.ObjectId],
  createdAt : {
    type : Date,
    default : Date.now,
    expires : '1d'
  }
})

export const filedb = mongoose.model('ShareId', shareSchema);


