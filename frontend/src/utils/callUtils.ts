import type { VoiceCallEntity } from "../types/calls";
import type { Connection, Call } from "@twilio/voice-sdk";

export const isVoiceConnection = (
  call: VoiceCallEntity
): call is Connection => {
  return (call as Connection).accept !== undefined;
};

export const isVoiceCall = (call: VoiceCallEntity): call is Call => {
  return (call as Call).direction !== undefined;
};
