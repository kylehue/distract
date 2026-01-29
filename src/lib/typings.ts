export interface MonitorLog {
   id: string;
   roomId: string;
   studentId: string;
   warningLevel: WarningLevel;
   createdAt: number;

   integrityScore: number;
   rfScoreAvg: number;
   ifScoreAvg: number;

   recordingPath: string;
   recordingUrl: string;
}

export type WarningLevel = "none" | "low" | "moderate" | "severe";

export interface RoomInfo {
   id: string;
   teacherAccountId: string;
   title: string;
   code: string;
   studentCount: number;
   studentCapacity: number;
   status: "paused" | "monitoring" | "concluded";
   timeStarted?: number;
   timeEnded?: number;
   evidenceWarningLevel: WarningLevel;
   severeWarningPunishment: boolean;
   allowLateStudents: boolean;
   joinConfirmation: boolean;
   createdAt: number;
}

export interface StudentInfo {
   id: string;
   roomId: string;
   uuid: string;
   name: string;
   timeJoined: number;
   timeLeft?: number;
   active: boolean;
   permitted: boolean;
   lockMonitorLogId?: string;
   createdAt: number;
}

export interface TeacherInfo {
   id: string;
   displayName: string;
   createdAt: number;
}
