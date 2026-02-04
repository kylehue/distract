import type { useSocket } from "@/app/composables/use-socket";

export type OfflineMonitorLog = {
   uuid: string;
   transactionId: string;
   roomCode: string;
   scores: any;
   isPhonePresent: boolean;
   mimetype: string;
   startTime: string;
   videoPath: string;
   createdAt: string;
};

export type PostMonitorAck = {
   ok: boolean;
   shouldUploadVideo?: boolean;
};

export type BulkAck = {
   accepted: string[];
   failed: { transactionId: string; error: string }[];
};

export class OfflineMonitorQueue {
   private recordingMap = new Map<string, Blob>();
   private videoPathMap = new Map<string, string>();

   constructor(private socket: ReturnType<typeof useSocket>) {}

   /**
    * Call once on page init.
    * - Rebuild tx -> videoPath map from queued logs so uploads work after restart.
    */
   async hydrateFromDisk(): Promise<void> {
      const items = await window.api.getTempMonitorLogs();
      for (const it of items) {
         const tx = it.data?.transactionId;
         const vp = it.data?.videoPath;
         if (tx && vp) this.rememberVideoPath(tx, vp);
      }
   }

   /**
    * Store blob in memory for fast upload.
    */
   rememberRecording(transactionId: string, blob: Blob) {
      this.recordingMap.set(transactionId, blob);
   }

   /**
    * Store disk path for later upload (offline/restart-safe).
    */
   rememberVideoPath(transactionId: string, videoPath: string) {
      this.videoPathMap.set(transactionId, videoPath);
   }

   /**
    * Create and send (or queue) a monitor log.
    * 
    * Note: This does NOT upload the video; server triggers that separately via upload URL.
    */
   async sendOrQueueLog(payload: OfflineMonitorLog): Promise<void> {
      if (!this.socket.isConnected.value) {
         await window.api.writeTempMonitorLog(payload);
         return;
      }

      // Online -> try send; if failed, queue
      try {
         const ack = await this.socket.emitWithAck<PostMonitorAck>(
            "student:post_monitor_logs",
            payload,
         );

         // If server says no evidence needed, cleanup immediately
         if (ack?.ok && ack.shouldUploadVideo === false) {
            await this.cleanupTransaction(payload.transactionId);
         }
      } catch {
         await window.api.writeTempMonitorLog(payload);
      }
   }

   /**
    * Bulk flush queued logs. Safe to call repeatedly.
    * Deletes only accepted files.
    */
   async flushQueuedLogs({ chunkSize = 25, timeoutMs = 15000 } = {}) {
      if (!this.socket.isConnected.value) return;

      const items = await window.api.getTempMonitorLogs();
      if (!items.length) return;

      // Ensure we can upload from disk later
      for (const it of items) {
         const tx = it.data?.transactionId;
         const vp = it.data?.videoPath;
         if (tx && vp) this.rememberVideoPath(tx, vp);
      }

      for (let i = 0; i < items.length; i += chunkSize) {
         const chunk = items.slice(i, i + chunkSize);

         try {
            const res = await this.socket.emitWithAck<BulkAck>(
               "student:post_monitor_logs_bulk",
               { logs: chunk.map((x) => x.data) },
               timeoutMs,
            );

            const acceptedSet = new Set(res.accepted);

            await Promise.all(
               chunk
                  .filter((x) => acceptedSet.has(x.data.transactionId))
                  .map((x) => window.api.deleteTempMonitorLog(x.filePath)),
            );
         } catch {
            // stop and retry later
            return;
         }
      }
   }

   /**
    * Handles server request to upload evidence.
    * Uses memory blob first, disk fallback via readTempVideo.
    */
   async handleUploadRecordingUrl(data: {
      transactionId: string;
      url: string;
   }) {
      const transactionId = data.transactionId;
      const uploadUrl = data.url;

      let recording = this.recordingMap.get(transactionId);
      let contentType = recording?.type?.split(";")[0];

      if (!recording) {
         const videoPath = this.videoPathMap.get(transactionId);
         if (!videoPath) {
            console.warn(
               "No video path found for transaction ID:",
               transactionId,
            );
            return;
         }

         try {
            const { buffer, mimetype } =
               await window.api.readTempVideo(videoPath);

            // Buffer -> Uint8Array avoids TS BlobPart issues
            const bytes = new Uint8Array(buffer);
            contentType = String(mimetype || "application/octet-stream");
            recording = new Blob([bytes], { type: contentType });
         } catch (e) {
            console.error("Failed to read temp video for upload:", e);
            return;
         }
      }

      try {
         const result = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
               "Content-Type": contentType || "application/octet-stream",
            },
            body: recording,
         });

         if (!result.ok) throw new Error("Failed to upload recording");

         // cleanup after successful upload
         await this.cleanupTransaction(transactionId);
      } catch (error) {
         console.error(error);
         // keep files; retry can happen if server re-requests, or you add your own retry logic
      }
   }

   /**
    * Cleanup both memory + disk for a transaction.
    * Safe to call multiple times.
    */
   async cleanupTransaction(transactionId: string) {
      const videoPath = this.videoPathMap.get(transactionId);
      if (videoPath) {
         await window.api.cleanupTempVideo(videoPath);
      }
      this.videoPathMap.delete(transactionId);
      this.recordingMap.delete(transactionId);
   }

   /**
    * Clear in-memory references.
    * (Does not delete disk files; those are governed by ack/upload.)
    */
   clearMemoryOnly() {
      this.recordingMap.clear();
      // keep videoPathMap because offline queue uploads may still happen after reconnect
   }
}
