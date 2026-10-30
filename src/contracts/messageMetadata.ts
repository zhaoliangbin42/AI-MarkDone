/** Optional website timestamps, expressed as milliseconds since the Unix epoch. */
export type MessageMetadata = Readonly<{ createdAt?: number; updatedAt?: number; promptCreatedAt?: number }>;

export interface MessageMetadataSource {
    read(conversationId: string, messageId: string): MessageMetadata | null;
    subscribe(listener: () => void): () => void;
}
