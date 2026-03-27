declare module "ffmpeg-kit-react-native" {
  export class FFmpegKit {
    static execute(command: string): Promise<FFmpegSession>;
    static executeAsync(
      command: string,
      completeCallback?: (session: FFmpegSession) => void,
      logCallback?: (log: Log) => void,
      statisticsCallback?: (statistics: Statistics) => void
    ): Promise<FFmpegSession>;
    static cancel(sessionId?: number): Promise<void>;
  }

  export class FFmpegSession {
    getSessionId(): number;
    getCommand(): string;
    getReturnCode(): Promise<ReturnCode>;
    getOutput(): Promise<string>;
    getDuration(): Promise<number>;
    getLogs(): Promise<Log[]>;
    getFailStackTrace(): Promise<string | undefined>;
    getState(): Promise<SessionState>;
  }

  export class ReturnCode {
    static isSuccess(returnCode: ReturnCode): boolean;
    static isCancel(returnCode: ReturnCode): boolean;
    getValue(): number;
  }

  export class Log {
    getSessionId(): number;
    getMessage(): string;
    getLevel(): number;
  }

  export class Statistics {
    getSessionId(): number;
    getVideoFrameNumber(): number;
    getVideoFps(): number;
    getVideoQuality(): number;
    getSize(): number;
    getTime(): number;
    getBitrate(): number;
    getSpeed(): number;
  }

  export enum SessionState {
    CREATED = 0,
    RUNNING = 1,
    FAILED = 2,
    COMPLETED = 3,
  }

  export class FFmpegKitConfig {
    static enableLogCallback(callback: (log: Log) => void): void;
    static enableStatisticsCallback(callback: (statistics: Statistics) => void): void;
  }
}
