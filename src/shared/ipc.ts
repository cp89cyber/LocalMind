import type { EndedReason, RecommendationContext, ThumbValue } from "./types";

export const IPC_CHANNELS = {
  chooseLibraryFolder: "localmind:chooseLibraryFolder",
  scanLibrary: "localmind:scanLibrary",
  getLibraryTracks: "localmind:getLibraryTracks",
  submitThumb: "localmind:submitThumb",
  getNextRecommendation: "localmind:getNextRecommendation",
  recordPlayStart: "localmind:recordPlayStart",
  recordPlayEnd: "localmind:recordPlayEnd"
} as const;

export interface IpcPayloads {
  [IPC_CHANNELS.chooseLibraryFolder]: [];
  [IPC_CHANNELS.scanLibrary]: [folderPath: string];
  [IPC_CHANNELS.getLibraryTracks]: [];
  [IPC_CHANNELS.submitThumb]: [trackId: string, value: ThumbValue];
  [IPC_CHANNELS.getNextRecommendation]: [ctx: RecommendationContext];
  [IPC_CHANNELS.recordPlayStart]: [trackId: string];
  [IPC_CHANNELS.recordPlayEnd]: [
    trackId: string,
    percentPlayed: number,
    endedReason: EndedReason
  ];
}
