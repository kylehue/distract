export interface MonitoringRecord {
   id: string | number;
   studentName: string;
   warningLevel: WarningLevel;
   time: number;
}

export type WarningLevel = "low" | "moderate" | "severe";

export interface RoomInfo {
   id: string | number;
   teacherId: string | number;
   title: string;
   code: string;
   studentCount: number;
   studentCapacity: number;
   status: "paused" | "monitoring" | "concluded";
   timeStarted?: number;
   timeEnded?: number;
   createdAt: number;
}

export interface RoomStudentInfo {
   id: string | number;
   roomId: string | number;
   studentUuid: string;
   studentName: string;
   totalLogs: number;
   timeJoined: number;
   timeLeft?: number;
   active: boolean;
}
