'use client';

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',
  }) as Promise<FeatureExtractionPipeline>;
  return extractorPromise;
}

export async function createComplaintEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text.trim(), {
    pooling: 'mean',
    normalize: true,
  });
  const values = Array.from(output.data as Float32Array, Number);
  if (values.length !== EMBEDDING_DIM || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding model returned an invalid ${values.length}-value vector.`);
  }
  return values;
}
