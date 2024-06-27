import express from 'express';
import multer from 'multer';
// import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

import { Document, Packer, Paragraph, TextRun } from 'docx';
import { writeFileSync } from 'fs';
import JSZip from 'jszip';
import { translate } from '@vitalets/google-translate-api';

import puppeteer from 'puppeteer';
// import pdf2docx from 'pdf2docx';
import os from 'os';


import htmlToDocx from 'html-to-docx';



import dotenv from 'dotenv';
import OpenAI from 'openai';

import { JSDOM } from 'jsdom';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import pkg from 'file-saver';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const { saveAs } = pkg;




const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));



const upload = multer({ dest: 'uploads/' });


mongoose.connect('mongodb://localhost:27017/cat-tool', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


// Schema động cho mỗi lần upload
const createSegmentModel = (collectionName) => {
    if (mongoose.models[collectionName]) {
        return mongoose.models[collectionName];
    }

    const segmentSchema = new mongoose.Schema({
        original: String,
        translation: String
    });

    return mongoose.model(collectionName, segmentSchema, collectionName);
};

const metaSchema = new mongoose.Schema({
    fileName: String,
    collectionName: String,
    filePath:String,
    uploadDate: { type: Date, default: Date.now }
});

const Meta = mongoose.model('Meta', metaSchema);


// Hàm dịch văn bản
async function translateText(text, targetLang) {
    try {
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (err) {
        console.error('Lỗi khi dịch văn bản:', err);
        throw err;
    }
}


// Đoạn văn bản cố định để dịch
const textToTranslate = "This is a fixed text to translate.";

// Tạo endpoint để dịch đoạn văn bản cố định
app.get('/translate', async (req, res) => {
    const targetLang = req.query.targetLang;

    if (!targetLang) {
        return res.status(400).send('Thiếu tham số "targetLang"');
    }

    try {
        const translatedText = await translateText(textToTranslate, targetLang);
        res.json({ translatedText });
    } catch (err) {
        res.status(500).send('Lỗi khi dịch văn bản');
    }
});


app.get('/', (req, res) => {
    main();
    res.send('Backend server is running');
});

// Hàm tách nội dung từ file DOCX
const extractTextFromDOCX = async (filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const data = await mammoth.extractRawText({ path: filePath });
    return data.value;
};

//test tích hợp chatGPT
async function main() {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: "You are a helpful assistant." }],
      model: "davinci-002",
    });
  
    console.log(completion.choices[0]);
  }

// async function translateText(text, targetLanguage) {
//     try {
//         // const completion= await openai.chat.completions.create({
//         //     model: "gpt-3.5-turbo",
//         //     prompt: `Translate the following text to ${targetLanguage}: ${text}`,
//         //     max_tokens: 1000
//         // });
//         const completion = await openai.completions.create({
//             model: 'gpt-3.5-turbo-instruct',
//             prompt: 'Write a tagline for an ice cream shop.'
//         });
//         console.log(completion);
//         return completion.choices[0].message.content
//     } catch (error) {
//         console.error('Lỗi khi dịch văn bản:', error);
//         throw error;
//     }
// }

