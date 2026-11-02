import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const embeddingModel = "gemini-embedding-001";
const embeddingBatchSize = 100;

export async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing from the environment.");
    }

    if (texts.length === 0) {
        return [];
    }

    const googleGenAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    const vectors = [];
    for (let startIndex = 0; startIndex < texts.length; startIndex += embeddingBatchSize) {
        const batch = texts.slice(startIndex, startIndex + embeddingBatchSize);
        const response = await googleGenAI.models.embedContent({
            model: embeddingModel,
            contents: batch,
            config: { taskType },
        });
        const embeddings = response.embeddings;

        if (!embeddings || embeddings.length !== batch.length) {
            throw new Error(
                `Gemini returned ${embeddings?.length ?? 0} embeddings for a batch of ${batch.length} texts.`
            );
        }

        embeddings.forEach((embedding, index) => {
            if (!embedding.values?.length) {
                throw new Error(
                    `Gemini returned an empty embedding for text ${startIndex + index + 1}.`
                );
            }
            vectors.push(embedding.values);
        });
    }

    return vectors;
}

export async function indexDocument(filePath) {
    const loader = new PDFLoader(filePath, {
        splitPages: false,
    });
    const documents = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
    });

    const chunks = await textSplitter.splitDocuments(documents);
    const vectors = await embedTexts(chunks.map((chunk) => chunk.pageContent));

    return { chunks, vectors };
}