export interface MonitorLog {
   id: string | number;
   roomId: string | number;
   studentId: string | number;
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
   id: string | number;
   teacherAccountId: string | number;
   title: string;
   code: string;
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
   id: string | number;
   roomId: string | number;
   uuid: string;
   name: string;
   timeJoined: number;
   timeLeft?: number;
   active: boolean;
   createdAt: number;
}

export interface TeacherInfo {
   id: string | number;
   displayName: string;
   createdAt: number;
}
