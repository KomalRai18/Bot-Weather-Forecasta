import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import bodyParser from 'body-parser';
import cors from 'cors'
import cookieParser from 'cookie-parser';
import { handleWebhook } from './controllers/webhookController';


const app = express();


app.use(express.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cookieParser())
app.use(cors())

app.get('/', (req,res)=>{
    return res.send('hello world!')
})

app.post('/webhook', handleWebhook);

// app.use('/v1/app', )
const PORT = process.env.PORT 

app.listen(PORT, ()=>{
    console.log('App is started at port ', PORT)
})