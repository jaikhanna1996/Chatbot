import path from "node:path";
import { fileURLToPath } from "node:url";
import { embedTexts, indexDocument } from "./prepare.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "NexusTech_Employee_Handbook.pdf");
const question = "What is the company's leave policy?";
const topK = 3;

const { chunks, vectors } = await indexDocument(filePath);
const [questionVector] = await embedTexts([question], "RETRIEVAL_QUERY");

const results = chunks
    .map((chunk, index) => ({
        chunk,
        score: cosineSimilarity(questionVector, vectors[index]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

console.log(`Question: ${question}\n`);
console.log(`Top ${results.length} relevant chunks:\n`);

for (const [index, result] of results.entries()) {
    console.log(`Result ${index + 1} (similarity: ${result.score.toFixed(4)}):`);
    console.log(result.chunk.pageContent);
    console.log();
}

function cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
        throw new Error("Cannot compare vectors with different dimensions.");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let index = 0; index < vectorA.length; index += 1) {
        dotProduct += vectorA[index] * vectorB[index];
        magnitudeA += vectorA[index] ** 2;
        magnitudeB += vectorB[index] ** 2;
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        throw new Error("Cannot compare a zero-length embedding.");
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}