app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase();
    const collectionName = `segments_${Date.now()}`;
    const Segment = createSegmentModel(collectionName);

    let text = '';

    try {
        if (fileType === '.pdf') {
            // text = await extractTextFromPDF(filePath);
        } else if (fileType === '.docx') {
            text = await extractTextFromDOCX(filePath);
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        const textTranslate=await translateText(text,"vi");
        // console.log(textTranslate);
        // console.log("text:"+text)
        // Tách nội dung bởi dấu `:` và dấu `.`
        const segments = text.split(/(?<=[.:])\s+|\s{2,}/);
        const segmentsTranslate = textTranslate.split(/(?<=[.:])\s+|\s{2,}/);
        const segmentDocuments = segments.map((segment, index) => ({
            original: segment,
            translation: segmentsTranslate[index] || ''
        }));

        // const translatedSegments = await Promise.all(
        //     segments.map(async (segment) => {
        //         let retryCount = 0;
        //         while (retryCount < 3) {
        //             try {
        //                 let translation = await translateText(segment, 'Vietnamese');
        //                 console.log(translation);
        //                 return {
        //                     original: segment,
        //                     translation: translation
        //                 };
        //             } catch (error) {
        //                 console.error(`Lỗi khi dịch đoạn văn: ${segment}`);
        //                 console.error(error);
        //                 if (error.message.includes('Slowdown')) {
        //                     await new Promise(resolve => setTimeout(resolve, 10000));
        //                     retryCount++;
        //                 } else {
        //                     return {
        //                         original: segment,
        //                         translation: ""
        //                     };
        //                 }
        //             }
        //         }
        //         console.error(`Không thể dịch đoạn văn sau ${retryCount} lần thử lại: ${segment}`);
        //         return {
        //             original: segment,
        //             translation: ""
        //         };
        //     })
        // );
        




        await Segment.insertMany(segmentDocuments );

        // Lưu thông tin vào collection Meta
        const metaDocument = new Meta({
            fileName: req.file.originalname,
            collectionName: collectionName,
            filePath: filePath  // Lưu trữ đường dẫn tệp
        });
        await metaDocument.save();

        fs.unlinkSync(filePath);

        res.json({ message: 'File processed successfully', segments: segmentDocuments , collectionName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/meta', async (req, res) => {
    const metas = await Meta.find();
    res.json(metas);
});



app.get('/translations/:fileName', async (req, res) => {
    const { fileName } = req.params;
    console.log(fileName);
    const meta = await Meta.findOne({ collectionName: fileName });
    console.log(meta )

    if (!meta) {
        return res.status(404).json({ error: 'File not found' });
    }

    const Segment = createSegmentModel(meta.collectionName);
    const segments = await Segment.find();
    res.json(segments);
});

app.put('/translations/:fileName/:id', express.json(), async (req, res) => {
    const { fileName, id } = req.params;
    const { translation } = req.body;
    const meta = await Meta.findOne({ collectionName: fileName });

    if (!meta) {
        return res.status(404).json({ error: 'File not found' });
    }

    const Segment = createSegmentModel(meta.collectionName);
    await Segment.findByIdAndUpdate(id, { translation });
    res.json({ message: 'Translation updated successfully' });
});

// Hàm để thoát các ký tự đặc biệt trong biểu thức chính quy
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& nghĩa là toàn bộ chuỗi khớp
}

function replaceText(html, translations) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const NodeFilter = {
        SHOW_TEXT: 4
    };

    translations.forEach(({ original, translation }) => {
        const escapedOriginal = escapeRegExp(original);
        const regex = new RegExp(escapedOriginal, 'g');

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while (node = walker.nextNode()) {
            node.nodeValue = node.nodeValue.replace(regex, translation);
            // console.log("test:"+node.nodeValue+"\n" )
        }
    });

    return document.body.innerHTML;
}


// async function replaceTextInDocx(templatePath, translations) {
//     // Đọc và chuyển đổi tài liệu Word sang HTML
//     const { value: html } = await mammoth.convertToHtml({ path: templatePath });

//     // Thay thế văn bản trong HTML
//     const replacedHtml = replaceText(html, translations);

//     // Chuyển đổi HTML sang tài liệu Word
//     const docx = htmlDocx.asBlob(replacedHtml);

   


//     const outputPath = path.join(os.homedir(), 'Downloads', `translated_${Date.now()}.docx`);
//     fs.writeFileSync(outputPath, Buffer.from(await docx.arrayBuffer()));


//     return outputPath;
// }

async function replaceTextInDocx(templatePath, translations) {
    // Đọc nội dung HTML từ tệp
    // const html = fs.readFileSync(templatePath, 'utf8');

        // Đọc và chuyển đổi tài liệu Word sang HTML
    const { value: html } = await mammoth.convertToHtml({ path: templatePath });
    // console.log(html)

    // Thay thế văn bản trong HTML
    const replacedHtml = replaceText(html, translations);

 

    // Chuyển đổi HTML sang tài liệu Word
    const docx = await htmlToDocx(replacedHtml);

    const outputPath = path.join(os.homedir(), 'Downloads', `translated_${Date.now()}.docx`);
    fs.writeFileSync(outputPath, docx);

    return outputPath;
}






app.post('/download/:fileName', async (req, res) => {
    const { fileName } = req.params;
    const meta = await Meta.findOne({ collectionName: fileName });

    if (!meta) {
        return res.status(404).json({ error: 'File not found' });
    }

    const Segment = createSegmentModel(meta.collectionName);
    const segments = await Segment.find();

    const translations = segments.map((segment) => ({
        original: segment.original,
        translation: segment.translation && segment.translation.trim() !== "" ? segment.translation : segment.original,
    }));

    // console.log(translations);
    //Lấy đường dẫn đến file template ở máy mình
    // const templatePath = '/Users/tranhuy/Desktop/DevOps/Devop_lithuyet/Jenkins.docx';
    const templatePath = '/Users/tranhuy/Desktop/Use Case _ Login Admin.docx';
    try {
        const outputPath = await replaceTextInDocx(templatePath, translations);
        res.download(outputPath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            fs.unlinkSync(outputPath);
        });
    } catch (err) {
        console.error('Error processing document:', err);
        res.status(500).json({ error: 'Error processing document' });
    }
});

app.listen(3001, () => {
    console.log('Server is running on port 3001');
});
